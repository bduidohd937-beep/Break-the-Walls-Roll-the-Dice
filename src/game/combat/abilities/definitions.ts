import type { AbilityDefinition } from "./types";

export const ABILITY_IDS = {
  soldierHeavyStrike: "soldier-heavy-strike"
} as const;

// Temporary v1 tuning value. Keep it isolated until combat balance data is finalized.
export const SOLDIER_HEAVY_STRIKE_BONUS_ATK_RATIO = 0.5;

const DEFINITIONS: Readonly<Record<string, AbilityDefinition>> = {
  [ABILITY_IDS.soldierHeavyStrike]: {
    id: ABILITY_IDS.soldierHeavyStrike,
    trigger: { type: "ON_ATTACK_COUNT", count: 3 },
    condition: { type: "ALWAYS" },
    target: { type: "CURRENT_TARGET" },
    effects: [{
      type: "DAMAGE",
      amount: {
        components: [{ source: "CASTER_ATK", coefficient: SOLDIER_HEAVY_STRIKE_BONUS_ATK_RATIO }]
      }
    }]
  }
};

export function resolveAbilityDefinitions(abilityIds: readonly string[] | undefined): AbilityDefinition[] {
  if (!abilityIds?.length) return [];
  return abilityIds.flatMap((abilityId) => {
    const definition = DEFINITIONS[abilityId];
    return definition ? [definition] : [];
  });
}
