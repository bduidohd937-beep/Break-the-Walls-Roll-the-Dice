import hero001Idle from "../../assets/heroes/hero-001/lv01/idle.png";
import hero001Move from "../../assets/heroes/hero-001/lv01/move.png";
import hero001Attack from "../../assets/heroes/hero-001/lv01/attack.png";
import hero001Hit from "../../assets/heroes/hero-001/lv01/hit.png";
import hero001Death from "../../assets/heroes/hero-001/lv01/death.png";
import hero002Idle from "../../assets/heroes/hero-002/lv01/idle.png";
import hero002Move from "../../assets/heroes/hero-002/lv01/move.png";
import hero002Attack from "../../assets/heroes/hero-002/lv01/attack.png";
import hero002Hit from "../../assets/heroes/hero-002/lv01/hit.png";
import hero002Death from "../../assets/heroes/hero-002/lv01/death.png";
import hero003Idle from "../../assets/heroes/hero-003/lv01/idle.png";
import hero003Move from "../../assets/heroes/hero-003/lv01/move.png";
import hero003Attack from "../../assets/heroes/hero-003/lv01/attack.png";
import hero003Skill1 from "../../assets/heroes/hero-003/lv01/skill1.png";
import hero003Hit from "../../assets/heroes/hero-003/lv01/hit.png";
import hero003Knockback from "../../assets/heroes/hero-003/lv01/knockback.png";
import hero003Death from "../../assets/heroes/hero-003/lv01/death.png";
import hero003BasicArrow from "../../assets/heroes/hero-003/vfx/basic-arrow.png";
import hero003PiercingArrow from "../../assets/heroes/hero-003/vfx/piercing-arrow.png";
import hero003AirTrail from "../../assets/heroes/hero-003/vfx/air-trail.png";
import hero003ReleaseFx from "../../assets/heroes/hero-003/vfx/release-fx.png";
import hero003PierceFx from "../../assets/heroes/hero-003/vfx/pierce-fx.png";
import hero003ImpactDebris from "../../assets/heroes/hero-003/vfx/impact-debris.png";
import hero003Portrait from "../../assets/heroes/hero-003/ui/portrait.png";
import hero003DeployIcon from "../../assets/heroes/hero-003/ui/deploy-icon.png";
import hero003Skill1Icon from "../../assets/heroes/hero-003/ui/skill-1-icon.png";
import hero003SoulIcon from "../../assets/heroes/hero-003/ui/soul-icon.png";
import hero003SoulFragmentIcon from "../../assets/heroes/hero-003/ui/soul-fragment-icon.png";
import type { Unit } from "../types";
import type { SpriteConfig } from "../types";

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
  // Square horizontal atlas cells; source resolution is independent of display size.
  displayScale?: number;
  idle: string;
  walk: string;
  attack: string;
  frameCount: number;
  walkDuration: number;
  attackDuration: number;
};

const row = (y: number, count: number): Frame[] => Array.from({ length: count }, (_, x) => [x, y]);

export const UNIT_SPRITES: Record<string, SpriteSheet> = {
};

// Animated sprites keep each unit's source assets separate, so later skills can
// add their own cast, hit, and death clips without changing battle data.
export const UNIT_ANIMATED_SPRITES: Record<string, AnimatedSprite> = {
};

export const UNIT_SPRITE_CONFIGS: Record<string, SpriteConfig> = {
  traineeSword: {
    frameWidth: 128, frameHeight: 128, scale: 1, pivotX: 0.5, pivotY: 1, facing: "RIGHT",
    animations: {
      idle: { asset: hero001Idle, frameCount: 4, fps: 6, loop: true },
      move: { asset: hero001Move, frameCount: 6, fps: 10, loop: true },
      attack: { asset: hero001Attack, frameCount: 6, fps: 12, loop: false, impactFrame: 4, projectileSpawnFrame: 4 },
      hit: { asset: hero001Hit, frameCount: 3, fps: 12, loop: false },
      death: { asset: hero001Death, frameCount: 6, fps: 10, loop: false },
    },
  },
  shield: {
    frameWidth: 128, frameHeight: 128, scale: 1.5, pivotX: 0.5, pivotY: 1, facing: "RIGHT",
    animations: {
      idle: { asset: hero002Idle, frameCount: 4, fps: 6, loop: true },
      move: { asset: hero002Move, frameCount: 6, fps: 10, loop: true },
      attack: { asset: hero002Attack, frameCount: 6, fps: 12, loop: false, impactFrame: 4 },
      hit: { asset: hero002Hit, frameCount: 3, fps: 12, loop: false },
      death: { asset: hero002Death, frameCount: 6, fps: 10, loop: false },
    },
  },
  HERO_003: {
    frameWidth: 224, frameHeight: 224, scale: 1.15, pivotX: 0.5, pivotY: 1, facing: "RIGHT",
    animations: {
      idle: { asset: hero003Idle, frameCount: 4, fps: 6, loop: true },
      move: { asset: hero003Move, frameCount: 6, fps: 10, loop: true },
      attack: { asset: hero003Attack, frameCount: 6, fps: 12, loop: false, impactFrame: 5, projectileSpawnFrame: 5 },
      skill1: { asset: hero003Skill1, frameCount: 8, fps: 12, loop: false, impactFrame: 6, projectileSpawnFrame: 6, skillEventFrame: 6 },
      hit: { asset: hero003Hit, frameCount: 2, fps: 10, loop: false },
      knockback: { asset: hero003Knockback, frameCount: 4, fps: 10, loop: false },
      death: { asset: hero003Death, frameCount: 6, fps: 8, loop: false },
    },
    projectiles: {
      basic: { asset: hero003BasicArrow, trailAsset: hero003AirTrail, releaseAsset: hero003ReleaseFx, impactAsset: hero003ImpactDebris },
      skill1: { asset: hero003PiercingArrow, trailAsset: hero003AirTrail, releaseAsset: hero003ReleaseFx, pierceAsset: hero003PierceFx, impactAsset: hero003ImpactDebris },
    },
    ui: { portrait: hero003Portrait, deploy: hero003DeployIcon, skill1: hero003Skill1Icon, soul: hero003SoulIcon, soulFragment: hero003SoulFragmentIcon },
  },
};

export const spriteDeathDuration = (id: string) => {
  const configuredDeath = UNIT_SPRITE_CONFIGS[id]?.animations.death;
  if (configuredDeath) return configuredDeath.frameCount / configuredDeath.fps;
  const death = UNIT_SPRITES[id]?.death;
  return death ? Math.round((death.fallSeconds + death.corpseSeconds + death.soulSeconds) * 1000) / 1000 : 0.42;
};
