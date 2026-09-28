import { applyAbilityKnockback } from "../knockback";
import { calculateScaling } from "./scaling";
import type { AbilityEffectState, AbilityStatusId, AbilityUnit, EffectDefinition, ModifiableStat, StatusId } from "./types";

const emptyEffectState = (): AbilityEffectState => ({ shields: [], statModifiers: [], damageTakenModifiers: [], statuses: [], periodicEffects: [] });

export function hasAbilityStatus(unit: AbilityUnit, status: AbilityStatusId): boolean {
  return Boolean(unit.abilityEffectState?.statuses.some((entry) => entry.id === status && entry.remaining > 0));
}

export function effectiveMoveSpeed(unit: AbilityUnit): number {
  const slows = unit.abilityEffectState?.statuses.filter((entry) => entry.id === "SLOW" && entry.remaining > 0) ?? [];
  const multiplier = slows.length === 0 ? 1 : Math.min(...slows.map((entry) => entry.potency));
  return unit.speed * Math.max(0, multiplier);
}

function effectiveStat(unit: AbilityUnit, stat: ModifiableStat, state: AbilityEffectState): number {
  const base = state.baseStats ?? { atk: unit.atk, def: unit.def ?? 0, attackInterval: unit.attackInterval, speed: unit.speed };
  const modifiers = state.statModifiers.filter((modifier) => modifier.stat === stat);
  const flat = modifiers.filter((modifier) => modifier.mode === "FLAT").reduce((sum, modifier) => sum + modifier.value, 0);
  const percent = modifiers.filter((modifier) => modifier.mode === "PERCENT").reduce((product, modifier) => product * (1 + modifier.value), 1);
  if (stat === "ASPD") return 1 / Math.max(0.05, (1 / base.attackInterval + flat) * percent);
  const value = stat === "ATK" ? base.atk : stat === "DEF" ? base.def : base.speed;
  return Math.max(0, (value + flat) * percent);
}

function applyEffectiveStats(unit: AbilityUnit, state: AbilityEffectState): AbilityUnit {
  return {
    ...unit,
    atk: effectiveStat(unit, "ATK", state),
    def: effectiveStat(unit, "DEF", state),
    attackInterval: effectiveStat(unit, "ASPD", state),
    speed: effectiveStat(unit, "MOVE", state),
    abilityEffectState: state
  };
}

function compactEffectState(unit: AbilityUnit, state: AbilityEffectState): AbilityUnit {
  const hasEffects = state.shields.length + state.statModifiers.length + state.damageTakenModifiers.length + state.statuses.length + state.periodicEffects.length > 0;
  if (hasEffects) return applyEffectiveStats(unit, state);
  return {
    ...unit,
    atk: state.baseStats?.atk ?? unit.atk,
    def: state.baseStats?.def ?? unit.def,
    attackInterval: state.baseStats?.attackInterval ?? unit.attackInterval,
    speed: state.baseStats?.speed ?? unit.speed,
    abilityEffectState: undefined
  };
}

function removeCleanseEffects(unit: AbilityUnit, count: number): AbilityUnit {
  const state = unit.abilityEffectState;
  if (!state || count <= 0) return unit;
  let remaining = Math.floor(count);
  const remove = <T extends { removable?: boolean }>(entries: readonly T[]): T[] => entries.filter((entry) => {
    if (remaining <= 0 || entry.removable === false) return true;
    remaining -= 1;
    return false;
  });
  const harmfulStatuses = state.statuses.filter((entry) => entry.id === "STUN" || entry.id === "SLOW");
  const keptStatuses = remove(harmfulStatuses);
  const removedStatus = harmfulStatuses.length - keptStatuses.length;
  remaining = Math.max(0, Math.floor(count) - removedStatus);
  const statuses = [...state.statuses.filter((entry) => entry.id !== "STUN" && entry.id !== "SLOW"), ...keptStatuses];
  const harmfulPeriodic = state.periodicEffects.filter((entry) => entry.id === "DOT");
  const keptPeriodic = remove(harmfulPeriodic);
  const periodicEffects = [...state.periodicEffects.filter((entry) => entry.id !== "DOT"), ...keptPeriodic];
  return compactEffectState(unit, { ...state, statuses, periodicEffects });
}

