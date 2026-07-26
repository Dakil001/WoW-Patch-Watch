'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  safeStorage,
  Tray,
  Menu,
  nativeImage,
  Notification,
  screen
} = require('electron');
const { JsonStore, migrateKnownSmtpMistakes } = require('./lib/store');
const { HISTORY_DAYS, DEFAULT_REFRESH_MINUTES, CLIENTS_PER_PAGE, productsForTracks } = require('./lib/constants');
const {
  fetchCurrentProduct,
  fetchProductHistory,
  resolveTracks,
  deriveHistoryEvents,
  fetchNews,
  cutoffDate
} = require('./lib/data-service');
const { sendTestEmail, sendChangeEmail, validateEmailSettings } = require('./lib/mailer');
const { t, getCatalog, normalizeLanguage } = require('./lib/i18n');
const { normalizeNotificationMode, shouldNotifyChange } = require('./lib/notification-policy');

let mainWindow = null;
let tray = null;
let store = null;
let refreshTimer = null;
let refreshPromise = null;
let isQuitting = false;
let pendingVisibleCardCount = CLIENTS_PER_PAGE;

const GITHUB_URL = 'https://github.com/Dakil001/WoW-Patch-Watch';
const BUY_ME_A_COFFEE_URL = 'https://buymeacoffee.com/dakil';

function currentLanguage() {
  return normalizeLanguage(store?.get()?.settings?.language);
}

function tr(key, values = {}) {
  return t(currentLanguage(), key, values);
}

function makeTrayImage() {
  return nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png'));
}

function sendUiCommand(command) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('ui:command', command);
}

function buildApplicationMenu() {
  const isMac = process.platform === 'darwin';
  const template = [];

  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about', label: tr('menu.about', { app: app.name }) },
        { type: 'separator' },
        { label: tr('menu.settings'), accelerator: 'CmdOrCtrl+,', click: () => sendUiCommand('open-settings') },
        { type: 'separator' },
        { role: 'hide', label: tr('menu.hideApp', { app: app.name }) },
        { role: 'hideOthers', label: tr('menu.hideOthers') },
        { role: 'unhide', label: tr('menu.unhide') },
        { type: 'separator' },
        { role: 'quit', label: tr('menu.quitApp', { app: app.name }) }
      ]
    });
  }

  template.push(
    {
      label: tr('menu.file'),
      submenu: [
        { label: tr('menu.refresh'), accelerator: 'CmdOrCtrl+R', click: () => refreshAll('menu').catch(() => {}) },
        { label: tr('menu.manageClients'), accelerator: 'CmdOrCtrl+Shift+C', click: () => sendUiCommand('open-clients') },
        ...(!isMac ? [
          { label: tr('menu.settings'), accelerator: 'CmdOrCtrl+,', click: () => sendUiCommand('open-settings') },
          { type: 'separator' },
          { role: 'quit', label: tr('menu.quit') }
        ] : [])
      ]
    },
    {
      label: tr('menu.view'),
      submenu: [
        { role: 'resetZoom', label: tr('menu.actualSize') },
        { role: 'zoomIn', label: tr('menu.zoomIn') },
        { role: 'zoomOut', label: tr('menu.zoomOut') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: tr('menu.fullscreen') }
      ]
    },
    {
      label: tr('menu.window'),
      submenu: [
        { role: 'minimize', label: tr('menu.minimize') },
        { role: 'close', label: tr('menu.close') }
      ]
    },
    {
      label: tr('menu.version'),
      submenu: [
        { label: `WoW Patch Watch ${app.getVersion()}`, enabled: false }
      ]
    },
    {
      label: tr('menu.github'),
      submenu: [
        { label: tr('menu.openGithub'), click: () => shell.openExternal(GITHUB_URL).catch(() => {}) }
      ]
    },
    {
      label: tr('menu.buyMeACoffee'),
      submenu: [
        { label: tr('menu.openBuyMeACoffee'), click: () => shell.openExternal(BUY_ME_A_COFFEE_URL).catch(() => {}) }
      ]
    }
  );

  return Menu.buildFromTemplate(template);
}

