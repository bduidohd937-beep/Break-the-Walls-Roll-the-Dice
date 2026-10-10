import { ENEMY_MAP, WAVE_ATK_SCALE, WAVE_HP_SCALE } from "../constants";
import { STAGE_ATK_SCALE, STAGE_HP_SCALE } from "../stages";
import type { Unit, Wave, WaveMeta } from "../types";
import { makeUnit } from "../units/createUnit";

/** Temporary global field cap for ordinary enemies. This is a test value, not balance policy. */
export const ENEMY_FIELD_CAP = 30;

type SpawnWaveEnemyInput = {
  stageIndex: number;
  waveIndex: number;
  wave: Wave | undefined;
  waveMeta: WaveMeta | undefined;
  spawnedInWave: number;
  spawnTimer: number;
  activeEnemyCount?: number;
  enemyFieldCap?: number;
  uid: number;
  random?: () => number;
};

export type SpawnWaveEnemyResult = {
  enemy?: Unit;
  totalInWave: number;
  spawnedInWave: number;
  spawnTimer: number;
};

export function spawnWaveEnemy(input: SpawnWaveEnemyInput): SpawnWaveEnemyResult {
  const totalInWave = input.wave?.reduce((sum, group) => sum + group.count, 0) ?? 0;
  const enemyFieldCap = input.enemyFieldCap ?? ENEMY_FIELD_CAP;
  if ((input.activeEnemyCount ?? 0) >= enemyFieldCap) {
    return { totalInWave, spawnedInWave: input.spawnedInWave, spawnTimer: input.spawnTimer };
  }
  if (!input.wave || input.spawnedInWave >= totalInWave || input.spawnTimer > 0) {
    return { totalInWave, spawnedInWave: input.spawnedInWave, spawnTimer: input.spawnTimer };
  }

  const sequence = input.wave.flatMap((group) => Array.from({ length: group.count }, () => group));
  const group = sequence[input.spawnedInWave];
  const baseEnemy = ENEMY_MAP[group.enemy];
  const hpScale = 1 + input.stageIndex * STAGE_HP_SCALE + input.waveIndex * WAVE_HP_SCALE + (input.waveMeta?.boss ? 0.35 : 0);
  const atkScale = 1 + input.stageIndex * STAGE_ATK_SCALE + input.waveIndex * WAVE_ATK_SCALE + (input.waveMeta?.boss ? 0.15 : 0);
  const enemyDef = {
    ...baseEnemy,
    hp: Math.round(baseEnemy.hp * hpScale),
    atk: Math.round(baseEnemy.atk * atkScale)
  };
  const random = input.random ?? Math.random;
  const enemy = makeUnit(enemyDef, "enemy", 90 + random() * 4, input.uid, random);

  return {
    enemy,
    totalInWave,
    spawnedInWave: input.spawnedInWave + 1,
    spawnTimer: group.gap ?? 0.8
  };
}
