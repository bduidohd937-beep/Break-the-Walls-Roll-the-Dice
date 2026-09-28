import type { AbilityUnit, ConditionDefinition } from "./types";

export function meetsAbilityCondition(condition: ConditionDefinition | undefined, caster: AbilityUnit, target?: AbilityUnit, eventUnit?: AbilityUnit): boolean {
  if (!condition || condition.type === "ALWAYS") return true;
  switch (condition.type) {
    case "SELF_HP_BELOW": return caster.currentHp / Math.max(1, caster.hp) < condition.hpPercent;
    case "TARGET_HP_BELOW": return Boolean(target && target.currentHp / Math.max(1, target.hp) < condition.hpPercent);
    case "TARGET_HAS_TAG": return Boolean(target?.abilityTags?.includes(condition.tag));
    case "TARGET_HAS_STATUS": return Boolean(target?.statusIds?.includes(condition.status));
    case "EVENT_UNIT_RELATION": {
      if (!eventUnit) return false;
      if (condition.relation === "SELF") return eventUnit.uid === caster.uid;
      return condition.relation === "ALLY" ? eventUnit.team === caster.team : eventUnit.team !== caster.team;
    }
  }
}