const WINDOW_CONTENT_WIDTHS = Object.freeze({
  0: 620,
  1: 460,
  2: 820,
  3: 1180,
  4: 1540
});

function resizeWindowForVisibleCards(requestedCount) {
  const count = Math.max(0, Math.min(CLIENTS_PER_PAGE, Number(requestedCount) || 0));
  pendingVisibleCardCount = count;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMaximized() || mainWindow.isFullScreen()) return;

  const desiredContentWidth = WINDOW_CONTENT_WIDTHS[count] || WINDOW_CONTENT_WIDTHS[CLIENTS_PER_PAGE];
  const outer = mainWindow.getBounds();
  const content = mainWindow.getContentBounds();
  const frameWidth = Math.max(0, outer.width - content.width);
  const desiredOuterWidth = desiredContentWidth + frameWidth;
  const display = screen.getDisplayMatching(outer);
  const workArea = display.workArea;
  const targetWidth = Math.min(desiredOuterWidth, workArea.width);
  const centerX = outer.x + (outer.width / 2);
  const maxX = workArea.x + workArea.width - targetWidth;
  const targetX = Math.max(workArea.x, Math.min(Math.round(centerX - (targetWidth / 2)), maxX));
  const maxY = workArea.y + workArea.height - outer.height;
  const targetY = Math.max(workArea.y, Math.min(outer.y, Math.max(workArea.y, maxY)));

  if (Math.abs(outer.width - targetWidth) < 2 && outer.x === targetX && outer.y === targetY) return;
  mainWindow.setBounds({ x: targetX, y: targetY, width: targetWidth, height: outer.height }, process.platform === 'darwin');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1540,
    height: 840,
    minWidth: 440,
    minHeight: 680,
    autoHideMenuBar: false,
    show: false,
    backgroundColor: '#0b1020',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  mainWindow.setMenuBarVisibility(true);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) event.preventDefault();
  });
  mainWindow.on('unmaximize', () => resizeWindowForVisibleCards(pendingVisibleCardCount));
  mainWindow.on('leave-full-screen', () => resizeWindowForVisibleCards(pendingVisibleCardCount));
  mainWindow.on('close', (event) => {
    const runInBackground = store?.get()?.settings?.runInBackground;
    if (!isQuitting && runInBackground) {
      event.preventDefault();
      mainWindow.hide();
      return;
    }
    if (!isQuitting) {
      isQuitting = true;
      app.quit();
    }
  });
}

function updateTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  tray.setToolTip('WoW Patch Watch');
  const menu = Menu.buildFromTemplate([
    {
      label: tr('tray.open'),
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    { label: tr('menu.refresh'), click: () => refreshAll('tray').catch(() => {}) },
    { label: tr('tray.manageClients'), click: () => sendUiCommand('open-clients') },
    { type: 'separator' },
    {
      label: tr('menu.quit'),
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
}

function createTray() {
  tray = new Tray(makeTrayImage());
  updateTrayMenu();
  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

function rebuildNativeUi() {
  Menu.setApplicationMenu(buildApplicationMenu());
  updateTrayMenu();
}

function emitStatus(message, progress = null, error = false) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('refresh:status', { message, progress, error });
  }
}

function sanitizedState() {
  const state = store.get();
  return {
    ...state,
    settings: {
      ...state.settings,
      email: {
        ...state.settings.email,
        encryptedPassword: undefined,
        hasPassword: Boolean(state.settings.email.encryptedPassword)
      }
    },
    appVersion: app.getVersion(),
    locale: {
      language: currentLanguage(),
      messages: getCatalog(currentLanguage())
    },
    historyDays: HISTORY_DAYS,
    clientsPerPage: CLIENTS_PER_PAGE
  };
}

function emitState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('state:changed', sanitizedState());
  }
}

function decryptPassword(encryptedPassword) {
  if (!encryptedPassword) return '';
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(tr('error.keychainUnavailable'));
  }
  return safeStorage.decryptString(Buffer.from(encryptedPassword, 'base64'));
}

