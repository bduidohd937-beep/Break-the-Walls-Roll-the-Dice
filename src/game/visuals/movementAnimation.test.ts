import { describe, expect, it } from "vitest";
import type { AbilityUnit } from "../combat/abilities/types";
import { getMovementAnimationRate, spriteAnimationDuration } from "./movementAnimation";

const unit = (overrides: Partial<AbilityUnit> = {}): AbilityUnit => ({
  id: "fixture", name: "Fixture", sprite: "", element: "neutral", hp: 100, atk: 10, baseAtk: 10,
  def: 0, speed: 40, range: 20, rangeType: "melee", attackInterval: 1, cost: 0, cooldown: 0, role: "fixture",
  uid: 1, team: "hero", x: 10, currentHp: 100, attackTimer: 0, cooldownTimer: 0, hitFlash: 0, attackFlash: 0,
  attackTargetX: 10, knockbackCount: 0, knockbackTimer: 0, knockbackFromX: 10, knockbackTargetX: 10,
  alive: true, burnTimer: 0, burnDamage: 0, slowTimer: 0, slowMultiplier: 1, specialTimer: 0, ...overrides
});

describe("movement animation presentation", () => {
  it("keeps the authored cadence at base movement speed and follows slow effects", () => {
    const slowed = unit({ abilityEffectState: {
      shields: [], statModifiers: [], damageTakenModifiers: [], statuses: [{ id: "SLOW", sourceUid: 9, potency: 0.5, remaining: 2 }],
      periodicEffects: [], attackSpeedModifiers: [], moveSpeedModifiers: [], damageDealtModifiers: [], cooldownModifiers: [], baseStats: { atk: 10, def: 0, attackInterval: 1, speed: 40 }
    } });
    const before = { speed: slowed.speed, x: slowed.x };

    expect(getMovementAnimationRate(unit())).toBe(1);
    expect(getMovementAnimationRate(slowed)).toBe(0.5);
    expect({ speed: slowed.speed, x: slowed.x }).toEqual(before);
  });

  it("follows legacy enemy slow and generic movement buffs", () => {
    const slowedEnemy = unit({ team: "enemy", slowTimer: 1, slowMultiplier: 0.4 });
    const hasted = unit({ abilityEffectState: {
      shields: [], statModifiers: [], damageTakenModifiers: [], statuses: [], periodicEffects: [], attackSpeedModifiers: [],
      moveSpeedModifiers: [{ mode: "PERCENT", value: 0.5, remaining: 2 }], damageDealtModifiers: [], cooldownModifiers: [],
      baseStats: { atk: 10, def: 0, attackInterval: 1, speed: 40 }
    } });

    expect(getMovementAnimationRate(slowedEnemy)).toBe(0.4);
    expect(getMovementAnimationRate(hasted)).toBe(1.5);
  });

  it("keeps animation visual timing proportional at 1x and 5x", () => {
    expect(spriteAnimationDuration(6, 10, 1)).toBeCloseTo(0.6);
    expect(spriteAnimationDuration(6, 10, 5)).toBeCloseTo(0.12);
    expect(spriteAnimationDuration(6, 10, 5, 0.5)).toBeCloseTo(0.24);
  });
});
