export type ElementType = "neutral" | "dark" | "fire";
export type Team = "hero" | "enemy";
export type AttackType = "single" | "splash";
export type RangeType = "melee" | "ranged";
export type AbilityType = "guard" | "crit" | "regen" | "execute";
export type TargetPriority = "frontline" | "ranged-lowest-hp";
export type LowHpEnrage = {
  hpThreshold: number;
  attackMultiplier: number;
  attackIntervalMultiplier: number;
  attackFlash: number;
};
export type UnitRarity = "COMMON" | "RARE" | "HEROIC" | "LEGENDARY" | "MYTHIC" | "TRANSCENDENT";
export type UnitRace = "HUMAN" | "UNDEAD" | "DRAGON" | "GIANT" | "MACHINE" | "SPIRIT" | "ANGEL" | "DEMON" | "BEAST" | "ABERRATION";
export type UnitCombatRole = "MELEE_DPS" | "RANGED_DPS" | "TANK" | "SUPPORT" | "HEALER" | "BUFFER" | "DEBUFFER" | "CONTROLLER";
export type SpriteAnimationConfig = { asset: string; frameCount: number; fps: number; loop: boolean; pivotX?: number; pivotY?: number; groundOffsetX?: number; groundOffsetY?: number; syncToAttackInterval?: boolean; impactFrame?: number; projectileSpawnFrame?: number; skillEventFrame?: number };
export type ProjectileVisualConfig = { asset: string; trailAsset?: string; releaseAsset?: string; pierceAsset?: string; impactAsset?: string };
export type SpriteConfig = {
  frameWidth: number; frameHeight: number; scale: number; pivotX: number; pivotY: number; groundOffsetX?: number; groundOffsetY?: number; facing?: "LEFT" | "RIGHT";
  projectileOrigin?: { x: number; y: number };
  animations: Partial<Record<"idle" | "move" | "attack" | "skill1" | "hit" | "knockback" | "stun" | "deploy" | "death", SpriteAnimationConfig>>;
  projectiles?: Partial<Record<"basic" | "skill1", ProjectileVisualConfig>>;
  ui?: Partial<Record<"portrait" | "deploy" | "skill1" | "soul" | "soulFragment", string>>;
};

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
  rarity?: UnitRarity;
  race?: UnitRace;
  combatRole?: UnitCombatRole;
  story?: string;
  effect?: "burn";
  attackType?: AttackType;
  splashRadius?: number;
  ability?: AbilityType;
  abilityValue?: number;
  targetPriority?: TargetPriority;
  lowHpEnrage?: LowHpEnrage;
  abilityIds?: readonly string[];
  spriteConfig?: SpriteConfig;
  gameplayBounds?: { width: number; height: number; collisionRadius?: number };
};

export type Unit = UnitDef & {
  baseAtk: number;
  deathEnraged?: boolean;
  uid: number;
  team: Team;
  x: number;
  currentHp: number;
  attackTimer: number;
  cooldownTimer: number;
  hitFlash: number;
  attackFlash: number;
  attackAnimationTimer?: number;
  attackAnimationSequence?: number;
  attackTargetX: number;
  abilityAnimationState?: "skill1";
  abilityAnimationTimer?: number;
  abilityAnimationDuration?: number;
  abilityAnimationSequence?: number;
  knockbackCount: number;
  knockbackTimer: number;
  knockbackFromX: number;
  knockbackTargetX: number;
  alive: boolean;
  moving?: boolean;
  burnTimer: number;
  burnDamage: number;
  slowTimer: number;
  slowMultiplier: number;
  specialTimer: number;
  summonOwnerUid?: number;
};

export type EnemyKey = "goblin" | "orc" | "darkKnight" | "fireOgre" | "archer" | "fireMage" | "assassin" | "gigantos" | "morgar" | "ignis" | "voltras" | "arcanon";
export type WaveGroup = { enemy: EnemyKey; count: number; gap?: number };
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
