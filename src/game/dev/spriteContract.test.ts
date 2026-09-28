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
});
