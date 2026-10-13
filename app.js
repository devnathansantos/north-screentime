import {
  DEFAULT_APP_RULES,
  DEFAULT_TASK_THEMES,
  applyPendingChanges,
  completeMission,
  consumeLeisureMinutes,
  createId,
  getAvailableLeisureMinutes,
  getBalance,
  localDateKey,
  purchaseReward,
  reverseEntry,
  scheduleNextDayChange,
} from './wallet.js';
import { createMission } from './tasks.js';
import { createReward } from './rewards.js';
import { loadState, saveState } from './storage.js';
import { downloadBackup, parseBackup } from './backup.js';
import { syncPending, restoreFromSheet } from './sync.js';
import { showView } from './navigation.js';

let state;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function normalizeState(input) {
  const defaults = {
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
  };
  const next = {
    ...input,
    schemaVersion: 2,
    settings: { ...defaults, ...(input.settings || {}) },
    missions: (input.missions || []).map((mission) => ({
      ...mission,
      category: mission.category || 'Outro',
    })),
    rewards: input.rewards || [],
    ledger: input.ledger || [],
    leisureCredits: (input.leisureCredits || []).map((credit) => {
      // Migra créditos antigos sem destruir minutos comprados.
      const copy = { ...credit };
      if (copy.status === 'finished') {
        copy.status = 'consumed';
        copy.remainingMinutes = 0;
        copy.usedMinutes = copy.minutes;
      } else if (copy.status === 'reversed') {
        copy.remainingMinutes = 0;
      } else {
        copy.status = 'available';
        copy.remainingMinutes = Number.isSafeInteger(copy.remainingMinutes)
          ? copy.remainingMinutes
          : copy.minutes;
        copy.usedMinutes = copy.usedMinutes || 0;
      }
      delete copy.expiresAt;
      delete copy.startedAt;
      delete copy.endsAt;
      return copy;
    }),
    leisureUsage: input.leisureUsage || [],
    timeRecords: Array.isArray(input.timeRecords) ? input.timeRecords : [],
    completedMissions: input.completedMissions || [],
    syncQueue: input.syncQueue || [],
    syncedEntryIds: input.syncedEntryIds || [],
    pendingChanges: input.pendingChanges || [],
  };

  if (![1, 15].includes(next.settings.minuteStep)) next.settings.minuteStep = 15;
  next.settings.taskThemes = Array.isArray(next.settings.taskThemes)
    ? [...new Set(next.settings.taskThemes.filter((item) => typeof item === 'string' && item.trim()))]
    : [...DEFAULT_TASK_THEMES];
  next.settings.customThemes = Array.isArray(next.settings.customThemes)
    ? [...new Set(next.settings.customThemes.filter((item) => typeof item === 'string' && item.trim()))]
    : [];
  const savedRules = Array.isArray(next.settings.appRules) ? next.settings.appRules : [];
  const names = new Set(savedRules.map((item) => String(item.name || '').toLowerCase()));
  next.settings.appRules = [
    ...savedRules.map((item) => ({
      id: item.id || createId(),
      name: String(item.name || 'App personalizado'),
      mode: item.mode === 'allow' ? 'allow' : 'restrict',
      builtIn: Boolean(item.builtIn),
    })),
    ...DEFAULT_APP_RULES.filter((item) => !names.has(item.name.toLowerCase())).map((item) => ({ ...item })),
  ];
  return next;
}

async function persist(next) {
  state = normalizeState(next);
  await saveState(state);
  render();
}

function todayCount() {
  const today = localDateKey(new Date());
  return state.ledger.filter((entry) =>
    entry.type === 'ganho' && localDateKey(entry.createdAt) === today
  ).length;
}

function totalAvailableMinutes() {
  return getAvailableLeisureMinutes(state);
}

function backupReminder() {
  const last = state.lastBackupAt ? new Date(state.lastBackupAt).getTime() : 0;
  const days = Number(state.settings.backupReminderDays) || 7;
  if (!last || Date.now() - last >= days * 86400000) {
    $('#backup-status').textContent = 'Lembrete: faça um backup JSON. Dados locais podem ser apagados pelo iPhone.';
  } else {
    $('#backup-status').textContent = `Último backup registrado em ${new Date(state.lastBackupAt).toLocaleDateString('pt-BR')}.`;
  }
}

