import React from "react";
import type { Unit } from "../../game/types";
import { ELEMENT_CLASS, clamp } from "../../game/constants";
import { HeroSprite } from "../shared/HeroSprite";
import { UNIT_ANIMATED_SPRITES, UNIT_SPRITE_CONFIGS } from "../../game/visuals/sprites";
import { getMovementAnimationRate } from "../../game/visuals/movementAnimation";
import { getAttackPresentationElapsed, isAttackPresentationActive } from "../../game/visuals/attackPresentation";
import type { AbilityUnit } from "../../game/combat/abilities/types";

export function BattleUnit({ unit, dyingProgress, gameSpeed = 1 }: { unit: Unit; dyingProgress?: number; gameSpeed?: number }) {
  const dying = dyingProgress !== undefined;
  const configuredAttack = UNIT_SPRITE_CONFIGS[unit.id]?.animations.attack;
  const configuredSkill = UNIT_SPRITE_CONFIGS[unit.id]?.animations.skill1;
  const configuredVisuals = UNIT_SPRITE_CONFIGS[unit.id]?.projectiles;
  const configuredAttackDuration = configuredAttack ? configuredAttack.syncToAttackInterval ? unit.attackInterval : configuredAttack.frameCount / configuredAttack.fps : undefined;
  const activeAttackDuration = Math.min(unit.attackInterval, configuredAttackDuration ?? UNIT_ANIMATED_SPRITES[unit.id]?.attackDuration ?? unit.attackInterval);
  const spriteAttack = UNIT_ANIMATED_SPRITES[unit.id];
  const spriteAttackElapsed = getAttackPresentationElapsed(unit.attackInterval, unit.attackAnimationTimer);
  const targetInRange = Math.abs(unit.attackTargetX - unit.x) <= unit.range / 10;
  const attackInterrupted = unit.hitFlash > 0 || unit.knockbackTimer > 0;
  const attackAnimationActive = spriteAttack || configuredAttack
    ? isAttackPresentationActive({
        attackInterval: unit.attackInterval,
        attackAnimationTimer: unit.attackAnimationTimer,
        animationDuration: activeAttackDuration,
        moving: unit.moving,
        inRange: targetInRange,
        interrupted: attackInterrupted
      })
    : unit.attackFlash > 0 && targetInRange && !unit.moving && !attackInterrupted;
  const projectileWindup = configuredAttack?.projectileSpawnFrame !== undefined ? configuredAttack.projectileSpawnFrame / configuredAttack.frameCount * activeAttackDuration : activeAttackDuration * 0.33;
  const projectileActive = spriteAttack || configuredAttack
    ? attackAnimationActive && spriteAttackElapsed >= projectileWindup && spriteAttackElapsed < projectileWindup + 0.35
    : unit.attackFlash > 0 && targetInRange && !unit.moving && !attackInterrupted;
  const skillAnimationActive = (unit.abilityAnimationTimer ?? 0) > 0 && unit.abilityAnimationState === "skill1";
  const skillElapsed = (unit.abilityAnimationDuration ?? 0) - (unit.abilityAnimationTimer ?? 0);
  const skillProjectileWindup = configuredSkill?.projectileSpawnFrame !== undefined ? configuredSkill.projectileSpawnFrame / configuredSkill.frameCount * (unit.abilityAnimationDuration ?? configuredSkill.frameCount / configuredSkill.fps) : 0;
  const skillProjectileActive = skillAnimationActive && skillElapsed >= skillProjectileWindup && skillElapsed < skillProjectileWindup + 0.45;
  const projectileVisual = skillProjectileActive ? configuredVisuals?.skill1 : configuredVisuals?.basic;
  const spriteState = dying ? "death" : unit.knockbackTimer > 0 ? "knockback" : unit.hitFlash > 0 ? "hit" : skillAnimationActive ? "skill1" : attackAnimationActive ? "attack" : unit.moving ? "walk" : "idle";
  const spriteConfig = unit.spriteConfig ?? UNIT_SPRITE_CONFIGS[unit.id];
  const spriteScale = spriteConfig?.scale ?? 1;
  const spriteHeight = spriteConfig ? 64 * spriteScale : 70;
  const movementRate = getMovementAnimationRate(unit as AbilityUnit);
  const facing = (spriteConfig?.facing === "LEFT" ? -1 : 1) * (unit.team === "enemy" ? -1 : 1);
  const projectileOriginX = (spriteConfig?.projectileOrigin?.x ?? 0.68) - 0.5;
  const projectileOriginY = spriteConfig?.projectileOrigin?.y ?? 0.53;
  const projectileOriginOffsetX = projectileOriginX * 64 * spriteScale * facing;
  const projectileDirection = Math.sign(unit.attackTargetX - unit.x) || facing;
  const hasRangedProjectile = !dying && unit.rangeType === "ranged" && (projectileActive || skillProjectileActive);
  const projectileStyle = {
    "--shot-x": `${unit.attackTargetX - unit.x}cqw`,
    "--projectile-origin-x": `${projectileOriginOffsetX}px`,
    "--projectile-origin-y": `${projectileOriginY * 100}%`,
    "--projectile-direction": projectileDirection,
    "--projectile-duration": `${(skillProjectileActive ? 0.28 : 0.18) / gameSpeed}s`,
    "--projectile-image": projectileVisual ? `url("${projectileVisual.asset}")` : undefined,
    "--trail-image": projectileVisual?.trailAsset ? `url("${projectileVisual.trailAsset}")` : undefined,
    "--release-image": projectileVisual?.releaseAsset ? `url("${projectileVisual.releaseAsset}")` : undefined,
    "--impact-image": projectileVisual?.impactAsset ? `url("${projectileVisual.impactAsset}")` : undefined
  } as React.CSSProperties;
  return (
    <div
      className={`battle-unit ${unit.team} ${ELEMENT_CLASS[unit.element]} ${unit.rangeType} ${dying ? "dying" : unit.hitFlash > 0 ? "hit" : ""} ${!dying && attackAnimationActive && unit.attackFlash > 0 ? "attacking" : ""}`}
      style={{ left: `${unit.x}%`, zIndex: 10 + Math.round(unit.x * 10), "--unit-sprite-height": `${spriteHeight}px`, "--unit-facing": facing } as React.CSSProperties}
      aria-label={unit.name}
    >
      {!dying && <div className="unit-hp"><span style={{width: `${clamp((unit.currentHp / unit.hp) * 100, 0, 100)}%`}} /></div>}
      <div className="unit-sprite">
        <div className="unit-sprite-motion">
          <div className="unit-sprite-facing">
            <HeroSprite hero={unit} state={spriteState} gameSpeed={gameSpeed} movePlaybackRate={movementRate} attackSequence={skillAnimationActive ? unit.abilityAnimationSequence : unit.attackAnimationSequence} attackDuration={(skillAnimationActive ? unit.abilityAnimationDuration : unit.knockbackTimer > 0 ? 0.22 : activeAttackDuration)! / gameSpeed} deathProgress={dyingProgress} />
          </div>
          <span className="unit-aura" />
        </div>
        {hasRangedProjectile && <div className={`attack-effect projectile ${unit.effect === "burn" ? "fire-impact" : ""} ${skillProjectileActive ? "piercing-projectile" : ""} ${projectileVisual ? "has-projectile-asset" : ""}`} style={projectileStyle}>{projectileVisual ? "" : unit.effect === "burn" ? "🔥" : "➤"}</div>}
      </div>
      {!dying && unit.rangeType === "melee" && projectileActive && <div className={`attack-effect melee-impact ${unit.effect === "burn" ? "fire-impact" : ""}`}>✦</div>}
      {!dying && unit.ability === "guard" && <div className="ability-badge" aria-label="가드">🛡️</div>}
      {!dying && unit.ability === "crit" && unit.attackFlash > 0 && <div className="ability-burst">✦✦</div>}
      {!dying && unit.ability === "execute" && unit.currentHp / unit.hp <= (unit.abilityValue ?? 0.25) && <div className="execute-badge" aria-label="처형">☠️</div>}
      {!dying && unit.ability === "regen" && <div className="regen-badge" aria-label="재생">✚</div>}
    </div>
  );
}
