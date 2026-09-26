import type { Unit } from "../types";
import { MIN_UNIT_GAP, clamp } from "../constants";

export function resolveSameTeamSpacing(units: Unit[]): Unit[] {
  const sorted = [...units].sort((a, b) => a.x - b.x);

  // Several passes keep large groups from collapsing into one stack.
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < sorted.length; i++) {
      const left = sorted[i - 1];
      const right = sorted[i];
      const gap = right.x - left.x;

      if (gap >= MIN_UNIT_GAP) continue;

      const push = (MIN_UNIT_GAP - gap) / 2;
      left.x = clamp(left.x - push, 9, 87);
      right.x = clamp(right.x + push, 9, 87);
    }
  }

  return units.map((unit) => sorted.find((candidate) => candidate.uid === unit.uid) ?? unit);
}


export function resolveFrontlineCollision(
  heroes: Unit[],
  enemies: Unit[],
): { heroes: Unit[]; enemies: Unit[] } {
  const nextHeroes = heroes.map((unit) => ({ ...unit }));
  const nextEnemies = enemies.map((unit) => ({ ...unit }));
  const FRONT_GAP = 2.8;

  for (const hero of nextHeroes) {
    if (hero.currentHp <= 0 || hero.knockbackTimer > 0) continue;

    const frontEnemy = nextEnemies
      .filter((enemy) => enemy.currentHp > 0 && enemy.x >= hero.x)
      .sort((a, b) => a.x - b.x)[0];

    if (!frontEnemy) continue;

    const maxHeroX = frontEnemy.x - FRONT_GAP;
    if (hero.x > maxHeroX) {
      hero.x = clamp(maxHeroX, 9, 87);
    }
  }

  for (const enemy of nextEnemies) {
    if (enemy.currentHp <= 0 || enemy.knockbackTimer > 0) continue;

    const frontHero = nextHeroes
      .filter((hero) => hero.currentHp > 0 && hero.x <= enemy.x)
      .sort((a, b) => b.x - a.x)[0];

    if (!frontHero) continue;

    const minEnemyX = frontHero.x + FRONT_GAP;
    if (enemy.x < minEnemyX) {
      enemy.x = clamp(minEnemyX, 9, 87);
    }
  }

  return { heroes: nextHeroes, enemies: nextEnemies };
}
