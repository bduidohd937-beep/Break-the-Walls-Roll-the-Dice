export type ElementType = "neutral" | "dark" | "fire";
export type Team = "hero" | "enemy";
export type AttackType = "single" | "splash";
export type AbilityType = "guard" | "crit" | "regen" | "execute";

export type UnitDef = {
  id: string;
  name: string;
  sprite: string;
  element: ElementType;
  hp: number;
  atk: number;
  speed: number;
  range: number;
  attackInterval: number;
  cost: number;
  cooldown: number;
  role: string;
  effect?: "burn";
  attackType?: AttackType;
  splashRadius?: number;
  ability?: AbilityType;
  abilityValue?: number;
};

export type Unit = UnitDef & {
  uid: number;
  team: Team;
  x: number;
  currentHp: number;
  attackTimer: number;
  cooldownTimer: number;
  hitFlash: number;
  attackFlash: number;
  knockbackCount: number;
  knockbackTimer: number;
  knockbackFromX: number;
  knockbackTargetX: number;
  alive: boolean;
  burnTimer: number;
  burnDamage: number;
};

export type WaveGroup = { enemy: "goblin" | "orc" | "darkKnight" | "fireOgre"; count: number; gap?: number };
export type Wave = WaveGroup[];
export type WaveMeta = {
  name: string;
  reward: number;
  boss?: boolean;
};

export type StageDef = {
  id: number;
  name: string;
  waves: Wave[];
  waveMeta: WaveMeta[];
  enemyCastleHp: number;
  clearReward: number;
};
