import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import type { Unit, UnitDef } from "./game/types";
import { HEROES, DECK_IDS, ENEMY_MAP, INITIAL_GEMS, ELEMENT_LABEL, clamp } from "./game/constants";
import { BOSS_ENEMY_KEYS, STAGES } from "./game/stages";
import { makeUnit } from "./game/units/createUnit";
import { KingdomPanel } from "./components/KingdomPanel";
import { GatheringPanel } from "./components/GatheringPanel";
import { HeroesPanel } from "./components/HeroesPanel";
import { SummonPanel } from "./components/SummonPanel";
import { StoragePanel } from "./components/StoragePanel";
import { FusionPanel } from "./components/FusionPanel";
import { StageSelectPanel } from "./components/StageSelectPanel";
import { BattleScreen } from "./components/BattleScreen";
import { type GatherRegionKey } from "./game/systems/gathering";
import { getHeroGrade, GRADE_GROWTH, getSoulBonuses as calculateSoulBonuses, getHeroTrait } from "./game/systems/heroGrowth";
import { getProgressionGoals } from "./game/systems/progression";
import { type SummonStorageItem } from "./game/systems/summon";
import { ECONOMY_MAX_LEVEL, getBattleEconomy } from "./game/systems/battleEconomy";
import { DEV_MODE, STORAGE_KEYS, loadJson, loadNumber, saveJson, saveNumber } from "./game/storage";
import { useKingdomController } from "./game/controllers/useKingdomController";
import { useGatheringController } from "./game/controllers/useGatheringController";
import { useSummonController } from "./game/controllers/useSummonController";
import { useGatheringProduction } from "./game/controllers/useGatheringProduction";
import { useBattleLoop, type BattleReward } from "./game/controllers/useBattleLoop";
import { savedClears, savedCounts, savedIds, savedNonnegative, savedSummons } from "./game/systems/saveData";

type DamagePopup = { id: number; x: number; value: number; critical: boolean; };
type DeathEffect = { id: number; x: number; team: "hero" | "enemy"; life: number; };
const DEV_FACILITY_LEVEL = 10; // Facilities currently have no level cap.

