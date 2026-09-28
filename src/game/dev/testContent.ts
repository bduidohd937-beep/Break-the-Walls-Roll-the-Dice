import type { UnitDef } from "../types";

const base = (id: string, role: string): UnitDef => ({ id, name: id, sprite: "?", element: "neutral", hp: 1000, atk: 100, speed: 10, range: 20, rangeType: "melee", attackInterval: 1, cost: 0, cooldown: 0, role });
export const TEST_HERO_ROSTER: readonly UnitDef[] = ["common", "rare", "hero", "legendary", "mythical", "transcendent", "unknown"].map((grade) => base(`test_${grade}`, grade));
export const TEST_ENEMY_ROSTER: readonly UnitDef[] = ["basic", "ranged", "status", "elite", "mid_boss", "final_boss"].map((kind) => base(`test_enemy_${kind}`, kind));
export const createTestBattleUnits = (heroCount = 1, enemyCount = 6): UnitDef[] => [
  ...Array.from({ length: heroCount }, (_, index) => ({ ...TEST_HERO_ROSTER[0], id: `test_common_${index}` })),
  ...Array.from({ length: enemyCount }, (_, index) => ({ ...TEST_ENEMY_ROSTER[0], id: `test_enemy_basic_${index}` }))
];
