import type { Unit } from "../types";

export function incomingDamage(target: Unit, rawDamage: number): number {
  if (target.ability === "guard") {
    return rawDamage * (1 - (target.abilityValue ?? 0));
  }
  return rawDamage;
}

export function outgoingDamage(attacker: Unit, target: Unit, baseDamage: number): number {
  let damage = baseDamage;
  if (attacker.ability === "crit" && Math.random() < (attacker.abilityValue ?? 0)) damage *= 2;
  if (attacker.ability === "execute" && target.currentHp / target.hp <= (attacker.abilityValue ?? 0.25)) damage *= 1.5;
  if (attacker.element === "fire" && target.element === "dark") damage *= 1.25;
  return damage;
}

export function regenAmount(unit: Unit, dt: number): number {
  if (unit.ability !== "regen") return 0;
  return unit.hp * (unit.abilityValue ?? 0) * dt;
}