function renderMissions() {
  const themes = state.settings.taskThemes.length
    ? state.settings.taskThemes
    : ['Outro'];
  const html = state.missions.map((mission) => {
    const active = mission.active !== false;
    const recurrence = mission.recurrence === 'once'
      ? 'única'
      : mission.recurrence === 'weekly' ? 'semanal' : 'diária';
    return `<article class="mission ${active ? '' : 'mission-muted'}">
      <div class="mission-copy">
        <div class="row wrap-row">
          <strong>${escapeHTML(mission.name)}</strong>
          <span class="tag">${escapeHTML(mission.category || 'Outro')}</span>
        </div>
        <div class="muted small">+${mission.reward} moedas · ${recurrence}${active ? '' : ' · pausada'}</div>
      </div>
      <div class="row-actions">
        ${active ? `<button class="button" data-complete="${escapeHTML(mission.id)}">Concluir</button>` : ''}
        <button class="button secondary" data-toggle-mission="${escapeHTML(mission.id)}" data-active="${active}">${active ? 'Pausar amanhã' : 'Ativar amanhã'}</button>
      </div>
    </article>`;
  }).join('') || '<div class="empty">Crie sua primeira missão.</div>';

  $('#home-missions').innerHTML = state.missions.some((mission) => mission.active !== false)
    ? state.missions.filter((mission) => mission.active !== false).map((mission) => {
        const recurrence = mission.recurrence === 'once' ? 'única' : mission.recurrence === 'weekly' ? 'semanal' : 'diária';
        return `<article class="mission"><div class="mission-copy"><div class="row wrap-row"><strong>${escapeHTML(mission.name)}</strong><span class="tag">${escapeHTML(mission.category || 'Outro')}</span></div><div class="muted small">+${mission.reward} moedas · ${recurrence}</div></div><div class="row-actions"><button class="button" data-complete="${escapeHTML(mission.id)}">Concluir</button></div></article>`;
      }).join('')
    : '<div class="empty">Ative ou crie uma missão para começar.</div>';
  $('#missions-list').innerHTML = html;
  $('#mission-category').innerHTML = themes
    .map((theme) => `<option value="${escapeHTML(theme)}">${escapeHTML(theme)}</option>`)
    .join('');
}

function renderRewards() {
  $('#rewards-list').innerHTML = state.rewards.map((reward) => `
    <article class="mission ${reward.active === false ? 'mission-muted' : ''}">
      <div class="mission-copy">
        <strong>${escapeHTML(reward.name)}</strong>
        <div class="muted small">${reward.cost} moedas · ${reward.minutes} min ${reward.active === false ? '· pausada' : ''}</div>
      </div>
      <div class="row-actions">
        ${reward.active === false ? '' : `<button class="button" data-buy="${escapeHTML(reward.id)}">Comprar</button>`}
        <button class="button secondary" data-toggle-reward="${escapeHTML(reward.id)}" data-active="${reward.active !== false}">${reward.active === false ? 'Ativar amanhã' : 'Pausar amanhã'}</button>
      </div>
    </article>
  `).join('') || '<div class="empty">Crie sua primeira recompensa.</div>';

  $('#credit-count').textContent = `${totalAvailableMinutes()} min`;
  $('#available-minutes').textContent = `${totalAvailableMinutes()} min`;
  $('#credit-step-hint').textContent = `Registro em blocos de ${state.settings.minuteStep} minuto(s). Você pode alterar isso em Personalizar.`;

  $('#credits-list').innerHTML = state.leisureCredits.slice().reverse().map((credit) => {
    const remaining = Number.isSafeInteger(credit.remainingMinutes) ? credit.remainingMinutes : credit.minutes;
    const status = credit.status === 'available' ? 'Disponível'
      : credit.status === 'consumed' ? 'Utilizado'
      : credit.status === 'reversed' ? 'Compra estornada'
      : credit.status;
    return `<div class="entry">
      <div>
        <strong>${escapeHTML(credit.rewardName || state.rewards.find((reward) => reward.id === credit.rewardId)?.name || 'Crédito de lazer')}</strong>
        <div class="muted small">Comprado em ${new Date(credit.createdAt).toLocaleDateString('pt-BR')} · ${remaining} de ${credit.minutes} min restantes · ${status}</div>
      </div>
    </div>`;
  }).join('') || '<div class="empty">Você ainda não comprou minutos de lazer.</div>';

  $('#usage-app').innerHTML = [
    '<option value="">Uso geral / não especificado</option>',
    ...state.settings.appRules.filter((app) => app.mode === 'restrict')
      .map((app) => `<option value="${escapeHTML(app.name)}">${escapeHTML(app.name)}</option>`),
    '<option value="Outro app">Outro app</option>',
  ].join('');

  $('#usage-history').innerHTML = (state.leisureUsage || []).slice().reverse().slice(0, 12).map((usage) => `
    <div class="entry">
      <div><strong>${usage.minutes} min utilizados</strong><div class="muted small">${escapeHTML(usage.appName || 'Uso geral')} · ${new Date(usage.usedAt).toLocaleString('pt-BR')}</div></div>
      <span class="negative">−${usage.minutes} min</span>
    </div>
  `).join('') || '<div class="empty">Nenhum uso de crédito registrado.</div>';
  $('#usage-minutes').step = String(state.settings.minuteStep);
  $('#usage-minutes').min = String(state.settings.minuteStep);
}

