import { describe, expect, it } from "vitest";
import { HEROES, ENEMIES } from "../constants";
import { STAGES } from "../stages";
import { ABILITY_IDS } from "../combat/abilities/definitions";
import { assertValidContent, validateUnitRegistry } from "./validator";
import type { UnitDef } from "../types";

const abilityIds = new Set(Object.values(ABILITY_IDS));
describe("production content validation", () => {
  it("passes current production registries", () => assertValidContent(validateUnitRegistry(HEROES, ENEMIES, STAGES, abilityIds)));
  it("rejects duplicate ids and production test leaks", () => {
    const duplicate = { ...HEROES[0], id: "test_leak" };
    expect(validateUnitRegistry([duplicate, duplicate], ENEMIES, [], abilityIds).length).toBeGreaterThan(1);
  });
  it("rejects invalid sprite metadata and bounds", () => {
    const invalid: UnitDef = { ...HEROES[0], id: "invalid", spriteConfig: { frameWidth: 0, frameHeight: 96, scale: 1, pivotX: 2, pivotY: 0, animations: { attack: { asset: "x", frameCount: 2, fps: 10, loop: false, impactFrame: 2 } } }, gameplayBounds: { width: -1, height: 1 } };
    expect(validateUnitRegistry([invalid], [], [], abilityIds).length).toBeGreaterThan(0);
  });
  it("rejects unknown ability and stage references", () => {
    const invalid = { ...HEROES[0], id: "invalid", abilityIds: ["missing"] };
    const issues = validateUnitRegistry([invalid], ENEMIES, [{ ...STAGES[0], waves: [[{ enemy: "missing" as never, count: 1 }]] }], abilityIds);
    expect(issues.some((entry) => entry.message.includes("unknown ability"))).toBe(true);
    expect(issues.some((entry) => entry.message.includes("unknown stage enemy"))).toBe(true);
  });
});
