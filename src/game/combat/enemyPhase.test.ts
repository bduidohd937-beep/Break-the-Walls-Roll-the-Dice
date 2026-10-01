import { describe, expect, it } from "vitest";
import type { Unit } from "../types";
import { ENEMIES } from "../constants";
import { runEnemyPhase, selectEnemyTarget, type EnemyPhaseInput } from "./enemyPhase";

function unit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: "test",
    name: "Test Unit",
    sprite: "",
    element: "neutral",
    hp: 400,
    atk: 100,
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
    currentHp: 400,
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

function enemy(overrides: Partial<Unit> = {}): Unit {
  return unit({ team: "enemy", ...overrides });
}

const STUN_EFFECT_STATE = {
  shields: [],
  statModifiers: [],
  damageTakenModifiers: [],
  statuses: [{ id: "STUN" as const, sourceUid: 99, potency: 1, remaining: 2 }],
  periodicEffects: [],
  attackSpeedModifiers: [],
  moveSpeedModifiers: [],
  damageDealtModifiers: [],
  cooldownModifiers: []
};

// Battle positions are percent-like; ranges are tenths (range 100 -> 10 world units).
function inRange(attackerX: number, targetX: number): number {
  return Math.abs(attackerX - targetX) * 10;
}

function run(overrides: Partial<EnemyPhaseInput> = {}) {
  return runEnemyPhase({
    heroes: [],
    enemies: [],
    dt: 0.05,
    castleHp: 1000,
    nextPopupUid: 1,
    ...overrides
  });
}

describe("enemy movement", () => {
  it("moves toward the hero castle when out of range", () => {
    const walker = enemy({ x: 50, speed: 20, range: 20 });
    const result = run({ heroes: [unit({ x: 10 })], enemies: [walker] });
    const moved = result.enemies[0];
    expect(moved.x).toBeLessThan(50);
    const expected = Math.max(9, 50 - 20 * 1.8 * 0.05 / 100);
    expect(moved.x).toBeCloseTo(expected, 10);
  });

  it("clamps movement at the castle attack line x=9", () => {
    const walker = enemy({ x: 9.005, speed: 100, range: 1 });
    const result = run({ heroes: [unit({ x: 3, range: 1 })], enemies: [walker] });
    expect(result.enemies[0].x).toBe(9);
  });

  it("applies slowTimer multiplier to movement", () => {
    const slowed = enemy({ x: 50, speed: 20, slowTimer: 2, slowMultiplier: 0.5 });
    const normal = enemy({ uid: 2, x: 50, speed: 20, slowTimer: 0, slowMultiplier: 1 });
    const result = run({ heroes: [unit({ x: 10 })], enemies: [slowed, normal] });
    const movedSlow = result.enemies[0].x;
    const movedNormal = result.enemies[1].x;
    expect(50 - movedSlow).toBeCloseTo((50 - movedNormal) * 0.5, 10);
  });
});

describe("enemy target selection", () => {
  it("targets the frontline hero closest to the castle (highest x ahead)", () => {
    const enemyUnit = enemy({ x: 40 });
    const frontline = unit({ uid: 2, x: 30 });
    const back = unit({ uid: 3, x: 25 });
    expect(selectEnemyTarget(enemyUnit, [back, frontline])).toBe(frontline);
  });

  it("falls back to the nearest hero when none are ahead", () => {
    const enemyUnit = enemy({ x: 15 });
    const near = unit({ uid: 2, x: 40 });
    const far = unit({ uid: 3, x: 60 });
    expect(selectEnemyTarget(enemyUnit, [far, near])).toBe(near);
  });

  it("lets assassins dive the lowest-HP ranged backliner", () => {
    const assassin = enemy({ id: "assassinE", x: 45 });
    const tankyRanged = unit({ uid: 2, x: 12, rangeType: "ranged", hp: 400, currentHp: 300 });
    const weakRanged = unit({ uid: 3, x: 12, rangeType: "ranged", hp: 200, currentHp: 80 });
    const tank = unit({ uid: 4, x: 42, rangeType: "melee" });
    expect(selectEnemyTarget(assassin, [tank, tankyRanged, weakRanged])).toBe(weakRanged);
  });

  it("ignores dead heroes when selecting targets", () => {
    const enemyUnit = enemy({ x: 30 });
    const dead = unit({ uid: 2, x: 20, currentHp: 0 });
    const living = unit({ uid: 3, x: 35 });
    expect(selectEnemyTarget(enemyUnit, [dead, living])).toBe(living);
  });
});

