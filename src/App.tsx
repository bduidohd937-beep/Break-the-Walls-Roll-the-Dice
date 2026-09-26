import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

type ElementType = "neutral" | "dark" | "fire";
type Team = "hero" | "enemy";

type UnitDef = {
  id: string;
  name: string;
  sprite: string;
  element: ElementType;
  hp: number;
  atk: number;
  speed: number;
  range: number;
  attackInterval: number;
  cost: number;
  cooldown: number;
  role: string;
  effect?: "burn";
};

type Unit = UnitDef & {
  uid: number;
  team: Team;
  x: number;
  currentHp: number;
  attackTimer: number;
  cooldownTimer: number;
  hitFlash: number;
  attackFlash: number;
  alive: boolean;
};

const HEROES: UnitDef[] = [
  { id: "goblin", name: "고블린", sprite: "👺", element: "neutral", hp: 90, atk: 14, speed: 48, range: 34, attackInterval: 0.9, cost: 50, cooldown: 2.5, role: "근접" },
  { id: "fireGoblin", name: "화염 고블린", sprite: "👺", element: "fire", hp: 82, atk: 24, speed: 43, range: 120, attackInterval: 1.2, cost: 90, cooldown: 4, role: "원거리", effect: "burn" },
  { id: "shield", name: "철갑 방패병", sprite: "🛡️", element: "neutral", hp: 260, atk: 22, speed: 30, range: 32, attackInterval: 1.3, cost: 150, cooldown: 6, role: "탱커" },
  { id: "archer", name: "왕국 궁수", sprite: "🏹", element: "neutral", hp: 120, atk: 38, speed: 38, range: 190, attackInterval: 1.35, cost: 180, cooldown: 7, role: "원거리" },
  { id: "knight", name: "왕국 기사", sprite: "⚔️", element: "neutral", hp: 430, atk: 65, speed: 34, range: 40, attackInterval: 1.5, cost: 400, cooldown: 10, role: "근접 딜러" },
  { id: "mage", name: "불꽃 마법사", sprite: "🧙", element: "fire", hp: 150, atk: 82, speed: 28, range: 210, attackInterval: 1.9, cost: 500, cooldown: 12, role: "광역 마법", effect: "burn" },
  { id: "paladin", name: "성기사", sprite: "🧝", element: "dark", hp: 620, atk: 72, speed: 26, range: 42, attackInterval: 1.7, cost: 700, cooldown: 15, role: "탱커" },
  { id: "assassin", name: "암살자", sprite: "🥷", element: "dark", hp: 210, atk: 145, speed: 64, range: 45, attackInterval: 1.8, cost: 900, cooldown: 18, role: "암살자" },
  { id: "dragon", name: "성룡", sprite: "🐉", element: "fire", hp: 1250, atk: 220, speed: 30, range: 170, attackInterval: 2.4, cost: 1600, cooldown: 25, role: "광역" },
  { id: "arthur", name: "아서왕", sprite: "👑", element: "dark", hp: 2100, atk: 330, speed: 25, range: 55, attackInterval: 2.6, cost: 3000, cooldown: 40, role: "전설" },
];

const ENEMIES: UnitDef[] = [
  { id: "goblinE", name: "굶주린 고블린", sprite: "👺", element: "neutral", hp: 70, atk: 10, speed: 42, range: 30, attackInterval: 1.1, cost: 0, cooldown: 0, role: "일반" },
  { id: "orcE", name: "오크 전사", sprite: "👹", element: "neutral", hp: 210, atk: 28, speed: 30, range: 35, attackInterval: 1.6, cost: 0, cooldown: 0, role: "전열" },
  { id: "darkKnightE", name: "다크 나이트", sprite: "🗡️", element: "dark", hp: 520, atk: 82, speed: 28, range: 42, attackInterval: 1.5, cost: 0, cooldown: 0, role: "엘리트" },
  { id: "fireOgreE", name: "화염의 거인 오거", sprite: "👹", element: "fire", hp: 1200, atk: 180, speed: 18, range: 55, attackInterval: 2.5, cost: 0, cooldown: 0, role: "강적" },
];

const DECK_IDS = ["goblin", "fireGoblin", "shield", "archer", "knight", "mage", "paladin", "assassin", "dragon", "arthur"];

type Wave = Array<{ enemy: keyof typeof ENEMY_MAP; count: number; gap?: number }>;
const ENEMY_MAP = {
  goblin: ENEMIES[0],
  orc: ENEMIES[1],
  darkKnight: ENEMIES[2],
  fireOgre: ENEMIES[3],
} as const;

const WAVES: Wave[] = [
  [{ enemy: "goblin", count: 8, gap: 0.9 }],
  [{ enemy: "goblin", count: 5, gap: 0.6 }, { enemy: "orc", count: 3, gap: 1.2 }],
  [{ enemy: "goblin", count: 7, gap: 0.55 }, { enemy: "darkKnight", count: 1, gap: 2 }],
  [{ enemy: "orc", count: 5, gap: 0.8 }, { enemy: "goblin", count: 10, gap: 0.45 }],
  [{ enemy: "goblin", count: 8, gap: 0.45 }, { enemy: "orc", count: 4, gap: 0.9 }, { enemy: "fireOgre", count: 1, gap: 2.2 }],
];

const ELEMENT_LABEL: Record<ElementType, string> = {
  neutral: "무속성",
  dark: "어둠",
  fire: "불",
};

