import { describe, expect, it } from "vitest";
import type { AbilityUnit } from "./types";
import type { Unit } from "../../types";
import { ENEMIES, ENEMY_MAP } from "../../constants";
import { ABILITY_IDS, DARK_KNIGHT_WAR_CRY, resolveAbilityDefinitions } from "./definitions";
import { createCombatAbilityIntegration } from "./integration";
import { registerEnemyAbilities } from "../../controllers/useBattleLoop";

let nextEventId = -1;
const tick = (deltaSeconds: number) => ({
  type: "SIMULATION_TICK" as const,
  eventId: nextEventId--,
  origin: "SYSTEM" as const,
  deltaSeconds
});
const unit = (uid: number, overrides: Partial<Unit> = {}): AbilityUnit => ({
  id: "darkKnightE", name: "다크 나이트", sprite: "", element: "dark", hp: 520, atk: 82, baseAtk: 82,
  speed: 28, range: 42, rangeType: "melee", attackInterval: 1.5, cost: 0, cooldown: 0, role: "엘리트",
  uid, team: "enemy", x: 40, currentHp: 520, attackTimer: 0, cooldownTimer: 0, hitFlash: 0, attackFlash: 0,
  attackTargetX: 40, knockbackCount: 0, knockbackTimer: 0, knockbackFromX: 40, knockbackTargetX: 40,
  alive: true, burnTimer: 0, burnDamage: 0, slowTimer: 0, slowMultiplier: 1, specialTimer: 0, ...overrides
});

// PROVISIONAL VERIFICATION CONTENT tests: darkKnightWarCry exists only to prove
// the Enemy Ability pipeline end-to-end. It is NOT a finalized Chapter 1
// enemy-content decision, and these tests verify pipeline mechanics, not skill design.

describe("enemy ability registration sweep", () => {
  it("registers an enemy's resolved abilities exactly once", () => {
    const integration = createCombatAbilityIntegration([]);
    const registered = new Set<number>();
    const enemy = unit(1, { abilityIds: [ABILITY_IDS.darkKnightWarCry] });

    registerEnemyAbilities(integration, [enemy], registered);
    registerEnemyAbilities(integration, [enemy], registered);

    expect(integration.hasAbilities()).toBe(true);
    const result = integration.publish(tick(DARK_KNIGHT_WAR_CRY.intervalSeconds), [enemy]);
    // Idempotent sweep: a double registration would fire the buff twice per window.
    expect(result.units.find((entry) => entry.uid === 1)?.atk).toBeCloseTo(82 * (1 + DARK_KNIGHT_WAR_CRY.atkPercent), 10);
  });

  it("skips enemies without abilityIds", () => {
    const integration = createCombatAbilityIntegration([]);
    registerEnemyAbilities(integration, [unit(1)], new Set());
    expect(integration.hasAbilities()).toBe(false);
  });

  it("stops activating after cleanup removes a dead enemy's bindings", () => {
    const integration = createCombatAbilityIntegration([]);
    const registered = new Set<number>();
    const enemy = unit(1, { abilityIds: [ABILITY_IDS.darkKnightWarCry] });
    registerEnemyAbilities(integration, [enemy], registered);

    integration.cleanup(new Set<number>()); // dead enemy: uid not in the living set
    const result = integration.publish(tick(DARK_KNIGHT_WAR_CRY.intervalSeconds), [enemy]);
    expect(result.activationCount).toBe(0);
    expect(result.units.find((entry) => entry.uid === 1)?.atk).toBe(82);
  });
});

describe("production enemy ability content (provisional verification)", () => {
  it("resolves every production enemy's abilityIds through the actual registry", () => {
    for (const enemy of ENEMIES) {
      const ids = enemy.abilityIds ?? [];
      expect(resolveAbilityDefinitions(ids), enemy.id).toHaveLength(ids.length);
    }
  });

  it("attaches the provisional war cry to the dark knight and no other enemy", () => {
    expect(ENEMY_MAP.darkKnight.abilityIds).toEqual([ABILITY_IDS.darkKnightWarCry]);
    expect(ENEMIES.filter((enemy) => enemy.abilityIds?.length)).toHaveLength(1);
  });
});
