'use strict';

let state = null;
let refreshing = false;
let currentPage = 0;
let lastRequestedCardCount = null;

const elements = {
  cards: document.getElementById('cards'),
  template: document.getElementById('cardTemplate'),
  refreshButton: document.getElementById('refreshButton'),
  clientsButton: document.getElementById('clientsButton'),
  settingsButton: document.getElementById('settingsButton'),
  globalStatus: document.getElementById('globalStatus'),
  lastRefresh: document.getElementById('lastRefresh'),
  progressBar: document.getElementById('progressBar'),
  errorBox: document.getElementById('errorBox'),
  pageNavigation: document.getElementById('pageNavigation'),
  pageInfo: document.getElementById('pageInfo'),
  previousPage: document.getElementById('previousPage'),
  nextPage: document.getElementById('nextPage'),
  emptyClients: document.getElementById('emptyClients'),
  emptyClientsButton: document.getElementById('emptyClientsButton'),
  settingsDialog: document.getElementById('settingsDialog'),
  settingsForm: document.getElementById('settingsForm'),
  closeSettings: document.getElementById('closeSettings'),
  cancelSettings: document.getElementById('cancelSettings'),
  testEmailButton: document.getElementById('testEmailButton'),
  settingsMessage: document.getElementById('settingsMessage'),
  clientsDialog: document.getElementById('clientsDialog'),
  closeClients: document.getElementById('closeClients'),
  clientsList: document.getElementById('clientsList'),
  newClientButton: document.getElementById('newClientButton'),
  clientForm: document.getElementById('clientForm'),
  clientFormTitle: document.getElementById('clientFormTitle'),
  clientFormMessage: document.getElementById('clientFormMessage'),
  cancelClientEdit: document.getElementById('cancelClientEdit'),
  clientHelpButton: document.getElementById('clientHelpButton'),
  clientHelpDialog: document.getElementById('clientHelpDialog'),
  closeClientHelp: document.getElementById('closeClientHelp'),
  openBlizzTrack: document.getElementById('openBlizzTrack'),
  openBlizzTrackDocs: document.getElementById('openBlizzTrackDocs')
};

const settingsInputs = {
  language: document.getElementById('language'),
  autoRefresh: document.getElementById('autoRefresh'),
  refreshMinutes: document.getElementById('refreshMinutes'),
  notificationMode: document.getElementById('notificationMode'),
  runInBackground: document.getElementById('runInBackground'),
  launchAtLogin: document.getElementById('launchAtLogin'),
  emailEnabled: document.getElementById('emailEnabled'),
  smtpHost: document.getElementById('smtpHost'),
  smtpPort: document.getElementById('smtpPort'),
  smtpSecure: document.getElementById('smtpSecure'),
  smtpUser: document.getElementById('smtpUser'),
  smtpPassword: document.getElementById('smtpPassword'),
  clearPassword: document.getElementById('clearPassword'),
  smtpFrom: document.getElementById('smtpFrom'),
  smtpTo: document.getElementById('smtpTo')
};

const clientInputs = {
  id: document.getElementById('clientEditId'),
  name: document.getElementById('clientName'),
  liveProduct: document.getElementById('liveProduct'),
  livePrefixes: document.getElementById('livePrefixes'),
  ptrProduct: document.getElementById('ptrProduct'),
  ptrPrefixes: document.getElementById('ptrPrefixes')
};


function t(key, values = {}) {
  const template = state?.locale?.messages?.[key] || key;
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, name) => (
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : `{${name}}`
  ));
}

function localeCode() {
  return state?.locale?.language === 'en' ? 'en-GB' : 'de-DE';
}

function applyTranslations(root = document) {
  document.documentElement.lang = state?.locale?.language || 'de';
  root.querySelectorAll?.('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  root.querySelectorAll?.('[data-i18n-placeholder]').forEach((node) => {
    node.setAttribute('placeholder', t(node.dataset.i18nPlaceholder));
  });
  root.querySelectorAll?.('[data-i18n-aria-label]').forEach((node) => {
    node.setAttribute('aria-label', t(node.dataset.i18nAriaLabel));
  });
  root.querySelectorAll?.('[data-i18n-title]').forEach((node) => {
    node.setAttribute('title', t(node.dataset.i18nTitle));
  });
}


function userErrorMessage(error) {
  return String(error?.message || error || t('error.unknown'))
    .replace(/^Error invoking remote method '[^']+': Error:\s*/i, '')
    .replace(/^Error:\s*/i, '');
}