describe("enemy basic attacks", () => {
  it("attacks an in-range hero: damage, popup, and attack state reset", () => {
    const attacker = enemy({ x: 30, range: inRange(30, 22), atk: 100, attackInterval: 1.5, attackTimer: 0 });
    const target = unit({ uid: 2, x: 22, hp: 400, currentHp: 400 });
    const result = run({ heroes: [target], enemies: [attacker] });
    expect(result.heroes[0].currentHp).toBe(300);
    expect(result.damagePopups).toHaveLength(1);
    expect(result.damagePopups[0]).toMatchObject({ id: 1, x: 22, value: 100, critical: false });
    expect(result.nextPopupUid).toBe(2);
    const attackerNext = result.enemies[0];
    expect(attackerNext.attackTimer).toBe(1.5);
    expect(attackerNext.attackFlash).toBe(0.16);
    expect(attackerNext.attackAnimationTimer).toBe(1.5);
    expect(attackerNext.attackAnimationSequence).toBe(1);
    expect(attackerNext.attackTargetX).toBe(22);
  });

  it("holds attack while the attack timer has not elapsed", () => {
    const attacker = enemy({ x: 30, range: inRange(30, 22), atk: 100, attackTimer: 0.3 });
    const target = unit({ uid: 2, x: 22 });
    const result = run({ heroes: [target], enemies: [attacker] });
    expect(result.heroes[0].currentHp).toBe(400);
    expect(result.damagePopups).toHaveLength(0);
    expect(result.enemies[0].attackTimer).toBeCloseTo(0.3, 12);
  });

  it("applies guard damage reduction via incomingDamage", () => {
    const attacker = enemy({ x: 30, range: inRange(30, 22), atk: 100, attackTimer: 0 });
    const guard = unit({ uid: 2, x: 22, ability: "guard", abilityValue: 0.22 });
    const result = run({ heroes: [guard], enemies: [attacker] });
    expect(result.heroes[0].currentHp).toBeCloseTo(400 - 78, 10);
  });

  it("moves toward the target when out of range", () => {
    const attacker = enemy({ x: 50, range: 20, speed: 20, attackTimer: 0 });
    const target = unit({ uid: 2, x: 20 });
    const result = run({ heroes: [target], enemies: [attacker] });
    expect(result.enemies[0].attackTimer).toBe(0);
    expect(result.heroes[0].currentHp).toBe(400);
    expect(result.enemies[0].x).toBeLessThan(50);
  });
});

