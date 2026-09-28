import { createAbilityRuntime, type AbilityRuntime } from "./runtime";
import type { CombatEvent, CombatEventResult } from "./combatEvents";
import type { AbilityBinding, AbilityDefinition, AbilityEvent, AbilityEventMeta, AbilityUnit, SummonFactory } from "./types";

const DEFAULT_MAX_CHAIN_DEPTH = 12;

export type CombatAbilityIntegration = {
  hasAbilities(): boolean;
  registerUnitAbilities(unitUid: number, abilities: readonly AbilityDefinition[]): void;
  publish(event: CombatEvent, units: readonly AbilityUnit[]): CombatEventResult;
  cleanup(activeUnitUids: ReadonlySet<number>): void;
  runtimeStateSize(): number;
};

function abilityMeta(event: CombatEvent): AbilityEventMeta {
  return {
    eventId: event.eventId,
    attackId: event.attackId,
    origin: event.origin,
    originAbilityId: event.originAbilityId,
    chainDepth: event.chainDepth ?? 0,
    actualDamage: event.type === "DAMAGE_APPLIED" ? event.actualDamage : undefined
  };
}

export function createCombatAbilityIntegration(
  bindings: readonly AbilityBinding[],
  options: { maxChainDepth?: number; runtime?: AbilityRuntime; summonFactory?: SummonFactory } = {}
): CombatAbilityIntegration {
  const runtime = options.runtime ?? createAbilityRuntime(bindings, { summonFactory: options.summonFactory });
  const processedEvents = new Set<number>();
  const deployedUnits = new Set<number>();
  const finalizedDeaths = new Set<number>();
  const lastDamageSource = new Map<number, number>();
  const maxChainDepth = options.maxChainDepth ?? DEFAULT_MAX_CHAIN_DEPTH;
  let generatedEventId = -1;
  const registeredOwnerUids = new Set(bindings.map((binding) => binding.ownerUid));

  function dispatchAbility(event: AbilityEvent, units: readonly AbilityUnit[], depth: number): CombatEventResult {
    if (depth > maxChainDepth) return { units, activationCount: 0, droppedByDepthLimit: true };
    const result = runtime.dispatch(event, { units });
    let nextUnits = result.units;
    let activationCount = result.activations.length;
    let droppedByDepthLimit = false;

    const previousUids = new Set(units.map((unit) => unit.uid));
    for (const summoned of nextUnits.filter((unit) => unit.summonMeta && !previousUids.has(unit.uid))) {
      const deployed = publishInternal({
        type: "UNIT_DEPLOYED",
        unitUid: summoned.uid,
        eventId: generatedEventId--,
        origin: "SYSTEM",
        originAbilityId: summoned.summonMeta?.sourceAbilityId,
        chainDepth: depth + 1
      }, nextUnits, depth + 1, false);
      nextUnits = deployed.units;
      activationCount += deployed.activationCount;
      droppedByDepthLimit ||= deployed.droppedByDepthLimit;
    }

    for (const application of result.applications) {
      if (application.hpDelta === 0) continue;
      const chainedMeta = {
        eventId: generatedEventId--,
        origin: "ABILITY" as const,
        originAbilityId: application.abilityId,
        chainDepth: depth + 1
      };
      const chainedEvent: CombatEvent = application.hpDelta < 0
        ? {
            type: "DAMAGE_APPLIED",
            sourceUid: application.ownerUid,
            targetUid: application.targetUid,
            actualDamage: -application.hpDelta,
            ...chainedMeta
          }
        : {
            type: "HP_CHANGED",
            unitUid: application.targetUid,
            sourceUid: application.ownerUid,
            previousHp: 0,
            currentHp: 0,
            ...chainedMeta
          };
      const chained = publishInternal(chainedEvent, nextUnits, depth + 1, false);
      nextUnits = chained.units;
      activationCount += chained.activationCount;
      droppedByDepthLimit ||= chained.droppedByDepthLimit;
    }
    return { units: nextUnits, activationCount, droppedByDepthLimit };
  }

  function publishInternal(event: CombatEvent, units: readonly AbilityUnit[], depth: number, deduplicate: boolean): CombatEventResult {
    if (depth > maxChainDepth) return { units, activationCount: 0, droppedByDepthLimit: true };
    if (deduplicate && processedEvents.has(event.eventId)) return { units, activationCount: 0, droppedByDepthLimit: false };
    if (deduplicate) processedEvents.add(event.eventId);

    const meta = abilityMeta(event);
    const apply = (abilityEvent: AbilityEvent, currentUnits: readonly AbilityUnit[]) => dispatchAbility(abilityEvent, currentUnits, depth);
    let result: CombatEventResult = { units, activationCount: 0, droppedByDepthLimit: false };
    const merge = (next: CombatEventResult) => {
      result = {
        units: next.units,
        activationCount: result.activationCount + next.activationCount,
        droppedByDepthLimit: result.droppedByDepthLimit || next.droppedByDepthLimit
      };
    };

    switch (event.type) {
      case "UNIT_DEPLOYED":
        if (deployedUnits.has(event.unitUid)) break;
        deployedUnits.add(event.unitUid);
        merge(apply({ type: "ON_DEPLOY", casterUid: event.unitUid, meta }, result.units));
        break;
      case "BASIC_ATTACK":
        merge(apply({ type: "ON_ATTACK", casterUid: event.attackerUid, currentTargetUid: event.targetUid, meta }, result.units));
        break;
      case "DAMAGE_APPLIED":
        if (event.sourceUid !== undefined) {
          lastDamageSource.set(event.targetUid, event.sourceUid);
          merge(apply({ type: "ON_HIT_DEALT", casterUid: event.sourceUid, currentTargetUid: event.targetUid, meta }, result.units));
          merge(apply({ type: "ON_HIT_RECEIVED", casterUid: event.targetUid, currentTargetUid: event.sourceUid, meta }, result.units));
        }
        merge(apply({ type: "ON_HP_BELOW", casterUid: event.targetUid, currentTargetUid: event.sourceUid, meta }, result.units));
        break;
      case "HP_CHANGED":
        merge(apply({ type: "ON_HP_BELOW", casterUid: event.unitUid, currentTargetUid: event.sourceUid, meta }, result.units));
        break;
      case "UNIT_DEATH": {
        if (finalizedDeaths.has(event.unitUid)) break;
        finalizedDeaths.add(event.unitUid);
        const killerUid = event.killerUid ?? lastDamageSource.get(event.unitUid);
        if (killerUid !== undefined) merge(apply({ type: "ON_KILL", casterUid: killerUid, currentTargetUid: event.unitUid, meta }, result.units));
        merge(apply({ type: "ON_DEATH", casterUid: event.unitUid, currentTargetUid: killerUid, meta }, result.units));
        lastDamageSource.delete(event.unitUid);
        break;
      }
      case "SIMULATION_TICK":
        merge(apply({ type: "ON_INTERVAL", elapsedSeconds: event.deltaSeconds, meta }, result.units));
        break;
      case "CASTLE_ATTACK":
        break;
    }
    return result;
  }

  return {
    hasAbilities() {
      return runtime.hasWork();
    },
    registerUnitAbilities(unitUid, abilities) {
      for (const ability of abilities) runtime.register({ ownerUid: unitUid, ability });
      if (abilities.length > 0) registeredOwnerUids.add(unitUid);
    },
    publish(event, units) {
      if (registeredOwnerUids.size === 0) return { units, activationCount: 0, droppedByDepthLimit: false };
      return publishInternal(event, units, event.chainDepth ?? 0, true);
    },
    cleanup(activeUnitUids) {
      runtime.cleanup(activeUnitUids);
      for (const uid of registeredOwnerUids) if (!activeUnitUids.has(uid)) registeredOwnerUids.delete(uid);
      for (const uid of finalizedDeaths) if (!activeUnitUids.has(uid)) finalizedDeaths.delete(uid);
      for (const uid of deployedUnits) if (!activeUnitUids.has(uid)) deployedUnits.delete(uid);
      for (const uid of lastDamageSource.keys()) if (!activeUnitUids.has(uid)) lastDamageSource.delete(uid);
      if (processedEvents.size > 4096) processedEvents.clear();
    },
    runtimeStateSize() {
      return runtime.stateSize();
    }
  };
}
