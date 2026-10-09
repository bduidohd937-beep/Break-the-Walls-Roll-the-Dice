import { describe, expect, it } from "vitest";
import { getBattleEconomy } from "./battleEconomy";
import { STAGES } from "../stages";

describe("battle start economy", () => {
  it("starts at zero Battle Gold regardless of vault or economy level", () => {
    for (const vaultLevel of [1, 2, 10, 50]) {
      for (const economyLevel of [1, 4, 8]) {
        expect(getBattleEconomy(economyLevel, vaultLevel, 1).battleStartGold).toBe(0);
      }
    }
  });

  it("preserves the initial income and first upgrade cost", () => {
    const economy = getBattleEconomy(1, 1, 1);
    expect(economy.goldPerSecond).toBe(18);
    expect(economy.economyUpgradeCost).toBe(120);
  });
});

describe("stage 1-3 baseline", () => {
  it("retains five waves and 34 enemies per stage", () => {
    for (const stage of STAGES.slice(0, 3)) {
      expect(stage.waves).toHaveLength(5);
      const enemyCount = stage.waves.flat().reduce((sum, group) => sum + group.count, 0);
      expect(enemyCount).toBe(34);
    }
  });

  it("introduces one dark knight only in stage 3 final wave", () => {
    for (const stage of STAGES.slice(0, 2)) {
      expect(stage.waves.flat().some((group) => group.enemy === "darkKnight")).toBe(false);
    }
    const stageThree = STAGES[2];
    expect(stageThree.waves.slice(0, 4).flat().some((group) => group.enemy === "darkKnight")).toBe(false);
    expect(stageThree.waves[4].filter((group) => group.enemy === "darkKnight")).toEqual([
      { enemy: "darkKnight", count: 1, gap: 1.5 }
    ]);
  });
});