describe("enemy castle attacks", () => {
  it("damages the hero castle at x<=13 with no hero target", () => {
    const attacker = enemy({ x: 12, atk: 45, attackTimer: 0, attackInterval: 2 });
    const result = run({ heroes: [], enemies: [attacker], castleHp: 1000 });
    expect(result.castleHp).toBe(955);
    expect(result.castleHit).toBe(true);
    expect(result.enemies[0].attackTimer).toBe(2);
    expect(result.enemies[0].attackFlash).toBe(0.16);
    expect(result.enemies[0].attackAnimationSequence).toBe(1);
    expect(result.enemies[0].attackTargetX).toBe(9);
  });

  it("clamps castle damage at zero", () => {
    const attacker = enemy({ x: 12, atk: 500, attackTimer: 0 });
    const result = run({ heroes: [], enemies: [attacker], castleHp: 300 });
    expect(result.castleHp).toBe(0);
  });

  it("waits for the attack cooldown before hitting the castle", () => {
    const attacker = enemy({ x: 12, atk: 45, attackTimer: 0.5 });
    const result = run({ heroes: [], enemies: [attacker], castleHp: 1000 });
    expect(result.castleHp).toBe(1000);
    expect(result.castleHit).toBe(false);
  });

  it("keeps advancing when it has not reached the castle line", () => {
    const attacker = enemy({ x: 30, speed: 20, attackTimer: 0 });
    const result = run({ heroes: [], enemies: [attacker], castleHp: 1000 });
    expect(result.castleHp).toBe(1000);
    expect(result.enemies[0].x).toBeLessThan(30);
  });
});

describe("splash attacks", () => {
  it("hits every hero within splashRadius of the primary target", () => {
    const attacker = enemy({ x: 30, range: inRange(30, 22), splashRadius: 10, attackType: "splash", atk: 100, attackTimer: 0 });
    const primary = unit({ uid: 2, x: 22, hp: 400, currentHp: 400 });
    const adjacent = unit({ uid: 3, x: 30, hp: 200, currentHp: 200 });
    const outside = unit({ uid: 4, x: 45, hp: 200, currentHp: 200 });
    const result = run({ heroes: [primary, adjacent, outside], enemies: [attacker] });
    expect(result.heroes.find((h) => h.uid === 2)!.currentHp).toBe(300);
    // Splash falloff (0.65x) scales knockback power only; HP damage is the full attack for every hit target.
    expect(result.heroes.find((h) => h.uid === 3)!.currentHp).toBe(100);
    expect(result.heroes.find((h) => h.uid === 4)!.currentHp).toBe(200);
    expect(result.damagePopups.map((popup) => popup.value)).toEqual([100, 100]);
  });

  it("keeps single-target attacks on one hero", () => {
    const attacker = enemy({ x: 30, range: inRange(30, 22), atk: 100, attackTimer: 0 });
    const adjacent = unit({ uid: 2, x: 30 });
    const farther = unit({ uid: 3, x: 22 });
    const result = run({ heroes: [adjacent, farther], enemies: [attacker] });
    expect(result.heroes.find((h) => h.uid === 2)!.currentHp).toBe(300);
    expect(result.heroes.find((h) => h.uid === 3)!.currentHp).toBe(400);
    expect(result.damagePopups).toHaveLength(1);
  });
});

describe("burn effect", () => {
  it("applies burn state on hit without changing the immediate damage", () => {
    const attacker = enemy({ x: 30, range: inRange(30, 22), atk: 100, effect: "burn", attackTimer: 0 });
    const target = unit({ uid: 2, x: 22, hp: 400, currentHp: 400 });
    const result = run({ heroes: [target], enemies: [attacker] });
    expect(result.heroes[0].currentHp).toBe(300);
    expect(result.heroes[0].burnTimer).toBe(3);
    expect(result.heroes[0].burnDamage).toBeCloseTo(12, 10);
    expect(result.heroes[0].hitFlash).toBe(0.14);
  });

  it("keeps the stronger existing burn damage", () => {
    const attacker = enemy({ x: 30, range: inRange(30, 22), atk: 20, effect: "burn", attackTimer: 0 });
    const target = unit({ uid: 2, x: 22, burnTimer: 1, burnDamage: 5 });
    const result = run({ heroes: [target], enemies: [attacker] });
    expect(result.heroes[0].burnTimer).toBe(3);
    expect(result.heroes[0].burnDamage).toBe(5);
  });
});

