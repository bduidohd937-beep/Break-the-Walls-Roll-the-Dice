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
      {unit.effect === "burn" && unit.attackFlash > 0 && <div className="attack-effect">✦</div>}
    </div>
  );
}
