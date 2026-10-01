import { describe, expect, it } from "vitest";
import { BOSS_ENEMY_KEYS, STAGES } from "../stages";
import { HEROES, ENEMIES, ENEMY_MAP } from "../constants";
import { ABILITY_IDS, resolveAbilityDefinitions } from "../combat/abilities/definitions";
import { UNIT_SPRITE_CONFIGS } from "../visuals/sprites";
import { assertValidContent, validateUnitRegistry } from "./validator";
import type { EnemyKey, StageDef, UnitDef } from "../types";

const abilityIds = new Set(Object.values(ABILITY_IDS));
const validateProduction = (
  heroes: readonly UnitDef[] = HEROES,
  enemies: readonly UnitDef[] = ENEMIES,
  stages: readonly StageDef[] = STAGES,
  enemyMap: Readonly<Record<EnemyKey, UnitDef>> = ENEMY_MAP,
  bossEnemyKeys: Readonly<Partial<Record<number, EnemyKey>>> = BOSS_ENEMY_KEYS,
  spriteConfigs: Readonly<typeof UNIT_SPRITE_CONFIGS> = UNIT_SPRITE_CONFIGS,
) => validateUnitRegistry(heroes, enemies, stages, abilityIds, enemyMap, bossEnemyKeys, spriteConfigs);

describe("production content validation", () => {
  it("passes current production references", () => assertValidContent(validateProduction()));

  it("keeps the keyed enemy registry and array API in the existing order", () => {
    expect(ENEMIES).toEqual(Object.values(ENEMY_MAP));
    expect(ENEMIES.map((enemy) => enemy.id)).toEqual([
      "goblinE", "orcE", "darkKnightE", "fireOgreE", "gigantosE", "archerE",
      "fireMageE", "assassinE", "morgarE", "ignisE", "voltrasE", "arcanonE"
    ]);
  });

  it("resolves every production hero ability through the actual ability registry", () => {
    for (const hero of HEROES) {
      const abilityIds = hero.abilityIds ?? [];
      expect(resolveAbilityDefinitions(abilityIds), hero.id).toHaveLength(abilityIds.length);
    }
  });

  it("rejects duplicate ids within and across production unit registries", () => {
    const duplicate = { ...HEROES[0], id: "test_leak" };
    expect(validateProduction([duplicate, duplicate]).map((entry) => entry.message)).toEqual(expect.arrayContaining([
      "duplicate unit id test_leak",
      "test content leaked into production"
    ]));

    const crossRegistryDuplicate = { ...ENEMIES[0] };
    expect(validateProduction([...HEROES, crossRegistryDuplicate]).some((entry) => entry.message === `duplicate unit id ${crossRegistryDuplicate.id}`)).toBe(true);
  });

  it("rejects invalid sprite metadata and bounds", () => {
    const invalid: UnitDef = { ...HEROES[0], id: "invalid", spriteConfig: { frameWidth: 0, frameHeight: 96, scale: 1, pivotX: 2, pivotY: 0, animations: { attack: { asset: "x", frameCount: 2, fps: 10, loop: false, impactFrame: 2 } } }, gameplayBounds: { width: -1, height: 1 } };
    expect(validateProduction([invalid], []).length).toBeGreaterThan(0);
  });

  it("rejects unknown ability and stage-wave references", () => {
    const invalid = { ...HEROES[0], id: "invalid", abilityIds: ["missing"] };
    const invalidStage = { ...STAGES[0], waves: [[{ enemy: "missing" as EnemyKey, count: 1 }]] };
    const issues = validateProduction([invalid], ENEMIES, [invalidStage]);
    expect(issues.some((entry) => entry.message === "unknown ability missing")).toBe(true);
    expect(issues.some((entry) => entry.message === "unknown stage enemy missing")).toBe(true);
  });

  it("rejects missing, duplicate, and orphan enemy mappings", () => {
    const invalidMap = { ...ENEMY_MAP, goblin: ENEMY_MAP.orc } as typeof ENEMY_MAP;
    const issues = validateProduction(HEROES, ENEMIES, [], invalidMap);
    expect(issues.some((entry) => entry.message.includes("duplicate enemy mapping orcE"))).toBe(true);
    expect(issues.some((entry) => entry.message.includes("missing enemy mapping for goblinE"))).toBe(true);

    const orphanMap = { ...ENEMY_MAP, orphan: { ...ENEMIES[0] } } as typeof ENEMY_MAP;
    expect(validateProduction(HEROES, ENEMIES, [], orphanMap).some((entry) => entry.message.includes("unknown enemy definition goblinE"))).toBe(true);
  });

  it("validates boss stage mappings and boss summon references", () => {
    const invalidBossStages: StageDef[] = [
      { ...STAGES[8], bossMechanic: { summonEnemy: "missing" as EnemyKey } }
    ];
    const missingMapping = validateProduction(HEROES, ENEMIES, invalidBossStages, ENEMY_MAP, {});
    expect(missingMapping.some((entry) => entry.message.includes("missing boss enemy mapping for stage 9"))).toBe(true);
    expect(missingMapping.some((entry) => entry.message.includes("unknown summon enemy missing"))).toBe(true);

    const nonBossMapping = validateProduction(HEROES, ENEMIES, [STAGES[0]], ENEMY_MAP, { 1: "goblin" });
    expect(nonBossMapping.some((entry) => entry.message.includes("stage 1 has no boss wave"))).toBe(true);

    const unknownBossEnemy = validateProduction(HEROES, ENEMIES, [STAGES[8]], ENEMY_MAP, { 9: "missing" as EnemyKey });
    expect(unknownBossEnemy.some((entry) => entry.message.includes("unknown boss enemy missing"))).toBe(true);
  });

  it("rejects missing and orphan hero sprite registrations", () => {
    const mismatchedSpriteConfigs = {
      ...UNIT_SPRITE_CONFIGS,
      traineeSword: UNIT_SPRITE_CONFIGS.shield,
      orphan: UNIT_SPRITE_CONFIGS.traineeSword
    };
    const issues = validateProduction(HEROES, ENEMIES, STAGES, ENEMY_MAP, BOSS_ENEMY_KEYS, mismatchedSpriteConfigs);
    expect(issues.some((entry) => entry.message.includes("sprite config does not resolve for traineeSword"))).toBe(true);
    expect(issues.some((entry) => entry.message.includes("unknown hero sprite reference orphan"))).toBe(true);
  });
});