function formatDate(value, includeTime = true) {
  if (!value) return '–';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '–';
  return new Intl.DateTimeFormat(localeCode(), {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' } : {})
  }).format(date);
}

function interfaceIdFromVersion(version) {
  const parts = String(version || '').match(/\d+/g)?.map(Number) || [];
  if (parts.length < 3) return null;
  return (parts[0] * 10000) + (parts[1] * 100) + parts[2];
}

function snapshotText(snapshot) {
  if (!snapshot) {
    return {
      version: t('snapshot.unavailable'),
      interfaceId: t('snapshot.interface', { id: '–' }),
      observed: t('snapshot.noBuild')
    };
  }
  const interfaceId = snapshot.interfaceId || interfaceIdFromVersion(snapshot.version);
  return {
    version: snapshot.version,
    interfaceId: t('snapshot.interface', { id: interfaceId || '–' }),
    observed: `${snapshot.stale ? t('snapshot.lastState') : t('snapshot.detected')}: ${formatDate(snapshot.observedAt)}`
  };
}

function setSnapshot(card, channel, snapshot) {
  const text = snapshotText(snapshot);
  const version = card.querySelector(`.${channel}-version`);
  const interfaceId = card.querySelector(`.${channel}-interface`);
  const observed = card.querySelector(`.${channel}-observed`);
  version.textContent = text.version;
  version.title = snapshot ? `${snapshot.version} · Build ${snapshot.buildId} · ${snapshot.product}` : '';
  interfaceId.textContent = text.interfaceId;
  observed.textContent = text.observed;
  observed.title = snapshot ? `${snapshot.source} · ${snapshot.product} · Build ${snapshot.buildId}` : '';
  observed.classList.toggle('stale', Boolean(snapshot?.stale));
}

function ptrBadge(current, badge) {
  badge.className = 'ptr-state badge';
  if (!current?.ptr) {
    badge.textContent = t('ptr.none');
  } else if (current.ptrComparison > 0) {
    badge.textContent = t('ptr.newer');
    badge.classList.add('newer');
  } else if (current.ptrComparison === 0) {
    badge.textContent = t('ptr.same');
    badge.classList.add('same');
  } else {
    badge.textContent = t('ptr.older');
  }
}

function createTimelineItem(item) {
  const wrapper = document.createElement('div');
  wrapper.className = `timeline-item ${item.kind === 'news' ? 'news' : 'build'}`;
  const title = document.createElement('div');
  title.className = 'timeline-title';
  const meta = document.createElement('div');
  meta.className = 'timeline-meta';

  if (item.kind === 'news') {
    title.textContent = item.title;
    meta.textContent = `${formatDate(item.publishedAt)} · ${item.source}`;
    if (item.summary) {
      const summary = document.createElement('div');
      summary.className = 'timeline-summary';
      summary.textContent = item.summary;
      wrapper.append(title, meta, summary);
    } else {
      wrapper.append(title, meta);
    }
    if (item.link) {
      const link = document.createElement('a');
      link.className = 'timeline-link';
      link.href = '#';
      link.textContent = t('timeline.openOfficial');
      link.addEventListener('click', (event) => {
        event.preventDefault();
        window.patchWatch.openExternal(item.link);
      });
      wrapper.append(link);
    }
  } else {
    if (item.kind === 'availability' && item.available === false) {
      title.textContent = t('timeline.unavailable', { channel: item.channel === 'ptr' ? t('timeline.channelPtr') : t('timeline.channelLive') });
    } else {
      title.textContent = `${item.channel === 'ptr' ? t('timeline.channelPtr') : t('timeline.channelLive')}: ${item.version} (Build ${item.buildId})`;
    }
    meta.textContent = `${formatDate(item.detectedAt)}${item.product ? ` · ${item.product}` : ''} · ${item.source}`;
    wrapper.append(title, meta);
  }
  return wrapper;
}

function renderAddons(card, gameId) {
  const tags = card.querySelector('.addon-tags');
  tags.replaceChildren();
  const addons = state.entries[gameId]?.addons || [];
  if (!addons.length) {
    const empty = document.createElement('span');
    empty.className = 'empty-addons';
    empty.textContent = t('card.noAddons');
    tags.append(empty);
    return;
  }
  for (const addon of addons) {
    const tag = document.createElement('span');
    tag.className = 'addon-tag';
    const text = document.createElement('span');
    text.textContent = addon;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.setAttribute('aria-label', t('card.removeAddon', { name: addon }));
    remove.textContent = '×';
    remove.addEventListener('click', async () => {
      const next = addons.filter((name) => name !== addon);
      state = await window.patchWatch.updateEntry(gameId, { addons: next });
      render();
    });
    tag.append(text, remove);
    tags.append(tag);
  }
}

