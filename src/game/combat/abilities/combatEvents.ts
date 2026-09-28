import type { AbilityEventOrigin, AbilityStatusId, AbilityUnit } from "./types";

export type CombatEventMeta = {
  eventId: number;
  attackId?: number;
  origin: AbilityEventOrigin;
  originAbilityId?: string;
  chainDepth?: number;
};

export type CombatEvent =
  | ({ type: "UNIT_DEPLOYED"; unitUid: number } & CombatEventMeta)
  | ({ type: "BASIC_ATTACK"; attackerUid: number; targetUid: number } & CombatEventMeta)
  | ({ type: "DAMAGE_APPLIED"; sourceUid?: number; targetUid: number; actualDamage: number } & CombatEventMeta)
  | ({ type: "HP_CHANGED"; unitUid: number; previousHp: number; currentHp: number; sourceUid?: number } & CombatEventMeta)
  | ({ type: "UNIT_DEATH"; unitUid: number; killerUid?: number } & CombatEventMeta)
  | ({ type: "UNIT_REVIVED"; unitUid: number; sourceUid?: number } & CombatEventMeta)
  | ({ type: "STATUS_APPLIED"; targetUid: number; sourceUid: number; status: AbilityStatusId; duration: number; potency: number } & CombatEventMeta)
  | ({ type: "STATUS_REMOVED"; targetUid: number; sourceUid: number; status: AbilityStatusId; reason: "EXPIRED" | "CLEANSED" | "REMOVED" } & CombatEventMeta)
  | ({ type: "SIMULATION_TICK"; deltaSeconds: number } & CombatEventMeta)
  | ({ type: "CASTLE_ATTACK"; attackerUid: number; castle: "hero" | "enemy"; actualDamage: number } & CombatEventMeta);

export type CombatEventResult = {
  units: readonly AbilityUnit[];
  activationCount: number;
  droppedByDepthLimit: boolean;
  resourceChanges?: ReadonlyArray<{ resource: string; amount: number; ownerUid: number; abilityId: string }>;
};
