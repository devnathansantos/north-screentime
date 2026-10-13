/**
 * NORTH V1.2 — carteira e créditos de lazer.
 *
 * A carteira monetária é um extrato append-only: lançamentos financeiros
 * nunca são editados nem apagados. O saldo é sempre calculado pelo extrato.
 *
 * Créditos de lazer são uma carteira separada de minutos comprados. Este
 * módulo NÃO inicia cronômetros nem mede o uso real de outros aplicativos.
 * O usuário registra manualmente os minutos que já utilizou.
 */

export const ENTRY_TYPES = Object.freeze({
  EARNING: 'ganho',
  SPENDING: 'gasto',
  REVERSAL: 'estorno',
  ADJUSTMENT: 'ajuste',
});

export const DEFAULT_TASK_THEMES = Object.freeze([
  'Estudos',
  'Saúde e movimento',
  'Programação e carreira',
  'Casa e responsabilidades',
  'Organização pessoal',
  'Leitura e aprendizado',
  'Relacionamentos',
  'Finanças',
  'Outro',
]);

export const DEFAULT_APP_RULES = Object.freeze([
  { id: 'tiktok', name: 'TikTok', mode: 'restrict', builtIn: true },
  { id: 'instagram', name: 'Instagram', mode: 'restrict', builtIn: true },
  { id: 'youtube', name: 'YouTube', mode: 'allow', builtIn: true },
  { id: 'x', name: 'X', mode: 'allow', builtIn: true },
  { id: 'facebook', name: 'Facebook', mode: 'allow', builtIn: true },
  { id: 'reddit', name: 'Reddit', mode: 'allow', builtIn: true },
  { id: 'twitch', name: 'Twitch', mode: 'allow', builtIn: true },
  { id: 'games', name: 'Jogos', mode: 'allow', builtIn: true },
]);

