'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const policy = require(path.join(root, 'lib', 'notification-policy'));
const { JsonStore, defaultState } = require(path.join(root, 'lib', 'store'));
const { t } = require(path.join(root, 'lib', 'i18n'));

function testSyntax() {
  const files = [
    'main.js',
    'preload.js',
    'renderer/app.js',
    ...fs.readdirSync(path.join(root, 'lib')).filter((name) => name.endsWith('.js')).map((name) => `lib/${name}`)
  ];
  for (const file of files) execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
}

function testNotificationPolicy() {
  const smallBuild = {
    notify: true,
    previous: { version: '12.0.7.68808', buildId: 68808 },
    current: { version: '12.0.7.69000', buildId: 69000 }
  };
  assert.equal(policy.shouldNotifyChange(smallBuild, 'interface'), false);
  assert.equal(policy.shouldNotifyChange(smallBuild, 'all'), true);

  const interfaceChange = {
    notify: true,
    previous: { version: '12.0.7.68808', buildId: 68808 },
    current: { version: '12.0.8.69100', buildId: 69100 }
  };
  assert.equal(policy.shouldNotifyChange(interfaceChange, 'interface'), true);
  assert.equal(policy.shouldNotifyChange({ ...interfaceChange, notify: false }, 'all'), false);
}

function testDefaultsAndMigration() {
  const defaults = defaultState();
  assert.equal(defaults.settings.refreshMinutes, 1440);
  assert.equal(defaults.settings.notificationMode, 'interface');
  assert.equal(defaults.settings.launchAtLogin, true);
  for (const entry of Object.values(defaults.entries)) assert.equal(entry.newsOpen, true);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-patch-watch-'));
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({
    schemaVersion: 4,
    settings: {
      language: 'de',
      autoRefresh: true,
      refreshMinutes: 60,
      runInBackground: true,
      launchAtLogin: false,
      email: {}
    },
    tracks: defaults.tracks,
    entries: Object.fromEntries(defaults.tracks.map((track) => [track.id, {
      addons: [], notifyLive: false, notifyPtr: false
    }]))
  }));

  const store = new JsonStore(dir);
  store.load();
  assert.equal(store.get().schemaVersion, 5);
  assert.equal(store.get().settings.refreshMinutes, 1440);
  assert.equal(store.get().settings.launchAtLogin, true);
  assert.equal(store.get().settings.notificationMode, 'interface');
  for (const entry of Object.values(store.get().entries)) assert.equal(entry.newsOpen, true);
  fs.rmSync(dir, { recursive: true, force: true });
}

function catalogKeys(source, language) {
  const marker = language === 'de' ? 'de: Object.freeze({' : 'en: Object.freeze({';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1);
  const end = language === 'de' ? source.indexOf('en: Object.freeze({', start) : source.indexOf('\n  })\n});', start);
  const section = source.slice(start, end);
  return new Set([...section.matchAll(/'([^']+)':/g)].map((match) => match[1]));
}

function testTranslationsAndStaticUi() {
  const i18nSource = fs.readFileSync(path.join(root, 'lib', 'i18n.js'), 'utf8');
  const de = catalogKeys(i18nSource, 'de');
  const en = catalogKeys(i18nSource, 'en');
  assert.deepEqual([...de].sort(), [...en].sort());

  const used = new Set();
  for (const file of ['renderer/index.html', 'renderer/app.js', 'main.js', 'lib/data-service.js', 'lib/mailer.js']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of source.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)) used.add(match[1]);
    for (const match of source.matchAll(/\bt\('([^']+)'/g)) used.add(match[1]);
    for (const match of source.matchAll(/\btr\('([^']+)'/g)) used.add(match[1]);
  }
  const missing = [...used].filter((key) => !de.has(key));
  assert.deepEqual(missing, []);

  const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  assert.equal(mainSource.includes("tr('menu.edit')"), false);
  assert.equal(mainSource.includes("tr('menu.help')"), false);
  assert.equal(mainSource.includes("tr('menu.version')"), true);
  assert.equal(mainSource.includes("tr('menu.github')"), true);
  assert.equal(mainSource.includes("tr('menu.buyMeACoffee')"), true);
  assert.equal(mainSource.includes('https://github.com/Dakil001/WoW-Patch-Watch'), true);
  assert.equal(mainSource.includes('https://buymeacoffee.com/dakil'), true);
  assert.equal(t('de', 'menu.buyMeACoffee'), 'Buy Me a Coffee');
  assert.equal(t('en', 'menu.buyMeACoffee'), 'Buy Me a Coffee');
  const rendererSource = fs.readFileSync(path.join(root, 'renderer/app.js'), 'utf8');
  assert.equal(rendererSource.includes('newsOpen: nextOpen'), true);
  assert.equal(rendererSource.includes('settingsInputs.notificationMode'), true);
  const html = fs.readFileSync(path.join(root, 'renderer/index.html'), 'utf8');
  assert.equal(html.includes('data-i18n-title="card.notifyTooltip"'), true);
  assert.equal(html.includes('id="clientHelpDialog"'), true);
}

function run() {
  testSyntax();
  testNotificationPolicy();
  testDefaultsAndMigration();
  testTranslationsAndStaticUi();
  console.log('All WoW Patch Watch 1.0.7 tests passed.');
}

run();
