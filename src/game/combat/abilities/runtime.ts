import { meetsAbilityCondition } from "./conditions";
import { defaultEffectHandlers, executeEffect, legacyStatusHandlers, type EffectHandlerRegistry, type StatusHandlerRegistry } from "./effects";
import { selectAbilityTargets } from "./targeting";
import type {
  AbilityActivation,
  AbilityBattlefield,
  AbilityBinding,
  AbilityEffectApplication,
  AbilityEvent,
  AbilityExecutionResult,
  AbilityUnit,
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
};

export type AbilityRuntime = {
  dispatch(event: AbilityEvent, battlefield: AbilityBattlefield): AbilityExecutionResult;
  register(binding: AbilityBinding): void;
  cleanup(activeUnitUids: ReadonlySet<number>): void;
  stateSize(): number;
};

export function createAbilityRuntime(bindings: readonly AbilityBinding[], options: AbilityRuntimeOptions = {}): AbilityRuntime {
  const byEvent = new Map<EventType, IndexedBinding[]>();
  const counters = new Map<string, number>();
  const intervalElapsed = new Map<string, number>();
  const hpThresholdBelow = new Map<string, boolean>();
  const registeredBindings: IndexedBinding[] = [];
  let registrationIndex = 0;
  const effectHandlers = options.effectHandlers ?? defaultEffectHandlers;
  const statusHandlers = options.statusHandlers ?? legacyStatusHandlers;

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
      if (candidates.length === 0) return { units: battlefield.units, activations: [], applications: [] };
      const units = new Map<number, AbilityUnit>(battlefield.units.map((unit) => [unit.uid, { ...unit }]));
      const activations: AbilityActivation[] = [];
      const applications: AbilityEffectApplication[] = [];

      for (const binding of candidates) {
        if (event.casterUid !== undefined && binding.ownerUid !== event.casterUid) continue;
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
          const elapsed = (intervalElapsed.get(binding.key) ?? 0) + event.elapsedSeconds;
          activationCount = Math.floor(elapsed / Math.max(0.001, trigger.intervalSeconds));
          intervalElapsed.set(binding.key, elapsed - activationCount * trigger.intervalSeconds);
          if (activationCount === 0) continue;
        }

        for (let activationIndex = 0; activationIndex < activationCount; activationIndex++) {
          caster = units.get(binding.ownerUid);
          if (!caster || (caster.currentHp <= 0 && trigger.type !== "ON_DEATH")) break;
          const selectedTargets = selectAbilityTargets(binding.ability.target, caster, [...units.values()], event.currentTargetUid)
            .filter((target) => meetsAbilityCondition(binding.ability.condition, caster!, target));
          if (selectedTargets.length === 0) continue;

          for (const selectedTarget of selectedTargets) {
            for (const effect of binding.ability.effects) {
              const latestCaster = units.get(binding.ownerUid) ?? caster;
              const latestTarget = units.get(selectedTarget.uid);
              if (!latestTarget) continue;
              const nextTarget = executeEffect(effect, {
                caster: latestCaster,
                target: latestTarget,
                statusHandlers
              }, effectHandlers);
              units.set(selectedTarget.uid, nextTarget);
              applications.push({
                abilityId: binding.ability.id,
                ownerUid: binding.ownerUid,
                targetUid: selectedTarget.uid,
                effectType: effect.type,
                hpDelta: nextTarget.currentHp - latestTarget.currentHp
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

      return { units: [...units.values()], activations, applications };
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
    },
    stateSize() {
      return counters.size + intervalElapsed.size + hpThresholdBelow.size;
    }
  };
}
