import type { CSSProperties } from "react";
import type { UnitDef } from "../game/types";
import { UNIT_SPRITES } from "../game/visuals/sprites";

type SpriteState = "idle" | "walk" | "attack" | "hit" | "death";
export function HeroSprite({ hero, state = "idle", deathProgress = 0 }: { hero: Pick<UnitDef, "id" | "sprite" | "name">; state?: SpriteState; deathProgress?: number }) {
  const sheet = UNIT_SPRITES[hero.id];
  if (sheet) {
    const frames = sheet[state];
    const frame = state === "death" ? Math.min(frames.length - 1, Math.floor(deathProgress * frames.length)) : 0;
    const [column, y] = frames[frame];
    return <span className={`unit-pixel-sprite state-${state}`} role="img" aria-label={hero.name} style={{ "--sprite-image": `url("${sheet.image}")`, "--frame-x": column, "--frame-y": y / 32, "--frame-count": frames.length } as CSSProperties} />;
  }
  return <>{hero.sprite}</>;
}
