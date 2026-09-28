import { describe, expect, it } from "vitest";
import type { Unit } from "../types";
import { resolveFrontlineCollision, resolveSameTeamSpacing } from "./collision";
import { incomingDamage, outgoingDamage, regenAmount } from "./damage";
import { applyKnockback, updateKnockback } from "./knockback";
import { advanceEnemyStatus, advanceHeroStatus } from "./statusTick";
import { spawnWaveEnemy } from "./waveSpawner";
import { ENEMY_MAP, WAVE_ATK_SCALE, WAVE_HP_SCALE } from "../constants";
import { STAGE_ATK_SCALE, STAGE_HP_SCALE } from "../stages";
import type { Wave, WaveMeta } from "../types";

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
    x: 50,
    currentHp: 400,
    attackTimer: 0,
    cooldownTimer: 0,
    hitFlash: 0,
    attackFlash: 0,
    attackTargetX: 50,
    knockbackCount: 0,
    knockbackTimer: 0,
    knockbackFromX: 50,
    knockbackTargetX: 50,
    alive: true,
    burnTimer: 0,
    burnDamage: 0,
    slowTimer: 0,
    slowMultiplier: 1,
    specialTimer: 0,
    ...overrides
  };
}

describe("damage rules", () => {
  it("reduces incoming damage for guard units", () => {
    expect(incomingDamage(unit({ ability: "guard", abilityValue: 0.3 }), 100)).toBeCloseTo(70);
  });

  it("makes critical hits deterministic when a random source is provided", () => {
    const attacker = unit({ ability: "crit", abilityValue: 0.5 });
    expect(outgoingDamage(attacker, unit(), 100, () => 0.1)).toBe(200);
    expect(outgoingDamage(attacker, unit(), 100, () => 0.9)).toBe(100);
  });

  it("keeps execute and elemental multipliers in their current order", () => {
    const attacker = unit({ ability: "execute", abilityValue: 0.25, element: "fire" });
    const target = unit({ element: "dark", currentHp: 100 });
    expect(outgoingDamage(attacker, target, 100)).toBeCloseTo(187.5);
  });

  it("calculates regeneration from maximum hp and elapsed time", () => {
    expect(regenAmount(unit({ hp: 1000, ability: "regen", abilityValue: 0.02 }), 0.5)).toBe(10);
  });
});

describe("knockback rules", () => {
  it("starts knockback when damage crosses the next hp threshold", () => {
    const result = applyKnockback(unit(), 290, "hero", 100);
    expect(result.currentHp).toBe(290);
    expect(result.knockbackCount).toBe(1);
    expect(result.knockbackTimer).toBeCloseTo(0.22);
    expect(result.knockbackTargetX).toBeGreaterThan(result.x);
  });

  it("keeps guard units anchored against the same hit", () => {
    const result = applyKnockback(unit({ ability: "guard" }), 290, "hero", 100);
    expect(result.knockbackCount).toBe(0);
    expect(result.knockbackTimer).toBe(0);
  });

  it("finishes movement at the stored knockback target", () => {
    const moving = unit({ knockbackTimer: 0.22, knockbackFromX: 50, knockbackTargetX: 57 });
    const result = updateKnockback(moving, 0.22);
    expect(result.knockbackTimer).toBe(0);
    expect(result.x).toBeCloseTo(57);
  });
});

describe("unit status ticks", () => {
  it("updates hero timers, regeneration, and burn in the existing order", () => {
    const result = advanceHeroStatus(unit({
      currentHp: 300,
      ability: "regen",
      abilityValue: 0.1,
      attackTimer: 1,
      specialTimer: 2,
      burnTimer: 0.5,
      burnDamage: 20
    }), 0.5);
    expect(result.attackTimer).toBeCloseTo(0.5);
    expect(result.specialTimer).toBeCloseTo(1.5);
    expect(result.currentHp).toBeCloseTo(310);
    expect(result.burnTimer).toBe(0);
  });

  it("updates enemy slow and burn timers without applying regeneration", () => {
    const result = advanceEnemyStatus(unit({
      team: "enemy",
      currentHp: 300,
      ability: "regen",
      abilityValue: 0.1,
      slowTimer: 1,
      burnTimer: 1,
      burnDamage: 20
    }), 0.5);
    expect(result.slowTimer).toBeCloseTo(0.5);
    expect(result.currentHp).toBeCloseTo(290);
    expect(result.burnTimer).toBeCloseTo(0.5);
  });

  it("keeps visual flash decay tied to the fixed render tick", () => {
    const result = advanceHeroStatus(unit({ hitFlash: 0.2, attackFlash: 0.2 }), 0.25);
    expect(result.hitFlash).toBeCloseTo(0.15);
    expect(result.attackFlash).toBeCloseTo(0.15);
  });
});

