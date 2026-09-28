import { describe, expect, it } from "vitest";
import { advanceAbilityEffectDurations, executeEffect, legacyStatusHandlers, resolveAbilityDamage } from "./effects";
import { createAbilityRuntime } from "./runtime";
import type { AbilityDefinition, AbilityUnit, EffectDefinition } from "./types";

function unit(overrides: Partial<AbilityUnit> = {}): AbilityUnit {
  return {
    id: "fixture", name: "Fixture", sprite: "", element: "neutral", hp: 1000, atk: 100, baseAtk: 100,
    def: 40, speed: 20, range: 20, rangeType: "melee", attackInterval: 2, cost: 0, cooldown: 0, role: "fixture",
    uid: 1, team: "hero", x: 20, currentHp: 1000, attackTimer: 0, cooldownTimer: 0, hitFlash: 0,
    attackFlash: 0, attackTargetX: 20, knockbackCount: 0, knockbackTimer: 0, knockbackFromX: 20,
    knockbackTargetX: 20, alive: true, burnTimer: 0, burnDamage: 0, slowTimer: 0, slowMultiplier: 1,
    specialTimer: 0, ...overrides
  };
}

const flat = (value: number) => ({ components: [{ source: "FLAT" as const, coefficient: value }] });
const apply = (effect: EffectDefinition, target = unit(), caster = unit()) => executeEffect(effect, { caster, target, statusHandlers: legacyStatusHandlers });

describe("SHIELD effect", () => {
  it("uses scaling and absorbs damage before hp", () => {
    const shielded = apply({ type: "SHIELD", amount: { components: [{ source: "CASTER_ATK", coefficient: 0.5 }] }, duration: 3 });
    const resolved = resolveAbilityDamage(shielded, 80);
    expect(resolved.hpDamage).toBe(30);
    expect(resolved.unit.abilityEffectState?.shields).toHaveLength(0);
  });

  it("expires using simulation duration", () => {
    const shielded = apply({ type: "SHIELD", amount: flat(50), duration: 2 });
    expect(advanceAbilityEffectDurations(shielded, 1).abilityEffectState?.shields).toHaveLength(1);
    expect(advanceAbilityEffectDurations(shielded, 2).abilityEffectState).toBeUndefined();
  });

  it("keeps shield state independent by uid", () => {
    const ability: AbilityDefinition = { id: "shield-fixture", trigger: { type: "ON_DEPLOY" }, target: { type: "SELF" }, effects: [{ type: "SHIELD", amount: flat(50), duration: 2 }] };
    const runtime = createAbilityRuntime([{ ownerUid: 1, ability }]);
    const result = runtime.dispatch({ type: "ON_DEPLOY", casterUid: 1 }, { units: [unit(), unit({ uid: 2 })] });
    expect(result.units.find((entry) => entry.uid === 1)?.abilityEffectState?.shields).toHaveLength(1);
    expect(result.units.find((entry) => entry.uid === 2)?.abilityEffectState).toBeUndefined();
  });

  it("stacks shield layers and consumes the oldest layer first", () => {
    const first = apply({ type: "SHIELD", amount: flat(30), duration: 1 });
    const second = apply({ type: "SHIELD", amount: flat(40), duration: 3 }, first);
    const resolved = resolveAbilityDamage(second, 50);
    expect(resolved.hpDamage).toBe(0);
    expect(resolved.unit.abilityEffectState?.shields).toEqual([{ amount: 20, remaining: 3 }]);
  });
});

