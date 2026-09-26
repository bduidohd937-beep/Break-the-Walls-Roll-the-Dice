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
  {
    id: 4,
    name: "그림자 협곡",
    enemyCastleHp: 3100,
    clearReward: 1100,
    waves: [
      [{ enemy: "goblin", count: 8, gap: 0.5 }, { enemy: "archer", count: 2, gap: 1.2 }],
      [{ enemy: "orc", count: 6, gap: 0.65 }, { enemy: "archer", count: 3, gap: 0.9 }],
      [{ enemy: "assassin", count: 4, gap: 0.8 }, { enemy: "darkKnight", count: 2, gap: 1.4 }],
      [{ enemy: "archer", count: 5, gap: 0.65 }, { enemy: "fireMage", count: 3, gap: 1 }],
      [{ enemy: "darkKnight", count: 4, gap: 0.7 }, { enemy: "assassin", count: 4, gap: 0.8 }, { enemy: "fireOgre", count: 1, gap: 2 }],
    ],
    waveMeta: [
      { name: "협곡의 궁수", reward: 180 },
      { name: "검은 매복", reward: 220 },
      { name: "암살자 부대", reward: 280 },
      { name: "불꽃 사술단", reward: 340 },
      { name: "그림자 거인", reward: 550, boss: true },
    ],
  },
  {
    id: 5,
    name: "왕국 최후방어선",
    enemyCastleHp: 3700,
    clearReward: 1500,
    waves: [
      [{ enemy: "orc", count: 8, gap: 0.55 }, { enemy: "archer", count: 3, gap: 0.8 }],
      [{ enemy: "fireMage", count: 5, gap: 0.75 }, { enemy: "assassin", count: 2, gap: 1.1 }],
      [{ enemy: "darkKnight", count: 5, gap: 0.7 }, { enemy: "archer", count: 4, gap: 0.75 }],
      [{ enemy: "fireMage", count: 4, gap: 0.7 }, { enemy: "assassin", count: 5, gap: 0.65 }],
      [{ enemy: "darkKnight", count: 6, gap: 0.55 }, { enemy: "fireMage", count: 4, gap: 0.8 }, { enemy: "fireOgre", count: 2, gap: 1.8 }],
    ],
    waveMeta: [
      { name: "최후방어선", reward: 220 },
      { name: "불꽃의 마법진", reward: 280 },
      { name: "왕국 정예병", reward: 340 },
      { name: "죽음의 매복", reward: 420 },
      { name: "왕국의 최종전", reward: 700, boss: true },
    ],
  },
];

export const STAGE_HP_SCALE = 0.1;
export const STAGE_ATK_SCALE = 0.06;
