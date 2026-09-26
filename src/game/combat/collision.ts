import type { Unit } from "../types";
import { MIN_UNIT_GAP, clamp } from "../constants";

export function resolveSameTeamSpacing(units: Unit[]): Unit[] {
  const sorted = [...units].sort((a, b) => a.x - b.x);

  for (let i = 1; i < sorted.length; i++) {
    const left = sorted[i - 1];
    const right = sorted[i];
    const gap = right.x - left.x;

    if (gap >= MIN_UNIT_GAP) continue;

    const push = (MIN_UNIT_GAP - gap) / 2;
    left.x = clamp(left.x - push, 9, 87);
    right.x = clamp(right.x + push, 9, 87);
  }

  return units.map((unit) => sorted.find((candidate) => candidate.uid === unit.uid) ?? unit);
}