const ELEMENT_CLASS: Record<ElementType, string> = {
  neutral: "el-neutral",
  dark: "el-dark",
  fire: "el-fire",
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function makeUnit(def: UnitDef, team: Team, x: number, uid: number): Unit {
  return {
    ...def,
    uid,
    team,
    x,
    currentHp: def.hp,
    attackTimer: Math.random() * 0.5,
    cooldownTimer: 0,
    hitFlash: 0,
    attackFlash: 0,
    alive: true,
  };
}

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

  useEffect(() => {
    if (battleState !== "playing") return;
    let raf = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - lastFrame.current) / 1000, 0.05);
      lastFrame.current = now;

      setBattleGold((g) => Math.min(99999, g + dt * 5));
      setWaveTimer((t) => t + dt);
      setSpawnTimer((t) => t - dt);

      setHeroes((prev) => prev.map((u) => ({ ...u, attackTimer: Math.max(0, u.attackTimer - dt), hitFlash: Math.max(0, u.hitFlash - dt), attackFlash: Math.max(0, u.attackFlash - dt), cooldownTimer: Math.max(0, u.cooldownTimer - dt) })));
      setEnemies((prev) => prev.map((u) => ({ ...u, attackTimer: Math.max(0, u.attackTimer - dt), hitFlash: Math.max(0, u.hitFlash - dt), attackFlash: Math.max(0, u.attackFlash - dt) })));

      setHeroes((prev) => {
        const living = prev.filter((u) => u.alive);
        return living.map((hero) => {
          const target = enemies.filter((e) => e.alive).sort((a, b) => Math.abs(a.x - hero.x) - Math.abs(b.x - hero.x))[0];
          if (!target) return { ...hero, x: Math.min(87, hero.x + hero.speed * dt / 100) };
          const dist = Math.abs(target.x - hero.x);
          if (dist > hero.range / 10) return { ...hero, x: Math.min(87, hero.x + hero.speed * dt / 100) };
          if (hero.attackTimer > 0) return hero;
          const damage = hero.atk * (hero.element === "fire" && target.element === "dark" ? 1.25 : 1);
          setEnemies((es) => es.map((e) => e.uid === target.uid ? { ...e, currentHp: e.currentHp - damage, hitFlash: 0.12, attackFlash: 0.08 } : e));
          setBattleGold((g) => g + 20);
          return { ...hero, attackTimer: hero.attackInterval, attackFlash: 0.16 };
        });
      });

      setEnemies((prev) => prev.filter((u) => u.alive && u.currentHp > 0).map((enemy) => {
        const target = heroes.filter((h) => h.alive).sort((a, b) => Math.abs(a.x - enemy.x) - Math.abs(b.x - enemy.x))[0];
        if (!target) {
          if (enemy.x <= 12) {
            setCastleHp((hp) => Math.max(0, hp - enemy.atk * dt));
            return { ...enemy, x: 8 };
          }
          return { ...enemy, x: Math.max(8, enemy.x - enemy.speed * dt / 100) };
        }
        const dist = Math.abs(target.x - enemy.x);
        if (dist > enemy.range / 10) return { ...enemy, x: Math.max(8, enemy.x - enemy.speed * dt / 100) };
        if (enemy.attackTimer > 0) return enemy;
        setHeroes((hs) => hs.map((h) => h.uid === target.uid ? { ...h, currentHp: h.currentHp - enemy.atk, hitFlash: 0.14 } : h));
        return { ...enemy, attackTimer: enemy.attackInterval, attackFlash: 0.16 };
      }));

      setEnemies((prev) => prev.filter((e) => e.currentHp > 0));
      setHeroes((prev) => prev.filter((h) => h.currentHp > 0));

      setSpawnTimer((timer) => {
        if (timer > 0 || waveIndex >= WAVES.length) return timer;
        const wave = WAVES[waveIndex];
        const sequence = wave.flatMap((group) => Array.from({ length: group.count }, () => group));
        if (spawnIndex >= sequence.length) return timer;
        const group = sequence[spawnIndex];
        const uid = nextUid + 1000 + spawnIndex + waveIndex * 100;
        setNextUid((v) => v + 1);
        setEnemies((list) => [...list, makeUnit(ENEMY_MAP[group.enemy], "enemy", 90 + Math.random() * 5, uid)]);
        setSpawnIndex((i) => i + 1);
        return group.gap ?? 0.8;
      });

      if (waveTimer > 1 && spawnIndex >= WAVES[waveIndex]?.reduce((sum, g) => sum + g.count, 0)) {
        if (enemies.length === 0 && waveIndex < WAVES.length - 1) {
          setWaveIndex((i) => i + 1);
          setSpawnIndex(0);
          setSpawnTimer(1.5);
          setWaveTimer(0);
          setNotice(`WAVE ${waveIndex + 2} 진입`);
        }
      }

      if (enemyCastleHp <= 0) setBattleState("victory");
      if (castleHp <= 0) setBattleState("defeat");

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [battleState, castleHp, enemyCastleHp, enemies.length, heroes.length, nextUid, spawnIndex, waveIndex, waveTimer]);

  const reset = () => {
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

function BattleUnit({ unit }: { unit: Unit }) {
  return (
    <div
      className={`battle-unit ${unit.team} ${ELEMENT_CLASS[unit.element]} ${unit.hitFlash > 0 ? "hit" : ""} ${unit.attackFlash > 0 ? "attacking" : ""}`}
      style={{ left: `${unit.x}%` }}
      title={`${unit.name} · ${ELEMENT_LABEL[unit.element]}`}
    >
      <div className="unit-hp"><span style={{width: `${clamp((unit.currentHp / unit.hp) * 100, 0, 100)}%`}} /></div>
      <div className="unit-sprite">{unit.sprite}<span className="unit-aura" /></div>
      <div className="unit-name">{unit.name}</div>
      {unit.effect === "burn" && unit.attackFlash > 0 && <div className="attack-effect">✦</div>}
    </div>
  );
}

export default App;
