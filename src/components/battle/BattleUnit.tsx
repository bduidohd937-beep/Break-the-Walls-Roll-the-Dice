import React from "react";
import type { Unit } from "../../game/types";
import { ELEMENT_CLASS, clamp } from "../../game/constants";
import { HeroSprite } from "../shared/HeroSprite";
import { UNIT_ANIMATED_SPRITES, UNIT_SPRITE_CONFIGS } from "../../game/visuals/sprites";

export function BattleUnit({ unit, dyingProgress, gameSpeed = 1 }: { unit: Unit; dyingProgress?: number; gameSpeed?: number }) {
  const dying = dyingProgress !== undefined;
  const configuredAttack = UNIT_SPRITE_CONFIGS[unit.id]?.animations.attack;
  const configuredAttackDuration = configuredAttack ? configuredAttack.frameCount / configuredAttack.fps : undefined;
  const attackAnimationActive = UNIT_ANIMATED_SPRITES[unit.id] || configuredAttack
    ? (unit.attackAnimationTimer ?? 0) > 0
    : unit.attackFlash > 0;
  const spriteAttack = UNIT_ANIMATED_SPRITES[unit.id];
  const spriteAttackElapsed = unit.attackInterval - (unit.attackAnimationTimer ?? unit.attackInterval);
  const projectileWindup = configuredAttack?.projectileSpawnFrame !== undefined ? configuredAttack.projectileSpawnFrame / configuredAttack.fps : Math.min(unit.attackInterval, spriteAttack?.attackDuration ?? 0) * 0.33;
  const projectileActive = spriteAttack || configuredAttack
    ? spriteAttackElapsed >= projectileWindup && spriteAttackElapsed < projectileWindup + 0.35
    : unit.attackFlash > 0;
  return (
    <div
      className={`battle-unit ${unit.team} ${ELEMENT_CLASS[unit.element]} ${unit.rangeType} ${dying ? "dying" : unit.hitFlash > 0 ? "hit" : ""} ${!dying && unit.attackFlash > 0 ? "attacking" : ""}`}
      style={{ left: `${unit.x}%` }}
      aria-label={unit.name}
    >
      {!dying && <div className="unit-hp"><span style={{width: `${clamp((unit.currentHp / unit.hp) * 100, 0, 100)}%`}} /></div>}
      <div className="unit-sprite" style={{ transform: `scaleX(${(unit.spriteConfig?.facing === "LEFT" ? -1 : 1) * (unit.team === "enemy" ? -1 : 1)})` }}>
        <HeroSprite hero={unit} state={dying ? "death" : unit.hitFlash > 0 ? "hit" : attackAnimationActive ? "attack" : unit.moving ? "walk" : "idle"} gameSpeed={gameSpeed} attackSequence={unit.attackAnimationSequence} attackDuration={Math.min(unit.attackInterval, configuredAttackDuration ?? UNIT_ANIMATED_SPRITES[unit.id]?.attackDuration ?? unit.attackInterval) / gameSpeed} deathProgress={dyingProgress} /><span className="unit-aura" />
      </div>
      {!dying && projectileActive && <div className={`attack-effect ${unit.rangeType === "ranged" ? "projectile" : "melee-impact"} ${unit.effect === "burn" ? "fire-impact" : ""}`} style={{ "--shot-x": `${(unit.attackTargetX - unit.x) * 1}vw`, "--projectile-duration": `${0.18 / gameSpeed}s` } as React.CSSProperties}>{unit.rangeType === "ranged" ? (unit.effect === "burn" ? "🔥" : "➤") : "✦"}</div>}
      {!dying && unit.ability === "guard" && <div className="ability-badge" aria-label="가드">🛡️</div>}
      {!dying && unit.ability === "crit" && unit.attackFlash > 0 && <div className="ability-burst">✦✦</div>}
      {!dying && unit.ability === "execute" && unit.currentHp / unit.hp <= (unit.abilityValue ?? 0.25) && <div className="execute-badge" aria-label="처형">☠️</div>}
      {!dying && unit.ability === "regen" && <div className="regen-badge" aria-label="재생">✚</div>}
    </div>
  );
}
