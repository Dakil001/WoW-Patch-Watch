'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DEFAULT_REFRESH_MINUTES, cloneDefaultTracks } = require('./constants');
const { normalizeLanguage } = require('./i18n');

function defaultEntrySettings(tracks = cloneDefaultTracks()) {
  return Object.fromEntries(tracks.map((track) => [track.id, {
    addons: [],
    notifyLive: false,
    notifyPtr: false
  }]));
}

function defaultState() {
  const tracks = cloneDefaultTracks();
  return {
    schemaVersion: 4,
    settings: {
      language: 'de',
      autoRefresh: true,
      refreshMinutes: DEFAULT_REFRESH_MINUTES,
      runInBackground: true,
      launchAtLogin: false,
      email: {
        enabled: false,
        host: '',
        port: 587,
        secure: false,
        user: '',
        from: '',
        to: '',
        encryptedPassword: ''
      }
    },
    tracks,
    entries: defaultEntrySettings(tracks),
    current: {},
    history: [],
    news: [],
    meta: {
      lastRefreshAt: null,
      historyBackfillAt: null,
      lastRefreshError: ''
    }
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override === undefined ? base : override;
  }
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(base[key])) {
      result[key] = deepMerge(base[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}


function migrateKnownSmtpMistakes(email) {
  if (!isPlainObject(email)) return email;
  const host = String(email.host || '').trim();
  const match = host.match(/^([^\s@]+)@mail\.de$/i);
  if (!match) return email;

  // v1.0.3 akzeptierte versehentlich eine E-Mail-Adresse im Hostfeld. Für
  // mail.de ist der korrekte SMTP-Hostname eindeutig und kann sicher
  // repariert werden. Die Adresse wird außerdem als Login/Empfänger
  // übernommen, falls diese Felder noch leer sind.
  email.host = 'smtp.mail.de';
  if (!String(email.user || '').trim()) email.user = host;
  if (!String(email.to || '').trim()) email.to = host;
  const port = Number(email.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) email.port = 587;
  if (Number(email.port) === 587) email.secure = false;
  return email;
}

function normalizePrefixes(prefixes) {
  const values = Array.isArray(prefixes) ? prefixes : [];
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))].slice(0, 20);
}

function normalizeCandidates(candidates) {
  if (!Array.isArray(candidates)) return [];
  return candidates
    .map((candidate) => ({
      product: String(candidate?.product || '').trim().slice(0, 100),
      prefixes: normalizePrefixes(candidate?.prefixes)
    }))
    .filter((candidate) => candidate.product)
    .slice(0, 10);
}

function normalizeTrack(track, index) {
  const id = String(track?.id || `client-${index + 1}`).trim().slice(0, 100);
  const name = String(track?.name || `WoW-Client ${index + 1}`).trim().slice(0, 100);
  return {
    id,
    name,
    shortName: String(track?.shortName || name).trim().slice(0, 50),
    builtIn: Boolean(track?.builtIn),
    enabled: track?.enabled !== false,
    live: normalizeCandidates(track?.live),
    ptr: normalizeCandidates(track?.ptr)
  };
}

class JsonStore {
  constructor(userDataPath) {
    this.filePath = path.join(userDataPath, 'state.json');
    this.state = defaultState();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        this.state = deepMerge(defaultState(), parsed);
      }
    } catch (error) {
      const brokenPath = `${this.filePath}.broken-${Date.now()}`;
      try {
        fs.renameSync(this.filePath, brokenPath);
      } catch (_) {
        // Die defekte Datei kann im Ausnahmefall nicht verschoben werden.
      }
      this.state = defaultState();
      this.state.meta.lastRefreshError = `Lokale Datendatei war beschädigt und wurde zurückgesetzt: ${error.message}`;
    }
    this.normalize();
    return this.state;
  }

  normalize() {
    const defaults = cloneDefaultTracks();
    const sourceTracks = Array.isArray(this.state.tracks) && this.state.tracks.length
      ? this.state.tracks
      : defaults;
    const seen = new Set();
    this.state.tracks = sourceTracks
      .map(normalizeTrack)
      .filter((track) => track.id && track.name && track.live.length > 0 && !seen.has(track.id) && seen.add(track.id));

    // Alte v1-Zustände erhalten automatisch die vier eingebauten Clients.
    if (!this.state.tracks.length) this.state.tracks = defaults;

    this.state.entries = isPlainObject(this.state.entries) ? this.state.entries : {};
    for (const track of this.state.tracks) {
      const entry = this.state.entries[track.id] || {};
      this.state.entries[track.id] = {
        addons: Array.isArray(entry.addons)
          ? [...new Set(entry.addons.map((name) => String(name).trim()).filter(Boolean))].slice(0, 100)
          : [],
        notifyLive: Boolean(entry.notifyLive),
        notifyPtr: Boolean(entry.notifyPtr)
      };
    }
    this.state.history = Array.isArray(this.state.history) ? this.state.history : [];
    this.state.news = Array.isArray(this.state.news) ? this.state.news : [];
    this.state.current = isPlainObject(this.state.current) ? this.state.current : {};
    this.state.settings = isPlainObject(this.state.settings) ? this.state.settings : defaultState().settings;
    this.state.settings.language = normalizeLanguage(this.state.settings.language);
    this.state.settings.email = migrateKnownSmtpMistakes(this.state.settings.email || {});
    this.state.schemaVersion = 4;
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2), 'utf8');
    fs.renameSync(tempPath, this.filePath);
  }

  get() {
    return this.state;
  }
}

module.exports = { JsonStore, defaultState, normalizeTrack, migrateKnownSmtpMistakes };
