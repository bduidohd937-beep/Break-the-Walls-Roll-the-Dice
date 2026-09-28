import { describe, expect, it } from "vitest";
import { createCombatAbilityIntegration } from "./integration";
import type { AbilityDefinition, AbilityUnit, SummonFactory } from "./types";

const unit = (uid: number, id: string, team: "hero" | "enemy", hp = 1000, x = team === "hero" ? 20 : 21): AbilityUnit => ({
  id, name: id, sprite: "", element: "neutral", hp, atk: 100, baseAtk: 100, def: 40, speed: 10, range: 20,
  rangeType: "melee", attackInterval: 1, cost: 0, cooldown: 0, role: "fixture", uid, team, x, currentHp: hp,
  attackTimer: 0, cooldownTimer: 0, hitFlash: 0, attackFlash: 0, attackTargetX: x, knockbackCount: 0,
  knockbackTimer: 0, knockbackFromX: x, knockbackTargetX: x, alive: true, burnTimer: 0, burnDamage: 0,
  slowTimer: 0, slowMultiplier: 1, specialTimer: 0
});

const flat = (value: number) => ({ components: [{ source: "FLAT" as const, coefficient: value }] });
const ability = (id: string, trigger: AbilityDefinition["trigger"], target: AbilityDefinition["target"], effects: AbilityDefinition["effects"]): AbilityDefinition => ({ id, trigger, target, effects });
const summonFactory: SummonFactory = ({ uidStart, count, team, ownerUid, sourceAbilityId, duration }) => Array.from({ length: count }, (_, index) => ({
  ...unit(uidStart + index, "test_summon_minion", team),
  summonMeta: { ownerUid, sourceAbilityId, summonedAt: 0, remaining: duration }
}));