describe("STAT_MODIFIER effect", () => {
  it("supports flat and percent modifiers for combat stats", () => {
    let modified = apply({ type: "STAT_MODIFIER", stat: "ATK", mode: "FLAT", value: flat(20), duration: 3 });
    modified = apply({ type: "STAT_MODIFIER", stat: "ATK", mode: "PERCENT", value: flat(0.5), duration: 3 }, modified);
    modified = apply({ type: "STAT_MODIFIER", stat: "DEF", mode: "FLAT", value: flat(10), duration: 3 }, modified);
    modified = apply({ type: "STAT_MODIFIER", stat: "ASPD", mode: "PERCENT", value: flat(0.25), duration: 3 }, modified);
    modified = apply({ type: "STAT_MODIFIER", stat: "MOVE", mode: "PERCENT", value: flat(0.5), duration: 3 }, modified);
    expect(modified).toMatchObject({ atk: 180, def: 50, attackInterval: 1.6, speed: 30 });
  });

  it("restores base stats when modifiers expire", () => {
    const modified = apply({ type: "STAT_MODIFIER", stat: "ATK", mode: "PERCENT", value: flat(0.5), duration: 2 });
    expect(advanceAbilityEffectDurations(modified, 2)).toMatchObject({ atk: 100, def: 40, attackInterval: 2, speed: 20, abilityEffectState: undefined });
  });

  it("keeps stat modifiers independent by uid", () => {
    const ability: AbilityDefinition = { id: "stat-fixture", trigger: { type: "ON_DEPLOY" }, target: { type: "SELF" }, effects: [{ type: "STAT_MODIFIER", stat: "MOVE", mode: "FLAT", value: flat(5), duration: 2 }] };
    const runtime = createAbilityRuntime([{ ownerUid: 1, ability }]);
    const result = runtime.dispatch({ type: "ON_DEPLOY", casterUid: 1 }, { units: [unit(), unit({ uid: 2 })] });
    expect(result.units.find((entry) => entry.uid === 1)?.speed).toBe(25);
    expect(result.units.find((entry) => entry.uid === 2)?.speed).toBe(20);
  });

  it("recomputes mixed stacks from the original base stat", () => {
    let modified = apply({ type: "STAT_MODIFIER", stat: "ATK", mode: "FLAT", value: flat(20), duration: 1 });
    modified = apply({ type: "STAT_MODIFIER", stat: "ATK", mode: "PERCENT", value: flat(0.5), duration: 3 }, modified);
    expect(modified.atk).toBe(180);
    expect(advanceAbilityEffectDurations(modified, 1).atk).toBe(150);
  });
});

describe("DAMAGE_TAKEN_MODIFIER effect", () => {
  it("multiplies incoming damage", () => {
    const reduced = apply({ type: "DAMAGE_TAKEN_MODIFIER", multiplier: 0.6, duration: 2 });
    expect(resolveAbilityDamage(reduced, 100).hpDamage).toBe(60);
  });

  it("expires using simulation duration", () => {
    const reduced = apply({ type: "DAMAGE_TAKEN_MODIFIER", multiplier: 0.6, duration: 2 });
    expect(resolveAbilityDamage(advanceAbilityEffectDurations(reduced, 2), 100).hpDamage).toBe(100);
  });

  it("keeps damage modifiers independent by uid", () => {
    const ability: AbilityDefinition = { id: "damage-taken-fixture", trigger: { type: "ON_DEPLOY" }, target: { type: "SELF" }, effects: [{ type: "DAMAGE_TAKEN_MODIFIER", multiplier: 0.5, duration: 2 }] };
    const runtime = createAbilityRuntime([{ ownerUid: 1, ability }]);
    const result = runtime.dispatch({ type: "ON_DEPLOY", casterUid: 1 }, { units: [unit(), unit({ uid: 2 })] });
    expect(resolveAbilityDamage(result.units.find((entry) => entry.uid === 1)!, 100).hpDamage).toBe(50);
    expect(resolveAbilityDamage(result.units.find((entry) => entry.uid === 2)!, 100).hpDamage).toBe(100);
  });

  it("multiplies stacked damage-taken modifiers", () => {
    const first = apply({ type: "DAMAGE_TAKEN_MODIFIER", multiplier: 0.8, duration: 2 });
    const second = apply({ type: "DAMAGE_TAKEN_MODIFIER", multiplier: 0.5, duration: 2 }, first);
    expect(resolveAbilityDamage(second, 100).hpDamage).toBe(40);
  });
});