export function createId() {
  return globalThis.crypto?.randomUUID?.() ||
    `north-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

export function createInitialState() {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    settings: {
      coinsPerReward: 20,
      minutesPerReward: 15,
      minuteStep: 15,
      backupReminderDays: 7,
      sheetsUrl: '',
      syncToken: '',
      lastBackupReminderAt: null,
      taskThemes: [...DEFAULT_TASK_THEMES],
      customThemes: [],
      appRules: DEFAULT_APP_RULES.map((item) => ({ ...item })),
    },
    missions: [
      { id: 'study-25', name: 'Estudar por 25 minutos', category: 'Estudos', reward: 20, recurrence: 'daily', active: true, createdAt: now },
      { id: 'task-done', name: 'Concluir uma tarefa importante', category: 'Organização pessoal', reward: 20, recurrence: 'daily', active: true, createdAt: now },
      { id: 'workout', name: 'Treinar ou praticar esporte', category: 'Saúde e movimento', reward: 20, recurrence: 'daily', active: true, createdAt: now },
    ],
    rewards: [
      { id: 'leisure-15', name: '15 minutos de lazer', cost: 20, minutes: 15, active: true, createdAt: now },
      { id: 'leisure-30', name: '30 minutos de lazer', cost: 40, minutes: 30, active: true, createdAt: now },
    ],
    ledger: [],
    leisureCredits: [],
    leisureUsage: [],
    completedMissions: [],
    syncQueue: [],
    lastBackupAt: null,
    pendingChanges: [],
    syncedEntryIds: [],
  };
}

function assertState(state) {
  if (!state || typeof state !== 'object' ||
      !Array.isArray(state.ledger) ||
      !Array.isArray(state.missions) ||
      !Array.isArray(state.rewards) ||
      !Array.isArray(state.leisureCredits)) {
    throw new Error('Estado da carteira inválido.');
  }
}

function clone(state) {
  assertState(state);
  return structuredClone(state);
}

function iso(when) {
  const date = new Date(when);
  if (Number.isNaN(date.getTime())) throw new Error('Data inválida.');
  return date.toISOString();
}

/** Retorna AAAA-MM-DD no fuso local do aparelho. */
export function localDateKey(when = new Date()) {
  const date = new Date(when);
  if (Number.isNaN(date.getTime())) throw new Error('Data inválida.');
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function weekKey(when) {
  const date = new Date(when);
  date.setHours(12, 0, 0, 0);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return localDateKey(date);
}

export function missionIdempotencyKey(mission, when = new Date()) {
  if (!mission?.id) throw new Error('Missão sem ID.');
  if (mission.recurrence === 'once') return `missao:${mission.id}:unica`;
  if (mission.recurrence === 'weekly') return `missao:${mission.id}:${weekKey(when)}`;
  if (mission.recurrence === 'daily' || !mission.recurrence) {
    return `missao:${mission.id}:${localDateKey(when)}`;
  }
  throw new Error('Recorrência inválida.');
}

export function getBalance(state) {
  assertState(state);
  const balance = state.ledger.reduce((sum, entry) => {
    if (!Number.isSafeInteger(entry.value)) {
      throw new Error('Lançamento com valor inválido.');
    }
    return sum + entry.value;
  }, 0);
  if (!Number.isSafeInteger(balance)) throw new Error('Saldo excede o limite numérico seguro.');
  return balance;
}

export function getAvailableLeisureMinutes(state) {
  assertState(state);
  return state.leisureCredits.reduce((sum, credit) => {
    if (credit.status !== 'available') return sum;
    const remaining = Number.isSafeInteger(credit.remainingMinutes)
      ? credit.remainingMinutes
      : credit.minutes;
    return sum + Math.max(0, remaining || 0);
  }, 0);
}

function append(state, entry) {
  if (state.ledger.some((item) => item.id === entry.id)) {
    throw new Error('ID de lançamento duplicado.');
  }

  const duplicate = state.ledger.find((item) =>
    item.idempotencyKey && item.idempotencyKey === entry.idempotencyKey
  );
  if (duplicate) return { state, duplicate: true, entry: duplicate };

  const next = {
    ...state,
    ledger: [...state.ledger, entry],
    syncQueue: [...(state.syncQueue || []), entry],
  };
  const balance = getBalance(next);
  if (balance < 0) throw new Error('Saldo insuficiente: a operação não pode gerar saldo negativo.');
  return { state: next, duplicate: false, entry };
}

export function completeMission(originalState, missionId, when = new Date()) {
  const state = clone(originalState);
  const mission = state.missions.find((item) => item.id === missionId);
  if (!mission) throw new Error('Missão não encontrada.');
  if (mission.active === false) throw new Error('Missão desativada.');
  if (!Number.isSafeInteger(mission.reward) || mission.reward <= 0) {
    throw new Error('Recompensa da missão inválida.');
  }

  const key = missionIdempotencyKey(mission, when);
  const oldEntry = state.ledger.find((entry) => entry.idempotencyKey === key);
  if (oldEntry) return { state: originalState, duplicate: true, entry: oldEntry };

  const entry = {
    id: createId(),
    type: ENTRY_TYPES.EARNING,
    value: mission.reward,
    origin: 'mission',
    originId: mission.id,
    createdAt: iso(when),
    idempotencyKey: key,
    description: `Missão concluída: ${mission.name}`,
  };
  return append(state, entry);
}

export function purchaseReward(originalState, rewardId, when = new Date()) {
  const state = clone(originalState);
  const reward = state.rewards.find((item) => item.id === rewardId);
  if (!reward || reward.active === false) throw new Error('Recompensa indisponível.');
  if (!Number.isSafeInteger(reward.cost) || reward.cost <= 0 ||
      !Number.isSafeInteger(reward.minutes) || reward.minutes <= 0) {
    throw new Error('Custo e minutos devem ser inteiros positivos.');
  }
  if (getBalance(state) < reward.cost) throw new Error('Saldo insuficiente para esta compra.');

  const id = createId();
  const entry = {
    id,
    type: ENTRY_TYPES.SPENDING,
    value: -reward.cost,
    origin: 'reward',
    originId: reward.id,
    createdAt: iso(when),
    idempotencyKey: `compra:${id}`,
    description: `Compra: ${reward.name}`,
  };
  const result = append(state, entry);

  // Minutos ficam guardados até o usuário registrar que os utilizou.
  // Não há expiração nem contagem regressiva nesta versão.
  const credit = {
    id,
    ledgerEntryId: entry.id,
    rewardId: reward.id,
    minutes: reward.minutes,
    remainingMinutes: reward.minutes,
    usedMinutes: 0,
    createdAt: iso(when),
    status: 'available',
  };

  return {
    state: { ...result.state, leisureCredits: [...result.state.leisureCredits, credit] },
    duplicate: false,
    entry,
    credit,
  };
}

/**
 * Registra manualmente minutos já utilizados.
 * step deve ser 1 ou 15 conforme a preferência do usuário.
 * Usa os créditos disponíveis pela ordem de compra (FIFO).
 */
export function consumeLeisureMinutes(
  originalState,
  amount,
  appName = '',
  when = new Date(),
  step = 1
) {
  const state = clone(originalState);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('Informe quantos minutos foram utilizados.');
  }
  if (![1, 15].includes(step)) throw new Error('O intervalo deve ser 1 ou 15 minutos.');
  if (amount % step !== 0) {
    throw new Error(`A quantidade deve ser múltipla de ${step} minuto(s).`);
  }

  const available = getAvailableLeisureMinutes(state);
  if (amount > available) {
    throw new Error(`Você tem apenas ${available} minuto(s) de lazer disponíveis.`);
  }

  let remainingToConsume = amount;
  const credits = [...state.leisureCredits]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const consumedFrom = [];

  const updatedCredits = credits.map((credit) => {
    if (credit.status !== 'available' || remainingToConsume <= 0) return credit;

    const remaining = Number.isSafeInteger(credit.remainingMinutes)
      ? credit.remainingMinutes
      : credit.minutes;
    const taken = Math.min(remaining, remainingToConsume);
    if (taken <= 0) return credit;

    remainingToConsume -= taken;
    consumedFrom.push({ creditId: credit.id, minutes: taken });
    const nextRemaining = remaining - taken;

    return {
      ...credit,
      remainingMinutes: nextRemaining,
      usedMinutes: (credit.usedMinutes || 0) + taken,
      status: nextRemaining === 0 ? 'consumed' : 'available',
      lastUsedAt: iso(when),
    };
  });

  if (remainingToConsume !== 0) {
    throw new Error('Não foi possível alocar os minutos nos créditos existentes.');
  }

  const usage = {
    id: createId(),
    minutes: amount,
    appName: String(appName || '').trim(),
    usedAt: iso(when),
    consumedFrom,
  };

  return {
    state: {
      ...state,
      leisureCredits: updatedCredits,
      leisureUsage: [...(state.leisureUsage || []), usage],
    },
    usage,
  };
}

/**
 * Estorna um lançamento acrescentando uma nova linha ao extrato.
 * Não permite estornar uma compra cujo crédito já tenha sido utilizado.
 */
export function reverseEntry(originalState, entryId, when = new Date(), reason = 'Correção') {
  const state = clone(originalState);
  const target = state.ledger.find((entry) => entry.id === entryId);
  if (!target) throw new Error('Lançamento não encontrado.');

  const key = `estorno:${entryId}`;
  const previous = state.ledger.find((entry) => entry.idempotencyKey === key);
  if (previous) return { state: originalState, duplicate: true, entry: previous };

  const associatedCredit = state.leisureCredits.find((credit) => credit.ledgerEntryId === target.id);
  if (target.type === ENTRY_TYPES.SPENDING && associatedCredit) {
    const remaining = Number.isSafeInteger(associatedCredit.remainingMinutes)
      ? associatedCredit.remainingMinutes
      : associatedCredit.minutes;
    if (remaining !== associatedCredit.minutes || (associatedCredit.usedMinutes || 0) > 0 ||
        associatedCredit.status === 'consumed') {
      throw new Error('Não é possível estornar uma compra depois de usar parte do crédito.');
    }
  }

  const entry = {
    id: createId(),
    type: ENTRY_TYPES.REVERSAL,
    value: -target.value,
    origin: target.origin,
    originId: target.originId || target.id,
    createdAt: iso(when),
    idempotencyKey: key,
    description: `Estorno de ${entryId}: ${String(reason || 'Correção').trim()}`,
    referenceEntryId: target.id,
  };
  const result = append(state, entry);

  let leisureCredits = result.state.leisureCredits;
  if (target.type === ENTRY_TYPES.SPENDING && associatedCredit) {
    leisureCredits = leisureCredits.map((credit) =>
      credit.id === associatedCredit.id
        ? { ...credit, remainingMinutes: 0, status: 'reversed', reversedAt: iso(when) }
        : credit
    );
  }
  return { ...result, state: { ...result.state, leisureCredits } };
}

export function adjustBalance(originalState, amount, description, when = new Date()) {
  if (!Number.isSafeInteger(amount) || amount === 0) {
    throw new Error('O ajuste deve ser um inteiro diferente de zero.');
  }
  if (!String(description || '').trim()) throw new Error('Informe a descrição do ajuste.');

  const state = clone(originalState);
  const entry = {
    id: createId(),
    type: ENTRY_TYPES.ADJUSTMENT,
    value: amount,
    origin: 'adjustment',
    originId: null,
    createdAt: iso(when),
    idempotencyKey: `ajuste:${createId()}`,
    description: String(description).trim(),
  };
  return append(state, entry);
}

/** A configuração de bloqueio é apenas uma lista de preferências no app web. */
export function getTargetApps(state) {
  return state.settings?.appRules || [];
}

/** Agenda alterações de missões/recompensas para o dia local seguinte. */
export function scheduleNextDayChange(originalState, change, when = new Date()) {
  const state = clone(originalState);
  const date = new Date(when);
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);
  return {
    ...state,
    pendingChanges: [
      ...(state.pendingChanges || []),
      { id: createId(), effectiveAt: date.toISOString(), change },
    ],
  };
}

export function applyPendingChanges(originalState, when = new Date()) {
  const state = clone(originalState);
  const now = new Date(when).getTime();
  const due = (state.pendingChanges || []).filter((item) => new Date(item.effectiveAt).getTime() <= now);
  const future = (state.pendingChanges || []).filter((item) => new Date(item.effectiveAt).getTime() > now);
  let next = { ...state, pendingChanges: future };

  for (const item of due) {
    const change = item.change;
    if (change.kind === 'addMission') next.missions = [...next.missions, change.item];
    if (change.kind === 'addReward') next.rewards = [...next.rewards, change.item];
    if (change.kind === 'toggleMission') next.missions = next.missions.map((mission) => mission.id === change.id ? { ...mission, active: change.active } : mission);
    if (change.kind === 'toggleReward') next.rewards = next.rewards.map((reward) => reward.id === change.id ? { ...reward, active: change.active } : reward);
    if (change.kind === 'settings') next.settings = { ...next.settings, ...change.values };
  }
  return next;
}
