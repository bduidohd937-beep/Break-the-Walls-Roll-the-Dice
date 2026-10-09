export const ECONOMY_MAX_LEVEL = 8;

// Temporary V0.2 playtest candidate. Not approved as final balance.
export const WALLET_CAPACITY_BY_LEVEL = [300, 500, 800, 1200, 1700, 2300, 3000, 4000] as const;
export const VAULT_CAPACITY_PER_LEVEL = 150;

export const getBattleEconomy = (economyLevel: number, vaultLevel: number, trainingLevel: number) => ({
  battleGoldMax: (WALLET_CAPACITY_BY_LEVEL[Math.max(0, Math.min(ECONOMY_MAX_LEVEL - 1, economyLevel - 1))] ?? WALLET_CAPACITY_BY_LEVEL[0]) + Math.max(0, vaultLevel - 1) * VAULT_CAPACITY_PER_LEVEL,
  goldPerSecond: 18 + (economyLevel - 1) * 9,
  trainingBonus: 1 + (trainingLevel - 1) * 0.02,
  battleStartGold: 0,
  economyUpgradeCost: economyLevel >= ECONOMY_MAX_LEVEL ? 0 : 120 + (economyLevel - 1) * 100,
});
