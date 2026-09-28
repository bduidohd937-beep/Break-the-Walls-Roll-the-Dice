import { meetsAbilityCondition } from "./conditions";
import { defaultEffectHandlers, executeEffect, legacyStatusHandlers, type EffectHandlerRegistry, type StatusHandlerRegistry } from "./effects";
import { selectAbilityTargets } from "./targeting";
import type {
  AbilityActivation,
  AbilityBattlefield,
  AbilityBinding,
  AbilityEvent,
  AbilityExecutionResult,
  AbilityUnit,
  TriggerDefinition
} from "./types";

type EventType = AbilityEvent["type"];
type IndexedBinding = AbilityBinding & { key: string };

function eventTypeForTrigger(trigger: TriggerDefinition): EventType {
  if (trigger.type === "ON_ATTACK_COUNT") return "ON_ATTACK";
  if (trigger.type === "ON_HIT_COUNT") return "ON_HIT";
  return trigger.type;
}

function triggerCount(trigger: TriggerDefinition): number | undefined {
  if (trigger.type === "ON_ATTACK_COUNT" || trigger.type === "ON_HIT_COUNT") return Math.max(1, trigger.count);
  return undefined;
}

export type AbilityRuntimeOptions = {
  effectHandlers?: EffectHandlerRegistry;
  statusHandlers?: StatusHandlerRegistry;
};

export type AbilityRuntime = {
  dispatch(event: AbilityEvent, battlefield: AbilityBattlefield): AbilityExecutionResult;
};

export function createAbilityRuntime(bindings: readonly AbilityBinding[], options: AbilityRuntimeOptions = {}): AbilityRuntime {
  const byEvent = new Map<EventType, IndexedBinding[]>();
  const counters = new Map<string, number>();
  const intervalElapsed = new Map<string, number>();
  const effectHandlers = options.effectHandlers ?? defaultEffectHandlers;
  const statusHandlers = options.statusHandlers ?? legacyStatusHandlers;

  bindings.forEach((binding, index) => {
    const indexed = { ...binding, key: `${binding.ownerUid}:${binding.ability.id}:${index}` };
    const eventType = eventTypeForTrigger(binding.ability.trigger);
    const bucket = byEvent.get(eventType) ?? [];
    bucket.push(indexed);
    byEvent.set(eventType, bucket);
  });

  return {
    dispatch(event, battlefield) {
      const units = new Map<number, AbilityUnit>(battlefield.units.map((unit) => [unit.uid, { ...unit }]));
      const activations: AbilityActivation[] = [];
      const candidates = byEvent.get(event.type) ?? [];

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
          if (caster.currentHp / Math.max(1, caster.hp) >= trigger.hpPercent) continue;
        } else if (trigger.type === "ON_INTERVAL") {
          if (event.type !== "ON_INTERVAL") continue;
          const elapsed = (intervalElapsed.get(binding.key) ?? 0) + event.elapsedSeconds;
          activationCount = Math.floor(elapsed / Math.max(0.001, trigger.intervalSeconds));
          intervalElapsed.set(binding.key, elapsed - activationCount * trigger.intervalSeconds);
          if (activationCount === 0) continue;
        }

        for (let activationIndex = 0; activationIndex < activationCount; activationIndex++) {
          caster = units.get(binding.ownerUid);
          if (!caster || caster.currentHp <= 0) break;
          const selectedTargets = selectAbilityTargets(binding.ability.target, caster, [...units.values()], event.currentTargetUid)
            .filter((target) => meetsAbilityCondition(binding.ability.condition, caster!, target));
          if (selectedTargets.length === 0) continue;

          for (const selectedTarget of selectedTargets) {
            for (const effect of binding.ability.effects) {
              const latestCaster = units.get(binding.ownerUid) ?? caster;
              const latestTarget = units.get(selectedTarget.uid);
              if (!latestTarget) continue;
              units.set(selectedTarget.uid, executeEffect(effect, {
                caster: latestCaster,
                target: latestTarget,
                statusHandlers
              }, effectHandlers));
            }
          }
          activations.push({
            abilityId: binding.ability.id,
            ownerUid: binding.ownerUid,
            targetUids: selectedTargets.map((target) => target.uid)
          });
        }
      }

      return { units: [...units.values()], activations };
    }
  };
}

