import type { StageDef } from "./types";

export const STAGES: StageDef[] = [
  {
    id: 1,
    name: "성 공략전",
    enemyCastleHp: 1800,
    clearReward: 300,
    waves: [
      [{ enemy: "goblin", count: 8, gap: 0.9 }],
      [{ enemy: "goblin", count: 5, gap: 0.6 }, { enemy: "orc", count: 3, gap: 1.2 }],
      [{ enemy: "goblin", count: 7, gap: 0.55 }, { enemy: "darkKnight", count: 1, gap: 2 }],
      [{ enemy: "orc", count: 5, gap: 0.8 }, { enemy: "goblin", count: 10, gap: 0.45 }],
      [{ enemy: "goblin", count: 8, gap: 0.45 }, { enemy: "orc", count: 4, gap: 0.9 }, { enemy: "fireOgre", count: 1, gap: 2.2 }],
    ],
    waveMeta: [
      { name: "고블린 습격", reward: 80 },
      { name: "오크 전열", reward: 110 },
      { name: "다크 나이트 출현", reward: 140 },
      { name: "끝없는 행군", reward: 180 },
      { name: "화염의 거인", reward: 300, boss: true },
    ],
  },
  {
    id: 2,
    name: "오크의 진군",
    enemyCastleHp: 2200,
    clearReward: 500,
    waves: [
      [{ enemy: "goblin", count: 6, gap: 0.7 }, { enemy: "orc", count: 2, gap: 1.1 }],
      [{ enemy: "orc", count: 5, gap: 0.8 }],
      [{ enemy: "goblin", count: 8, gap: 0.45 }, { enemy: "darkKnight", count: 2, gap: 1.4 }],
      [{ enemy: "orc", count: 7, gap: 0.6 }, { enemy: "darkKnight", count: 2, gap: 1.2 }],
      [{ enemy: "orc", count: 8, gap: 0.55 }, { enemy: "fireOgre", count: 2, gap: 1.8 }],
    ],
    waveMeta: [
      { name: "선발대", reward: 100 },
      { name: "오크 전열", reward: 140 },
      { name: "검은 칼날", reward: 180 },
      { name: "오크 대군", reward: 220 },
      { name: "거인의 행군", reward: 380, boss: true },
    ],
  },
  {
    id: 3,
    name: "화염의 전장",
    enemyCastleHp: 2600,
    clearReward: 800,
    waves: [
      [{ enemy: "goblin", count: 10, gap: 0.5 }],
      [{ enemy: "orc", count: 5, gap: 0.7 }, { enemy: "darkKnight", count: 1, gap: 1.8 }],
      [{ enemy: "darkKnight", count: 4, gap: 0.8 }],
      [{ enemy: "orc", count: 8, gap: 0.5 }, { enemy: "fireOgre", count: 1, gap: 2 }],
      [{ enemy: "darkKnight", count: 5, gap: 0.65 }, { enemy: "fireOgre", count: 2, gap: 1.8 }],
    ],
    waveMeta: [
      { name: "불길의 전조", reward: 120 },
      { name: "검은 전선", reward: 160 },
      { name: "다크 나이트 부대", reward: 210 },
      { name: "화염 전선", reward: 260 },
      { name: "화염의 군단", reward: 450, boss: true },
    ],
  },
];

export const STAGE_HP_SCALE = 0.1;
export const STAGE_ATK_SCALE = 0.06;
