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


export function resolveFrontlineCollision(
  heroes: Unit[],
  enemies: Unit[],
): { heroes: Unit[]; enemies: Unit[] } {
  const nextHeroes = heroes.map((unit) => ({ ...unit }));
  const nextEnemies = enemies.map((unit) => ({ ...unit }));
  const FRONT_GAP = 2.6;

  for (const hero of nextHeroes) {
    if (hero.currentHp <= 0 || hero.knockbackTimer > 0) continue;

    for (const enemy of nextEnemies) {
      if (enemy.currentHp <= 0 || enemy.knockbackTimer > 0) continue;
      if (hero.x <= enemy.x - FRONT_GAP) continue;

      const overlap = hero.x - (enemy.x - FRONT_GAP);
      const heroPush = overlap * 0.55;
      const enemyPush = overlap * 0.45;

      hero.x = clamp(hero.x - heroPush, 9, 87);
      enemy.x = clamp(enemy.x + enemyPush, 9, 87);
    }
  }

  return { heroes: nextHeroes, enemies: nextEnemies };
}