function renderLedger() {
  $('#ledger-list').innerHTML = state.ledger.slice().reverse().map((entry) => `
    <div class="entry">
      <div><strong>${escapeHTML(entry.description)}</strong><div class="muted small">${new Date(entry.createdAt).toLocaleString('pt-BR')}</div></div>
      <div class="${entry.value >= 0 ? 'positive' : 'negative'}">${entry.value > 0 ? '+' : ''}${entry.value}</div>
    </div>
  `).join('') || '<div class="empty">Nenhum lançamento ainda.</div>';
}

function renderThemeSettings() {
  const builtIn = [...DEFAULT_TASK_THEMES];
  const custom = state.settings.customThemes || [];
  const all = [...new Set([...builtIn, ...custom])];
  $('#theme-options').innerHTML = all.map((theme) => {
    const active = state.settings.taskThemes.includes(theme);
    return `<label class="choice-row">
      <input type="checkbox" data-theme-toggle="${escapeHTML(theme)}" ${active ? 'checked' : ''}>
      <span><strong>${escapeHTML(theme)}</strong><small>${custom.includes(theme) ? 'Tema personalizado' : 'Tema padrão'}</small></span>
    </label>`;
  }).join('');
  $('#active-theme-count').textContent = `${state.settings.taskThemes.length} temas ativos`;
}

function renderAppRules() {
  $('#app-rules').innerHTML = state.settings.appRules.map((app) => `
    <div class="app-rule">
      <div class="app-rule-info">
        <strong>${escapeHTML(app.name)}</strong>
        <small>${app.builtIn ? 'App sugerido' : 'App personalizado'}</small>
      </div>
      <div class="app-rule-actions">
        <label class="mode-field">
          <span class="sr-only">Regra para ${escapeHTML(app.name)}</span>
          <select data-app-mode="${escapeHTML(app.id)}" aria-label="Regra para ${escapeHTML(app.name)}">
            <option value="restrict" ${app.mode === 'restrict' ? 'selected' : ''}>Quero limitar</option>
            <option value="allow" ${app.mode === 'allow' ? 'selected' : ''}>Manter livre</option>
          </select>
        </label>
        ${app.builtIn ? '' : `<button type="button" class="icon-button" data-remove-app="${escapeHTML(app.id)}" aria-label="Remover ${escapeHTML(app.name)}">×</button>`}
      </div>
    </div>
  `).join('');
  $('#restricted-count').textContent = `${state.settings.appRules.filter((app) => app.mode === 'restrict').length} selecionados para limitar`;
}

function renderSettings() {
  $('#sheets-url').value = state.settings.sheetsUrl || '';
  $('#sync-token').value = state.settings.syncToken || '';
  $('#coins-per-reward').value = state.settings.coinsPerReward || 20;
  $('#minutes-per-reward').value = state.settings.minutesPerReward || 15;
  $('#minute-step').value = String(state.settings.minuteStep || 15);
  $('#mission-form [name="reward"]').value = state.settings.coinsPerReward || 20;
  $('#reward-cost').value = state.settings.coinsPerReward || 20;
  $('#reward-minutes').value = state.settings.minutesPerReward || 15;
  $('#reward-minutes').step = String(state.settings.minuteStep || 15);
  $('#reward-minutes').min = String(state.settings.minuteStep || 15);
  renderThemeSettings();
  renderAppRules();
  backupReminder();
}

