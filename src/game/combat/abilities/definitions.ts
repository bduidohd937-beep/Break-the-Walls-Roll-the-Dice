import type { AbilityDefinition } from "./types";

export const ABILITY_IDS = {
  soldierHeavyStrike: "soldier-heavy-strike",
  kingdomArcherPiercingArrow: "hero-003-piercing-arrow"
} as const;

// Temporary v1 tuning value. Keep it isolated until combat balance data is finalized.
export const SOLDIER_HEAVY_STRIKE_BONUS_ATK_RATIO = 0.5;
export const KINGDOM_ARCHER_PIERCING_ARROW = {
  cooldownSeconds: 6,
  damageAtkRatio: 1.25,
  range: 30,
  maxTargets: 4,
  slowMultiplier: 0.7,
  slowDurationSeconds: 2,
  animationSeconds: 8 / 12,
} as const;

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
  },
  [ABILITY_IDS.kingdomArcherPiercingArrow]: {
    id: ABILITY_IDS.kingdomArcherPiercingArrow,
    trigger: { type: "ON_INTERVAL", intervalSeconds: KINGDOM_ARCHER_PIERCING_ARROW.cooldownSeconds },
    condition: { type: "ALWAYS" },
    target: { type: "ALL_ENEMIES_IN_RANGE", range: KINGDOM_ARCHER_PIERCING_ARROW.range, maxTargets: KINGDOM_ARCHER_PIERCING_ARROW.maxTargets },
    effects: [
      { type: "DAMAGE", amount: { components: [{ source: "CASTER_ATK", coefficient: KINGDOM_ARCHER_PIERCING_ARROW.damageAtkRatio }] }, tags: ["PROJECTILE", "PIERCING"] },
      { type: "APPLY_STATUS", status: "slow", duration: KINGDOM_ARCHER_PIERCING_ARROW.slowDurationSeconds, potency: { components: [{ source: "FLAT", coefficient: KINGDOM_ARCHER_PIERCING_ARROW.slowMultiplier }] }, tags: ["PROJECTILE", "PIERCING", "SLOW"] }
    ],
    tags: ["SKILL_1", "PROJECTILE", "PIERCING"],
    visual: { animation: "skill1", durationSeconds: KINGDOM_ARCHER_PIERCING_ARROW.animationSeconds }
  }
};

export function resolveAbilityDefinitions(abilityIds: readonly string[] | undefined): AbilityDefinition[] {
  if (!abilityIds?.length) return [];
  return abilityIds.flatMap((abilityId) => {
    const definition = DEFINITIONS[abilityId];
    return definition ? [definition] : [];
  });
}
