export const GATHER_REGIONS = {
  basic: { name: "왕국 외곽", icon: "🌿", scale: 1, unlockStage: 0, description: "기본 채집 지역" },
  ancient: { name: "고대 숲", icon: "🌲", scale: 2, unlockStage: 2, description: "강화 자원 · 2배 보상" },
  crystal: { name: "수정 광산", icon: "💎", scale: 3, unlockStage: 4, description: "단단한 자원 · 3배 보상" }
} as const;

export type GatherRegionKey = keyof typeof GATHER_REGIONS;
export type ResourceType = "wood" | "stone";