describe("battlefield collision rules", () => {
  it("separates stacked units on the same team", () => {
    const result = resolveSameTeamSpacing([unit({ uid: 1, x: 50 }), unit({ uid: 2, x: 50 })]);
    expect(Math.abs(result[1].x - result[0].x)).toBeGreaterThanOrEqual(3.2);
  });

  it("keeps opposing frontlines at their current minimum gap", () => {
    const result = resolveFrontlineCollision(
      [unit({ uid: 1, team: "hero", x: 50 })],
      [unit({ uid: 2, team: "enemy", x: 51 })]
    );
    expect(result.enemies[0].x - result.heroes[0].x).toBeCloseTo(2.8);
  });

  it("allows assassin units to pass through the frontline", () => {
    const result = resolveFrontlineCollision(
      [unit({ id: "assassin", uid: 1, team: "hero", x: 52 })],
      [unit({ uid: 2, team: "enemy", x: 51 })]
    );
    expect(result.heroes[0].x).toBe(52);
  });
});

describe("wave spawning rules", () => {
  const wave: Wave = [
    { enemy: "goblin", count: 2, gap: 0.4 },
    { enemy: "orc", count: 1 }
  ];

  it("does not spawn before the timer reaches zero", () => {
    const result = spawnWaveEnemy({
      stageIndex: 0,
      waveIndex: 0,
      wave,
      waveMeta: { name: "test", reward: 0 },
      spawnedInWave: 0,
      spawnTimer: 0.1,
      uid: 1000,
      random: () => 0
    });
    expect(result.enemy).toBeUndefined();
    expect(result.totalInWave).toBe(3);
    expect(result.spawnedInWave).toBe(0);
  });

  it("preserves grouped enemy order and the default spawn gap", () => {
    const values = [0.5, 0.2];
    const result = spawnWaveEnemy({
      stageIndex: 0,
      waveIndex: 0,
      wave,
      waveMeta: { name: "test", reward: 0 },
      spawnedInWave: 2,
      spawnTimer: 0,
      uid: 1002,
      random: () => values.shift() ?? 0
    });
    expect(result.enemy?.id).toBe(ENEMY_MAP.orc.id);
    expect(result.enemy?.x).toBe(92);
    expect(result.enemy?.attackTimer).toBeCloseTo(0.1);
    expect(result.spawnedInWave).toBe(3);
    expect(result.spawnTimer).toBe(0.8);
  });

  it("applies the current stage, wave, and boss stat multipliers", () => {
    const waveMeta: WaveMeta = { name: "boss", reward: 0, boss: true };
    const stageIndex = 2;
    const waveIndex = 1;
    const result = spawnWaveEnemy({
      stageIndex,
      waveIndex,
      wave: [{ enemy: "goblin", count: 1 }],
      waveMeta,
      spawnedInWave: 0,
      spawnTimer: 0,
      uid: 1000,
      random: () => 0
    });
    const hpScale = 1 + stageIndex * STAGE_HP_SCALE + waveIndex * WAVE_HP_SCALE + 0.35;
    const atkScale = 1 + stageIndex * STAGE_ATK_SCALE + waveIndex * WAVE_ATK_SCALE + 0.15;
    expect(result.enemy?.hp).toBe(Math.round(ENEMY_MAP.goblin.hp * hpScale));
    expect(result.enemy?.atk).toBe(Math.round(ENEMY_MAP.goblin.atk * atkScale));
  });
});
