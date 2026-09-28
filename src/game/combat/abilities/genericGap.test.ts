import { describe, expect, it } from "vitest";
import { createCombatAbilityIntegration } from "./integration";
import { executeEffect } from "./effects";
import type { AbilityDefinition, AbilityUnit } from "./types";

const unit = (uid: number, team: "hero" | "enemy", currentHp = 1000): AbilityUnit => ({
  id: `fixture_${uid}`, name: `fixture_${uid}`, sprite: "", element: "neutral", hp: 1000, atk: 100, baseAtk: 100,
  def: 40, speed: 10, range: 20, rangeType: "melee", attackInterval: 1, cost: 0, cooldown: 0, role: "fixture",
  uid, team, x: team === "hero" ? 20 : 21, currentHp, attackTimer: 0, cooldownTimer: 0, hitFlash: 0, attackFlash: 0,
  attackTargetX: 20, knockbackCount: 0, knockbackTimer: 0, knockbackFromX: 20, knockbackTargetX: 20,
  alive: currentHp > 0, burnTimer: 0, burnDamage: 0, slowTimer: 0, slowMultiplier: 1, specialTimer: 0
});
const flat = (coefficient: number) => ({ components: [{ source: "FLAT" as const, coefficient }] });
const def = (id: string, trigger: AbilityDefinition["trigger"], target: AbilityDefinition["target"], effects: AbilityDefinition["effects"]): AbilityDefinition => ({ id, trigger, target, effects });

describe("generic Ability Framework gaps", () => {
  it("preserves RESOURCE_CHANGE through nested integration dispatch", () => {
    const integration = createCombatAbilityIntegration([{ ownerUid: 1, ability: def("gold", { type: "ON_DEPLOY" }, { type: "SELF" }, [
      { type: "RESOURCE_CHANGE", resource: "BATTLE_GOLD", amount: flat(25) }, { type: "SHIELD", amount: flat(10), duration: 2 }
    ]) }]);
    const result = integration.publish({ type: "UNIT_DEPLOYED", unitUid: 1, eventId: 1, origin: "SYSTEM" }, [unit(1, "hero")]);
    expect(result.resourceChanges).toEqual([{ resource: "BATTLE_GOLD", amount: 25, ownerUid: 1, abilityId: "gold" }]);
  });

  it("fires ON_REVIVE only after a successful revive", () => {
    const integration = createCombatAbilityIntegration([
      { ownerUid: 1, ability: def("revive", { type: "ON_DEPLOY" }, { type: "DEAD_ALLY" }, [{ type: "REVIVE", amount: flat(200) }]) },
      { ownerUid: 2, ability: def("after-revive", { type: "ON_REVIVE" }, { type: "SELF" }, [{ type: "SHIELD", amount: flat(5), duration: 2 }]) }
    ]);
    const revived = integration.publish({ type: "UNIT_DEPLOYED", unitUid: 1, eventId: 1, origin: "SYSTEM" }, [unit(1, "hero"), unit(2, "hero", 0)]);
    expect(revived.units.find((entry) => entry.uid === 2)?.currentHp).toBe(200);
    expect(revived.units.find((entry) => entry.uid === 2)?.abilityEffectState?.shields).toHaveLength(1);
    expect(integration.publish({ type: "UNIT_DEPLOYED", unitUid: 1, eventId: 2, origin: "SYSTEM" }, [unit(1, "hero"), unit(2, "hero")]).activationCount).toBe(0);
  });

  it("fires filtered ON_STATUS_APPLIED without status-specific character logic", () => {
    const integration = createCombatAbilityIntegration([
      { ownerUid: 1, ability: def("apply", { type: "ON_DEPLOY" }, { type: "SELF" }, [{ type: "APPLY_STATUS", status: "stun", duration: 2 }]) },
      { ownerUid: 1, ability: def("react", { type: "ON_STATUS_APPLIED", status: "STUN" }, { type: "SELF" }, [{ type: "SHIELD", amount: flat(10), duration: 2 }]) }
    ]);
    const result = integration.publish({ type: "UNIT_DEPLOYED", unitUid: 1, eventId: 1, origin: "SYSTEM" }, [unit(1, "hero")]);
    expect(result.units[0].abilityEffectState?.shields).toHaveLength(1);
  });

  it("applies deterministic status and knockback immunity policies", () => {
    const target = { ...unit(2, "enemy"), statusImmunities: ["STUN" as const], statusDurationMultiplier: { SLOW: 0.5 }, knockbackImmune: true };
    const caster = unit(1, "hero");
    const stunned = executeEffect({ type: "APPLY_STATUS", status: "stun", duration: 2 }, { caster, target, statusHandlers: {} });
    expect(stunned.abilityEffectState?.statuses ?? []).toHaveLength(0);
    const slowed = executeEffect({ type: "APPLY_STATUS", status: "slow", duration: 4, potency: flat(0.5) }, { caster, target, statusHandlers: {} });
    expect(slowed.abilityEffectState?.statuses[0].remaining).toBe(2);
    expect(executeEffect({ type: "KNOCKBACK", distance: flat(10) }, { caster, target, statusHandlers: {} }).knockbackTargetX).toBe(target.knockbackTargetX);
  });
});
