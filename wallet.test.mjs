import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  getBalance,
  getAvailableLeisureMinutes,
  completeMission,
  purchaseReward,
  consumeLeisureMinutes,
  reverseEntry,
  localDateKey,
} from './wallet.js';
import { createMission } from './tasks.js';
import { createReward } from './rewards.js';
import { parseBackup } from './backup.js';

const day = '2026-10-13T12:00:00.000Z';

function stateWithCoins(amount = 20) {
  let state = createInitialState();
  const entry = {
    id: 'test-grant',
    type: 'ganho',
    value: amount,
    origin: 'test',
    originId: null,
    createdAt: day,
    idempotencyKey: 'teste:credito-inicial',
    description: 'Crédito de teste',
  };
  state.ledger.push(entry);
  return state;
}

test('saldo é calculado pela soma do extrato', () => {
  const result = completeMission(createInitialState(), 'study-25', day);
  assert.equal(getBalance(result.state), 20);
});

test('idempotência impede pagamento repetido no mesmo dia local', () => {
  let state = createInitialState();
  state = completeMission(state, 'study-25', '2026-10-13T23:59:00.000Z').state;
  const result = completeMission(state, 'study-25', '2026-10-14T00:01:00.000Z');
  assert.equal(result.duplicate, true);
  assert.equal(getBalance(result.state), 20);
});

test('compra sem saldo é bloqueada', () => {
  assert.throws(() => purchaseReward(createInitialState(), 'leisure-15', day), /Saldo insuficiente/);
});

test('créditos comprados não expiram nem iniciam cronômetro', () => {
  const state = stateWithCoins(40);
  const result = purchaseReward(state, 'leisure-15', day);
  assert.equal(result.credit.remainingMinutes, 15);
  assert.equal(result.credit.status, 'available');
  assert.equal('endsAt' in result.credit, false);
  assert.equal('expiresAt' in result.credit, false);
  assert.equal(getAvailableLeisureMinutes(result.state), 15);
});

test('registro de minutos utilizados desconta a carteira sem timer', () => {
  let state = purchaseReward(stateWithCoins(40), 'leisure-30', day).state;
  const result = consumeLeisureMinutes(state, 15, 'TikTok', '2026-10-13T13:00:00Z', 15);
  assert.equal(getAvailableLeisureMinutes(result.state), 15);
  assert.equal(result.usage.minutes, 15);
  assert.equal(result.usage.appName, 'TikTok');
  assert.equal(result.state.leisureUsage.length, 1);
});

test('registro respeita incrementos configurados de 1 ou 15 minutos', () => {
  const state = purchaseReward(stateWithCoins(40), 'leisure-30', day).state;
  assert.throws(() => consumeLeisureMinutes(state, 5, 'Instagram', day, 15), /múltipla de 15/);
  const result = consumeLeisureMinutes(state, 5, 'Instagram', day, 1);
  assert.equal(getAvailableLeisureMinutes(result.state), 25);
});

test('não permite consumir mais minutos que os disponíveis', () => {
  const state = purchaseReward(stateWithCoins(20), 'leisure-15', day).state;
  assert.throws(() => consumeLeisureMinutes(state, 30, 'TikTok', day, 15), /apenas 15/);
});

test('estorno de compra devolve moedas e invalida o crédito não utilizado', () => {
  const purchase = purchaseReward(stateWithCoins(40), 'leisure-15', day);
  const result = reverseEntry(purchase.state, purchase.entry.id, day, 'teste');
  assert.equal(getBalance(result.state), 40);
  assert.equal(result.state.leisureCredits[0].status, 'reversed');
  assert.equal(getAvailableLeisureMinutes(result.state), 0);
});

test('não permite estornar uma compra cujo crédito foi parcialmente utilizado', () => {
  const purchase = purchaseReward(stateWithCoins(40), 'leisure-30', day);
  const used = consumeLeisureMinutes(purchase.state, 15, 'Instagram', day, 15);
  assert.throws(() => reverseEntry(used.state, purchase.entry.id, day), /depois de usar parte/);
});

test('estorno não edita o lançamento original', () => {
  const initial = completeMission(createInitialState(), 'study-25', day).state;
  const original = initial.ledger[0];
  const result = reverseEntry(initial, original.id, day, 'teste');
  assert.equal(result.state.ledger[0].id, original.id);
  assert.equal(result.state.ledger.length, 2);
});

test('chave diária usa o dia local do dispositivo', () => {
  assert.equal(
    localDateKey(new Date('2026-10-14T02:00:00.000Z')),
    localDateKey(new Date('2026-10-13T23:00:00.000Z')),
  );
});

test('criação de missão aceita temas personalizados', () => {
  const mission = createMission({ name: 'Estudar inglês', reward: 20, category: 'Inglês', recurrence: 'daily' });
  assert.equal(mission.category, 'Inglês');
});

test('recompensas rejeitam minutos fora do incremento configurado', () => {
  assert.throws(() => createReward({ name: '10 minutos', cost: 20, minutes: 10, minuteStep: 15 }), /múltiplos de 15/);
  assert.equal(createReward({ name: '10 minutos', cost: 20, minutes: 10, minuteStep: 1 }).minutes, 10);
});

test('importação rejeita backup inválido', () => {
  assert.throws(() => parseBackup('{"schemaVersion":2}'), /Backup incompleto/);
});
