import { describe, expect, it } from "vitest";
import { applyKnockback } from "../knockback";
import type { CombatEvent } from "./combatEvents";
import { DARK_KNIGHT_WAR_CRY, ABILITY_IDS, resolveAbilityDefinitions } from "./definitions";
import { executeEffect, hasActiveCast, isBlockedFromCast } from "./effects";
import { createCombatAbilityIntegration } from "./integration";
import type { AbilityDefinition, AbilityUnit } from "./types";

const CAST = { interval: 2, windup: 1, cast: 0.1, recovery: 1, atkPercent: 0.2, buffDuration: 3 } as const;
const windupDefinition: AbilityDefinition = {
  id: "v1b-windup-verification",
  trigger: { type: "ON_INTERVAL", intervalSeconds: CAST.interval },
  condition: { type: "ALWAYS" },
  target: { type: "SELF" },
  cast: { windupSeconds: CAST.windup, castSeconds: CAST.cast, recoverySeconds: CAST.recovery },
  effects: [{ type: "STAT_MODIFIER", stat: "ATK", mode: "PERCENT", value: { components: [{ source: "FLAT", coefficient: CAST.atkPercent }] }, duration: CAST.buffDuration }],
  visual: { animation: "skill1", durationSeconds: CAST.windup + CAST.cast },
};

function unit(overrides: Partial<AbilityUnit> = {}): AbilityUnit {
  return {
    id: "v1b-unit", name: "V1B Unit", sprite: "", element: "neutral",
    hp: 1000, atk: 100, baseAtk: 100, def: 50, speed: 10, range: 20,
    rangeType: "melee", attackInterval: 1, cost: 0, cooldown: 0, role: "test",
    uid: 1, team: "hero", x: 20, currentHp: 1000, attackTimer: 0, cooldownTimer: 0,
    hitFlash: 0, attackFlash: 0, attackTargetX: 20, knockbackCount: 0,
    knockbackTimer: 0, knockbackFromX: 20, knockbackTargetX: 20, alive: true,
    burnTimer: 0, burnDamage: 0, slowTimer: 0, slowMultiplier: 1, specialTimer: 0,
    ...overrides,
  };
}

let eventId = 1;
const tick = (deltaSeconds: number): CombatEvent => ({ type: "SIMULATION_TICK", eventId: eventId++, origin: "SYSTEM", deltaSeconds });
const integration = (definition: AbilityDefinition = windupDefinition) => createCombatAbilityIntegration([{ ownerUid: 1, ability: definition }]);
const stunned = (target: AbilityUnit) => executeEffect(
  { type: "APPLY_STATUS", status: "stun", duration: 1, potency: { components: [{ source: "FLAT", coefficient: 1 }] } },
  { caster: unit({ uid: 99, team: "enemy" }), target, statusHandlers: {}, sourceAbilityId: "test-stun" },
);
const stunEvent = (): CombatEvent => ({ type: "STATUS_APPLIED", eventId: eventId++, origin: "SYSTEM", targetUid: 1, sourceUid: 99, status: "STUN", duration: 1, potency: 1 });

describe("V1-B windup and recovery lifecycle", () => {
  it("starts windup without applying effects, then resolves exactly once", () => {
    const subject = integration();
    let state = subject.publish(tick(CAST.interval), [unit()]).units[0];
    expect(state.abilityActiveCast?.phase).toBe("windup");
    expect(state.atk).toBe(100);
    state = subject.publish(tick(CAST.windup + CAST.cast), [state]).units[0];
    expect(state.abilityActiveCast?.phase).toBe("recovery");
    expect(state.atk).toBeCloseTo(120);
    state = subject.publish(tick(0.2), [state]).units[0];
    expect(state.atk).toBeCloseTo(120);
  });

  it("blocks and discards interval opportunities during recovery", () => {
    const subject = integration();
    let state = subject.publish(tick(CAST.interval), [unit()]).units[0];
    state = subject.publish(tick(CAST.windup + CAST.cast), [state]).units[0];
    expect(isBlockedFromCast(state)).toBe(true);
    state = subject.publish(tick(CAST.interval), [state]).units[0];
    expect(state.abilityActiveCast).toBeUndefined();
    expect(state.atk).toBeCloseTo(120);
    state = subject.publish(tick(CAST.interval), [state]).units[0];
    expect(state.abilityActiveCast?.phase).toBe("windup");
  });

  it("STUN prevents a cast and cancels an active windup", () => {
    const blockedSubject = integration();
    let blocked = stunned(unit());
    blocked = blockedSubject.publish(tick(CAST.interval), [blocked]).units[0];
    expect(blocked.abilityActiveCast).toBeUndefined();

    const cancelSubject = integration();
    let casting = cancelSubject.publish(tick(CAST.interval), [unit()]).units[0];
    expect(hasActiveCast(casting)).toBe(true);
    casting = stunned(casting);
    casting = cancelSubject.publish(stunEvent(), [casting]).units[0];
    expect(casting.abilityActiveCast).toBeUndefined();
    expect(casting.atk).toBe(100);
  });

  it("STUN during recovery leaves the recovery lock intact", () => {
    const subject = integration();
    let state = subject.publish(tick(CAST.interval), [unit()]).units[0];
    state = subject.publish(tick(CAST.windup + CAST.cast), [state]).units[0];
    state = stunned(state);
    state = subject.publish(stunEvent(), [state]).units[0];
    expect(state.abilityActiveCast?.phase).toBe("recovery");
  });

  it("knockback does not cancel windup", () => {
    const subject = integration();
    let state = subject.publish(tick(CAST.interval), [unit()]).units[0];
    state = applyKnockback(state, state.currentHp, "enemy", 80);
    expect(state.abilityActiveCast?.phase).toBe("windup");
    state = subject.publish(tick(CAST.windup + CAST.cast), [state]).units[0];
    expect(state.atk).toBeCloseTo(120);
  });

  it("death during windup cancels the cast and prevents resolution", () => {
    const subject = integration();
    let state = subject.publish(tick(CAST.interval), [unit()]).units[0];
    state = subject.publish({ type: "UNIT_DEATH", eventId: eventId++, origin: "SYSTEM", unitUid: 1 }, [{ ...state, currentHp: 0, alive: false }]).units[0];
    expect(state.currentHp).toBe(0);
    expect(state.abilityActiveCast).toBeUndefined();
  });

  it("keeps existing non-cast interval abilities unchanged", () => {
    const warCry = resolveAbilityDefinitions([ABILITY_IDS.darkKnightWarCry])[0];
    const subject = integration(warCry);
    const state = subject.publish(tick(DARK_KNIGHT_WAR_CRY.intervalSeconds), [unit()]).units[0];
    expect(state.atk).toBeCloseTo(115);
    expect(state.abilityActiveCast).toBeUndefined();
  });

  it("cleanup and fresh runtimes do not retain cast state", () => {
    const subject = integration();
    const state = subject.publish(tick(CAST.interval), [unit()]).units[0];
    expect(state.abilityActiveCast).toBeDefined();
    subject.cleanup(new Set());
    expect(subject.runtimeStateSize()).toBe(0);
    expect(createCombatAbilityIntegration([]).runtimeStateSize()).toBe(0);
  });
});