function enabledTracks() {
  return (state?.tracks || []).filter((track) => track.enabled !== false);
}

function requestWindowWidthForCards(cardCount) {
  const normalized = Math.max(0, Math.min(state?.clientsPerPage || 4, Number(cardCount) || 0));
  if (lastRequestedCardCount === normalized) return;
  lastRequestedCardCount = normalized;
  window.patchWatch.setVisibleCardCount(normalized).catch(() => {
    lastRequestedCardCount = null;
  });
}

function renderPageNavigation(tracks) {
  const pageSize = state.clientsPerPage || 4;
  const totalPages = Math.max(1, Math.ceil(tracks.length / pageSize));
  currentPage = Math.min(Math.max(0, currentPage), totalPages - 1);
  elements.pageNavigation.classList.toggle('hidden', tracks.length <= pageSize);
  elements.pageInfo.textContent = t('pagination.info', { page: currentPage + 1, pages: totalPages, count: tracks.length });
  elements.previousPage.disabled = currentPage === 0;
  elements.nextPage.disabled = currentPage >= totalPages - 1;
  return tracks.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
}

function renderCards() {
  elements.cards.replaceChildren();
  const tracks = enabledTracks();
  elements.emptyClients.classList.toggle('hidden', tracks.length > 0);
  elements.cards.classList.toggle('hidden', tracks.length === 0);
  if (!tracks.length) {
    elements.pageNavigation.classList.add('hidden');
    elements.cards.style.setProperty('--card-columns', '1');
    requestWindowWidthForCards(0);
    return;
  }

  const pageTracks = renderPageNavigation(tracks);
  elements.cards.style.setProperty('--card-columns', String(Math.max(1, pageTracks.length)));
  requestWindowWidthForCards(pageTracks.length);
  for (const track of pageTracks) {
    const card = elements.template.content.firstElementChild.cloneNode(true);
    applyTranslations(card);
    const current = state.current[track.id] || {};
    const entry = state.entries[track.id] || {};
    card.dataset.gameId = track.id;
    card.querySelector('.game-title').textContent = track.name;
    setSnapshot(card, 'live', current.live);
    setSnapshot(card, 'ptr', current.ptr);
    ptrBadge(current, card.querySelector('.ptr-state'));

    const liveToggle = card.querySelector('.notify-live');
    const ptrToggle = card.querySelector('.notify-ptr');
    liveToggle.checked = Boolean(entry.notifyLive);
    ptrToggle.checked = Boolean(entry.notifyPtr);
    liveToggle.addEventListener('change', async () => {
      state = await window.patchWatch.updateEntry(track.id, { notifyLive: liveToggle.checked });
      render();
    });
    ptrToggle.addEventListener('change', async () => {
      state = await window.patchWatch.updateEntry(track.id, { notifyPtr: ptrToggle.checked });
      render();
    });

    const input = card.querySelector('.addon-input');
    const addButton = card.querySelector('.add-addon');
    const addAddon = async () => {
      const name = input.value.trim();
      if (!name) return;
      const addons = [...new Set([...(state.entries[track.id]?.addons || []), name])];
      input.value = '';
      state = await window.patchWatch.updateEntry(track.id, { addons });
      render();
    };
    addButton.addEventListener('click', addAddon);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addAddon();
      }
    });
    renderAddons(card, track.id);

    const history = state.history.filter((item) => item.gameId === track.id);
    const news = state.news.filter((item) => (item.gameIds || []).includes(track.id)).map((item) => ({ ...item, kind: 'news' }));
    const timelineItems = [...history, ...news].sort((a, b) =>
      new Date(b.detectedAt || b.publishedAt) - new Date(a.detectedAt || a.publishedAt)
    );
    card.querySelector('.change-count').textContent = `(${timelineItems.length})`;
    const details = card.querySelector('.changes-details');
    details.open = entry.newsOpen !== false;
    details.addEventListener('toggle', async () => {
      const nextOpen = details.open;
      const storedOpen = state.entries[track.id]?.newsOpen !== false;
      if (nextOpen === storedOpen) return;
      try {
        state = await window.patchWatch.updateEntry(track.id, { newsOpen: nextOpen });
      } catch (_error) {
        details.open = storedOpen;
      }
    });
    const timeline = card.querySelector('.timeline');
    if (!timelineItems.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-addons';
      empty.textContent = t('card.noChanges');
      timeline.append(empty);
    } else {
      timelineItems.forEach((item) => timeline.append(createTimelineItem(item)));
    }
    elements.cards.append(card);
  }
}