function emailSettingsWithPassword() {
  const email = store.get().settings.email;
  return {
    ...email,
    password: decryptPassword(email.encryptedPassword)
  };
}

function scheduleRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
  const settings = store.get().settings;
  if (!settings.autoRefresh) return;
  const minutes = Math.max(15, Math.min(1440, Number(settings.refreshMinutes) || DEFAULT_REFRESH_MINUTES));
  refreshTimer = setInterval(() => refreshAll('timer').catch(() => {}), minutes * 60 * 1000);
}

async function mapSettledWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { status: 'fulfilled', value: await mapper(items[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function sameSnapshot(left, right) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.version === right.version && left.buildId === right.buildId && left.product === right.product;
}

function detectChanges(previousCurrent, nextCurrent, entries, tracks) {
  const changes = [];
  for (const track of tracks) {
    const previous = previousCurrent[track.id] || {};
    const current = nextCurrent[track.id] || {};
    for (const channel of ['live', 'ptr']) {
      if (!previous[channel]) continue; // Ersterfassung löst keine Benachrichtigung aus.
      if (sameSnapshot(previous[channel], current[channel])) continue;
      changes.push({
        gameId: track.id,
        gameName: track.name,
        channel,
        previous: previous[channel] || null,
        current: current[channel] || null,
        addons: entries[track.id]?.addons || [],
        notify: channel === 'live' ? entries[track.id]?.notifyLive : entries[track.id]?.notifyPtr
      });
    }
  }
  return changes;
}

function mergeHistory(existing, incoming) {
  const cutoff = cutoffDate(HISTORY_DAYS);
  const map = new Map();
  for (const item of [...existing, ...incoming]) {
    if (!item?.id || new Date(item.detectedAt) < cutoff) continue;
    map.set(item.id, item);
  }
  return [...map.values()].sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt));
}

function localEventsFromChanges(changes) {
  const now = Date.now();
  return changes.map((change, index) => {
    if (!change.current) {
      return {
        id: `${change.gameId}-${change.channel}-unavailable-${now}-${index}`,
        gameId: change.gameId,
        channel: change.channel,
        version: '',
        buildId: null,
        product: change.previous?.product || '',
        detectedAt: new Date(now).toISOString(),
        source: tr('history.localCheck'),
        kind: 'availability',
        available: false
      };
    }
    return {
      id: `${change.gameId}-${change.channel}-${change.current.product}-${change.current.version}-${change.current.buildId}-${now}-${index}`,
      gameId: change.gameId,
      channel: change.channel,
      version: change.current.version,
      buildId: change.current.buildId,
      product: change.current.product,
      detectedAt: new Date(now).toISOString(),
      source: change.current.source,
      kind: 'build'
    };
  });
}

async function notifyChanges(changes) {
  const mode = normalizeNotificationMode(store.get().settings.notificationMode);
  const selected = changes.filter((change) => shouldNotifyChange(change, mode));
  if (!selected.length) return;

  if (Notification.isSupported()) {
    const summary = selected.map((change) => `${change.gameName} ${change.channel.toUpperCase()}`).join(', ');
    new Notification({
      title: 'WoW Patch Watch',
      body: tr('notification.changeDetected', { summary }),
      silent: false
    }).show();
  }

  const email = store.get().settings.email;
  if (email.enabled) {
    try {
      await sendChangeEmail(emailSettingsWithPassword(), selected, currentLanguage());
    } catch (error) {
      store.get().meta.lastRefreshError = tr('notification.emailFailed', { message: error.message });
    }
  }
}

