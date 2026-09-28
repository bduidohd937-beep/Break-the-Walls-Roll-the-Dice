import { useEffect, useRef, useState } from "react";
import { DECK_IDS, HEROES } from "../constants";
import { STORAGE_KEYS, loadJson, saveJson } from "../storage";
import { savedIds } from "../systems/saveData";

export const DECK_SLOT_COUNT = 10;

export function useHeroFormation(ownedHeroes: string[]) {
  const [deckIds, setDeckIds] = useState<string[]>(() => {
    const saved = savedIds(loadJson(STORAGE_KEYS.deckIds, []), undefined, DECK_SLOT_COUNT);
    return saved.length ? saved : DECK_IDS.slice(0, 5);
  });
  const [selectedHeroId, setSelectedHeroId] = useState(DECK_IDS[0]);
  const [heroMode, setHeroMode] = useState<"formation" | "upgrade">("upgrade");
  const [dragHeroId, setDragHeroId] = useState<string | null>(null);
  const [formationPage, setFormationPage] = useState<0 | 1>(0);
  const formationTouchY = useRef<number | null>(null);

  const toggleDeckHero = (id: string) => {
    if (!ownedHeroes.includes(id)) return;
    if (deckIds.includes(id)) {
      if (deckIds.length <= 1) return;
      const next = deckIds.filter((value) => value !== id);
      setDeckIds(next);
      saveJson(STORAGE_KEYS.deckIds, next);
      return;
    }
    if (deckIds.length >= DECK_SLOT_COUNT) return;
    const next = [...deckIds, id];
    setDeckIds(next);
    saveJson(STORAGE_KEYS.deckIds, next);
  };

  const setDeckSlot = (slotIndex: number, heroId: string) => {
    if (!ownedHeroes.includes(heroId)) return;
    if (!deckIds.includes(heroId) && deckIds.length >= DECK_SLOT_COUNT) {
      const next = [...deckIds];
      next[slotIndex] = heroId;
      setDeckIds(next);
      saveJson(STORAGE_KEYS.deckIds, next);
      return;
    }
    const next = deckIds.filter((id) => id !== heroId);
    const displaced = deckIds[slotIndex];
    next.splice(Math.min(slotIndex, next.length), 0, heroId);
    if (displaced && displaced !== heroId && !next.includes(displaced) && next.length < DECK_SLOT_COUNT) next.push(displaced);
    const trimmed = next.slice(0, DECK_SLOT_COUNT);
    setDeckIds(trimmed);
    saveJson(STORAGE_KEYS.deckIds, trimmed);
  };

  const removeDeckSlot = (slotIndex: number) => {
    const next = deckIds.filter((_, index) => index !== slotIndex);
    if (next.length === 0) return;
    setDeckIds(next);
    saveJson(STORAGE_KEYS.deckIds, next);
  };

  useEffect(() => {
    const ownedSet = new Set(ownedHeroes);
    const valid = deckIds.filter((id) => HEROES.some((hero) => hero.id === id) && ownedSet.has(id));
    const next = valid.slice(0, DECK_SLOT_COUNT);
    if (next.length !== deckIds.length || next.some((id, index) => id !== deckIds[index])) {
      setDeckIds(next);
      saveJson(STORAGE_KEYS.deckIds, next);
    }
  }, [ownedHeroes]);

  return {
    deckIds,
    deckSlotCount: DECK_SLOT_COUNT,
    toggleDeckHero,
    setDeckSlot,
    removeDeckSlot,
    selectedHeroId, setSelectedHeroId,
    heroMode, setHeroMode,
    dragHeroId, setDragHeroId,
    formationPage, setFormationPage,
    formationTouchY
  };
}
