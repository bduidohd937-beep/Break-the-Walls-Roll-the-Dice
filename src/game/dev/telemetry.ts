import type { Team, Unit } from "../types";

export type UnitTelemetry = { id: string; uid: number; team: Team; spawnTime: number; deathTime?: number; damageDealt: number; damageReceived: number; healingDone: number; healingReceived: number; shieldGranted: number; kills: number; attacks: number; abilityActivations: number; statusApplied: number; statusReceived: number };
export type AbilityTelemetry = { abilityId: string; triggers: number; activations: number; damage: number; healing: number; shield: number; statusApplications: number };
export type BattleSummary = { duration: number; winner?: Team; allyCastleHp: number; enemyCastleHp: number; totalAlliesDeployed: number; totalEnemiesSpawned: number; totalUnitsDied: number; peakActiveAllies: number; peakActiveEnemies: number; battleGoldStarting: number; battleGoldEarned: number; battleGoldSpent: number; battleGoldEnding: number; units: UnitTelemetry[]; abilities: AbilityTelemetry[] };

export class BattleTelemetry {
  private readonly units = new Map<number, UnitTelemetry>();
  private readonly abilities = new Map<string, AbilityTelemetry>();
  private activeAllies = 0;
  private activeEnemies = 0;
  private peakAllies = 0;
  private peakEnemies = 0;
  private totalAllies = 0;
  private totalEnemies = 0;
  private deaths = 0;
  private earned = 0;
  private spent = 0;
  constructor(private readonly enabled = true, private readonly startingGold = 0) {}
  private getUnit(unit: Unit, time: number) { let entry = this.units.get(unit.uid); if (!entry) { entry = { id: unit.id, uid: unit.uid, team: unit.team, spawnTime: time, damageDealt: 0, damageReceived: 0, healingDone: 0, healingReceived: 0, shieldGranted: 0, kills: 0, attacks: 0, abilityActivations: 0, statusApplied: 0, statusReceived: 0 }; this.units.set(unit.uid, entry); if (unit.team === "hero") { this.totalAllies++; this.activeAllies++; this.peakAllies = Math.max(this.peakAllies, this.activeAllies); } else { this.totalEnemies++; this.activeEnemies++; this.peakEnemies = Math.max(this.peakEnemies, this.activeEnemies); } } return entry; }
  spawn(unit: Unit, time: number) { if (this.enabled) this.getUnit(unit, time); }
  death(unit: Unit, time: number) { if (!this.enabled) return; const entry = this.getUnit(unit, time); if (entry.deathTime === undefined) { entry.deathTime = time; this.deaths++; if (unit.team === "hero") this.activeAllies = Math.max(0, this.activeAllies - 1); else this.activeEnemies = Math.max(0, this.activeEnemies - 1); } }
  damage(source: Unit, target: Unit, amount: number) { if (!this.enabled) return; this.getUnit(source, 0).damageDealt += Math.max(0, amount); this.getUnit(target, 0).damageReceived += Math.max(0, amount); }
  heal(source: Unit, target: Unit, amount: number) { if (!this.enabled) return; this.getUnit(source, 0).healingDone += Math.max(0, amount); this.getUnit(target, 0).healingReceived += Math.max(0, amount); }
  shield(source: Unit, target: Unit, amount: number) { if (!this.enabled) return; this.getUnit(source, 0).shieldGranted += Math.max(0, amount); }
  attack(unit: Unit) { if (this.enabled) this.getUnit(unit, 0).attacks++; }
  ability(abilityId: string, owner: Unit, activated = true) { if (!this.enabled) return; this.getUnit(owner, 0).abilityActivations++; const entry = this.abilities.get(abilityId) ?? { abilityId, triggers: 0, activations: 0, damage: 0, healing: 0, shield: 0, statusApplications: 0 }; entry.triggers++; if (activated) entry.activations++; this.abilities.set(abilityId, entry); }
  status(source: Unit, target: Unit) { if (!this.enabled) return; this.getUnit(source, 0).statusApplied++; this.getUnit(target, 0).statusReceived++; }
  goldEarned(amount: number) { if (this.enabled) this.earned += Math.max(0, amount); }
  goldSpent(amount: number) { if (this.enabled) this.spent += Math.max(0, amount); }
  summary(duration: number, winner: Team | undefined, allyCastleHp: number, enemyCastleHp: number, endingGold: number): BattleSummary { return { duration, winner, allyCastleHp, enemyCastleHp, totalAlliesDeployed: this.totalAllies, totalEnemiesSpawned: this.totalEnemies, totalUnitsDied: this.deaths, peakActiveAllies: this.peakAllies, peakActiveEnemies: this.peakEnemies, battleGoldStarting: this.startingGold, battleGoldEarned: this.earned, battleGoldSpent: this.spent, battleGoldEnding: endingGold, units: [...this.units.values()], abilities: [...this.abilities.values()] }; }
}

export const formatBalanceReport = (summary: BattleSummary) => ({ ...summary, reportTitle: "BATTLE SUMMARY" });
