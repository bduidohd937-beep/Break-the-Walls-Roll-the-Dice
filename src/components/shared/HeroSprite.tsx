import type { CSSProperties } from "react";
import type { UnitDef } from "../../game/types";
import { UNIT_SPRITE_CONFIGS } from "../../game/visuals/sprites";
import { spriteAnimationDuration } from "../../game/visuals/movementAnimation";

type SpriteState = "idle" | "walk" | "attack" | "skill1" | "hit" | "knockback" | "death";
type SpriteVariant = "battle" | "portrait" | "deploy" | "skill1" | "soul" | "soulFragment";

export function HeroSprite({ hero, state = "idle", deathProgress = 0, attackDuration, gameSpeed = 1, movePlaybackRate = 1, attackSequence = 0, variant = "battle" }: { hero: Pick<UnitDef, "id" | "sprite" | "name">; state?: SpriteState; deathProgress?: number; attackDuration?: number; gameSpeed?: number; movePlaybackRate?: number; attackSequence?: number; variant?: SpriteVariant }) {
  const configured = (hero as UnitDef).spriteConfig ?? UNIT_SPRITE_CONFIGS[hero.id];
  const uiAsset = variant === "battle" ? undefined : configured?.ui?.[variant];
  if (uiAsset) return <img className={`hero-ui-asset hero-ui-${variant}`} src={uiAsset} alt={hero.name} />;
  const configuredAnimation = configured?.animations[state === "walk" ? "move" : state];
  if (configuredAnimation?.asset) {
    const duration = spriteAnimationDuration(configuredAnimation.frameCount, configuredAnimation.fps, gameSpeed, state === "walk" ? movePlaybackRate : 1);
    const pivotX = configuredAnimation.pivotX ?? configured!.pivotX;
    const pivotY = configuredAnimation.pivotY ?? configured!.pivotY;
    const groundOffsetX = configuredAnimation.groundOffsetX ?? configured!.groundOffsetX ?? 0;
    const groundOffsetY = configuredAnimation.groundOffsetY ?? configured!.groundOffsetY ?? 0;
    return <span key={`${state}-${state === "attack" || state === "skill1" ? attackSequence : 0}`} className={`unit-animated-sprite state-${state}`} role="img" aria-label={hero.name}
      style={{ "--sprite-image": `url("${configuredAnimation.asset}")`, "--frame-count": configuredAnimation.frameCount, "--last-frame": configuredAnimation.frameCount - 1, "--sprite-scale": configured!.scale, "--animation-duration": `${duration}s`, "--attack-duration": `${attackDuration ?? duration}s`, "--pivot-x": pivotX, "--pivot-y": pivotY, "--ground-offset-x": `${(groundOffsetX / configured!.frameWidth) * 100}%`, "--ground-offset-y": `${(groundOffsetY / configured!.frameHeight) * 100}%`, alignSelf: pivotY === 1 ? "end" : "center", justifySelf: "center", animationIterationCount: configuredAnimation.loop ? "infinite" : 1, animationFillMode: "forwards" } as CSSProperties}
      data-animated={configuredAnimation.frameCount > 1 ? "true" : undefined} data-loop={configuredAnimation.loop ? "true" : "false"} />;
  }
  return <>{hero.sprite}</>;
}