function formatHours(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${rest}min` : `${rest} min`;
}

function getLastSevenDays() {
  const result = [];
  const now = new Date();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    result.push({ key: localDateKey(date), label: date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') });
  }
  return result;
}

function renderInsights() {
  const records = (state.timeRecords || []).filter((item) => Number.isSafeInteger(item.minutes) && item.minutes > 0);
  const days = getLastSevenDays();
  const keys = new Set(days.map((day) => day.key));
  const recent = records.filter((item) => keys.has(item.date));
  const productiveCategories = new Set(['Estudos', 'Trabalho', 'Programação', 'Exercícios', 'Leitura', 'Tarefas domésticas']);
  const productive = recent.filter((item) => productiveCategories.has(item.category)).reduce((sum, item) => sum + item.minutes, 0);
  const social = recent.filter((item) => ['Redes sociais', 'Vídeos e entretenimento', 'Jogos'].includes(item.category)).reduce((sum, item) => sum + item.minutes, 0);
  $('#insights-productive').textContent = formatHours(productive);
  $('#insights-social').textContent = formatHours(social);

  const categoryTotals = new Map();
  recent.forEach((item) => categoryTotals.set(item.category, (categoryTotals.get(item.category) || 0) + item.minutes));
  const total = [...categoryTotals.values()].reduce((sum, value) => sum + value, 0);
  const palette = ['#688a79', '#c98b65', '#7b88a8', '#c2a65b', '#7b9da5', '#a68ba9', '#8b9780', '#bd817b'];
  $('#insights-category-chart').innerHTML = categoryTotals.size
    ? [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]).map(([name, minutes], index) => {
      const percent = total ? Math.round(minutes / total * 100) : 0;
      return `<div class="chart-row"><div class="chart-label"><strong>${escapeHTML(name)}</strong><span>${formatHours(minutes)} · ${percent}%</span></div><div class="chart-track"><div class="chart-fill" style="width:${percent}%;background:${palette[index % palette.length]}"></div></div></div>`;
    }).join('')
    : '<div class="empty">Registre suas primeiras atividades para gerar os gráficos.</div>';

  const daily = days.map((day) => {
    const dayRecords = recent.filter((item) => item.date === day.key);
    return {
      ...day,
      productive: dayRecords.filter((item) => productiveCategories.has(item.category)).reduce((sum, item) => sum + item.minutes, 0),
      social: dayRecords.filter((item) => ['Redes sociais', 'Vídeos e entretenimento', 'Jogos'].includes(item.category)).reduce((sum, item) => sum + item.minutes, 0),
    };
  });
  const max = Math.max(60, ...daily.map((day) => day.productive + day.social));
  $('#insights-week-chart').innerHTML = daily.map((day) => {
    const productiveHeight = Math.max(2, Math.round(day.productive / max * 100));
    const socialHeight = Math.max(2, Math.round(day.social / max * 100));
    return `<div class="week-day"><div class="week-bars"><div class="week-bar productive-bar" title="Produtivo: ${day.productive} min" style="height:${productiveHeight}%"></div><div class="week-bar social-bar" title="Redes/entretenimento: ${day.social} min" style="height:${socialHeight}%"></div></div><small>${escapeHTML(day.label)}</small></div>`;
  }).join('');

  $('#time-record-list').innerHTML = records.slice().sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`)).slice(0, 20).map((item) => `
    <div class="entry"><div><strong>${escapeHTML(item.label || item.category)}</strong><div class="muted small">${escapeHTML(item.category)} · ${new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR')}</div></div><strong>${item.minutes} min</strong></div>
  `).join('') || '<div class="empty">Nenhum registro ainda.</div>';
}

function render() {
  $('#balance').textContent = `${getBalance(state)} moedas`;
  $('#today-count').textContent = String(todayCount());
  $('#credit-count').textContent = `${totalAvailableMinutes()} min`;
  renderMissions();
  renderRewards();
  renderLedger();
  renderSettings();
  renderInsights();
}

