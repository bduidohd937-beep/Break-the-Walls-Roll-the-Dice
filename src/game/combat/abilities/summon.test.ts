import { describe, expect, it } from "vitest";
import { createCombatAbilityIntegration } from "./integration";
import { createAbilityRuntime } from "./runtime";
import type { AbilityDefinition, AbilityUnit, SummonFactory } from "./types";

const unit = (uid: number, team: "hero" | "enemy" = "hero"): AbilityUnit => ({
  id: `unit-${uid}`, name: "Fixture", sprite: "", element: "neutral", hp: 100, atk: 10, baseAtk: 10, def: 0,
  speed: 10, range: 20, rangeType: "melee", attackInterval: 1, cost: 0, cooldown: 0, role: "fixture", uid, team,
  x: team === "hero" ? 20 : 21, currentHp: 100, attackTimer: 0, cooldownTimer: 0, hitFlash: 0, attackFlash: 0,
  attackTargetX: 20, knockbackCount: 0, knockbackTimer: 0, knockbackFromX: 20, knockbackTargetX: 20, alive: true,
  burnTimer: 0, burnDamage: 0, slowTimer: 0, slowMultiplier: 1, specialTimer: 0
});

const factory: SummonFactory = (request) => Array.from({ length: request.count }, (_, index) => ({
  ...unit(request.uidStart + index, request.team),
  id: request.summonUnitId,
  summonMeta: { ownerUid: request.ownerUid, sourceAbilityId: request.sourceAbilityId, summonedAt: 10, remaining: request.duration }
}));

const summonAbility = (id = "summon", count = 1, duration?: number): AbilityDefinition => ({
  id, trigger: { type: "ON_DEPLOY" }, target: { type: "SELF" },
  effects: [{ type: "SUMMON", summonUnitId: "fixture-summon", count, duration }]
});

describe("SUMMON effect", () => {
  it("creates one summon with owner and source metadata", () => {
    const runtime = createAbilityRuntime([{ ownerUid: 1, ability: summonAbility() }], { summonFactory: factory });
    const result = runtime.dispatch({ type: "ON_DEPLOY", casterUid: 1 }, { units: [unit(1)] });
    const summoned = result.units.find((entry) => entry.summonMeta);
    expect(summoned).toMatchObject({ id: "fixture-summon", summonMeta: { ownerUid: 1, sourceAbilityId: "summon" } });
  });

  it("assigns distinct uids for multiple summons", () => {
    const runtime = createAbilityRuntime([{ ownerUid: 1, ability: summonAbility("many", 3) }], { summonFactory: factory });
    const result = runtime.dispatch({ type: "ON_DEPLOY", casterUid: 1 }, { units: [unit(1)] });
    expect(result.units.filter((entry) => entry.summonMeta).map((entry) => entry.uid)).toEqual([1_000_000, 1_000_001, 1_000_002]);
  });

  it("removes duration summons on simulation time expiry", () => {
    const runtime = createAbilityRuntime([{ ownerUid: 1, ability: summonAbility("timed", 1, 2) }], { summonFactory: factory });
    let units = runtime.dispatch({ type: "ON_DEPLOY", casterUid: 1 }, { units: [unit(1)] }).units as AbilityUnit[];
    units = runtime.dispatch({ type: "ON_INTERVAL", elapsedSeconds: 1 }, { units }).units as AbilityUnit[];
    expect(units.some((entry) => entry.summonMeta)).toBe(true);
    units = runtime.dispatch({ type: "ON_INTERVAL", elapsedSeconds: 1 }, { units }).units as AbilityUnit[];
    expect(units.some((entry) => entry.summonMeta)).toBe(false);
  });

  it("cleans summon runtime state after death/removal", () => {
    const runtime = createAbilityRuntime([{ ownerUid: 1, ability: summonAbility("cleanup", 1) }], { summonFactory: factory });
    const units = runtime.dispatch({ type: "ON_DEPLOY", casterUid: 1 }, { units: [unit(1)] }).units as AbilityUnit[];
    const summon = units.find((entry) => entry.summonMeta)!;
    runtime.cleanup(new Set([1]));
    expect(runtime.stateSize()).toBe(0);
    expect(summon.uid).toBeGreaterThan(1);
  });

  it("allows existing effects to target a summoned BattleUnit", () => {
    const runtime = createAbilityRuntime([{ ownerUid: 1, ability: summonAbility("effect", 1) }], { summonFactory: factory });
    const result = runtime.dispatch({ type: "ON_DEPLOY", casterUid: 1 }, { units: [unit(1)] });
    const summon = result.units.find((entry) => entry.summonMeta)!;
    expect(summon.id).toBe("fixture-summon");
    expect(summon.currentHp).toBe(100);
  });

  it("keeps summon deployment inside the existing event depth guard", () => {
    const integration = createCombatAbilityIntegration([{ ownerUid: 1, ability: summonAbility("guarded") }], { summonFactory: factory, maxChainDepth: 1 });
    const result = integration.publish({ type: "UNIT_DEPLOYED", unitUid: 1, eventId: 1, origin: "SYSTEM" }, [unit(1)]);
    expect(result.droppedByDepthLimit).toBe(false);
    expect(result.units.filter((entry) => entry.summonMeta)).toHaveLength(1);
  });
});
