import { describe, expect, it } from "vitest";
import { createCombatAbilityIntegration } from "./integration";
import { createAbilityRuntime } from "./runtime";
import type { AbilityDefinition, AbilityUnit } from "./types";

const unit = (uid: number, team: "hero" | "enemy", currentHp = 100): AbilityUnit => ({
  id: `unit-${uid}`, name: "Fixture", sprite: "", element: "neutral", hp: 100, atk: 10, baseAtk: 10,
  def: 0, speed: 10, range: 20, rangeType: "melee", attackInterval: 1, cost: 0, cooldown: 0, role: "fixture",
  uid, team, x: team === "hero" ? 20 : 21, currentHp, attackTimer: 0, cooldownTimer: 0, hitFlash: 0,
  attackFlash: 0, attackTargetX: 20, knockbackCount: 0, knockbackTimer: 0, knockbackFromX: 20,
  knockbackTargetX: 20, alive: currentHp > 0, burnTimer: 0, burnDamage: 0, slowTimer: 0, slowMultiplier: 1,
  specialTimer: 0
});

const dot = (ownerUid: number, id = `dot-${ownerUid}`, amount = 10): AbilityDefinition => ({
  id, trigger: { type: "ON_DEPLOY" }, target: { type: "NEAREST_ENEMY" },
  effects: [{ type: "DOT", amount: { components: [{ source: "FLAT", coefficient: amount }] }, duration: 2, interval: 1 }]
});

const hot = (ownerUid: number, id = `hot-${ownerUid}`): AbilityDefinition => ({
  id, trigger: { type: "ON_DEPLOY" }, target: { type: "SELF" },
  effects: [{ type: "HOT", amount: { components: [{ source: "FLAT", coefficient: 40 }] }, duration: 2, interval: 1 }]
});

describe("periodic DOT and HOT effects", () => {
  it("applies DOT on each interval and expires at duration", () => {
    const runtime = createAbilityRuntime([{ ownerUid: 1, ability: dot(1) }]);
    let units = [unit(1, "hero"), unit(2, "enemy")];
    units = runtime.dispatch({ type: "ON_DEPLOY", casterUid: 1 }, { units }).units as AbilityUnit[];
    units = runtime.dispatch({ type: "ON_INTERVAL", elapsedSeconds: 1 }, { units }).units as AbilityUnit[];
    expect(units.find((entry) => entry.uid === 2)?.currentHp).toBe(90);
    units = runtime.dispatch({ type: "ON_INTERVAL", elapsedSeconds: 1 }, { units }).units as AbilityUnit[];
    expect(units.find((entry) => entry.uid === 2)?.currentHp).toBe(80);
    expect((runtime.dispatch({ type: "ON_INTERVAL", elapsedSeconds: 1 }, { units }).units as AbilityUnit[]).find((entry) => entry.uid === 2)?.currentHp).toBe(80);
  });

  it("applies HOT on each interval without overheal", () => {
    const runtime = createAbilityRuntime([{ ownerUid: 1, ability: hot(1) }]);
    let units = [unit(1, "hero", 70)];
    units = runtime.dispatch({ type: "ON_DEPLOY", casterUid: 1 }, { units }).units as AbilityUnit[];
    units = runtime.dispatch({ type: "ON_INTERVAL", elapsedSeconds: 1 }, { units }).units as AbilityUnit[];
    expect(units[0].currentHp).toBe(100);
  });

  it("uses simulation delta for accelerated ticks", () => {
    const runtime = createAbilityRuntime([{ ownerUid: 1, ability: dot(1, "fast", 7) }]);
    let units = [unit(1, "hero"), unit(2, "enemy")];
    units = runtime.dispatch({ type: "ON_DEPLOY", casterUid: 1 }, { units }).units as AbilityUnit[];
    units = runtime.dispatch({ type: "ON_INTERVAL", elapsedSeconds: 2 }, { units }).units as AbilityUnit[];
    expect(units[1].currentHp).toBe(86);
  });

  it("keeps periodic effects independent by target uid", () => {
    const runtime = createAbilityRuntime([{ ownerUid: 1, ability: dot(1) }, { ownerUid: 3, ability: dot(3) }]);
    let units = [unit(1, "hero"), unit(2, "enemy"), { ...unit(3, "hero"), x: 30 }, { ...unit(4, "enemy"), x: 31 }];
    units = runtime.dispatch({ type: "ON_DEPLOY", casterUid: 1 }, { units }).units as AbilityUnit[];
    units = runtime.dispatch({ type: "ON_DEPLOY", casterUid: 3 }, { units }).units as AbilityUnit[];
    units = runtime.dispatch({ type: "ON_INTERVAL", elapsedSeconds: 1 }, { units }).units as AbilityUnit[];
    expect(units.find((entry) => entry.uid === 2)?.currentHp).toBe(90);
    expect(units.find((entry) => entry.uid === 4)?.currentHp).toBe(90);
  });

  it("keeps overlapping periodic effects as independent stacks", () => {
    const runtime = createAbilityRuntime([{ ownerUid: 1, ability: dot(1, "a", 10) }, { ownerUid: 1, ability: dot(1, "b", 5) }]);
    let units = [unit(1, "hero"), unit(2, "enemy")];
    units = runtime.dispatch({ type: "ON_DEPLOY", casterUid: 1 }, { units }).units as AbilityUnit[];
    units = runtime.dispatch({ type: "ON_INTERVAL", elapsedSeconds: 1 }, { units }).units as AbilityUnit[];
    expect(units[1].currentHp).toBe(85);
  });

  it("preserves death and kill event flow when DOT defeats a target", () => {
    const integration = createCombatAbilityIntegration([
      { ownerUid: 1, ability: dot(1, "lethal", 100) },
      { ownerUid: 1, ability: { id: "on-kill", trigger: { type: "ON_KILL" }, target: { type: "SELF" }, effects: [] } }
    ]);
    let units = [unit(1, "hero"), unit(2, "enemy", 50)];
    units = integration.publish({ type: "UNIT_DEPLOYED", unitUid: 1, eventId: 1, origin: "SYSTEM" }, units).units as AbilityUnit[];
    const tick = integration.publish({ type: "SIMULATION_TICK", deltaSeconds: 1, eventId: 2, origin: "SYSTEM" }, units);
    units = tick.units as AbilityUnit[];
    expect(units.find((entry) => entry.uid === 2)?.currentHp).toBe(0);
    expect(integration.publish({ type: "UNIT_DEATH", unitUid: 2, killerUid: 1, eventId: 3, origin: "SYSTEM" }, units).activationCount).toBeGreaterThan(0);
  });
});
