import { describe, expect, it } from "vitest";
import { advanceAbilityEffectDurations, effectiveMoveSpeed, executeEffect, hasAbilityStatus } from "./effects";
import type { AbilityUnit } from "./types";

const unit = (overrides: Partial<AbilityUnit> = {}): AbilityUnit => ({
  id: "fixture", name: "Fixture", sprite: "", element: "neutral", hp: 1000, atk: 100, baseAtk: 100,
  def: 20, speed: 10, range: 20, rangeType: "melee", attackInterval: 1, cost: 0, cooldown: 0, role: "fixture",
  uid: 1, team: "hero", x: 20, currentHp: 1000, attackTimer: 0, cooldownTimer: 0, hitFlash: 0,
  attackFlash: 0, attackTargetX: 20, knockbackCount: 0, knockbackTimer: 0, knockbackFromX: 20,
  knockbackTargetX: 20, alive: true, burnTimer: 0, burnDamage: 0, slowTimer: 0, slowMultiplier: 1,
  specialTimer: 0, ...overrides
});

const apply = (status: "stun" | "slow", caster = unit(), target = unit({ uid: 2, team: "enemy" }), duration = 2, potency = 0.7) => executeEffect({
  type: "APPLY_STATUS", status, duration, potency: { components: [{ source: "FLAT", coefficient: potency }] }
}, { caster, target, statusHandlers: {} }, undefined);

describe("common status framework", () => {
  it("blocks behavior while stunned and resumes after duration", () => {
    const stunned = apply("stun");
    expect(hasAbilityStatus(stunned, "STUN")).toBe(true);
    expect(hasAbilityStatus(advanceAbilityEffectDurations(stunned, 2), "STUN")).toBe(false);
  });

  it("keeps the longer stun duration on reapplication", () => {
    const first = apply("stun", unit(), unit({ uid: 2 }), 3);
    const second = apply("stun", unit({ uid: 3 }), first, 1);
    expect(second.abilityEffectState?.statuses[0].remaining).toBe(3);
  });

  it("slows movement temporarily and uses the strongest slow", () => {
    const first = apply("slow", unit(), unit({ uid: 2 }), 3, 0.7);
    const second = apply("slow", unit({ uid: 3 }), first, 3, 0.4);
    expect(effectiveMoveSpeed(second)).toBe(4);
    expect(effectiveMoveSpeed(advanceAbilityEffectDurations(second, 3))).toBe(10);
  });

  it("keeps statuses independent by target uid", () => {
    const affected = apply("slow", unit(), unit({ uid: 2 }));
    const unaffected = unit({ uid: 3 });
    expect(effectiveMoveSpeed(affected)).toBe(7);
    expect(effectiveMoveSpeed(unaffected)).toBe(10);
  });
});
