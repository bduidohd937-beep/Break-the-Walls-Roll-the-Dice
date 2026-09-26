import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import type { Unit, UnitDef } from "./game/types";
import { HEROES, DECK_IDS, ENEMY_MAP, WAVES, BATTLE_GOLD_MAX, MOVE_SPEED_MULTIPLIER, ELEMENT_CLASS, clamp } from "./game/constants";
import { makeUnit } from "./game/units/createUnit";
import { applyKnockback, updateKnockback } from "./game/combat/knockback";
import { resolveSameTeamSpacing, resolveFrontlineCollision } from "./game/combat/collision";
import { BattleUnit } from "./components/BattleUnit";

function App() {
  const [battleGold, setBattleGold] = useState(500);
  const [waveIndex, setWaveIndex] = useState(0);
  const [waveTimer, setWaveTimer] = useState(0);
  const [spawnIndex, setSpawnIndex] = useState(0);
  const [spawnTimer, setSpawnTimer] = useState(1.2);
  const [heroes, setHeroes] = useState<Unit[]>([]);
  const [enemies, setEnemies] = useState<Unit[]>([]);
  const [castleHp, setCastleHp] = useState(1000);
  const [enemyCastleHp, setEnemyCastleHp] = useState(1800);
  const [battleState, setBattleState] = useState<"playing" | "victory" | "defeat">("playing");
  const [deckPage, setDeckPage] = useState(0);
  const [notice, setNotice] = useState("전투 시작!");
  const [nextUid, setNextUid] = useState(1);
  const lastFrame = useRef(performance.now());

  const isRanged = (unit: Unit) => unit.range >= 100;

  const visibleDeck = useMemo(() => {
    const start = deckPage * 5;
    return DECK_IDS.slice(start, start + 5).map((id) => HEROES.find((hero) => hero.id === id)!);
  }, [deckPage]);

  const deploy = useCallback((def: UnitDef) => {
    if (battleState !== "playing" || battleGold < def.cost) return;
    const activeSame = heroes.filter((h) => h.id === def.id && h.alive).length;
    if (activeSame >= 5) {
      setNotice("같은 영웅은 동시에 최대 5기까지 배치할 수 있어요.");
      return;
    }
    const uid = nextUid;
    setNextUid((v) => v + 1);
    setBattleGold((g) => g - def.cost);
    setHeroes((list) => [...list, makeUnit(def, "hero", 9 + Math.random() * 7, uid)]);
    setNotice(`${def.name} 출전!`);
  }, [battleGold, battleState, heroes, nextUid]);

  const heroesRef = useRef<Unit[]>([]);
  const enemiesRef = useRef<Unit[]>([]);
  const goldRef = useRef(500);
  const castleRef = useRef(1000);
  const enemyCastleRef = useRef(1800);
  const waveRef = useRef(0);
  const spawnRef = useRef(0);
  const spawnTimerRef = useRef(1.2);
  const uidRef = useRef(1);

  useEffect(() => { heroesRef.current = heroes; }, [heroes]);
  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);
  useEffect(() => { goldRef.current = battleGold; }, [battleGold]);
  useEffect(() => { castleRef.current = castleHp; }, [castleHp]);
  useEffect(() => { enemyCastleRef.current = enemyCastleHp; }, [enemyCastleHp]);

  useEffect(() => {
    if (battleState !== "playing") return;

    const interval = window.setInterval(() => {
      const dt = 0.05;

      goldRef.current = Math.min(99999, goldRef.current + dt * 5);
      setBattleGold(goldRef.current);

      spawnTimerRef.current -= dt;

      let nextHeroes = heroesRef.current.map((u) => updateKnockback({
        ...u,
        attackTimer: Math.max(0, u.attackTimer - dt),
        hitFlash: Math.max(0, u.hitFlash - dt),
        attackFlash: Math.max(0, u.attackFlash - dt),
      }, dt));

      let nextEnemies = enemiesRef.current.map((u) => updateKnockback({
        ...u,
        attackTimer: Math.max(0, u.attackTimer - dt),
        hitFlash: Math.max(0, u.hitFlash - dt),
        attackFlash: Math.max(0, u.attackFlash - dt),
      }, dt));

      // Spawn the fixed wave sequence.
      const wave = WAVES[waveRef.current];
      const totalInWave = wave?.reduce((sum, group) => sum + group.count, 0) ?? 0;
      if (wave && spawnRef.current < totalInWave && spawnTimerRef.current <= 0) {
        const sequence = wave.flatMap((group) => Array.from({ length: group.count }, () => group));
        const group = sequence[spawnRef.current];
        const enemyDef = ENEMY_MAP[group.enemy];
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
          const advantage = hero.element === "fire" && target.element === "dark" ? 1.25 : 1;
          const damage = hero.atk * advantage;
          const targetIndex = nextEnemies.findIndex((e) => e.uid === target.uid);
          if (targetIndex >= 0) {
            nextEnemies[targetIndex] = {
              ...applyKnockback(
                nextEnemies[targetIndex],
                nextEnemies[targetIndex].currentHp - damage,
                "hero",
                hero.atk,
              ),
              attackFlash: 0.08,
            };
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
          const targetIndex = nextHeroes.findIndex((h) => h.uid === target.uid);
          if (targetIndex >= 0) {
            nextHeroes[targetIndex] = {
              ...applyKnockback(
                nextHeroes[targetIndex],
                nextHeroes[targetIndex].currentHp - enemy.atk,
                "enemy",
                enemy.atk,
              ),
            };
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
      if (waveCleared) {
        if (waveRef.current < WAVES.length - 1) {
          waveRef.current += 1;
          spawnRef.current = 0;
          spawnTimerRef.current = 1.4;
          setWaveIndex(waveRef.current);
          setSpawnIndex(0);
          setNotice(`WAVE ${waveRef.current + 1} 진입`);
        }
      }

      if (enemyCastleRef.current <= 0) {
        setEnemyCastleHp(0);
        setBattleState("victory");
      } else if (castleRef.current <= 0) {
        setCastleHp(0);
        setBattleState("defeat");
      }
    }, 50);

    return () => window.clearInterval(interval);
  }, [battleState]);

  const reset = () => {
    goldRef.current = 500;
    castleRef.current = 1000;
    enemyCastleRef.current = 1800;
    waveRef.current = 0;
    spawnRef.current = 0;
    spawnTimerRef.current = 1.2;
    uidRef.current = 1;
    setBattleGold(500);
    setWaveIndex(0);
    setWaveTimer(0);
    setSpawnIndex(0);
    setSpawnTimer(1.2);
    setHeroes([]);
    setEnemies([]);
    setCastleHp(1000);
    setEnemyCastleHp(1800);
    setBattleState("playing");
    setNotice("전투 시작!");
  };

  return (
    <main className="game-shell">
      <header className="topbar">
        <div>
          <div className="game-title">BREAK THE WALLS</div>
          <div className="sub-title">퓨어 월드 · 제1장 · 성 공략전</div>
        </div>
        <div className="top-stats">
          <div className="stat-pill">🏰 우리 성 <b>{Math.ceil(castleHp)}</b></div>
          <div className="stat-pill gold">🪙 Battle Gold <b>{Math.floor(battleGold).toLocaleString()}</b></div>
          <div className="stat-pill">🌊 WAVE <b>{Math.min(waveIndex + 1, WAVES.length)}/{WAVES.length}</b></div>
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

          <div className="wave-banner">{notice}</div>
        </div>

        <div className="deck-panel">
          <button className="swap-btn" onClick={() => setDeckPage(0)} disabled={deckPage === 0}>▲</button>
          <div className="deck-slots">
            {visibleDeck.map((hero) => {
              const disabled = battleGold < hero.cost;
              return (
                <button key={hero.id} className={`hero-card ${disabled ? "disabled" : ""}`} onClick={() => deploy(hero)}>
                  <div className={`hero-sprite ${ELEMENT_CLASS[hero.element]}`}>{hero.sprite}<span className="spark" /></div>
                  <div className="hero-name">{hero.name}</div>
                  <div className="hero-meta"><span>{hero.role}</span><b>🪙 {hero.cost}</b></div>
                  <div className="cooldown">배치 쿨 {hero.cooldown}s</div>
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
            <p>{battleState === "victory" ? "다음 스테이지를 향해 전진하자." : "덱과 배치 타이밍을 바꿔 다시 도전하자."}</p>
            <button onClick={reset}>다시 전투</button>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
