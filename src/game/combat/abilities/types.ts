import type { Unit } from "../../types";

export type AbilityRole = "MELEE_DPS" | "RANGED_DPS" | "TANK" | "SUPPORT" | "HEALER" | "BUFFER" | "DEBUFFER" | "CONTROLLER";
export type Race = "HUMAN" | "UNDEAD" | "DRAGON" | "GIANT" | "MACHINE" | "SPIRIT" | "ANGEL" | "DEMON" | "BEAST" | "ABERRATION";
export type AbilityTag = string;
export type StatusId = "burn" | "slow" | (string & {});

export type AbilityUnit = Unit & {
  def?: number;
  abilityTags?: readonly AbilityTag[];
  statusIds?: readonly StatusId[];
};

export type TriggerDefinition =
  | { type: "ON_DEPLOY" }
  | { type: "ON_ATTACK" }
  | { type: "ON_ATTACK_COUNT"; count: number }
  | { type: "ON_HIT" }
  | { type: "ON_HIT_COUNT"; count: number }
  | { type: "ON_KILL" }
  | { type: "ON_DEATH" }
  | { type: "ON_HP_BELOW"; hpPercent: number }
  | { type: "ON_INTERVAL"; intervalSeconds: number };

export type ConditionDefinition =
  | { type: "ALWAYS" }
  | { type: "SELF_HP_BELOW"; hpPercent: number }
  | { type: "TARGET_HP_BELOW"; hpPercent: number }
  | { type: "TARGET_HAS_TAG"; tag: AbilityTag }
  | { type: "TARGET_HAS_STATUS"; status: StatusId };

export type TargetLimits = { range?: number; maxTargets?: number };
export type TargetDefinition =
  | { type: "SELF" }
  | { type: "CURRENT_TARGET" }
  | ({ type: "NEAREST_ENEMY" } & TargetLimits)
  | ({ type: "LOWEST_HP_ALLY" } & TargetLimits)
  | ({ type: "LOWEST_HP_PERCENT_ALLY" } & TargetLimits)
  | ({ type: "ALL_ENEMIES_IN_RANGE" } & TargetLimits)
  | ({ type: "ALL_ALLIES_IN_RANGE" } & TargetLimits);

export type ScalingSource =
  | "CASTER_ATK" | "CASTER_DEF" | "CASTER_MAX_HP" | "CASTER_CURRENT_HP" | "CASTER_LOST_HP"
  | "TARGET_ATK" | "TARGET_DEF" | "TARGET_MAX_HP" | "TARGET_CURRENT_HP" | "TARGET_LOST_HP"
  | "FLAT";

export type ScalingComponent = { source: ScalingSource; coefficient: number };
export type ScalingDefinition = { components: readonly ScalingComponent[] };

type TaggedEffect = { tags?: readonly AbilityTag[] };
export type EffectDefinition =
  | ({ type: "DAMAGE"; amount: ScalingDefinition } & TaggedEffect)
  | ({ type: "HEAL"; amount: ScalingDefinition } & TaggedEffect)
  | ({ type: "KNOCKBACK"; distance: ScalingDefinition } & TaggedEffect)
  | ({ type: "APPLY_STATUS"; status: StatusId; duration: number; potency?: ScalingDefinition } & TaggedEffect);

export type AbilityDefinition = {
  id: string;
  trigger: TriggerDefinition;
  condition?: ConditionDefinition;
  target: TargetDefinition;
  effects: readonly EffectDefinition[];
  tags?: readonly AbilityTag[];
};

export type AbilityBinding = { ownerUid: number; ability: AbilityDefinition };

export type AbilityEvent =
  | { type: "ON_DEPLOY" | "ON_ATTACK" | "ON_ATTACK_COUNT" | "ON_HIT" | "ON_HIT_COUNT" | "ON_KILL" | "ON_DEATH" | "ON_HP_BELOW"; casterUid: number; currentTargetUid?: number }
  | { type: "ON_INTERVAL"; elapsedSeconds: number; casterUid?: number; currentTargetUid?: number };

export type AbilityBattlefield = { units: readonly AbilityUnit[] };
export type AbilityActivation = { abilityId: string; ownerUid: number; targetUids: number[] };
export type AbilityExecutionResult = { units: AbilityUnit[]; activations: AbilityActivation[] };

