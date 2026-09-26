export const KINGDOM_UNLOCKS = [
  { level: 1, icon: "🪚", title: "기초 생산", text: "벌목장 · 채석장 운영" },
  { level: 2, icon: "🏦", title: "왕국 금고", text: "전투 시작 골드와 최대 골드 확장" },
  { level: 3, icon: "🏋️", title: "훈련소", text: "출전 영웅 HP / ATK 강화" },
  { level: 4, icon: "🌲", title: "생산 확장", text: "자동채집 생산 보너스 강화" },
  { level: 5, icon: "⚗️", title: "고급 성장", text: "합성·성장 시설 확장 기반" },
  { level: 6, icon: "👑", title: "왕국 2단계", text: "생산·판매 보너스 상위 단계" }
] as const;

export const FACILITY_DEFS = {
  lumber: { name: "벌목장", icon: "🪚", unlock: 1, baseCost: 180, text: (lv: number) => `배치 영웅 목재 자동채집 +${lv} / 3초` },
  quarry: { name: "채석장", icon: "⛏️", unlock: 1, baseCost: 180, text: (lv: number) => `배치 영웅 석재 자동채집 +${lv} / 3초` },
  vault: { name: "왕국 금고", icon: "🏦", unlock: 2, baseCost: 300, text: (lv: number) => `전투 시작 골드 +${(lv - 1) * 50} · 기본 최대 골드 +${(lv - 1) * 250}` },
  training: { name: "훈련소", icon: "🏋️", unlock: 3, baseCost: 360, text: (lv: number) => `출전 영웅 HP / ATK +${(lv - 1) * 2}%` }
} as const;

export type FacilityKey = keyof typeof FACILITY_DEFS;
