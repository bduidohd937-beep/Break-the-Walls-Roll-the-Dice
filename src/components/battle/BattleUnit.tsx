import React from "react";
import type { Unit } from "../../game/types";
import { ELEMENT_CLASS, clamp } from "../../game/constants";
import { HeroSprite } from "../shared/HeroSprite";
import { UNIT_ANIMATED_SPRITES, UNIT_SPRITE_CONFIGS } from "../../game/visuals/sprites";

export function BattleUnit({ unit, dyingProgress, gameSpeed = 1, worldScale = 1 }: { unit: Unit; dyingProgress?: number; gameSpeed?: number; worldScale?: number }) {
  const dying = dyingProgress !== undefined;
  const configuredAttack = UNIT_SPRITE_CONFIGS[unit.id]?.animations.attack;
  const configuredSkill = UNIT_SPRITE_CONFIGS[unit.id]?.animations.skill1;
  const configuredVisuals = UNIT_SPRITE_CONFIGS[unit.id]?.projectiles;
  const configuredAttackDuration = configuredAttack ? configuredAttack.syncToAttackInterval ? unit.attackInterval : configuredAttack.frameCount / configuredAttack.fps : undefined;
  const activeAttackDuration = Math.min(unit.attackInterval, configuredAttackDuration ?? UNIT_ANIMATED_SPRITES[unit.id]?.attackDuration ?? unit.attackInterval);
  const attackAnimationActive = UNIT_ANIMATED_SPRITES[unit.id] || configuredAttack
    ? (unit.attackAnimationTimer ?? 0) > 0
    : unit.attackFlash > 0;
  const spriteAttack = UNIT_ANIMATED_SPRITES[unit.id];
  const spriteAttackElapsed = unit.attackInterval - (unit.attackAnimationTimer ?? unit.attackInterval);
  const projectileWindup = configuredAttack?.projectileSpawnFrame !== undefined ? configuredAttack.projectileSpawnFrame / configuredAttack.frameCount * activeAttackDuration : activeAttackDuration * 0.33;
  const projectileActive = spriteAttack || configuredAttack
    ? spriteAttackElapsed >= projectileWindup && spriteAttackElapsed < projectileWindup + 0.35
    : unit.attackFlash > 0;
  const skillAnimationActive = (unit.abilityAnimationTimer ?? 0) > 0 && unit.abilityAnimationState === "skill1";
  const skillElapsed = (unit.abilityAnimationDuration ?? 0) - (unit.abilityAnimationTimer ?? 0);
  const skillProjectileWindup = configuredSkill?.projectileSpawnFrame !== undefined ? configuredSkill.projectileSpawnFrame / configuredSkill.frameCount * (unit.abilityAnimationDuration ?? configuredSkill.frameCount / configuredSkill.fps) : 0;
  const skillProjectileActive = skillAnimationActive && skillElapsed >= skillProjectileWindup && skillElapsed < skillProjectileWindup + 0.45;
  const projectileVisual = skillProjectileActive ? configuredVisuals?.skill1 : configuredVisuals?.basic;
  const spriteState = dying ? "death" : unit.knockbackTimer > 0 ? "knockback" : unit.hitFlash > 0 ? "hit" : skillAnimationActive ? "skill1" : attackAnimationActive ? "attack" : unit.moving ? "walk" : "idle";
  return (
    <div
      className={`battle-unit ${unit.team} ${ELEMENT_CLASS[unit.element]} ${unit.rangeType} ${dying ? "dying" : unit.hitFlash > 0 ? "hit" : ""} ${!dying && unit.attackFlash > 0 ? "attacking" : ""}`}
      style={{ left: `${unit.x}%` }}
      aria-label={unit.name}
    >
      {!dying && <div className="unit-hp"><span style={{width: `${clamp((unit.currentHp / unit.hp) * 100, 0, 100)}%`}} /></div>}
      <div className="unit-sprite" style={{ transform: `scaleX(${(unit.spriteConfig?.facing === "LEFT" ? -1 : 1) * (unit.team === "enemy" ? -1 : 1)})` }}>
        <HeroSprite hero={unit} state={spriteState} gameSpeed={gameSpeed} attackSequence={skillAnimationActive ? unit.abilityAnimationSequence : unit.attackAnimationSequence} attackDuration={(skillAnimationActive ? unit.abilityAnimationDuration : unit.knockbackTimer > 0 ? 0.22 : activeAttackDuration)! / gameSpeed} deathProgress={dyingProgress} /><span className="unit-aura" />
      </div>
      {!dying && (projectileActive || skillProjectileActive) && <div className={`attack-effect ${unit.rangeType === "ranged" ? "projectile" : "melee-impact"} ${unit.effect === "burn" ? "fire-impact" : ""} ${skillProjectileActive ? "piercing-projectile" : ""} ${projectileVisual ? "has-projectile-asset" : ""}`} style={{ "--shot-x": `${(unit.attackTargetX - unit.x) * worldScale}vw`, "--projectile-duration": `${(skillProjectileActive ? 0.28 : 0.18) / gameSpeed}s`, "--projectile-image": projectileVisual ? `url("${projectileVisual.asset}")` : undefined, "--trail-image": projectileVisual?.trailAsset ? `url("${projectileVisual.trailAsset}")` : undefined, "--release-image": projectileVisual?.releaseAsset ? `url("${projectileVisual.releaseAsset}")` : undefined, "--impact-image": projectileVisual?.impactAsset ? `url("${projectileVisual.impactAsset}")` : undefined } as React.CSSProperties}>{projectileVisual ? "" : unit.rangeType === "ranged" ? (unit.effect === "burn" ? "🔥" : "➤") : "✦"}</div>}
      {!dying && unit.ability === "guard" && <div className="ability-badge" aria-label="가드">🛡️</div>}
      {!dying && unit.ability === "crit" && unit.attackFlash > 0 && <div className="ability-burst">✦✦</div>}
      {!dying && unit.ability === "execute" && unit.currentHp / unit.hp <= (unit.abilityValue ?? 0.25) && <div className="execute-badge" aria-label="처형">☠️</div>}
      {!dying && unit.ability === "regen" && <div className="regen-badge" aria-label="재생">✚</div>}
    </div>
  );
}
