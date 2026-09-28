import type { Team, Unit } from "../types";
import type { BattleDeathEffect } from "../visuals/sprites";

export type BattleState = "stageSelect" | "playing" | "victory" | "defeat";
export type BattleReward = { gold: number; gems: number; firstClear: boolean };
export type DamagePopup = { id: number; x: number; value: number; critical: boolean };

export type BattleEvent =
  | { type: "notice"; message: string }
  | { type: "castle-hit"; team: Team }
  | { type: "damage-popup"; popup: DamagePopup }
  | { type: "death-effect"; effect: BattleDeathEffect }
  | { type: "wave-change"; waveIndex: number }
  | { type: "battle-end"; state: "victory" | "defeat"; reward?: BattleReward };

export type BattleSnapshot = {
  heroes: Unit[];
  enemies: Unit[];
  castleHp: number;
  enemyCastleHp: number;
  battleGold: number;
  waveIndex: number;
  spawnedInWave: number;
};
