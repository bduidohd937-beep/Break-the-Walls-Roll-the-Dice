export const STORAGE_KEYS = {
  unlockedStage:"btw-unlocked-stage", kingdomGold:"btw-kingdom-gold", gems:"btw-gems",
  unitLevels:"btw-unit-levels", clearedStages:"btw-cleared-stages", claimedGoals:"btw-claimed-goals",
  deckIds:"btw-deck-ids", kingdomLevel:"btw-kingdom-level", facilityLevels:"btw-facility-levels",
  ownedHeroes:"btw-owned-heroes", resources:"btw-resources", workers:"btw-workers",
  summonStorage:"btw-summon-storage", heroSouls:"btw-hero-souls", soulShards:"btw-soul-shards",
  transcendShards:"btw-transcend-shards", fusionRecords:"btw-fusion-records",
  legendPity:"btw-legend-pity", mythPity:"btw-myth-pity", gatherLastSeen:"btw-gather-last-seen"
} as const;

// The developer profile keeps its progress under separate keys on the same origin.
const devParam = new URLSearchParams(window.location.search).get("dev");
export const DEV_MODE = devParam === "1" || (import.meta.env.DEV && devParam !== "0");
const profileKey = (key:string) => DEV_MODE ? `btw-dev-${key.slice(4)}` : key;

export const loadNumber=(key:string,fallback=0)=>{const n=Number(window.localStorage.getItem(profileKey(key))??String(fallback));return Number.isFinite(n)?n:fallback};
export const loadJson=<T,>(key:string,fallback:T):T=>{try{const raw=window.localStorage.getItem(profileKey(key));if(raw==null)return fallback;return JSON.parse(raw) as T}catch{return fallback}};
export const saveNumber=(key:string,value:number)=>window.localStorage.setItem(profileKey(key),String(value));
export const saveJson=<T,>(key:string,value:T)=>window.localStorage.setItem(profileKey(key),JSON.stringify(value));
