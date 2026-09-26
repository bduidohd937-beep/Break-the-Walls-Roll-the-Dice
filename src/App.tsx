import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Unit, UnitDef } from "./game/types";
import { HEROES, DECK_IDS, ENEMY_MAP, WAVE_HP_SCALE, WAVE_ATK_SCALE, BATTLE_GOLD_MAX, MOVE_SPEED_MULTIPLIER, ELEMENT_CLASS, clamp } from "./game/constants";
import { STAGES, STAGE_HP_SCALE, STAGE_ATK_SCALE } from "./game/stages";
import { makeUnit } from "./game/units/createUnit";
import { applyKnockback, updateKnockback } from "./game/combat/knockback";
import { incomingDamage, outgoingDamage, regenAmount } from "./game/combat/damage";
import { resolveSameTeamSpacing, resolveFrontlineCollision } from "./game/combat/collision";
import { BattleUnit } from "./components/BattleUnit";

function App() {
  const [stageIndex, setStageIndex] = useState(0);
  const [unlockedStage, setUnlockedStage] = useState(() => {
    const saved = Number(window.localStorage.getItem("btw-unlocked-stage") ?? "1");
    return clamp(Math.floor(saved) || 1, 1, STAGES.length);
  });
  const [kingdomGold, setKingdomGold] = useState(() => Number(window.localStorage.getItem("btw-kingdom-gold") ?? "0"));
  const [clearedStages, setClearedStages] = useState<number[]>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("btw-cleared-stages") ?? "[]");
      return Array.isArray(saved) ? saved.filter((value) => Number.isInteger(value)) : [];
    } catch {
      return [];
    }
  });
  const [battleGold, setBattleGold] = useState(500);
  const [waveIndex, setWaveIndex] = useState(0);
  const [heroes, setHeroes] = useState<Unit[]>([]);
  const [enemies, setEnemies] = useState<Unit[]>([]);
  const [castleHp, setCastleHp] = useState(1000);
  const [enemyCastleHp, setEnemyCastleHp] = useState(1800);
  const [battleState, setBattleState] = useState<"stageSelect" | "playing" | "victory" | "defeat">("stageSelect");
  const [deckPage, setDeckPage] = useState(0);
  const [notice, setNotice] = useState("전투 시작!");
  const [nextUid, setNextUid] = useState(1);
  const [gameSpeed, setGameSpeed] = useState(5);
  const [deployCooldowns, setDeployCooldowns] = useState<Record<string, number>>({});
  const visibleDeck = useMemo(() => {
    const start = deckPage * 5;
    return DECK_IDS.slice(start, start + 5).map((id) => HEROES.find((hero) => hero.id === id)!);
  }, [deckPage]);

  const deploy = useCallback((def: UnitDef) => {
    if (battleState !== "playing" || battleGold < def.cost || (deployCooldowns[def.id] ?? 0) > 0) return;
    const activeSame = heroes.filter((h) => h.id === def.id && h.alive).length;
    if (activeSame >= 5) {
      setNotice("같은 영웅은 동시에 최대 5기까지 배치할 수 있어요.");
      return;
    }
    const uid = nextUid;
    setNextUid((v) => v + 1);
    setBattleGold((g) => g - def.cost);
    setDeployCooldowns((cooldowns) => ({ ...cooldowns, [def.id]: def.cooldown }));
    setHeroes((list) => [...list, makeUnit(def, "hero", 9 + Math.random() * 7, uid)]);
    setNotice(`${def.name} 출전!`);
  }, [battleGold, battleState, heroes, nextUid, deployCooldowns]);

  const heroesRef = useRef<Unit[]>([]);
  const enemiesRef = useRef<Unit[]>([]);
  const goldRef = useRef(500);
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
    if (battleState !== "playing") return;

    const interval = window.setInterval(() => {
      const dt = 0.05 * gameSpeed;

      goldRef.current = Math.min(99999, goldRef.current + dt * 5);
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

        const target = nextEnemies
          .filter((e) => e.currentHp > 0 && e.x >= hero.x)
          .sort((a, b) => a.x - b.x)[0] ?? nextEnemies
          .filter((e) => e.currentHp > 0)
          .sort((a, b) => Math.abs(a.x - hero.x) - Math.abs(b.x - hero.x))[0];

        if (!target) {
          nextHeroes[i] = { ...hero, x: Math.min(87, hero.x + hero.speed * MOVE_SPEED_MULTIPLIER * dt / 100) };
          if (hero.x >= 84 && hero.attackTimer <= 0) {
            const damage = hero.atk * 1.8;
            enemyCastleRef.current = Math.max(0, enemyCastleRef.current - damage);
            setEnemyCastleHp(enemyCastleRef.current);
            nextHeroes[i].attackTimer = hero.attackInterval;
            nextHeroes[i].attackFlash = 0.16;
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

            const hitTarget = applyKnockback(
              nextEnemies[targetIndex],
              nextEnemies[targetIndex].currentHp - damage,
              "hero",
              hero.atk,
            );

            nextEnemies[targetIndex] = hero.effect === "burn"
              ? { ...hitTarget, burnTimer: 3, burnDamage: Math.max(hitTarget.burnDamage, hero.atk * 0.12), hitFlash: 0.14 }
              : { ...hitTarget, attackFlash: 0.08 };
          }
          goldRef.current = Math.min(BATTLE_GOLD_MAX, goldRef.current + 20);
          setBattleGold(Math.floor(goldRef.current));
          nextHeroes[i].attackTimer = hero.attackInterval;
          nextHeroes[i].attackFlash = 0.16;
        }
      }

      // Enemies move, attack heroes, or damage our castle.
      for (let i = 0; i < nextEnemies.length; i++) {
        const enemy = nextEnemies[i];
        if (enemy.currentHp <= 0 || enemy.knockbackTimer > 0) continue;

        const target = nextHeroes
          .filter((h) => h.currentHp > 0 && h.x <= enemy.x)
          .sort((a, b) => b.x - a.x)[0] ?? nextHeroes
          .filter((h) => h.currentHp > 0)
          .sort((a, b) => Math.abs(a.x - enemy.x) - Math.abs(b.x - enemy.x))[0];

        if (!target) {
          if (enemy.x <= 13) {
            castleRef.current = Math.max(0, castleRef.current - enemy.atk * dt);
            setCastleHp(castleRef.current);
          } else {
            nextEnemies[i] = { ...enemy, x: Math.max(9, enemy.x - enemy.speed * MOVE_SPEED_MULTIPLIER * dt / 100) };
          }
          continue;
        }

        const distance = Math.abs(target.x - enemy.x);
        if (distance > enemy.range / 10) {
          nextEnemies[i] = { ...enemy, x: Math.max(9, enemy.x - enemy.speed * MOVE_SPEED_MULTIPLIER * dt / 100) };
        } else if (enemy.attackTimer <= 0) {
          const splashRadius = enemy.splashRadius ?? 0;
          const hitTargets = enemy.attackType === "splash"
            ? nextHeroes
                .filter((heroTarget) => heroTarget.currentHp > 0 && Math.abs(heroTarget.x - target.x) <= splashRadius)
                .map((heroTarget) => heroTarget.uid)
            : [target.uid];

          for (const targetUid of hitTargets) {
            const hitIndex = nextHeroes.findIndex((heroTarget) => heroTarget.uid === targetUid);
            if (hitIndex < 0) continue;
            const damage = incomingDamage(nextHeroes[hitIndex], enemy.atk);
            nextHeroes[hitIndex] = applyKnockback(
              nextHeroes[hitIndex],
              nextHeroes[hitIndex].currentHp - damage,
              "enemy",
              enemy.atk,
            );
          }
          nextEnemies[i].attackTimer = enemy.attackInterval;
          nextEnemies[i].attackFlash = 0.16;
        }
      }

      // Remove defeated units before collision and wave checks.
      const defeatedEnemies = nextEnemies.filter((e) => e.currentHp <= 0).length;
      if (defeatedEnemies > 0) {
        goldRef.current = Math.min(BATTLE_GOLD_MAX, goldRef.current + defeatedEnemies * 20);
        setBattleGold(Math.floor(goldRef.current));
      }

      nextHeroes = nextHeroes
        .filter((unit) => unit.currentHp > 0)
        .map((unit) => ({ ...unit, alive: true }));
      nextEnemies = nextEnemies
        .filter((unit) => unit.currentHp > 0)
        .map((unit) => ({ ...unit, alive: true }));

      // Keep same-team units from stacking into the same position.
      nextHeroes = resolveSameTeamSpacing(nextHeroes);
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
        goldRef.current = Math.min(BATTLE_GOLD_MAX, goldRef.current + reward);
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
          if (current.includes(clearedStage)) return current;
          const next = [...current, clearedStage].sort((a, b) => a - b);
          window.localStorage.setItem("btw-cleared-stages", JSON.stringify(next));
          const reward = stage.clearReward;
          setKingdomGold((gold) => {
            const nextGold = gold + reward;
            window.localStorage.setItem("btw-kingdom-gold", String(nextGold));
            return nextGold;
          });
          return next;
        });
        setBattleState("victory");
      } else if (castleRef.current <= 0) {
        setCastleHp(0);
        setBattleState("defeat");
      }
    }, 50);

    return () => window.clearInterval(interval);
  }, [battleState, gameSpeed]);

  const selectStage = (nextStageIndex: number) => {
    if (nextStageIndex < 0 || nextStageIndex >= unlockedStage) return;
    reset(nextStageIndex);
  };

  const reset = (nextStageIndex = stageIndex) => {
    const nextStage = STAGES[nextStageIndex] ?? STAGES[0];
    stageRef.current = nextStageIndex;
    goldRef.current = 500;
    castleRef.current = 1000;
    enemyCastleRef.current = nextStage.enemyCastleHp;
    waveRef.current = 0;
    spawnRef.current = 0;
    spawnTimerRef.current = 1.2;
    uidRef.current = 1;
    finalClearNotifiedRef.current = false;
    setStageIndex(nextStageIndex);
    setBattleGold(500);
    setWaveIndex(0);
    setHeroes([]);
    setEnemies([]);
    setCastleHp(1000);
    setEnemyCastleHp(nextStage.enemyCastleHp);
    setBattleState("playing");
    setDeployCooldowns({});
    setNotice(`STAGE ${nextStage.id} · ${nextStage.name} 시작!`);
  };

  const currentStage = STAGES[stageIndex] ?? STAGES[0];
  const currentWave = currentStage.waves[waveIndex];
  const currentWaveTotal = currentWave?.reduce((sum, group) => sum + group.count, 0) ?? 0;
  const currentWaveSpawned = waveIndex === waveRef.current ? spawnRef.current : 0;
  const waveProgress = currentWaveTotal > 0 ? (currentWaveSpawned / currentWaveTotal) * 100 : 0;

  if (battleState === "stageSelect") {
    return (
      <main className="stage-select-shell">
        <section className="stage-select-card">
          <div className="stage-select-kicker">BREAK THE WALLS</div>
          <h1>STAGE SELECT</h1>
          <p className="stage-select-sub">해금된 전장을 선택하고 성을 돌파하세요.</p>
          <div className="stage-select-stats">
            <span>👑 Kingdom Gold <b>{kingdomGold.toLocaleString()}</b></span>
            <span>🏆 Clear <b>{clearedStages.length}/{STAGES.length}</b></span>
          </div>
          <div className="stage-grid">
            {STAGES.map((stage) => {
              const unlocked = stage.id <= unlockedStage;
              const cleared = clearedStages.includes(stage.id);
              return (
                <button key={stage.id} className={"stage-card " + (unlocked ? "unlocked " : "locked ") + (cleared ? "cleared" : "")} disabled={!unlocked} onClick={() => selectStage(stage.id - 1)}>
                  <div className="stage-card-top"><span>STAGE {stage.id}</span><b>{cleared ? "✓ CLEAR" : unlocked ? "▶ PLAY" : "🔒 LOCKED"}</b></div>
                  <h2>{stage.name}</h2>
                  <div className="stage-card-meta"><span>🌊 {stage.waves.length} WAVES</span><span>🏰 HP {stage.enemyCastleHp}</span></div>
                  <div className="stage-card-reward">FIRST CLEAR · +{stage.clearReward} 👑</div>
                </button>
              );
            })}
          </div>
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
          <div className="stat-pill gold">🪙 Battle Gold <b>{Math.floor(battleGold).toLocaleString()}</b></div>
          <div className="stat-pill">👑 Kingdom <b>{Math.floor(kingdomGold).toLocaleString()}</b></div>
          <div className="stat-pill">🏆 CLEAR <b>{clearedStages.length}/{STAGES.length}</b></div>
          <div className="stat-pill">🗺️ STAGE <b>{currentStage.id}</b> · 🌊 <b>{Math.min(waveIndex + 1, currentStage.waves.length)}/{currentStage.waves.length}</b></div>
          <button className="stat-pill speed-control" onClick={() => setGameSpeed((v) => v === 1 ? 5 : 1)}>⚡ {gameSpeed}X</button>
        </div>
      </header>

      <section className="battle-card">
        <div className="battle-sky">
          <div className="cloud c1" /><div className="cloud c2" /><div className="mountains" />
          <div className="castle our-castle"><div className="tower">🏰</div><div className="castle-label">우리 성</div><div className="castle-hp"><span style={{width: `${clamp(castleHp / 10, 0, 100)}%`}} /></div></div>
          <div className="castle enemy-castle"><div className="tower">🏯</div><div className="castle-label">적 성</div><div className="castle-hp enemy"><span style={{width: `${clamp(enemyCastleHp / 18, 0, 100)}%`}} /></div></div>

          <div className="lane">
            <div className="lane-ground" />
            {heroes.map((u) => <BattleUnit key={u.uid} unit={u} />)}
            {enemies.map((u) => <BattleUnit key={u.uid} unit={u} />)}
          </div>

          <div className="wave-banner">
            <div className="wave-title">STAGE {currentStage.id} · WAVE {waveIndex + 1}/{currentStage.waves.length} · {currentStage.waveMeta[waveIndex]?.name}</div>
            <div className="wave-progress"><span style={{ width: `${clamp(waveProgress, 0, 100)}%` }} /></div>
            <div className="wave-notice">{notice}</div>
          </div>
        </div>

        <div className="deck-panel">
          <button className="swap-btn" onClick={() => setDeckPage(0)} disabled={deckPage === 0}>▲</button>
          <div className="deck-slots">
            {visibleDeck.map((hero) => {
              const cooldownLeft = deployCooldowns[hero.id] ?? 0;
              const disabled = battleGold < hero.cost || cooldownLeft > 0;
              return (
                <button key={hero.id} className={`hero-card ${disabled ? "disabled" : ""}`} onClick={() => deploy(hero)}>
                  <div className={`hero-sprite ${ELEMENT_CLASS[hero.element]}`}>{hero.sprite}<span className="spark" /></div>
                  <div className="hero-name">{hero.name}</div>
                  <div className="hero-meta"><span>{hero.role}</span><b>🪙 {hero.cost}</b></div>
                  <div className="hero-ability">
                    {hero.ability === "guard" && "🛡️ 피해 감소 22%"}
                    {hero.ability === "regen" && "✚ 초당 HP 회복"}
                    {hero.ability === "crit" && "⚡ 28% 치명타"}
                    {hero.ability === "execute" && "☠️ 저체력 적 추가 피해"}
                    {!hero.ability && hero.attackType === "splash" && "💥 광역 공격"}
                    {!hero.ability && hero.effect === "burn" && hero.attackType !== "splash" && "🔥 화상"}
                  </div>
                  <div className="cooldown">{cooldownLeft > 0 ? `재배치 ${cooldownLeft.toFixed(1)}s` : `배치 쿨 ${hero.cooldown}s`}</div>
                </button>
              );
            })}
          </div>
          <button className="swap-btn" onClick={() => setDeckPage(1)} disabled={deckPage === 1}>▼</button>
        </div>
        <div className="deck-indicator">덱 {deckPage + 1}/2 · 10명 덱 중 5명씩 표시 · ▲▼ 스왑</div>
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
            <p>{battleState === "victory" ? `STAGE ${currentStage.id} 클리어! 다음 전장을 선택할 수 있어요.` : "덱과 배치 타이밍을 바꿔 다시 도전하자."}</p>
            <div className="result-actions">
              <button onClick={() => reset(stageIndex)}>다시 전투</button>
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
