import { clamp } from "../../constants";
import { calculateScaling } from "./scaling";
import type { AbilityUnit, EffectDefinition, StatusId } from "./types";

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
  DAMAGE: (effect, { caster, target }) => ({
    ...target,
    currentHp: Math.max(0, target.currentHp - calculateScaling(effect.amount, caster, target))
  }),
  HEAL: (effect, { caster, target }) => ({
    ...target,
    currentHp: Math.min(target.hp, target.currentHp + calculateScaling(effect.amount, caster, target))
  }),
  KNOCKBACK: (effect, { caster, target }) => {
    const distance = Math.max(0, calculateScaling(effect.distance, caster, target));
    const direction = caster.team === "hero" ? 1 : -1;
    return {
      ...target,
      knockbackTimer: 0.22,
      knockbackFromX: target.x,
      knockbackTargetX: clamp(target.x + direction * distance, 9, 87),
      attackTimer: Math.max(target.attackTimer, 0.35),
      attackFlash: 0,
      knockbackCount: target.knockbackCount + 1
    };
  },
  APPLY_STATUS: (effect, { caster, target, statusHandlers }) => {
    const handler = statusHandlers[effect.status];
    if (!handler) return target;
    const potency = effect.potency ? calculateScaling(effect.potency, caster, target) : 0;
    return handler(target, effect.duration, potency);
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

