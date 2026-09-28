import type { AbilityUnit, ScalingDefinition, ScalingSource } from "./types";

function sourceValue(source: ScalingSource, caster: AbilityUnit, target: AbilityUnit): number {
  switch (source) {
    case "CASTER_ATK": return caster.atk;
    case "CASTER_DEF": return caster.def ?? 0;
    case "CASTER_MAX_HP": return caster.hp;
    case "CASTER_CURRENT_HP": return caster.currentHp;
    case "CASTER_LOST_HP": return Math.max(0, caster.hp - caster.currentHp);
    case "TARGET_ATK": return target.atk;
    case "TARGET_DEF": return target.def ?? 0;
    case "TARGET_MAX_HP": return target.hp;
    case "TARGET_CURRENT_HP": return target.currentHp;
    case "TARGET_LOST_HP": return Math.max(0, target.hp - target.currentHp);
    case "FLAT": return 1;
  }
}

export function calculateScaling(definition: ScalingDefinition, caster: AbilityUnit, target: AbilityUnit): number {
  return definition.components.reduce(
    (total, component) => total + sourceValue(component.source, caster, target) * component.coefficient,
    0
  );
}

