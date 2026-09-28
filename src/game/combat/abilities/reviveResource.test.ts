import { describe, expect, it } from "vitest";
import { executeEffect } from "./effects";
import { createAbilityRuntime } from "./runtime";
import type { AbilityUnit } from "./types";

const unit = (uid: number, currentHp = 1000): AbilityUnit => ({
  id: `unit-${uid}`, name: "Fixture", sprite: "", element: "neutral", hp: 1000, atk: 100, baseAtk: 100, def: 20,
  speed: 10, range: 20, rangeType: "melee", attackInterval: 1, cost: 0, cooldown: 0, role: "fixture", uid, team: "hero",
  x: 20, currentHp, attackTimer: 0.4, cooldownTimer: 0, hitFlash: 0, attackFlash: 0, attackTargetX: 20, knockbackCount: 0,
  knockbackTimer: 0, knockbackFromX: 20, knockbackTargetX: 20, alive: currentHp > 0, burnTimer: 2, burnDamage: 10,
  slowTimer: 2, slowMultiplier: 0.5, specialTimer: 0
});

describe("REVIVE and RESOURCE_CHANGE effects", () => {
  it("revives a defeated unit using scaling and clears death residue", () => {
    const target = unit(2, 0);
    const revived = executeEffect({ type: "REVIVE", amount: { components: [{ source: "TARGET_MAX_HP", coefficient: 0.25 }] } }, { caster: unit(1), target, statusHandlers: {} });
    expect(revived).toMatchObject({ currentHp: 250, alive: true, burnTimer: 0, slowTimer: 0, knockbackTimer: 0, attackTimer: 0 });
    expect(revived.abilityEffectState).toBeUndefined();
  });

  it("does not alter a living target and clamps revive hp to max hp", () => {
    const living = unit(2, 500);
    expect(executeEffect({ type: "REVIVE", amount: { components: [{ source: "FLAT", coefficient: 2000 }] } }, { caster: unit(1), target: living, statusHandlers: {} })).toEqual(living);
    expect(executeEffect({ type: "REVIVE", amount: { components: [{ source: "FLAT", coefficient: 2000 }] } }, { caster: unit(1), target: unit(2, 0), statusHandlers: {} }).currentHp).toBe(1000);
  });

  it("restores a revived unit to the ordinary BattleUnit flow", () => {
    const runtime = createAbilityRuntime([{ ownerUid: 1, ability: { id: "revive", trigger: { type: "ON_DEPLOY" }, target: { type: "DEAD_ALLY" }, effects: [{ type: "REVIVE", amount: { components: [{ source: "FLAT", coefficient: 100 }] } }] } }]);
    const result = runtime.dispatch({ type: "ON_DEPLOY", casterUid: 1 }, { units: [unit(1), unit(2, 0)] });
    expect(result.units.find((entry) => entry.uid === 2)).toMatchObject({ currentHp: 100, alive: true });
  });

  it("emits positive and negative Battle Gold changes through the resource result", () => {
    const runtime = createAbilityRuntime([
      { ownerUid: 1, ability: { id: "gain", trigger: { type: "ON_DEPLOY" }, target: { type: "SELF" }, effects: [{ type: "RESOURCE_CHANGE", resource: "BATTLE_GOLD", amount: { components: [{ source: "FLAT", coefficient: 50 }] } }] } },
      { ownerUid: 1, ability: { id: "spend", trigger: { type: "ON_ATTACK" }, target: { type: "SELF" }, effects: [{ type: "RESOURCE_CHANGE", resource: "BATTLE_GOLD", amount: { components: [{ source: "FLAT", coefficient: -20 }] } }] } }
    ]);
    expect(runtime.dispatch({ type: "ON_DEPLOY", casterUid: 1 }, { units: [unit(1)] }).resourceChanges).toMatchObject([{ resource: "BATTLE_GOLD", amount: 50 }]);
    expect(runtime.dispatch({ type: "ON_ATTACK", casterUid: 1 }, { units: [unit(1)] }).resourceChanges).toMatchObject([{ resource: "BATTLE_GOLD", amount: -20 }]);
  });

  it("keeps resource changes isolated to the requested resource key", () => {
    const runtime = createAbilityRuntime([{ ownerUid: 1, ability: { id: "other", trigger: { type: "ON_DEPLOY" }, target: { type: "SELF" }, effects: [{ type: "RESOURCE_CHANGE", resource: "FUTURE_RESOURCE", amount: { components: [{ source: "FLAT", coefficient: 10 }] } }] } }]);
    expect(runtime.dispatch({ type: "ON_DEPLOY", casterUid: 1 }, { units: [unit(1)] }).resourceChanges[0].resource).toBe("FUTURE_RESOURCE");
  });

  it("supports zero and negative resource values without changing unit state", () => {
    const runtime = createAbilityRuntime([{ ownerUid: 1, ability: { id: "zero", trigger: { type: "ON_DEPLOY" }, target: { type: "SELF" }, effects: [{ type: "RESOURCE_CHANGE", resource: "BATTLE_GOLD", amount: { components: [{ source: "FLAT", coefficient: 0 }] } }] } }]);
    const result = runtime.dispatch({ type: "ON_DEPLOY", casterUid: 1 }, { units: [unit(1)] });
    expect(result.units[0]).toEqual(unit(1));
    expect(result.resourceChanges[0].amount).toBe(0);
  });
});
