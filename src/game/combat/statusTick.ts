import type { Unit } from "../types";
import { regenAmount } from "./damage";
import { updateKnockback } from "./knockback";

const VISUAL_TICK_SECONDS = 0.05;

export function advanceHeroStatus(unit: Unit, dt: number): Unit {
  const next = updateKnockback({
    ...unit,
    attackTimer: Math.max(0, unit.attackTimer - dt),
    hitFlash: Math.max(0, unit.hitFlash - VISUAL_TICK_SECONDS),
    attackFlash: Math.max(0, unit.attackFlash - VISUAL_TICK_SECONDS),
    attackAnimationTimer: Math.max(0, (unit.attackAnimationTimer ?? 0) - dt),
    abilityAnimationTimer: Math.max(0, (unit.abilityAnimationTimer ?? 0) - dt),
    specialTimer: Math.max(0, unit.specialTimer - dt)
  }, dt);
  const healed = Math.min(next.hp, next.currentHp + regenAmount(next, dt));
  if (next.burnTimer <= 0) return { ...next, currentHp: healed };
  const burnTick = Math.min(next.burnTimer, dt);
  return {
    ...next,
    currentHp: Math.max(0, healed - next.burnDamage * burnTick),
    burnTimer: Math.max(0, next.burnTimer - dt)
  };
}

export function advanceEnemyStatus(unit: Unit, dt: number): Unit {
  const next = updateKnockback({
    ...unit,
    attackTimer: Math.max(0, unit.attackTimer - dt),
    hitFlash: Math.max(0, unit.hitFlash - VISUAL_TICK_SECONDS),
    attackFlash: Math.max(0, unit.attackFlash - VISUAL_TICK_SECONDS),
    attackAnimationTimer: Math.max(0, (unit.attackAnimationTimer ?? 0) - dt),
    abilityAnimationTimer: Math.max(0, (unit.abilityAnimationTimer ?? 0) - dt),
    slowTimer: Math.max(0, unit.slowTimer - dt)
  }, dt);
  if (next.burnTimer <= 0) return next;
  const burnTick = Math.min(next.burnTimer, dt);
  return {
    ...next,
    currentHp: Math.max(0, next.currentHp - next.burnDamage * burnTick),
    burnTimer: Math.max(0, next.burnTimer - dt)
  };
}
