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
import { KingdomPanel } from "./components/KingdomPanel";
import { GatheringPanel } from "./components/GatheringPanel";
import { HeroesPanel } from "./components/HeroesPanel";
import { SummonPanel } from "./components/SummonPanel";
import { StoragePanel } from "./components/StoragePanel";
import { FusionPanel } from "./components/FusionPanel";
import { StageSelectPanel } from "./components/StageSelectPanel";
import { KINGDOM_UNLOCKS, FACILITY_DEFS, type FacilityKey } from "./game/systems/kingdom";
import { GATHER_REGIONS, getAutoGatherAmount as calculateAutoGatherAmount, getGatherAttackDamage as calculateGatherAttackDamage, getGatherEfficiency as calculateGatherEfficiency, getResourceSellPrice, type GatherRegionKey } from "./game/systems/gathering";
import { getHeroGradeByIndex, GRADE_GROWTH, GATHER_GRADE_BONUS, getSoulBonuses as calculateSoulBonuses, getHeroTrait } from "./game/systems/heroGrowth";
import { getProgressionGoals } from "./game/systems/progression";
import { applySummonPity, rollSummonGrade, SHARD_VALUE, type SummonGrade, type SummonStorageItem } from "./game/systems/summon";
import { ECONOMY_MAX_LEVEL, getBattleEconomy } from "./game/systems/battleEconomy";

