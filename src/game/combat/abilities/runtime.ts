import { meetsAbilityCondition } from "./conditions";
import { applyPeriodicEffects, defaultEffectHandlers, executeEffect, legacyStatusHandlers, type EffectHandlerRegistry, type StatusHandlerRegistry } from "./effects";
import { selectAbilityTargets } from "./targeting";
import { calculateScaling } from "./scaling";
import type {
  AbilityActivation,
  AbilityBattlefield,
  AbilityBinding,
  AbilityEffectApplication,
  AbilityEvent,
  AbilityExecutionResult,
  AbilityResourceChange,
  AbilityUnit,
  SummonFactory,
  TriggerDefinition
} from "./types";

type EventType = AbilityEvent["type"];
type IndexedBinding = AbilityBinding & { key: string };

function eventTypeForTrigger(trigger: TriggerDefinition): EventType {
  if (trigger.type === "ON_ATTACK_COUNT") return "ON_ATTACK";
  if (trigger.type === "ON_HIT_RECEIVED_COUNT") return "ON_HIT_RECEIVED";
  return trigger.type;
}

function triggerCount(trigger: TriggerDefinition): number | undefined {
  if (trigger.type === "ON_ATTACK_COUNT" || trigger.type === "ON_HIT_RECEIVED_COUNT") return Math.max(1, trigger.count);
  return undefined;
}

export type AbilityRuntimeOptions = {
  effectHandlers?: EffectHandlerRegistry;
  statusHandlers?: StatusHandlerRegistry;
  summonFactory?: SummonFactory;
};

export type AbilityRuntime = {
  dispatch(event: AbilityEvent, battlefield: AbilityBattlefield): AbilityExecutionResult;
  register(binding: AbilityBinding): void;
  cleanup(activeUnitUids: ReadonlySet<number>): void;
  stateSize(): number;
  hasWork(): boolean;
};

