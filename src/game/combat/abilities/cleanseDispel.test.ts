import { describe, expect, it } from "vitest";
import { executeEffect } from "./effects";
import type { AbilityEffectState, AbilityUnit, EffectDefinition } from "./types";

const unit = (uid: number, team: "hero" | "enemy" = "hero"): AbilityUnit => ({
  id: `unit-${uid}`, name: "Fixture", sprite: "", element: "neutral", hp: 1000, atk: 100, baseAtk: 100,
  def: 20, speed: 10, range: 20, rangeType: "melee", attackInterval: 1, cost: 0, cooldown: 0, role: "fixture",
  uid, team, x: team === "hero" ? 20 : 21, currentHp: 1000, attackTimer: 0, cooldownTimer: 0, hitFlash: 0,
  attackFlash: 0, attackTargetX: 20, knockbackCount: 0, knockbackTimer: 0, knockbackFromX: 20,
  knockbackTargetX: 20, alive: true, burnTimer: 0, burnDamage: 0, slowTimer: 0, slowMultiplier: 1, specialTimer: 0
});

const context = (target: AbilityUnit, caster = unit(1)) => ({ caster, target, statusHandlers: {}, sourceAbilityId: "fixture-ability" });
const apply = (target: AbilityUnit, effect: EffectDefinition, caster = unit(1)) => executeEffect(effect, context(target, caster));

describe("CLEANSE and DISPEL effects", () => {
  it("removes harmful statuses and DOT effects", () => {
    let target = apply(unit(2, "hero"), { type: "APPLY_STATUS", status: "stun", duration: 3 });
    target = apply(target, { type: "APPLY_STATUS", status: "slow", duration: 3, potency: { components: [{ source: "FLAT", coefficient: 0.5 }] } });
    target = apply(target, { type: "DOT", amount: { components: [{ source: "FLAT", coefficient: 10 }] }, duration: 3, interval: 1 });
    const cleansed = apply(target, { type: "CLEANSE", count: 3 });
    expect(cleansed.abilityEffectState).toBeUndefined();
  });

  it("removes beneficial shields and modifiers", () => {
    let target = apply(unit(2, "enemy"), { type: "SHIELD", amount: { components: [{ source: "FLAT", coefficient: 100 }] }, duration: 3 });
    target = apply(target, { type: "STAT_MODIFIER", stat: "ATK", mode: "FLAT", value: { components: [{ source: "FLAT", coefficient: 20 }] }, duration: 3 });
    const dispelled = apply(target, { type: "DISPEL", count: 2 });
    expect(dispelled.abilityEffectState).toBeUndefined();
    expect(dispelled.atk).toBe(100);
  });

  it("removes only the requested number in deterministic priority order", () => {
    let target = apply(unit(2, "enemy"), { type: "SHIELD", amount: { components: [{ source: "FLAT", coefficient: 100 }] }, duration: 3 });
    target = apply(target, { type: "SHIELD", amount: { components: [{ source: "FLAT", coefficient: 50 }] }, duration: 3 });
    const dispelled = apply(target, { type: "DISPEL", count: 1 });
    expect(dispelled.abilityEffectState?.shields).toHaveLength(1);
    expect(dispelled.abilityEffectState?.shields[0].amount).toBe(50);
  });

  it("is safe when there is nothing to remove", () => {
    const target = unit(2);
    expect(apply(target, { type: "CLEANSE", count: 2 })).toEqual(target);
    expect(apply(target, { type: "DISPEL", count: 2 })).toEqual(target);
  });

  it("keeps removal state independent by uid", () => {
    const affected = apply(unit(2), { type: "APPLY_STATUS", status: "stun", duration: 3 });
    const unaffected = unit(3);
    expect(apply(affected, { type: "CLEANSE", count: 1 }).abilityEffectState).toBeUndefined();
    expect(unaffected.abilityEffectState).toBeUndefined();
  });

  it("preserves effects marked non-removable for future immunity rules", () => {
    const target = unit(2, "enemy");
    const state: AbilityEffectState = {
      shields: [{ amount: 100, remaining: 3, removable: false }], statModifiers: [], damageTakenModifiers: [], statuses: [], periodicEffects: []
    };
    const dispelled = apply({ ...target, abilityEffectState: state }, { type: "DISPEL", count: 1 });
    expect(dispelled.abilityEffectState?.shields).toHaveLength(1);
  });
});
