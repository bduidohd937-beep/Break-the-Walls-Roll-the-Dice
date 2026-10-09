import { describe, expect, it } from "vitest";
import { getBattleEconomy, WALLET_CAPACITY_BY_LEVEL, VAULT_CAPACITY_PER_LEVEL } from "./battleEconomy";
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

describe("V0.2 temporary wallet capacity playtest", () => {
  it("starts at 300 Gold capacity, enough for all three initial heroes", () => {
    const economy = getBattleEconomy(1, 1, 1);
    expect(economy.battleGoldMax).toBe(300);
    expect(economy.battleGoldMax).toBeGreaterThanOrEqual(180);
  });

  it("increases capacity across wallet levels without altering production", () => {
    const production = [18, 27, 36, 45, 54, 63, 72, 81];
    for (let level = 1; level <= WALLET_CAPACITY_BY_LEVEL.length; level++) {
      const economy = getBattleEconomy(level, 1, 1);
      expect(economy.battleGoldMax).toBe(WALLET_CAPACITY_BY_LEVEL[level - 1]);
      expect(economy.goldPerSecond).toBe(production[level - 1]);
    }
  });

  it("adds 150 Gold capacity per vault level without granting starting Gold", () => {
    expect(VAULT_CAPACITY_PER_LEVEL).toBe(150);
    for (const vault of [1, 2, 5, 10]) {
      const economy = getBattleEconomy(1, vault, 1);
      expect(economy.battleGoldMax).toBe(300 + (vault - 1) * 150);
      expect(economy.battleStartGold).toBe(0);
    }
  });

  it("retains enough capacity for economy upgrades and initial hero deployment", () => {
    const initialCosts = [150, 160, 180];
    for (let level = 1; level <= 8; level++) {
      const economy = getBattleEconomy(level, 1, 1);
      expect(economy.battleGoldMax).toBeGreaterThanOrEqual(Math.max(...initialCosts));
      if (level < 8) expect(economy.battleGoldMax).toBeGreaterThanOrEqual(economy.economyUpgradeCost);
    }
  });
});
