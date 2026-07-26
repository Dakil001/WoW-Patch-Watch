'use strict';

const HISTORY_DAYS = 14;
const DEFAULT_REFRESH_MINUTES = 1440;
const CLIENTS_PER_PAGE = 4;
const BLIZZTRACK_API = 'https://blizztrack.com/api';
const BLIZZARD_VERSION_BASE = 'https://eu.version.battle.net/v2/products';
const BLIZZARD_WOW_NEWS_PRODUCT_ID = 'blt2caca37e42f19839';
const NEWS_API_ENDPOINTS = [
  {
    locale: 'de-de',
    url: `https://news.blizzard.com/de-de/api/news/blizzard?feedCxpProductIds%5B%5D=${BLIZZARD_WOW_NEWS_PRODUCT_ID}`
  },
  {
    locale: 'en-gb',
    url: `https://news.blizzard.com/en-gb/api/news/blizzard?feedCxpProductIds%5B%5D=${BLIZZARD_WOW_NEWS_PRODUCT_ID}`
  },
  {
    locale: 'en-us',
    url: `https://news.blizzard.com/en-us/api/news/blizzard?feedCxpProductIds%5B%5D=${BLIZZARD_WOW_NEWS_PRODUCT_ID}`
  }
];

const DEFAULT_TRACKS = [
  {
    id: 'era',
    name: 'Classic Era',
    shortName: 'Era',
    builtIn: true,
    enabled: true,
    live: [{ product: 'wow_classic_era', prefixes: ['1.15'] }],
    ptr: [{ product: 'wow_classic_era_ptr', prefixes: ['1.15'] }]
  },
  {
    id: 'tbc',
    name: 'Classic TBC',
    shortName: 'TBC',
    builtIn: true,
    enabled: true,
    live: [{ product: 'wow_anniversary', prefixes: ['2.5'] }],
    ptr: [{ product: 'wow_classic_era_ptr', prefixes: ['2.5'] }]
  },
  {
    id: 'pandaria',
    name: 'Classic Pandaria',
    shortName: 'Pandaria',
    builtIn: true,
    enabled: true,
    live: [{ product: 'wow_classic', prefixes: ['5.5'] }],
    ptr: [{ product: 'wow_classic_ptr', prefixes: ['5.5'] }]
  },
  {
    id: 'retail',
    name: 'Retail',
    shortName: 'Retail',
    builtIn: true,
    enabled: true,
    live: [{ product: 'wow', prefixes: [] }],
    ptr: [{ product: 'wowt', prefixes: [] }]
  }
];

function cloneDefaultTracks() {
  return JSON.parse(JSON.stringify(DEFAULT_TRACKS));
}

function productsForTracks(tracks, { enabledOnly = true } = {}) {
  const selected = (Array.isArray(tracks) ? tracks : [])
    .filter((track) => !enabledOnly || track.enabled !== false);
  return [...new Set(selected.flatMap((track) =>
    [...(track.live || []), ...(track.ptr || [])]
      .map((candidate) => String(candidate?.product || '').trim())
      .filter(Boolean)
  ))];
}

module.exports = {
  HISTORY_DAYS,
  DEFAULT_REFRESH_MINUTES,
  CLIENTS_PER_PAGE,
  BLIZZTRACK_API,
  BLIZZARD_VERSION_BASE,
  BLIZZARD_WOW_NEWS_PRODUCT_ID,
  NEWS_API_ENDPOINTS,
  DEFAULT_TRACKS,
  cloneDefaultTracks,
  productsForTracks
};
