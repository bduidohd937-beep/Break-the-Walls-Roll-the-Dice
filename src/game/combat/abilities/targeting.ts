import type { AbilityUnit, TargetDefinition } from "./types";

function inRange(caster: AbilityUnit, unit: AbilityUnit, range?: number): boolean {
  return range === undefined || Math.abs(unit.x - caster.x) <= range;
}

function limit(units: AbilityUnit[], maxTargets?: number): AbilityUnit[] {
  return maxTargets === undefined ? units : units.slice(0, Math.max(0, maxTargets));
}

export function selectAbilityTargets(
  definition: TargetDefinition,
  caster: AbilityUnit,
  units: readonly AbilityUnit[],
  currentTargetUid?: number
): AbilityUnit[] {
  const living = units.filter((unit) => unit.currentHp > 0);
  switch (definition.type) {
    case "SELF": return [caster];
    case "CURRENT_TARGET": {
      const target = living.find((unit) => unit.uid === currentTargetUid);
      return target ? [target] : [];
    }
    case "NEAREST_ENEMY":
      return limit(living.filter((unit) => unit.team !== caster.team && inRange(caster, unit, definition.range))
        .sort((a, b) => Math.abs(a.x - caster.x) - Math.abs(b.x - caster.x)), definition.maxTargets ?? 1);
    case "LOWEST_HP_ALLY":
      return limit(living.filter((unit) => unit.team === caster.team && inRange(caster, unit, definition.range))
        .sort((a, b) => a.currentHp - b.currentHp), definition.maxTargets ?? 1);
    case "LOWEST_HP_PERCENT_ALLY":
      return limit(living.filter((unit) => unit.team === caster.team && inRange(caster, unit, definition.range))
        .sort((a, b) => a.currentHp / a.hp - b.currentHp / b.hp), definition.maxTargets ?? 1);
    case "ALL_ENEMIES_IN_RANGE":
      return limit(living.filter((unit) => unit.team !== caster.team && inRange(caster, unit, definition.range)), definition.maxTargets);
    case "ALL_ALLIES_IN_RANGE":
      return limit(living.filter((unit) => unit.team === caster.team && inRange(caster, unit, definition.range)), definition.maxTargets);
  }
}

