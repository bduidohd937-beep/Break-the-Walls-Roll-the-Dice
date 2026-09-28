import { describe, expect, it } from "vitest";
import { HEROES } from "../constants";
import { createAbilityRuntime } from "../combat/abilities/runtime";
import { ABILITY_IDS, KINGDOM_ARCHER_PIERCING_ARROW, resolveAbilityDefinitions } from "../combat/abilities/definitions";
import { runHeroPhase } from "../combat/heroPhase";
import { applyAbilityKnockback } from "../combat/knockback";
import { advanceHeroStatus } from "../combat/statusTick";
import { makeUnit } from "../units/createUnit";
import { savedIds } from "../systems/saveData";
import type { StageDef, Unit, UnitDef } from "../types";

const archer = HEROES.find((hero) => hero.id === "HERO_003")!;
const enemyDef: UnitDef = { id: "fixture_enemy", name: "fixture", sprite: "x", element: "neutral", hp: 200, atk: 1, speed: 1, range: 1, rangeType: "melee", attackInterval: 1, cost: 0, cooldown: 0, role: "fixture" };
const stage: StageDef = { id: 1, name: "fixture", region: "fixture", type: "normal", waves: [[]], waveMeta: [], enemyCastleHp: 1000, clearReward: 0, repeatReward: 0, firstClearGems: 0 };
const unit = (def: UnitDef, uid: number, team: "hero" | "enemy", x: number): Unit => makeUnit(def, team, x, uid, () => 0);

describe("HERO_003 kingdom archer integration", () => {
  it("registers production metadata, save id, UI assets, and animation contract", () => {
    expect(archer).toMatchObject({ name: "왕국 궁수", rarity: "COMMON", race: "HUMAN", element: "neutral", combatRole: "RANGED_DPS", rangeType: "ranged" });
    expect(savedIds(["HERO_003"])).toEqual(["HERO_003"]);
    expect(archer.spriteConfig).toMatchObject({ frameWidth: 224, frameHeight: 224, pivotX: 0.5, pivotY: 1, facing: "RIGHT" });
    expect(archer.spriteConfig?.animations).toMatchObject({ idle: { frameCount: 4, fps: 6 }, move: { frameCount: 6, fps: 10 }, attack: { frameCount: 6, fps: 12, projectileSpawnFrame: 5 }, skill1: { frameCount: 8, fps: 12, projectileSpawnFrame: 6 }, hit: { frameCount: 2, fps: 10 }, knockback: { frameCount: 4, fps: 10 }, death: { frameCount: 6, fps: 8 } });
    expect(Object.keys(archer.spriteConfig?.ui ?? {}).sort()).toEqual(["deploy", "portrait", "skill1", "soul", "soulFragment"]);
  });

  it("deploys and performs its ranged basic attack through the existing hero phase", () => {
    const hero = unit(archer, 1, "hero", 20);
    const enemy = unit(enemyDef, 2, "enemy", 35);
    const result = runHeroPhase({ heroes: [hero], enemies: [enemy], dt: 0.05, stage, stageIndex: 0, waveIndex: 0, spawnedInWave: 0, totalInWave: 1, bossSpawnAnnounced: false, enemyCastleHp: 1000, nextUid: 1, nextPopupUid: 1, nextCombatEventId: 1 });
    expect(result.enemies[0].currentHp).toBeLessThan(enemy.currentHp);
    expect(result.heroes[0]).toMatchObject({ attackTargetX: enemy.x, attackAnimationSequence: 1 });
    expect(result.combatEvents.some((event) => event.type === "BASIC_ATTACK")).toBe(true);
  });

  it("pierces multiple targets, applies Slow, and starts the visual-only skill animation", () => {
    const hero = unit(archer, 1, "hero", 20);
    const enemies = [unit(enemyDef, 2, "enemy", 25), unit(enemyDef, 3, "enemy", 30), unit(enemyDef, 4, "enemy", 35)];
    const ability = resolveAbilityDefinitions([ABILITY_IDS.kingdomArcherPiercingArrow])[0];
    const runtime = createAbilityRuntime([{ ownerUid: hero.uid, ability }]);
    const result = runtime.dispatch({ type: "ON_INTERVAL", elapsedSeconds: KINGDOM_ARCHER_PIERCING_ARROW.cooldownSeconds }, { units: [hero, ...enemies] });
    expect(result.activations[0]?.targetUids).toEqual([2, 3, 4]);
    for (const target of result.units.filter((entry) => entry.team === "enemy")) {
      expect(target.currentHp).toBeLessThan(200);
      expect(target.abilityEffectState?.statuses.some((status) => status.id === "SLOW" && status.potency === KINGDOM_ARCHER_PIERCING_ARROW.slowMultiplier)).toBe(true);
    }
    expect(result.units.find((entry) => entry.uid === hero.uid)).toMatchObject({ abilityAnimationState: "skill1", abilityAnimationTimer: 8 / 12, attackTargetX: 35 });
  });

  it("keeps 1x and 5x simulation outcomes identical", () => {
    const simulate = (steps: number, delta: number) => {
      const hero = unit(archer, 1, "hero", 20);
      const enemy = unit(enemyDef, 2, "enemy", 25);
      const ability = resolveAbilityDefinitions([ABILITY_IDS.kingdomArcherPiercingArrow])[0];
      const runtime = createAbilityRuntime([{ ownerUid: hero.uid, ability }]);
      let units: readonly Unit[] = [hero, enemy];
      for (let index = 0; index < steps; index++) units = runtime.dispatch({ type: "ON_INTERVAL", elapsedSeconds: delta }, { units }).units;
      return units;
    };
    expect(simulate(120, 0.05).map(({ uid, currentHp }) => ({ uid, currentHp }))).toEqual(simulate(24, 0.25).map(({ uid, currentHp }) => ({ uid, currentHp })));
  });

  it("recovers from knockback and holds a six-frame death animation", () => {
    const knocked = applyAbilityKnockback(unit(archer, 1, "hero", 20), 5, "enemy");
    expect(advanceHeroStatus(knocked, 0.22).knockbackTimer).toBe(0);
    expect(archer.spriteConfig?.animations.knockback?.frameCount).toBe(4);
    expect(archer.spriteConfig?.animations.death).toMatchObject({ frameCount: 6, fps: 8, loop: false });
  });
});
