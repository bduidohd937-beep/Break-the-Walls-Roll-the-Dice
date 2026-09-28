import { describe, expect, it } from "vitest";
import { HEROES } from "../../constants";
import { makeUnit } from "../../units/createUnit";
import { ABILITY_IDS, SOLDIER_HEAVY_STRIKE_BONUS_ATK_RATIO, resolveAbilityDefinitions } from "./definitions";
import { createCombatAbilityIntegration } from "./integration";
import type { AbilityUnit } from "./types";

const soldierDefinition = HEROES.find((hero) => hero.abilityIds?.includes(ABILITY_IDS.soldierHeavyStrike));
if (!soldierDefinition) throw new Error("Soldier ability fixture is missing");

function enemy(uid = 900): AbilityUnit {
  return makeUnit({
    id: "fixture-enemy",
    name: "Fixture Enemy",
    sprite: "",
    element: "neutral",
    hp: 10_000,
    atk: 0,
    speed: 0,
    range: 0,
    rangeType: "melee",
    attackInterval: 1,
    cost: 0,
    cooldown: 0,
    role: "fixture"
  }, "enemy", 21, uid);
}

function deploySoldier(uid: number): AbilityUnit {
  return makeUnit(soldierDefinition!, "hero", 20, uid);
}

function basicAttack(
  integration: ReturnType<typeof createCombatAbilityIntegration>,
  attackerUid: number,
  units: readonly AbilityUnit[],
  eventId: number
): readonly AbilityUnit[] {
  const attacker = units.find((unit) => unit.uid === attackerUid)!;
  const target = units.find((unit) => unit.team === "enemy")!;
  const afterBasicDamage = units.map((unit) => unit.uid === target.uid
    ? { ...unit, currentHp: unit.currentHp - attacker.atk }
    : unit);
  return integration.publish({
    type: "BASIC_ATTACK",
    eventId,
    attackId: eventId,
    origin: "BASIC_ATTACK",
    attackerUid,
    targetUid: target.uid
  }, afterBasicDamage).units;
}

describe("001 soldier heavy strike", () => {
  it("keeps the first and second attacks as normal basic attacks", () => {
    const soldier = deploySoldier(1);
    const integration = createCombatAbilityIntegration([]);
    integration.registerUnitAbilities(soldier.uid, resolveAbilityDefinitions(soldier.abilityIds));
    let units: readonly AbilityUnit[] = [soldier, enemy()];
    units = basicAttack(integration, soldier.uid, units, 1);
    units = basicAttack(integration, soldier.uid, units, 2);
    expect(units.find((unit) => unit.team === "enemy")?.currentHp).toBe(10_000 - soldier.atk * 2);
  });

  it("adds one heavy-strike bonus on the third and sixth basic attacks", () => {
    const soldier = deploySoldier(1);
    const integration = createCombatAbilityIntegration([]);
    integration.registerUnitAbilities(soldier.uid, resolveAbilityDefinitions(soldier.abilityIds));
    let units: readonly AbilityUnit[] = [soldier, enemy()];
    for (let attack = 1; attack <= 6; attack++) units = basicAttack(integration, soldier.uid, units, attack);
    const bonus = soldier.atk * SOLDIER_HEAVY_STRIKE_BONUS_ATK_RATIO;
    expect(units.find((unit) => unit.team === "enemy")?.currentHp).toBe(10_000 - soldier.atk * 6 - bonus * 2);
  });

  it("keeps counters independent for multiple deployed soldiers", () => {
    const first = deploySoldier(1);
    const second = deploySoldier(2);
    const integration = createCombatAbilityIntegration([]);
    integration.registerUnitAbilities(first.uid, resolveAbilityDefinitions(first.abilityIds));
    integration.registerUnitAbilities(second.uid, resolveAbilityDefinitions(second.abilityIds));
    let units: readonly AbilityUnit[] = [first, second, enemy()];
    units = basicAttack(integration, first.uid, units, 1);
    units = basicAttack(integration, second.uid, units, 2);
    units = basicAttack(integration, first.uid, units, 3);
    units = basicAttack(integration, first.uid, units, 4);
    const bonus = first.atk * SOLDIER_HEAVY_STRIKE_BONUS_ATK_RATIO;
    expect(units.find((unit) => unit.team === "enemy")?.currentHp).toBe(10_000 - first.atk * 4 - bonus);
  });

  it("clears the old counter and starts fresh after removal and redeploy", () => {
    const first = deploySoldier(1);
    const integration = createCombatAbilityIntegration([]);
    integration.registerUnitAbilities(first.uid, resolveAbilityDefinitions(first.abilityIds));
    let units: readonly AbilityUnit[] = [first, enemy()];
    units = basicAttack(integration, first.uid, units, 1);
    units = basicAttack(integration, first.uid, units, 2);
    integration.cleanup(new Set([900]));

    const redeployed = deploySoldier(3);
    integration.registerUnitAbilities(redeployed.uid, resolveAbilityDefinitions(redeployed.abilityIds));
    units = [redeployed, units.find((unit) => unit.uid === 900)!];
    units = basicAttack(integration, redeployed.uid, units, 3);
    expect(units.find((unit) => unit.uid === 900)?.currentHp).toBe(10_000 - first.atk * 2 - redeployed.atk);
  });
});
