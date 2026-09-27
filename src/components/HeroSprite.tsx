import type { UnitDef } from "../game/types";

export function HeroSprite({ hero, attacking = false }: { hero: Pick<UnitDef, "id" | "sprite">; attacking?: boolean }) {
  if (hero.id === "shield") return <span className={`shield-pixel ${attacking ? "shield-pixel-attack" : ""}`} role="img" aria-label="철갑 방패병" />;
  return <>{hero.sprite}</>;
}
