/**
 * NORTH V1.2 — contrato de controle de uso.
 *
 * Este módulo não bloqueia, libera nem monitora apps no iOS. Ele descreve
 * as preferências configuradas pelo usuário e o saldo manual de minutos.
 * Uma futura integração nativa teria que implementar um adaptador de sistema.
 */
import { getAvailableLeisureMinutes } from './wallet.js';

export function usageControlStatus(state) {
  return {
    availableLeisureMinutes: getAvailableLeisureMinutes(state),
    selectedForRestriction: (state.settings?.appRules || [])
      .filter((app) => app.mode === 'restrict')
      .map((app) => ({ id: app.id, name: app.name })),
    selectedToRemainFree: (state.settings?.appRules || [])
      .filter((app) => app.mode === 'allow')
      .map((app) => ({ id: app.id, name: app.name })),
    canReadScreenTime: false,
    canBlockOtherApps: false,
    canUnlockOtherApps: false,
    isNativeIntegration: false,
    notice: 'A PWA registra créditos e preferências. Para limites reais, configure Tempo de Uso no iPhone. Os minutos utilizados são descontados manualmente.',
  };
}
