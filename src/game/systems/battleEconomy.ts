export const ECONOMY_MAX_LEVEL = 8;

export const getBattleEconomy = (economyLevel: number, vaultLevel: number, trainingLevel: number) => ({
  battleGoldMax: 1000 + (vaultLevel - 1) * 250 + (economyLevel - 1) * 1250,
  goldPerSecond: 18 + (economyLevel - 1) * 9,
  trainingBonus: 1 + (trainingLevel - 1) * 0.02,
  battleStartGold: 300 + (vaultLevel - 1) * 50,
  economyUpgradeCost: economyLevel >= ECONOMY_MAX_LEVEL ? 0 : 120 + (economyLevel - 1) * 100,
});
