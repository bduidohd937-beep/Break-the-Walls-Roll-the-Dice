import type { Team, Unit, UnitDef } from "../types";

export function makeUnit(def: UnitDef, team: Team, x: number, uid: number): Unit {
  return {
    ...def,
    uid,
    team,
    x,
    currentHp: def.hp,
    attackTimer: Math.random() * 0.5,
    cooldownTimer: 0,
    hitFlash: 0,
    attackFlash: 0,
    attackTargetX: x,
    knockbackCount: 0,
    knockbackTimer: 0,
    knockbackFromX: x,
    knockbackTargetX: x,
    alive: true,
    burnTimer: 0,
    burnDamage: 0,
  };
}
