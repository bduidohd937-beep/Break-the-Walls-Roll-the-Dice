import { ENEMY_MAP, MOVE_SPEED_MULTIPLIER, WAVE_ATK_SCALE, WAVE_HP_SCALE } from "../constants";
import { STAGE_ATK_SCALE, STAGE_HP_SCALE } from "../stages";
import type { EnemyKey, StageDef, Unit } from "../types";
import { makeUnit } from "../units/createUnit";
import { outgoingDamage } from "./damage";
import { applyKnockback } from "./knockback";
import type { DamagePopup } from "./types";
import type { CombatEvent } from "./abilities/combatEvents";

export type HeroPhaseInput = {
  heroes: Unit[];
  enemies: Unit[];
  dt: number;
  stage: StageDef;
  stageIndex: number;
  waveIndex: number;
  spawnedInWave: number;
  totalInWave: number;
  bossKey?: EnemyKey;
  bossSpawnAnnounced: boolean;
  enemyCastleHp: number;
  nextUid: number;
  nextPopupUid: number;
  nextCombatEventId?: number;
  collectCombatEvents?: boolean;
  random?: () => number;
};

export type HeroPhaseResult = {
  heroes: Unit[];
  enemies: Unit[];
  enemyCastleHp: number;
  bossSpawnAnnounced: boolean;
  nextUid: number;
  nextPopupUid: number;
  damagePopups: DamagePopup[];
  enemyCastleHit: boolean;
  notice?: string;
  combatEvents: CombatEvent[];
  nextCombatEventId: number;
};

export function selectHeroTarget(hero: Unit, enemies: Unit[]): Unit | undefined {
  const livingEnemies = enemies.filter((enemy) => enemy.currentHp > 0);
  const frontTarget = livingEnemies
    .filter((enemy) => enemy.x >= hero.x)
    .sort((a, b) => a.x - b.x)[0] ?? livingEnemies
    .sort((a, b) => Math.abs(a.x - hero.x) - Math.abs(b.x - hero.x))[0];

  if (hero.targetPriority !== "ranged-lowest-hp") return frontTarget;
  return livingEnemies
    .filter((enemy) => enemy.rangeType === "ranged")
    .sort((a, b) => a.currentHp - b.currentHp || a.x - b.x)[0] ?? frontTarget;
}

function moveTowardEnemyCastle(hero: Unit, dt: number): Unit {
  return { ...hero, x: Math.min(87, hero.x + hero.speed * MOVE_SPEED_MULTIPLIER * dt / 100) };
}

function attackEnemyUnits(
  hero: Unit,
  target: Unit,
  enemies: Unit[],
  nextPopupUid: number,
  random: () => number,
  nextCombatEventId: number,
  collectCombatEvents: boolean
): { hero: Unit; enemies: Unit[]; damagePopups: DamagePopup[]; nextPopupUid: number; combatEvents: CombatEvent[]; nextCombatEventId: number } {
  const nextEnemies = [...enemies];
  const damage = outgoingDamage(hero, target, hero.atk, random);
  const splashRadius = hero.splashRadius ?? 0;
  const hitTargets = hero.attackType === "splash"
    ? nextEnemies
        .filter((enemy) => enemy.currentHp > 0 && Math.abs(enemy.x - target.x) <= splashRadius)
        .map((enemy) => enemy.uid)
    : [target.uid];
  const damagePopups: DamagePopup[] = [];
  const attackId = collectCombatEvents ? nextCombatEventId++ : 0;
  const combatEvents: CombatEvent[] = [];
  if (collectCombatEvents) combatEvents.push({
    type: "BASIC_ATTACK",
    eventId: nextCombatEventId++,
    attackId,
    origin: "BASIC_ATTACK",
    attackerUid: hero.uid,
    targetUid: target.uid
  });

  for (const targetUid of hitTargets) {
    const targetIndex = nextEnemies.findIndex((enemy) => enemy.uid === targetUid);
    if (targetIndex < 0) continue;
    const isPrimaryTarget = targetUid === target.uid;
    const impactAtk = hero.attackType === "splash" && !isPrimaryTarget ? hero.atk * 0.65 : hero.atk;
    const hitTarget = applyKnockback(
      nextEnemies[targetIndex],
      nextEnemies[targetIndex].currentHp - damage,
      "hero",
      impactAtk
    );
    const actualDamage = Math.max(0, nextEnemies[targetIndex].currentHp - Math.max(0, hitTarget.currentHp));
    nextEnemies[targetIndex] = hero.effect === "burn"
      ? { ...hitTarget, burnTimer: 3, burnDamage: Math.max(hitTarget.burnDamage, hero.atk * 0.12), hitFlash: 0.14 }
      : { ...hitTarget, hitFlash: 0.14 };
    damagePopups.push({
      id: nextPopupUid++,
      x: hitTarget.x,
      value: Math.max(1, Math.round(damage)),
      critical: damage >= hero.atk * 1.9
    });
    if (collectCombatEvents) combatEvents.push({
      type: "DAMAGE_APPLIED",
      eventId: nextCombatEventId++,
      attackId,
      origin: "BASIC_ATTACK",
      sourceUid: hero.uid,
      targetUid,
      actualDamage
    });
  }

  return {
    hero: {
      ...hero,
      attackTimer: hero.attackInterval,
      attackFlash: 0.16,
      attackAnimationTimer: hero.attackInterval,
      attackAnimationSequence: (hero.attackAnimationSequence ?? 0) + 1,
      attackTargetX: target.x
    },
    enemies: nextEnemies,
    damagePopups,
    nextPopupUid,
    combatEvents,
    nextCombatEventId
  };
}

