import { useEffect, useState } from "react";
import { DECK_IDS, GRANTED_HERO_IDS } from "../constants";
import { DEV_MODE, STORAGE_KEYS, loadJson, loadNumber, saveJson } from "../storage";
import type { ResourceType } from "../systems/gathering";
import type { FacilityKey } from "../systems/kingdom";
import { savedIds, savedNonnegative } from "../systems/saveData";

type FacilityLevels = Record<FacilityKey, number>;
type Resources = Record<ResourceType, number>;
type Workers = Partial<Record<ResourceType, string>>;

const DEV_FACILITY_LEVEL = 10;

export function useKingdomProfile() {
  const [kingdomLevel, setKingdomLevel] = useState(() => Math.max(1, Math.floor(loadNumber(STORAGE_KEYS.kingdomLevel, DEV_MODE ? 6 : 1))));
  const [facilityLevels, setFacilityLevels] = useState<FacilityLevels>(() => {
    const saved = loadJson<Record<string, number>>(STORAGE_KEYS.facilityLevels, {});
    const initial = DEV_MODE ? DEV_FACILITY_LEVEL : 1;
    return {
      lumber: Math.max(1, Math.floor(savedNonnegative(saved?.lumber, initial))),
      quarry: Math.max(1, Math.floor(savedNonnegative(saved?.quarry, initial))),
      vault: Math.max(1, Math.floor(savedNonnegative(saved?.vault, initial))),
      training: Math.max(1, Math.floor(savedNonnegative(saved?.training, initial)))
    };
  });
  const [ownedHeroes, setOwnedHeroes] = useState<string[]>(() => {
    const saved = savedIds(loadJson(STORAGE_KEYS.ownedHeroes, []));
    const initial = DEV_MODE ? DECK_IDS : saved.length ? saved : DECK_IDS.slice(0, 5);
    return [...new Set([...initial, ...GRANTED_HERO_IDS])];
  });
  const [resources, setResources] = useState<Resources>(() => {
    const saved = loadJson<Record<string, number>>(STORAGE_KEYS.resources, {});
    return { wood: savedNonnegative(saved?.wood), stone: savedNonnegative(saved?.stone) };
  });
  const [workers, setWorkers] = useState<Workers>(() => {
    const saved = loadJson<Record<string, string>>(STORAGE_KEYS.workers, {});
    return {
      wood: typeof saved?.wood === "string" && ownedHeroes.includes(saved.wood) ? saved.wood : undefined,
      stone: typeof saved?.stone === "string" && ownedHeroes.includes(saved.stone) && saved.stone !== saved?.wood ? saved.stone : undefined
    };
  });

  useEffect(() => { saveJson(STORAGE_KEYS.resources, resources); }, [resources]);

  return {
    kingdomLevel, setKingdomLevel,
    facilityLevels, setFacilityLevels,
    ownedHeroes, setOwnedHeroes,
    resources, setResources,
    workers, setWorkers
  };
}