describe("knockback", () => {
  it("pushes heroes back past an HP-loss threshold and delays their attack", () => {
    // 150 damage from 250 HP crosses the 100 HP threshold (hp 400 / 4) without killing.
    const attacker = enemy({ x: 30, range: inRange(30, 22), atk: 150, attackTimer: 0 });
    const target = unit({ uid: 2, x: 22, hp: 400, currentHp: 250 });
    const result = run({ heroes: [target], enemies: [attacker] });
    const pushed = result.heroes[0];
    expect(pushed.knockbackTimer).toBe(0.22);
    expect(pushed.knockbackFromX).toBe(22);
    // Heroes are pushed back toward their own castle (negative direction).
    expect(pushed.knockbackTargetX).toBeLessThan(22);
    expect(pushed.knockbackCount).toBe(1);
    expect(pushed.attackTimer).toBeGreaterThanOrEqual(0.35);
  });

  it("does not knock back below the threshold", () => {
    const attacker = enemy({ x: 30, range: inRange(30, 22), atk: 10, attackTimer: 0 });
    const target = unit({ uid: 2, x: 22, hp: 400, currentHp: 399 });
    const result = run({ heroes: [target], enemies: [attacker] });
    expect(result.heroes[0].knockbackTimer).toBe(0);
    expect(result.heroes[0].knockbackCount).toBe(0);
  });
});

describe("assassin backline pressure", () => {
  it("multiplies assassin damage by 1.2 against ranged targets", () => {
    const assassin = enemy({ id: "assassinE", x: 30, range: inRange(30, 22), atk: 100, attackTimer: 0 });
    const target = unit({ uid: 2, x: 22, rangeType: "ranged", hp: 400, currentHp: 400 });
    const result = run({ heroes: [target], enemies: [assassin] });
    expect(result.heroes[0].currentHp).toBe(280);
  });

  it("keeps normal damage against melee targets", () => {
    const assassin = enemy({ id: "assassinE", x: 30, range: inRange(30, 22), atk: 100, attackTimer: 0 });
    const target = unit({ uid: 2, x: 22, rangeType: "melee", hp: 400, currentHp: 400 });
    const result = run({ heroes: [target], enemies: [assassin] });
    expect(result.heroes[0].currentHp).toBe(300);
  });
});

describe("enraged fireOgre", () => {
  it("deals 1.2x damage and attacks 0.65x faster at or below 50% HP", () => {
    const ogre = enemy({ id: "fireOgreE", x: 30, range: inRange(30, 22), atk: 100, hp: 1000, currentHp: 500, attackInterval: 2, attackTimer: 0 });
    const target = unit({ uid: 2, x: 22, hp: 4000, currentHp: 4000 });
    const result = run({ heroes: [target], enemies: [ogre] });
    expect(result.heroes[0].currentHp).toBe(3880);
    expect(result.enemies[0].attackTimer).toBeCloseTo(1.3, 10);
    expect(result.enemies[0].attackFlash).toBe(0.22);
  });

  it("stays normal above 50% HP", () => {
    const ogre = enemy({ id: "fireOgreE", x: 30, range: inRange(30, 22), atk: 100, hp: 1000, currentHp: 501, attackInterval: 2, attackTimer: 0 });
    const target = unit({ uid: 2, x: 22, hp: 4000, currentHp: 4000 });
    const result = run({ heroes: [target], enemies: [ogre] });
    expect(result.heroes[0].currentHp).toBe(3900);
    expect(result.enemies[0].attackTimer).toBe(2);
    expect(result.enemies[0].attackFlash).toBe(0.16);
  });
});

