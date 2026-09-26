import React from "react";
import type { Unit } from "../game/types";
import { ELEMENT_CLASS, ELEMENT_LABEL, clamp } from "../game/constants";

export function BattleUnit({ unit }: { unit: Unit }) {
  return (
    <div
      className={`battle-unit ${unit.team} ${ELEMENT_CLASS[unit.element]} ${unit.hitFlash > 0 ? "hit" : ""} ${unit.attackFlash > 0 ? "attacking" : ""}`}
      style={{ left: `${unit.x}%` }}
      title={`${unit.name} · ${ELEMENT_LABEL[unit.element]}`}
    >
      <div className="unit-hp"><span style={{width: `${clamp((unit.currentHp / unit.hp) * 100, 0, 100)}%`}} /></div>
      <div className="unit-sprite">
        {unit.sprite}<span className="unit-aura" />
        {unit.knockbackCount > 0 && <span className="knockback-badge">↩ {unit.knockbackCount}/3</span>}
      </div>
      <div className="unit-name">{unit.name}</div>
      {unit.attackFlash > 0 && <div className={`attack-effect ${unit.rangeType === "ranged" ? "projectile" : ""}`} style={{ "--shot-x": `${(unit.attackTargetX - unit.x) * 1}vw` } as React.CSSProperties}>{unit.rangeType === "ranged" ? (unit.effect === "burn" ? "🔥" : "➤") : unit.effect === "burn" ? "✦" : "✦"}</div>}
      {unit.ability === "guard" && <div className="ability-badge">🛡️</div>}
      {unit.ability === "crit" && unit.attackFlash > 0 && <div className="ability-burst">✦✦</div>}
      {unit.ability === "execute" && unit.currentHp / unit.hp <= (unit.abilityValue ?? 0.25) && <div className="execute-badge">EXECUTE</div>}
      {unit.ability === "regen" && <div className="regen-badge">✚</div>}
    </div>
  );
}
