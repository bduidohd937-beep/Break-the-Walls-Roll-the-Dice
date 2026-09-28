import { describe, expect, it } from "vitest";
import type { StageDef } from "../../types";
import { runHeroPhase } from "../heroPhase";
import { createCombatAbilityIntegration } from "./integration";
import { createAbilityRuntime } from "./runtime";
import type { AbilityBinding, AbilityDefinition, AbilityEvent, AbilityUnit, TriggerDefinition } from "./types";

function unit(overrides: Partial<AbilityUnit> = {}): AbilityUnit {
  return {
    id: "same-character",
    name: "Fixture",
    sprite: "",
    element: "neutral",
    hp: 100,
    atk: 10,
    baseAtk: 10,
    speed: 10,
    range: 20,
    rangeType: "melee",
    attackInterval: 1,
    cost: 0,
    cooldown: 0,
    role: "fixture",
    uid: 1,
    team: "hero",
    x: 20,
    currentHp: 100,
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

function definition(trigger: TriggerDefinition, overrides: Partial<AbilityDefinition> = {}): AbilityDefinition {
  return {
    id: `fixture-${trigger.type}`,
    trigger,
    target: { type: "SELF" },
    effects: [{ type: "HEAL", amount: { components: [{ source: "FLAT", coefficient: 0 }] } }],
    ...overrides
  };
}

function binding(ownerUid: number, trigger: TriggerDefinition, overrides: Partial<AbilityDefinition> = {}): AbilityBinding {
  return { ownerUid, ability: definition(trigger, overrides) };
}

const stage: StageDef = {
  id: 1,
  name: "Fixture",
  region: "Fixture",
  type: "normal",
  waves: [[{ enemy: "goblin", count: 1 }]],
  waveMeta: [{ name: "Fixture", reward: 0 }],
  enemyCastleHp: 1000,
  clearReward: 0,
  repeatReward: 0,
  firstClearGems: 0
};

describe("combat event integration", () => {
  it("delivers a deployed unit exactly once", () => {
    const integration = createCombatAbilityIntegration([]);
    integration.registerUnitAbilities(1, [definition({ type: "ON_DEPLOY" })]);
    const units = [unit()];
    expect(integration.publish({ type: "UNIT_DEPLOYED", eventId: 1, origin: "SYSTEM", unitUid: 1 }, units).activationCount).toBe(1);
    expect(integration.publish({ type: "UNIT_DEPLOYED", eventId: 2, origin: "SYSTEM", unitUid: 1 }, units).activationCount).toBe(0);
  });

  it("delivers one ON_ATTACK for one valid basic attack", () => {
    const integration = createCombatAbilityIntegration([binding(1, { type: "ON_ATTACK" })]);
    const result = integration.publish({ type: "BASIC_ATTACK", eventId: 1, attackId: 7, origin: "BASIC_ATTACK", attackerUid: 1, targetUid: 2 }, [unit(), unit({ uid: 2, team: "enemy" })]);
    expect(result.activationCount).toBe(1);
  });

  it("does not emit an attack when an out-of-range attack is cancelled", () => {
    const result = runHeroPhase({
      heroes: [unit({ x: 20 })], enemies: [unit({ uid: 2, team: "enemy", x: 60 })], dt: 0.05,
      stage, stageIndex: 0, waveIndex: 0, spawnedInWave: 1, totalInWave: 1,
      bossSpawnAnnounced: false, enemyCastleHp: 1000, nextUid: 1, nextPopupUid: 1, nextCombatEventId: 1
    });
    expect(result.combatEvents).toHaveLength(0);
  });

  it("keeps attack counters independent by battle unit uid", () => {
    const integration = createCombatAbilityIntegration([
      binding(1, { type: "ON_ATTACK_COUNT", count: 2 }),
      binding(2, { type: "ON_ATTACK_COUNT", count: 2 })
    ]);
    const units = [unit(), unit({ uid: 2 }), unit({ uid: 3, team: "enemy" })];
    expect(integration.publish({ type: "BASIC_ATTACK", eventId: 1, origin: "BASIC_ATTACK", attackerUid: 1, targetUid: 3 }, units).activationCount).toBe(0);
    expect(integration.publish({ type: "BASIC_ATTACK", eventId: 2, origin: "BASIC_ATTACK", attackerUid: 2, targetUid: 3 }, units).activationCount).toBe(0);
    expect(integration.publish({ type: "BASIC_ATTACK", eventId: 3, origin: "BASIC_ATTACK", attackerUid: 1, targetUid: 3 }, units).activationCount).toBe(1);
  });

  it("does not share counters between duplicate character ids", () => {
    const integration = createCombatAbilityIntegration([
      binding(11, { type: "ON_ATTACK_COUNT", count: 2 }),
      binding(12, { type: "ON_ATTACK_COUNT", count: 2 })
    ]);
    const units = [unit({ uid: 11 }), unit({ uid: 12 }), unit({ uid: 20, team: "enemy" })];
    integration.publish({ type: "BASIC_ATTACK", eventId: 1, origin: "BASIC_ATTACK", attackerUid: 11, targetUid: 20 }, units);
    expect(integration.publish({ type: "BASIC_ATTACK", eventId: 2, origin: "BASIC_ATTACK", attackerUid: 12, targetUid: 20 }, units).activationCount).toBe(0);
  });

  it("delivers hit dealt to the damage source", () => {
    const integration = createCombatAbilityIntegration([binding(1, { type: "ON_HIT_DEALT" })]);
    expect(integration.publish({ type: "DAMAGE_APPLIED", eventId: 1, origin: "BASIC_ATTACK", sourceUid: 1, targetUid: 2, actualDamage: 10 }, [unit(), unit({ uid: 2, team: "enemy", currentHp: 90 })]).activationCount).toBe(1);
  });

  it("emits one dealt-hit event per AoE target with a shared attack id", () => {
    const result = runHeroPhase({
      heroes: [unit({ attackType: "splash", splashRadius: 5 })],
      enemies: [unit({ uid: 2, team: "enemy", x: 21 }), unit({ uid: 3, team: "enemy", x: 23 }), unit({ uid: 4, team: "enemy", x: 25 })],
      dt: 0.05, stage, stageIndex: 0, waveIndex: 0, spawnedInWave: 1, totalInWave: 1,
      bossSpawnAnnounced: false, enemyCastleHp: 1000, nextUid: 1, nextPopupUid: 1, nextCombatEventId: 10
    });
    const hits = result.combatEvents.filter((event) => event.type === "DAMAGE_APPLIED");
    expect(hits).toHaveLength(3);
    expect(new Set(hits.map((event) => event.attackId)).size).toBe(1);
  });

  it("delivers hit received to the damaged unit", () => {
    const integration = createCombatAbilityIntegration([binding(2, { type: "ON_HIT_RECEIVED" })]);
    expect(integration.publish({ type: "DAMAGE_APPLIED", eventId: 1, origin: "BASIC_ATTACK", sourceUid: 1, targetUid: 2, actualDamage: 10 }, [unit(), unit({ uid: 2, team: "enemy", currentHp: 90 })]).activationCount).toBe(1);
  });

  it("keeps received-hit counters independent by damaged uid", () => {
    const integration = createCombatAbilityIntegration([
      binding(2, { type: "ON_HIT_RECEIVED_COUNT", count: 2 }),
      binding(3, { type: "ON_HIT_RECEIVED_COUNT", count: 2 })
    ]);
    const units = [unit(), unit({ uid: 2, team: "enemy" }), unit({ uid: 3, team: "enemy" })];
    integration.publish({ type: "DAMAGE_APPLIED", eventId: 1, origin: "BASIC_ATTACK", sourceUid: 1, targetUid: 2, actualDamage: 1 }, units);
    expect(integration.publish({ type: "DAMAGE_APPLIED", eventId: 2, origin: "BASIC_ATTACK", sourceUid: 1, targetUid: 3, actualDamage: 1 }, units).activationCount).toBe(0);
  });

  it("activates a three-hit received fixture on the third hit", () => {
    const integration = createCombatAbilityIntegration([binding(2, { type: "ON_HIT_RECEIVED_COUNT", count: 3 })]);
    const units = [unit(), unit({ uid: 2, team: "enemy" })];
    for (let id = 1; id <= 2; id++) expect(integration.publish({ type: "DAMAGE_APPLIED", eventId: id, origin: "BASIC_ATTACK", sourceUid: 1, targetUid: 2, actualDamage: 1 }, units).activationCount).toBe(0);
    expect(integration.publish({ type: "DAMAGE_APPLIED", eventId: 3, origin: "BASIC_ATTACK", sourceUid: 1, targetUid: 2, actualDamage: 1 }, units).activationCount).toBe(1);
  });

  it("does not emit duplicate kill activations for one death", () => {
    const integration = createCombatAbilityIntegration([binding(1, { type: "ON_KILL" })]);
    const units = [unit(), unit({ uid: 2, team: "enemy", currentHp: 0 })];
    integration.publish({ type: "DAMAGE_APPLIED", eventId: 1, origin: "BASIC_ATTACK", sourceUid: 1, targetUid: 2, actualDamage: 100 }, units);
    expect(integration.publish({ type: "UNIT_DEATH", eventId: 2, origin: "SYSTEM", unitUid: 2 }, units).activationCount).toBe(1);
    expect(integration.publish({ type: "UNIT_DEATH", eventId: 3, origin: "SYSTEM", unitUid: 2 }, units).activationCount).toBe(0);
  });

  it("does not emit duplicate death activations", () => {
    const integration = createCombatAbilityIntegration([binding(2, { type: "ON_DEATH" })]);
    const units = [unit(), unit({ uid: 2, team: "enemy", currentHp: 0 })];
    expect(integration.publish({ type: "UNIT_DEATH", eventId: 1, origin: "SYSTEM", unitUid: 2 }, units).activationCount).toBe(1);
    expect(integration.publish({ type: "UNIT_DEATH", eventId: 2, origin: "SYSTEM", unitUid: 2 }, units).activationCount).toBe(0);
  });

  it("activates on an hp threshold crossing", () => {
    const integration = createCombatAbilityIntegration([binding(2, { type: "ON_HP_BELOW", hpPercent: 0.3 })]);
    expect(integration.publish({ type: "HP_CHANGED", eventId: 1, origin: "SYSTEM", unitUid: 2, previousHp: 40, currentHp: 30 }, [unit({ uid: 2, currentHp: 30 })]).activationCount).toBe(1);
  });

  it("does not reactivate every event while hp remains below threshold", () => {
    const integration = createCombatAbilityIntegration([binding(2, { type: "ON_HP_BELOW", hpPercent: 0.3 })]);
    const units = [unit({ uid: 2, currentHp: 20 })];
    expect(integration.publish({ type: "HP_CHANGED", eventId: 1, origin: "SYSTEM", unitUid: 2, previousHp: 40, currentHp: 20 }, units).activationCount).toBe(1);
    expect(integration.publish({ type: "HP_CHANGED", eventId: 2, origin: "SYSTEM", unitUid: 2, previousHp: 20, currentHp: 19 }, [unit({ uid: 2, currentHp: 19 })]).activationCount).toBe(0);
  });

  it("uses accumulated simulation delta for intervals", () => {
    const integration = createCombatAbilityIntegration([binding(1, { type: "ON_INTERVAL", intervalSeconds: 1 })]);
    const units = [unit()];
    expect(integration.publish({ type: "SIMULATION_TICK", eventId: 1, origin: "SYSTEM", deltaSeconds: 0.4 }, units).activationCount).toBe(0);
    expect(integration.publish({ type: "SIMULATION_TICK", eventId: 2, origin: "SYSTEM", deltaSeconds: 0.6 }, units).activationCount).toBe(1);
  });

  it("preserves interval meaning when game speed scales delta", () => {
    const normal = createCombatAbilityIntegration([binding(1, { type: "ON_INTERVAL", intervalSeconds: 1 })]);
    const fast = createCombatAbilityIntegration([binding(1, { type: "ON_INTERVAL", intervalSeconds: 1 })]);
    const units = [unit()];
    expect(normal.publish({ type: "SIMULATION_TICK", eventId: 1, origin: "SYSTEM", deltaSeconds: 0.05 }, units).activationCount).toBe(0);
    expect(fast.publish({ type: "SIMULATION_TICK", eventId: 2, origin: "SYSTEM", deltaSeconds: 1 }, units).activationCount).toBe(1);
  });

  it("keeps ability-free hero attack results unchanged", () => {
    const hero = unit();
    const enemy = unit({ uid: 2, team: "enemy", x: 21 });
    const result = runHeroPhase({ heroes: [hero], enemies: [enemy], dt: 0.05, stage, stageIndex: 0, waveIndex: 0, spawnedInWave: 1, totalInWave: 1, bossSpawnAnnounced: false, enemyCastleHp: 1000, nextUid: 1, nextPopupUid: 1 });
    expect(result.enemies[0].currentHp).toBe(90);
  });

  it("keeps ability-free damage events as no-ops", () => {
    const integration = createCombatAbilityIntegration([]);
    const units = [unit(), unit({ uid: 2, team: "enemy", currentHp: 90 })];
    expect(integration.publish({ type: "DAMAGE_APPLIED", eventId: 1, origin: "BASIC_ATTACK", sourceUid: 1, targetUid: 2, actualDamage: 10 }, units).units).toEqual(units);
  });

  it("keeps ability-free death events as no-ops", () => {
    const integration = createCombatAbilityIntegration([]);
    const units = [unit({ currentHp: 0 })];
    expect(integration.publish({ type: "UNIT_DEATH", eventId: 1, origin: "SYSTEM", unitUid: 1 }, units).units).toEqual(units);
  });

  it("stores runtime counters by battle unit uid", () => {
    const integration = createCombatAbilityIntegration([binding(42, { type: "ON_ATTACK_COUNT", count: 2 })]);
    integration.publish({ type: "BASIC_ATTACK", eventId: 1, origin: "BASIC_ATTACK", attackerUid: 42, targetUid: 2 }, [unit({ uid: 42 }), unit({ uid: 2, team: "enemy" })]);
    expect(integration.runtimeStateSize()).toBe(1);
  });

  it("cleans runtime state for removed units", () => {
    const integration = createCombatAbilityIntegration([binding(42, { type: "ON_ATTACK_COUNT", count: 2 })]);
    integration.publish({ type: "BASIC_ATTACK", eventId: 1, origin: "BASIC_ATTACK", attackerUid: 42, targetUid: 2 }, [unit({ uid: 42 }), unit({ uid: 2, team: "enemy" })]);
    integration.cleanup(new Set([2]));
    expect(integration.runtimeStateSize()).toBe(0);
  });

  it("preserves ABILITY origin on ability-generated damage", () => {
    const damage = definition({ type: "ON_HIT_DEALT" }, { id: "chain-source", target: { type: "CURRENT_TARGET" }, effects: [{ type: "DAMAGE", amount: { components: [{ source: "FLAT", coefficient: 1 }] } }] });
    const observe = definition({ type: "ON_HIT_RECEIVED" }, { id: "origin-observer" });
    const bindings = [{ ownerUid: 1, ability: damage }, { ownerUid: 2, ability: observe }];
    const baseRuntime = createAbilityRuntime(bindings);
    const observedEvents: AbilityEvent[] = [];
    const runtime = {
      dispatch(event: AbilityEvent, battlefield: { units: readonly AbilityUnit[] }) {
        observedEvents.push(event);
        return baseRuntime.dispatch(event, battlefield);
      },
      register: baseRuntime.register,
      cleanup: baseRuntime.cleanup,
      stateSize: baseRuntime.stateSize,
      hasWork: baseRuntime.hasWork
    };
    const integration = createCombatAbilityIntegration(bindings, { maxChainDepth: 1, runtime });
    const result = integration.publish({ type: "DAMAGE_APPLIED", eventId: 1, origin: "BASIC_ATTACK", sourceUid: 1, targetUid: 2, actualDamage: 1 }, [unit(), unit({ uid: 2, team: "enemy" })]);
    expect(result.activationCount).toBeGreaterThan(1);
    expect(observedEvents.some((event) => event.meta?.origin === "ABILITY" && event.meta.originAbilityId === "chain-source")).toBe(true);
  });

  it("stops recursive ability event chains at the configured depth", () => {
    const recursive = definition({ type: "ON_HIT_DEALT" }, { target: { type: "CURRENT_TARGET" }, effects: [{ type: "DAMAGE", amount: { components: [{ source: "FLAT", coefficient: 1 }] } }] });
    const integration = createCombatAbilityIntegration([{ ownerUid: 1, ability: recursive }], { maxChainDepth: 2 });
    const result = integration.publish({ type: "DAMAGE_APPLIED", eventId: 1, origin: "BASIC_ATTACK", sourceUid: 1, targetUid: 2, actualDamage: 1 }, [unit(), unit({ uid: 2, team: "enemy" })]);
    expect(result.droppedByDepthLimit).toBe(true);
  });

  it("does not route castle attacks into unit attack abilities", () => {
    const integration = createCombatAbilityIntegration([binding(1, { type: "ON_ATTACK" })]);
    expect(integration.publish({ type: "CASTLE_ATTACK", eventId: 1, origin: "BASIC_ATTACK", attackerUid: 1, castle: "enemy", actualDamage: 10 }, [unit()]).activationCount).toBe(0);
  });

  it("executes fixture abilities without hero id or name checks", () => {
    const integration = createCombatAbilityIntegration([binding(77, { type: "ON_ATTACK" }, { id: "data-only-fixture" })]);
    expect(integration.publish({ type: "BASIC_ATTACK", eventId: 1, origin: "BASIC_ATTACK", attackerUid: 77, targetUid: 88 }, [unit({ uid: 77, id: "arbitrary" }), unit({ uid: 88, team: "enemy" })]).activationCount).toBe(1);
  });
});