function App() {
  const [stageIndex, setStageIndex] = useState(0);
  const [unlockedStage, setUnlockedStage] = useState(() => {
    const saved = loadNumber(STORAGE_KEYS.unlockedStage, 1);
    return DEV_MODE ? STAGES.length : clamp(Math.floor(saved) || 1, 1, STAGES.length);
  });
  const [kingdomGold, setKingdomGold] = useState(() => Math.max(0, loadNumber(STORAGE_KEYS.kingdomGold, DEV_MODE ? 99999999 : 0)));
  const [gems, setGems] = useState(() => {
    return Math.max(0, loadNumber(STORAGE_KEYS.gems, DEV_MODE ? 99999999 : INITIAL_GEMS));
  });
  const [unitLevels, setUnitLevels] = useState<Record<string, number>>(() => {
    const saved = loadJson<Record<string, number>>(STORAGE_KEYS.unitLevels, {});
    return DEV_MODE ? Object.fromEntries(HEROES.map(hero => [hero.id, 10])) : savedCounts(saved, 10);
  });
  const [clearedStages, setClearedStages] = useState<number[]>(() => savedClears(loadJson(STORAGE_KEYS.clearedStages, [])));
  const [claimedGoals, setClaimedGoals] = useState<string[]>(() => savedIds(loadJson(STORAGE_KEYS.claimedGoals, []), new Set(["first-clear", "gather-start", "kingdom-2", "hero-roster", "hero-growth", "facility-growth", "stage-10", "morgar"])));
  useEffect(() => { saveNumber(STORAGE_KEYS.unlockedStage, unlockedStage); }, [unlockedStage]);
  useEffect(() => { saveNumber(STORAGE_KEYS.kingdomGold, kingdomGold); }, [kingdomGold]);
  useEffect(() => { saveNumber(STORAGE_KEYS.gems, gems); }, [gems]);
  useEffect(() => { saveJson(STORAGE_KEYS.clearedStages, clearedStages); }, [clearedStages]);
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
  const [battleReward, setBattleReward] = useState<BattleReward | null>(null);
  const [deckIds, setDeckIds] = useState<string[]>(() => {
    const saved = savedIds(loadJson(STORAGE_KEYS.deckIds, []), undefined, 10);
    return saved.length ? saved : DEV_MODE ? ["devWukong", ...DECK_IDS.slice(0, 5)] : DECK_IDS.slice(0, 5);
  });
  const [mainTab, setMainTab] = useState<"home" | "gather" | "battle" | "heroes" | "summon" | "storage" | "fusion">("home");
  const [kingdomLevel, setKingdomLevel] = useState(() => Math.max(1, Math.floor(loadNumber(STORAGE_KEYS.kingdomLevel, DEV_MODE ? 6 : 1))));
  const [facilityLevels, setFacilityLevels] = useState<Record<"lumber" | "quarry" | "vault" | "training", number>>(() => {
    const saved = loadJson<Record<string, number>>(STORAGE_KEYS.facilityLevels, {});
    const initial = DEV_MODE ? DEV_FACILITY_LEVEL : 1;
    return { lumber: Math.max(1, Math.floor(savedNonnegative(saved?.lumber, initial))), quarry: Math.max(1, Math.floor(savedNonnegative(saved?.quarry, initial))), vault: Math.max(1, Math.floor(savedNonnegative(saved?.vault, initial))), training: Math.max(1, Math.floor(savedNonnegative(saved?.training, initial))) };
  });
  const [ownedHeroes, setOwnedHeroes] = useState<string[]>(() => {
    const saved = savedIds(loadJson(STORAGE_KEYS.ownedHeroes, []));
    return DEV_MODE ? DECK_IDS : saved.length ? saved : DECK_IDS.slice(0, 5);
  });
  const [resources, setResources] = useState<{ wood: number; stone: number }>(() => {
    try { const saved = loadJson<Record<string, number>>(STORAGE_KEYS.resources, {}); return { wood: savedNonnegative(saved?.wood), stone: savedNonnegative(saved?.stone) }; } catch { return { wood: 0, stone: 0 }; }
  });
  const [workers, setWorkers] = useState<{ wood?: string; stone?: string }>(() => {
    try { const saved = loadJson<Record<string, string>>(STORAGE_KEYS.workers, {}); return { wood: typeof saved?.wood === "string" && ownedHeroes.includes(saved.wood) ? saved.wood : undefined, stone: typeof saved?.stone === "string" && ownedHeroes.includes(saved.stone) && saved.stone !== saved?.wood ? saved.stone : undefined }; } catch { return {}; }
  });
  const [offlineGather, setOfflineGather] = useState<{ wood: number; stone: number; seconds: number } | null>(null);
  const gatherLastSeenRef = useRef(Date.now());
  const [summonMessage, setSummonMessage] = useState("");
  const [summonStorage, setSummonStorage] = useState<SummonStorageItem[]>(() => {
    try { const saved = loadJson<SummonStorageItem[]>(STORAGE_KEYS.summonStorage, []); return savedSummons(saved); } catch { return []; }
  });
  const [heroSouls, setHeroSouls] = useState<Record<string, number>>(() => {
    try { const saved = loadJson<Record<string, number>>(STORAGE_KEYS.heroSouls, {}); return DEV_MODE ? Object.fromEntries(HEROES.map(hero => [hero.id, 30])) : savedCounts(saved, 30); } catch { return {}; }
  });
  const [soulShards, setSoulShards] = useState(() => Math.max(0, loadNumber(STORAGE_KEYS.soulShards, DEV_MODE ? 999999 : 0)));
  const [transcendShards, setTranscendShards] = useState(() => Math.max(0, loadNumber(STORAGE_KEYS.transcendShards, DEV_MODE ? 999999 : 0)));
  const [fusionRecords, setFusionRecords] = useState<string[]>(() => {
    try { const saved = loadJson<string[]>(STORAGE_KEYS.fusionRecords, []); return savedIds(saved, new Set(["unknown-01", "unknown-02", "devWukong"])); } catch { return []; }
  });
  const summonUidRef = useRef(Math.max(Date.now(), ...summonStorage.map(item => item.uid + 1)));
  const [legendPity, setLegendPity] = useState(() => Math.max(0, loadNumber(STORAGE_KEYS.legendPity, 0)));
  const [mythPity, setMythPity] = useState(() => Math.max(0, loadNumber(STORAGE_KEYS.mythPity, 0)));
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
  const [gameSpeed, setGameSpeed] = useState(5);
  const [autoCom, setAutoCom] = useState(false);
  const [battleDeckPage, setBattleDeckPage] = useState<0 | 1>(0);
  const [deployCooldowns, setDeployCooldowns] = useState<Record<string, number>>({});
  const deployCooldownsRef = useRef<Record<string, number>>({});
  const nextUidRef = useRef(1);
  const autoTickRef = useRef<() => void>(() => {});
  const deckSlotCount = 10;
  const visibleDeck = useMemo(() => {
    const equipped = deckIds.map((id) => HEROES.find((hero) => hero.id === id)).filter(Boolean) as UnitDef[];
    return equipped;
  }, [deckIds]);
  const economyMaxLevel = ECONOMY_MAX_LEVEL;
  const { battleGoldMax, goldPerSecond, trainingBonus, battleStartGold, economyUpgradeCost } =
    getBattleEconomy(economyLevel, facilityLevels.vault, facilityLevels.training);

  const {
    kingdomUpgradeCost, kingdomProductionBonus, kingdomSellBonus, kingdomUnlocks, nextKingdomUnlock,
    kingdomMilestone, facilityDefs, facilityUpgradeCost, upgradeKingdom, upgradeFacility
  } = useKingdomController({
    kingdomLevel, setKingdomLevel, kingdomGold, setKingdomGold, facilityLevels, setFacilityLevels
  });

  const getUnitLevel = (id: string) => Math.max(1, unitLevels[id] ?? 1);
  const getGradeGrowth = (id: string) => {
    const grade = getHeroGrade(id).name;
    return GRADE_GROWTH[grade] ?? 0.08;
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
  const getSoulBonuses = (id: string) => calculateSoulBonuses(heroSouls[id] ?? 0);

  const {
    gatherRegions, gatherRegionScale, isGatherRegionUnlocked,
    getGatherEfficiency, getAutoGatherAmount, getGatherAttackDamage, gatherResource, sellResource, assignWorker
  } = useGatheringController({
    heroes: HEROES, clearedStages, devMode: DEV_MODE, gatherRegion, resources, setResources, workers, setWorkers,
    gatherHp, setGatherHp, setGatherHit, kingdomSellBonus, kingdomProductionBonus,
    facilityLevels, setKingdomGold, gatherLastSeenRef, getUnitLevel, getLevelMultiplier, getHeroGrade,
    gatherMaxHp, gatherReward
  });


  const upgradeUnit = (id: string) => {
    const level = getUnitLevel(id);
    const cost = getUpgradeCost(id);
    if (level >= 10 || kingdomGold < cost) return;
    const next = { ...unitLevels, [id]: level + 1 };
    setUnitLevels(next);
    setKingdomGold((gold) => {
      const nextGold = gold - cost;
      saveNumber(STORAGE_KEYS.kingdomGold, nextGold);
      return nextGold;
    });
    saveJson(STORAGE_KEYS.unitLevels, next);
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
    if (battleState !== "playing" || goldRef.current < def.cost || (deployCooldownsRef.current[def.id] ?? 0) > 0 || heroesRef.current.length >= 50) return;
    const uid = nextUidRef.current++;
    const level = getUnitLevel(def.id);
    const statMultiplier = getLevelMultiplier(def.id, level);
    const soulBonus = getSoulBonuses(def.id);
    const upgradedDef: UnitDef = {
      ...def,
      hp: Math.round(def.hp * statMultiplier * soulBonus.hp * trainingBonus),
      atk: Math.round(def.atk * statMultiplier * soulBonus.atk * trainingBonus),
      attackInterval: Math.max(0.25, Number((def.attackInterval * soulBonus.speed).toFixed(3)))
    };
    goldRef.current = Math.max(0, goldRef.current - def.cost);
    setBattleGold(goldRef.current);
    deployCooldownsRef.current = { ...deployCooldownsRef.current, [def.id]: def.cooldown };
    setDeployCooldowns((cooldowns) => ({ ...cooldowns, [def.id]: def.cooldown }));
    const deployed = makeUnit(upgradedDef, "hero", 9 + Math.random() * 7, uid);
    if (def.id === "devWukong") {
      const front = enemiesRef.current.filter((enemy) => enemy.currentHp > 0).sort((a, b) => a.x - b.x)[0];
      if (front) {
        enemiesRef.current = enemiesRef.current.map((enemy) => enemy.currentHp > 0 && Math.abs(enemy.x - front.x) <= 25
          ? { ...enemy, currentHp: Math.max(0, enemy.currentHp - upgradedDef.atk * 1.8), slowTimer: 3, slowMultiplier: 0.3 }
          : enemy);
        setEnemies(enemiesRef.current);
        deployed.wukongOpenerUsed = true;
      }
    }
    heroesRef.current = [...heroesRef.current, deployed];
    setHeroes((list) => [...list, deployed]);
    setNotice(def.id === "devWukong" ? "손오공 강림 · 여의신철!" : `${def.name} 출전!`);
  }, [battleState, unitLevels, heroSouls, trainingBonus]);

  autoTickRef.current = () => {
      const activeCount = heroesRef.current.filter((hero) => hero.currentHp > 0).length;
      const currentGold = goldRef.current;
      if (activeCount >= 50) return;
      const ready = visibleDeck
        .filter((hero) => (deployCooldownsRef.current[hero.id] ?? 0) <= 0 && currentGold >= hero.cost)
        .sort((a, b) => {
          const roleScore = (hero: UnitDef) => hero.role.includes("탱") || hero.ability === "guard" ? 3 : hero.rangeType === "ranged" ? 2 : 1;
          if (activeCount < 4) return roleScore(b) - roleScore(a) || a.cost - b.cost;
          return b.atk / Math.max(1, b.cost) - a.atk / Math.max(1, a.cost);
        });
      if (ready[0]) { deploy(ready[0]); return; }
      if (economyLevel < economyMaxLevel && currentGold >= economyUpgradeCost && !visibleDeck.some(hero => (deployCooldownsRef.current[hero.id] ?? 0) <= 0 && hero.cost <= battleGoldMax)) upgradeEconomy();
  };
  useEffect(() => {
    if (!autoCom || battleState !== "playing") return;
    const timer = window.setInterval(() => autoTickRef.current(), 650);
    return () => window.clearInterval(timer);
  }, [autoCom, battleState]);

  useEffect(() => {
    if (battleState !== "playing") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test((event.target as HTMLElement)?.tagName ?? "")) return;
      const index = event.code.startsWith("Numpad") ? Number(event.code.slice(6)) : /^Digit[0-9]$/.test(event.code) ? Number(event.code.slice(5)) : NaN;
      if (!Number.isInteger(index)) return;
      const hero = visibleDeck[index === 0 ? 9 : index - 1];
      if (hero) { event.preventDefault(); deploy(hero); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [battleState, visibleDeck, deploy]);

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
  const victoryAwardedRef = useRef(false);
  const bossSummonTimerRef = useRef(0);
  const bossEnrageTriggeredRef = useRef(false);
  const bossFieldTickRef = useRef(1);
  const bossChargeRef = useRef(0);
  const bossPhaseRef = useRef(-1);
  const bossSpawnAnnouncedRef = useRef(false);

  useEffect(() => { heroesRef.current = heroes; }, [heroes]);
  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);
  useEffect(() => { goldRef.current = battleGold; }, [battleGold]);
  useEffect(() => { deployCooldownsRef.current = deployCooldowns; }, [deployCooldowns]);
  useEffect(() => { castleRef.current = castleHp; }, [castleHp]);
  useEffect(() => { enemyCastleRef.current = enemyCastleHp; }, [enemyCastleHp]);
  useGatheringProduction({
    active: battleState === "stageSelect",
    workers,
    setResources,
    setOfflineGather,
    lastSeenRef: gatherLastSeenRef,
    getAutoAmount: getAutoGatherAmount,
    dependencies: [facilityLevels.lumber, facilityLevels.quarry, kingdomProductionBonus]
  });


  useBattleLoop({ battleState, gameSpeed, clearedStages, setCastleHit, setDamagePopups, setDeathEffects, goldRef, battleGoldMax, goldPerSecond, setBattleGold, spawnTimerRef, setDeployCooldowns, heroesRef, enemiesRef, stageRef, waveRef, spawnRef, uidRef, bossSpawnAnnouncedRef, setNotice, bossSummonTimerRef, bossEnrageTriggeredRef, bossFieldTickRef, bossChargeRef, bossPhaseRef, enemyCastleRef, setEnemyCastleHp, popupUidRef, castleRef, setCastleHp, deathUidRef, setHeroes, setEnemies, finalClearNotifiedRef, victoryAwardedRef, setWaveIndex, setUnlockedStage, setClearedStages, setGems, setKingdomGold, setBattleState, setBattleReward });

  const selectStage = (nextStageIndex: number) => {
    if (nextStageIndex < 0 || nextStageIndex >= STAGES.length || (!DEV_MODE && nextStageIndex >= unlockedStage)) return;
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
    victoryAwardedRef.current = false;
    bossSummonTimerRef.current = 0;
    bossEnrageTriggeredRef.current = false;
    bossFieldTickRef.current = 1;
    bossChargeRef.current = 0;
    bossPhaseRef.current = -1;
    bossSpawnAnnouncedRef.current = false;
    setStageIndex(nextStageIndex);
    setBattleGold(battleStartGold);
    setEconomyLevel(1);
    setBattleDeckPage(0);
    nextUidRef.current = 1;
    setWaveIndex(0);
    setHeroes([]);
    setEnemies([]);
    setCastleHp(1000);
    setEnemyCastleHp(nextStage.enemyCastleHp);
    setCastleHit(null);
    setDamagePopups([]);
    popupUidRef.current = 1;
    setBattleReward(null);
    setBattleState("playing");
    setDeployCooldowns({});
    deployCooldownsRef.current = {};
    setNotice(`STAGE ${nextStage.id} · ${nextStage.name} 시작!`);
  };

  const currentStage = STAGES[stageIndex] ?? STAGES[0];
  const currentWave = currentStage.waves[waveIndex];

  const {
    performSummon, nextSummonReveal, skipSummonReveal, useStoredHero, soulStoredHero, shardStoredHero,
    bulkUseStoredHeroes, bulkSoulStoredHeroes, bulkShardStoredHeroes, buyHeroSoulWithShards,
    fusionRecipes, performFusion
  } = useSummonController({
    heroes: HEROES, gems, setGems, legendPity, setLegendPity, mythPity, setMythPity,
    storage: summonStorage, setStorage: setSummonStorage, owned: ownedHeroes, setOwned: setOwnedHeroes,
    heroSouls, setHeroSouls, soulShards, setSoulShards, transcendShards, setTranscendShards,
    fusionRecords, setFusionRecords, phase: summonPhase, setPhase: setSummonPhase,
    sequence: summonSequence, setSequence: setSummonSequence, revealIndex: summonRevealIndex,
    setRevealIndex: setSummonRevealIndex, setSummaryOpen: setSummonSummaryOpen,
    setResults: setLastSummonResults, setMessage: setSummonMessage, uidRef: summonUidRef,
    getGrade: (id) => getHeroGrade(id)
  });

  const toggleDeckHero = (id: string) => {
    if (!ownedHeroes.includes(id)) return;
    if (deckIds.includes(id)) {
      if (deckIds.length <= 1) return;
      const next = deckIds.filter((value) => value !== id);
      setDeckIds(next);
      saveJson(STORAGE_KEYS.deckIds, next);
      return;
    }
    if (deckIds.length >= deckSlotCount) return;
    const next = [...deckIds, id];
    setDeckIds(next);
    saveJson(STORAGE_KEYS.deckIds, next);
  };
  const setDeckSlot = (slotIndex: number, heroId: string) => {
    if (!ownedHeroes.includes(heroId)) return;
    if (!deckIds.includes(heroId) && deckIds.length >= deckSlotCount) {
      const next = [...deckIds];
      next[slotIndex] = heroId;
      setDeckIds(next);
      saveJson(STORAGE_KEYS.deckIds, next);
      return;
    }
    const next = deckIds.filter((id) => id !== heroId);
    const displaced = deckIds[slotIndex];
    next.splice(Math.min(slotIndex, next.length), 0, heroId);
    if (displaced && displaced !== heroId && !next.includes(displaced) && next.length < deckSlotCount) next.push(displaced);
    const trimmed = next.slice(0, deckSlotCount);
    setDeckIds(trimmed);
    saveJson(STORAGE_KEYS.deckIds, trimmed);
  };
  const removeDeckSlot = (slotIndex: number) => {
    const next = deckIds.filter((_, index) => index !== slotIndex);
    if (next.length === 0) return;
    setDeckIds(next);
    saveJson(STORAGE_KEYS.deckIds, next);
  };

  useEffect(() => {
    const ownedSet = new Set(ownedHeroes);
    const valid = deckIds.filter((id) => HEROES.some((hero) => hero.id === id) && ownedSet.has(id));
    const next = valid.slice(0, deckSlotCount);
    if (next.length !== deckIds.length || next.some((id, index) => id !== deckIds[index])) {
      setDeckIds(next);
      saveJson(STORAGE_KEYS.deckIds, next);
    }
  }, [ownedHeroes, deckSlotCount]);

  const progressionGoals = getProgressionGoals({
    clearedStages,
    wood: resources.wood,
    stone: resources.stone,
    kingdomLevel,
    ownedHeroCount: ownedHeroes.length,
    unitLevels,
    facilityLevels,
  });
  const completedGoalCount = progressionGoals.filter((goal) => goal.done).length;
  const claimedGoalCount = progressionGoals.filter((goal) => claimedGoals.includes(goal.id)).length;
  const nextProgressionGoal = progressionGoals.find((goal) => !goal.done) ?? progressionGoals.find((goal) => !claimedGoals.includes(goal.id));
  const claimGoalReward = (goal: typeof progressionGoals[number]) => {
    if (!goal.done || claimedGoals.includes(goal.id)) return;
    const nextClaimed = [...claimedGoals, goal.id];
    setClaimedGoals(nextClaimed);
    saveJson(STORAGE_KEYS.claimedGoals, nextClaimed);
    if (goal.gold > 0) {
      setKingdomGold((current) => {
        const next = current + goal.gold;
        saveNumber(STORAGE_KEYS.kingdomGold, next);
        return next;
      });
    }
    if (goal.gems > 0) {
      setGems((current) => {
        const next = current + goal.gems;
        saveNumber(STORAGE_KEYS.gems, next);
        return next;
      });
    }
  };

  const currentWaveTotal = currentWave?.reduce((sum, group) => sum + group.count, 0) ?? 0;
  const currentWaveSpawned = waveIndex === waveRef.current ? spawnRef.current : 0;
  const waveProgress = currentWaveTotal > 0 ? (currentWaveSpawned / currentWaveTotal) * 100 : 0;
  const currentBossKey = BOSS_ENEMY_KEYS[currentStage.id];
  const currentBossUnitId = currentBossKey ? ENEMY_MAP[currentBossKey].id : undefined;
  const bossUnit = currentStage.waveMeta[waveIndex]?.boss && currentBossUnitId ? enemies.find((unit) => unit.id === currentBossUnitId) : undefined;
  const bossDisplayName = currentStage.bossName ?? bossUnit?.name ?? "BOSS";
  const bossDisplayIcon = currentBossKey ? ENEMY_MAP[currentBossKey].sprite : "👹";
  const bossHpPercent = bossUnit ? clamp((bossUnit.currentHp / bossUnit.hp) * 100, 0, 100) : 0;
  const bossPhaseTwo = Boolean(bossUnit && bossUnit.currentHp / bossUnit.hp <= 0.5);
  const waveThreat = currentWave?.some((group) => group.enemy === "assassin")
    ? "⚠ 암살자 · 원거리 후열 우선 공격"
    : currentWave?.some((group) => group.enemy === "fireMage")
      ? "⚠ 사술사 · 광역 공격"
      : currentWave?.some((group) => group.enemy === "archer")
        ? "⚠ 적 원거리 지원"
        : currentStage.waveMeta[waveIndex]?.boss
          ? currentStage.id === 20 ? "🌑 모르가르 · 공격 오라 / 흑기사 증원"
            : currentStage.id === 30 ? "🔥 이그니스 · 전장 지속 피해 / 화염 증원"
            : currentStage.id === 40 ? "⚡ 볼트라스 · 전하 축적 / 공격속도 증가"
            : currentStage.id === 50 ? "⚪ 아르카논 · 5단계 속성 페이즈 / 균열 증원"
            : "⚠ BOSS · 강력한 특수 공격"
          : "";

  if (battleState === "stageSelect") {
    return (
      <main className="stage-select-shell">
        <section className="stage-select-card main-hub-card">
          <div className="stage-select-kicker">BREAK THE WALLS</div>
          {DEV_MODE && <div className="stage-select-kicker">🛠 DEV TEST · 전체 영웅 Lv.10 / 영혼 +30 · 모든 스테이지 해금</div>}
          <h1>{mainTab === "home" ? "KINGDOM" : mainTab === "gather" ? "GATHER" : mainTab === "battle" ? "BATTLE" : mainTab === "heroes" ? "HEROES" : "SUMMON"}</h1>
          <div className="stage-select-stats">
            <span>🏯 영지 Lv.<b>{kingdomLevel}</b></span>
            <span>💎 <b>{gems.toLocaleString()}</b></span>
            <span>🪙 <b>{kingdomGold.toLocaleString()}</b></span>
            <span>🏆 <b>{clearedStages.length}/{STAGES.length}</b></span>
          </div>

          {mainTab === "home" && <KingdomPanel
            kingdomLevel={kingdomLevel} kingdomGold={kingdomGold} kingdomProductionBonus={kingdomProductionBonus} kingdomSellBonus={kingdomSellBonus}
            unlockedStage={unlockedStage} stageCount={STAGES.length} currentStageName={STAGES[Math.min(unlockedStage, STAGES.length)-1]?.name}
            ownedHeroCount={ownedHeroes.length} heroCount={HEROES.length} deckCount={deckIds.length} deckSlotCount={deckSlotCount}
            progressionGoals={progressionGoals} claimedGoals={claimedGoals} completedGoalCount={completedGoalCount} claimedGoalCount={claimedGoalCount}
            nextGoalText={nextProgressionGoal?.text ?? "현재 준비된 진행 목표 완료"} kingdomUnlocks={kingdomUnlocks}
            nextKingdomUnlock={nextKingdomUnlock} kingdomMilestone={kingdomMilestone} facilityDefs={facilityDefs} facilityLevels={facilityLevels}
            kingdomUpgradeCost={kingdomUpgradeCost} facilityUpgradeCost={facilityUpgradeCost} onClaimGoal={claimGoalReward}
            onUpgradeKingdom={upgradeKingdom} onUpgradeFacility={upgradeFacility} onBattle={() => setMainTab("battle")}
          />}

          {mainTab === "gather" && <GatheringPanel
            resources={resources} offlineGather={offlineGather} onDismissOffline={() => setOfflineGather(null)}
            gatherRegion={gatherRegion} onRegion={(key) => { setGatherRegion(key); const region = gatherRegions[key]; setGatherHp({ wood: gatherMaxHp.wood * region.scale, stone: gatherMaxHp.stone * region.scale }); }}
            isRegionUnlocked={isGatherRegionUnlocked} gatherHp={gatherHp} gatherMaxHp={gatherMaxHp} gatherReward={gatherReward} gatherHit={gatherHit}
            workers={workers} heroes={HEROES} ownedHeroes={ownedHeroes} kingdomSellBonus={kingdomSellBonus}
            getEfficiency={getGatherEfficiency} getAttackDamage={getGatherAttackDamage} getAutoAmount={getAutoGatherAmount}
            onGather={gatherResource} onSell={sellResource} onAssign={assignWorker}
          />}

          {mainTab === "battle" && <StageSelectPanel stages={STAGES} unlockedStage={unlockedStage} clearedStages={clearedStages} devMode={DEV_MODE} onSelect={selectStage} />}

          {mainTab === "heroes" && <HeroesPanel
            heroes={HEROES} ownedHeroes={ownedHeroes} deckIds={deckIds} deckSlotCount={deckSlotCount}
            heroMode={heroMode} setHeroMode={setHeroMode} formationPage={formationPage} setFormationPage={setFormationPage}
            dragHeroId={dragHeroId} setDragHeroId={setDragHeroId} touchY={formationTouchY} setDeckSlot={setDeckSlot} removeDeckSlot={removeDeckSlot}
            selectedHeroId={selectedHeroId} setSelectedHeroId={setSelectedHeroId} kingdomGold={kingdomGold} soulShards={soulShards}
            heroSouls={heroSouls} getLevel={getUnitLevel} getMultiplier={getLevelMultiplier} getPower={getHeroPower}
            getSoulBonus={getSoulBonuses} getUpgradeCost={getUpgradeCost} getGrade={getHeroGrade} getGrowth={getGradeGrowth}
            getTrait={getHeroTrait} upgradeUnit={upgradeUnit} buySoul={buyHeroSoulWithShards}
          />}

          {mainTab === "summon" && <SummonPanel
            heroes={HEROES} phase={summonPhase} sequence={summonSequence} revealIndex={summonRevealIndex}
            summaryOpen={summonSummaryOpen} results={lastSummonResults} gems={gems} soulShards={soulShards} transcendShards={transcendShards}
            legendPity={legendPity} mythPity={mythPity} message={summonMessage} storageCount={summonStorage.length}
            fusionCount={fusionRecords.length} fusionTotal={fusionRecipes.length} ownedCount={ownedHeroes.length}
            onSkip={skipSummonReveal} onNext={nextSummonReveal} onCloseSummary={() => setSummonSummaryOpen(false)}
            onSummon={performSummon} onStorage={() => setMainTab("storage")} onFusion={() => setMainTab("fusion")}
          />}

          {mainTab === "storage" && <StoragePanel
            heroes={HEROES} items={summonStorage} ownedHeroes={ownedHeroes} heroSouls={heroSouls}
            soulShards={soulShards} transcendShards={transcendShards} onBack={() => setMainTab("summon")}
            onBulkUse={bulkUseStoredHeroes} onBulkSoul={bulkSoulStoredHeroes} onBulkShard={bulkShardStoredHeroes}
            onUse={useStoredHero} onSoul={soulStoredHero} onShard={shardStoredHero}
          />}

          {mainTab === "fusion" && <FusionPanel
            heroes={HEROES} recipes={fusionRecipes} records={fusionRecords} ownedHeroes={ownedHeroes}
            transcendShards={transcendShards} onBack={() => setMainTab("summon")} onFusion={performFusion}
          />}

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

  return <BattleScreen
    stage={currentStage} stageIndex={stageIndex} unlockedStage={unlockedStage} battleState={battleState} battleReward={battleReward}
    castleHp={castleHp} enemyCastleHp={enemyCastleHp} battleGold={battleGold} battleGoldMax={battleGoldMax}
    economyLevel={economyLevel} economyMaxLevel={economyMaxLevel} goldPerSecond={goldPerSecond} economyUpgradeCost={economyUpgradeCost}
    waveIndex={waveIndex} gameSpeed={gameSpeed} autoCom={autoCom} heroes={heroes} enemies={enemies}
    deathEffects={deathEffects} damagePopups={damagePopups} castleHit={castleHit} bossPhaseTwo={bossPhaseTwo}
    bossDisplayIcon={bossDisplayIcon} bossDisplayName={bossDisplayName} bossHpPercent={bossHpPercent} bossUnit={bossUnit}
    bossDefeated={Boolean(bossSpawnAnnouncedRef.current && !bossUnit)} battleDeckPage={battleDeckPage} onDeckPage={setBattleDeckPage}
    bossCharge={bossChargeRef.current} bossPhase={bossPhaseRef.current} waveProgress={waveProgress} notice={notice} waveThreat={waveThreat}
    visibleDeck={visibleDeck} deployCooldowns={deployCooldowns} deckCount={visibleDeck.length} deckSlotCount={deckSlotCount}
    kingdomLevel={kingdomLevel} ownedHeroCount={ownedHeroes.length} heroTotal={HEROES.length} getUnitLevel={getUnitLevel}
    onSpeed={() => setGameSpeed(v => v === 1 ? 5 : 1)} onAuto={() => setAutoCom(v => !v)}
    onUpgradeEconomy={upgradeEconomy} onDeploy={deploy} onRetry={() => reset(stageIndex)}
    onStageSelect={() => setBattleState("stageSelect")} onNext={() => reset(stageIndex + 1)}
  />;
}

export default App;
