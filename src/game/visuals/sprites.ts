import soldierSheet from "../../assets/heroes/001-soldier.png";
import serentiaPortrait from "../../assets/heroes/serentia-portrait.png";
import serentiaWalk from "../../assets/heroes/serentia-walk.gif";
import serentiaAttack from "../../assets/heroes/serentia-attack.gif";
import type { Unit } from "../types";

export type BattleDeathEffect = { id: number; x: number; team: "hero" | "enemy"; life: number; duration: number; unit?: Unit };

export type Frame = readonly [column: number, y: number];
export type SpriteSheet = {
  image: string;
  idle: Frame[];
  walk: Frame[];
  attack: Frame[];
  hit: Frame[];
  death: {
    fall: Frame[];
    corpse: Frame;
    soul: Frame;
    fallSeconds: number;
    corpseSeconds: number;
    soulSeconds: number;
  };
};

export type AnimatedSprite = {
  portrait: string;
  walk: string;
  attack: string;
};

const row = (y: number, count: number): Frame[] => Array.from({ length: count }, (_, x) => [x, y]);

export const UNIT_SPRITES: Record<string, SpriteSheet> = {
  traineeSword: {
    image: soldierSheet,
    idle: row(0, 8),
    walk: row(48, 7),
    attack: row(92, 7),
    hit: [[5, 132], [6, 132], [7, 132]],
    death: {
      fall: [...row(176, 8).slice(4), [0, 224]],
      corpse: [0, 224],
      // Only the upper part of this original frame contains the rising soul.
      soul: [3, 224],
      fallSeconds: 0.9,
      corpseSeconds: 0.3,
      soulSeconds: 0.6,
    },
  },
};

// Animated sprites keep each unit's source assets separate, so later skills can
// add their own cast, hit, and death clips without changing battle data.
export const UNIT_ANIMATED_SPRITES: Record<string, AnimatedSprite> = {
  serentia: { portrait: serentiaPortrait, walk: serentiaWalk, attack: serentiaAttack },
};

export const spriteDeathDuration = (id: string) => {
  const death = UNIT_SPRITES[id]?.death;
  return death ? Math.round((death.fallSeconds + death.corpseSeconds + death.soulSeconds) * 1000) / 1000 : 0.42;
};
