import type { CSSProperties } from "react";
import type { UnitDef } from "../../game/types";
import { UNIT_ANIMATED_SPRITES, UNIT_SPRITE_CONFIGS, UNIT_SPRITES, type Frame, type SpriteSheet } from "../../game/visuals/sprites";

type SpriteState = "idle" | "walk" | "attack" | "skill1" | "hit" | "knockback" | "death";
type SpriteVariant = "battle" | "portrait" | "deploy" | "skill1" | "soul" | "soulFragment";
const frameStyle = (sheet: SpriteSheet, [column, y]: Frame, count = 1): CSSProperties => ({
  "--sprite-image": `url("${sheet.image}")`,
  "--frame-x": column,
  "--frame-y": y / 32,
  "--frame-count": count,
} as CSSProperties);

export function HeroSprite({ hero, state = "idle", deathProgress = 0, attackDuration, gameSpeed = 1, attackSequence = 0, variant = "battle" }: { hero: Pick<UnitDef, "id" | "sprite" | "name">; state?: SpriteState; deathProgress?: number; attackDuration?: number; gameSpeed?: number; attackSequence?: number; variant?: SpriteVariant }) {
  const configured = (hero as UnitDef).spriteConfig ?? UNIT_SPRITE_CONFIGS[hero.id];
  const uiAsset = variant === "battle" ? undefined : configured?.ui?.[variant];
  if (uiAsset) return <img className={`hero-ui-asset hero-ui-${variant}`} src={uiAsset} alt={hero.name} />;
  const configuredAnimation = configured?.animations[state === "walk" ? "move" : state];
  if (configuredAnimation?.asset) {
    const duration = configuredAnimation.fps > 0 ? configuredAnimation.frameCount / configuredAnimation.fps / gameSpeed : 0;
    return <span key={`${state}-${state === "attack" || state === "skill1" ? attackSequence : 0}`} className={`unit-animated-sprite state-${state}`} role="img" aria-label={hero.name}
      style={{ "--sprite-image": `url("${configuredAnimation.asset}")`, "--frame-count": configuredAnimation.frameCount, "--last-frame": configuredAnimation.frameCount - 1, "--sprite-scale": configured!.scale, "--animation-duration": `${duration}s`, "--attack-duration": `${attackDuration ?? duration}s`, "--pivot-x": configured!.pivotX, "--pivot-y": configured!.pivotY, alignSelf: configured!.pivotY === 1 ? "end" : "center", justifySelf: "center", animationIterationCount: configuredAnimation.loop ? "infinite" : 1, animationFillMode: "forwards" } as CSSProperties}
      data-animated={configuredAnimation.frameCount > 1 ? "true" : undefined} data-loop={configuredAnimation.loop ? "true" : "false"} />;
  }
  const animatedSprite = UNIT_ANIMATED_SPRITES[hero.id];
  if (animatedSprite) {
    const animated = state === "walk" || state === "attack";
    const image = state === "attack" ? animatedSprite.attack : state === "walk" ? animatedSprite.walk : animatedSprite.idle;
    const count = animated ? animatedSprite.frameCount : 1;
    const duration = state === "attack" ? attackDuration ?? animatedSprite.attackDuration / gameSpeed : animatedSprite.walkDuration / gameSpeed;
    return <span key={state === "attack" ? `attack-${attackSequence}` : state} className={`unit-animated-sprite state-${state}`} role="img" aria-label={hero.name}
      style={{ "--sprite-image": `url("${image}")`, "--frame-count": count, "--last-frame": count - 1, "--sprite-scale": animatedSprite.displayScale ?? 1.375, "--animation-duration": `${duration}s`, "--attack-duration": `${duration}s` } as CSSProperties}
      data-animated={animated ? "true" : undefined} />;
  }
  const sheet = UNIT_SPRITES[hero.id];
  if (sheet) {
    if (state === "death") {
      const death = sheet.death;
      const seconds = Math.round(deathProgress * (death.fallSeconds + death.corpseSeconds + death.soulSeconds) * 1000) / 1000;
      const falling = seconds < death.fallSeconds;
      const ascending = seconds >= death.fallSeconds + death.corpseSeconds;
      const fallIndex = Math.min(death.fall.length - 1, Math.floor(seconds / death.fallSeconds * death.fall.length));
      const soulProgress = ascending ? Math.min(1, (seconds - death.fallSeconds - death.corpseSeconds) / death.soulSeconds) : 0;
      return <span className="sprite-death" role="img" aria-label={`${hero.name} 사망`}>
        <span className={`unit-pixel-sprite state-death ${falling ? "" : "death-corpse"}`} style={frameStyle(sheet, falling ? death.fall[fallIndex] : death.corpse)} />
        {ascending && <span className="unit-pixel-sprite death-soul" style={{ ...frameStyle(sheet, death.soul), "--soul-rise": `${soulProgress * 42}px`, opacity: 1 - soulProgress } as CSSProperties} />}
      </span>;
    }
    const legacyState = state === "skill1" || state === "knockback" ? "idle" : state;
    const frames = sheet[legacyState];
    return <span className={`unit-pixel-sprite state-${state}`} role="img" aria-label={hero.name} style={frameStyle(sheet, frames[0], frames.length)} />;
  }
  return <>{hero.sprite}</>;
}