function removeDispelEffects(unit: AbilityUnit, count: number): AbilityUnit {
  const state = unit.abilityEffectState;
  if (!state || count <= 0) return unit;
  let remaining = Math.floor(count);
  const remove = <T extends { removable?: boolean }>(entries: readonly T[]): T[] => entries.filter((entry) => {
    if (remaining <= 0 || entry.removable === false) return true;
    remaining -= 1;
    return false;
  });
  const statModifiers = remove(state.statModifiers);
  const removedModifiers = state.statModifiers.length - statModifiers.length;
  remaining = Math.max(0, Math.floor(count) - removedModifiers);
  const shields = remove(state.shields);
  const removedShields = state.shields.length - shields.length;
  remaining = Math.max(0, remaining - removedShields);
  const damageTakenModifiers = remove(state.damageTakenModifiers);
  return compactEffectState(unit, { ...state, statModifiers, shields, damageTakenModifiers });
}

export function resolveAbilityDamage(target: AbilityUnit, rawDamage: number): { unit: AbilityUnit; hpDamage: number } {
  const state = target.abilityEffectState ?? emptyEffectState();
  const multiplier = state.damageTakenModifiers.reduce((product, modifier) => product * modifier.multiplier, 1);
  let remainingDamage = Math.max(0, rawDamage * multiplier);
  const shields = state.shields.map((shield) => ({ ...shield }));
  for (const shield of shields) {
    const absorbed = Math.min(shield.amount, remainingDamage);
    shield.amount -= absorbed;
    remainingDamage -= absorbed;
    if (remainingDamage <= 0) break;
  }
  return {
    unit: { ...target, abilityEffectState: { ...state, shields: shields.filter((shield) => shield.amount > 0) } },
    hpDamage: remainingDamage
  };
}

export function advanceAbilityEffectDurations(unit: AbilityUnit, dt: number): AbilityUnit {
  const state = unit.abilityEffectState;
  if (!state) return unit;
  const nextState: AbilityEffectState = {
    ...state,
    shields: state.shields.map((entry) => ({ ...entry, remaining: entry.remaining - dt })).filter((entry) => entry.remaining > 0),
    statModifiers: state.statModifiers.map((entry) => ({ ...entry, remaining: entry.remaining - dt })).filter((entry) => entry.remaining > 0),
    damageTakenModifiers: state.damageTakenModifiers.map((entry) => ({ ...entry, remaining: entry.remaining - dt })).filter((entry) => entry.remaining > 0)
    ,statuses: state.statuses.map((entry) => ({ ...entry, remaining: entry.remaining - dt })).filter((entry) => entry.remaining > 0),
    periodicEffects: state.periodicEffects.map((entry) => ({ ...entry, remaining: entry.remaining - dt })).filter((entry) => entry.remaining > 0)
  };
  const active = nextState.shields.length + nextState.statModifiers.length + nextState.damageTakenModifiers.length + nextState.statuses.length + nextState.periodicEffects.length > 0;
  const restored = applyEffectiveStats(unit, nextState);
  return active ? restored : {
    ...restored,
    atk: nextState.baseStats?.atk ?? restored.atk,
    def: nextState.baseStats?.def ?? restored.def,
    attackInterval: nextState.baseStats?.attackInterval ?? restored.attackInterval,
    speed: nextState.baseStats?.speed ?? restored.speed,
    abilityEffectState: undefined
  };
}

