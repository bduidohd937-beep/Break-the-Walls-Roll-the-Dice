import type { UnitDef } from "../types";

export type HeroGradeName = "일반" | "희귀" | "영웅" | "전설" | "신화" | "초월";

// These prototype grades are tied to stable IDs so reordering HEROES cannot alter saves or summon pools.
export const HERO_GRADES: Record<string, HeroGradeName | "???"> = {
  traineeSword: "희귀",
  shield: "일반",
  HERO_003: "일반",
};

const GRADE_MULTIPLIER: Record<HeroGradeName | "???", number> = {
  일반: 1, 희귀: 1.6, 영웅: 2.5, 전설: 4, 신화: 6, 초월: 9, "???": 9,
};

export const getHeroGrade = (id: string) => {
  const name = HERO_GRADES[id];
  if (!name) throw new Error(`Unknown hero grade: ${id}`);
  return { name, multiplier: GRADE_MULTIPLIER[name] };
};

export const HERO_CONTENT_STATUS: Record<string, "초기 프로토타입" | "추가 임시 영웅" | "합성 전용"> = {
  traineeSword: "초기 프로토타입",
  shield: "초기 프로토타입",
  HERO_003: "초기 프로토타입",
};

export const GRADE_GROWTH: Record<HeroGradeName | "???", number> = {
  일반: 0.07, 희귀: 0.075, 영웅: 0.08, 전설: 0.085, 신화: 0.09, 초월: 0.10, "???": 0.10
};

export const GATHER_GRADE_BONUS: Record<HeroGradeName | "???", number> = {
  일반: 1, 희귀: 1.08, 영웅: 1.16, 전설: 1.25, 신화: 1.35, 초월: 1.5, "???": 1.5
};

export const getSoulBonuses = (soul: number) => ({
  hp: 1 + (soul >= 5 ? 0.08 : 0) + (soul >= 20 ? 0.12 : 0) + (soul >= 30 ? 0.1 : 0),
  atk: 1 + (soul >= 10 ? 0.08 : 0) + (soul >= 25 ? 0.12 : 0) + (soul >= 30 ? 0.1 : 0),
  speed: 1 - (soul >= 15 ? 0.08 : 0) - (soul >= 30 ? 0.05 : 0),
});

export const getHeroTrait = (def: UnitDef) => {
  if (def.ability === "guard") return { name: "가드", text: `받는 피해 ${Math.round((def.abilityValue ?? 0) * 100)}% 감소` };
  if (def.ability === "crit") return { name: "치명타", text: `치명타 확률 ${Math.round((def.abilityValue ?? 0) * 100)}%` };
  if (def.ability === "regen") return { name: "재생", text: `전투 중 지속 회복 ${((def.abilityValue ?? 0) * 100).toFixed(1)}%` };
  if (def.ability === "execute") return { name: "처형", text: `체력이 낮은 적에게 처형 판정 ${Math.round((def.abilityValue ?? 0) * 100)}%` };
  if (def.effect === "burn") return { name: "화상", text: "공격 적중 시 화상 피해" };
  if (def.attackType === "splash") return { name: "광역 공격", text: `주 대상 주변 ${def.splashRadius ?? 0} 범위 공격` };
  return { name: "기본 공격", text: def.rangeType === "ranged" ? "안전한 거리에서 단일 대상을 공격" : "전열에서 단일 대상을 공격" };
};
