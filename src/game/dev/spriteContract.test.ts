import { describe, expect, it } from "vitest";
import type { UnitDef } from "../types";
import { UNIT_SPRITE_CONFIGS } from "../visuals/sprites";
import { validateSpriteConfig } from "../content/validator";

describe("sprite asset contract", () => {
  it("accepts arbitrary frame sizes and animation metadata", () => {
    const unit: UnitDef = { id: "test_sprite", name: "test_sprite", sprite: "?", element: "neutral", hp: 1, atk: 1, speed: 1, range: 1, rangeType: "melee", attackInterval: 1, cost: 0, cooldown: 0, role: "test", spriteConfig: { frameWidth: 96, frameHeight: 128, scale: 1, pivotX: 0.5, pivotY: 1, animations: { attack: { asset: "asset-key", frameCount: 7, fps: 12, loop: false, impactFrame: 5 } } }, gameplayBounds: { width: 12, height: 20, collisionRadius: 4 } };
    expect(unit.spriteConfig?.frameWidth).toBe(96);
    expect(unit.spriteConfig?.frameHeight).toBe(128);
    expect(unit.spriteConfig?.animations.attack?.impactFrame).toBe(5);
    expect(unit.gameplayBounds?.width).toBe(12);
  });
  it("validates HERO_001 production animation contract", () => {
    const config = UNIT_SPRITE_CONFIGS.traineeSword;
    expect(config).toMatchObject({ frameWidth: 128, frameHeight: 128, pivotX: 0.5, pivotY: 1, facing: "RIGHT" });
    expect(config.groundOffsetY).toBe(5);
    expect(config.animations.idle?.groundOffsetY).toBe(6);
    expect(config.animations).toMatchObject({ idle: { frameCount: 4 }, move: { frameCount: 6 }, attack: { frameCount: 6 }, hit: { frameCount: 3 }, death: { frameCount: 6 } });
    const issues: { path: string; message: string }[] = [];
    validateSpriteConfig({ id: "hero001", name: "hero001", sprite: "", element: "neutral", hp: 1, atk: 1, speed: 1, range: 1, rangeType: "melee", attackInterval: 1, cost: 0, cooldown: 0, role: "test", spriteConfig: config }, "hero001", issues);
    expect(issues).toEqual([]);
  });
  it("keeps animation FPS visual-only at 1x and 5x", () => {
    const config = UNIT_SPRITE_CONFIGS.traineeSword;
    const duration = config.animations.attack!.frameCount / config.animations.attack!.fps;
    expect(duration / 5).toBeCloseTo(duration * 0.2);
  });
  it("validates HERO_002 production shield-bash animation contract", () => {
    const config = UNIT_SPRITE_CONFIGS.shield;
    expect(config).toMatchObject({ frameWidth: 128, frameHeight: 128, scale: 1.5, pivotX: 0.5, pivotY: 1, facing: "RIGHT" });
    expect(config.groundOffsetY).toBe(5);
    expect(config.animations).toMatchObject({
      idle: { frameCount: 4, fps: 6 },
      move: { frameCount: 6, fps: 10 },
      attack: { frameCount: 6, fps: 12, impactFrame: 4 },
      hit: { frameCount: 3, fps: 12 },
      death: { frameCount: 6, fps: 10 },
    });
    const issues: { path: string; message: string }[] = [];
    validateSpriteConfig({ id: "hero002", name: "hero002", sprite: "", element: "neutral", hp: 1, atk: 1, speed: 1, range: 1, rangeType: "melee", attackInterval: 1, cost: 0, cooldown: 0, role: "test", spriteConfig: config }, "hero002", issues);
    expect(issues).toEqual([]);
  });
  it("keeps HERO_003 frames grounded using source-frame baseline metadata", () => {
    const config = UNIT_SPRITE_CONFIGS.HERO_003;
    expect(config).toMatchObject({ frameWidth: 224, frameHeight: 224, scale: 1.3, pivotX: 0.5, pivotY: 1, groundOffsetY: 1, facing: "RIGHT" });
    expect(Object.values(config.animations).every((animation) => animation?.groundOffsetY === undefined || animation.groundOffsetY >= 0)).toBe(true);
    const issues: { path: string; message: string }[] = [];
    validateSpriteConfig({ id: "HERO_003", name: "HERO_003", sprite: "", element: "neutral", hp: 1, atk: 1, speed: 1, range: 1, rangeType: "melee", attackInterval: 1, cost: 0, cooldown: 0, role: "test", spriteConfig: config }, "HERO_003", issues);
    expect(issues).toEqual([]);
  });
  it("validates signed horizontal and downward vertical ground offsets in source-frame units", () => {
    const config = UNIT_SPRITE_CONFIGS.HERO_003;
    const adjusted = {
      ...config,
      groundOffsetX: -12,
      animations: { ...config.animations, idle: { ...config.animations.idle!, groundOffsetX: 12, groundOffsetY: 4 } },
    };
    const validIssues: { path: string; message: string }[] = [];
    validateSpriteConfig({ id: "HERO_003", name: "HERO_003", sprite: "", element: "neutral", hp: 1, atk: 1, speed: 1, range: 1, rangeType: "melee", attackInterval: 1, cost: 0, cooldown: 0, role: "test", spriteConfig: adjusted }, "HERO_003", validIssues);
    expect(validIssues).toEqual([]);

    const invalidIssues: { path: string; message: string }[] = [];
    validateSpriteConfig({ id: "HERO_003", name: "HERO_003", sprite: "", element: "neutral", hp: 1, atk: 1, speed: 1, range: 1, rangeType: "melee", attackInterval: 1, cost: 0, cooldown: 0, role: "test", spriteConfig: { ...adjusted, groundOffsetX: 225 } }, "HERO_003", invalidIssues);
    expect(invalidIssues.some((issue) => issue.message.includes("groundOffsetX"))).toBe(true);
  });
  it("keeps HERO_002 render scale separate from gameplay stats at 1x and 5x", () => {
    const config = UNIT_SPRITE_CONFIGS.shield;
    const duration = config.animations.attack!.frameCount / config.animations.attack!.fps;
    expect(config.scale).toBe(1.5);
    expect(duration).toBe(0.5);
    expect(duration / 5).toBeCloseTo(duration * 0.2);
  });
});
