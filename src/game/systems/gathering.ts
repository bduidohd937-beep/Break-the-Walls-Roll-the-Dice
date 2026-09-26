export const GATHER_REGIONS = {
  basic: { name: "왕국 외곽", icon: "🌿", scale: 1, unlockStage: 0, description: "기본 채집 지역" },
  ancient: { name: "고대 숲", icon: "🌲", scale: 2, unlockStage: 2, description: "강화 자원 · 2배 보상" },
  crystal: { name: "수정 광산", icon: "💎", scale: 3, unlockStage: 4, description: "단단한 자원 · 3배 보상" }
} as const;

export type GatherRegionKey = keyof typeof GATHER_REGIONS;
export type ResourceType = "wood" | "stone";

export const getGatherEfficiency = (level: number, gradeBonus: number) =>
  (1 + (Math.max(1, level) - 1) * 0.03) * gradeBonus;

export const getAutoGatherAmount = (facilityLevel: number, kingdomProductionBonus: number, efficiency: number) =>
  Math.max(1, Math.floor(facilityLevel * kingdomProductionBonus * efficiency));

export const getGatherAttackDamage = (type: ResourceType, heroAttack?: number, levelMultiplier = 1) => {
  const baseDamage = type === "wood" ? 2 : 3;
  if (heroAttack == null) return baseDamage;
  return baseDamage + Math.max(1, Math.floor((heroAttack * levelMultiplier) / 55));
};

export const getResourceSellPrice = (type: ResourceType, kingdomSellBonus: number) =>
  Math.round((type === "wood" ? 5 : 8) * kingdomSellBonus);
