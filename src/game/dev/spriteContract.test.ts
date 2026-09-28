import { describe, expect, it } from "vitest";
import type { UnitDef } from "../types";

describe("sprite asset contract", () => {
  it("accepts arbitrary frame sizes and animation metadata", () => {
    const unit: UnitDef = { id: "test_sprite", name: "test_sprite", sprite: "?", element: "neutral", hp: 1, atk: 1, speed: 1, range: 1, rangeType: "melee", attackInterval: 1, cost: 0, cooldown: 0, role: "test", spriteConfig: { frameWidth: 96, frameHeight: 128, scale: 1, pivotX: 0.5, pivotY: 1, animations: { attack: { asset: "asset-key", frameCount: 7, fps: 12, loop: false, impactFrame: 5 } } }, gameplayBounds: { width: 12, height: 20, collisionRadius: 4 } };
    expect(unit.spriteConfig?.frameWidth).toBe(96);
    expect(unit.spriteConfig?.frameHeight).toBe(128);
    expect(unit.spriteConfig?.animations.attack?.impactFrame).toBe(5);
    expect(unit.gameplayBounds?.width).toBe(12);
  });
});
