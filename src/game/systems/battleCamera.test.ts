import { describe, expect, it } from "vitest";
import {
  BATTLE_NARROW_DEFAULT_LEFT,
  BATTLE_NARROW_VIEW_SPAN,
  battleDeckPageAfterSwipe,
  cameraLeftAfterDrag,
  getBattleCameraGeometry,
  projectBattleWorldX
} from "./battleCamera";

describe("battle camera projection", () => {
  it("shows the complete world in wide view without scaling world sprites", () => {
    const geometry = getBattleCameraGeometry("wide", 38);
    expect(geometry).toMatchObject({ span: 100, left: 0, worldScale: 1, worldWidthPercent: 100, worldOffsetPercent: 0 });
    expect(projectBattleWorldX(7, "wide", 38)).toBe(7);
    expect(projectBattleWorldX(93, "wide", 38)).toBe(93);
  });

  it("maps a narrow camera range to the viewport while preserving world coordinates", () => {
    const left = BATTLE_NARROW_DEFAULT_LEFT;
    const geometry = getBattleCameraGeometry("narrow", left);
    expect(geometry.span).toBe(BATTLE_NARROW_VIEW_SPAN);
    expect(projectBattleWorldX(left, "narrow", left)).toBe(0);
    expect(projectBattleWorldX(left + BATTLE_NARROW_VIEW_SPAN, "narrow", left)).toBe(100);
    expect(projectBattleWorldX(50, "narrow", left)).toBeCloseTo(50);
    expect(geometry.worldScale).toBeGreaterThan(1);
    expect(geometry.worldWidthPercent).toBeGreaterThan(100);
  });

  it("pans the camera opposite the drag direction and clamps to world edges", () => {
    expect(cameraLeftAfterDrag(29, 210, 840)).toBeCloseTo(18.5);
    expect(cameraLeftAfterDrag(29, -210, 840)).toBeCloseTo(39.5);
    expect(cameraLeftAfterDrag(1, 2000, 840)).toBe(0);
    expect(cameraLeftAfterDrag(58, -2000, 840)).toBe(58);
    expect(cameraLeftAfterDrag(10, 10, 0)).toBe(10);
  });

  it("pages the battle deck from horizontal swipes without creating missing slots", () => {
    expect(battleDeckPageAfterSwipe(0, -90, 10)).toBe(1);
    expect(battleDeckPageAfterSwipe(0, -90, 5)).toBe(0);
    expect(battleDeckPageAfterSwipe(1, 90, 10)).toBe(0);
    expect(battleDeckPageAfterSwipe(0, -20, 10)).toBe(0);
  });
});
