/** Espelho de estado completo e fila offline de lançamentos. */
export async function syncPending(state) {
  const url = state.settings?.sheetsUrl;
  const token = state.settings?.syncToken;
  if (!url) throw new Error('Configure a URL /exec do Apps Script primeiro.');
  if (!navigator.onLine) throw new Error('Sem internet. A fila fica salva no aparelho.');
  const alreadySynced = new Set(state.syncedEntryIds || []);
  const queued = [...new Map([...(state.syncQueue || []), ...state.ledger.filter(e => !alreadySynced.has(e.id))].map(e => [e.id, e])).values()];
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'sync', token, entries: queued, snapshot: serializableSnapshot(state) })
  });
  if (!response.ok) throw new Error(`Falha na sincronização (${response.status}).`);
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || 'O espelho recusou a sincronização.');
  const accepted = new Set(result.acceptedIds || []);
  return { state: { ...state, syncQueue: queued.filter(e => !accepted.has(e.id)), syncedEntryIds: [...new Set([...(state.syncedEntryIds || []), ...accepted])], lastSyncAt: new Date().toISOString() }, sent: accepted.size };
}
function serializableSnapshot(state) {
  // Não enviar credenciais junto do snapshot de recuperação.
  return { ...state, settings: { ...state.settings, syncToken: '' } };
}
export async function restoreFromSheet(state) {
  const url = state.settings?.sheetsUrl;
  const token = state.settings?.syncToken;
  if (!url) throw new Error('Configure a URL /exec do Apps Script primeiro.');
  const u = new URL(url);
  u.searchParams.set('action', 'restore');
  u.searchParams.set('token', token || '');
  const response = await fetch(u);
  if (!response.ok) throw new Error('Não foi possível ler a planilha.');
  const data = await response.json();
  if (!data.ok || !data.snapshot || !Array.isArray(data.snapshot.ledger)) throw new Error(data.error || 'A planilha não contém um backup completo. Sincronize antes de tentar restaurar.');
  const snapshot = data.snapshot;
  if (!Array.isArray(snapshot.missions) || !Array.isArray(snapshot.rewards) || !Array.isArray(snapshot.leisureCredits) || !snapshot.settings) throw new Error('Snapshot incompleto ou inválido.');
  // Preserva a URL e o token informados neste dispositivo.
  snapshot.settings = { ...snapshot.settings, sheetsUrl: url, syncToken: token };
  snapshot.syncQueue = [];
  return snapshot;
}
