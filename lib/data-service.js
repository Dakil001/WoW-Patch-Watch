'use strict';

const crypto = require('node:crypto');
const {
  HISTORY_DAYS,
  BLIZZTRACK_API,
  BLIZZARD_VERSION_BASE,
  NEWS_API_ENDPOINTS,
  DEFAULT_TRACKS
} = require('./constants');
const { normalizeLanguage, t } = require('./i18n');

function cutoffDate(days = HISTORY_DAYS) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'WoW-Patch-Watch/1.0.5 (+desktop app)',
        Accept: '*/*',
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${url}`);
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function parsePipeManifest(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split('|').map((header) => header.split('!')[0]);
  return lines.slice(1).map((line) => {
    const values = line.split('|');
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function deriveInterfaceId(versionName) {
  const parts = String(versionName || '').match(/\d+/g)?.map(Number) || [];
  if (parts.length < 3 || parts.slice(0, 3).some((part) => !Number.isInteger(part) || part < 0)) {
    return null;
  }
  const [major, minor, patch] = parts;
  return (major * 10000) + (minor * 100) + patch;
}

function normalizeRow(row, product, source, observedAt) {
  if (!row) return null;
  const versionName = String(
    row.version_name ?? row.VersionsName ?? row.VersionName ?? row.versionName ?? ''
  ).trim();
  const buildId = Number(row.build_id ?? row.BuildId ?? row.buildId ?? 0);
  const region = String(row.region ?? row.Region ?? row.name ?? row.Name ?? '').trim().toUpperCase();
  if (!versionName || !Number.isFinite(buildId) || buildId <= 0) return null;
  return {
    product,
    region,
    version: versionName,
    interfaceId: deriveInterfaceId(versionName),
    buildId,
    buildConfig: String(row.build_config ?? row.BuildConfig ?? ''),
    cdnConfig: String(row.cdn_config ?? row.CDNConfig ?? ''),
    productConfig: String(row.product_config ?? row.ProductConfig ?? ''),
    observedAt: new Date(observedAt || Date.now()).toISOString(),
    source
  };
}

function selectEuRow(rows) {
  if (!rows.length) return null;
  return rows.find((row) => ['EU', 'EUR'].includes(row.region))
    || rows.find((row) => row.region.includes('EUROPE'))
    || rows.find((row) => row.region === 'US')
    || rows[0];
}

async function fetchBattleNetCurrent(product, language = 'de') {
  const url = `${BLIZZARD_VERSION_BASE}/${encodeURIComponent(product)}/versions`;
  const response = await fetchWithTimeout(url, {}, 12000);
  const text = await response.text();
  const rows = parsePipeManifest(text)
    .map((row) => normalizeRow(row, product, t(language, 'source.blizzardVersions'), Date.now()))
    .filter(Boolean);
  const selected = selectEuRow(rows);
  if (!selected) throw new Error(t(language, 'error.noVersionLine', { product }));
  return selected;
}

async function fetchBlizzTrackCurrent(product, language = 'de') {
  const response = await fetchWithTimeout(`${BLIZZTRACK_API}/manifest/${encodeURIComponent(product)}/versions`);
  const json = await response.json();
  const result = json.results || json.result;
  const rows = Array.isArray(result?.data) ? result.data : [];
  const observedAt = result?.created_at || Date.now();
  const normalized = rows
    .map((row) => normalizeRow(row, product, 'BlizzTrack', observedAt))
    .filter(Boolean);
  const selected = selectEuRow(normalized);
  if (!selected) throw new Error(t(language, 'error.blizztrackNoVersion', { product }));
  return selected;
}

async function fetchCurrentProduct(product, language = 'de') {
  const lang = normalizeLanguage(language);
  try {
    return await fetchBattleNetCurrent(product, lang);
  } catch (officialError) {
    try {
      const fallback = await fetchBlizzTrackCurrent(product, lang);
      fallback.fallbackReason = officialError.message;
      return fallback;
    } catch (fallbackError) {
      throw new Error(`${product}: Blizzard: ${officialError.message}; BlizzTrack: ${fallbackError.message}`);
    }
  }
}

function matchesPrefixes(snapshot, prefixes = []) {
  if (!snapshot) return false;
  if (!prefixes.length) return true;
  return prefixes.some((prefix) => snapshot.version === prefix || snapshot.version.startsWith(`${prefix}.`));
}

function pickCandidate(candidates, productSnapshots) {
  for (const candidate of candidates) {
    const snapshot = productSnapshots[candidate.product];
    if (snapshot && matchesPrefixes(snapshot, candidate.prefixes)) return snapshot;
  }
  return null;
}

function compareVersions(left, right) {
  if (!left || !right) return null;
  const a = left.version.split(/[^0-9]+/).filter(Boolean).map(Number);
  const b = right.version.split(/[^0-9]+/).filter(Boolean).map(Number);
  const max = Math.max(a.length, b.length);
  for (let index = 0; index < max; index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }
  if (left.buildId === right.buildId) return 0;
  return left.buildId > right.buildId ? 1 : -1;
}

function resolveTracks(productSnapshots, tracks = DEFAULT_TRACKS) {
  return Object.fromEntries(tracks.map((track) => {
    const live = pickCandidate(track.live, productSnapshots);
    const ptr = pickCandidate(track.ptr, productSnapshots);
    return [track.id, {
      id: track.id,
      name: track.name,
      live,
      ptr,
      ptrComparison: live && ptr ? compareVersions(ptr, live) : null,
      checkedAt: new Date().toISOString()
    }];
  }));
}

async function fetchSeqnPage(product, page) {
  const url = `${BLIZZTRACK_API}/manifest/${encodeURIComponent(product)}/seqn?file=versions&page=${page}&limit=25`;
  const response = await fetchWithTimeout(url);
  const json = await response.json();
  const paged = json.results || json.result;
  return {
    items: Array.isArray(paged?.results) ? paged.results : [],
    totalPages: Number(paged?.total_pages || 1)
  };
}

async function fetchManifestBySeqn(product, seqn, language = 'de') {
  const url = `${BLIZZTRACK_API}/manifest/${encodeURIComponent(product)}/versions?seqn=${encodeURIComponent(seqn)}`;
  const response = await fetchWithTimeout(url);
  const json = await response.json();
  const result = json.results || json.result;
  const rows = Array.isArray(result?.data) ? result.data : [];
  const normalized = rows
    .map((row) => normalizeRow(row, product, t(language, 'source.blizztrackHistory'), result?.created_at || Date.now()))
    .filter(Boolean);
  return selectEuRow(normalized);
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const output = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        output[index] = await mapper(items[index], index);
      } catch (_) {
        output[index] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return output;
}

async function fetchProductHistory(product, days = HISTORY_DAYS, language = 'de') {
  const cutoff = cutoffDate(days);
  const seqns = [];
  for (let page = 1; page <= 2; page += 1) {
    const result = await fetchSeqnPage(product, page);
    seqns.push(...result.items);
    const oldest = result.items[result.items.length - 1];
    if (!oldest || new Date(oldest.created_at) < cutoff || page >= result.totalPages) break;
  }

  const withinWindow = seqns.filter((item) => item?.seqn && new Date(item.created_at) >= cutoff);
  const baseline = seqns.find((item) => item?.seqn && new Date(item.created_at) < cutoff);
  const relevant = [...withinWindow, ...(baseline ? [baseline] : [])].slice(0, 51);
  const snapshots = (await mapWithConcurrency(relevant, 4, (item) => fetchManifestBySeqn(product, item.seqn, language)))
    .filter(Boolean)
    .sort((a, b) => new Date(a.observedAt) - new Date(b.observedAt));

  const deduped = [];
  for (const snapshot of snapshots) {
    const previous = deduped[deduped.length - 1];
    if (!previous || previous.version !== snapshot.version || previous.buildId !== snapshot.buildId) {
      deduped.push(snapshot);
    }
  }
  return deduped;
}

function eventId(gameId, channel, snapshot) {
  return crypto.createHash('sha256')
    .update(`${gameId}|${channel}|${snapshot.product}|${snapshot.version}|${snapshot.buildId}|${snapshot.observedAt}`)
    .digest('hex')
    .slice(0, 24);
}

function deriveHistoryEvents(productHistories, tracks = DEFAULT_TRACKS) {
  const events = [];
  for (const track of tracks) {
    for (const [channel, candidates] of [['live', track.live], ['ptr', track.ptr]]) {
      const snapshots = candidates.flatMap((candidate) =>
        (productHistories[candidate.product] || []).filter((snapshot) => matchesPrefixes(snapshot, candidate.prefixes))
      ).sort((a, b) => new Date(a.observedAt) - new Date(b.observedAt));

      let previous = null;
      const cutoff = cutoffDate(HISTORY_DAYS);
      for (const snapshot of snapshots) {
        const changed = previous && (previous.version !== snapshot.version || previous.buildId !== snapshot.buildId);
        if (changed && new Date(snapshot.observedAt) >= cutoff) {
          events.push({
            id: eventId(track.id, channel, snapshot),
            gameId: track.id,
            channel,
            version: snapshot.version,
            buildId: snapshot.buildId,
            product: snapshot.product,
            detectedAt: snapshot.observedAt,
            source: snapshot.source,
            kind: 'build'
          });
        }
        previous = snapshot;
      }
    }
  }
  return events;
}

function classifyNewsItem(item) {
  const text = `${item.title || ''} ${item.contentSnippet || ''} ${item.content || ''}`.toLowerCase();
  const targets = new Set();
  if (/hotfix|hotfixes/.test(text)) {
    DEFAULT_TRACKS.forEach((track) => targets.add(track.id));
  }
  if (/burning crusade|\btbc\b|outland|scherbenwelt/.test(text)) targets.add('tbc');
  if (/mists of pandaria|pandaria classic|\bmop\b/.test(text)) targets.add('pandaria');
  if (/classic era|classic-ära|classic ära|hardcore|season of discovery|saison der entdeckungen|wow classic era/.test(text)) targets.add('era');
  if (/public test realm|\bptr\b/.test(text) && /classic/.test(text)) {
    if (/burning crusade|\btbc\b/.test(text)) targets.add('tbc');
    if (/pandaria|\bmop\b/.test(text)) targets.add('pandaria');
    if (/classic era|hardcore/.test(text)) targets.add('era');
  }
  const containsClassic = /classic|burning crusade|pandaria|hardcore|season of discovery/.test(text);
  if (!containsClassic || /midnight|mitternacht|retail|curse of ula'tek|fluch von ula'tek/.test(text)) targets.add('retail');
  return [...targets];
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractNewsItems(payload) {
  const candidates = [
    payload?.feed?.contentItems,
    payload?.data?.feed?.contentItems,
    payload?.results?.feed?.contentItems,
    payload?.contentItems,
    payload?.items
  ];
  return candidates.find(Array.isArray) || [];
}

function normalizeNewsLink(value, locale) {
  const link = String(value || '').trim();
  if (!link) return '';
  try {
    return new URL(link, `https://news.blizzard.com/${locale}/`).toString();
  } catch (_) {
    return '';
  }
}

