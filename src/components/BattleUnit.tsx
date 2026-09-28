import React from "react";
import type { Unit } from "../game/types";
import { ELEMENT_CLASS, clamp } from "../game/constants";
import { HeroSprite } from "./HeroSprite";
import { UNIT_ANIMATED_SPRITES } from "../game/visuals/sprites";

export function BattleUnit({ unit, dyingProgress, gameSpeed = 1 }: { unit: Unit; dyingProgress?: number; gameSpeed?: number }) {
  const dying = dyingProgress !== undefined;
  const attackAnimationActive = UNIT_ANIMATED_SPRITES[unit.id]
    ? (unit.attackAnimationTimer ?? 0) > 0
    : unit.attackFlash > 0;
  return (
    <div
      className={`battle-unit ${unit.team} ${ELEMENT_CLASS[unit.element]} ${unit.rangeType} ${dying ? "dying" : unit.hitFlash > 0 ? "hit" : ""} ${!dying && unit.attackFlash > 0 ? "attacking" : ""}`}
      style={{ left: `${unit.x}%` }}
      aria-label={unit.name}
    >
      {!dying && <div className="unit-hp"><span style={{width: `${clamp((unit.currentHp / unit.hp) * 100, 0, 100)}%`}} /></div>}
      <div className="unit-sprite">
        <HeroSprite hero={unit} state={dying ? "death" : unit.hitFlash > 0 ? "hit" : attackAnimationActive ? "attack" : unit.moving ? "walk" : "idle"} gameSpeed={gameSpeed} attackSequence={unit.attackAnimationSequence} attackDuration={unit.attackInterval / gameSpeed} deathProgress={dyingProgress} /><span className="unit-aura" />
      </div>
      {!dying && unit.attackFlash > 0 && <div className={`attack-effect ${unit.rangeType === "ranged" ? "projectile" : "melee-impact"} ${unit.effect === "burn" ? "fire-impact" : ""}`} style={{ "--shot-x": `${(unit.attackTargetX - unit.x) * 1}vw` } as React.CSSProperties}>{unit.rangeType === "ranged" ? (unit.effect === "burn" ? "🔥" : "➤") : "✦"}</div>}
      {!dying && unit.ability === "guard" && <div className="ability-badge" aria-label="가드">🛡️</div>}
      {!dying && unit.ability === "crit" && unit.attackFlash > 0 && <div className="ability-burst">✦✦</div>}
      {!dying && unit.ability === "execute" && unit.currentHp / unit.hp <= (unit.abilityValue ?? 0.25) && <div className="execute-badge" aria-label="처형">☠️</div>}
      {!dying && unit.ability === "regen" && <div className="regen-badge" aria-label="재생">✚</div>}
    </div>
  );
}
