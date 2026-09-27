import shieldSheet from "../../assets/heroes/002-shield.png";
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

const row = (y: number, count: number): Frame[] => Array.from({ length: count }, (_, x) => [x, y]);

export const UNIT_SPRITES: Record<string, SpriteSheet> = {
  shield: {
    image: shieldSheet,
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

export const spriteDeathDuration = (id: string) => {
  const death = UNIT_SPRITES[id]?.death;
  return death ? Math.round((death.fallSeconds + death.corpseSeconds + death.soulSeconds) * 1000) / 1000 : 0.42;
};
