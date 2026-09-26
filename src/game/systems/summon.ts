export type SummonGrade = "일반" | "희귀" | "영웅" | "전설" | "신화" | "초월";
export type SummonStorageItem = { uid: number; heroId: string; grade: SummonGrade };

export const SHARD_VALUE: Record<SummonGrade, number> = {
  일반: 5, 희귀: 15, 영웅: 40, 전설: 120, 신화: 400, 초월: 1500
};

export const rollSummonGrade = (minimumHero = false, random = Math.random): SummonGrade => {
  if (minimumHero) {
    const roll = random() * 10;
    if (roll < 0.05) return "초월";
    if (roll < 0.5) return "신화";
    if (roll < 3) return "전설";
    return "영웅";
  }
  const roll = random() * 100;
  if (roll < 0.05) return "초월";
  if (roll < 0.5) return "신화";
  if (roll < 3) return "전설";
  if (roll < 10) return "영웅";
  if (roll < 35) return "희귀";
  return "일반";
};

export const applySummonPity = (legendPity: number, mythPity: number, rolled: SummonGrade) => {
  const grade: SummonGrade = mythPity >= 500 ? "신화" : legendPity >= 100 ? "전설" : rolled;
  return {
    grade,
    legendPity: ["전설", "신화", "초월"].includes(grade) ? 0 : legendPity,
    mythPity: ["신화", "초월"].includes(grade) ? 0 : mythPity,
  };
};
