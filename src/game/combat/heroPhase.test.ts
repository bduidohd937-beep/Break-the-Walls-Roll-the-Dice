import { describe, expect, it } from "vitest";
import type { StageDef, Unit } from "../types";
import { runHeroPhase, selectHeroTarget, type HeroPhaseInput } from "./heroPhase";

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

const stage: StageDef = {
  id: 1,
  name: "Test Stage",
  region: "Test",
  type: "normal",
  waves: [[{ enemy: "goblin", count: 1 }]],
  waveMeta: [{ name: "Test Wave", reward: 0 }],
  enemyCastleHp: 1000,
  clearReward: 0,
  repeatReward: 0,
  firstClearGems: 0
};

function run(overrides: Partial<HeroPhaseInput> = {}) {
  return runHeroPhase({
    heroes: [unit()],
    enemies: [],
    dt: 0.05,
    stage,
    stageIndex: 0,
    waveIndex: 0,
    spawnedInWave: 0,
    totalInWave: 1,
    bossSpawnAnnounced: false,
    enemyCastleHp: 1000,
    nextUid: 1,
    nextPopupUid: 1,
    random: () => 0.99,
    ...overrides
  });
}

describe("hero target selection", () => {
  it("selects the closest enemy ahead for normal melee behavior", () => {
    const hero = unit({ x: 20 });
    const near = unit({ uid: 2, team: "enemy", x: 32 });
    const far = unit({ uid: 3, team: "enemy", x: 45 });
    expect(selectHeroTarget(hero, [far, near])?.uid).toBe(2);
  });

  it("selects the lowest-hp ranged enemy through generic target metadata", () => {
    const hero = unit({ id: "any-hero", targetPriority: "ranged-lowest-hp" });
    const melee = unit({ uid: 2, team: "enemy", x: 22, currentHp: 10 });
    const rangedHigh = unit({ uid: 3, team: "enemy", x: 40, rangeType: "ranged", currentHp: 200 });
    const rangedLow = unit({ uid: 4, team: "enemy", x: 50, rangeType: "ranged", currentHp: 100 });
    expect(selectHeroTarget(hero, [melee, rangedHigh, rangedLow])?.uid).toBe(4);
  });
});

describe("hero movement", () => {
  it("moves a melee hero toward an out-of-range enemy", () => {
    const result = run({ enemies: [unit({ uid: 2, team: "enemy", x: 50 })] });
    expect(result.heroes[0].x).toBeGreaterThan(20);
  });

  it("stops moving after a melee hero enters attack range", () => {
    const result = run({
      heroes: [unit({ x: 20, attackTimer: 0.5 })],
      enemies: [unit({ uid: 2, team: "enemy", x: 21.5 })]
    });
    expect(result.heroes[0].x).toBe(20);
  });

  it("stops a ranged hero at its attack range", () => {
    const result = run({
      heroes: [unit({ x: 20, range: 150, rangeType: "ranged", attackTimer: 0.5 })],
      enemies: [unit({ uid: 2, team: "enemy", x: 34 })]
    });
    expect(result.heroes[0].x).toBe(20);
  });

  it("moves toward the enemy castle when no enemy exists", () => {
    expect(run().heroes[0].x).toBeGreaterThan(20);
  });

  it("resumes normal movement after knockback ends", () => {
    const blocked = run({ heroes: [unit({ knockbackTimer: 0.1 })] });
    const resumed = run({ heroes: [unit({ knockbackTimer: 0 })] });
    expect(blocked.heroes[0].x).toBe(20);
    expect(resumed.heroes[0].x).toBeGreaterThan(20);
  });
});

describe("hero attacks", () => {
  it("does not attack while its cooldown is active", () => {
    const enemy = unit({ uid: 2, team: "enemy", x: 21 });
    const result = run({ heroes: [unit({ attackTimer: 0.2 })], enemies: [enemy] });
    expect(result.enemies[0].currentHp).toBe(enemy.currentHp);
    expect(result.heroes[0].attackTimer).toBe(0.2);
  });

  it("applies damage and resets attack and animation timing", () => {
    const result = run({
      heroes: [unit({ attackInterval: 1.4, attackAnimationSequence: 3 })],
      enemies: [unit({ uid: 2, team: "enemy", x: 21 })]
    });
    expect(result.enemies[0].currentHp).toBe(300);
    expect(result.heroes[0]).toMatchObject({
      attackTimer: 1.4,
      attackFlash: 0.16,
      attackAnimationTimer: 1.4,
      attackAnimationSequence: 4,
      attackTargetX: 21
    });
  });

  it("damages only enemies inside the existing splash radius", () => {
    const result = run({
      heroes: [unit({ attackType: "splash", splashRadius: 3 })],
      enemies: [
        unit({ uid: 2, team: "enemy", x: 21 }),
        unit({ uid: 3, team: "enemy", x: 23 }),
        unit({ uid: 4, team: "enemy", x: 25 })
      ]
    });
    expect(result.enemies.map((enemy) => enemy.currentHp)).toEqual([300, 300, 400]);
  });

  it("lets multiple heroes act independently in the same frame", () => {
    const result = run({
      heroes: [unit({ uid: 1, x: 20 }), unit({ uid: 2, x: 20 })],
      enemies: [unit({ uid: 3, team: "enemy", x: 21, hp: 500, currentHp: 500 })]
    });
    expect(result.enemies[0].currentHp).toBe(300);
    expect(result.heroes.every((hero) => hero.attackTimer === 1)).toBe(true);
  });

  it("uses the normal behavior for a summoned unit", () => {
    const result = run({
      heroes: [unit({ uid: 7, summonOwnerUid: 1 })],
      enemies: [unit({ uid: 8, team: "enemy", x: 21 })]
    });
    expect(result.enemies[0].currentHp).toBe(300);
    expect(result.heroes[0].summonOwnerUid).toBe(1);
  });

  it("preserves generic burn behavior", () => {
    const result = run({
      heroes: [unit({ effect: "burn" })],
      enemies: [unit({ uid: 2, team: "enemy", x: 21 })]
    });
    expect(result.enemies[0]).toMatchObject({ burnTimer: 3, burnDamage: 12 });
  });
});

describe("enemy castle attacks", () => {
  it("applies the existing castle damage and animation when the final lane is clear", () => {
    const result = run({
      heroes: [unit({ x: 85, atk: 100 })],
      spawnedInWave: 1
    });
    expect(result.enemyCastleHp).toBe(820);
    expect(result.enemyCastleHit).toBe(true);
    expect(result.heroes[0]).toMatchObject({ attackTimer: 1, attackFlash: 0.16, attackTargetX: 87 });
  });

  it("does not damage the castle before the current wave finishes spawning", () => {
    const result = run({ heroes: [unit({ x: 85 })], spawnedInWave: 0 });
    expect(result.enemyCastleHp).toBe(1000);
    expect(result.enemyCastleHit).toBe(false);
  });
});
