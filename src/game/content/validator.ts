import type { EnemyKey, SpriteConfig, StageDef, UnitDef } from "../types";

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
  const validGroundOffset = (value: number | undefined, frameSize: number, allowNegative = false) => value === undefined || (Number.isFinite(value) && (allowNegative ? Math.abs(value) <= frameSize : value >= 0 && value <= frameSize));
  if (!validGroundOffset(config.groundOffsetX, config.frameWidth, true)) issue(issues, path, "groundOffsetX must fit within the source frame");
  if (!validGroundOffset(config.groundOffsetY, config.frameHeight)) issue(issues, path, "groundOffsetY must fit within the source frame");
  for (const [name, animation] of Object.entries(config.animations)) {
    if (!animation) continue;
    if (!Number.isInteger(animation.frameCount) || animation.frameCount <= 0 || !finitePositive(animation.fps)) issue(issues, `${path}.${name}`, "invalid animation metadata");
    if (![animation.pivotX, animation.pivotY].every((value) => value === undefined || (Number.isFinite(value) && value >= 0 && value <= 1))) issue(issues, `${path}.${name}`, "animation pivot must be between 0 and 1");
    if (!validGroundOffset(animation.groundOffsetX, config.frameWidth, true)) issue(issues, `${path}.${name}`, "groundOffsetX must fit within the source frame");
    if (!validGroundOffset(animation.groundOffsetY, config.frameHeight)) issue(issues, `${path}.${name}`, "groundOffsetY must fit within the source frame");
    for (const key of ["impactFrame", "projectileSpawnFrame", "skillEventFrame"] as const) if (animation[key] !== undefined && (!Number.isInteger(animation[key]) || animation[key]! < 0 || animation[key]! >= animation.frameCount)) issue(issues, `${path}.${name}.${key}`, "frame is outside animation");
  }
}

export function validateUnitRegistry(
  heroes: readonly UnitDef[],
  enemies: readonly UnitDef[],
  stages: readonly StageDef[],
  abilityIds: ReadonlySet<string>,
  enemyMap: Readonly<Record<EnemyKey, UnitDef>>,
  bossEnemyKeys: Readonly<Partial<Record<number, EnemyKey>>>,
  spriteConfigs: Readonly<Record<string, SpriteConfig>>
) {
  const issues: ContentValidationIssue[] = [];
  const ids = new Set<string>();
  const validate = (units: readonly UnitDef[], label: string) => {
    units.forEach((unit, index) => {
      const path = `${label}[${index}]`;
      if (ids.has(unit.id)) issue(issues, path, `duplicate unit id ${unit.id}`);
      ids.add(unit.id);
      if (["test_", "dev_", "debug_"].some((prefix) => unit.id.startsWith(prefix))) issue(issues, path, "test content leaked into production");
      if (!["neutral", "dark", "fire"].includes(unit.element)) issue(issues, path, "invalid element");
      if (!["melee", "ranged"].includes(unit.rangeType) || !finitePositive(unit.hp) || !finitePositive(unit.atk)) issue(issues, path, "invalid unit stats");
      for (const id of unit.abilityIds ?? []) if (!abilityIds.has(id)) issue(issues, path, `unknown ability ${id}`);
      validateSpriteConfig(unit, path, issues);
      if (label === "heroes" && unit.spriteConfig && spriteConfigs[unit.id] !== unit.spriteConfig) issue(issues, path, `sprite config does not resolve for ${unit.id}`);
      const bounds = unit.gameplayBounds;
      if (bounds && (![bounds.width, bounds.height].every(finitePositive) || (bounds.collisionRadius !== undefined && !finitePositive(bounds.collisionRadius)))) issue(issues, path, "invalid gameplay bounds");
    });
  };
  validate(heroes, "heroes");
  validate(enemies, "enemies");

  const mappedEnemyIds = new Set<string>();
  for (const [key, enemy] of Object.entries(enemyMap)) {
    if (!enemies.includes(enemy)) issue(issues, `enemyMap.${key}`, `unknown enemy definition ${enemy.id}`);
    if (mappedEnemyIds.has(enemy.id)) issue(issues, `enemyMap.${key}`, `duplicate enemy mapping ${enemy.id}`);
    mappedEnemyIds.add(enemy.id);
  }
  enemies.forEach((enemy, index) => {
    if (!mappedEnemyIds.has(enemy.id)) issue(issues, `enemies[${index}]`, `missing enemy mapping for ${enemy.id}`);
  });
  stages.forEach((stage, index) => {
    stage.waves.flat().forEach((wave) => {
      if (!enemyMap[wave.enemy]) issue(issues, `stages[${index}]`, `unknown stage enemy ${wave.enemy}`);
    });
    const summonEnemy = stage.bossMechanic?.summonEnemy;
    if (summonEnemy && !enemyMap[summonEnemy]) issue(issues, `stages[${index}].bossMechanic`, `unknown summon enemy ${summonEnemy}`);
  });

  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  for (const [rawStageId, enemyKey] of Object.entries(bossEnemyKeys)) {
    const stageId = Number(rawStageId);
    const stage = stageById.get(stageId);
    if (!stage) issue(issues, `bossEnemyKeys.${rawStageId}`, `unknown boss stage ${rawStageId}`);
    else if (stage.type !== "boss" || !stage.waveMeta.some((wave) => wave.boss)) issue(issues, `bossEnemyKeys.${rawStageId}`, `stage ${rawStageId} has no boss wave`);
    if (enemyKey && !enemyMap[enemyKey]) issue(issues, `bossEnemyKeys.${rawStageId}`, `unknown boss enemy ${enemyKey}`);
  }
  stages.forEach((stage, index) => {
    if (stage.type === "boss" && !bossEnemyKeys[stage.id]) issue(issues, `stages[${index}]`, `missing boss enemy mapping for stage ${stage.id}`);
  });

  for (const [id] of Object.entries(spriteConfigs)) {
    const hero = heroes.find((candidate) => candidate.id === id);
    if (!hero) issue(issues, `spriteConfigs.${id}`, `unknown hero sprite reference ${id}`);
    else if (hero.spriteConfig !== spriteConfigs[id]) issue(issues, `spriteConfigs.${id}`, `sprite config is not registered on hero ${id}`);
  }
  return issues;
}

export function assertValidContent(issues: readonly ContentValidationIssue[]) { if (issues.length) throw new Error(issues.map((entry) => `${entry.path}: ${entry.message}`).join("\n")); }