export function createAbilityRuntime(bindings: readonly AbilityBinding[], options: AbilityRuntimeOptions = {}): AbilityRuntime {
  const byEvent = new Map<EventType, IndexedBinding[]>();
  const counters = new Map<string, number>();
  const intervalElapsed = new Map<string, number>();
  const hpThresholdBelow = new Map<string, boolean>();
  const registeredBindings: IndexedBinding[] = [];
  const temporaryEffectUids = new Set<number>();
  let registrationIndex = 0;
  const effectHandlers = options.effectHandlers ?? defaultEffectHandlers;
  const statusHandlers = options.statusHandlers ?? legacyStatusHandlers;
  const summonFactory = options.summonFactory;
  const summonedRemaining = new Map<number, number | undefined>();
  let nextSummonUid = 1_000_000;

  const register = (binding: AbilityBinding) => {
    const indexed = { ...binding, key: `${binding.ownerUid}:${binding.ability.id}:${registrationIndex++}` };
    registeredBindings.push(indexed);
    const eventType = eventTypeForTrigger(binding.ability.trigger);
    const bucket = byEvent.get(eventType) ?? [];
    bucket.push(indexed);
    byEvent.set(eventType, bucket);
  };
  bindings.forEach(register);

  return {
    register,
    dispatch(event, battlefield) {
      const candidates = byEvent.get(event.type) ?? [];
      const shouldAdvanceEffects = event.type === "ON_INTERVAL" && temporaryEffectUids.size > 0;
      if (candidates.length === 0 && !shouldAdvanceEffects) return { units: battlefield.units, activations: [], applications: [], resourceChanges: [] };
      const applications: AbilityEffectApplication[] = [];
      const resourceChanges: AbilityResourceChange[] = [];
      const units = new Map<number, AbilityUnit>(battlefield.units.filter((unit) => {
        if (!shouldAdvanceEffects || !unit.summonMeta || !summonedRemaining.has(unit.uid)) return true;
        const remaining = summonedRemaining.get(unit.uid);
        if (remaining === undefined) return true;
        const nextRemaining = remaining - event.elapsedSeconds;
        if (nextRemaining <= 0) { summonedRemaining.delete(unit.uid); temporaryEffectUids.delete(unit.uid); return false; }
        summonedRemaining.set(unit.uid, nextRemaining);
        return true;
      }).map((unit) => {
        let next = { ...unit };
        if (shouldAdvanceEffects && temporaryEffectUids.has(unit.uid)) {
          const ticked = applyPeriodicEffects(unit, event.elapsedSeconds);
          next = ticked.unit;
          for (const application of ticked.applications) applications.push({
            abilityId: application.abilityId ?? `periodic:${application.effectType}`,
            ownerUid: application.ownerUid,
            targetUid: unit.uid,
            effectType: application.effectType,
            hpDelta: application.hpDelta
          });
        }
        if (shouldAdvanceEffects && !next.abilityEffectState && !next.summonMeta) temporaryEffectUids.delete(unit.uid);
        return [unit.uid, next];
      }));
      const activations: AbilityActivation[] = [];

      for (const binding of candidates) {
        if (event.casterUid !== undefined && binding.ownerUid !== event.casterUid) continue;
        if (event.type === "ON_STATUS_APPLIED" && binding.ability.trigger.type === "ON_STATUS_APPLIED" && binding.ability.trigger.status && binding.ability.trigger.status !== event.status) continue;
        if (event.type === "ON_STATUS_REMOVED" && binding.ability.trigger.type === "ON_STATUS_REMOVED" && ((binding.ability.trigger.status && binding.ability.trigger.status !== event.status) || (binding.ability.trigger.reason && binding.ability.trigger.reason !== event.reason))) continue;
        let caster = units.get(binding.ownerUid);
        if (!caster) continue;
        const trigger = binding.ability.trigger;
        let activationCount = 1;

        const requiredCount = triggerCount(trigger);
        if (requiredCount !== undefined) {
          const nextCount = (counters.get(binding.key) ?? 0) + 1;
          if (nextCount < requiredCount) {
            counters.set(binding.key, nextCount);
            continue;
          }
          counters.set(binding.key, 0);
        } else if (trigger.type === "ON_HP_BELOW") {
          const below = caster.currentHp / Math.max(1, caster.hp) <= trigger.hpPercent;
          const wasBelow = hpThresholdBelow.get(binding.key) ?? false;
          hpThresholdBelow.set(binding.key, below);
          if (!below || wasBelow) continue;
        } else if (trigger.type === "ON_INTERVAL") {
          if (event.type !== "ON_INTERVAL") continue;
          const cooldownMultiplier = caster.abilityEffectState?.cooldownModifiers.reduce((product, modifier) => product * modifier.multiplier, 1) ?? 1;
          const elapsed = (intervalElapsed.get(binding.key) ?? 0) + event.elapsedSeconds / Math.max(0.05, cooldownMultiplier);
          activationCount = Math.floor(elapsed / Math.max(0.001, trigger.intervalSeconds));
          intervalElapsed.set(binding.key, elapsed - activationCount * trigger.intervalSeconds);
          if (activationCount === 0) continue;
        }

        for (let activationIndex = 0; activationIndex < activationCount; activationIndex++) {
          caster = units.get(binding.ownerUid);
          if (!caster || (caster.currentHp <= 0 && trigger.type !== "ON_DEATH")) break;
          const selectedTargets = selectAbilityTargets(binding.ability.target, caster, [...units.values()], event.currentTargetUid)
            .filter((target) => meetsAbilityCondition(binding.ability.condition, caster!, target, event.eventUnitUid ? units.get(event.eventUnitUid) : undefined));
          if (selectedTargets.length === 0) continue;

          for (const selectedTarget of selectedTargets) {
            for (const effect of binding.ability.effects) {
              const latestCaster = units.get(binding.ownerUid) ?? caster;
              const latestTarget = units.get(selectedTarget.uid);
              if (!latestTarget) continue;
              if (effect.type === "SUMMON") {
                const created = summonFactory?.({
                  summonUnitId: effect.summonUnitId,
                  count: Math.max(0, Math.floor(effect.count)),
                  duration: effect.duration,
                  ownerUid: binding.ownerUid,
                  sourceAbilityId: binding.ability.id,
                  team: latestCaster.team,
                  x: latestCaster.x,
                  uidStart: nextSummonUid
                }) ?? [];
                nextSummonUid += created.length;
                for (const summoned of created) {
                  units.set(summoned.uid, summoned);
                  summonedRemaining.set(summoned.uid, summoned.summonMeta?.remaining);
                  temporaryEffectUids.add(summoned.uid);
                }
                continue;
              }
              if (effect.type === "RESOURCE_CHANGE") {
                resourceChanges.push({ resource: effect.resource, amount: calculateScaling(effect.amount, latestCaster, latestTarget), ownerUid: binding.ownerUid, abilityId: binding.ability.id });
                continue;
              }
              const nextTarget = executeEffect(effect, {
                caster: latestCaster,
                target: latestTarget,
                statusHandlers,
                sourceAbilityId: binding.ability.id
              }, effectHandlers);
              units.set(selectedTarget.uid, nextTarget);
              if (nextTarget.abilityEffectState) temporaryEffectUids.add(selectedTarget.uid);
              applications.push({
                abilityId: binding.ability.id,
                ownerUid: binding.ownerUid,
                targetUid: selectedTarget.uid,
                effectType: effect.type,
                hpDelta: nextTarget.currentHp - latestTarget.currentHp,
                ...(effect.type === "APPLY_STATUS" && (effect.status === "stun" || effect.status === "slow") ? {
                  status: effect.status === "stun" ? "STUN" as const : "SLOW" as const,
                  duration: nextTarget.abilityEffectState?.statuses.find((entry) => entry.sourceAbilityId === binding.ability.id)?.remaining,
                  potency: nextTarget.abilityEffectState?.statuses.find((entry) => entry.sourceAbilityId === binding.ability.id)?.potency
                } : {})
              });
            }
          }
          activations.push({
            abilityId: binding.ability.id,
            ownerUid: binding.ownerUid,
            targetUids: selectedTargets.map((target) => target.uid),
            eventMeta: event.meta
          });
        }
      }

      return { units: [...units.values()], activations, applications, resourceChanges };
    },
    cleanup(activeUnitUids) {
      for (const binding of registeredBindings) {
        if (activeUnitUids.has(binding.ownerUid)) continue;
        const prefix = `${binding.ownerUid}:`;
        for (const key of counters.keys()) if (key.startsWith(prefix)) counters.delete(key);
        for (const key of intervalElapsed.keys()) if (key.startsWith(prefix)) intervalElapsed.delete(key);
        for (const key of hpThresholdBelow.keys()) if (key.startsWith(prefix)) hpThresholdBelow.delete(key);
      }
      for (const [eventType, bucket] of byEvent) {
        byEvent.set(eventType, bucket.filter((binding) => activeUnitUids.has(binding.ownerUid)));
      }
      for (let index = registeredBindings.length - 1; index >= 0; index--) {
        if (!activeUnitUids.has(registeredBindings[index].ownerUid)) registeredBindings.splice(index, 1);
      }
      for (const uid of temporaryEffectUids) if (!activeUnitUids.has(uid)) temporaryEffectUids.delete(uid);
      for (const uid of summonedRemaining.keys()) if (!activeUnitUids.has(uid)) summonedRemaining.delete(uid);
    },
    stateSize() {
      return counters.size + intervalElapsed.size + hpThresholdBelow.size + temporaryEffectUids.size;
    },
    hasWork() {
      return registeredBindings.length > 0 || temporaryEffectUids.size > 0;
    }
  };
}