function renderStatus() {
  const last = state.meta?.lastRefreshAt;
  elements.lastRefresh.textContent = last ? t('status.lastCheck', { date: formatDate(last) }) : t('status.notChecked');
  const error = state.meta?.lastRefreshError || '';
  elements.errorBox.textContent = error;
  elements.errorBox.classList.toggle('hidden', !error);
  if (!refreshing) elements.globalStatus.textContent = error ? t('status.completedWithWarnings') : t('status.ready');
}

function render() {
  if (!state) return;
  applyTranslations(document);
  renderStatus();
  renderCards();
  if (elements.clientsDialog.open) renderClientsList();
}

function populateSettings() {
  const settings = state.settings;
  const email = settings.email;
  settingsInputs.language.value = settings.language || state.locale?.language || 'de';
  settingsInputs.autoRefresh.checked = settings.autoRefresh;
  settingsInputs.refreshMinutes.value = String(settings.refreshMinutes);
  settingsInputs.notificationMode.value = settings.notificationMode || 'interface';
  settingsInputs.runInBackground.checked = settings.runInBackground;
  settingsInputs.launchAtLogin.checked = settings.launchAtLogin;
  settingsInputs.emailEnabled.checked = email.enabled;
  settingsInputs.smtpHost.value = email.host || '';
  settingsInputs.smtpPort.value = String(email.port || 587);
  settingsInputs.smtpSecure.checked = email.secure;
  settingsInputs.smtpUser.value = email.user || '';
  settingsInputs.smtpPassword.value = '';
  settingsInputs.smtpPassword.placeholder = email.hasPassword
    ? t('settings.passwordStoredPlaceholder')
    : t('settings.passwordNewPlaceholder');
  settingsInputs.clearPassword.checked = false;
  settingsInputs.smtpFrom.value = email.from || '';
  settingsInputs.smtpTo.value = email.to || '';
  elements.settingsMessage.textContent = '';
  elements.settingsMessage.className = 'settings-message';
}

function collectSettings() {
  return {
    language: settingsInputs.language.value,
    autoRefresh: settingsInputs.autoRefresh.checked,
    refreshMinutes: Number(settingsInputs.refreshMinutes.value),
    notificationMode: settingsInputs.notificationMode.value,
    runInBackground: settingsInputs.runInBackground.checked,
    launchAtLogin: settingsInputs.launchAtLogin.checked,
    email: {
      enabled: settingsInputs.emailEnabled.checked,
      host: settingsInputs.smtpHost.value,
      port: Number(settingsInputs.smtpPort.value),
      secure: settingsInputs.smtpSecure.checked,
      user: settingsInputs.smtpUser.value,
      password: settingsInputs.smtpPassword.value,
      clearPassword: settingsInputs.clearPassword.checked,
      from: settingsInputs.smtpFrom.value,
      to: settingsInputs.smtpTo.value
    }
  };
}

function showSettingsMessage(message, type = '') {
  elements.settingsMessage.textContent = message;
  elements.settingsMessage.className = `settings-message ${type}`;
}


function applyKnownSmtpDefaultsFromHost() {
  const value = settingsInputs.smtpHost.value.trim();
  const match = value.match(/^[^\s@]+@mail\.de$/i);
  if (!match) return false;

  if (!settingsInputs.smtpUser.value.trim()) settingsInputs.smtpUser.value = value;
  if (!settingsInputs.smtpTo.value.trim()) settingsInputs.smtpTo.value = value;
  settingsInputs.smtpHost.value = 'smtp.mail.de';
  settingsInputs.smtpPort.value = '587';
  settingsInputs.smtpSecure.checked = false;
  showSettingsMessage(t('settings.mailDeHostCorrected'), 'success');
  return true;
}

function applyKnownSmtpDefaultsFromUser() {
  const user = settingsInputs.smtpUser.value.trim();
  if (!/^[^\s@]+@mail\.de$/i.test(user)) return false;
  if (settingsInputs.smtpHost.value.trim()) return false;
  settingsInputs.smtpHost.value = 'smtp.mail.de';
  settingsInputs.smtpPort.value = '587';
  settingsInputs.smtpSecure.checked = false;
  if (!settingsInputs.smtpTo.value.trim()) settingsInputs.smtpTo.value = user;
  showSettingsMessage(t('settings.mailDeDefaults'), 'success');
  return true;
}

