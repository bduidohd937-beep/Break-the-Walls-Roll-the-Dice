import type { Team, Unit } from "../types";
import { KNOCKBACK_DISTANCE, KNOCKBACK_MAX_COUNT, clamp } from "../constants";

export function applyKnockback(
  target: Unit,
  nextHp: number,
  attackerTeam: Team,
  attackerAtk: number,
): Unit {
  const previousHp = target.currentHp;
  const threshold = target.hp / (KNOCKBACK_MAX_COUNT + 1);
  const previousStep = Math.floor((target.hp - previousHp) / threshold);
  const nextStep = Math.floor((target.hp - Math.max(0, nextHp)) / threshold);
  const shouldKnockback =
    nextHp > 0 &&
    nextStep > previousStep &&
    target.knockbackCount < KNOCKBACK_MAX_COUNT;

  if (!shouldKnockback) {
    return { ...target, currentHp: nextHp, hitFlash: 0.12 };
  }

  const direction = attackerTeam === "hero" ? 1 : -1;
  const powerScale = clamp(attackerAtk / 100, 0.7, 1.6);

  return {
    ...target,
    currentHp: nextHp,
    x: target.x,
    knockbackTimer: 0.22,
    knockbackFromX: target.x,
    knockbackTargetX: clamp(target.x + direction * KNOCKBACK_DISTANCE * powerScale, 9, 87),
    attackTimer: Math.max(target.attackTimer, 0.35),
    hitFlash: 0.28,
    attackFlash: 0,
    knockbackCount: target.knockbackCount + 1,
  };
}


export function updateKnockback(unit: Unit, dt: number): Unit {
  if (unit.knockbackTimer <= 0) return unit;

  const nextTimer = Math.max(0, unit.knockbackTimer - dt);
  const progress = 1 - nextTimer / 0.22;
  const eased = 1 - Math.pow(1 - progress, 3);

  return {
    ...unit,
    x: unit.knockbackFromX + (unit.knockbackTargetX - unit.knockbackFromX) * eased,
    knockbackTimer: nextTimer,
  };
}
