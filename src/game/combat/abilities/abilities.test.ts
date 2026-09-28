import { describe, expect, it } from "vitest";
import { meetsAbilityCondition } from "./conditions";
import { createAbilityRuntime } from "./runtime";
import { calculateScaling } from "./scaling";
import { selectAbilityTargets } from "./targeting";
import type { AbilityDefinition, AbilityUnit, EffectDefinition, ScalingDefinition } from "./types";

function unit(overrides: Partial<AbilityUnit> = {}): AbilityUnit {
  return {
    id: "unit",
    name: "Unit",
    sprite: "",
    element: "neutral",
    hp: 1000,
    atk: 100,
    def: 50,
    baseAtk: 100,
    speed: 10,
    range: 20,
    rangeType: "melee",
    attackInterval: 1,
    cost: 0,
    cooldown: 0,
    role: "test",
    uid: 1,
    team: "hero",
    x: 20,
    currentHp: 1000,
    attackTimer: 0,
    cooldownTimer: 0,
    hitFlash: 0,
    attackFlash: 0,
    attackTargetX: 20,
    knockbackCount: 0,
    knockbackTimer: 0,
    knockbackFromX: 20,
    knockbackTargetX: 20,
    alive: true,
    burnTimer: 0,
    burnDamage: 0,
    slowTimer: 0,
    slowMultiplier: 1,
    specialTimer: 0,
    ...overrides
  };
}

const flat = (value: number): ScalingDefinition => ({ components: [{ source: "FLAT", coefficient: value }] });

function ability(overrides: Partial<AbilityDefinition> = {}): AbilityDefinition {
  return {
    id: "generic-ability",
    trigger: { type: "ON_ATTACK" },
    condition: { type: "ALWAYS" },
    target: { type: "CURRENT_TARGET" },
    effects: [{ type: "DAMAGE", amount: flat(10) }],
    ...overrides
  };
}

function execute(effect: EffectDefinition, caster = unit(), target = unit({ uid: 2, team: "enemy" })) {
  const definition = ability({ effects: [effect] });
  return createAbilityRuntime([{ ownerUid: caster.uid, ability: definition }]).dispatch(
    { type: "ON_ATTACK", casterUid: caster.uid, currentTargetUid: target.uid },
    { units: [caster, target] }
  );
}

describe("ability triggers", () => {
  it("activates ON_ATTACK_COUNT only on the configured attack", () => {
    const runtime = createAbilityRuntime([{ ownerUid: 1, ability: ability({ trigger: { type: "ON_ATTACK_COUNT", count: 3 } }) }]);
    const battlefield = { units: [unit(), unit({ uid: 2, team: "enemy" })] };
    expect(runtime.dispatch({ type: "ON_ATTACK", casterUid: 1, currentTargetUid: 2 }, battlefield).activations).toHaveLength(0);
    expect(runtime.dispatch({ type: "ON_ATTACK", casterUid: 1, currentTargetUid: 2 }, battlefield).activations).toHaveLength(0);
    expect(runtime.dispatch({ type: "ON_ATTACK", casterUid: 1, currentTargetUid: 2 }, battlefield).activations).toHaveLength(1);
  });

  it("activates ON_HIT_RECEIVED_COUNT only on the configured hit", () => {
    const runtime = createAbilityRuntime([{ ownerUid: 1, ability: ability({ trigger: { type: "ON_HIT_RECEIVED_COUNT", count: 2 } }) }]);
    const battlefield = { units: [unit(), unit({ uid: 2, team: "enemy" })] };
    expect(runtime.dispatch({ type: "ON_HIT_RECEIVED", casterUid: 1, currentTargetUid: 2 }, battlefield).activations).toHaveLength(0);
    expect(runtime.dispatch({ type: "ON_HIT_RECEIVED", casterUid: 1, currentTargetUid: 2 }, battlefield).activations).toHaveLength(1);
  });
});

describe("ability conditions", () => {
  it("evaluates SELF_HP_BELOW", () => {
    expect(meetsAbilityCondition({ type: "SELF_HP_BELOW", hpPercent: 0.3 }, unit({ currentHp: 299 }))).toBe(true);
    expect(meetsAbilityCondition({ type: "SELF_HP_BELOW", hpPercent: 0.3 }, unit({ currentHp: 300 }))).toBe(false);
  });

  it("evaluates TARGET_HP_BELOW", () => {
    expect(meetsAbilityCondition({ type: "TARGET_HP_BELOW", hpPercent: 0.5 }, unit(), unit({ currentHp: 499 }))).toBe(true);
    expect(meetsAbilityCondition({ type: "TARGET_HP_BELOW", hpPercent: 0.5 }, unit(), unit({ currentHp: 500 }))).toBe(false);
  });
});

describe("ability targeting", () => {
  const caster = unit();
  const allies = [unit({ uid: 2, currentHp: 300, hp: 1000 }), unit({ uid: 3, currentHp: 200, hp: 400 })];
  const enemies = [unit({ uid: 4, team: "enemy", x: 40 }), unit({ uid: 5, team: "enemy", x: 25 })];

  it("selects the nearest enemy", () => {
    expect(selectAbilityTargets({ type: "NEAREST_ENEMY" }, caster, [caster, ...enemies])[0].uid).toBe(5);
  });

  it("selects the ally with the lowest current hp", () => {
    expect(selectAbilityTargets({ type: "LOWEST_HP_ALLY" }, caster, [caster, ...allies])[0].uid).toBe(3);
  });

  it("selects the ally with the lowest hp percentage", () => {
    expect(selectAbilityTargets({ type: "LOWEST_HP_PERCENT_ALLY" }, caster, [caster, ...allies])[0].uid).toBe(2);
  });
});

