export type ProgressionContext = {
  clearedStages: number[];
  wood: number;
  stone: number;
  kingdomLevel: number;
  ownedHeroCount: number;
  unitLevels: Record<string, number>;
  facilityLevels: Record<string, number>;
};

export type ProgressionGoal = {
  id: string; icon: string; title: string; text: string; done: boolean; gold: number; gems: number;
};

export const getProgressionGoals = (ctx: ProgressionContext): ProgressionGoal[] => [
  { id: "first-clear", icon: "⚔️", title: "첫 승리", text: "스테이지 1을 클리어", done: ctx.clearedStages.includes(1), gold: 300, gems: 50 },
  { id: "gather-start", icon: "🌲", title: "왕국의 자원", text: "목재와 석재를 각각 10개 이상 보유", done: ctx.wood >= 10 && ctx.stone >= 10, gold: 400, gems: 0 },
  { id: "kingdom-2", icon: "🏰", title: "성장의 시작", text: "왕성을 Lv.2로 강화", done: ctx.kingdomLevel >= 2, gold: 500, gems: 50 },
  { id: "hero-roster", icon: "🎲", title: "새로운 동료", text: "영웅을 6명 이상 보유", done: ctx.ownedHeroCount >= 6, gold: 300, gems: 100 },
  { id: "hero-growth", icon: "🛡️", title: "전력 강화", text: "아무 영웅이나 Lv.2 이상 달성", done: Object.values(ctx.unitLevels).some((level) => level >= 2), gold: 600, gems: 50 },
  { id: "facility-growth", icon: "🏗️", title: "왕국 기반", text: "아무 시설이나 Lv.2 이상 달성", done: Object.values(ctx.facilityLevels).some((level) => level >= 2), gold: 700, gems: 0 },
  { id: "stage-10", icon: "🏆", title: "퓨어 월드 전진", text: "스테이지 10까지 클리어", done: ctx.clearedStages.some((stage) => stage >= 10), gold: 1200, gems: 150 },
  { id: "morgar", icon: "🌑", title: "검은 대지 돌파", text: "스테이지 20 모르가르 격파", done: ctx.clearedStages.includes(20), gold: 2500, gems: 300 },
];
