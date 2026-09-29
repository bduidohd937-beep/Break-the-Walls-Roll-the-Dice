import { describe, expect, it } from "vitest";
import { getAttackPresentationElapsed, isAttackPresentationActive } from "./attackPresentation";

const state = (overrides: Partial<Parameters<typeof isAttackPresentationActive>[0]> = {}) => ({
  attackInterval: 1,
  attackAnimationTimer: 0.9,
  animationDuration: 0.4,
  inRange: true,
  ...overrides
});

describe("attack presentation", () => {
  it("ends the attack pose when its clip ends, even if cooldown remains", () => {
    expect(isAttackPresentationActive(state({ attackAnimationTimer: 0.61 }))).toBe(true);
    expect(isAttackPresentationActive(state({ attackAnimationTimer: 0.59 }))).toBe(false);
  });

  it("does not show an attack pose while moving or outside its recorded range", () => {
    expect(isAttackPresentationActive(state({ moving: true }))).toBe(false);
    expect(isAttackPresentationActive(state({ inRange: false }))).toBe(false);
  });

  it("stops attack presentation when a hit or knockback interrupts it", () => {
    expect(isAttackPresentationActive(state({ interrupted: true }))).toBe(false);
  });

  it("measures visual elapsed time from the simulation timer", () => {
    expect(getAttackPresentationElapsed(1.2, 0.7)).toBeCloseTo(0.5);
  });
});
