import { applyAbilityKnockback } from "../knockback";
import { calculateScaling } from "./scaling";
import type { AbilityEffectState, AbilityUnit, EffectDefinition, ModifiableStat, StatusId } from "./types";

const emptyEffectState = (): AbilityEffectState => ({ shields: [], statModifiers: [], damageTakenModifiers: [] });

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
  };
  const active = nextState.shields.length + nextState.statModifiers.length + nextState.damageTakenModifiers.length > 0;
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

export type StatusHandler = (target: AbilityUnit, duration: number, potency: number) => AbilityUnit;
export type StatusHandlerRegistry = Readonly<Record<string, StatusHandler>>;
export type EffectContext = {
  caster: AbilityUnit;
  target: AbilityUnit;
  statusHandlers: StatusHandlerRegistry;
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
  APPLY_STATUS: (effect, { caster, target, statusHandlers }) => {
    const handler = statusHandlers[effect.status];
    if (!handler) return target;
    const potency = effect.potency ? calculateScaling(effect.potency, caster, target) : 0;
    return handler(target, effect.duration, potency);
  },
  SHIELD: (effect, { caster, target }) => {
    const state = target.abilityEffectState ?? emptyEffectState();
    return { ...target, abilityEffectState: { ...state, shields: [...state.shields, { amount: Math.max(0, calculateScaling(effect.amount, caster, target)), remaining: effect.duration }] } };
  },
  STAT_MODIFIER: (effect, { caster, target }) => {
    const state = target.abilityEffectState ?? emptyEffectState();
    const baseStats = state.baseStats ?? { atk: target.atk, def: target.def ?? 0, attackInterval: target.attackInterval, speed: target.speed };
    const nextState: AbilityEffectState = {
      ...state,
      baseStats,
      statModifiers: [...state.statModifiers, { stat: effect.stat, mode: effect.mode, value: calculateScaling(effect.value, caster, target), remaining: effect.duration }]
    };
    return applyEffectiveStats(target, nextState);
  },
  DAMAGE_TAKEN_MODIFIER: (effect, { target }) => {
    const state = target.abilityEffectState ?? emptyEffectState();
    return { ...target, abilityEffectState: { ...state, damageTakenModifiers: [...state.damageTakenModifiers, { multiplier: Math.max(0, effect.multiplier), remaining: effect.duration }] } };
  }
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