export function applyPeriodicEffects(unit: AbilityUnit, dt: number): { unit: AbilityUnit; applications: Array<{ ownerUid: number; abilityId?: string; effectType: "DOT" | "HOT"; hpDelta: number }> } {
  const state = unit.abilityEffectState;
  if (!state || state.periodicEffects.length === 0) return { unit: advanceAbilityEffectDurations(unit, dt), applications: [] };
  const original = state.periodicEffects;
  let next = advanceAbilityEffectDurations(unit, dt);
  const applications: Array<{ ownerUid: number; abilityId?: string; effectType: "DOT" | "HOT"; hpDelta: number }> = [];
  for (const effect of original) {
    const activeDelta = Math.min(dt, effect.remaining);
    const ticks = Math.floor((effect.elapsed + activeDelta) / effect.interval) - Math.floor(effect.elapsed / effect.interval);
    for (let index = 0; index < ticks; index++) {
      if (next.currentHp <= 0) continue;
      const before = next.currentHp;
      if (effect.id === "DOT") {
        const resolved = resolveAbilityDamage(next, effect.amount);
        next = { ...resolved.unit, currentHp: Math.max(0, next.currentHp - resolved.hpDamage) };
      } else {
        next = { ...next, currentHp: Math.min(next.hp, next.currentHp + effect.amount) };
      }
      applications.push({ ownerUid: effect.sourceUid, abilityId: effect.sourceAbilityId, effectType: effect.id, hpDelta: next.currentHp - before });
    }
  }
  return { unit: next, applications };
}

export type StatusHandler = (target: AbilityUnit, duration: number, potency: number) => AbilityUnit;
export type StatusHandlerRegistry = Readonly<Record<string, StatusHandler>>;
export type EffectContext = {
  caster: AbilityUnit;
  target: AbilityUnit;
  statusHandlers: StatusHandlerRegistry;
  sourceAbilityId?: string;
};

export const legacyStatusHandlers: StatusHandlerRegistry = {
  burn: (target, duration, potency) => ({
    ...target,
    burnTimer: Math.max(target.burnTimer, duration),
    burnDamage: Math.max(target.burnDamage, potency),
    statusIds: [...new Set([...(target.statusIds ?? []), "burn"])]
  }),
  slow: (target, duration, potency) => ({
    ...target,
    slowTimer: Math.max(target.slowTimer, duration),
    slowMultiplier: potency,
    statusIds: [...new Set([...(target.statusIds ?? []), "slow"])]
  })
};

export type EffectHandlerRegistry = {
  [Type in EffectDefinition["type"]]: (
    effect: Extract<EffectDefinition, { type: Type }>,
    context: EffectContext
  ) => AbilityUnit;
};

