import { HEROES } from "../constants";
import { STAGES } from "../stages";
import { SHARD_VALUE, type SummonStorageItem, type SummonGrade } from "./summon";

const heroIds = new Set(HEROES.map((hero) => hero.id));

export function savedIds(value: unknown, allowed: ReadonlySet<string> = heroIds, limit = Infinity): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && allowed.has(id)))].slice(0, limit);
}

export function savedCounts(value: unknown, max: number): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, count]) => heroIds.has(id) && typeof count === "number" && Number.isInteger(count) && count >= 0).map(([id, count]) => [id, Math.min(count as number, max)]));
}

export function savedClears(value: unknown): number[] {
  return Array.isArray(value) ? [...new Set(value.filter((stage): stage is number => typeof stage === "number" && Number.isInteger(stage) && stage >= 1 && stage <= STAGES.length))].sort((a, b) => a - b) : [];
}

export function savedSummons(value: unknown): SummonStorageItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  return value.filter((item): item is SummonStorageItem => {
    if (!item || typeof item !== "object" || !Number.isSafeInteger(item.uid) || item.uid < 0 || seen.has(item.uid) || !heroIds.has(item.heroId) || item.heroId === "devWukong" || !Object.prototype.hasOwnProperty.call(SHARD_VALUE, item.grade as SummonGrade)) return false;
    seen.add(item.uid);
    return true;
  });
}

export function savedNonnegative(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}
