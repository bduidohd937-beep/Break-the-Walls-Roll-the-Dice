import type { AbilityEventOrigin, AbilityUnit } from "./types";

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
  | ({ type: "SIMULATION_TICK"; deltaSeconds: number } & CombatEventMeta)
  | ({ type: "CASTLE_ATTACK"; attackerUid: number; castle: "hero" | "enemy"; actualDamage: number } & CombatEventMeta);

export type CombatEventResult = {
  units: readonly AbilityUnit[];
  activationCount: number;
  droppedByDepthLimit: boolean;
};

