import type { ElementType, UnitDef } from "./types";
import { ABILITY_IDS } from "./combat/abilities/definitions";
import { UNIT_SPRITE_CONFIGS } from "./visuals/sprites";

export const HEROES: UnitDef[] = [
  { id: "traineeSword", name: "병사", sprite: "🗡️", element: "neutral", hp: 180, atk: 42, speed: 39, range: 38, rangeType: "melee", attackType: "single", attackInterval: 1.05, cost: 160, cooldown: 6, role: "근접 딜러", abilityIds: [ABILITY_IDS.soldierHeavyStrike], spriteConfig: UNIT_SPRITE_CONFIGS.traineeSword },
  { id: "shield", name: "철갑 방패병", sprite: "🛡️", element: "neutral", hp: 260, atk: 22, speed: 30, range: 32, rangeType: "melee", attackType: "single", attackInterval: 1.3, cost: 150, cooldown: 6, role: "탱커", ability: "guard", abilityValue: 0.22, spriteConfig: UNIT_SPRITE_CONFIGS.shield },
  { id: "HERO_003", name: "왕국 궁수", sprite: "🏹", element: "neutral", rarity: "COMMON", race: "HUMAN", combatRole: "RANGED_DPS", hp: 120, atk: 38, speed: 38, range: 190, rangeType: "ranged", attackType: "single", attackInterval: 1.35, cost: 180, cooldown: 7, role: "원거리 딜러", abilityIds: [ABILITY_IDS.kingdomArcherPiercingArrow], spriteConfig: UNIT_SPRITE_CONFIGS.HERO_003 },
];

export const ENEMIES: UnitDef[] = [
  { id: "goblinE", name: "굶주린 고블린", sprite: "👺", element: "neutral", hp: 70, atk: 10, speed: 42, range: 30, rangeType: "melee", attackType: "single", attackInterval: 1.1, cost: 0, cooldown: 0, role: "일반" },
  { id: "orcE", name: "오크 전사", sprite: "👹", element: "neutral", hp: 210, atk: 28, speed: 30, range: 35, rangeType: "melee", attackType: "single", attackInterval: 1.6, cost: 0, cooldown: 0, role: "전열" },
  { id: "darkKnightE", name: "다크 나이트", sprite: "🗡️", element: "dark", hp: 520, atk: 82, speed: 28, range: 42, rangeType: "melee", attackType: "single", attackInterval: 1.5, cost: 0, cooldown: 0, role: "엘리트" },
  { id: "fireOgreE", name: "화염의 거인 오거", sprite: "👹", element: "fire", hp: 1200, atk: 180, speed: 18, range: 55, rangeType: "melee", attackInterval: 2.5, cost: 0, cooldown: 0, role: "강적", attackType: "splash", splashRadius: 10 },
  { id: "gigantosE", name: "대지룡 기간토스", sprite: "🐲", element: "neutral", hp: 1200, atk: 180, speed: 18, range: 55, rangeType: "melee", attackInterval: 2.5, cost: 0, cooldown: 0, role: "보스 · 대지룡", attackType: "splash", splashRadius: 10 },
  { id: "archerE", name: "오크 궁수", sprite: "🏹", element: "neutral", hp: 150, atk: 34, speed: 22, range: 150, rangeType: "ranged", attackInterval: 1.6, cost: 0, cooldown: 0, role: "원거리" },
  { id: "fireMageE", name: "불꽃 사술사", sprite: "🔮", element: "fire", hp: 220, atk: 58, speed: 18, range: 175, rangeType: "ranged", attackInterval: 2.1, cost: 0, cooldown: 0, role: "광역", attackType: "splash", splashRadius: 10, effect: "burn" },
  { id: "assassinE", name: "그림자 암살자", sprite: "🥷", element: "dark", hp: 180, atk: 105, speed: 58, range: 42, rangeType: "melee", attackInterval: 1.7, cost: 0, cooldown: 0, role: "암살자" },
  { id: "morgarE", name: "흑기사단장 모르가르", sprite: "🌑", element: "dark", hp: 3200, atk: 220, speed: 24, range: 55, rangeType: "melee", attackInterval: 1.55, cost: 0, cooldown: 0, role: "월드 보스", attackType: "splash", splashRadius: 9 },
  { id: "ignisE", name: "화염의 군주 이그니스", sprite: "🔥", element: "fire", hp: 5200, atk: 290, speed: 20, range: 75, rangeType: "melee", attackInterval: 1.9, cost: 0, cooldown: 0, role: "월드 보스", attackType: "splash", splashRadius: 13, effect: "burn" },
  { id: "voltrasE", name: "번개의 포식자 볼트라스", sprite: "⚡", element: "neutral", hp: 7600, atk: 350, speed: 34, range: 110, rangeType: "ranged", attackInterval: 1.25, cost: 0, cooldown: 0, role: "월드 보스", attackType: "splash", splashRadius: 11 },
  { id: "arcanonE", name: "균열의 포식자 아르카논", sprite: "⚪", element: "neutral", hp: 12000, atk: 460, speed: 25, range: 125, rangeType: "ranged", attackInterval: 1.5, cost: 0, cooldown: 0, role: "월드 보스", attackType: "splash", splashRadius: 15 },
];

export const DECK_IDS = HEROES.map((hero) => hero.id);
export const GRANTED_HERO_IDS = ["traineeSword", "shield", "HERO_003"];


export const ENEMY_MAP = {
  goblin: ENEMIES[0],
  orc: ENEMIES[1],
  darkKnight: ENEMIES[2],
  fireOgre: ENEMIES[3],
  gigantos: ENEMIES[4],
  archer: ENEMIES[5],
  fireMage: ENEMIES[6],
  assassin: ENEMIES[7],
  morgar: ENEMIES[8],
  ignis: ENEMIES[9],
  voltras: ENEMIES[10],
  arcanon: ENEMIES[11],
} as const;

export const WAVE_HP_SCALE = 0.08;
export const WAVE_ATK_SCALE = 0.05;

export const ELEMENT_LABEL: Record<ElementType, string> = {
  neutral: "무속성",
  dark: "어둠",
  fire: "불",
};

export const ELEMENT_CLASS: Record<ElementType, string> = {
  neutral: "el-neutral",
  dark: "el-dark",
  fire: "el-fire",
};

export const BATTLE_GOLD_MAX = 9999;
export const SUMMON_GEM_COST = 100;
export const INITIAL_GEMS = 300;
export const MOVE_SPEED_MULTIPLIER = 1.8;
export const KNOCKBACK_DISTANCE = 7;
export const KNOCKBACK_MAX_COUNT = 3;
export const MIN_UNIT_GAP = 3.2;
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