export function runHeroPhase(input: HeroPhaseInput): HeroPhaseResult {
  let heroes = [...input.heroes];
  let enemies = [...input.enemies];
  let enemyCastleHp = input.enemyCastleHp;
  let bossSpawnAnnounced = input.bossSpawnAnnounced;
  let nextUid = input.nextUid;
  let nextPopupUid = input.nextPopupUid;
  let enemyCastleHit = false;
  let notice: string | undefined;
  const damagePopups: DamagePopup[] = [];
  const combatEvents: CombatEvent[] = [];
  let nextCombatEventId = input.nextCombatEventId ?? 1;
  const random = input.random ?? Math.random;

  for (let index = 0; index < heroes.length; index++) {
    const hero = heroes[index];
    if (hero.currentHp <= 0 || hero.knockbackTimer > 0) continue;
    const target = selectHeroTarget(hero, enemies);

    if (!target) {
      heroes[index] = moveTowardEnemyCastle(hero, input.dt);
      if (hero.x >= 84 && hero.attackTimer <= 0) {
        const finalWaveCleared =
          input.waveIndex === input.stage.waves.length - 1 &&
          input.spawnedInWave >= input.totalInWave &&
          enemies.every((enemy) => enemy.currentHp <= 0);
        if (finalWaveCleared) {
          const damage = hero.atk * 1.8;
          const castleHpBeforeAttack = enemyCastleHp;
          if (input.stage.type === "boss" && input.bossKey && !bossSpawnAnnounced && damage >= enemyCastleHp) {
            const bossDef = ENEMY_MAP[input.bossKey];
            const hpScale = 1 + input.stageIndex * STAGE_HP_SCALE + input.waveIndex * WAVE_HP_SCALE + 0.35;
            const atkScale = 1 + input.stageIndex * STAGE_ATK_SCALE + input.waveIndex * WAVE_ATK_SCALE + 0.15;
            enemies.push(makeUnit({
              ...bossDef,
              hp: Math.round(bossDef.hp * hpScale),
              atk: Math.round(bossDef.atk * atkScale)
            }, "enemy", 90, 1000 + nextUid++, random));
            bossSpawnAnnounced = true;
            enemyCastleHp = Math.ceil(input.stage.enemyCastleHp / 2);
            heroes = heroes.map((unit) => ({
              ...unit,
              knockbackTimer: 0.22,
              knockbackFromX: unit.x,
              knockbackTargetX: Math.max(9, unit.x - 40),
              attackTimer: Math.max(unit.attackTimer, 0.5),
              attackFlash: 0
            }));
            notice = `⚠ 성벽 붕괴 저지 · ${input.stage.bossName ?? "BOSS"} 등장!`;
          } else {
            enemyCastleHp = Math.max(0, enemyCastleHp - damage);
          }
          enemyCastleHit = true;
          if (input.collectCombatEvents !== false) combatEvents.push({
            type: "CASTLE_ATTACK",
            eventId: nextCombatEventId++,
            attackId: nextCombatEventId++,
            origin: "BASIC_ATTACK",
            attackerUid: hero.uid,
            castle: "enemy",
            actualDamage: Math.max(0, castleHpBeforeAttack - enemyCastleHp)
          });
          heroes[index].attackFlash = 0.16;
          heroes[index].attackAnimationTimer = heroes[index].attackInterval;
          heroes[index].attackAnimationSequence = (heroes[index].attackAnimationSequence ?? 0) + 1;
          heroes[index].attackTargetX = 87;
        }
        heroes[index].attackTimer = hero.attackInterval;
      }
      continue;
    }

    const distance = Math.abs(target.x - hero.x);
    if (distance > hero.range / 10) {
      heroes[index] = moveTowardEnemyCastle(hero, input.dt);
      continue;
    }
    if (hero.attackTimer > 0) continue;

    const attack = attackEnemyUnits(hero, target, enemies, nextPopupUid, random, nextCombatEventId, input.collectCombatEvents !== false);
    heroes[index] = attack.hero;
    enemies = attack.enemies;
    nextPopupUid = attack.nextPopupUid;
    damagePopups.push(...attack.damagePopups);
    combatEvents.push(...attack.combatEvents);
    nextCombatEventId = attack.nextCombatEventId;
  }

  return {
    heroes,
    enemies,
    enemyCastleHp,
    bossSpawnAnnounced,
    nextUid,
    nextPopupUid,
    damagePopups,
    enemyCastleHit,
    notice,
    combatEvents,
    nextCombatEventId
  };
}