$$('[data-nav]').forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.nav));
});
$$('[data-go]').forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.go));
});

document.addEventListener('click', async (event) => {
  const target = event.target;
  const complete = target.closest('[data-complete]');
  const buy = target.closest('[data-buy]');
  const toggleMission = target.closest('[data-toggle-mission]');
  const toggleReward = target.closest('[data-toggle-reward]');
  const removeApp = target.closest('[data-remove-app]');

  try {
    if (removeApp) {
      const app = state.settings.appRules.find((item) => item.id === removeApp.dataset.removeApp);
      if (app && confirm(`Remover "${app.name}" da lista de preferências do NORTH? Isso não altera o Tempo de Uso do iPhone.`)) {
        state = normalizeState({
          ...state,
          settings: {
            ...state.settings,
            appRules: state.settings.appRules.filter((item) => item.id !== app.id),
          },
        });
        await saveState(state);
        render();
      }
    }
    if (toggleMission) {
      const active = toggleMission.dataset.active !== 'true';
      await persist(scheduleNextDayChange(state, {
        kind: 'toggleMission', id: toggleMission.dataset.toggleMission, active,
      }));
      alert('A alteração da missão foi agendada para amanhã.');
    }

    if (toggleReward) {
      const active = toggleReward.dataset.active !== 'true';
      await persist(scheduleNextDayChange(state, {
        kind: 'toggleReward', id: toggleReward.dataset.toggleReward, active,
      }));
      alert('A alteração da recompensa foi agendada para amanhã.');
    }

    if (complete) {
      const result = completeMission(state, complete.dataset.complete);
      await persist(result.state);
      alert(result.duplicate
        ? 'Esta missão já foi recompensada neste período.'
        : 'Missão concluída! Moedas adicionadas à carteira.');
    }

    if (buy) {
      const result = purchaseReward(state, buy.dataset.buy);
      const rewardName = state.rewards.find((item) => item.id === buy.dataset.buy)?.name || 'recompensa';
      result.state.leisureCredits = result.state.leisureCredits.map((credit) =>
        credit.id === result.credit.id ? { ...credit, rewardName } : credit
      );
      await persist(result.state);
      alert(`Compra registrada! ${result.credit.minutes} minutos adicionados à sua carteira de lazer. O NORTH não cronometra nem libera apps automaticamente.`);
    }
  } catch (error) {
    alert(error.message);
  }
});

$('#mission-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const mission = createMission({
      name: form.get('name'),
      reward: Number(form.get('reward')),
      recurrence: form.get('recurrence'),
      category: form.get('category'),
    });
    await persist(scheduleNextDayChange(state, { kind: 'addMission', item: mission }));
    alert('Missão programada para começar amanhã. As moedas desta missão seguirão a recorrência escolhida.');
    event.currentTarget.reset();
  } catch (error) {
    alert(error.message);
  }
});

$('#reward-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const reward = createReward({
      name: form.get('name'),
      cost: Number(form.get('cost')),
      minutes: Number(form.get('minutes')),
      minuteStep: Number(state.settings.minuteStep),
    });
    await persist(scheduleNextDayChange(state, { kind: 'addReward', item: reward }));
    alert(`Recompensa programada para amanhã. Os minutos devem ser múltiplos de ${state.settings.minuteStep}.`);
    event.currentTarget.reset();
    $('#mission-form [name="reward"]').value = state.settings.coinsPerReward || 20;
  $('#reward-cost').value = state.settings.coinsPerReward || 20;
    $('#reward-minutes').value = state.settings.minutesPerReward || 15;
  } catch (error) {
    alert(error.message);
  }
});

$('#usage-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const minutes = Number(form.get('minutes'));
    const appName = String(form.get('appName') || '');
    const result = consumeLeisureMinutes(state, minutes, appName, new Date(), Number(state.settings.minuteStep));
    await persist(result.state);
    alert(`${minutes} minutos registrados como utilizados. O NORTH não mede o tempo real dentro do app escolhido; confira o Tempo de Uso do iPhone.`);
    event.currentTarget.reset();
  } catch (error) {
    alert(error.message);
  }
});

