/** Criação e validação de recompensas. */
import { createId } from './wallet.js';

export function createReward({ name, cost = 20, minutes = 15, minuteStep = 15 }) {
  if (!String(name || '').trim()) throw new Error('Dê um nome à recompensa.');
  if (!Number.isSafeInteger(cost) || cost <= 0) throw new Error('O custo deve ser um inteiro positivo.');
  if (!Number.isSafeInteger(minutes) || minutes <= 0) throw new Error('Os minutos devem ser um inteiro positivo.');
  if (![1, 15].includes(minuteStep)) throw new Error('O intervalo de minutos deve ser 1 ou 15.');
  if (minutes % minuteStep !== 0) {
    throw new Error(`Os minutos devem ser múltiplos de ${minuteStep}.`);
  }

  return {
    id: createId(),
    name: String(name).trim(),
    cost,
    minutes,
    active: true,
    createdAt: new Date().toISOString(),
  };
}
