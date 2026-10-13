/** Criação e validação de missões do NORTH. */
import { createId } from './wallet.js';

export function createMission({ name, reward = 20, recurrence = 'daily', category = 'Outro' }) {
  if (!String(name || '').trim()) throw new Error('Dê um nome à missão.');
  if (!Number.isSafeInteger(reward) || reward <= 0) throw new Error('A recompensa deve ser um inteiro positivo.');
  if (!['once', 'daily', 'weekly'].includes(recurrence)) throw new Error('Recorrência inválida.');
  if (!String(category || '').trim()) throw new Error('Escolha um tema para a missão.');

  return {
    id: createId(),
    name: String(name).trim(),
    category: String(category).trim(),
    reward,
    recurrence,
    active: true,
    createdAt: new Date().toISOString(),
  };
}