async function refreshAll(reason = 'manual') {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const state = store.get();
    const tracks = state.tracks.filter((track) => track.enabled !== false);
    const products = productsForTracks(tracks);
    const previousCurrent = JSON.parse(JSON.stringify(state.current || {}));
    state.meta.lastRefreshError = '';
    emitStatus(tr('status.checkingBuilds'), 0.05);

    const productSnapshots = {};
    const errors = [];
    const results = await Promise.allSettled(products.map(async (product, index) => {
      const snapshot = await fetchCurrentProduct(product, currentLanguage());
      emitStatus(tr('status.buildLoaded', { product }), 0.08 + ((index + 1) / Math.max(1, products.length)) * 0.35);
      return [product, snapshot];
    }));
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const [product, snapshot] = result.value;
        productSnapshots[product] = snapshot;
      } else {
        errors.push(result.reason?.message || String(result.reason));
      }
    }

    const resolved = resolveTracks(productSnapshots, tracks);
    for (const track of tracks) {
      const previous = previousCurrent[track.id] || {};
      const allLiveSourcesFailed = track.live.every((candidate) => !productSnapshots[candidate.product]);
      const allPtrSourcesFailed = !track.ptr.length || track.ptr.every((candidate) => !productSnapshots[candidate.product]);
      if (!resolved[track.id].live && previous.live && allLiveSourcesFailed) {
        resolved[track.id].live = { ...previous.live, stale: true };
      }
      if (!resolved[track.id].ptr && previous.ptr && track.ptr.length > 0 && allPtrSourcesFailed) {
        resolved[track.id].ptr = { ...previous.ptr, stale: true };
      }
      resolved[track.id].errors = errors.filter((message) =>
        [...track.live, ...track.ptr].some((candidate) => message.startsWith(`${candidate.product}:`))
      );
    }

    const backfillDue = !state.meta.historyBackfillAt
      || Date.now() - new Date(state.meta.historyBackfillAt).getTime() > 24 * 60 * 60 * 1000;
    let historicalEvents = [];
    if (backfillDue && products.length) {
      emitStatus(tr('status.loadingHistory'), 0.48);
      const productHistories = {};
      let completed = 0;
      const historyResults = await mapSettledWithConcurrency(products, 2, async (product) => {
        const history = await fetchProductHistory(product, HISTORY_DAYS, currentLanguage());
        completed += 1;
        emitStatus(tr('status.historyLoaded', { product }), 0.48 + (completed / products.length) * 0.32);
        return [product, history];
      });
      for (const result of historyResults) {
        if (result.status === 'fulfilled') {
          const [product, history] = result.value;
          productHistories[product] = history;
        }
      }
      historicalEvents = deriveHistoryEvents(productHistories, tracks);
      state.meta.historyBackfillAt = new Date().toISOString();
    }

    emitStatus(tr('status.loadingNews'), 0.84);
    try {
      state.news = await fetchNews(HISTORY_DAYS, currentLanguage());
    } catch (error) {
      errors.push(`Newsfeed: ${error.message}`);
    }

    const changes = detectChanges(previousCurrent, resolved, state.entries, tracks);
    state.current = { ...state.current, ...resolved };
    state.history = mergeHistory(state.history, [...historicalEvents, ...localEventsFromChanges(changes)]);
    state.meta.lastRefreshAt = new Date().toISOString();
    state.meta.lastRefreshError = errors.join('\n');
    store.save();
    emitState();
    emitStatus(errors.length ? tr('status.refreshDoneWarnings') : tr('status.refreshDone'), 1, false);
    await notifyChanges(changes);
    store.save();
    emitState();
    return sanitizedState();
  })().catch((error) => {
    store.get().meta.lastRefreshError = error.message;
    store.save();
    emitStatus(tr('status.refreshFailed', { message: error.message }), null, true);
    emitState();
    throw error;
  }).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

function findTrack(gameId) {
  return store.get().tracks.find((track) => track.id === gameId);
}

function validateEntryUpdate(gameId, patch) {
  if (!findTrack(gameId)) throw new Error(tr('error.unknownEntry'));
  const current = store.get().entries[gameId] || { addons: [], notifyLive: false, notifyPtr: false, newsOpen: true };
  const next = { ...current };
  if (patch.addons !== undefined) {
    if (!Array.isArray(patch.addons)) throw new Error(tr('error.addonListInvalid'));
    next.addons = [...new Set(patch.addons.map((name) => String(name).trim()).filter(Boolean))].slice(0, 100);
  }
  if (patch.notifyLive !== undefined) next.notifyLive = Boolean(patch.notifyLive);
  if (patch.notifyPtr !== undefined) next.notifyPtr = Boolean(patch.notifyPtr);
  if (patch.newsOpen !== undefined) next.newsOpen = Boolean(patch.newsOpen);
  return next;
}

