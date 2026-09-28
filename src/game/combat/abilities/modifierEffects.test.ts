import { describe, expect, it } from "vitest";
import { advanceAbilityEffectDurations, effectiveMoveSpeed, executeEffect, resolveAbilityDamage } from "./effects";
import { createAbilityRuntime } from "./runtime";
import type { AbilityUnit } from "./types";

const unit = (uid: number, team: "hero" | "enemy" = "hero"): AbilityUnit => ({
  id: `unit-${uid}`, name: "Fixture", sprite: "", element: "neutral", hp: 1000, atk: 100, baseAtk: 100, def: 20,
  speed: 10, range: 20, rangeType: "melee", attackInterval: 1, cost: 0, cooldown: 0, role: "fixture", uid, team, x: 20,
  currentHp: 1000, attackTimer: 0, cooldownTimer: 0, hitFlash: 0, attackFlash: 0, attackTargetX: 20, knockbackCount: 0,
  knockbackTimer: 0, knockbackFromX: 20, knockbackTargetX: 20, alive: true, burnTimer: 0, burnDamage: 0, slowTimer: 0,
  slowMultiplier: 1, specialTimer: 0
});
const flat = (value: number) => ({ components: [{ source: "FLAT" as const, coefficient: value }] });
const apply = (target: AbilityUnit, effect: Parameters<typeof executeEffect>[0], caster = unit(1)) => executeEffect(effect, { caster, target, statusHandlers: {} });

describe("common modifier effects", () => {
  it("modifies attack speed and restores it after expiry", () => {
    const modified = apply(unit(2), { type: "ATTACK_SPEED_MODIFIER", mode: "PERCENT", value: flat(1), duration: 2 });
    expect(modified.attackInterval).toBe(0.5);
    expect(advanceAbilityEffectDurations(modified, 2).attackInterval).toBe(1);
  });
  it("modifies movement speed and composes with SLOW", () => {
    let modified = apply(unit(2), { type: "MOVE_SPEED_MODIFIER", mode: "PERCENT", value: flat(-0.5), duration: 2 });
    modified = apply(modified, { type: "APPLY_STATUS", status: "slow", duration: 2, potency: flat(0.5) });
    expect(effectiveMoveSpeed(modified)).toBe(2.5);
    expect(effectiveMoveSpeed(advanceAbilityEffectDurations(modified, 2))).toBe(10);
  });
  it("applies dealt and taken damage modifiers in the same pipeline", () => {
    const source = apply(unit(1), { type: "DAMAGE_DEALT_MODIFIER", multiplier: 1.5, duration: 2 });
    const target = apply(unit(2, "enemy"), { type: "DAMAGE_TAKEN_MODIFIER", multiplier: 0.5, duration: 2 });
    expect(resolveAbilityDamage(target, 100, source).hpDamage).toBe(75);
  });
  it("supports cooldown increase and decrease through interval simulation", () => {
    const ability = { id: "interval", trigger: { type: "ON_INTERVAL" as const, intervalSeconds: 1 }, target: { type: "SELF" as const }, effects: [] };
    const runtime = createAbilityRuntime([{ ownerUid: 1, ability }]);
    let units = [unit(1)];
    expect(runtime.dispatch({ type: "ON_INTERVAL", elapsedSeconds: 0.5 }, { units }).activations).toHaveLength(0);
    const hasted = apply(units[0], { type: "COOLDOWN_MODIFIER", multiplier: 0.5, duration: 3 });
    units = [hasted];
    expect(runtime.dispatch({ type: "ON_INTERVAL", elapsedSeconds: 0.5 }, { units }).activations).toHaveLength(1);
  });
  it("keeps modifier state independent by uid", () => {
    const affected = apply(unit(2), { type: "MOVE_SPEED_MODIFIER", mode: "FLAT", value: flat(5), duration: 2 });
    expect(effectiveMoveSpeed(affected)).toBe(15);
    expect(effectiveMoveSpeed(unit(3))).toBe(10);
  });
  it("stacks duplicate effects and expires them independently", () => {
    let modified = apply(unit(2), { type: "DAMAGE_DEALT_MODIFIER", multiplier: 1.2, duration: 1 });
    modified = apply(modified, { type: "DAMAGE_DEALT_MODIFIER", multiplier: 1.5, duration: 3 });
    expect(resolveAbilityDamage(unit(3, "enemy"), 100, modified).hpDamage).toBeCloseTo(180);
    const after = advanceAbilityEffectDurations(modified, 1);
    expect(resolveAbilityDamage(unit(3, "enemy"), 100, after).hpDamage).toBe(150);
  });
});
