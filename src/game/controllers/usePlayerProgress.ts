import { useEffect, useState } from "react";
import { HEROES, INITIAL_GEMS, clamp } from "../constants";
import { STAGES } from "../stages";
import { DEV_MODE, STORAGE_KEYS, loadJson, loadNumber, saveJson, saveNumber } from "../storage";
import { savedClears, savedCounts, savedIds } from "../systems/saveData";

const CLAIMABLE_GOAL_IDS = new Set([
  "first-clear",
  "gather-start",
  "kingdom-2",
  "hero-roster",
  "hero-growth",
  "facility-growth",
  "stage-10",
  "morgar"
]);

export function usePlayerProgress() {
  const [unlockedStage, setUnlockedStage] = useState(() => {
    const saved = loadNumber(STORAGE_KEYS.unlockedStage, 1);
    return DEV_MODE ? STAGES.length : clamp(Math.floor(saved) || 1, 1, STAGES.length);
  });
  const [kingdomGold, setKingdomGold] = useState(() => Math.max(0, loadNumber(STORAGE_KEYS.kingdomGold, DEV_MODE ? 99999999 : 0)));
  const [gems, setGems] = useState(() => Math.max(0, loadNumber(STORAGE_KEYS.gems, DEV_MODE ? 99999999 : INITIAL_GEMS)));
  const [unitLevels, setUnitLevels] = useState<Record<string, number>>(() => {
    const saved = loadJson<Record<string, number>>(STORAGE_KEYS.unitLevels, {});
    return DEV_MODE ? Object.fromEntries(HEROES.map((hero) => [hero.id, 10])) : savedCounts(saved, 10);
  });
  const [clearedStages, setClearedStages] = useState<number[]>(() => savedClears(loadJson(STORAGE_KEYS.clearedStages, [])));
  const [claimedGoals, setClaimedGoals] = useState<string[]>(() => savedIds(loadJson(STORAGE_KEYS.claimedGoals, []), CLAIMABLE_GOAL_IDS));

  useEffect(() => { saveNumber(STORAGE_KEYS.unlockedStage, unlockedStage); }, [unlockedStage]);
  useEffect(() => { saveNumber(STORAGE_KEYS.kingdomGold, kingdomGold); }, [kingdomGold]);
  useEffect(() => { saveNumber(STORAGE_KEYS.gems, gems); }, [gems]);
  useEffect(() => { saveJson(STORAGE_KEYS.unitLevels, unitLevels); }, [unitLevels]);
  useEffect(() => { saveJson(STORAGE_KEYS.clearedStages, clearedStages); }, [clearedStages]);
  useEffect(() => { saveJson(STORAGE_KEYS.claimedGoals, claimedGoals); }, [claimedGoals]);

  return {
    unlockedStage, setUnlockedStage,
    kingdomGold, setKingdomGold,
    gems, setGems,
    unitLevels, setUnitLevels,
    clearedStages, setClearedStages,
    claimedGoals, setClaimedGoals
  };
}
