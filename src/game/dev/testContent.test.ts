import { describe, expect, it } from "vitest";
import { TEST_ENEMY_ROSTER, TEST_HERO_ROSTER, createTestBattleUnits } from "./testContent";

describe("test content sandbox", () => {
  it("keeps dev rosters namespaced and separate", () => {
    expect(TEST_HERO_ROSTER).toHaveLength(7);
    expect(TEST_ENEMY_ROSTER).toHaveLength(6);
    expect(TEST_HERO_ROSTER.every((unit) => unit.id.startsWith("test_"))).toBe(true);
    expect(TEST_ENEMY_ROSTER.every((unit) => unit.id.startsWith("test_"))).toBe(true);
  });
  it("creates and cleans a 50-unit scenario without shared definitions", () => {
    const units = createTestBattleUnits(30, 20);
    expect(units).toHaveLength(50);
    expect(new Set(units.map((unit) => unit.id)).size).toBe(50);
  });
});
