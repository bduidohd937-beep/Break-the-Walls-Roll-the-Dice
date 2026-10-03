import { MOVE_SPEED_MULTIPLIER } from "../constants";
import type { Unit } from "../types";
import { incomingDamage } from "./damage";
import { applyKnockback } from "./knockback";
import type { DamagePopup } from "./types";
import type { CombatEvent } from "./abilities/combatEvents";
import { effectiveMoveSpeed, hasAbilityStatus, resolveAbilityDamage } from "./abilities/effects";

export type EnemyPhaseInput = {
  heroes: Unit[];
  enemies: Unit[];
  dt: number;
  castleHp: number;
  nextPopupUid: number;
  nextCombatEventId?: number;
  collectCombatEvents?: boolean;
};

export type EnemyPhaseResult = {
  heroes: Unit[];
  enemies: Unit[];
  castleHp: number;
  castleHit: boolean;
  damagePopups: DamagePopup[];
  combatEvents: CombatEvent[];
  nextPopupUid: number;
  nextCombatEventId: number;
};

/** Enemy targeting: hold the frontline against the frontmost hero; backline divers (targetPriority "ranged-lowest-hp", e.g. the assassin) dive the weakest ranged backliner. */
export function selectEnemyTarget(enemy: Unit, heroes: Unit[]): Unit | undefined {
  const livingHeroes = heroes.filter((h) => h.currentHp > 0);
  const frontTarget = livingHeroes
    .filter((h) => h.x <= enemy.x)
    .sort((a, b) => b.x - a.x)[0] ?? livingHeroes
    .sort((a, b) => Math.abs(a.x - enemy.x) - Math.abs(b.x - enemy.x))[0];

  // Enemy roles matter: backline divers (targetPriority "ranged-lowest-hp", e.g. the assassin) dive toward fragile backliners while other enemies hold the frontline.
  const assassinTarget = enemy.targetPriority === "ranged-lowest-hp"
    ? livingHeroes
        .filter((h) => h.rangeType === "ranged")
        .sort((a, b) => a.currentHp - b.currentHp || b.x - a.x)[0]
    : undefined;
  return assassinTarget ?? frontTarget;
}

function moveTowardHeroCastle(enemy: Unit, dt: number): Unit {
  return { ...enemy, x: Math.max(9, enemy.x - effectiveMoveSpeed(enemy) * (enemy.slowTimer > 0 ? enemy.slowMultiplier : 1) * MOVE_SPEED_MULTIPLIER * dt / 100) };
}

/**
 * Pure, deterministic enemy simulation: movement, targeting, castle attacks,
 * damage, splash, burn, knockback, and enraged boss behavior. Formulas must
 * stay identical to the pre-extraction battle loop — no balance changes here.
 */
