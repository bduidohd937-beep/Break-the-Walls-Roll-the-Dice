import shieldSheet from "../../assets/heroes/002-shield.png";
import type { Unit } from "../types";

export type BattleDeathEffect = { id: number; x: number; team: "hero" | "enemy"; life: number; duration: number; unit?: Unit };

type Frame = readonly [column: number, y: number];
type SpriteSheet = {
  image: string;
  idle: Frame[];
  walk: Frame[];
  attack: Frame[];
  hit: Frame[];
  death: Frame[];
  deathDuration: number;
};

const row = (y: number, count: number): Frame[] => Array.from({ length: count }, (_, x) => [x, y]);

export const UNIT_SPRITES: Record<string, SpriteSheet> = {
  shield: {
    image: shieldSheet,
    idle: row(0, 8),
    walk: row(48, 7),
    attack: row(92, 7),
    hit: [[5, 132], [6, 132], [7, 132]],
    // The atlas finishes with the fallen body fading and its spirit rising.
    death: [...row(176, 8).slice(3), ...row(224, 6)],
    deathDuration: 1.4,
  },
};

export const spriteDeathDuration = (id: string) => UNIT_SPRITES[id]?.deathDuration ?? 0.42;
