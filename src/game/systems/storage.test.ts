import { describe, expect, it, vi } from "vitest";

// storage.ts reads window.location at module scope; provide a stub before the import runs.
vi.hoisted(() => {
  (globalThis as unknown as { window: unknown }).window = { location: { search: "" } };
});

import { CURRENT_SAVE_VERSION, STORAGE_KEYS, createStorageGateway, type SaveStorage } from "../storage";
import { savedCounts, savedIds } from "./saveData";

type Store = Map<string, string>;

function memoryStorage(initial: Record<string, string> = {}): { backend: SaveStorage; store: Store } {
  const store: Store = new Map(Object.entries(initial));
  return {
    store,
    backend: {
      getItem: (key) => store.has(key) ? store.get(key)! : null,
      setItem: (key, value) => { store.set(key, value); },
      removeItem: (key) => { store.delete(key); }
    }
  };
}

describe("createStorageGateway", () => {
  it("reports the current save version by default", () => {
    const { backend } = memoryStorage();
    expect(createStorageGateway(backend).version).toBe(CURRENT_SAVE_VERSION);
    expect(CURRENT_SAVE_VERSION).toBe(1);
  });

  it("returns fallbacks for missing values", () => {
    const { backend } = memoryStorage();
    const gateway = createStorageGateway(backend);
    expect(gateway.readNumber(STORAGE_KEYS.kingdomGold)).toBe(0);
    expect(gateway.readNumber(STORAGE_KEYS.kingdomGold, 42)).toBe(42);
    expect(gateway.readJson<string[]>(STORAGE_KEYS.deckIds, [])).toEqual([]);
    expect(gateway.readJson(STORAGE_KEYS.deckIds, { deck: ["traineeSword"] })).toEqual({ deck: ["traineeSword"] });
  });

  it("returns fallbacks for corrupt values instead of throwing", () => {
    const { backend } = memoryStorage({
      [STORAGE_KEYS.gems]: "not-a-number",
      [STORAGE_KEYS.summonStorage]: "{broken json"
    });
    const gateway = createStorageGateway(backend);
    expect(gateway.readNumber(STORAGE_KEYS.gems, 300)).toBe(300);
    expect(gateway.readJson(STORAGE_KEYS.summonStorage, [])).toEqual([]);
  });

  it("roundtrips numbers and JSON payloads", () => {
    const { backend } = memoryStorage();
    const gateway = createStorageGateway(backend);
    gateway.writeNumber(STORAGE_KEYS.unlockedStage, 7);
    gateway.writeJson(STORAGE_KEYS.unitLevels, { traineeSword: 3, shield: 2 });
    expect(gateway.readNumber(STORAGE_KEYS.unlockedStage)).toBe(7);
    expect(backend.getItem(STORAGE_KEYS.unlockedStage)).toBe("7");
    expect(gateway.readJson<Record<string, number>>(STORAGE_KEYS.unitLevels, {})).toEqual({ traineeSword: 3, shield: 2 });
    expect(backend.getItem(STORAGE_KEYS.unitLevels)).toBe(JSON.stringify({ traineeSword: 3, shield: 2 }));
  });

  it("removes keys", () => {
    const { backend } = memoryStorage({ [STORAGE_KEYS.gems]: "100" });
    const gateway = createStorageGateway(backend);
    gateway.remove(STORAGE_KEYS.gems);
    expect(backend.getItem(STORAGE_KEYS.gems)).toBeNull();
    expect(gateway.readNumber(STORAGE_KEYS.gems, 5)).toBe(5);
  });

  it("keeps legacy non-finite number strings falling back", () => {
    const { backend } = memoryStorage({ [STORAGE_KEYS.kingdomGold]: "Infinity" });
    expect(createStorageGateway(backend).readNumber(STORAGE_KEYS.kingdomGold, 10)).toBe(10);
  });
});

describe("legacy save compatibility", () => {
  it("preserves existing localStorage key names", () => {
    expect(STORAGE_KEYS.unlockedStage).toBe("btw-unlocked-stage");
    expect(STORAGE_KEYS.kingdomGold).toBe("btw-kingdom-gold");
    expect(STORAGE_KEYS.gems).toBe("btw-gems");
    expect(STORAGE_KEYS.unitLevels).toBe("btw-unit-levels");
    expect(STORAGE_KEYS.clearedStages).toBe("btw-cleared-stages");
    expect(STORAGE_KEYS.claimedGoals).toBe("btw-claimed-goals");
    expect(STORAGE_KEYS.deckIds).toBe("btw-deck-ids");
    expect(STORAGE_KEYS.kingdomLevel).toBe("btw-kingdom-level");
    expect(STORAGE_KEYS.facilityLevels).toBe("btw-facility-levels");
    expect(STORAGE_KEYS.ownedHeroes).toBe("btw-owned-heroes");
    expect(STORAGE_KEYS.summonStorage).toBe("btw-summon-storage");
    expect(STORAGE_KEYS.legendPity).toBe("btw-legend-pity");
  });

  it("routes saves through the same sanitizers as existing profiles", () => {
    // A pre-existing save blob written by earlier builds, including removed hero ids.
    const legacyOwned = '["serentia","traineeSword","shield"]';
    const legacyLevels = '{"serentia":30,"traineeSword":3,"shield":4}';
    const gateway = createStorageGateway(memoryStorage({
      [STORAGE_KEYS.ownedHeroes]: legacyOwned,
      [STORAGE_KEYS.unitLevels]: legacyLevels
    }).backend);

    const owned = savedIds(gateway.readJson<string[]>(STORAGE_KEYS.ownedHeroes, []));
    const levels = savedCounts(gateway.readJson<Record<string, number>>(STORAGE_KEYS.unitLevels, {}), 10);
    expect(owned).toEqual(["traineeSword", "shield"]);
    expect(levels).toEqual({ traineeSword: 3, shield: 4 });
  });
});