function normalizeProduct(value, required) {
  const product = String(value || '').trim();
  if (!product && !required) return '';
  if (!product) throw new Error(tr('error.liveClientMissing'));
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(product)) {
    throw new Error(tr('error.invalidClientId', { product }));
  }
  return product;
}

function normalizePrefixes(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(source.map((prefix) => String(prefix).trim()).filter(Boolean))].slice(0, 20);
}

function trackFromSubmission(submitted, existing = null) {
  const name = String(submitted?.name || '').trim().slice(0, 100);
  if (!name) throw new Error(tr('error.clientNameMissing'));
  const liveProduct = normalizeProduct(submitted?.liveProduct, true);
  const ptrProduct = normalizeProduct(submitted?.ptrProduct, false);
  const slug = name.toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'wow-client';
  return {
    id: existing?.id || `custom-${slug}-${crypto.randomUUID().slice(0, 8)}`,
    name,
    shortName: name.slice(0, 50),
    builtIn: Boolean(existing?.builtIn),
    enabled: submitted?.enabled !== false,
    live: [{ product: liveProduct, prefixes: normalizePrefixes(submitted?.livePrefixes) }],
    ptr: ptrProduct ? [{ product: ptrProduct, prefixes: normalizePrefixes(submitted?.ptrPrefixes) }] : []
  };
}

