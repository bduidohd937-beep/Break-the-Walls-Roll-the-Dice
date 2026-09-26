import type { StageDef } from "./types";


const chapter1KeyStages: Record<number, Partial<StageDef>> = {
  1: { name: "대지의 서막", mechanic: "고블린 위주의 입문용 기초 웨이브" },
  3: { name: "첫 번째 낚시", type: "elite", mechanic: "자원 채집 이후 후속 기습으로 성채가 위협받는 첫 관문" },
  6: { name: "황금의 유혹", type: "elite", mechanic: "도망치는 황금 고블린을 추적하는 지정기·암살자 대응 구간" },
  9: { name: "발걸음의 무게", type: "boss", bossName: "대지룡 기간토스", mechanic: "대지룡 기간토스가 등장하는 첫 브레이크 포인트" },
  12: { name: "샌드위치 협공", type: "elite", mechanic: "양방향 동시 진격으로 전방 덱을 압박하는 포위 웨이브" },
  15: { name: "폭풍 전야", type: "elite", mechanic: "평온한 초반 이후 화염의 거인 오거가 등장하는 지연 웨이브" },
  18: { name: "완벽한 호위", type: "elite", mechanic: "엘리트를 보호하는 선행 잡몹을 신속히 제거해야 하는 호위 파훼전" },
  20: { name: "흑기사단장 모르가르", type: "boss", bossName: "흑기사단장 모르가르", mechanic: "주변 적 공격력 증가 · 흑기사 소환 · 사망 시 군세 광폭화", bossMechanic: { auraAtk: 0.2, summonEnemy: "darkKnight", summonInterval: 8, deathEnrage: 0.25 } },
  30: { name: "화염의 군주 이그니스", type: "boss", bossName: "화염의 군주 이그니스", mechanic: "화염 낙인 · 불타는 군세 증원 · 전장 전체 지속 화염 피해 · 물속성 조합 대응", bossMechanic: { summonEnemy: "fireMage", summonInterval: 7, fieldDamagePerSecond: 2 } },
  40: { name: "번개의 포식자 볼트라스", type: "boss", bossName: "번개의 포식자 볼트라스", mechanic: "단일 전격 · 연쇄 전류 · 전하 축적에 따른 전체 공속 증가 · 영웅 배치 퍼즐", bossMechanic: { enemyAttackSpeedPerStack: 0.04 } },
  50: { name: "균열의 포식자 아르카논", type: "boss", bossName: "균열의 포식자 아르카논", mechanic: "순수 → 불꽃 → 빙결 → 폭풍 → 종말 페이즈 변화와 주기적 증원", bossMechanic: { summonEnemy: "darkKnight", summonInterval: 6, phaseElements: ["순수", "불꽃", "빙결", "폭풍", "종말"] } }
};

const chapter1RangeMechanics = (id: number) => {
  if (id >= 21 && id <= 27) return "짤짤이 피해 무효화 · 은신 암살자 · 대규모 랜덤 증원 집중 구간";
  if (id >= 31 && id <= 39) return "전격 연쇄 전류 · 고속 러시 · 선공권 박탈 보스 선행 등장 구간";
  if (id >= 41 && id <= 49) return "연쇄 리스폰 · 시스템 제약 스킬 잠김 · 무너지는 성벽 공성 총공세";
  return undefined;
};

const chapter1Region = (id: number) => id <= 10 ? "원시 초원" : id <= 20 ? "검은 대지" : id <= 30 ? "불타는 변경" : id <= 40 ? "폭풍 지대" : "균열 성벽";

const makeStage = (id: number): StageDef => {
  const key = chapter1KeyStages[id] ?? {};
  const boss = key.type === "boss";
  const elite = key.type === "elite" || (!boss && id % 5 === 0);
  const type = boss ? "boss" : elite ? "elite" : "normal";
  const baseCount = 5 + Math.floor(id / 4);
  const enemyPool = id <= 10 ? ["goblin", "orc"] as const : id <= 20 ? ["orc", "darkKnight", "archer"] as const : id <= 30 ? ["darkKnight", "fireMage", "fireOgre"] as const : ["archer", "assassin", "fireMage", "darkKnight"] as const;
  const enemyA = enemyPool[(id - 1) % enemyPool.length];
  const enemyB = enemyPool[id % enemyPool.length];
  return {
    id,
    name: key.name ?? `퓨어 월드 전선 ${String(id).padStart(2, "0")}`,
    region: chapter1Region(id),
    type,
    story: id === 1 ? "태초의 마력이 흐르던 퓨어 월드에 정체 모를 균열이 발생하고, 야생 군세와 고대 괴수들이 성채를 향해 진격하기 시작한다." : undefined,
    mechanic: key.mechanic ?? chapter1RangeMechanics(id),
    bossName: key.bossName,
    implemented: [1, 3, 6, 9, 12, 15, 18, 20, 30, 40, 50].includes(id),
    enemyCastleHp: 1600 + id * 140,
    clearReward: 250 + id * 70,
    repeatReward: 90 + id * 22,
    firstClearGems: 25 + Math.floor(id / 5) * 5,
    waves: [
      [{ enemy: enemyA, count: baseCount, gap: 0.8 }],
      [{ enemy: enemyA, count: baseCount, gap: 0.65 }, { enemy: enemyB, count: Math.max(2, Math.floor(baseCount / 2)), gap: 1.1 }],
      [{ enemy: enemyB, count: baseCount + 1, gap: 0.6 }],
      [{ enemy: enemyA, count: baseCount + 2, gap: 0.55 }, { enemy: enemyB, count: Math.max(2, Math.floor(baseCount / 2)), gap: 0.9 }],
      [{ enemy: enemyB, count: baseCount + (boss ? 4 : 2), gap: 0.5 }],
    ],
    waveMeta: [
      { name: "선발대", reward: 60 + id * 6 },
      { name: "전선 충돌", reward: 80 + id * 7 },
      { name: "증원 부대", reward: 100 + id * 8 },
      { name: "성채 압박", reward: 120 + id * 9 },
      { name: boss ? key.bossName ?? "보스 결전" : "최종 공세", reward: 180 + id * 12, boss },
    ],
  };
};

export const STAGES: StageDef[] = Array.from({ length: 50 }, (_, index) => makeStage(index + 1));

export const STAGE_HP_SCALE = 0.1;
export const STAGE_ATK_SCALE = 0.06;