export const defaultEffectHandlers: EffectHandlerRegistry = {
  DAMAGE: (effect, { caster, target }) => {
    const resolved = resolveAbilityDamage(target, calculateScaling(effect.amount, caster, target));
    return { ...resolved.unit, currentHp: Math.max(0, target.currentHp - resolved.hpDamage) };
  },
  HEAL: (effect, { caster, target }) => target.currentHp <= 0 ? target : ({
    ...target,
    currentHp: Math.min(target.hp, target.currentHp + calculateScaling(effect.amount, caster, target))
  }),
  KNOCKBACK: (effect, { caster, target }) => {
    const distance = Math.max(0, calculateScaling(effect.distance, caster, target));
    return applyAbilityKnockback(target, distance, caster.team);
  },
  APPLY_STATUS: (effect, { caster, target, statusHandlers, sourceAbilityId }) => {
    if (effect.status === "stun" || effect.status === "slow") {
      const id: AbilityStatusId = effect.status === "stun" ? "STUN" : "SLOW";
      const state = target.abilityEffectState ?? emptyEffectState();
      const potency = effect.potency ? calculateScaling(effect.potency, caster, target) : 1;
      const existing = state.statuses.filter((entry) => entry.id !== id || (id === "SLOW" && entry.sourceUid !== caster.uid));
      const same = state.statuses.find((entry) => entry.id === id);
      const nextStatus = {
        id,
        sourceUid: caster.uid,
        sourceAbilityId,
        potency: same && id === "SLOW" ? Math.min(same.potency, potency) : potency,
        remaining: same && id === "STUN" ? Math.max(same.remaining, effect.duration) : effect.duration
      };
      return { ...target, abilityEffectState: { ...state, statuses: [...existing, nextStatus] } };
    }
    const handler = statusHandlers[effect.status];
    if (!handler) return target;
    const potency = effect.potency ? calculateScaling(effect.potency, caster, target) : 0;
    return handler(target, effect.duration, potency);
  },
  SHIELD: (effect, { caster, target, sourceAbilityId }) => {
    const state = target.abilityEffectState ?? emptyEffectState();
    return { ...target, abilityEffectState: { ...state, shields: [...state.shields, { amount: Math.max(0, calculateScaling(effect.amount, caster, target)), remaining: effect.duration, removable: true, sourceUid: caster.uid, sourceAbilityId }] } };
  },
  STAT_MODIFIER: (effect, { caster, target, sourceAbilityId }) => {
    const state = target.abilityEffectState ?? emptyEffectState();
    const baseStats = state.baseStats ?? { atk: target.atk, def: target.def ?? 0, attackInterval: target.attackInterval, speed: target.speed };
    const nextState: AbilityEffectState = {
      ...state,
      baseStats,
      statModifiers: [...state.statModifiers, { stat: effect.stat, mode: effect.mode, value: calculateScaling(effect.value, caster, target), remaining: effect.duration, removable: true, sourceUid: caster.uid, sourceAbilityId }]
    };
    return applyEffectiveStats(target, nextState);
  },
  DAMAGE_TAKEN_MODIFIER: (effect, { caster, target, sourceAbilityId }) => {
    const state = target.abilityEffectState ?? emptyEffectState();
    return { ...target, abilityEffectState: { ...state, damageTakenModifiers: [...state.damageTakenModifiers, { multiplier: Math.max(0, effect.multiplier), remaining: effect.duration, removable: true, sourceUid: caster.uid, sourceAbilityId }] } };
  },
  DOT: (effect, { caster, target, sourceAbilityId }) => {
    const state = target.abilityEffectState ?? emptyEffectState();
    const periodic = { id: "DOT" as const, amount: Math.max(0, calculateScaling(effect.amount, caster, target)), interval: Math.max(0.001, effect.interval), elapsed: 0, remaining: Math.max(0, effect.duration), sourceUid: caster.uid, sourceAbilityId, removable: true };
    return { ...target, abilityEffectState: { ...state, periodicEffects: [...state.periodicEffects, periodic] } };
  },
  HOT: (effect, { caster, target, sourceAbilityId }) => {
    const state = target.abilityEffectState ?? emptyEffectState();
    const periodic = { id: "HOT" as const, amount: Math.max(0, calculateScaling(effect.amount, caster, target)), interval: Math.max(0.001, effect.interval), elapsed: 0, remaining: Math.max(0, effect.duration), sourceUid: caster.uid, sourceAbilityId, removable: true };
    return { ...target, abilityEffectState: { ...state, periodicEffects: [...state.periodicEffects, periodic] } };
  },
  CLEANSE: (effect, { target }) => removeCleanseEffects(target, effect.count),
  DISPEL: (effect, { target }) => removeDispelEffects(target, effect.count),
  SUMMON: (_effect, { target }) => target
  ,REVIVE: (effect, { caster, target }) => {
    if (target.currentHp > 0) return target;
    return {
      ...target,
      currentHp: Math.min(target.hp, Math.max(0, calculateScaling(effect.amount, caster, target))),
      alive: true,
      attackTimer: 0,
      attackFlash: 0,
      hitFlash: 0,
      knockbackTimer: 0,
      burnTimer: 0,
      burnDamage: 0,
      slowTimer: 0,
      slowMultiplier: 1,
      abilityEffectState: undefined
    };
  },
  RESOURCE_CHANGE: (effect, { target }) => target
};

export function executeEffect(
  effect: EffectDefinition,
  context: EffectContext,
  handlers: EffectHandlerRegistry = defaultEffectHandlers
): AbilityUnit {
  const handler = handlers[effect.type] as (selected: EffectDefinition, selectedContext: EffectContext) => AbilityUnit;
  return handler(effect, context);
}

export function hasStatusHandler(status: StatusId, handlers: StatusHandlerRegistry = legacyStatusHandlers): boolean {
  return Boolean(handlers[status]);
}
