import type { ElementType, UnitDef, Wave } from "./types";

export const HEROES: UnitDef[] = [
  { id: "goblin", name: "고블린", sprite: "👺", element: "neutral", hp: 90, atk: 14, speed: 48, range: 34, rangeType: "melee", attackType: "single", attackInterval: 0.9, cost: 50, cooldown: 2.5, role: "근접" },
  { id: "fireGoblin", name: "화염 고블린", sprite: "👺", element: "fire", hp: 82, atk: 24, speed: 43, range: 120, rangeType: "ranged", attackType: "single", attackInterval: 1.2, cost: 90, cooldown: 4, role: "원거리", effect: "burn" },
  { id: "shield", name: "철갑 방패병", sprite: "🛡️", element: "neutral", hp: 260, atk: 22, speed: 30, range: 32, rangeType: "melee", attackType: "single", attackInterval: 1.3, cost: 150, cooldown: 6, role: "탱커", ability: "guard", abilityValue: 0.22 },
  { id: "archer", name: "왕국 궁수", sprite: "🏹", element: "neutral", hp: 120, atk: 38, speed: 38, range: 190, rangeType: "ranged", attackType: "single", attackInterval: 1.35, cost: 180, cooldown: 7, role: "원거리" },
  { id: "knight", name: "왕국 기사", sprite: "⚔️", element: "neutral", hp: 430, atk: 65, speed: 34, range: 40, rangeType: "melee", attackType: "single", attackInterval: 1.5, cost: 400, cooldown: 10, role: "근접 딜러" },
  { id: "mage", name: "불꽃 마법사", sprite: "🧙", element: "fire", hp: 150, atk: 82, speed: 28, range: 210, rangeType: "ranged", attackInterval: 1.9, cost: 500, cooldown: 12, role: "광역 마법", effect: "burn", attackType: "splash", splashRadius: 12 },
  { id: "paladin", name: "성기사", sprite: "🧝", element: "dark", hp: 620, atk: 72, speed: 26, range: 42, rangeType: "melee", attackType: "single", attackInterval: 1.7, cost: 700, cooldown: 15, role: "탱커", ability: "regen", abilityValue: 0.018 },
  { id: "assassin", name: "암살자", sprite: "🥷", element: "dark", hp: 210, atk: 145, speed: 64, range: 45, rangeType: "melee", attackType: "single", attackInterval: 1.8, cost: 900, cooldown: 18, role: "암살자", ability: "crit", abilityValue: 0.28 },
  { id: "dragon", name: "성룡", sprite: "🐉", element: "fire", hp: 1250, atk: 220, speed: 30, range: 170, rangeType: "ranged", attackInterval: 2.4, cost: 1600, cooldown: 25, role: "광역", effect: "burn", attackType: "splash", splashRadius: 15 },
  { id: "arthur", name: "아서왕", sprite: "👑", element: "dark", hp: 2100, atk: 330, speed: 25, range: 55, rangeType: "melee", attackType: "single", attackInterval: 2.6, cost: 3000, cooldown: 40, role: "전설", ability: "execute", abilityValue: 0.25 },
];

export const ENEMIES: UnitDef[] = [
  { id: "goblinE", name: "굶주린 고블린", sprite: "👺", element: "neutral", hp: 70, atk: 10, speed: 42, range: 30, rangeType: "melee", attackType: "single", attackInterval: 1.1, cost: 0, cooldown: 0, role: "일반" },
  { id: "orcE", name: "오크 전사", sprite: "👹", element: "neutral", hp: 210, atk: 28, speed: 30, range: 35, rangeType: "melee", attackType: "single", attackInterval: 1.6, cost: 0, cooldown: 0, role: "전열" },
  { id: "darkKnightE", name: "다크 나이트", sprite: "🗡️", element: "dark", hp: 520, atk: 82, speed: 28, range: 42, rangeType: "melee", attackType: "single", attackInterval: 1.5, cost: 0, cooldown: 0, role: "엘리트" },
  { id: "fireOgreE", name: "화염의 거인 오거", sprite: "👹", element: "fire", hp: 1200, atk: 180, speed: 18, range: 55, rangeType: "melee", attackInterval: 2.5, cost: 0, cooldown: 0, role: "강적", attackType: "splash", splashRadius: 10 },
];

export const DECK_IDS = ["goblin", "fireGoblin", "shield", "archer", "knight", "mage", "paladin", "assassin", "dragon", "arthur"];

export const HERO_UNLOCK_STAGE: Record<string, number> = {
  goblin: 1,
  fireGoblin: 1,
  shield: 1,
  archer: 1,
  knight: 2,
  mage: 2,
  paladin: 2,
  assassin: 3,
  dragon: 3,
  arthur: 3,
};

export const ENEMY_MAP = {
  goblin: ENEMIES[0],
  orc: ENEMIES[1],
  darkKnight: ENEMIES[2],
  fireOgre: ENEMIES[3],
} as const;

export const WAVES: Wave[] = [
  [{ enemy: "goblin", count: 8, gap: 0.9 }],
  [{ enemy: "goblin", count: 5, gap: 0.6 }, { enemy: "orc", count: 3, gap: 1.2 }],
  [{ enemy: "goblin", count: 7, gap: 0.55 }, { enemy: "darkKnight", count: 1, gap: 2 }],
  [{ enemy: "orc", count: 5, gap: 0.8 }, { enemy: "goblin", count: 10, gap: 0.45 }],
  [{ enemy: "goblin", count: 8, gap: 0.45 }, { enemy: "orc", count: 4, gap: 0.9 }, { enemy: "fireOgre", count: 1, gap: 2.2 }],
];

export const WAVE_META: import("./types").WaveMeta[] = [
  { name: "고블린 습격", reward: 80 },
  { name: "오크 전열", reward: 110 },
  { name: "다크 나이트 출현", reward: 140 },
  { name: "끝없는 행군", reward: 180 },
  { name: "화염의 거인", reward: 300, boss: true },
];

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
export const MOVE_SPEED_MULTIPLIER = 1.8;
export const KNOCKBACK_DISTANCE = 7;
export const KNOCKBACK_MAX_COUNT = 3;
export const MIN_UNIT_GAP = 3.2;
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