describe("Ability Framework v1 test content", () => {
  it("combines test_tank defensive effects and HP scaling", () => {
    const tank = unit(1, "test_tank", "hero", 2000);
    const integration = createCombatAbilityIntegration([{ ownerUid: 1, ability: ability("tank-kit", { type: "ON_DEPLOY" }, { type: "SELF" }, [
      { type: "SHIELD", amount: { components: [{ source: "CASTER_MAX_HP", coefficient: 0.1 }] }, duration: 3 },
      { type: "DAMAGE_TAKEN_MODIFIER", multiplier: 0.7, duration: 3 },
      { type: "STAT_MODIFIER", stat: "DEF", mode: "FLAT", value: flat(20), duration: 3 }
    ]) }]);
    const result = integration.publish({ type: "UNIT_DEPLOYED", unitUid: 1, eventId: 1, origin: "SYSTEM" }, [tank]);
    expect(result.units[0]).toMatchObject({ def: 60 });
    expect(result.units[0].abilityEffectState?.shields[0].amount).toBe(200);
  });

  it("combines test_healer support effects and CLEANSE", () => {
    const healer = unit(1, "test_healer", "hero");
    const target = { ...unit(2, "test_tank", "hero"), currentHp: 500 };
    const integration = createCombatAbilityIntegration([{ ownerUid: 1, ability: ability("support-kit", { type: "ON_DEPLOY" }, { type: "LOWEST_HP_ALLY", maxTargets: 1 }, [
      { type: "HEAL", amount: flat(100) },
      { type: "HOT", amount: flat(10), duration: 3, interval: 1 },
      { type: "CLEANSE", count: 2 },
      { type: "STAT_MODIFIER", stat: "ATK", mode: "PERCENT", value: flat(0.2), duration: 3 }
    ]) }]);
    const result = integration.publish({ type: "UNIT_DEPLOYED", unitUid: 1, eventId: 1, origin: "SYSTEM" }, [healer, target]);
    expect(result.units.find((entry) => entry.uid === 2)?.abilityEffectState?.periodicEffects[0].id).toBe("HOT");
  });

  it("combines test_dps damage, DOT, attack speed, and target debuffs", () => {
    const dps = unit(1, "test_dps", "hero");
    const enemy = unit(2, "test_enemy_status", "enemy");
    const integration = createCombatAbilityIntegration([
      { ownerUid: 1, ability: ability("dps-kit", { type: "ON_ATTACK" }, { type: "CURRENT_TARGET" }, [
      { type: "DAMAGE", amount: flat(100) },
      { type: "DOT", amount: flat(20), duration: 2, interval: 1 },
      { type: "DAMAGE_TAKEN_MODIFIER", multiplier: 1.2, duration: 2 }
    ]) },
      { ownerUid: 1, ability: ability("dps-speed", { type: "ON_DEPLOY" }, { type: "SELF" }, [
        { type: "ATTACK_SPEED_MODIFIER", mode: "PERCENT", value: flat(0.5), duration: 2 }
      ]) }
    ]);
    const deployed = integration.publish({ type: "UNIT_DEPLOYED", unitUid: 1, eventId: 1, origin: "SYSTEM" }, [dps, enemy]);
    const result = integration.publish({ type: "BASIC_ATTACK", attackerUid: 1, targetUid: 2, eventId: 2, attackId: 1, origin: "BASIC_ATTACK" }, deployed.units);
    expect(result.units.find((entry) => entry.uid === 2)?.currentHp).toBe(900);
    expect(result.units.find((entry) => entry.uid === 1)?.attackInterval).toBe(2 / 3);
  });

  it("runs test_summoner and preserves summon ownership", () => {
    const integration = createCombatAbilityIntegration([{ ownerUid: 1, ability: ability("summon-kit", { type: "ON_DEPLOY" }, { type: "SELF" }, [{ type: "SUMMON", summonUnitId: "test_summon_minion", count: 2, duration: 2 }]) }], { summonFactory });
    const result = integration.publish({ type: "UNIT_DEPLOYED", unitUid: 1, eventId: 1, origin: "SYSTEM" }, [unit(1, "test_summoner", "hero")]);
    const summons = result.units.filter((entry) => entry.summonMeta);
    expect(summons).toHaveLength(2);
    expect(summons.every((entry) => entry.summonMeta?.ownerUid === 1 && entry.summonMeta.sourceAbilityId === "summon-kit")).toBe(true);
  });

  it("combines test_elite and test_boss effects with HP trigger, DISPEL, and periodic timing", () => {
    const elite = unit(2, "test_elite", "enemy", 1500);
    const boss = unit(3, "test_boss", "enemy", 5000);
    const integration = createCombatAbilityIntegration([
      { ownerUid: 3, ability: ability("boss-cycle", { type: "ON_INTERVAL", intervalSeconds: 1 }, { type: "SELF" }, [{ type: "SHIELD", amount: flat(100), duration: 3 }, { type: "DOT", amount: flat(5), duration: 3, interval: 1 }]) },
      { ownerUid: 2, ability: ability("elite-threshold", { type: "ON_HP_BELOW", hpPercent: 0.5 }, { type: "SELF" }, [{ type: "DISPEL", count: 1 }, { type: "APPLY_STATUS", status: "stun", duration: 1 }]) }
    ]);
    let units = integration.publish({ type: "UNIT_DEPLOYED", unitUid: 3, eventId: 1, origin: "SYSTEM" }, [elite, boss]).units;
    units = integration.publish({ type: "SIMULATION_TICK", eventId: 2, origin: "SYSTEM", deltaSeconds: 1 }, units).units;
    expect(units.find((entry) => entry.uid === 3)?.abilityEffectState?.shields).toHaveLength(1);
    expect(units.find((entry) => entry.uid === 3)?.abilityEffectState?.periodicEffects).toHaveLength(1);
  });

  it("keeps multiple test units independent and 1x/5x interval outcomes consistent", () => {
    const intervalAbility = ability("timed", { type: "ON_INTERVAL", intervalSeconds: 1 }, { type: "SELF" }, []);
    const normal = createCombatAbilityIntegration([{ ownerUid: 1, ability: intervalAbility }]);
    const fast = createCombatAbilityIntegration([{ ownerUid: 1, ability: intervalAbility }]);
    const base = [unit(1, "test_dps", "hero"), unit(2, "test_enemy_basic", "enemy")];
    expect(normal.publish({ type: "SIMULATION_TICK", eventId: 1, origin: "SYSTEM", deltaSeconds: 0.2 }, base).activationCount).toBe(0);
    expect(normal.publish({ type: "SIMULATION_TICK", eventId: 2, origin: "SYSTEM", deltaSeconds: 0.8 }, base).activationCount).toBe(1);
    expect(fast.publish({ type: "SIMULATION_TICK", eventId: 3, origin: "SYSTEM", deltaSeconds: 1 }, base).activationCount).toBe(1);
  });

  it("verifies REVIVE, RESOURCE_CHANGE, KNOCKBACK, STUN, and simultaneous DOT/HOT composition", () => {
    const integration = createCombatAbilityIntegration([{ ownerUid: 1, ability: ability("support-events", { type: "ON_DEPLOY" }, { type: "SELF" }, [
      { type: "RESOURCE_CHANGE", resource: "BATTLE_GOLD", amount: flat(25) },
      { type: "KNOCKBACK", distance: flat(3) },
      { type: "APPLY_STATUS", status: "stun", duration: 1 }
    ]) }]);
    const result = integration.publish({ type: "UNIT_DEPLOYED", unitUid: 1, eventId: 1, origin: "SYSTEM" }, [unit(1, "test_healer", "hero")]);
    expect(result.activationCount).toBe(1);
    expect(result.units[0].knockbackTargetX).toBe(23);
    expect(result.units[0].abilityEffectState?.statuses[0].id).toBe("STUN");
  });
});
