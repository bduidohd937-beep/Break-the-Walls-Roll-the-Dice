import { meetsAbilityCondition } from "./conditions";
import { applyPeriodicEffects, defaultEffectHandlers, executeEffect, hasActiveCast, isBlockedFromCast, legacyStatusHandlers, type EffectHandlerRegistry, type StatusHandlerRegistry } from "./effects";
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
  ActiveCastState,
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

function advanceActiveCast(unit: AbilityUnit, elapsedSeconds: number): AbilityUnit {
  const cast = unit.abilityActiveCast;
  if (!cast || elapsedSeconds <= 0) return unit;
  if (cast.phase === "recovery") {
    const remaining = (cast.recoveryRemaining ?? 0) - elapsedSeconds;
    return remaining > 0
      ? { ...unit, abilityActiveCast: { ...cast, recoveryRemaining: remaining } }
      : { ...unit, abilityActiveCast: undefined };
  }
  const remaining = cast.windupRemaining - elapsedSeconds;
  if (remaining > 0) return { ...unit, abilityActiveCast: { ...cast, windupRemaining: remaining } };
  if (cast.phase === "windup" && (cast.castSeconds ?? 0) > -remaining) {
    return { ...unit, abilityActiveCast: { ...cast, phase: "cast", windupRemaining: (cast.castSeconds ?? 0) + remaining } };
  }
  return { ...unit, abilityActiveCast: { ...cast, phase: "cast", windupRemaining: 0 } };
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
      const shouldAdvanceCasts = event.type === "ON_INTERVAL" && battlefield.units.some((unit) => hasActiveCast(unit));
      const shouldHandleCastInterruption = (event.type === "ON_STATUS_APPLIED" && event.status === "STUN" && battlefield.units.some((unit) => unit.uid === event.currentTargetUid && hasActiveCast(unit)))
        || (event.type === "ON_DEATH" && battlefield.units.some((unit) => unit.uid === event.eventUnitUid && hasActiveCast(unit)));
      if (candidates.length === 0 && !shouldAdvanceEffects && !shouldAdvanceCasts && !shouldHandleCastInterruption) return { units: battlefield.units, activations: [], applications: [], resourceChanges: [] };

      const applications: AbilityEffectApplication[] = [];
      const resourceChanges: AbilityResourceChange[] = [];
      const blockedAtTickStart = new Set(battlefield.units.filter((unit) => hasActiveCast(unit)).map((unit) => unit.uid));
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
        if (event.type === "ON_DEATH" && event.eventUnitUid === unit.uid) {
          next = { ...next, abilityActiveCast: undefined };
        } else if (event.type === "ON_STATUS_APPLIED" && event.status === "STUN" && event.currentTargetUid === unit.uid && unit.abilityActiveCast?.phase !== "recovery") {
          next = { ...next, abilityActiveCast: undefined };
        } else if (shouldAdvanceCasts) {
          next = advanceActiveCast(next, event.elapsedSeconds);
        }
        if (shouldAdvanceEffects && temporaryEffectUids.has(unit.uid)) {
          const ticked = applyPeriodicEffects(next, event.elapsedSeconds);
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

        const castDef = binding.ability.cast;
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
          const interval = Math.max(0.001, trigger.intervalSeconds);
          activationCount = Math.floor((elapsed + 1e-9) / interval);
          intervalElapsed.set(binding.key, Math.max(0, elapsed - activationCount * interval));
          if (activationCount === 0) continue;

          // V1-B: windup-ability interval firing is gated by cast blocking; blocked opportunities
          // are consumed/lost (no queue) for windup-declared abilities.
          if (castDef && activationCount > 0 && (blockedAtTickStart.has(caster.uid) || isBlockedFromCast(caster))) {
            activationCount = 0;
          }
        }

        for (let activationIndex = 0; activationIndex < activationCount; activationIndex++) {
          caster = units.get(binding.ownerUid);
          if (!caster) continue;
          if (caster.currentHp <= 0 && trigger.type !== "ON_DEATH") break;

          // V1-B: for windup-declared abilities, discard the opportunity (no queue) when blocked.
          if (castDef && (blockedAtTickStart.has(caster.uid) || isBlockedFromCast(caster))) continue;

          const selectedTargets = selectAbilityTargets(binding.ability.target, caster, [...units.values()], event.currentTargetUid)
            .filter((target) => meetsAbilityCondition(binding.ability.condition, caster!, target, event.eventUnitUid ? units.get(event.eventUnitUid) : undefined));
          if (selectedTargets.length === 0) continue;

          for (const selectedTarget of selectedTargets) {
            for (const effect of binding.ability.effects) {
              const latestCaster = units.get(binding.ownerUid) ?? caster;
              const latestTarget = units.get(selectedTarget.uid);
              if (!latestTarget) continue;
              if (castDef) continue;
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

          // V1-B: start windup for windup-declared abilities that were not blocked.
          if (castDef && selectedTargets.length > 0 && !blockedAtTickStart.has(caster.uid) && !isBlockedFromCast(caster)) {
            const castOwner = caster;
            const farthestTarget = selectedTargets.reduce((farthest, target) => Math.abs(target.x - castOwner.x) > Math.abs(farthest.x - castOwner.x) ? target : farthest, selectedTargets[0]);
            const castState: ActiveCastState = {
              abilityId: binding.ability.id,
              casterUid: caster.uid,
              targetUid: selectedTargets[0].uid,
              targetX: farthestTarget.x,
              lockedAtX: caster.x,
              windupRemaining: binding.ability.cast!.windupSeconds,
              castSeconds: binding.ability.cast?.castSeconds,
              recoveryRemaining: binding.ability.cast?.recoverySeconds,
              resolved: false,
              missed: false,
              phase: "windup",
            };
            const started: AbilityUnit = { ...caster, abilityActiveCast: castState };
            if (binding.ability.visual && selectedTargets.length > 0) {
              units.set(caster.uid, {
                ...started,
                abilityAnimationState: binding.ability.visual.animation,
                abilityAnimationTimer: binding.ability.cast?.windupSeconds ?? binding.ability.visual.durationSeconds,
                abilityAnimationDuration: binding.ability.cast?.windupSeconds ?? binding.ability.visual.durationSeconds,
                abilityAnimationSequence: (caster.abilityAnimationSequence ?? 0) + 1,
                attackTargetX: farthestTarget.x,
              });
            } else {
              units.set(caster.uid, started);
            }
            activations.push({
              abilityId: binding.ability.id,
              ownerUid: binding.ownerUid,
              targetUids: selectedTargets.map((target) => target.uid),
              eventMeta: event.meta
            });
            continue;
          }

          if (!castDef && binding.ability.visual && selectedTargets.length > 0) {
            const owner = units.get(binding.ownerUid);
            if (owner) {
              const farthestTarget = selectedTargets.reduce((farthest, target) => Math.abs(target.x - owner.x) > Math.abs(farthest.x - owner.x) ? target : farthest, selectedTargets[0]);
              units.set(binding.ownerUid, {
                ...owner,
                abilityAnimationState: binding.ability.visual.animation,
                abilityAnimationTimer: binding.ability.visual.durationSeconds,
                abilityAnimationDuration: binding.ability.visual.durationSeconds,
                abilityAnimationSequence: (owner.abilityAnimationSequence ?? 0) + 1,
                attackTargetX: farthestTarget.x
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

      // Resolve a completed cast exactly once, then keep the owner blocked through recovery.
      for (const [uid, unit] of units) {
        const activeCast = unit.abilityActiveCast;
        if (!activeCast || activeCast.phase !== "cast" || activeCast.resolved || activeCast.windupRemaining > 0) continue;
        const binding = registeredBindings.find((b) => b.ownerUid === uid && b.ability.id === activeCast.abilityId);
        if (!binding) {
          units.set(uid, { ...unit, abilityActiveCast: undefined });
          continue;
        }

        const caster = unit;
        const selectedTarget = units.get(activeCast.targetUid ?? uid);
        const missed = !selectedTarget || !selectedTarget.alive || selectedTarget.currentHp <= 0;
        if (selectedTarget && !missed) {
          for (const effect of binding.ability.effects) {
            if (effect.type === "RESOURCE_CHANGE") {
              resourceChanges.push({ resource: effect.resource, amount: calculateScaling(effect.amount, caster, selectedTarget), ownerUid: uid, abilityId: binding.ability.id });
              continue;
            }
            if (effect.type === "SUMMON") {
              const created = summonFactory?.({
                summonUnitId: effect.summonUnitId,
                count: Math.max(0, Math.floor(effect.count)),
                duration: effect.duration,
                ownerUid: uid,
                sourceAbilityId: binding.ability.id,
                team: caster.team,
                x: caster.x,
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
            const currentTarget = units.get(selectedTarget.uid) ?? selectedTarget;
            const nextTarget = executeEffect(effect, { caster, target: currentTarget, statusHandlers, sourceAbilityId: binding.ability.id }, effectHandlers);
            units.set(selectedTarget.uid, nextTarget);
            if (nextTarget.abilityEffectState) temporaryEffectUids.add(selectedTarget.uid);
            applications.push({
              abilityId: binding.ability.id,
              ownerUid: uid,
              targetUid: selectedTarget.uid,
              effectType: effect.type,
              hpDelta: nextTarget.currentHp - currentTarget.currentHp,
              ...(effect.type === "APPLY_STATUS" && (effect.status === "stun" || effect.status === "slow") ? {
                status: effect.status === "stun" ? "STUN" as const : "SLOW" as const,
                duration: nextTarget.abilityEffectState?.statuses.find((entry) => entry.sourceAbilityId === binding.ability.id)?.remaining,
                potency: nextTarget.abilityEffectState?.statuses.find((entry) => entry.sourceAbilityId === binding.ability.id)?.potency
              } : {})
            });
          }
        }
        const recoveryRemaining = Math.max(0, binding.ability.cast?.recoverySeconds ?? 0);
        const nextCast: ActiveCastState = { ...activeCast, resolved: true, phase: "recovery", recoveryRemaining, missed };
        const resolvedOwner = units.get(uid) ?? unit;
        const after: AbilityUnit = recoveryRemaining > 0 ? { ...resolvedOwner, abilityActiveCast: nextCast } : { ...resolvedOwner, abilityActiveCast: undefined };

        if (binding.ability.visual) {
          units.set(uid, {
            ...after,
            abilityAnimationState: binding.ability.visual.animation,
            abilityAnimationTimer: binding.ability.cast?.recoverySeconds ?? binding.ability.visual.durationSeconds,
            abilityAnimationDuration: binding.ability.cast?.recoverySeconds ?? binding.ability.visual.durationSeconds,
            abilityAnimationSequence: (resolvedOwner.abilityAnimationSequence ?? 0) + 1,
            attackTargetX: activeCast.targetX,
          });
        } else if (recoveryRemaining > 0) {
          units.set(uid, after);
        } else {
          units.set(uid, { ...after, abilityActiveCast: undefined });
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