describe("ability scaling and effects", () => {
  it("deals damage using caster attack scaling", () => {
    const result = execute({ type: "DAMAGE", amount: { components: [{ source: "CASTER_ATK", coefficient: 1.5 }] } });
    expect(result.units.find((entry) => entry.uid === 2)?.currentHp).toBe(850);
  });

  it("deals damage using caster defense scaling", () => {
    const result = execute({ type: "DAMAGE", amount: { components: [{ source: "CASTER_DEF", coefficient: 2 }] } });
    expect(result.units.find((entry) => entry.uid === 2)?.currentHp).toBe(900);
  });

  it("heals using caster attack scaling", () => {
    const target = unit({ uid: 2, currentHp: 500 });
    const result = execute({ type: "HEAL", amount: { components: [{ source: "CASTER_ATK", coefficient: 1.5 }] } }, unit(), target);
    expect(result.units.find((entry) => entry.uid === 2)?.currentHp).toBe(650);
  });

  it("heals using target max hp scaling", () => {
    const target = unit({ uid: 2, hp: 2000, currentHp: 500 });
    const result = execute({ type: "HEAL", amount: { components: [{ source: "TARGET_MAX_HP", coefficient: 0.08 }] } }, unit(), target);
    expect(result.units.find((entry) => entry.uid === 2)?.currentHp).toBe(660);
  });

  it("heals using target lost hp scaling", () => {
    const target = unit({ uid: 2, hp: 1000, currentHp: 600 });
    const result = execute({ type: "HEAL", amount: { components: [{ source: "TARGET_LOST_HP", coefficient: 0.25 }] } }, unit(), target);
    expect(result.units.find((entry) => entry.uid === 2)?.currentHp).toBe(700);
  });

  it("does not heal a defeated unit", () => {
    const target = unit({ uid: 2, currentHp: 0, alive: false });
    const result = execute({ type: "HEAL", amount: { components: [{ source: "FLAT", coefficient: 100 }] } }, unit(), target);
    expect(result.units.find((entry) => entry.uid === 2)).toMatchObject({ currentHp: 0, alive: false });
  });

  it("adds multiple scaling components", () => {
    const amount = calculateScaling({ components: [
      { source: "CASTER_ATK", coefficient: 1 },
      { source: "TARGET_LOST_HP", coefficient: 0.1 },
      { source: "FLAT", coefficient: 50 }
    ] }, unit(), unit({ currentHp: 500 }));
    expect(amount).toBe(200);
  });

  it("applies knockback through the existing movement fields", () => {
    const result = execute({ type: "KNOCKBACK", distance: flat(8) });
    expect(result.units.find((entry) => entry.uid === 2)).toMatchObject({
      knockbackTimer: 0.22,
      knockbackFromX: 20,
      knockbackTargetX: 28
    });
  });

  it("pushes an enemy away from a hero and a hero away from an enemy", () => {
    const enemyTarget = unit({ uid: 2, team: "enemy", x: 50 });
    const enemyResult = execute({ type: "KNOCKBACK", distance: flat(8) }, unit({ team: "hero", x: 20 }), enemyTarget);
    expect(enemyResult.units.find((entry) => entry.uid === 2)?.knockbackTargetX).toBe(58);

    const heroTarget = unit({ uid: 2, team: "hero", x: 50 });
    const heroResult = execute({ type: "KNOCKBACK", distance: flat(8) }, unit({ team: "enemy", x: 80 }), heroTarget);
    expect(heroResult.units.find((entry) => entry.uid === 2)?.knockbackTargetX).toBe(42);
  });

  it("adapts APPLY_STATUS to the existing burn fields", () => {
    const result = execute({ type: "APPLY_STATUS", status: "burn", duration: 3, potency: flat(12) });
    expect(result.units.find((entry) => entry.uid === 2)).toMatchObject({ burnTimer: 3, burnDamage: 12 });
  });
});

describe("ability metadata independence", () => {
  it("does not produce an effect from tags alone", () => {
    const tagged = ability({ tags: ["POISON"], effects: [] });
    const target = unit({ uid: 2, team: "enemy" });
    const result = createAbilityRuntime([{ ownerUid: 1, ability: tagged }]).dispatch(
      { type: "ON_ATTACK", casterUid: 1, currentTargetUid: 2 },
      { units: [unit(), target] }
    );
    expect(result.units.find((entry) => entry.uid === 2)?.currentHp).toBe(target.currentHp);
  });

  it("does not change ability results when only role changes", () => {
    const target = unit({ uid: 2, team: "enemy" });
    const run = (role: string) => execute({ type: "DAMAGE", amount: flat(25) }, unit({ role }), target)
      .units.find((entry) => entry.uid === 2)?.currentHp;
    expect(run("TANK")).toBe(run("SUPPORT"));
  });

  it("executes from AbilityDefinition without a character id branch", () => {
    const caster = unit({ id: "data-driven-caster", uid: 77 });
    const target = unit({ id: "any-target", uid: 88, team: "enemy" });
    const result = createAbilityRuntime([{ ownerUid: 77, ability: ability({ id: "definition-only" }) }]).dispatch(
      { type: "ON_ATTACK", casterUid: 77, currentTargetUid: 88 },
      { units: [caster, target] }
    );
    expect(result.activations[0]).toMatchObject({ abilityId: "definition-only", ownerUid: 77, targetUids: [88] });
  });
});
