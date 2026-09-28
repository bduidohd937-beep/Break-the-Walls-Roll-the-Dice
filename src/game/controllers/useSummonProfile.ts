import { useRef, useState } from "react";
import { HEROES } from "../constants";
import { DEV_MODE, STORAGE_KEYS, loadJson, loadNumber } from "../storage";
import { savedCounts, savedIds, savedSummons } from "../systems/saveData";
import type { SummonStorageItem } from "../systems/summon";

const FUSION_RECORD_IDS = new Set(["unknown-01", "unknown-02", "devWukong"]);

export function useSummonProfile() {
  const [summonStorage, setSummonStorage] = useState<SummonStorageItem[]>(() => {
    const saved = loadJson<SummonStorageItem[]>(STORAGE_KEYS.summonStorage, []);
    return savedSummons(saved);
  });
  const [heroSouls, setHeroSouls] = useState<Record<string, number>>(() => {
    const saved = loadJson<Record<string, number>>(STORAGE_KEYS.heroSouls, {});
    return DEV_MODE ? Object.fromEntries(HEROES.map((hero) => [hero.id, 30])) : savedCounts(saved, 30);
  });
  const [soulShards, setSoulShards] = useState(() => Math.max(0, loadNumber(STORAGE_KEYS.soulShards, DEV_MODE ? 999999 : 0)));
  const [transcendShards, setTranscendShards] = useState(() => Math.max(0, loadNumber(STORAGE_KEYS.transcendShards, DEV_MODE ? 999999 : 0)));
  const [fusionRecords, setFusionRecords] = useState<string[]>(() => {
    const saved = loadJson<string[]>(STORAGE_KEYS.fusionRecords, []);
    return savedIds(saved, FUSION_RECORD_IDS);
  });
  const summonUidRef = useRef(Math.max(Date.now(), ...summonStorage.map((item) => item.uid + 1)));
  const [legendPity, setLegendPity] = useState(() => Math.max(0, loadNumber(STORAGE_KEYS.legendPity, 0)));
  const [mythPity, setMythPity] = useState(() => Math.max(0, loadNumber(STORAGE_KEYS.mythPity, 0)));

  return {
    summonStorage, setSummonStorage,
    heroSouls, setHeroSouls,
    soulShards, setSoulShards,
    transcendShards, setTranscendShards,
    fusionRecords, setFusionRecords,
    summonUidRef,
    legendPity, setLegendPity,
    mythPity, setMythPity
  };
}