function candidateDescription(candidates) {
  if (!candidates?.length) return t('clients.notConfigured');
  return candidates.map((candidate) => {
    const prefixes = candidate.prefixes?.length ? ` [${candidate.prefixes.join(', ')}]` : '';
    return `${candidate.product}${prefixes}`;
  }).join(' · ');
}

function renderClientsList() {
  elements.clientsList.replaceChildren();
  for (const track of state.tracks) {
    const row = document.createElement('article');
    row.className = 'client-list-item';

    const visibility = document.createElement('label');
    visibility.className = 'client-visible-toggle';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = track.enabled !== false;
    const toggleText = document.createElement('span');
    toggleText.textContent = t('clients.show');
    visibility.append(checkbox, toggleText);

    const info = document.createElement('div');
    info.className = 'client-list-info';
    const titleRow = document.createElement('div');
    titleRow.className = 'client-list-title';
    const name = document.createElement('strong');
    name.textContent = track.name;
    const type = document.createElement('span');
    type.className = 'client-type-badge';
    type.textContent = track.builtIn ? t('clients.builtIn') : t('clients.custom');
    titleRow.append(name, type);
    const technical = document.createElement('div');
    technical.className = 'client-technical';
    technical.textContent = `Live: ${candidateDescription(track.live)} · PTR: ${candidateDescription(track.ptr)}`;
    info.append(titleRow, technical);

    const actions = document.createElement('div');
    actions.className = 'client-list-actions';
    if (!track.builtIn) {
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'button compact';
      edit.textContent = t('button.edit');
      edit.addEventListener('click', () => showClientForm(track));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'button compact danger';
      remove.textContent = t('button.delete');
      remove.addEventListener('click', async () => {
        if (!window.confirm(t('clients.deleteConfirm', { name: track.name }))) return;
        state = await window.patchWatch.deleteTrack(track.id);
        currentPage = 0;
        render();
      });
      actions.append(edit, remove);
    }

    checkbox.addEventListener('change', async () => {
      checkbox.disabled = true;
      try {
        state = await window.patchWatch.setTrackEnabled(track.id, checkbox.checked);
        currentPage = 0;
        render();
      } finally {
        checkbox.disabled = false;
      }
    });

    row.append(visibility, info, actions);
    elements.clientsList.append(row);
  }
}

function resetClientForm() {
  elements.clientForm.reset();
  clientInputs.id.value = '';
  elements.clientFormTitle.textContent = t('clients.newTitle');
  elements.clientFormMessage.textContent = '';
  elements.clientFormMessage.className = 'settings-message';
}