function normalizeNewsApiItem(item, locale) {
  const properties = item?.properties || item || {};
  const language = locale.startsWith('en-') ? 'en' : 'de';
  const title = stripHtml(properties.title || properties.name || t(language, 'news.defaultTitle'));
  const summary = stripHtml(properties.summary || properties.description || properties.content || '').slice(0, 800);
  const link = normalizeNewsLink(
    properties.newsUrl || properties.url || properties.link || item?.url || item?.link,
    locale
  );
  const rawDate = properties.lastUpdated
    || properties.publishDate
    || properties.publishedAt
    || properties.createdAt
    || item?.lastUpdated
    || item?.publishDate;
  const publishedAt = new Date(rawDate || 0);
  if (!title || Number.isNaN(publishedAt.getTime())) return null;
  const gameIds = classifyNewsItem({ title, contentSnippet: summary });
  return {
    id: crypto.createHash('sha256')
      .update(`${properties.newsId || item?.id || title}|${link}|${publishedAt.toISOString()}`)
      .digest('hex')
      .slice(0, 24),
    title,
    link,
    publishedAt: publishedAt.toISOString(),
    summary,
    gameIds,
    source: locale === 'de-de' ? 'Blizzard News (DE)' : 'Blizzard News'
  };
}

async function fetchNews(days = HISTORY_DAYS, language = 'de') {
  const lang = normalizeLanguage(language);
  const cutoff = cutoffDate(days);
  const errors = [];
  const endpoints = [...NEWS_API_ENDPOINTS].sort((left, right) => {
    const leftPreferred = lang === 'de' ? left.locale === 'de-de' : left.locale.startsWith('en-');
    const rightPreferred = lang === 'de' ? right.locale === 'de-de' : right.locale.startsWith('en-');
    return Number(rightPreferred) - Number(leftPreferred);
  });

  for (const endpoint of endpoints) {
    try {
      const response = await fetchWithTimeout(endpoint.url, {
        headers: { Accept: 'application/json' }
      });
      const payload = await response.json();
      const rawItems = extractNewsItems(payload);
      if (!rawItems.length) {
        throw new Error(t(lang, 'error.newsNoItems'));
      }

      return rawItems
        .map((item) => normalizeNewsApiItem(item, endpoint.locale))
        .filter(Boolean)
        .filter((item) => new Date(item.publishedAt) >= cutoff && item.gameIds.length > 0)
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    } catch (error) {
      errors.push(`${endpoint.locale}: ${error.message}`);
    }
  }

  throw new Error(t(lang, 'error.newsFailed', { details: errors.join(' | ') }));
}

module.exports = {
  fetchCurrentProduct,
  fetchProductHistory,
  resolveTracks,
  deriveHistoryEvents,
  fetchNews,
  compareVersions,
  matchesPrefixes,
  cutoffDate,
  deriveInterfaceId,
  extractNewsItems,
  normalizeNewsApiItem
};