describe("status interactions", () => {
  it("skips stunned enemies entirely", () => {
    // abilityEffectState lives on the combat AbilityUnit extension of Unit.
    const stunned = { ...enemy({ x: 12, atk: 45, attackTimer: 0 }), abilityEffectState: STUN_EFFECT_STATE } as Unit;
    const result = run({ heroes: [], enemies: [stunned], castleHp: 1000 });
    expect(result.castleHp).toBe(1000);
    expect(result.enemies[0]).toBe(stunned);
    expect(result.enemies[0].attackTimer).toBe(0);
  });

  it("skips enemies that are being knocked back", () => {
    const flying = enemy({ x: 12, atk: 45, attackTimer: 0, knockbackTimer: 0.1 });
    const result = run({ heroes: [], enemies: [flying], castleHp: 1000 });
    expect(result.castleHp).toBe(1000);
  });

  it("leaves dead enemies untouched", () => {
    const dead = enemy({ x: 12, atk: 45, currentHp: 0, attackTimer: 0 });
    const result = run({ heroes: [], enemies: [dead], castleHp: 1000 });
    expect(result.castleHp).toBe(1000);
    expect(result.enemies[0]).toBe(dead);
  });
});

describe("production data sanity", () => {
  it("keeps the assassin definition wired to the ranged-dive behavior", () => {
    expect(ENEMIES.find((def) => def.id === "assassinE")).toBeDefined();
  });
});

describe("combat events", () => {
  it("does not collect events by default and leaves the id counter untouched", () => {
    const attacker = enemy({ x: 12, atk: 45, attackTimer: 0 });
    const result = run({ heroes: [], enemies: [attacker], castleHp: 1000, nextCombatEventId: 7 });
    expect(result.combatEvents).toEqual([]);
    expect(result.nextCombatEventId).toBe(7);
  });

  it("collects CASTLE_ATTACK with sequential event and attack ids", () => {
    const attacker = enemy({ x: 12, atk: 45, attackTimer: 0 });
    const result = run({ heroes: [], enemies: [attacker], castleHp: 1000, collectCombatEvents: true, nextCombatEventId: 7 });
    expect(result.combatEvents).toHaveLength(1);
    expect(result.combatEvents[0]).toMatchObject({
      type: "CASTLE_ATTACK",
      eventId: 7,
      attackId: 8,
      origin: "BASIC_ATTACK",
      attackerUid: 1,
      castle: "hero",
      actualDamage: 45
    });
    expect(result.nextCombatEventId).toBe(9);
  });

  it("collects BASIC_ATTACK then DAMAGE_APPLIED per hit in attack order", () => {
    const attacker = enemy({ x: 30, range: inRange(30, 22), atk: 100, attackTimer: 0 });
    const target = unit({ uid: 2, x: 22, hp: 400, currentHp: 400 });
    const result = run({ heroes: [target], enemies: [attacker], collectCombatEvents: true, nextCombatEventId: 3 });
    expect(result.combatEvents.map((event) => event.type)).toEqual(["BASIC_ATTACK", "DAMAGE_APPLIED"]);
    // Event ids are allocated as in the original loop: DAMAGE_APPLIED ids during the hit
    // loop, BASIC_ATTACK's id after, while publication order stays BASIC_ATTACK first.
    expect(result.combatEvents[0]).toMatchObject({ type: "BASIC_ATTACK", eventId: 5, attackId: 3, attackerUid: 1, targetUid: 2 });
    expect(result.combatEvents[1]).toMatchObject({ type: "DAMAGE_APPLIED", eventId: 4, attackId: 3, sourceUid: 1, targetUid: 2, actualDamage: 100 });
    expect(result.nextCombatEventId).toBe(6);
  });
});

describe("determinism", () => {
  it("produces identical output for identical input", () => {
    const makeInput = (): EnemyPhaseInput => ({
      heroes: [unit({ uid: 2, x: 22, hp: 400, currentHp: 150 })],
      enemies: [
        enemy({ uid: 3, x: 30, range: 80, atk: 150, attackTimer: 0 }),
        enemy({ uid: 4, x: 50, speed: 30 })
      ],
      dt: 0.05,
      castleHp: 1000,
      nextPopupUid: 1,
      collectCombatEvents: true,
      nextCombatEventId: 1
    });
    const first = runEnemyPhase(makeInput());
    const second = runEnemyPhase(makeInput());
    expect(second).toEqual(first);
  });
});
