import type { Team, Unit } from "../types";
import { KNOCKBACK_DISTANCE, KNOCKBACK_MAX_COUNT, clamp } from "../constants";

export function applyKnockback(
  target: Unit,
  nextHp: number,
  attackerTeam: Team,
  attackerAtk: number,
): Unit {
  const previousHp = target.currentHp;

  // 넉백 중에는 추가 넉백을 예약하지 않는다.
  // 피해 자체는 정상적으로 적용되며, 회복 후 다음 HP 임계치를 넘으면 다시 넉백된다.
  if (target.knockbackTimer > 0) {
    return { ...target, currentHp: nextHp, hitFlash: 0.14 };
  }

  // Guard units are frontline anchors: they need deeper HP loss to trigger each knockback.
  const guardThresholdScale = target.ability === "guard" ? 1.45 : 1;
  const threshold = (target.hp / (KNOCKBACK_MAX_COUNT + 1)) * guardThresholdScale;
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
  const guardDistanceScale = target.ability === "guard" ? 0.45 : 1;

  return {
    ...target,
    currentHp: nextHp,
    x: target.x,
    knockbackTimer: 0.22,
    knockbackFromX: target.x,
    knockbackTargetX: clamp(target.x + direction * KNOCKBACK_DISTANCE * powerScale * guardDistanceScale, 9, 87),
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
