import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import type { Unit, UnitDef } from "./game/types";
import { HEROES, DECK_IDS, ENEMY_MAP, WAVE_HP_SCALE, WAVE_ATK_SCALE, SUMMON_GEM_COST, INITIAL_GEMS, MOVE_SPEED_MULTIPLIER, ELEMENT_CLASS, ELEMENT_LABEL, clamp } from "./game/constants";
import { STAGES, STAGE_HP_SCALE, STAGE_ATK_SCALE } from "./game/stages";
import { makeUnit } from "./game/units/createUnit";
import { applyKnockback, updateKnockback } from "./game/combat/knockback";
import { incomingDamage, outgoingDamage, regenAmount } from "./game/combat/damage";
import { resolveSameTeamSpacing, resolveFrontlineCollision } from "./game/combat/collision";
import { BattleUnit } from "./components/BattleUnit";

type DamagePopup = { id: number; x: number; value: number; critical: boolean; };
type SummonGrade = "일반" | "희귀" | "영웅" | "전설" | "신화" | "초월";
type SummonStorageItem = { uid: number; heroId: string; grade: SummonGrade; };
type DeathEffect = { id: number; x: number; team: "hero" | "enemy"; life: number; };

function App() {
  const [stageIndex, setStageIndex] = useState(0);
  const [unlockedStage, setUnlockedStage] = useState(() => {
    const saved = Number(window.localStorage.getItem("btw-unlocked-stage") ?? "1");
    return clamp(Math.floor(saved) || 1, 1, STAGES.length);
  });
  const [kingdomGold, setKingdomGold] = useState(() => Number(window.localStorage.getItem("btw-kingdom-gold") ?? "0"));
  const [gems, setGems] = useState(() => {
    const saved = Number(window.localStorage.getItem("btw-gems") ?? String(INITIAL_GEMS));
    const devGems = Math.max(saved, 999999);
    window.localStorage.setItem("btw-gems", String(devGems));
    return devGems;
  });
  const [unitLevels, setUnitLevels] = useState<Record<string, number>>(() => {
    try { const saved = JSON.parse(window.localStorage.getItem("btw-unit-levels") ?? "{}"); return saved && typeof saved === "object" ? saved : {}; } catch { return {}; }
  });
  const [clearedStages, setClearedStages] = useState<number[]>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("btw-cleared-stages") ?? "[]");
      return Array.isArray(saved) ? saved.filter((value) => Number.isInteger(value)) : [];
    } catch {
      return [];
    }
  });
  const [battleGold, setBattleGold] = useState(300);
  const [economyLevel, setEconomyLevel] = useState(1);
  const [waveIndex, setWaveIndex] = useState(0);
  const [heroes, setHeroes] = useState<Unit[]>([]);
  const [enemies, setEnemies] = useState<Unit[]>([]);
  const [castleHp, setCastleHp] = useState(1000);
  const [enemyCastleHp, setEnemyCastleHp] = useState(1800);
  const [castleHit, setCastleHit] = useState<"our" | "enemy" | null>(null);
  const [damagePopups, setDamagePopups] = useState<DamagePopup[]>([]);
  const [deathEffects, setDeathEffects] = useState<DeathEffect[]>([]);
  const popupUidRef = useRef(1);
  const deathUidRef = useRef(1);
  const [battleState, setBattleState] = useState<"stageSelect" | "playing" | "victory" | "defeat">("stageSelect");
  const [deckIds, setDeckIds] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("btw-deck-ids") ?? "[]");
      return Array.isArray(saved) && saved.every((id) => typeof id === "string") && saved.length > 0 ? saved : DECK_IDS.slice(0, 5);
    } catch { return DECK_IDS.slice(0, 5); }
  });
  const [deckEditMode, setDeckEditMode] = useState(false);
  const [mainTab, setMainTab] = useState<"home" | "gather" | "battle" | "heroes" | "summon" | "storage" | "fusion">("home");
  const [kingdomLevel, setKingdomLevel] = useState(() => Math.max(1, Number(window.localStorage.getItem("btw-kingdom-level") ?? "1")));
  const [facilityLevels, setFacilityLevels] = useState<Record<"lumber" | "quarry" | "vault" | "training", number>>(() => {
    try { const saved = JSON.parse(window.localStorage.getItem("btw-facility-levels") ?? "{}"); return { lumber: Math.max(1, Number(saved.lumber) || 1), quarry: Math.max(1, Number(saved.quarry) || 1), vault: Math.max(1, Number(saved.vault) || 1), training: Math.max(1, Number(saved.training) || 1) }; } catch { return { lumber: 1, quarry: 1, vault: 1, training: 1 }; }
  });
  const [ownedHeroes, setOwnedHeroes] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("btw-owned-heroes") ?? "[]");
      return Array.isArray(saved) && saved.every((id) => typeof id === "string") && saved.length > 0 ? saved : DECK_IDS.slice(0, 5);
    } catch { return DECK_IDS.slice(0, 5); }
  });
  const [summonOpen, setSummonOpen] = useState(false);
  const [resources, setResources] = useState<{ wood: number; stone: number }>(() => {
    try { const saved = JSON.parse(window.localStorage.getItem("btw-resources") ?? "{}"); return { wood: Math.max(0, Number(saved.wood) || 0), stone: Math.max(0, Number(saved.stone) || 0) }; } catch { return { wood: 0, stone: 0 }; }
  });
  const [workers, setWorkers] = useState<{ wood?: string; stone?: string }>(() => {
    try { const saved = JSON.parse(window.localStorage.getItem("btw-workers") ?? "{}"); return saved && typeof saved === "object" ? saved : {}; } catch { return {}; }
  });
  const [offlineGather, setOfflineGather] = useState<{ wood: number; stone: number; seconds: number } | null>(null);
  const gatherLastSeenRef = useRef(Date.now());
  const [summonMessage, setSummonMessage] = useState("");
  const [summonStorage, setSummonStorage] = useState<SummonStorageItem[]>(() => {
    try { const saved = JSON.parse(window.localStorage.getItem("btw-summon-storage") ?? "[]"); return Array.isArray(saved) ? saved : []; } catch { return []; }
  });
  const [heroSouls, setHeroSouls] = useState<Record<string, number>>(() => {
    try { const saved = JSON.parse(window.localStorage.getItem("btw-hero-souls") ?? "{}"); return saved && typeof saved === "object" ? saved : {}; } catch { return {}; }
  });
  const [soulShards, setSoulShards] = useState(() => Math.max(0, Number(window.localStorage.getItem("btw-soul-shards") ?? "0")));
  const [transcendShards, setTranscendShards] = useState(() => Math.max(0, Number(window.localStorage.getItem("btw-transcend-shards") ?? "0")));
  const [fusionRecords, setFusionRecords] = useState<string[]>(() => {
    try { const saved = JSON.parse(window.localStorage.getItem("btw-fusion-records") ?? "[]"); return Array.isArray(saved) ? saved : []; } catch { return []; }
  });
  const summonUidRef = useRef(Date.now());
  const [legendPity, setLegendPity] = useState(() => Math.max(0, Number(window.localStorage.getItem("btw-legend-pity") ?? "0")));
  const [mythPity, setMythPity] = useState(() => Math.max(0, Number(window.localStorage.getItem("btw-myth-pity") ?? "0")));
  const [summonSequence, setSummonSequence] = useState<SummonStorageItem[]>([]);
  const [summonRevealIndex, setSummonRevealIndex] = useState(0);
  const [summonSummaryOpen, setSummonSummaryOpen] = useState(false);
  const [lastSummonResults, setLastSummonResults] = useState<SummonStorageItem[]>([]);
  const [summonPhase, setSummonPhase] = useState<"idle" | "throw" | "impact" | "crack" | "reveal">("idle");
  const [selectedHeroId, setSelectedHeroId] = useState(DECK_IDS[0]);
  const [heroMode, setHeroMode] = useState<"formation" | "upgrade">("formation");
  const [dragHeroId, setDragHeroId] = useState<string | null>(null);
  const [formationPage, setFormationPage] = useState<0 | 1>(0);
  const formationTouchY = useRef<number | null>(null);
  const [gatherHp, setGatherHp] = useState({ wood: 10, stone: 14 });
  const [gatherHit, setGatherHit] = useState<"wood" | "stone" | null>(null);
  const [gatherRegion, setGatherRegion] = useState<"basic" | "ancient" | "crystal">("basic");
  const gatherMaxHp = { wood: 10, stone: 14 };
  const gatherReward = { wood: 4, stone: 3 };
  const [notice, setNotice] = useState("전투 시작!");
  const [nextUid, setNextUid] = useState(1);
  const [gameSpeed, setGameSpeed] = useState(5);
  const [deployCooldowns, setDeployCooldowns] = useState<Record<string, number>>({});
  const deckSlotCount = 10;
  const visibleDeck = useMemo(() => deckIds.map((id) => HEROES.find((hero) => hero.id === id)).filter(Boolean) as UnitDef[], [deckIds]);
  const economyMaxLevel = 8;
  const battleGoldMax = 1000 + (facilityLevels.vault - 1) * 250 + (economyLevel - 1) * 1250;
  const goldPerSecond = 18 + (economyLevel - 1) * 9;
  const trainingBonus = 1 + (facilityLevels.training - 1) * 0.02;
  const battleStartGold = 300 + (facilityLevels.vault - 1) * 50;
  const economyUpgradeCost = economyLevel >= economyMaxLevel ? 0 : 120 + (economyLevel - 1) * 100;

  const kingdomUpgradeCost = 400 * kingdomLevel;
  const kingdomProductionBonus = 1 + Math.floor((kingdomLevel - 1) / 2) * 0.25;
  const kingdomSellBonus = 1 + Math.floor((kingdomLevel - 1) / 3) * 0.1;
  const kingdomUnlocks = [
    { level: 1, icon: "🪚", title: "기초 생산", text: "벌목장 · 채석장 운영" },
    { level: 2, icon: "🏦", title: "왕국 금고", text: "전투 시작 골드와 최대 골드 확장" },
    { level: 3, icon: "🏋️", title: "훈련소", text: "출전 영웅 HP / ATK 강화" },
    { level: 4, icon: "🌲", title: "생산 확장", text: "자동채집 생산 보너스 강화" },
    { level: 5, icon: "⚗️", title: "고급 성장", text: "합성·성장 시설 확장 기반" },
    { level: 6, icon: "👑", title: "왕국 2단계", text: "생산·판매 보너스 상위 단계" }
  ];
  const nextKingdomUnlock = kingdomUnlocks.find((entry) => entry.level > kingdomLevel);
  const kingdomMilestone = nextKingdomUnlock ? `Lv.${nextKingdomUnlock.level} · ${nextKingdomUnlock.title}` : "현재 준비된 왕국 해금 완료";
  const facilityDefs = {
    lumber: { name: "벌목장", icon: "🪚", unlock: 1, baseCost: 180, text: (lv: number) => `배치 영웅 목재 자동채집 +${lv} / 3초` },
    quarry: { name: "채석장", icon: "⛏️", unlock: 1, baseCost: 180, text: (lv: number) => `배치 영웅 석재 자동채집 +${lv} / 3초` },
    vault: { name: "왕국 금고", icon: "🏦", unlock: 2, baseCost: 300, text: (lv: number) => `전투 시작 골드 +${(lv - 1) * 50} · 기본 최대 골드 +${(lv - 1) * 250}` },
    training: { name: "훈련소", icon: "🏋️", unlock: 3, baseCost: 360, text: (lv: number) => `출전 영웅 HP / ATK +${(lv - 1) * 2}%` }
  } as const;
  type FacilityKey = keyof typeof facilityDefs;
  const facilityUpgradeCost = (type: FacilityKey) => facilityDefs[type].baseCost * facilityLevels[type];
  const upgradeKingdom = () => {
    if (kingdomGold < kingdomUpgradeCost) return;
    const nextLevel = kingdomLevel + 1;
    const nextGold = kingdomGold - kingdomUpgradeCost;
    setKingdomLevel(nextLevel);
    setKingdomGold(nextGold);
    window.localStorage.setItem("btw-kingdom-level", String(nextLevel));
    window.localStorage.setItem("btw-kingdom-gold", String(nextGold));
  };
  const upgradeFacility = (type: FacilityKey) => {
    const cost = facilityUpgradeCost(type);
    if (kingdomGold < cost) return;
    const next = { ...facilityLevels, [type]: facilityLevels[type] + 1 };
    const nextGold = kingdomGold - cost;
    setFacilityLevels(next);
    setKingdomGold(nextGold);
    window.localStorage.setItem("btw-facility-levels", JSON.stringify(next));
    window.localStorage.setItem("btw-kingdom-gold", String(nextGold));
  };

  const saveResources = (next: { wood: number; stone: number }) => {
    setResources(next);
    window.localStorage.setItem("btw-resources", JSON.stringify(next));
  };
  const gatherRegions = {
    basic: { name: "왕국 외곽", icon: "🌿", scale: 1, unlockStage: 0, description: "기본 채집 지역" },
    ancient: { name: "고대 숲", icon: "🌲", scale: 2, unlockStage: 2, description: "강화 자원 · 2배 보상" },
    crystal: { name: "수정 광산", icon: "💎", scale: 3, unlockStage: 4, description: "단단한 자원 · 3배 보상" }
  } as const;
  type GatherRegionKey = keyof typeof gatherRegions;
  const activeGatherRegion = gatherRegions[gatherRegion as GatherRegionKey];
  const gatherRegionScale = activeGatherRegion.scale;
  const isGatherRegionUnlocked = (key: GatherRegionKey) => gatherRegions[key].unlockStage === 0 || clearedStages.includes(gatherRegions[key].unlockStage);
  const getGatherAttackDamage = (type: "wood" | "stone") => {
    const heroId = workers[type];
    const hero = heroId ? HEROES.find((unit) => unit.id === heroId) : undefined;
    const baseDamage = type === "wood" ? 2 : 3;
    if (!hero) return baseDamage;
    const levelScale = getLevelMultiplier(hero.id);
    const attackContribution = Math.max(1, Math.floor((hero.atk * levelScale) / 55));
    return baseDamage + attackContribution;
  };
  const gatherResource = (type: "wood" | "stone") => {
    setGatherHit(type);
    window.setTimeout(() => setGatherHit((current) => current === type ? null : current), 140);
    setGatherHp((current) => {
      const damage = getGatherAttackDamage(type);
      const scaledMaxHp = gatherMaxHp[type] * gatherRegionScale;
      const effectiveHp = Math.min(current[type], scaledMaxHp);
      const nextHp = Math.max(0, effectiveHp - damage);
      if (nextHp > 0) return { ...current, [type]: nextHp };
      setResources((stored) => {
        const nextResources = { ...stored, [type]: stored[type] + gatherReward[type] * gatherRegionScale };
        window.localStorage.setItem("btw-resources", JSON.stringify(nextResources));
        return nextResources;
      });
      return { ...current, [type]: gatherMaxHp[type] * gatherRegionScale };
    });
  };
  const sellResource = (type: "wood" | "stone") => {
    const amount = resources[type];
    if (amount <= 0) return;
    const unitPrice = Math.round((type === "wood" ? 5 : 8) * kingdomSellBonus);
    const next = { ...resources, [type]: 0 };
    saveResources(next);
    setKingdomGold((gold) => {
      const value = gold + Math.round(amount * unitPrice);
      window.localStorage.setItem("btw-kingdom-gold", String(value));
      return value;
    });
  };
  const assignWorker = (type: "wood" | "stone", heroId: string) => {
    const next = { ...workers };
    for (const key of ["wood", "stone"] as const) if (next[key] === heroId) delete next[key];
    if (workers[type] === heroId) delete next[type]; else next[type] = heroId;
    setWorkers(next);
    window.localStorage.setItem("btw-workers", JSON.stringify(next));
    const now = Date.now();
    gatherLastSeenRef.current = now;
    window.localStorage.setItem("btw-gather-last-seen", String(now));
  };

  const getUnitLevel = (id: string) => Math.max(1, unitLevels[id] ?? 1);
  const getHeroGrade = (id: string) => {
    const index = DECK_IDS.indexOf(id);
    if (index <= 5) return { name: "일반", multiplier: 1 };
    if (index <= 11) return { name: "희귀", multiplier: 1.6 };
    if (index <= 15) return { name: "영웅", multiplier: 2.5 };
    if (index <= 17) return { name: "전설", multiplier: 4 };
    if (index === 18) return { name: "신화", multiplier: 6 };
    return { name: "초월", multiplier: 9 };
  };
  const getGradeGrowth = (id: string) => {
    const grade = getHeroGrade(id).name;
    const perLevel: Record<string, number> = { "일반": 0.07, "희귀": 0.075, "영웅": 0.08, "전설": 0.085, "신화": 0.09, "초월": 0.10 };
    return perLevel[grade] ?? 0.08;
  };
  const getLevelMultiplier = (id: string, level = getUnitLevel(id)) => 1 + (level - 1) * getGradeGrowth(id);
  const getUpgradeCost = (id: string) => getUnitLevel(id) >= 10 ? 0 : Math.round(150 * getUnitLevel(id) * getHeroGrade(id).multiplier);
  const getHeroPower = (def: UnitDef, level = getUnitLevel(def.id)) => {
    const levelMultiplier = getLevelMultiplier(def.id, level);
    const soul = getSoulBonuses(def.id);
    const hp = def.hp * levelMultiplier * soul.hp;
    const atk = def.atk * levelMultiplier * soul.atk;
    const interval = Math.max(0.25, def.attackInterval * soul.speed);
    return Math.round(hp * 0.35 + (atk / interval) * 12);
  };
  const getHeroTrait = (def: UnitDef) => {
    if (def.ability === "guard") return { name: "가드", text: `받는 피해 ${Math.round((def.abilityValue ?? 0) * 100)}% 감소` };
    if (def.ability === "crit") return { name: "치명타", text: `치명타 확률 ${Math.round((def.abilityValue ?? 0) * 100)}%` };
    if (def.ability === "regen") return { name: "재생", text: `전투 중 지속 회복 ${((def.abilityValue ?? 0) * 100).toFixed(1)}%` };
    if (def.ability === "execute") return { name: "처형", text: `체력이 낮은 적에게 처형 판정 ${Math.round((def.abilityValue ?? 0) * 100)}%` };
    if (def.effect === "burn") return { name: "화상", text: "공격 적중 시 화상 피해" };
    if (def.attackType === "splash") return { name: "광역 공격", text: `주 대상 주변 ${def.splashRadius ?? 0} 범위 공격` };
    return { name: "기본 공격", text: def.rangeType === "ranged" ? "안전한 거리에서 단일 대상을 공격" : "전열에서 단일 대상을 공격" };
  };
  const getGatherEfficiency = (heroId?: string) => {
    if (!heroId) return 1;
    const levelBonus = 1 + (getUnitLevel(heroId) - 1) * 0.03;
    const grade = getHeroGrade(heroId).name;
    const gradeBonus: Record<string, number> = { "일반": 1, "희귀": 1.08, "영웅": 1.16, "전설": 1.25, "신화": 1.35, "초월": 1.5 };
    return levelBonus * (gradeBonus[grade] ?? 1);
  };
  const getAutoGatherAmount = (type: "wood" | "stone") => {
    const heroId = workers[type];
    if (!heroId) return 0;
    const facilityLevel = type === "wood" ? facilityLevels.lumber : facilityLevels.quarry;
    return Math.max(1, Math.floor(facilityLevel * kingdomProductionBonus * getGatherEfficiency(heroId)));
  };

  const getSoulBonuses = (id: string) => {
    const soul = heroSouls[id] ?? 0;
    return {
      hp: 1 + (soul >= 5 ? 0.08 : 0) + (soul >= 20 ? 0.12 : 0) + (soul >= 30 ? 0.1 : 0),
      atk: 1 + (soul >= 10 ? 0.08 : 0) + (soul >= 25 ? 0.12 : 0) + (soul >= 30 ? 0.1 : 0),
      speed: 1 - (soul >= 15 ? 0.08 : 0) - (soul >= 30 ? 0.05 : 0),
    };
  };


  const upgradeUnit = (id: string) => {
    const level = getUnitLevel(id);
    const cost = getUpgradeCost(id);
    if (level >= 10 || kingdomGold < cost) return;
    const next = { ...unitLevels, [id]: level + 1 };
    setUnitLevels(next);
    setKingdomGold((gold) => {
      const nextGold = gold - cost;
      window.localStorage.setItem("btw-kingdom-gold", String(nextGold));
      return nextGold;
    });
    window.localStorage.setItem("btw-unit-levels", JSON.stringify(next));
    setNotice(`${HEROES.find((hero) => hero.id === id)?.name ?? id} 강화 Lv.${level + 1}!`);
  };

  const upgradeEconomy = () => {
    if (battleState !== "playing" || economyLevel >= economyMaxLevel || battleGold < economyUpgradeCost) return;
    const nextLevel = economyLevel + 1;
    goldRef.current = Math.max(0, goldRef.current - economyUpgradeCost);
    setBattleGold(goldRef.current);
    setEconomyLevel(nextLevel);
    setNotice(`전투 지갑 Lv.${nextLevel}! 생산속도와 최대 골드 증가`);
  };

  const deploy = useCallback((def: UnitDef) => {
    if (battleState !== "playing" || battleGold < def.cost || (deployCooldowns[def.id] ?? 0) > 0) return;
    const uid = nextUid;
    const level = getUnitLevel(def.id);
    const statMultiplier = getLevelMultiplier(def.id, level);
    const soulBonus = getSoulBonuses(def.id);
    const upgradedDef: UnitDef = {
      ...def,
      hp: Math.round(def.hp * statMultiplier * soulBonus.hp * trainingBonus),
      atk: Math.round(def.atk * statMultiplier * soulBonus.atk * trainingBonus),
      attackInterval: Math.max(0.25, Number((def.attackInterval * soulBonus.speed).toFixed(3)))
    };
    setNextUid((v) => v + 1);
    goldRef.current = Math.max(0, goldRef.current - def.cost);
    setBattleGold(goldRef.current);
    setDeployCooldowns((cooldowns) => ({ ...cooldowns, [def.id]: def.cooldown }));
    setHeroes((list) => [...list, makeUnit(upgradedDef, "hero", 9 + Math.random() * 7, uid)]);
    setNotice(`${def.name} 출전!`);
  }, [battleGold, battleState, nextUid, deployCooldowns, unitLevels, heroSouls, trainingBonus]);

  const heroesRef = useRef<Unit[]>([]);
  const enemiesRef = useRef<Unit[]>([]);
  const goldRef = useRef(300);
  const castleRef = useRef(1000);
  const enemyCastleRef = useRef(STAGES[0].enemyCastleHp);
  const stageRef = useRef(0);
  const waveRef = useRef(0);
  const spawnRef = useRef(0);
  const spawnTimerRef = useRef(1.2);
  const uidRef = useRef(1);
  const finalClearNotifiedRef = useRef(false);

  useEffect(() => { heroesRef.current = heroes; }, [heroes]);
  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);
  useEffect(() => { goldRef.current = battleGold; }, [battleGold]);
  useEffect(() => { castleRef.current = castleHp; }, [castleHp]);
  useEffect(() => { enemyCastleRef.current = enemyCastleHp; }, [enemyCastleHp]);
  useEffect(() => {
    if (battleState !== "stageSelect") return;
    const now = Date.now();
    const savedLastSeen = Math.max(0, Number(window.localStorage.getItem("btw-gather-last-seen") ?? now));
    const offlineSeconds = Math.min(8 * 60 * 60, Math.max(0, Math.floor((now - savedLastSeen) / 1000)));
    const offlineTicks = Math.floor(offlineSeconds / 3);
    if (offlineTicks > 0 && (workers.wood || workers.stone)) {
      const woodGain = workers.wood ? offlineTicks * getAutoGatherAmount("wood") : 0;
      const stoneGain = workers.stone ? offlineTicks * getAutoGatherAmount("stone") : 0;
      if (woodGain || stoneGain) {
        setResources((current) => {
          const next = { wood: current.wood + woodGain, stone: current.stone + stoneGain };
          window.localStorage.setItem("btw-resources", JSON.stringify(next));
          return next;
        });
        setOfflineGather({ wood: woodGain, stone: stoneGain, seconds: offlineSeconds });
      }
    }
    gatherLastSeenRef.current = now;
    window.localStorage.setItem("btw-gather-last-seen", String(now));
    const timer = window.setInterval(() => {
      const tickNow = Date.now();
      gatherLastSeenRef.current = tickNow;
      window.localStorage.setItem("btw-gather-last-seen", String(tickNow));
      setResources((current) => {
        const next = { ...current };
        if (workers.wood) next.wood += getAutoGatherAmount("wood");
        if (workers.stone) next.stone += getAutoGatherAmount("stone");
        window.localStorage.setItem("btw-resources", JSON.stringify(next));
        return next;
      });
    }, 3000);
    return () => {
      window.clearInterval(timer);
      window.localStorage.setItem("btw-gather-last-seen", String(Date.now()));
    };
  }, [battleState, workers, facilityLevels.lumber, facilityLevels.quarry, kingdomProductionBonus]);



  useEffect(() => {
    if (battleState !== "playing") return;

    const interval = window.setInterval(() => {
      const dt = 0.05 * gameSpeed;
      setCastleHit(null);
      setDamagePopups((popups) => popups.slice(-24));
      setDeathEffects((effects) => effects.map((effect) => ({ ...effect, life: effect.life - dt })).filter((effect) => effect.life > 0));

      goldRef.current = Math.min(battleGoldMax, goldRef.current + dt * goldPerSecond);
      setBattleGold(goldRef.current);

      spawnTimerRef.current -= dt;

      setDeployCooldowns((cooldowns) => {
        const next = { ...cooldowns };
        for (const id of Object.keys(next)) next[id] = Math.max(0, next[id] - dt);
        return next;
      });

      let nextHeroes = heroesRef.current.map((u) => {
        const unit = updateKnockback({
          ...u,
          attackTimer: Math.max(0, u.attackTimer - dt),
          hitFlash: Math.max(0, u.hitFlash - dt),
          attackFlash: Math.max(0, u.attackFlash - dt),
        }, dt);
        const healed = Math.min(unit.hp, unit.currentHp + regenAmount(unit, dt));
        if (unit.burnTimer <= 0) return { ...unit, currentHp: healed };
        const burnTick = Math.min(unit.burnTimer, dt);
        return {
          ...unit,
          currentHp: Math.max(0, healed - unit.burnDamage * burnTick),
          burnTimer: Math.max(0, unit.burnTimer - dt),
        };
      });

      let nextEnemies = enemiesRef.current.map((u) => {
        const unit = updateKnockback({
          ...u,
          attackTimer: Math.max(0, u.attackTimer - dt),
          hitFlash: Math.max(0, u.hitFlash - dt),
          attackFlash: Math.max(0, u.attackFlash - dt),
        }, dt);
        if (unit.burnTimer <= 0) return unit;
        const burnTick = Math.min(unit.burnTimer, dt);
        return {
          ...unit,
          currentHp: Math.max(0, unit.currentHp - unit.burnDamage * burnTick),
          burnTimer: Math.max(0, unit.burnTimer - dt),
        };
      });

      // Spawn the current wave with gentle per-wave scaling.
      const stage = STAGES[stageRef.current];
      const wave = stage.waves[waveRef.current];
      const waveMeta = stage.waveMeta[waveRef.current];
      const totalInWave = wave?.reduce((sum, group) => sum + group.count, 0) ?? 0;
      if (wave && spawnRef.current < totalInWave && spawnTimerRef.current <= 0) {
        const sequence = wave.flatMap((group) => Array.from({ length: group.count }, () => group));
        const group = sequence[spawnRef.current];
        const baseEnemy = ENEMY_MAP[group.enemy];
        const hpScale = 1 + stageRef.current * STAGE_HP_SCALE + waveRef.current * WAVE_HP_SCALE + (waveMeta?.boss ? 0.35 : 0);
        const atkScale = 1 + stageRef.current * STAGE_ATK_SCALE + waveRef.current * WAVE_ATK_SCALE + (waveMeta?.boss ? 0.15 : 0);
        const enemyDef = {
          ...baseEnemy,
          hp: Math.round(baseEnemy.hp * hpScale),
          atk: Math.round(baseEnemy.atk * atkScale),
        };
        const uid = 1000 + uidRef.current++;
        nextEnemies.push(makeUnit(enemyDef, "enemy", 90 + Math.random() * 4, uid));
        spawnRef.current += 1;
        spawnTimerRef.current = group.gap ?? 0.8;
      }

      // Heroes move, attack, and hit the enemy castle when the lane is clear.
      for (let i = 0; i < nextHeroes.length; i++) {
        const hero = nextHeroes[i];
        if (hero.currentHp <= 0 || hero.knockbackTimer > 0) continue;

        const livingEnemies = nextEnemies.filter((e) => e.currentHp > 0);
        const frontTarget = livingEnemies
          .filter((e) => e.x >= hero.x)
          .sort((a, b) => a.x - b.x)[0] ?? livingEnemies
          .sort((a, b) => Math.abs(a.x - hero.x) - Math.abs(b.x - hero.x))[0];
        const assassinTarget = hero.id === "assassin"
          ? livingEnemies
              .filter((e) => e.rangeType === "ranged")
              .sort((a, b) => a.currentHp - b.currentHp || a.x - b.x)[0]
          : undefined;
        const target = assassinTarget ?? frontTarget;

        if (!target) {
          nextHeroes[i] = { ...hero, x: Math.min(87, hero.x + hero.speed * MOVE_SPEED_MULTIPLIER * dt / 100) };
          if (hero.x >= 84 && hero.attackTimer <= 0) {
            const finalWaveCleared =
              waveRef.current === stage.waves.length - 1 &&
              spawnRef.current >= totalInWave &&
              nextEnemies.every((enemy) => enemy.currentHp <= 0);
            if (finalWaveCleared) {
              const damage = hero.atk * 1.8;
              enemyCastleRef.current = Math.max(0, enemyCastleRef.current - damage);
              setEnemyCastleHp(enemyCastleRef.current);
              setCastleHit("enemy");
              nextHeroes[i].attackFlash = 0.16;
              nextHeroes[i].attackTargetX = 87;
            }
            nextHeroes[i].attackTimer = hero.attackInterval;
          }
          continue;
        }

        const distance = Math.abs(target.x - hero.x);
        if (distance > hero.range / 10) {
          nextHeroes[i] = { ...hero, x: Math.min(87, hero.x + hero.speed * MOVE_SPEED_MULTIPLIER * dt / 100) };
        } else if (hero.attackTimer <= 0) {
          const damage = outgoingDamage(hero, target, hero.atk);
          const splashRadius = hero.splashRadius ?? 0;
          const hitTargets = hero.attackType === "splash"
            ? nextEnemies
                .filter((enemy) => enemy.currentHp > 0 && Math.abs(enemy.x - target.x) <= splashRadius)
                .map((enemy) => enemy.uid)
            : [target.uid];

          for (const targetUid of hitTargets) {
            const targetIndex = nextEnemies.findIndex((enemy) => enemy.uid === targetUid);
            if (targetIndex < 0) continue;

            const isPrimaryTarget = targetUid === target.uid;
            const impactAtk = hero.attackType === "splash" && !isPrimaryTarget ? hero.atk * 0.65 : hero.atk;
            const hitTarget = applyKnockback(
              nextEnemies[targetIndex],
              nextEnemies[targetIndex].currentHp - damage,
              "hero",
              impactAtk,
            );

            nextEnemies[targetIndex] = hero.effect === "burn"
              ? { ...hitTarget, burnTimer: 3, burnDamage: Math.max(hitTarget.burnDamage, hero.atk * 0.12), hitFlash: 0.14 }
              : { ...hitTarget, hitFlash: 0.14 };
            const popupId = popupUidRef.current++;
            setDamagePopups((popups) => [...popups.slice(-24), { id: popupId, x: hitTarget.x, value: Math.max(1, Math.round(damage)), critical: damage >= hero.atk * 1.9 }]);
          }
          nextHeroes[i].attackTimer = hero.attackInterval;
          nextHeroes[i].attackFlash = 0.16;
          nextHeroes[i].attackTargetX = target.x;
        }
      }

      // Enemies move, attack heroes, or damage our castle.
      for (let i = 0; i < nextEnemies.length; i++) {
        const enemy = nextEnemies[i];
        if (enemy.currentHp <= 0 || enemy.knockbackTimer > 0) continue;

        const livingHeroes = nextHeroes.filter((h) => h.currentHp > 0);
        const frontTarget = livingHeroes
          .filter((h) => h.x <= enemy.x)
          .sort((a, b) => b.x - a.x)[0] ?? livingHeroes
          .sort((a, b) => Math.abs(a.x - enemy.x) - Math.abs(b.x - enemy.x))[0];

        // Enemy roles matter: assassins dive toward fragile backliners while other enemies hold the frontline.
        const assassinTarget = enemy.id === "assassinE"
          ? livingHeroes
              .filter((h) => h.rangeType === "ranged")
              .sort((a, b) => a.currentHp - b.currentHp || b.x - a.x)[0]
          : undefined;
        const target = assassinTarget ?? frontTarget;

        if (!target) {
          if (enemy.x <= 13) {
            if (enemy.attackTimer <= 0) {
              castleRef.current = Math.max(0, castleRef.current - enemy.atk);
              setCastleHp(castleRef.current);
              setCastleHit("our");
              nextEnemies[i].attackTimer = enemy.attackInterval;
              nextEnemies[i].attackFlash = 0.16;
              nextEnemies[i].attackTargetX = 9;
            }
          } else {
            nextEnemies[i] = { ...enemy, x: Math.max(9, enemy.x - enemy.speed * MOVE_SPEED_MULTIPLIER * dt / 100) };
          }
          continue;
        }

        const distance = Math.abs(target.x - enemy.x);
        if (distance > enemy.range / 10) {
          nextEnemies[i] = { ...enemy, x: Math.max(9, enemy.x - enemy.speed * MOVE_SPEED_MULTIPLIER * dt / 100) };
        } else if (enemy.attackTimer <= 0) {
          const enragedBoss = enemy.id === "fireOgreE" && enemy.currentHp / enemy.hp <= 0.5;
          const backlinePressure = enemy.id === "assassinE" && target.rangeType === "ranged";
          const attackDamage = (enragedBoss ? enemy.atk * 1.2 : enemy.atk) * (backlinePressure ? 1.2 : 1);
          const splashRadius = enemy.splashRadius ?? 0;
          const hitTargets = enemy.attackType === "splash"
            ? nextHeroes
                .filter((heroTarget) => heroTarget.currentHp > 0 && Math.abs(heroTarget.x - target.x) <= splashRadius)
                .map((heroTarget) => heroTarget.uid)
            : [target.uid];

          for (const targetUid of hitTargets) {
            const hitIndex = nextHeroes.findIndex((heroTarget) => heroTarget.uid === targetUid);
            if (hitIndex < 0) continue;
            const damage = incomingDamage(nextHeroes[hitIndex], attackDamage);
            const isPrimaryTarget = targetUid === target.uid;
            const impactAtk = enemy.attackType === "splash" && !isPrimaryTarget ? attackDamage * 0.65 : attackDamage;
            const hitHero = applyKnockback(
              nextHeroes[hitIndex],
              nextHeroes[hitIndex].currentHp - damage,
              "enemy",
              impactAtk,
            );
            nextHeroes[hitIndex] = enemy.effect === "burn"
              ? { ...hitHero, burnTimer: 3, burnDamage: Math.max(hitHero.burnDamage, enemy.atk * 0.12), hitFlash: 0.14 }
              : hitHero;
            const popupId = popupUidRef.current++;
            setDamagePopups((popups) => [...popups.slice(-24), { id: popupId, x: nextHeroes[hitIndex].x, value: Math.max(1, Math.round(damage)), critical: false }]);
          }
          nextEnemies[i].attackTimer = enragedBoss ? enemy.attackInterval * 0.65 : enemy.attackInterval;
          nextEnemies[i].attackFlash = enragedBoss ? 0.22 : 0.16;
          nextEnemies[i].attackTargetX = target.x;
        }
      }

      // Remove defeated units before collision and wave checks.
      const defeatedUnits = [...nextHeroes.filter((u) => u.currentHp <= 0), ...nextEnemies.filter((u) => u.currentHp <= 0)];
      if (defeatedUnits.length > 0) {
        setDeathEffects((effects) => [...effects, ...defeatedUnits.map((unit) => ({ id: deathUidRef.current++, x: unit.x, team: unit.team, life: 0.42 }))].slice(-20));
      }
      const defeatedEnemies = nextEnemies.filter((e) => e.currentHp <= 0).length;
      if (defeatedEnemies > 0) {
        goldRef.current = Math.min(battleGoldMax, goldRef.current + defeatedEnemies * 20);
        setBattleGold(Math.floor(goldRef.current));
      }

      nextHeroes = nextHeroes
        .filter((unit) => unit.currentHp > 0)
        .map((unit) => ({ ...unit, alive: true }));
      nextEnemies = nextEnemies
        .filter((unit) => unit.currentHp > 0)
        .map((unit) => ({ ...unit, alive: true }));

      // Keep same-team units from stacking into the same position.
      // Allied units may overlap; only enemies keep formation spacing.
      nextEnemies = resolveSameTeamSpacing(nextEnemies);

      const frontline = resolveFrontlineCollision(nextHeroes, nextEnemies);
      nextHeroes = frontline.heroes;
      nextEnemies = frontline.enemies;

      heroesRef.current = nextHeroes;
      enemiesRef.current = nextEnemies;
      setHeroes(nextHeroes);
      setEnemies(nextEnemies);

      const waveCleared = spawnRef.current >= totalInWave && nextEnemies.length === 0;
      if (waveCleared && waveRef.current < stage.waves.length - 1) {
        const reward = stage.waveMeta[waveRef.current]?.reward ?? 0;
        goldRef.current = Math.min(battleGoldMax, goldRef.current + reward);
        setBattleGold(Math.floor(goldRef.current));
        waveRef.current += 1;
        spawnRef.current = 0;
        spawnTimerRef.current = 1.4;
        setWaveIndex(waveRef.current);
        setNotice(`WAVE ${waveRef.current + 1} · ${stage.waveMeta[waveRef.current]?.name ?? "다음 전투"}`);
      } else if (waveCleared && waveRef.current === stage.waves.length - 1 && !finalClearNotifiedRef.current) {
        finalClearNotifiedRef.current = true;
        setNotice("FINAL WAVE CLEAR · 적 성을 파괴하면 스테이지 클리어!");
      }

      if (enemyCastleRef.current <= 0) {
        setEnemyCastleHp(0);
        const clearedStage = stageRef.current + 1;
        setUnlockedStage((current) => {
          const next = Math.max(current, Math.min(STAGES.length, clearedStage + 1));
          window.localStorage.setItem("btw-unlocked-stage", String(next));
          return next;
        });
        setClearedStages((current) => {
          const firstClear = !current.includes(clearedStage);
          if (firstClear) {
            setGems((currentGems) => {
              const nextGems = currentGems + stage.firstClearGems;
              window.localStorage.setItem("btw-gems", String(nextGems));
              return nextGems;
            });
          }
          const reward = firstClear ? stage.clearReward : stage.repeatReward;
          setKingdomGold((gold) => {
            const nextGold = gold + reward;
            window.localStorage.setItem("btw-kingdom-gold", String(nextGold));
            return nextGold;
          });
          if (!firstClear) return current;
          const next = [...current, clearedStage].sort((a, b) => a - b);
          window.localStorage.setItem("btw-cleared-stages", JSON.stringify(next));
          return next;
        });
        setBattleState("victory");
      } else if (castleRef.current <= 0) {
        setCastleHp(0);
        setBattleState("defeat");
      }
    }, 50);

    return () => window.clearInterval(interval);
  }, [battleState, gameSpeed, battleGoldMax, goldPerSecond]);

  const selectStage = (nextStageIndex: number) => {
    if (nextStageIndex < 0 || nextStageIndex >= unlockedStage) return;
    reset(nextStageIndex);
  };

  const reset = (nextStageIndex = stageIndex) => {
    const nextStage = STAGES[nextStageIndex] ?? STAGES[0];
    stageRef.current = nextStageIndex;
    goldRef.current = battleStartGold;
    castleRef.current = 1000;
    enemyCastleRef.current = nextStage.enemyCastleHp;
    waveRef.current = 0;
    spawnRef.current = 0;
    spawnTimerRef.current = 1.2;
    uidRef.current = 1;
    finalClearNotifiedRef.current = false;
    setStageIndex(nextStageIndex);
    setBattleGold(battleStartGold);
    setEconomyLevel(1);
    setWaveIndex(0);
    setHeroes([]);
    setEnemies([]);
    setCastleHp(1000);
    setEnemyCastleHp(nextStage.enemyCastleHp);
    setCastleHit(null);
    setDamagePopups([]);
    popupUidRef.current = 1;
    setBattleState("playing");
    setDeployCooldowns({});
    setNotice(`STAGE ${nextStage.id} · ${nextStage.name} 시작!`);
  };

  const currentStage = STAGES[stageIndex] ?? STAGES[0];
  const currentWave = currentStage.waves[waveIndex];

  const summonGrade = (minimumHero = false): SummonGrade => {
    if (minimumHero) {
      const roll = Math.random() * 10;
      if (roll < 0.05) return "초월";
      if (roll < 0.5) return "신화";
      if (roll < 3) return "전설";
      return "영웅";
    }
    const roll = Math.random() * 100;
    if (roll < 0.05) return "초월";
    if (roll < 0.5) return "신화";
    if (roll < 3) return "전설";
    if (roll < 10) return "영웅";
    if (roll < 35) return "희귀";
    return "일반";
  };
  const rollHero = (grade: SummonGrade) => {
    const pool = HEROES.filter((hero) => getHeroGrade(hero.id).name === grade);
    const fallback = HEROES.filter((hero) => ["일반", "희귀", "영웅", "전설"].includes(getHeroGrade(hero.id).name));
    return (pool.length ? pool : fallback)[Math.floor(Math.random() * (pool.length ? pool.length : fallback.length))];
  };
  const performSummon = (count: 1 | 11) => {
    if (summonPhase !== "idle") return;
    const cost = count === 11 ? 1000 : SUMMON_GEM_COST;
    if (gems < cost) return;
    let nextLegendPity = legendPity;
    let nextMythPity = mythPity;
    const items: SummonStorageItem[] = Array.from({ length: count }, (_, index) => {
      nextLegendPity += 1;
      nextMythPity += 1;
      let grade: SummonGrade;
      if (nextMythPity >= 500) grade = "신화";
      else if (nextLegendPity >= 100) grade = "전설";
      else grade = summonGrade(count === 11 && index === count - 1);
      if (["전설", "신화", "초월"].includes(grade)) nextLegendPity = 0;
      if (["신화", "초월"].includes(grade)) nextMythPity = 0;
      const hero = rollHero(grade);
      return { uid: summonUidRef.current++, heroId: hero.id, grade };
    });
    setLegendPity(nextLegendPity); setMythPity(nextMythPity);
    window.localStorage.setItem("btw-legend-pity", String(nextLegendPity));
    window.localStorage.setItem("btw-myth-pity", String(nextMythPity));
    const nextStorage = [...items, ...summonStorage];
    setSummonStorage(nextStorage);
    window.localStorage.setItem("btw-summon-storage", JSON.stringify(nextStorage));
    const nextGems = gems - cost;
    setGems(nextGems);
    window.localStorage.setItem("btw-gems", String(nextGems));
    setSummonSequence(items);
    setLastSummonResults(items);
    setSummonSummaryOpen(false);
    setSummonRevealIndex(0);
    setSummonMessage("");
    setSummonPhase("throw");
    window.setTimeout(() => setSummonPhase("impact"), 650);
    window.setTimeout(() => setSummonPhase("crack"), 1200);
    window.setTimeout(() => setSummonPhase("reveal"), 1850);
  };
  const nextSummonReveal = () => {
    if (summonRevealIndex < summonSequence.length - 1) {
      setSummonRevealIndex((index) => index + 1);
      return;
    }
    setSummonPhase("idle");
    setSummonSequence([]);
    setSummonSummaryOpen(true);
    setSummonMessage("소환 완료 · 모든 결과가 저장소로 이동했습니다.");
  };
  const skipSummonReveal = () => {
    setSummonPhase("idle");
    setSummonSequence([]);
    setSummonSummaryOpen(true);
    setSummonMessage("연출 스킵 · 모든 결과가 저장소로 이동했습니다.");
  };
  const useStoredHero = (uid: number) => {
    const item = summonStorage.find((entry) => entry.uid === uid);
    if (!item || ownedHeroes.includes(item.heroId)) return;
    const nextOwned = [...ownedHeroes, item.heroId];
    const nextStorage = summonStorage.filter((entry) => entry.uid !== uid);
    setOwnedHeroes(nextOwned); setSummonStorage(nextStorage);
    window.localStorage.setItem("btw-owned-heroes", JSON.stringify(nextOwned));
    window.localStorage.setItem("btw-summon-storage", JSON.stringify(nextStorage));
  };
  const soulStoredHero = (uid: number) => {
    const item = summonStorage.find((entry) => entry.uid === uid);
    if (!item || !ownedHeroes.includes(item.heroId)) return;
    const nextHeroSouls = { ...heroSouls, [item.heroId]: Math.min(30, (heroSouls[item.heroId] ?? 0) + 1) };
    const nextStorage = summonStorage.filter((entry) => entry.uid !== uid);
    setHeroSouls(nextHeroSouls); setSummonStorage(nextStorage);
    window.localStorage.setItem("btw-hero-souls", JSON.stringify(nextHeroSouls));
    window.localStorage.setItem("btw-summon-storage", JSON.stringify(nextStorage));
  };
  const shardStoredHero = (uid: number) => {
    const item = summonStorage.find((entry) => entry.uid === uid);
    if (!item) return;
    const shardValue: Record<SummonGrade, number> = { 일반: 5, 희귀: 15, 영웅: 40, 전설: 120, 신화: 400, 초월: 1500 };
    const nextShards = soulShards + shardValue[item.grade];
    const nextTranscend = transcendShards + (item.grade === "신화" ? 1 : item.grade === "초월" ? 5 : 0);
    const nextStorage = summonStorage.filter((entry) => entry.uid !== uid);
    setSoulShards(nextShards); setTranscendShards(nextTranscend); setSummonStorage(nextStorage);
    window.localStorage.setItem("btw-soul-shards", String(nextShards));
    window.localStorage.setItem("btw-transcend-shards", String(nextTranscend));
    window.localStorage.setItem("btw-summon-storage", JSON.stringify(nextStorage));
  };
  const bulkUseStoredHeroes = () => {
    const uniqueIds = [...new Set(summonStorage.map((item) => item.heroId).filter((id) => !ownedHeroes.includes(id)))];
    if (!uniqueIds.length) return;
    const nextOwned = [...ownedHeroes, ...uniqueIds];
    const usedOnce = new Set<string>();
    const nextStorage = summonStorage.filter((item) => {
      if (!uniqueIds.includes(item.heroId) || usedOnce.has(item.heroId)) return true;
      usedOnce.add(item.heroId); return false;
    });
    setOwnedHeroes(nextOwned); setSummonStorage(nextStorage);
    window.localStorage.setItem("btw-owned-heroes", JSON.stringify(nextOwned));
    window.localStorage.setItem("btw-summon-storage", JSON.stringify(nextStorage));
  };
  const bulkSoulStoredHeroes = (maxGrade: "일반" | "희귀") => {
    const allowed = maxGrade === "일반" ? new Set<SummonGrade>(["일반"]) : new Set<SummonGrade>(["일반", "희귀"]);
    const capacity = { ...heroSouls };
    const targetIds = new Set<number>();
    summonStorage.forEach((item) => {
      if (!allowed.has(item.grade) || !ownedHeroes.includes(item.heroId) || (capacity[item.heroId] ?? 0) >= 30) return;
      capacity[item.heroId] = (capacity[item.heroId] ?? 0) + 1;
      targetIds.add(item.uid);
    });
    if (!targetIds.size) return;
    const nextStorage = summonStorage.filter((item) => !targetIds.has(item.uid));
    setHeroSouls(capacity); setSummonStorage(nextStorage);
    window.localStorage.setItem("btw-hero-souls", JSON.stringify(capacity));
    window.localStorage.setItem("btw-summon-storage", JSON.stringify(nextStorage));
  };
  const bulkShardStoredHeroes = (maxGrade: "일반" | "희귀") => {
    const allowed = maxGrade === "일반" ? new Set<SummonGrade>(["일반"]) : new Set<SummonGrade>(["일반", "희귀"]);
    const shardValue: Record<SummonGrade, number> = { 일반: 5, 희귀: 15, 영웅: 40, 전설: 120, 신화: 400, 초월: 1500 };
    const targets = summonStorage.filter((item) => allowed.has(item.grade));
    if (!targets.length) return;
    const gain = targets.reduce((sum, item) => sum + shardValue[item.grade], 0);
    const ids = new Set(targets.map((item) => item.uid));
    const nextStorage = summonStorage.filter((item) => !ids.has(item.uid));
    const nextShards = soulShards + gain;
    setSoulShards(nextShards); setSummonStorage(nextStorage);
    window.localStorage.setItem("btw-soul-shards", String(nextShards));
    window.localStorage.setItem("btw-summon-storage", JSON.stringify(nextStorage));
  };
  const buyHeroSoulWithShards = (heroId: string) => {
    const cost = 100;
    if (!ownedHeroes.includes(heroId) || soulShards < cost || (heroSouls[heroId] ?? 0) >= 30) return;
    const nextSouls = { ...heroSouls, [heroId]: (heroSouls[heroId] ?? 0) + 1 };
    const nextShards = soulShards - cost;
    setHeroSouls(nextSouls); setSoulShards(nextShards);
    window.localStorage.setItem("btw-hero-souls", JSON.stringify(nextSouls));
    window.localStorage.setItem("btw-soul-shards", String(nextShards));
  };
  const fusionRecipes = [
    { id: "unknown-01", name: "??? · 봉인된 왕", icon: "👑", materials: [DECK_IDS[18], DECK_IDS[17]].filter(Boolean), shardCost: 10 },
    { id: "unknown-02", name: "??? · 경계의 사신", icon: "☠️", materials: [DECK_IDS[19], DECK_IDS[16]].filter(Boolean), shardCost: 10 }
  ];
  const performFusion = (recipeId: string) => {
    const recipe = fusionRecipes.find((entry) => entry.id === recipeId);
    if (!recipe || fusionRecords.includes(recipeId) || transcendShards < recipe.shardCost || !recipe.materials.every((id) => ownedHeroes.includes(id))) return;
    const nextRecords = [...fusionRecords, recipeId];
    const nextShards = transcendShards - recipe.shardCost;
    setFusionRecords(nextRecords); setTranscendShards(nextShards);
    window.localStorage.setItem("btw-fusion-records", JSON.stringify(nextRecords));
    window.localStorage.setItem("btw-transcend-shards", String(nextShards));
  };

  const toggleDeckHero = (id: string) => {
    if (!ownedHeroes.includes(id)) return;
    if (deckIds.includes(id)) {
      if (deckIds.length <= 1) return;
      const next = deckIds.filter((value) => value !== id);
      setDeckIds(next);
      window.localStorage.setItem("btw-deck-ids", JSON.stringify(next));
      return;
    }
    if (deckIds.length >= deckSlotCount) return;
    const next = [...deckIds, id];
    setDeckIds(next);
    window.localStorage.setItem("btw-deck-ids", JSON.stringify(next));
  };
  const setDeckSlot = (slotIndex: number, heroId: string) => {
    if (!ownedHeroes.includes(heroId)) return;
    const next = deckIds.filter((id) => id !== heroId);
    const displaced = deckIds[slotIndex];
    next.splice(Math.min(slotIndex, next.length), 0, heroId);
    if (displaced && displaced !== heroId && !next.includes(displaced) && next.length < deckSlotCount) next.push(displaced);
    const trimmed = next.slice(0, deckSlotCount);
    setDeckIds(trimmed);
    window.localStorage.setItem("btw-deck-ids", JSON.stringify(trimmed));
  };
  const removeDeckSlot = (slotIndex: number) => {
    const next = deckIds.filter((_, index) => index !== slotIndex);
    if (next.length === 0) return;
    setDeckIds(next);
    window.localStorage.setItem("btw-deck-ids", JSON.stringify(next));
  };

  useEffect(() => {
    const ownedSet = new Set(ownedHeroes);
    const valid = deckIds.filter((id) => HEROES.some((hero) => hero.id === id) && ownedSet.has(id));
    const next = valid.slice(0, deckSlotCount);
    if (next.length !== deckIds.length || next.some((id, index) => id !== deckIds[index])) {
      setDeckIds(next);
      window.localStorage.setItem("btw-deck-ids", JSON.stringify(next));
    }
  }, [ownedHeroes, deckSlotCount]);

  const currentWaveTotal = currentWave?.reduce((sum, group) => sum + group.count, 0) ?? 0;
  const currentWaveSpawned = waveIndex === waveRef.current ? spawnRef.current : 0;
  const waveProgress = currentWaveTotal > 0 ? (currentWaveSpawned / currentWaveTotal) * 100 : 0;
  const bossUnit = currentStage.waveMeta[waveIndex]?.boss ? enemies.find((unit) => unit.id === "fireOgreE") : undefined;
  const bossHpPercent = bossUnit ? clamp((bossUnit.currentHp / bossUnit.hp) * 100, 0, 100) : 0;
  const bossPhaseTwo = Boolean(bossUnit && bossUnit.currentHp / bossUnit.hp <= 0.5);
  const waveThreat = currentWave?.some((group) => group.enemy === "assassin")
    ? "⚠ 암살자 · 원거리 후열 우선 공격"
    : currentWave?.some((group) => group.enemy === "fireMage")
      ? "⚠ 사술사 · 광역 공격"
      : currentWave?.some((group) => group.enemy === "archer")
        ? "⚠ 적 원거리 지원"
        : currentStage.waveMeta[waveIndex]?.boss
          ? "⚠ BOSS · 광역 공격 / 반피 이하 격노"
          : "";

  if (battleState === "stageSelect") {
    return (
      <main className="stage-select-shell">
        <section className="stage-select-card main-hub-card">
          <div className="stage-select-kicker">BREAK THE WALLS</div>
          <h1>{mainTab === "home" ? "KINGDOM" : mainTab === "gather" ? "GATHER" : mainTab === "battle" ? "BATTLE" : mainTab === "heroes" ? "HEROES" : "SUMMON"}</h1>
          <div className="stage-select-stats">
            <span>🏯 영지 Lv.<b>{kingdomLevel}</b></span>
            <span>💎 <b>{gems.toLocaleString()}</b></span>
            <span>🪙 <b>{kingdomGold.toLocaleString()}</b></span>
            <span>🏆 <b>{clearedStages.length}/{STAGES.length}</b></span>
          </div>

          {mainTab === "home" && (
            <div className="kingdom-home">
              <div className="kingdom-hero"><div className="kingdom-castle">🏰</div><div><b>퓨어 왕국</b><span>성벽 너머의 전장을 돌파하고 왕국을 성장시키세요.</span></div></div>
              <div className="home-progress"><span>현재 전선</span><b>STAGE {Math.min(unlockedStage, STAGES.length)} · {STAGES[Math.min(unlockedStage, STAGES.length) - 1]?.name}</b><small>보유 영웅 {ownedHeroes.length}/{HEROES.length} · 편성 {deckIds.length}/{deckSlotCount}</small><small>다음 목표 · {clearedStages.length < 2 ? "STAGE 2 클리어 → 고대 숲" : clearedStages.length < 4 ? "STAGE 4 클리어 → 수정 광산" : "왕성·시설 강화 후 다음 전선 준비"}</small></div>
              <div className="kingdom-unlock-road"><div className="kingdom-unlock-head"><b>왕국 성장 로드</b><span>{nextKingdomUnlock ? `NEXT · Lv.${nextKingdomUnlock.level}` : "CURRENT MAX"}</span></div><div className="kingdom-unlock-list">{kingdomUnlocks.map((entry) => <div key={entry.level} className={kingdomLevel >= entry.level ? "unlocked" : entry.level === nextKingdomUnlock?.level ? "next" : ""}><span>{entry.icon}</span><b>Lv.{entry.level}</b><small>{entry.title}</small><p>{entry.text}</p></div>)}</div></div>
              <div className="facility-grid">
                <div className="facility-card castle-card"><span>🏰</span><div><b>왕성 Lv.{kingdomLevel}</b><small>자동채집 ×{kingdomProductionBonus.toFixed(2)} · 판매 ×{kingdomSellBonus.toFixed(2)}</small><small className="next-unlock">다음 효과: {kingdomMilestone}</small></div><button disabled={kingdomGold < kingdomUpgradeCost} onClick={upgradeKingdom}>강화 · {kingdomUpgradeCost} 🪙</button></div>
                {(Object.keys(facilityDefs) as FacilityKey[]).map((key) => { const facility = facilityDefs[key]; const unlocked = kingdomLevel >= facility.unlock; return <div key={key} className={`facility-card ${!unlocked ? "facility-locked" : ""}`}><span>{facility.icon}</span><div><b>{facility.name} Lv.{facilityLevels[key]}</b><small>{unlocked ? facility.text(facilityLevels[key]) : `왕성 Lv.${facility.unlock}에서 해금`}</small></div><button disabled={!unlocked || kingdomGold < facilityUpgradeCost(key)} onClick={() => upgradeFacility(key)}>{unlocked ? `강화 · ${facilityUpgradeCost(key)} 🪙` : "잠김"}</button></div>; })}
              </div>
              <button className="home-battle-cta" onClick={() => setMainTab("battle")}>⚔️ 전투 출격</button>
            </div>
          )}

          {mainTab === "gather" && (
            <div className="gather-hub">
              <div className="resource-storage"><span>📦 보관함</span><b>🌲 {resources.wood} 나무</b><b>🪨 {resources.stone} 돌</b></div>
              {offlineGather && <div className="offline-gather-result"><div><b>🌙 오프라인 채집 정산</b><span>최대 8시간까지 자동 생산이 누적됩니다.</span></div><strong>{offlineGather.wood > 0 ? `🌲 +${offlineGather.wood}` : ""} {offlineGather.stone > 0 ? `🪨 +${offlineGather.stone}` : ""}</strong><small>{Math.floor(offlineGather.seconds / 60)}분 생산</small><button onClick={() => setOfflineGather(null)}>확인</button></div>}
              <div className="gather-region-progress">
                <b>🗺️ 채집 지역</b>
                {(Object.keys(gatherRegions) as GatherRegionKey[]).map((key) => { const region = gatherRegions[key]; const unlocked = isGatherRegionUnlocked(key); return <button key={key} disabled={!unlocked} className={gatherRegion === key ? "active" : ""} onClick={() => { setGatherRegion(key); setGatherHp({ wood: gatherMaxHp.wood * region.scale, stone: gatherMaxHp.stone * region.scale }); }}>{region.icon} {region.name}<br/><small>{unlocked ? `HP ×${region.scale} · 보상 ×${region.scale}` : `STAGE ${region.unlockStage} 필요`}</small></button>; })}
              </div>
              <div className="region-bonus">{activeGatherRegion.icon} {activeGatherRegion.name} · {activeGatherRegion.description}</div>
              <div className="gather-grid">
                {(["wood", "stone"] as const).map((type) => {
                  const isWood = type === "wood";
                  const assigned = workers[type] ? HEROES.find((hero) => hero.id === workers[type]) : undefined;
                  const scaledMaxHp = gatherMaxHp[type] * gatherRegionScale;
                  const hpPercent = (gatherHp[type] / scaledMaxHp) * 100;
                  return <div className={`gather-site resource-battle ${gatherHit === type ? "resource-hit" : ""}`} key={type}>
                    <h2>{isWood ? "🌲 왕국 숲" : "🪨 채석장"}</h2>
                    <p>{isWood ? "거목을 쓰러뜨려 목재를 획득하세요." : "광맥을 파괴해 석재를 획득하세요."}</p>
                    <div className="resource-arena">
                      {assigned && <div className="worker-fighter"><span>{assigned.sprite}</span><small>{assigned.name}</small><b>효율 ×{getGatherEfficiency(assigned.id).toFixed(2)}</b><i>{isWood ? "🪓" : "⛏️"}</i></div>}
                      <button className="resource-target" onClick={() => gatherResource(type)} aria-label={isWood ? "나무 공격" : "돌 공격"}>
                        <span className="resource-object">{isWood ? "🌳" : "🪨"}</span>
                        <span className="resource-impact">{isWood ? "🪵" : "✦"}</span>
                      </button>
                    </div>
                    <div className="resource-hp"><span style={{ width: `${hpPercent}%` }} /></div>
                    <div className="resource-hp-label">{gatherHp[type]} / {scaledMaxHp} HP · 공격 피해 {getGatherAttackDamage(type)} · 파괴 보상 +{gatherReward[type] * gatherRegionScale}</div>
                    <button className="gather-action" onClick={() => gatherResource(type)}>{assigned ? `${assigned.sprite} ${assigned.name} 공격` : isWood ? "🪓 벌목 공격" : "⛏️ 채광 공격"}</button>
                    <button className="sell-action" disabled={resources[type] <= 0} onClick={() => sellResource(type)}>전부 판매 · +{Math.round(resources[type] * (isWood ? 5 : 8) * kingdomSellBonus)} 🪙</button>
                    <div className="worker-box"><b>자동 채집</b><span>{assigned ? `${assigned.sprite} ${assigned.name} · 자동 생산 +${getAutoGatherAmount(type)}/3초 · 효율 ×${getGatherEfficiency(assigned.id).toFixed(2)}` : "영웅을 배치하면 자동 생산"}</span></div>
                    <div className="worker-list">{ownedHeroes.map((id) => { const hero = HEROES.find((unit) => unit.id === id); if (!hero) return null; const busyElsewhere = Object.entries(workers).some(([key, value]) => key !== type && value === id); return <button key={id} disabled={busyElsewhere} className={workers[type] === id ? "assigned" : ""} onClick={() => assignWorker(type, id)}>{hero.sprite}<small>{hero.name}<br/>×{getGatherEfficiency(hero.id).toFixed(2)}</small></button>; })}</div>
                  </div>;
                })}
              </div>
            </div>
          )}

          {mainTab === "battle" && (
            <div className="stage-grid">
              {STAGES.map((stage) => {
                const unlocked = stage.id <= unlockedStage;
                const cleared = clearedStages.includes(stage.id);
                return (
                  <button key={stage.id} className={"stage-card " + (unlocked ? "unlocked " : "locked ") + (cleared ? "cleared" : "")} disabled={!unlocked} onClick={() => selectStage(stage.id - 1)}>
                    <div className="stage-card-top"><span>STAGE {stage.id} · {stage.region}</span><b>{cleared ? "✓ CLEAR" : unlocked ? "▶ PLAY" : "🔒 LOCKED"}</b></div>
                    <div className={`stage-type stage-type-${stage.type}`}>{stage.type === "boss" ? "BOSS" : stage.type === "elite" ? "ELITE" : "NORMAL"}</div>
                    <h2>{stage.name}</h2>
                    <div className="stage-card-meta"><span>🌊 {stage.waves.length} WAVES</span><span>🏰 HP {stage.enemyCastleHp}</span></div>
                    {stage.bossName && <div className="stage-boss-name">👑 {stage.bossName}</div>}{stage.mechanic && <div className="stage-mechanic">{stage.mechanic}</div>}<div className="stage-card-reward">{cleared ? `REPEAT · +${stage.repeatReward} 🪙` : `FIRST · +${stage.clearReward} 🪙 · +${stage.firstClearGems} 💎`}</div>
                  </button>
                );
              })}
            </div>
          )}

          {mainTab === "heroes" && (() => {
            const selectedHero = HEROES.find((hero) => hero.id === selectedHeroId) ?? HEROES[0];
            const owned = ownedHeroes.includes(selectedHero.id);
            const level = getUnitLevel(selectedHero.id);
            const multiplier = getLevelMultiplier(selectedHero.id, level);
            const nextMultiplier = getLevelMultiplier(selectedHero.id, Math.min(10, level + 1));
            const currentPower = getHeroPower(selectedHero, level);
            const nextPower = getHeroPower(selectedHero, Math.min(10, level + 1));
            const soulBonus = getSoulBonuses(selectedHero.id);
            const upgradeCost = getUpgradeCost(selectedHero.id);
            const grade = getHeroGrade(selectedHero.id);
            const soulPlus = heroSouls[selectedHero.id] ?? 0;
            const soulMilestones = [5, 10, 15, 20, 25, 30];
            const nextSoulMilestone = soulMilestones.find((value) => value > soulPlus) ?? 30;
            return (
              <div className="hero-center">
                <div className="hero-mode-tabs"><button className={heroMode === "formation" ? "active" : ""} onClick={() => setHeroMode("formation")}>⚔️ 영웅 편성</button><button className={heroMode === "upgrade" ? "active" : ""} onClick={() => setHeroMode("upgrade")}>⬆️ 영웅 강화</button></div>
                {heroMode === "formation" ? <>
                  <div className="formation-help">보유 영웅을 아래 출전 슬롯으로 드래그하세요. 슬롯의 영웅을 누르면 편성에서 빠집니다.</div>
                  <div className="formation-roster">{HEROES.filter((hero) => ownedHeroes.includes(hero.id)).map((hero) => <div key={hero.id} className={`formation-hero ${deckIds.includes(hero.id) ? "in-deck" : ""}`} draggable onDragStart={() => setDragHeroId(hero.id)} onDragEnd={() => setDragHeroId(null)}><span>{hero.sprite}</span><b>{hero.name}</b><small>{getHeroGrade(hero.id).name} · Lv.{getUnitLevel(hero.id)}</small></div>)}</div>
                  <div className="formation-pager" onTouchStart={(event) => { formationTouchY.current = event.touches[0]?.clientY ?? null; }} onTouchEnd={(event) => { if (formationTouchY.current == null) return; const endY = event.changedTouches[0]?.clientY ?? formationTouchY.current; const delta = endY - formationTouchY.current; if (delta < -35) setFormationPage(1); if (delta > 35) setFormationPage(0); formationTouchY.current = null; }}>
                    <button className="formation-arrow" disabled={formationPage === 0} onClick={() => setFormationPage(0)}>↑</button>
                    <div className="formation-page-label">{formationPage === 0 ? "출전 1 · 슬롯 1~5" : "출전 2 · 슬롯 6~10"}</div>
                    <div className="formation-slots five">{Array.from({ length: 5 }, (_, localIndex) => { const index = formationPage * 5 + localIndex; const id = deckIds[index]; const hero = HEROES.find((unit) => unit.id === id); return <div key={index} className={`formation-slot ${hero ? "filled" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragHeroId) setDeckSlot(index, dragHeroId); setDragHeroId(null); }} onClick={() => hero && removeDeckSlot(index)}><em>{index + 1}</em>{hero ? <><span>{hero.sprite}</span><b>{hero.name}</b></> : <small>DROP</small>}</div>; })}</div>
                    <button className="formation-arrow" disabled={formationPage === 1} onClick={() => setFormationPage(1)}>↓</button>
                    <div className="formation-dots"><i className={formationPage === 0 ? "active" : ""}/><i className={formationPage === 1 ? "active" : ""}/></div>
                  </div>
                </> : <div className="hero-management upgrade-only">
                  <div className="hero-roster"><div className="deck-builder-title">강화할 영웅 선택</div><div className="deck-builder-grid">{HEROES.map((hero) => { const heroOwned = ownedHeroes.includes(hero.id); return <button key={hero.id} className={`deck-builder-card ${!heroOwned ? "disabled" : ""} ${selectedHero.id === hero.id ? "focused" : ""}`} onClick={() => setSelectedHeroId(hero.id)}><span>{hero.sprite}</span><b>{hero.name}</b><small>{heroOwned ? `${getHeroGrade(hero.id).name} · Lv.${getUnitLevel(hero.id)} · 영혼 +${heroSouls[hero.id] ?? 0}` : "🔒 미보유"}</small></button>; })}</div></div>
                  <div className={`hero-detail ${!owned ? "locked" : ""}`}><div className="hero-detail-head"><span>{selectedHero.sprite}</span><div><small>{grade.name} · {selectedHero.role}</small><h2>{selectedHero.name}</h2><b>Lv.{level}</b></div></div>{owned && <div className="hero-profile-strip"><span>{ELEMENT_LABEL[selectedHero.element]}</span><span>{selectedHero.rangeType === "ranged" ? "원거리" : "근거리"} · 사거리 {selectedHero.range}</span><span>이동 {selectedHero.speed}</span><span>출전 {selectedHero.cost}G</span><span>쿨 {selectedHero.cooldown}s</span></div>}{owned ? <><div className="hero-power-card"><small>COMBAT POWER</small><b>{currentPower.toLocaleString()}</b>{level < 10 && <span>다음 Lv.{level + 1} → {nextPower.toLocaleString()}</span>}</div><div className="hero-trait-card"><div><small>COMBAT TRAIT</small><b>{getHeroTrait(selectedHero).name}</b></div><p>{getHeroTrait(selectedHero).text}</p><span>{selectedHero.attackType === "splash" ? "광역" : "단일"} · 공격주기 {(selectedHero.attackInterval * soulBonus.speed).toFixed(2)}초</span></div><div className="hero-stat-grid"><div><span>HP</span><b>{Math.round(selectedHero.hp * multiplier * soulBonus.hp)}</b>{level < 10 && <small>→ {Math.round(selectedHero.hp * nextMultiplier * soulBonus.hp)}</small>}</div><div><span>ATK</span><b>{Math.round(selectedHero.atk * multiplier * soulBonus.atk)}</b>{level < 10 && <small>→ {Math.round(selectedHero.atk * nextMultiplier * soulBonus.atk)}</small>}</div><div><span>공격속도</span><b>{(selectedHero.attackInterval * soulBonus.speed).toFixed(2)}s</b><small>영혼 성장 적용</small></div><div><span>등급 성장</span><b>Lv당 +{Math.round(getGradeGrowth(selectedHero.id) * 100)}%</b><small>{grade.name}</small></div></div><div className="hero-soul-panel"><div className="hero-soul-head"><span>영혼 성장</span><b>+{soulPlus}/30</b></div><div className="hero-soul-track"><i style={{width:`${(soulPlus / 30) * 100}%`}}/></div><div className="hero-soul-milestones">{soulMilestones.map((value) => <div key={value} className={soulPlus >= value ? "reached" : ""}><b>+{value}</b><small>{value === 5 ? "HP +8%" : value === 10 ? "ATK +8%" : value === 15 ? "공속 +8%" : value === 20 ? "HP +12%" : value === 25 ? "ATK +12%" : "HP/ATK +10% · 공속 +5%"}</small></div>)}</div><div className="hero-soul-next">{soulPlus >= 30 ? "영혼 성장 MAX" : `다음 마일스톤 +${nextSoulMilestone} · 중복 영웅 또는 영혼 파편으로 성장할 수 있습니다.`}</div>{soulPlus < 30 && <button className="soul-shard-buy" disabled={soulShards < 100} onClick={() => buyHeroSoulWithShards(selectedHero.id)}>🧩 영혼 파편 100 → {selectedHero.name} 영혼 +1</button>}</div><div className="hero-detail-actions single"><button disabled={level >= 10 || kingdomGold < upgradeCost} onClick={() => upgradeUnit(selectedHero.id)}>{level >= 10 ? "MAX LEVEL" : `강화 · ${upgradeCost} 🪙`}</button></div><div className="upgrade-preview">{grade.name} 성장률 적용 · Lv당 HP / ATK +{Math.round(getGradeGrowth(selectedHero.id) * 100)}% · 보유 {kingdomGold.toLocaleString()} 🪙</div></> : <div className="hero-locked-message">🎲 소환에서 획득해야 강화할 수 있습니다.</div>}</div>
                </div>}
              </div>
            );
          })()}

          {mainTab === "summon" && (
            <div className="summon-panel hub-summon">
              <div className="deck-builder-title">🎲 성벽 소환</div>
              {summonPhase !== "idle" && (() => {
                const item = summonSequence[summonRevealIndex];
                const hero = item ? HEROES.find((unit) => unit.id === item.heroId) : undefined;
                const highGrade = item ? ["전설", "신화", "초월"].includes(item.grade) : false;
                const omenGrade = item?.grade ?? "일반";
                const fakeout = item ? ["전설", "신화", "초월"].includes(item.grade) : false;
                return <div className={`summon-cinematic phase-${summonPhase} grade-scene-${omenGrade} ${highGrade ? "high-grade" : ""} ${fakeout ? "summon-fakeout" : ""}`}>
                  <button className="summon-skip" onClick={skipSummonReveal}>SKIP</button>
                  <div className="summon-scene">
                    <div className="summon-moon">✦</div>
                    <div className="summon-die">🎲</div>
                    <div className="summon-wall"><div className="wall-top">▥▥▥</div><div className="wall-body">▦▦▦<i>⚡</i>▦▦▦</div></div>
                    <div className="summon-impact-ring"/>
                    <div className="summon-omen">{summonPhase === "crack" && item && <><span>◆</span><b>{["일반","희귀"].includes(item.grade) ? "..." : item.grade === "영웅" ? "강한 기척" : "성벽이 버티지 못한다"}</b></>}</div>
                    {fakeout && summonPhase === "crack" && <div className="second-die">🎲</div>}
                    {summonPhase === "reveal" && hero && item && <div className={`hero-reveal grade-${item.grade}`} onClick={nextSummonReveal}>
                      <div className="reveal-rays"/>
                      <small>{summonRevealIndex + 1} / {summonSequence.length}</small>
                      <div className="reveal-grade">{item.grade}</div>
                      <div className="reveal-sprite">{hero.sprite}</div>
                      <h2>{hero.name}</h2>
                      <p>{hero.role}</p>
                      <b>{summonRevealIndex < summonSequence.length - 1 ? "클릭하여 다음 영웅 ▶" : "클릭하여 결과 확인"}</b>
                    </div>}
                  </div>
                  {summonPhase !== "reveal" && <div className="summon-cinematic-text">{summonPhase === "throw" ? "운명의 주사위를 던진다" : summonPhase === "impact" ? "성벽과 운명이 충돌한다" : "균열 너머에서 기척이 느껴진다..."}</div>}
                </div>;
              })()}

              {summonSummaryOpen && lastSummonResults.length > 0 && <div className="summon-summary-overlay">
                <div className="summon-summary-box">
                  <div className="summon-summary-title"><div><small>SUMMON RESULT</small><h2>{lastSummonResults.length === 11 ? "10+1 소환 결과" : "소환 결과"}</h2></div><button onClick={() => setSummonSummaryOpen(false)}>✕</button></div>
                  <div className="summon-summary-grid">{lastSummonResults.map((result) => { const resultHero = HEROES.find((hero) => hero.id === result.heroId); return resultHero ? <div key={result.uid} className={`summary-card grade-${result.grade}`}><span>{resultHero.sprite}</span><b>{resultHero.name}</b><small>{result.grade}</small></div> : null; })}</div>
                  <button className="summary-confirm" onClick={() => setSummonSummaryOpen(false)}>보관소 확인</button>
                </div>
              </div>}
              <p>소환 결과는 바로 영웅이 되지 않고 저장소로 이동합니다. 사용할 영웅만 영입하거나 영혼으로 변환하세요.</p>
              <div className="summon-gem-balance">💎 <b>{gems.toLocaleString()}</b> · 🧩 영혼 파편 <b>{soulShards.toLocaleString()}</b> · ✦ 초월 조각 <b>{transcendShards}</b></div>
              <div className="summon-actions">
                <button className="summon-btn" disabled={gems < SUMMON_GEM_COST} onClick={() => performSummon(1)}>🎲 1회 소환 · 100 💎</button>
                <button className="summon-btn multi" disabled={gems < 1000} onClick={() => performSummon(11)}>🎲 10+1 소환 · 1000 💎<small>11명 소환 · 마지막 1명 영웅 이상 보장</small></button>
              </div>
              <div className="summon-rates">일반 65% · 희귀 25% · 영웅 7% · 전설 2.5% · 신화 0.45% · 초월 0.05%</div>
              <div className="summon-pity"><span>전설 이상 천장 <b>{legendPity}/100</b></span><span>신화 이상 천장 <b>{mythPity}/500</b></span></div>
              {summonMessage && <div className="summon-result">{summonMessage}</div>}
              <button className="open-storage-btn" onClick={() => setMainTab("storage")}>📦 저장소 열기 <b>{summonStorage.length}</b></button>
              <button className="open-storage-btn fusion-open" onClick={() => setMainTab("fusion")}>⚗️ 영웅 합성소 <b>{fusionRecords.length}/{fusionRecipes.length}</b></button>
              <div className="owned-count">실사용 보유 영웅 {ownedHeroes.length}/{HEROES.length}</div>
            </div>
          )}
          {mainTab === "storage" && (
            <div className="summon-panel storage-screen">
              <div className="storage-screen-head"><button onClick={() => setMainTab("summon")}>← 소환으로</button><div><small>SUMMON STORAGE</small><h2>📦 영웅 저장소</h2></div><b>{summonStorage.length}명</b></div>
              <div className="storage-wallet">🧩 영혼 파편 <b>{soulShards.toLocaleString()}</b> · ✦ 초월 조각 <b>{transcendShards}</b></div>
              <div className="storage-help">미보유 영웅은 <b>영입</b> · 보유 중복은 해당 영웅 <b>영혼 +1</b> · 필요 없으면 <b>영혼 파편</b>으로 변환</div>
              <div className="storage-bulk"><button onClick={bulkUseStoredHeroes}>미보유 일괄 영입</button><button onClick={() => bulkSoulStoredHeroes("희귀")}>희귀↓ 중복 일괄 영혼 +1</button><button onClick={() => bulkShardStoredHeroes("일반")}>일반 일괄 파편화</button><button onClick={() => bulkShardStoredHeroes("희귀")}>희귀↓ 일괄 파편화</button></div>
              <div className="summon-storage full">{summonStorage.length === 0 ? <div className="storage-empty">저장소가 비어 있습니다.</div> : summonStorage.map((item) => { const hero = HEROES.find((unit) => unit.id === item.heroId); if (!hero) return null; const owned = ownedHeroes.includes(hero.id); const soulLevel = heroSouls[hero.id] ?? 0; return <div key={item.uid} className={`storage-card grade-${item.grade}`}><div className="storage-hero"><span>{hero.sprite}</span><div><small>{item.grade} · 영혼 +{soulLevel}/30</small><b>{hero.name}</b></div></div><div className="storage-actions">{!owned ? <button onClick={() => useStoredHero(item.uid)}>영입</button> : <button disabled={soulLevel >= 30} onClick={() => soulStoredHero(item.uid)}>{soulLevel >= 30 ? "영혼 MAX" : "영혼 +1"}</button>}<button onClick={() => shardStoredHero(item.uid)}>파편화</button></div></div>; })}</div>
            </div>
          )}

          {mainTab === "fusion" && (
            <div className="summon-panel fusion-screen">
              <div className="storage-screen-head"><button onClick={() => setMainTab("summon")}>← 소환으로</button><div><small>HERO FUSION</small><h2>⚗️ 영웅 합성소</h2></div><b>✦ {transcendShards}</b></div>
              <div className="fusion-warning">??? 등급은 가챠에서 등장하지 않습니다. 지정된 영웅 족보와 초월 조각을 모아 합성합니다. 현재 레시피/영웅은 시스템 검증용 임시 데이터입니다.</div>
              <div className="fusion-recipes">{fusionRecipes.map((recipe) => { const complete = recipe.materials.every((id) => ownedHeroes.includes(id)); const crafted = fusionRecords.includes(recipe.id); return <div key={recipe.id} className={`fusion-card ${crafted ? "crafted" : ""}`}><span>{recipe.icon}</span><div><small>SECRET RECIPE</small><h3>{recipe.name}</h3><p>{recipe.materials.map((id) => { const hero = HEROES.find((unit) => unit.id === id); return `${ownedHeroes.includes(id) ? "✓" : "✕"} ${hero?.name ?? id}`; }).join(" + ")}</p><b>필요 초월 조각 {recipe.shardCost}</b></div><button disabled={crafted || !complete || transcendShards < recipe.shardCost} onClick={() => performFusion(recipe.id)}>{crafted ? "족보 완성" : complete ? "합성" : "재료 부족"}</button></div>; })}</div>
              <div className="fusion-book"><b>📖 발견한 족보</b><span>{fusionRecords.length}/{fusionRecipes.length}</span></div>
            </div>
          )}


          <nav className="main-nav five">
            <button className={mainTab === "home" ? "active" : ""} onClick={() => setMainTab("home")}>🏰<span>왕국</span></button>
            <button className={mainTab === "gather" ? "active" : ""} onClick={() => setMainTab("gather")}>🌲<span>채집</span></button>
            <button className={mainTab === "battle" ? "active" : ""} onClick={() => setMainTab("battle")}>⚔️<span>전투</span></button>
            <button className={mainTab === "heroes" ? "active" : ""} onClick={() => setMainTab("heroes")}>🛡️<span>영웅</span></button>
            <button className={mainTab === "summon" ? "active" : ""} onClick={() => { setMainTab("summon"); setSummonMessage(""); }}>🎲<span>소환</span></button>
          </nav>
        </section>
      </main>
    );
  }

  return (
    <main className="game-shell">
      <header className="topbar">
        <div>
          <div className="game-title">BREAK THE WALLS</div>
          <div className="sub-title">퓨어 월드 · STAGE {currentStage.id} · {currentStage.name}</div>
        </div>
        <div className="top-stats">
          <div className="stat-pill">🏰 우리 성 <b>{Math.ceil(castleHp)}</b></div>
          <div className="stat-pill gold">🪙 Battle Gold <b>{Math.floor(battleGold).toLocaleString()} / {battleGoldMax.toLocaleString()}</b></div>
          <div className="stat-pill">💰 지갑 <b>Lv.{economyLevel}/{economyMaxLevel}</b></div>
          <div className="stat-pill">🗺️ STAGE <b>{currentStage.id}</b> · 🌊 <b>{Math.min(waveIndex + 1, currentStage.waves.length)}/{currentStage.waves.length}</b></div>
          <button className="stat-pill speed-control" onClick={() => setGameSpeed((v) => v === 1 ? 5 : 1)}>⚡ {gameSpeed}X</button>
        </div>
      </header>

      <section className="battle-card">
        <div className="battle-sky">
          <div className="pixel-sky-grid" />
          <div className="cloud c1" /><div className="cloud c2" /><div className="mountains" />
          <div className="battle-horizon" />
          <div className="battle-title-plate">⚔️ FRONTLINE</div>
          <div className={`castle our-castle ${castleHit === "our" ? "castle-hit" : ""}`}><div className="tower">🏰</div><div className="castle-label">우리 성</div><div className="castle-hp"><span style={{width: `${clamp(castleHp / 10, 0, 100)}%`}} /></div></div>
          <div className={`castle enemy-castle ${castleHit === "enemy" ? "castle-hit" : ""}`}><div className="tower">🏯</div><div className="castle-label">적 성</div><div className="castle-hp enemy"><span style={{width: `${clamp(enemyCastleHp / 18, 0, 100)}%`}} /></div></div>

          <div className="lane">
            <div className="lane-ground" />
            <div className="lane-grid" />
            <div className="lane-center-line" />
            <div className="castle-zone our-zone" />
            <div className="castle-zone enemy-zone" />
            {heroes.map((u) => <BattleUnit key={u.uid} unit={u} />)}
            {enemies.map((u) => <BattleUnit key={u.uid} unit={u} />)}
             {deathEffects.map((effect) => (
               <div key={effect.id} style={{
                 position: "absolute", zIndex: 17, left: String(effect.x) + "%",
                 top: effect.team === "hero" ? "42%" : "48%",
                 transform: "translate(-50%,-50%)", fontSize: 25, pointerEvents: "none",
                 opacity: Math.min(1, effect.life * 3),
               }}>
                 {effect.team === "hero" ? "💥" : "💢"}
               </div>
             ))}
             {damagePopups.map((popup) => (
              <div key={popup.id} className={`damage-popup ${popup.critical ? "critical" : ""}`} style={{ left: `${popup.x}%` }}>-{popup.value}</div>
            ))}
          </div>

          {currentStage.waveMeta[waveIndex]?.boss && (
            <div className={`boss-bar ${bossPhaseTwo ? "enraged" : ""}`}>
              <div className="boss-title">🔥 BOSS · 화염의 거인 {bossPhaseTwo ? "· ENRAGED" : ""}</div>
              <div className="boss-hp"><span style={{ width: `${bossHpPercent}%` }} /></div>
              <div className="boss-hp-text">{bossUnit ? `${Math.ceil(bossUnit.currentHp)} / ${bossUnit.hp}` : "등장 준비 중"}</div>
            </div>
          )}

          <div className="wave-banner">
            <div className="wave-title">STAGE {currentStage.id} · WAVE {waveIndex + 1}/{currentStage.waves.length} · {currentStage.waveMeta[waveIndex]?.name}</div>
            <div className="wave-progress"><span style={{ width: `${clamp(waveProgress, 0, 100)}%` }} /></div>
            <div className="wave-notice">{notice}</div>
            {waveThreat && <div className="wave-threat">{waveThreat}</div>}
          </div>
        </div>

        <div className="economy-panel">
          <div className="economy-info"><b>💰 전투 지갑 Lv.{economyLevel}/{economyMaxLevel}</b><span>초당 +{goldPerSecond} 🪙 · 최대 {battleGoldMax.toLocaleString()}</span></div>
          <button className="economy-upgrade" disabled={economyLevel >= economyMaxLevel || battleGold < economyUpgradeCost} onClick={upgradeEconomy}>{economyLevel >= economyMaxLevel ? "지갑 MAX" : `지갑 강화 · 🪙 ${economyUpgradeCost}`}</button>
        </div>
        <div className="deck-panel">
          <div className="battle-deck-header"><b>⚔️ 출전 영웅</b><span>카드를 눌러 전장에 배치 · {deckIds.length}/{deckSlotCount}</span></div>
          <div className="deck-slots">
            {visibleDeck.map((hero) => {
              const cooldownLeft = deployCooldowns[hero.id] ?? 0;
              const lacksGold = battleGold < hero.cost;
              const coolingDown = cooldownLeft > 0;
              const disabled = lacksGold || coolingDown;
              return (
                <div key={hero.id} className={`hero-card-wrap ${disabled ? "disabled" : ""}`}>
                  <button className={`hero-card ${disabled ? "disabled" : ""}`} onClick={() => deploy(hero)}>
                    <div className={`hero-sprite ${ELEMENT_CLASS[hero.element]}`}>{hero.sprite}<span className="spark" /></div>
                    <div className="hero-name">{hero.name} <small>Lv.{getUnitLevel(hero.id)}</small></div>
                    <div className="hero-meta"><span>{hero.role}</span><b>🪙 {hero.cost}</b></div>
                    <div className="hero-combat-type"><span>{hero.rangeType === "melee" ? "⚔️ 근접" : "🏹 원거리"}</span><span>{hero.attackType === "splash" ? "💥 광역" : "🎯 단일"}</span></div>
                    <div className="hero-ability">{hero.ability === "guard" && "🛡️ 피해 감소 22%"}{hero.ability === "regen" && "✚ 초당 HP 회복"}{hero.ability === "crit" && "⚡ 28% 치명타"}{hero.ability === "execute" && "☠️ 저체력 적 추가 피해"}{!hero.ability && hero.attackType === "splash" && "💥 광역 공격"}{!hero.ability && hero.effect === "burn" && hero.attackType !== "splash" && "🔥 화상"}</div>
                    <div className="cooldown">{cooldownLeft > 0 ? `⏱ ${cooldownLeft.toFixed(1)}s` : lacksGold ? `🪙 ${Math.ceil(hero.cost - battleGold)} 부족` : "⚔️ 출격 가능"}</div>
                     {coolingDown && <div className="cooldown-mask" style={{ "--cooldown-ratio": `${Math.min(100, (cooldownLeft / hero.cooldown) * 100)}%` } as React.CSSProperties} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <div className="deck-indicator">영웅 편성 {deckIds.length}/{deckSlotCount} · 영지 Lv.{kingdomLevel} · 보유 {ownedHeroes.length}/{HEROES.length}</div>
      </section>

      <section className="battle-info">
        <div><b>자동전투</b><span>영웅은 자동으로 이동·공격·스킬 발동</span></div>
        <div><b>속성</b><span>⚪ 무속성 · 🔥 불 · 🌑 어둠</span></div>
        <div><b>현재 적</b><span>{enemies.filter((e) => e.alive).length}기</span></div>
      </section>

      {battleState !== "playing" && (
        <div className="result-overlay">
          <div className={`result-box ${battleState}`}>
            <div className="result-kicker">{battleState === "victory" ? "STAGE CLEAR" : "STAGE FAILED"}</div>
            <h1>{battleState === "victory" ? "적 성을 돌파했다!" : "성이 함락됐다..."}</h1>
            <p>{battleState === "victory" ? `STAGE ${currentStage.id} 클리어! 최초 클리어 시 ${currentStage.clearReward} 골드 + ${25 + currentStage.id * 10} 보석 · 다음 전장/채집 지역이 해금됩니다.` : "덱과 배치 타이밍을 바꿔 다시 도전하자."}</p>
            <div className="result-actions">
              <button onClick={() => reset(stageIndex)}>다시 전투</button>
              <button onClick={() => setBattleState("stageSelect")}>스테이지 선택</button>
              {battleState === "victory" && stageIndex + 1 < unlockedStage && (
                <button onClick={() => reset(stageIndex + 1)}>다음 스테이지 ▶</button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
