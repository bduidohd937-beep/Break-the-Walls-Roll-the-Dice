export const STORAGE_KEYS = {
  unlockedStage:"btw-unlocked-stage", kingdomGold:"btw-kingdom-gold", gems:"btw-gems",
  unitLevels:"btw-unit-levels", clearedStages:"btw-cleared-stages", claimedGoals:"btw-claimed-goals",
  deckIds:"btw-deck-ids", kingdomLevel:"btw-kingdom-level", facilityLevels:"btw-facility-levels",
  ownedHeroes:"btw-owned-heroes", resources:"btw-resources", workers:"btw-workers",
  summonStorage:"btw-summon-storage", heroSouls:"btw-hero-souls", soulShards:"btw-soul-shards",
  transcendShards:"btw-transcend-shards", fusionRecords:"btw-fusion-records",
  legendPity:"btw-legend-pity", mythPity:"btw-myth-pity", gatherLastSeen:"btw-gather-last-seen"
} as const;

export const CURRENT_SAVE_VERSION = 1;

// The developer profile keeps its progress under separate keys on the same origin.
const devParam = new URLSearchParams(window.location.search).get("dev");
const isPreviewBuild = import.meta.env.VITE_VERCEL_ENV === "preview";
// Local development defaults to the dev profile; only Vercel Preview accepts ?dev=1.
// Production builds ignore the query parameter so it cannot unlock the dev profile.
export const DEV_MODE = import.meta.env.DEV
  ? devParam !== "0"
  : isPreviewBuild && devParam === "1";
const profileKey = (key:string) => DEV_MODE ? `btw-dev-${key.slice(4)}` : key;

/**
 * Minimal persistence surface so save behavior can be exercised in tests
 * without a real localStorage. The default backend is window.localStorage.
 */
export type SaveStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export type StorageGateway = {
  version: number;
  readNumber: (key: string, fallback?: number) => number;
  readJson: <T>(key: string, fallback: T) => T;
  writeNumber: (key: string, value: number) => void;
  writeJson: <T>(key: string, value: T) => void;
  remove: (key: string) => void;
};

export const createStorageGateway = (backend: SaveStorage, options: { version?: number } = {}): StorageGateway => ({
  version: options.version ?? CURRENT_SAVE_VERSION,
  readNumber: (key, fallback = 0) => {
    const n = Number(backend.getItem(key) ?? String(fallback));
    return Number.isFinite(n) ? n : fallback;
  },
  readJson: <T,>(key: string, fallback: T): T => {
    try {
      const raw = backend.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  writeNumber: (key, value) => backend.setItem(key, String(value)),
  writeJson: <T,>(key: string, value: T) => backend.setItem(key, JSON.stringify(value)),
  remove: (key) => backend.removeItem(key)
});

// The profile prefix is applied before values reach the backend, so the dev
// profile split and every existing localStorage key/format stay identical.
export const defaultStorageGateway = createStorageGateway({
  getItem: (key) => window.localStorage.getItem(profileKey(key)),
  setItem: (key, value) => window.localStorage.setItem(profileKey(key), value),
  removeItem: (key) => window.localStorage.removeItem(profileKey(key))
});

export const loadNumber=(key:string,fallback=0)=>defaultStorageGateway.readNumber(key,fallback);
export const loadJson=<T,>(key:string,fallback:T):T=>defaultStorageGateway.readJson(key,fallback);
export const saveNumber=(key:string,value:number)=>defaultStorageGateway.writeNumber(key,value);
export const saveJson=<T,>(key:string,value:T)=>defaultStorageGateway.writeJson(key,value);
