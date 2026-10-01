export type BattleState = "stageSelect" | "playing" | "victory" | "defeat";
export type BattleReward = { gold: number; gems: number; firstClear: boolean };
export type DamagePopup = { id: number; x: number; value: number; critical: boolean };