$('#theme-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = $('#new-theme');
  const theme = input.value.trim();
  if (!theme) return;
  const all = [...DEFAULT_TASK_THEMES, ...state.settings.taskThemes, ...(state.settings.customThemes || [])];
  if (all.some((item) => item.toLocaleLowerCase('pt-BR') === theme.toLocaleLowerCase('pt-BR'))) {
    alert('Esse tema já existe.');
    return;
  }
  state = normalizeState({
    ...state,
    settings: {
      ...state.settings,
      taskThemes: [...state.settings.taskThemes, theme],
      customThemes: [...(state.settings.customThemes || []), theme],
    },
  });
  await saveState(state);
  input.value = '';
  render();
  alert(`Tema "${theme}" adicionado e ativado.`);
});

document.addEventListener('change', async (event) => {
  const themeToggle = event.target.closest('[data-theme-toggle]');
  const appMode = event.target.closest('[data-app-mode]');

  if (themeToggle) {
    const theme = themeToggle.dataset.themeToggle;
    const active = themeToggle.checked;
    const themes = new Set(state.settings.taskThemes);
    if (active) themes.add(theme);
    else themes.delete(theme);
    if (themes.size === 0) {
      alert('Mantenha pelo menos um tema ativo para poder criar missões.');
      render();
      return;
    }
    state = normalizeState({
      ...state,
      settings: { ...state.settings, taskThemes: [...themes] },
    });
    await saveState(state);
    render();
  }

  if (event.target.id === 'minute-step') {
    const step = Number(event.target.value);
    if (step === 15) {
      const current = Number($('#minutes-per-reward').value) || 15;
      const rounded = Math.max(15, Math.ceil(current / 15) * 15);
      $('#minutes-per-reward').value = String(rounded);
      $('#reward-minutes').min = '15';
      $('#reward-minutes').step = '15';
      if (Number($('#reward-minutes').value) % 15 !== 0) {
        $('#reward-minutes').value = String(Math.max(15, Math.ceil((Number($('#reward-minutes').value) || 15) / 15) * 15));
      }
    } else {
      $('#minutes-per-reward').min = '1';
      $('#minutes-per-reward').step = '1';
      $('#reward-minutes').min = '1';
      $('#reward-minutes').step = '1';
    }
  }

  if (appMode) {
    const id = appMode.dataset.appMode;
    state = normalizeState({
      ...state,
      settings: {
        ...state.settings,
        appRules: state.settings.appRules.map((app) =>
          app.id === id ? { ...app, mode: appMode.value } : app
        ),
      },
    });
    await saveState(state);
    render();
  }
});

$('#app-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = $('#new-app').value.trim();
  if (!name) return;
  if (state.settings.appRules.some((app) => app.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) {
    alert('Esse app já está na lista.');
    return;
  }
  state = normalizeState({
    ...state,
    settings: {
      ...state.settings,
      appRules: [...state.settings.appRules, {
        id: createId(),
        name,
        mode: $('#new-app-mode').value,
        builtIn: false,
      }],
    },
  });
  await saveState(state);
  $('#new-app').value = '';
  render();
  alert('App adicionado à sua lista de preferências. Para aplicar um limite real, configure-o no Tempo de Uso do iPhone.');
});

$('#save-settings').addEventListener('click', async () => {
  const url = $('#sheets-url').value.trim();
  const minuteStep = Number($('#minute-step').value);
  const coinsPerReward = Number($('#coins-per-reward').value);
  const minutesPerReward = Number($('#minutes-per-reward').value);

  if (url && !url.endsWith('/exec')) {
    alert('A URL do Apps Script deve terminar em /exec.');
    return;
  }
  if (![1, 15].includes(minuteStep)) {
    alert('Escolha incrementos de 1 ou 15 minutos.');
    return;
  }
  if (!Number.isSafeInteger(coinsPerReward) || coinsPerReward <= 0 ||
      !Number.isSafeInteger(minutesPerReward) || minutesPerReward <= 0 ||
      minutesPerReward % minuteStep !== 0) {
    alert(`Configure valores inteiros positivos. Os minutos devem ser múltiplos de ${minuteStep}.`);
    return;
  }

  await persist({
    ...state,
    settings: {
      ...state.settings,
      sheetsUrl: url,
      syncToken: $('#sync-token').value.trim(),
      coinsPerReward,
      minutesPerReward,
      minuteStep,
    },
  });
  alert('Configurações salvas. A regra de incrementos será aplicada às próximas recompensas e aos registros de uso.');
});