export function runEnemyPhase(input: EnemyPhaseInput): EnemyPhaseResult {
  const { heroes, enemies, dt } = input;
  const collect = input.collectCombatEvents === true;
  let nextCombatEventId = input.nextCombatEventId ?? 0;
  let nextPopupUid = input.nextPopupUid;
  let nextCastleHp = input.castleHp;
  let castleHit = false;
  const damagePopups: DamagePopup[] = [];
  const combatEvents: CombatEvent[] = [];
  const nextHeroes = [...heroes];
  const nextEnemies = [...enemies];

  // Enemies move, attack heroes, or damage our castle.
  for (let i = 0; i < nextEnemies.length; i++) {
    const enemy = nextEnemies[i];
    if (enemy.currentHp <= 0 || enemy.knockbackTimer > 0 || hasAbilityStatus(enemy, "STUN")) continue;

    const target = selectEnemyTarget(enemy, nextHeroes);

    if (!target) {
      if (enemy.x <= 13) {
        if (enemy.attackTimer <= 0) {
          const castleHpBeforeAttack = nextCastleHp;
          nextCastleHp = Math.max(0, nextCastleHp - enemy.atk);
          castleHit = true;
          nextEnemies[i] = {
            ...enemy,
            attackTimer: enemy.attackInterval,
            attackFlash: 0.16,
            attackAnimationTimer: enemy.attackInterval,
            attackAnimationSequence: (enemy.attackAnimationSequence ?? 0) + 1,
            attackTargetX: 9
          };
          if (collect) combatEvents.push({
            type: "CASTLE_ATTACK",
            eventId: nextCombatEventId++,
            attackId: nextCombatEventId++,
            origin: "BASIC_ATTACK",
            attackerUid: enemy.uid,
            castle: "hero",
            actualDamage: castleHpBeforeAttack - nextCastleHp
          });
        }
      } else {
        nextEnemies[i] = moveTowardHeroCastle(enemy, dt);
      }
      continue;
    }

    const distance = Math.abs(target.x - enemy.x);
    if (distance > enemy.range / 10) {
      nextEnemies[i] = moveTowardHeroCastle(enemy, dt);
    } else if (enemy.attackTimer <= 0) {
      const attackId = collect ? nextCombatEventId++ : 0;
      const damageEvents: CombatEvent[] = [];
      const enrage = enemy.lowHpEnrage;
      const enragedBoss = Boolean(enrage && enemy.currentHp / enemy.hp <= enrage.hpThreshold);
      const backlinePressure = enemy.targetPriority === "ranged-lowest-hp" && target.rangeType === "ranged";
      const attackDamage = (enragedBoss ? enemy.atk * enrage!.attackMultiplier : enemy.atk) * (backlinePressure ? 1.2 : 1);
      const splashRadius = enemy.splashRadius ?? 0;
      const hitTargets = enemy.attackType === "splash"
        ? nextHeroes
            .filter((heroTarget) => heroTarget.currentHp > 0 && Math.abs(heroTarget.x - target.x) <= splashRadius)
            .map((heroTarget) => heroTarget.uid)
        : [target.uid];

      for (const targetUid of hitTargets) {
        const hitIndex = nextHeroes.findIndex((heroTarget) => heroTarget.uid === targetUid);
        if (hitIndex < 0) continue;
        const damage = incomingDamage(nextHeroes[hitIndex], attackDamage);
        const hpBeforeHit = nextHeroes[hitIndex].currentHp;
        const isPrimaryTarget = targetUid === target.uid;
        const impactAtk = enemy.attackType === "splash" && !isPrimaryTarget ? attackDamage * 0.65 : attackDamage;
        const resolvedDamage = resolveAbilityDamage(nextHeroes[hitIndex], damage, enemy);
        const hitHero = applyKnockback(
          resolvedDamage.unit,
          nextHeroes[hitIndex].currentHp - resolvedDamage.hpDamage,
          "enemy",
          impactAtk,
        );
        nextHeroes[hitIndex] = enemy.effect === "burn"
          ? { ...hitHero, burnTimer: 3, burnDamage: Math.max(hitHero.burnDamage, enemy.atk * 0.12), hitFlash: 0.14 }
          : hitHero;
        if (collect) damageEvents.push({
          type: "DAMAGE_APPLIED",
          eventId: nextCombatEventId++,
          attackId,
          origin: "BASIC_ATTACK",
          sourceUid: enemy.uid,
          targetUid,
          actualDamage: Math.max(0, hpBeforeHit - Math.max(0, hitHero.currentHp))
        });
        const popupId = nextPopupUid++;
        const popupX = hitHero.x;
        damagePopups.push({ id: popupId, x: popupX, value: Math.max(1, Math.round(damage)), critical: false });
      }
      nextEnemies[i] = {
        ...enemy,
        attackTimer: enragedBoss ? enemy.attackInterval * enrage!.attackIntervalMultiplier : enemy.attackInterval,
        attackFlash: enragedBoss ? enrage!.attackFlash : 0.16,
        attackAnimationTimer: enemy.attackInterval,
        attackAnimationSequence: (enemy.attackAnimationSequence ?? 0) + 1,
        attackTargetX: target.x
      };
      if (collect) combatEvents.push({
        type: "BASIC_ATTACK",
        eventId: nextCombatEventId++,
        attackId,
        origin: "BASIC_ATTACK",
        attackerUid: enemy.uid,
        targetUid: target.uid
      });
      if (collect) for (const event of damageEvents) combatEvents.push(event);
    }
  }

  return {
    heroes: nextHeroes,
    enemies: nextEnemies,
    castleHp: nextCastleHp,
    castleHit,
    damagePopups,
    combatEvents,
    nextPopupUid,
    nextCombatEventId
  };
}