function showClientForm(track = null) {
  resetClientForm();
  if (track) {
    clientInputs.id.value = track.id;
    clientInputs.name.value = track.name;
    clientInputs.liveProduct.value = track.live?.[0]?.product || '';
    clientInputs.livePrefixes.value = track.live?.[0]?.prefixes?.join(', ') || '';
    clientInputs.ptrProduct.value = track.ptr?.[0]?.product || '';
    clientInputs.ptrPrefixes.value = track.ptr?.[0]?.prefixes?.join(', ') || '';
    elements.clientFormTitle.textContent = t('clients.editTitle', { name: track.name });
  }
  elements.clientForm.classList.remove('hidden');
  clientInputs.name.focus();
  elements.clientForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideClientForm() {
  resetClientForm();
  elements.clientForm.classList.add('hidden');
}

function openClientsDialog() {
  hideClientForm();
  renderClientsList();
  if (!elements.clientsDialog.open) elements.clientsDialog.showModal();
}

function collectClient() {
  return {
    id: clientInputs.id.value || undefined,
    name: clientInputs.name.value,
    liveProduct: clientInputs.liveProduct.value,
    livePrefixes: clientInputs.livePrefixes.value,
    ptrProduct: clientInputs.ptrProduct.value,
    ptrPrefixes: clientInputs.ptrPrefixes.value,
    enabled: true
  };
}

elements.refreshButton.addEventListener('click', async () => {
  if (refreshing) return;
  refreshing = true;
  elements.refreshButton.disabled = true;
  try {
    state = await window.patchWatch.refresh();
  } catch (error) {
    elements.globalStatus.textContent = t('status.errorPrefix', { message: userErrorMessage(error) });
  } finally {
    refreshing = false;
    elements.refreshButton.disabled = false;
    render();
  }
});

elements.settingsButton.addEventListener('click', () => {
  populateSettings();
  elements.settingsDialog.showModal();
});
elements.clientsButton.addEventListener('click', openClientsDialog);
elements.emptyClientsButton.addEventListener('click', openClientsDialog);
elements.closeSettings.addEventListener('click', () => elements.settingsDialog.close());
elements.cancelSettings.addEventListener('click', () => elements.settingsDialog.close());
elements.closeClients.addEventListener('click', () => elements.clientsDialog.close());
elements.clientHelpButton.addEventListener('click', () => {
  applyTranslations(elements.clientHelpDialog);
  if (!elements.clientHelpDialog.open) elements.clientHelpDialog.showModal();
});
elements.closeClientHelp.addEventListener('click', () => elements.clientHelpDialog.close());
elements.openBlizzTrack.addEventListener('click', () => window.patchWatch.openExternal('https://blizztrack.com/'));
elements.openBlizzTrackDocs.addEventListener('click', () => window.patchWatch.openExternal('https://blizztrack.com/docs'));

elements.previousPage.addEventListener('click', () => {
  currentPage = Math.max(0, currentPage - 1);
  renderCards();
});
elements.nextPage.addEventListener('click', () => {
  currentPage += 1;
  renderCards();
});


settingsInputs.smtpHost.addEventListener('blur', applyKnownSmtpDefaultsFromHost);
settingsInputs.smtpUser.addEventListener('blur', applyKnownSmtpDefaultsFromUser);

elements.settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    showSettingsMessage(t('settings.saving'));
    state = await window.patchWatch.saveSettings(collectSettings());
    showSettingsMessage(t('settings.saved'), 'success');
    setTimeout(() => elements.settingsDialog.close(), 450);
    render();
  } catch (error) {
    showSettingsMessage(userErrorMessage(error), 'error');
  }
});

elements.testEmailButton.addEventListener('click', async () => {
  elements.testEmailButton.disabled = true;
  try {
    showSettingsMessage(t('settings.testing'));
    state = await window.patchWatch.saveSettings(collectSettings());
    await window.patchWatch.testEmail();
    showSettingsMessage(t('settings.testSuccess'), 'success');
  } catch (error) {
    showSettingsMessage(t('settings.testFailed', { message: userErrorMessage(error) }), 'error');
  } finally {
    elements.testEmailButton.disabled = false;
  }
});

elements.newClientButton.addEventListener('click', () => showClientForm());
elements.cancelClientEdit.addEventListener('click', hideClientForm);
elements.clientForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  elements.clientFormMessage.textContent = t('clients.saving');
  elements.clientFormMessage.className = 'settings-message';
  try {
    state = await window.patchWatch.saveTrack(collectClient());
    elements.clientFormMessage.textContent = t('clients.saved');
    elements.clientFormMessage.className = 'settings-message success';
    currentPage = Math.max(0, Math.ceil(enabledTracks().length / (state.clientsPerPage || 4)) - 1);
    render();
    setTimeout(hideClientForm, 700);
  } catch (error) {
    elements.clientFormMessage.textContent = error.message;
    elements.clientFormMessage.className = 'settings-message error';
  }
});

window.patchWatch.onRefreshStatus((status) => {
  refreshing = status.progress !== 1 && !status.error;
  elements.globalStatus.textContent = status.message;
  elements.progressBar.style.width = status.progress == null ? '0%' : `${Math.round(status.progress * 100)}%`;
  elements.refreshButton.disabled = refreshing;
  if (status.progress === 1) {
    setTimeout(() => { elements.progressBar.style.width = '0%'; }, 900);
    refreshing = false;
    elements.refreshButton.disabled = false;
  }
});

window.patchWatch.onStateChanged((nextState) => {
  state = nextState;
  render();
});

window.patchWatch.onUiCommand((command) => {
  if (command === 'open-settings') {
    populateSettings();
    if (!elements.settingsDialog.open) elements.settingsDialog.showModal();
  }
  if (command === 'open-clients') openClientsDialog();
});

(async function init() {
  try {
    state = await window.patchWatch.getState();
    render();
  } catch (error) {
    elements.globalStatus.textContent = t('status.initFailed', { message: userErrorMessage(error) });
  }
})();
