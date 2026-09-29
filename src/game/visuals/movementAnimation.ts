import { effectiveMoveSpeed } from "../combat/abilities/effects";
import type { AbilityUnit } from "../combat/abilities/types";

const MIN_PLAYBACK_RATE = 0.1;
const MAX_PLAYBACK_RATE = 3;

/** Visual-only walk cadence multiplier; combat still owns and advances the actual position. */
export function getMovementAnimationRate(unit: AbilityUnit): number {
  const sourceSpeed = unit.abilityEffectState?.baseStats?.speed ?? unit.speed;
  if (!Number.isFinite(sourceSpeed) || sourceSpeed <= 0) return 1;

  const legacySlow = unit.team === "enemy" && unit.slowTimer > 0 ? Math.max(0, unit.slowMultiplier) : 1;
  const rate = (effectiveMoveSpeed(unit) * legacySlow) / sourceSpeed;
  return Math.max(MIN_PLAYBACK_RATE, Math.min(MAX_PLAYBACK_RATE, rate));
}

export function spriteAnimationDuration(frameCount: number, fps: number, gameSpeed = 1, playbackRate = 1): number {
  if (frameCount <= 0 || fps <= 0) return 0;
  return frameCount / (fps * Math.max(0.01, gameSpeed) * Math.max(MIN_PLAYBACK_RATE, playbackRate));
}
