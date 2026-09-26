export type ElementType = "neutral" | "dark" | "fire";
export type Team = "hero" | "enemy";
export type AttackType = "single" | "splash";
export type RangeType = "melee" | "ranged";
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
  rangeType: RangeType;
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
  attackTargetX: number;
  knockbackCount: number;
  knockbackTimer: number;
  knockbackFromX: number;
  knockbackTargetX: number;
  alive: boolean;
  burnTimer: number;
  burnDamage: number;
};

export type WaveGroup = { enemy: "goblin" | "orc" | "darkKnight" | "fireOgre" | "archer" | "fireMage" | "assassin"; count: number; gap?: number };
export type Wave = WaveGroup[];
export type WaveMeta = {
  name: string;
  reward: number;
  boss?: boolean;
};

export type StageType = "normal" | "elite" | "boss";
export type BossMechanic = {
  auraAtk?: number;
  summonEnemy?: WaveGroup["enemy"];
  summonInterval?: number;
  deathEnrage?: number;
  fieldDamagePerSecond?: number;
  enemyAttackSpeedPerStack?: number;
  phaseElements?: string[];
};

export type StageDef = {
  id: number;
  name: string;
  region: string;
  type: StageType;
  waves: Wave[];
  waveMeta: WaveMeta[];
  enemyCastleHp: number;
  clearReward: number;
  repeatReward: number;
  firstClearGems: number;
  story?: string;
  mechanic?: string;
  bossName?: string;
  implemented?: boolean;
  bossMechanic?: BossMechanic;
};
