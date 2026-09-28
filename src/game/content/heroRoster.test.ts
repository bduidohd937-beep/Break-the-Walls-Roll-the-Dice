import { describe, expect, it } from "vitest";
import { DECK_IDS, GRANTED_HERO_IDS, HEROES } from "../constants";
import { savedCounts, savedIds, savedSummons } from "../systems/saveData";

const productionHeroIds = ["traineeSword", "shield", "HERO_003"];

describe("production hero roster", () => {
  it("contains only the current production heroes", () => {
    expect(HEROES.map((hero) => hero.id)).toEqual(productionHeroIds);
    expect(DECK_IDS).toEqual(productionHeroIds);
    expect(GRANTED_HERO_IDS).toEqual(productionHeroIds);
  });

  it("drops removed hero ids from legacy saves", () => {
    expect(savedIds(["serentia", "traineeSword", "shield", "assassin"])).toEqual(["traineeSword", "shield"]);
    expect(savedCounts({ serentia: 30, traineeSword: 3, shield: 4 }, 30)).toEqual({ traineeSword: 3, shield: 4 });
    expect(savedSummons([
      { uid: 1, heroId: "serentia", grade: "전설" },
      { uid: 2, heroId: "shield", grade: "일반" },
    ])).toEqual([{ uid: 2, heroId: "shield", grade: "일반" }]);
  });
});
