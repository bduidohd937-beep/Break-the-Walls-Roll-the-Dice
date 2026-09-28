import { describe, expect, it } from "vitest";
import { BattleTelemetry, formatBalanceReport } from "./telemetry";
import { createTestBattleUnits } from "./testContent";
import { makeUnit } from "../units/createUnit";
import type { UnitDef } from "../types";

const def: UnitDef = { id: "test_common", name: "test_common", sprite: "?", element: "neutral", hp: 100, atk: 10, speed: 1, range: 1, rangeType: "melee", attackInterval: 1, cost: 10, cooldown: 1, role: "test" };
const pair = () => [makeUnit(def, "hero", 20, 1, () => 0), makeUnit({ ...def, id: "test_enemy_basic" }, "enemy", 21, 2, () => 0)];

describe("battle telemetry", () => {
  it("collects summary without changing disabled simulation observation", () => {
    const [hero, enemy] = pair(); const off = new BattleTelemetry(false); off.spawn(hero, 0); off.damage(hero, enemy, 20); expect(off.summary(1, "hero", 100, 80, 0).totalEnemiesSpawned).toBe(0);
    const on = new BattleTelemetry(true, 50); on.spawn(hero, 0); on.spawn(enemy, 0); on.damage(hero, enemy, 20); on.heal(hero, hero, 5); on.shield(hero, hero, 10); on.attack(hero); on.ability("test", hero); on.status(hero, enemy); on.goldEarned(20); on.goldSpent(10); on.death(enemy, 1);
    const summary = on.summary(1, "hero", 100, 80, 60); expect(summary).toMatchObject({ totalAlliesDeployed: 1, totalEnemiesSpawned: 1, totalUnitsDied: 1, battleGoldEarned: 20, battleGoldSpent: 10 }); expect(formatBalanceReport(summary).reportTitle).toBe("BATTLE SUMMARY");
  });
  it("keeps duplicate hero deployments independent by UID", () => { const heroes = pair()[0]; const second = { ...heroes, uid: 3 }; const telemetry = new BattleTelemetry(); telemetry.spawn(heroes, 0); telemetry.spawn(second, 1); telemetry.attack(heroes); const result = telemetry.summary(1, undefined, 0, 0, 0); expect(result.units).toHaveLength(2); expect(result.units.find((unit) => unit.uid === 3)?.attacks).toBe(0); });
  it("supports the 50 ally + 30 enemy headless scenario", () => { expect(createTestBattleUnits(50, 30)).toHaveLength(80); });
  it("does not make 1x/5x change event totals", () => { const run = (speed: number) => { const [hero, enemy] = pair(); const telemetry = new BattleTelemetry(); telemetry.spawn(hero, 0); telemetry.spawn(enemy, 0); for (let i = 0; i < 5; i++) telemetry.damage(hero, enemy, 2); return telemetry.summary(1 / speed, "hero", 1, 1, 0); }; expect(run(1).units[0].damageDealt).toBe(run(5).units[0].damageDealt); });
});
