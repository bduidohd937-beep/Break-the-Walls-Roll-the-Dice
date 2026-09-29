export type AttackPresentationState = {
  attackInterval: number;
  attackAnimationTimer?: number;
  animationDuration: number;
  moving?: boolean;
  inRange: boolean;
  interrupted?: boolean;
};

export function getAttackPresentationElapsed(attackInterval: number, timer?: number): number {
  return Math.max(0, attackInterval - (timer ?? 0));
}

export function isAttackPresentationActive(state: AttackPresentationState): boolean {
  const remaining = state.attackAnimationTimer ?? 0;
  if (remaining <= 0 || state.moving || !state.inRange || state.interrupted) return false;
  return getAttackPresentationElapsed(state.attackInterval, remaining) < Math.min(state.attackInterval, state.animationDuration);
}