function registerIpc() {
  ipcMain.handle('state:get', () => sanitizedState());
  ipcMain.handle('data:refresh', () => refreshAll('manual'));
  ipcMain.handle('entry:update', (_event, payload) => {
    const { gameId, patch } = payload || {};
    store.get().entries[gameId] = validateEntryUpdate(gameId, patch || {});
    store.save();
    emitState();
    return sanitizedState();
  });
  ipcMain.handle('track:set-enabled', (_event, payload) => {
    const track = findTrack(payload?.gameId);
    if (!track) throw new Error(tr('error.unknownClient'));
    track.enabled = Boolean(payload.enabled);
    store.get().meta.historyBackfillAt = null;
    store.save();
    emitState();
    setTimeout(() => refreshAll('track-visibility').catch(() => {}), 50);
    return sanitizedState();
  });
  ipcMain.handle('track:save', (_event, submitted) => {
    const state = store.get();
    const existing = submitted?.id ? findTrack(submitted.id) : null;
    if (submitted?.id && !existing) throw new Error(tr('error.clientNotFound'));
    if (existing?.builtIn) throw new Error(tr('error.builtInEdit'));
    const next = trackFromSubmission(submitted, existing);
    if (existing) {
      const index = state.tracks.findIndex((track) => track.id === existing.id);
      state.tracks[index] = next;
    } else {
      state.tracks.push(next);
      state.entries[next.id] = { addons: [], notifyLive: false, notifyPtr: false, newsOpen: true };
    }
    delete state.current[next.id];
    state.history = state.history.filter((item) => item.gameId !== next.id);
    state.meta.historyBackfillAt = null;
    store.save();
    emitState();
    setTimeout(() => refreshAll('track-save').catch(() => {}), 50);
    return sanitizedState();
  });
  ipcMain.handle('track:delete', (_event, payload) => {
    const state = store.get();
    const track = findTrack(payload?.gameId);
    if (!track) throw new Error(tr('error.unknownClient'));
    if (track.builtIn) throw new Error(tr('error.builtInDelete'));
    state.tracks = state.tracks.filter((item) => item.id !== track.id);
    delete state.entries[track.id];
    delete state.current[track.id];
    state.history = state.history.filter((item) => item.gameId !== track.id);
    store.save();
    emitState();
    return sanitizedState();
  });
  ipcMain.handle('settings:save', (_event, submitted) => {
    const state = store.get();
    const currentEmail = state.settings.email;
    const previousLanguage = currentLanguage();
    const nextLanguage = normalizeLanguage(submitted.language);
    const refreshMinutes = Math.max(15, Math.min(1440, Number(submitted.refreshMinutes) || DEFAULT_REFRESH_MINUTES));
    const emailInput = submitted.email || {};
    let encryptedPassword = currentEmail.encryptedPassword;
    if (typeof emailInput.password === 'string' && emailInput.password.length > 0) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error(t(nextLanguage, 'error.passwordStorage'));
      }
      encryptedPassword = safeStorage.encryptString(emailInput.password).toString('base64');
    }
    if (emailInput.clearPassword === true) encryptedPassword = '';

    const nextSettings = {
      language: nextLanguage,
      autoRefresh: Boolean(submitted.autoRefresh),
      refreshMinutes,
      notificationMode: normalizeNotificationMode(submitted.notificationMode),
      runInBackground: Boolean(submitted.runInBackground),
      launchAtLogin: Boolean(submitted.launchAtLogin),
      email: {
        enabled: Boolean(emailInput.enabled),
        host: String(emailInput.host || '').trim().slice(0, 255),
        port: Math.max(1, Math.min(65535, Number(emailInput.port) || 587)),
        secure: Boolean(emailInput.secure),
        user: String(emailInput.user || '').trim().slice(0, 320),
        from: String(emailInput.from || '').trim().slice(0, 320),
        to: String(emailInput.to || '').trim().slice(0, 1000),
        encryptedPassword
      }
    };
    nextSettings.email = migrateKnownSmtpMistakes(nextSettings.email);
    if (nextSettings.email.enabled) {
      validateEmailSettings({
        ...nextSettings.email,
        password: encryptedPassword ? 'stored' : ''
      }, nextLanguage);
    }
    state.settings = nextSettings;
    if (previousLanguage !== nextLanguage) {
      state.news = [];
      state.meta.lastRefreshError = '';
    }
    app.setLoginItemSettings({ openAtLogin: state.settings.launchAtLogin });
    store.save();
    scheduleRefresh();
    rebuildNativeUi();
    emitState();
    if (previousLanguage !== nextLanguage) {
      setTimeout(() => refreshAll('language-change').catch(() => {}), 50);
    }
    return sanitizedState();
  });
  ipcMain.handle('email:test', async () => {
    await sendTestEmail(emailSettingsWithPassword(), currentLanguage());
    return { ok: true };
  });
  ipcMain.handle('external:open', async (_event, url) => {
    if (!/^https:\/\//i.test(String(url))) throw new Error(tr('error.httpsOnly'));
    await shell.openExternal(String(url));
    return { ok: true };
  });
  ipcMain.handle('window:set-visible-card-count', (_event, payload) => {
    const count = Math.max(0, Math.min(CLIENTS_PER_PAGE, Number(payload?.count) || 0));
    resizeWindowForVisibleCards(count);
    return { ok: true, count };
  });
  ipcMain.handle('app:quit', () => {
    isQuitting = true;
    app.quit();
  });
}

const lock = app.requestSingleInstanceLock();
if (!lock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('de.dakil.wowpatchwatch');
    store = new JsonStore(app.getPath('userData'));
    store.load();
    app.setLoginItemSettings({ openAtLogin: Boolean(store.get().settings.launchAtLogin) });
    store.save();
    registerIpc();
    Menu.setApplicationMenu(buildApplicationMenu());
    createWindow();
    createTray();
    scheduleRefresh();
    setTimeout(() => refreshAll('startup').catch(() => {}), 1200);
  });
}

app.on('activate', () => {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  mainWindow.show();
});

app.on('window-all-closed', () => {
  // Die App bleibt für Hintergrundprüfungen und E-Mail-Benachrichtigungen aktiv.
});

app.on('before-quit', () => {
  isQuitting = true;
});