type DamagePopup = { id: number; x: number; value: number; critical: boolean; };
type DeathEffect = { id: number; x: number; team: "hero" | "enemy"; life: number; };
const DEV_MODE = true;

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
  const [claimedGoals, setClaimedGoals] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("btw-claimed-goals") ?? "[]");
      return Array.isArray(saved) ? saved.filter((id) => typeof id === "string") : [];
    } catch { return []; }
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
  const [autoCom, setAutoCom] = useState(false);
  const [deployCooldowns, setDeployCooldowns] = useState<Record<string, number>>({});
  const deployCooldownsRef = useRef<Record<string, number>>({});
  const deckSlotCount = 10;
  const visibleDeck = useMemo(() => deckIds.map((id) => HEROES.find((hero) => hero.id === id)).filter(Boolean) as UnitDef[], [deckIds]);
  const economyMaxLevel = ECONOMY_MAX_LEVEL;
  const { battleGoldMax, goldPerSecond, trainingBonus, battleStartGold, economyUpgradeCost } =
    getBattleEconomy(economyLevel, facilityLevels.vault, facilityLevels.training);

  const kingdomUpgradeCost = 400 * kingdomLevel;
  const kingdomProductionBonus = 1 + Math.floor((kingdomLevel - 1) / 2) * 0.25;
  const kingdomSellBonus = 1 + Math.floor((kingdomLevel - 1) / 3) * 0.1;
  const kingdomUnlocks = KINGDOM_UNLOCKS;
  const nextKingdomUnlock = kingdomUnlocks.find((entry) => entry.level > kingdomLevel);
  const kingdomMilestone = nextKingdomUnlock ? `Lv.${nextKingdomUnlock.level} · ${nextKingdomUnlock.title}` : "현재 준비된 왕국 해금 완료";
  const facilityDefs = FACILITY_DEFS;
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
  const gatherRegions = GATHER_REGIONS;
  const activeGatherRegion = gatherRegions[gatherRegion as GatherRegionKey];
  const gatherRegionScale = activeGatherRegion.scale;
  const isGatherRegionUnlocked = (key: GatherRegionKey) => gatherRegions[key].unlockStage === 0 || clearedStages.includes(gatherRegions[key].unlockStage);
  const getGatherAttackDamage = (type: "wood" | "stone") => {
    const heroId = workers[type];
    const hero = heroId ? HEROES.find((unit) => unit.id === heroId) : undefined;
    return calculateGatherAttackDamage(type, hero?.atk, hero ? getLevelMultiplier(hero.id) : 1);
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
    const unitPrice = getResourceSellPrice(type, kingdomSellBonus);
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
  const getHeroGrade = (id: string) => getHeroGradeByIndex(DECK_IDS.indexOf(id));
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
  const getGatherEfficiency = (heroId?: string) => {
    if (!heroId) return 1;
    const grade = getHeroGrade(heroId).name;
    return calculateGatherEfficiency(getUnitLevel(heroId), GATHER_GRADE_BONUS[grade] ?? 1);
  };
  const getAutoGatherAmount = (type: "wood" | "stone") => {
    const heroId = workers[type];
    if (!heroId) return 0;
    const facilityLevel = type === "wood" ? facilityLevels.lumber : facilityLevels.quarry;
    return calculateAutoGatherAmount(facilityLevel, kingdomProductionBonus, getGatherEfficiency(heroId));
  };

  const getSoulBonuses = (id: string) => calculateSoulBonuses(heroSouls[id] ?? 0);


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

  useEffect(() => {
    if (!autoCom || battleState !== "playing") return;
    const timer = window.setInterval(() => {
      const activeCount = heroesRef.current.filter((hero) => hero.currentHp > 0).length;
      const currentGold = goldRef.current;
      const reserveForUpgrade = economyLevel < economyMaxLevel ? economyUpgradeCost : 0;
      if (economyLevel < economyMaxLevel && currentGold >= economyUpgradeCost && (economyLevel < 3 || currentGold >= economyUpgradeCost + 350)) {
        upgradeEconomy();
        return;
      }
      if (activeCount >= 50) return;
      const ready = visibleDeck
        .filter((hero) => (deployCooldownsRef.current[hero.id] ?? 0) <= 0 && currentGold >= hero.cost)
        .sort((a, b) => {
          const roleScore = (hero: UnitDef) => hero.role.includes("탱") || hero.ability === "guard" ? 3 : hero.rangeType === "ranged" ? 2 : 1;
          if (activeCount < 4) return roleScore(b) - roleScore(a) || a.cost - b.cost;
          return b.atk / Math.max(1, b.cost) - a.atk / Math.max(1, a.cost);
        });
      const affordable = ready.find((hero) => economyLevel >= economyMaxLevel || currentGold - hero.cost >= Math.min(reserveForUpgrade, 250));
      if (affordable) deploy(affordable);
    }, 650);
    return () => window.clearInterval(timer);
  }, [autoCom, battleState, economyLevel, economyUpgradeCost, economyMaxLevel, visibleDeck, deployCooldowns, deploy]);

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
        if (waveMeta?.boss && stage.bossName && !bossSpawnAnnouncedRef.current && ["morgarE", "ignisE", "voltrasE", "arcanonE"].includes(enemyDef.id)) {
          bossSpawnAnnouncedRef.current = true;
          setNotice(`⚠ BOSS 등장 · ${stage.bossName}`);
        }
        spawnRef.current += 1;
        spawnTimerRef.current = group.gap ?? 0.8;
      }

      const bossMechanic = stage.bossMechanic;
      const bossWaveActive = Boolean(waveMeta?.boss && bossMechanic);
      if (bossWaveActive && bossMechanic?.summonEnemy && bossMechanic.summonInterval) {
        bossSummonTimerRef.current -= dt;
        if (bossSummonTimerRef.current <= 0 && spawnRef.current >= totalInWave) {
          const summonDef = ENEMY_MAP[bossMechanic.summonEnemy];
          const summonScale = 1 + stageRef.current * STAGE_HP_SCALE;
          const summon = makeUnit({ ...summonDef, hp: Math.round(summonDef.hp * summonScale), atk: Math.round(summonDef.atk * summonScale) }, "enemy", 91, 1000 + uidRef.current++);
          nextEnemies.push(summon);
          bossSummonTimerRef.current = bossMechanic.summonInterval;
          setNotice(`${stage.bossName ?? "BOSS"} · 증원!`);
        }
      }
      if (bossWaveActive && bossMechanic?.auraAtk) {
        nextEnemies = nextEnemies.map((enemy) => ({ ...enemy, atk: enemy.atk * (1 + bossMechanic.auraAtk! * dt * 0.15) }));
      }
      if (bossWaveActive && bossMechanic?.deathEnrage && !bossEnrageTriggeredRef.current && spawnRef.current >= totalInWave && nextEnemies.length === 0) {
        bossEnrageTriggeredRef.current = true;
        spawnTimerRef.current = Math.min(spawnTimerRef.current, 0.35);
        setNotice(`${stage.bossName ?? "BOSS"} 격파 · 남은 군세 광폭화!`);
      }

      if (bossWaveActive && bossMechanic?.fieldDamagePerSecond) {
        bossFieldTickRef.current -= dt;
        if (bossFieldTickRef.current <= 0) {
          nextHeroes = nextHeroes.map((hero) => ({ ...hero, currentHp: Math.max(0, hero.currentHp - bossMechanic.fieldDamagePerSecond!) }));
          bossFieldTickRef.current = 1;
        }
      }
      if (bossWaveActive && bossMechanic?.enemyAttackSpeedPerStack) {
        bossChargeRef.current += dt;
        const stacks = Math.min(10, Math.floor(bossChargeRef.current / 4));
        const speedMultiplier = Math.max(0.55, 1 - stacks * bossMechanic.enemyAttackSpeedPerStack);
        nextEnemies = nextEnemies.map((enemy) => ({ ...enemy, attackTimer: Math.min(enemy.attackTimer, enemy.attackInterval * speedMultiplier) }));
      }
      if (bossWaveActive && bossMechanic?.phaseElements?.length) {
        const progress = 1 - enemyCastleRef.current / Math.max(1, stage.enemyCastleHp);
        const phaseIndex = Math.min(bossMechanic.phaseElements.length - 1, Math.floor(progress * bossMechanic.phaseElements.length));
        if (phaseIndex !== bossPhaseRef.current) {
          bossPhaseRef.current = phaseIndex;
          const phase = bossMechanic.phaseElements[phaseIndex];
          setNotice(`${stage.bossName ?? "BOSS"} · ${phase} 페이즈`);
          if (phaseIndex > 0 && bossMechanic.summonEnemy) {
            const phaseDef = ENEMY_MAP[bossMechanic.summonEnemy];
            nextEnemies.push(makeUnit({ ...phaseDef, hp: Math.round(phaseDef.hp * (1 + phaseIndex * 0.35)), atk: Math.round(phaseDef.atk * (1 + phaseIndex * 0.25)) }, "enemy", 90, 1000 + uidRef.current++));
          }
        }
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
    bossSummonTimerRef.current = 0;
    bossEnrageTriggeredRef.current = false;
    bossFieldTickRef.current = 1;
    bossChargeRef.current = 0;
    bossPhaseRef.current = -1;
    bossSpawnAnnouncedRef.current = false;
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

  const summonGrade = (minimumHero = false): SummonGrade => rollSummonGrade(minimumHero);
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
      const pityResult = applySummonPity(nextLegendPity, nextMythPity, summonGrade(count === 11 && index === count - 1));
      const grade = pityResult.grade;
      nextLegendPity = pityResult.legendPity;
      nextMythPity = pityResult.mythPity;
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
    const nextShards = soulShards + SHARD_VALUE[item.grade];
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
    const targets = summonStorage.filter((item) => allowed.has(item.grade));
    if (!targets.length) return;
    const gain = targets.reduce((sum, item) => sum + SHARD_VALUE[item.grade], 0);
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
    window.localStorage.setItem("btw-claimed-goals", JSON.stringify(nextClaimed));
    if (goal.gold > 0) {
      setKingdomGold((current) => {
        const next = current + goal.gold;
        window.localStorage.setItem("btw-kingdom-gold", String(next));
        return next;
      });
    }
    if (goal.gems > 0) {
      setGems((current) => {
        const next = current + goal.gems;
        window.localStorage.setItem("btw-gems", String(next));
        return next;
      });
    }
  };

  const currentWaveTotal = currentWave?.reduce((sum, group) => sum + group.count, 0) ?? 0;
  const currentWaveSpawned = waveIndex === waveRef.current ? spawnRef.current : 0;
  const waveProgress = currentWaveTotal > 0 ? (currentWaveSpawned / currentWaveTotal) * 100 : 0;
  const bossUnitIds: Record<number, string> = { 9: "fireOgreE", 20: "morgarE", 30: "ignisE", 40: "voltrasE", 50: "arcanonE" };
  const currentBossUnitId = bossUnitIds[currentStage.id];
  const bossUnit = currentStage.waveMeta[waveIndex]?.boss && currentBossUnitId ? enemies.find((unit) => unit.id === currentBossUnitId) : undefined;
  const bossDisplayName = currentStage.bossName ?? bossUnit?.name ?? "BOSS";
  const bossDisplayIcon = currentStage.id === 20 ? "🌑" : currentStage.id === 30 ? "🔥" : currentStage.id === 40 ? "⚡" : currentStage.id === 50 ? "⚪" : "👹";
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
          <button className="stat-pill speed-control" onClick={() => setGameSpeed((v) => v === 1 ? 5 : 1)}>⚡ {gameSpeed}X</button><button className={`stat-pill auto-com-control ${autoCom ? "active" : ""}`} onClick={() => setAutoCom((value) => !value)}>🤖 AUTO {autoCom ? "ON" : "OFF"}</button>
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
              <div className="boss-title">{bossDisplayIcon} BOSS · {bossDisplayName} {bossPhaseTwo ? "· ENRAGED" : ""}</div>
              <div className="boss-hp"><span style={{ width: `${bossHpPercent}%` }} /></div>
              <div className="boss-hp-text">{bossUnit ? `${Math.ceil(bossUnit.currentHp)} / ${bossUnit.hp}` : "등장 준비 중"}</div>
              {bossUnit && <div className="boss-mechanic-status">{currentStage.id === 40 ? `전하 ${Math.min(10, Math.floor(bossChargeRef.current / 4))}/10` : currentStage.id === 50 && currentStage.bossMechanic?.phaseElements ? `현재 페이즈 · ${currentStage.bossMechanic.phaseElements[Math.max(0, bossPhaseRef.current)] ?? currentStage.bossMechanic.phaseElements[0]}` : currentStage.mechanic}</div>}
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
