import type { StageDef, UnitDef } from "../types";
import type { AbilityDefinition } from "../combat/abilities/types";

export type ContentValidationIssue = { path: string; message: string };
const issue = (issues: ContentValidationIssue[], path: string, message: string) => issues.push({ path, message });
const finitePositive = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0;

export function validateSpriteConfig(unit: UnitDef, path: string, issues: ContentValidationIssue[]) {
  const config = unit.spriteConfig;
  if (!config) return;
  if (!finitePositive(config.frameWidth)) issue(issues, path, "frameWidth must be positive");
  if (!finitePositive(config.frameHeight)) issue(issues, path, "frameHeight must be positive");
  if (!finitePositive(config.scale)) issue(issues, path, "scale must be positive");
  if (![config.pivotX, config.pivotY].every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1)) issue(issues, path, "pivot must be between 0 and 1");
  for (const [name, animation] of Object.entries(config.animations)) {
    if (!animation) continue;
    if (!Number.isInteger(animation.frameCount) || animation.frameCount <= 0 || !finitePositive(animation.fps)) issue(issues, `${path}.${name}`, "invalid animation metadata");
    for (const key of ["impactFrame", "projectileSpawnFrame", "skillEventFrame"] as const) if (animation[key] !== undefined && (!Number.isInteger(animation[key]) || animation[key]! < 0 || animation[key]! >= animation.frameCount)) issue(issues, `${path}.${name}.${key}`, "frame is outside animation");
  }
}

export function validateUnitRegistry(heroes: readonly UnitDef[], enemies: readonly UnitDef[], stages: readonly StageDef[], abilityIds: ReadonlySet<string>) {
  const issues: ContentValidationIssue[] = [];
  const validate = (units: readonly UnitDef[], label: string) => {
    const ids = new Set<string>();
    units.forEach((unit, index) => {
      const path = `${label}[${index}]`;
      if (ids.has(unit.id)) issue(issues, path, `duplicate unit id ${unit.id}`);
      ids.add(unit.id);
      if (["test_", "dev_", "debug_"].some((prefix) => unit.id.startsWith(prefix))) issue(issues, path, "test content leaked into production");
      if (!["neutral", "dark", "fire"].includes(unit.element)) issue(issues, path, "invalid element");
      if (!["melee", "ranged"].includes(unit.rangeType) || !finitePositive(unit.hp) || !finitePositive(unit.atk)) issue(issues, path, "invalid unit stats");
      for (const id of unit.abilityIds ?? []) if (!abilityIds.has(id)) issue(issues, path, `unknown ability ${id}`);
      validateSpriteConfig(unit, path, issues);
      const bounds = unit.gameplayBounds;
      if (bounds && (![bounds.width, bounds.height].every(finitePositive) || (bounds.collisionRadius !== undefined && !finitePositive(bounds.collisionRadius)))) issue(issues, path, "invalid gameplay bounds");
    });
  };
  validate(heroes, "heroes");
  validate(enemies, "enemies");
  const enemyIds = new Set(enemies.map((unit) => unit.id));
  stages.forEach((stage, index) => stage.waves.flat().forEach((wave) => { if (!enemyIds.has(`${wave.enemy}E`)) issue(issues, `stages[${index}]`, `unknown stage enemy ${wave.enemy}`); }));
  return issues;
}

export function assertValidContent(issues: readonly ContentValidationIssue[]) { if (issues.length) throw new Error(issues.map((entry) => `${entry.path}: ${entry.message}`).join("\n")); }