$('#export-backup').addEventListener('click', async () => {
  try {
    const payload = {
      app: 'NORTH',
      exportedAt: new Date().toISOString(),
      ...state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const file = new File([blob], `north-backup-${localDateKey(new Date())}.json`, { type: 'application/json' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: 'Backup NORTH', files: [file] });
    } else {
      downloadBackup(state);
    }
    state = { ...state, lastBackupAt: new Date().toISOString() };
    await saveState(state);
    $('#backup-status').textContent = 'Backup exportado. Guarde o arquivo em local seguro.';
  } catch (error) {
    if (error.name !== 'AbortError') alert(error.message);
  }
});

$('#import-backup').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = parseBackup(await file.text());
    if (!confirm('Restaurar este backup substituirá os dados atuais. Continue?')) return;
    await persist(parsed);
    alert('Backup restaurado.');
  } catch (error) {
    alert(`Backup não importado: ${error.message}`);
  } finally {
    event.target.value = '';
  }
});

$('#sync-now').addEventListener('click', async () => {
  try {
    const result = await syncPending(state);
    await persist(result.state);
    alert(`Sincronização concluída. Registros enviados/confirmados: ${result.sent}.`);
  } catch (error) {
    alert(error.message);
  }
});

$('#restore-sheet').addEventListener('click', async () => {
  if (!confirm('A restauração substituirá os dados locais pela cópia da planilha. Faça backup dos dados atuais antes. Continuar?')) return;
  try {
    const next = await restoreFromSheet(state);
    await persist(next);
    alert('Estado restaurado. Confira seus dados e faça um novo backup JSON.');
  } catch (error) {
    alert(error.message);
  }
});

$('#reverse-entry').addEventListener('click', async () => {
  const id = prompt('Cole o ID do lançamento que deseja estornar:');
  if (!id) return;
  try {
    const result = reverseEntry(state, id, new Date(), 'Estorno solicitado pelo usuário');
    await persist(result.state);
    alert(result.duplicate ? 'Este lançamento já foi estornado.' : 'Estorno registrado.');
  } catch (error) {
    alert(error.message);
  }
});

$('#time-record-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const minutes = Number(form.get('minutes'));
  const date = String(form.get('date') || localDateKey(new Date()));
  const category = String(form.get('category') || 'Outro');
  const label = String(form.get('label') || '').trim();
  if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 1440) {
    alert('Informe uma duração inteira entre 1 e 1440 minutos.');
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T12:00:00`).getTime())) {
    alert('Escolha uma data válida.');
    return;
  }
  const record = { id: createId(), category, label, minutes, date, createdAt: new Date().toISOString(), source: category === 'Redes sociais' || category === 'Vídeos e entretenimento' || category === 'Jogos' ? 'manual-tempo-de-uso' : 'manual' };
  await persist({ ...state, timeRecords: [...(state.timeRecords || []), record] });
  event.currentTarget.reset();
  event.currentTarget.elements.date.value = localDateKey(new Date());
  alert('Registro salvo. Os gráficos foram atualizados.');
});

$('#clear-time-records').addEventListener('click', async () => {
  if (!confirm('Apagar todos os registros de tempo? Essa ação não pode ser desfeita. Exporte um backup antes se quiser guardá-los.')) return;
  await persist({ ...state, timeRecords: [] });
});

state = normalizeState(await loadState());
state = applyPendingChanges(state);
await saveState(state);
render();
if ($('#time-record-form')) $('#time-record-form').elements.date.value = localDateKey(new Date());

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then((registration) => {
    const askToUpdate = () => {
      if (registration.waiting && confirm('Uma nova versão do NORTH está disponível. Atualizar agora?')) {
        registration.waiting.postMessage('SKIP_WAITING');
      }
    };
    askToUpdate();
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (worker) worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) askToUpdate();
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
  }).catch(console.warn);
}

window.addEventListener('online', () => {
  syncPending(state).then((result) => persist(result.state)).catch(() => {});
});
