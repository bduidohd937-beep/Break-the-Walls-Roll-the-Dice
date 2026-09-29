import { BattleDeployBar } from "./BattleDeployBar";
import { BattleViewport } from "./BattleViewport";
import { FullscreenToggle } from "../shared/FullscreenToggle";
import type { StageDef, Unit, UnitDef } from "../../game/types";
import type { BattleDeathEffect } from "../../game/visuals/sprites";
import type { BattleReward } from "../../game/controllers/useBattleLoop";
import type { BattleViewMode } from "../../game/systems/battleCamera";

type BattleState = "playing" | "victory" | "defeat" | "stageSelect";
type DamagePopup = { id: number; x: number; value: number; critical?: boolean };
type PauseScreen = null | "menu" | "settings" | "exit";

type Props = {
  pauseScreen: PauseScreen; onPause: () => void; onPauseScreen: (screen: PauseScreen) => void; onExitBattle: () => void;
  stage: StageDef; stageIndex: number; unlockedStage: number; battleState: BattleState; battleReward: BattleReward | null;
  castleHp: number; enemyCastleHp: number; battleGold: number; battleGoldMax: number; economyLevel: number; economyMaxLevel: number;
  goldPerSecond: number; economyUpgradeCost: number; waveIndex: number; gameSpeed: number; autoCom: boolean;
  heroes: Unit[]; enemies: Unit[]; deathEffects: BattleDeathEffect[]; damagePopups: DamagePopup[];
  castleHit: "our" | "enemy" | null; bossPhaseTwo: boolean; bossDisplayIcon: string; bossDisplayName: string;
  bossHpPercent: number; bossUnit?: Unit; bossDefeated: boolean; bossCharge: number; bossPhase: number;
  waveProgress: number; notice: string; waveThreat: string; visibleDeck: UnitDef[]; battleDeckPage: 0 | 1;
  onDeckPage: (page: 0 | 1) => void; deployCooldowns: Record<string, number>; deckCount: number; deckSlotCount: number;
  kingdomLevel: number; ownedHeroCount: number; heroTotal: number; getUnitLevel: (id: string) => number;
  onSpeed: () => void; onAuto: () => void; onUpgradeEconomy: () => void; onDeploy: (hero: UnitDef) => void;
  onRetry: () => void; onStageSelect: () => void; onNext: () => void;
  battleViewMode: BattleViewMode; onToggleBattleView: () => void; battleCameraLeft: number; onCameraLeft: (left: number) => void;
};

export function BattleScreen(p: Props) {
  return (
    <main className={`game-shell battle-shell ${p.pauseScreen ? "battle-paused" : ""}`}>
      <header className="topbar battle-topbar">
        <div className="battle-brand"><div className="game-title">BREAK THE WALLS</div><div className="sub-title">퓨어 월드 · STAGE {p.stage.id} · {p.stage.name}</div></div>
        <div className="top-stats battle-hud">
          <div className="stat-pill gold">🪙 <span>Battle Gold</span> <b>{Math.floor(p.battleGold).toLocaleString()} / {p.battleGoldMax.toLocaleString()}</b></div>
          <div className="stat-pill">💰 <span>지갑</span> <b>Lv.{p.economyLevel}/{p.economyMaxLevel}</b></div>
          <div className="stat-pill stage-pill">🗺️ STAGE <b>{p.stage.id}</b> · 🌊 <b>{Math.min(p.waveIndex + 1, p.stage.waves.length)}/{p.stage.waves.length}</b></div>
          <button className="stat-pill speed-control" disabled={!!p.pauseScreen} onClick={p.onSpeed}>⚡ {p.gameSpeed}X</button>
          <button className={`stat-pill auto-com-control ${p.autoCom ? "active" : ""}`} disabled={!!p.pauseScreen} onClick={p.onAuto}>🤖 AUTO {p.autoCom ? "ON" : "OFF"}</button>
          <button className="stat-pill view-mode-control" type="button" onClick={p.onToggleBattleView} aria-pressed={p.battleViewMode === "narrow"} aria-label={`전장 보기 변경, 현재 ${p.battleViewMode === "wide" ? "전체" : "근접"} 보기`}>{p.battleViewMode === "wide" ? "▱ 전체" : "▣ 근접"}</button>
          <FullscreenToggle className="battle-fullscreen" />
          <button className="stat-pill battle-pause-btn" disabled={p.battleState !== "playing"} onClick={p.onPause} aria-label="전투 일시정지">Ⅱ</button>
        </div>
      </header>

      <section className="battle-card">
        <BattleViewport
          stage={p.stage} waveIndex={p.waveIndex} gameSpeed={p.gameSpeed} heroes={p.heroes} enemies={p.enemies}
          deathEffects={p.deathEffects} damagePopups={p.damagePopups} castleHp={p.castleHp} enemyCastleHp={p.enemyCastleHp}
          castleHit={p.castleHit} bossPhaseTwo={p.bossPhaseTwo} bossDisplayIcon={p.bossDisplayIcon} bossDisplayName={p.bossDisplayName}
          bossHpPercent={p.bossHpPercent} bossUnit={p.bossUnit} bossDefeated={p.bossDefeated} bossCharge={p.bossCharge} bossPhase={p.bossPhase}
          waveProgress={p.waveProgress} notice={p.notice} waveThreat={p.waveThreat} viewMode={p.battleViewMode}
          cameraLeft={p.battleCameraLeft} onCameraLeft={p.onCameraLeft}
        />
        <div className="economy-panel">
          <div className="economy-info"><b>💰 전투 지갑 Lv.{p.economyLevel}/{p.economyMaxLevel}</b><span>초당 +{p.goldPerSecond} 🪙 · 최대 {p.battleGoldMax.toLocaleString()}</span></div>
          <button className="economy-upgrade" disabled={!!p.pauseScreen || p.economyLevel >= p.economyMaxLevel || p.battleGold < p.economyUpgradeCost} onClick={p.onUpgradeEconomy}>{p.economyLevel >= p.economyMaxLevel ? "지갑 MAX" : `지갑 강화 · 🪙 ${p.economyUpgradeCost}`}</button>
        </div>
        <BattleDeployBar
          visibleDeck={p.visibleDeck} battleDeckPage={p.battleDeckPage} onDeckPage={p.onDeckPage} deployCooldowns={p.deployCooldowns}
          battleGold={p.battleGold} pauseScreen={!!p.pauseScreen} deckCount={p.deckCount} deckSlotCount={p.deckSlotCount}
          kingdomLevel={p.kingdomLevel} ownedHeroCount={p.ownedHeroCount} heroTotal={p.heroTotal} getUnitLevel={p.getUnitLevel} onDeploy={p.onDeploy}
        />
      </section>

      {p.pauseScreen && p.battleState === "playing" && <div className="pause-overlay" role="dialog" aria-modal="true" aria-label="전투 일시정지"><div className="pause-menu">
        {p.pauseScreen === "menu" ? <><h2>일시정지</h2><button onClick={() => p.onPauseScreen(null)}>계속하기</button><button onClick={() => p.onPauseScreen("settings")}>게임 설정</button><button onClick={() => p.onPauseScreen("exit")}>전투 나가기</button></>
          : p.pauseScreen === "settings" ? <><h2>게임 설정</h2><p>전투 속도 {p.gameSpeed}X · AUTO COM {p.autoCom ? "ON" : "OFF"}</p><button onClick={p.onSpeed}>속도 변경 · {p.gameSpeed}X</button><button onClick={p.onAuto}>AUTO COM {p.autoCom ? "끄기" : "켜기"}</button><button onClick={() => p.onPauseScreen("menu")}>← 일시정지 메뉴</button></>
            : <><h2>전투 나가기</h2><p>전투를 종료하시겠습니까?<br />현재 전투 진행 상황은 사라집니다.</p><button onClick={() => p.onPauseScreen("menu")}>취소</button><button onClick={p.onExitBattle}>나가기</button></>}
      </div></div>}

      {p.battleState !== "playing" && <div className="result-overlay"><div className={`result-box ${p.battleState}`}>
        <div className="result-kicker">{p.battleState === "victory" ? "STAGE CLEAR" : "STAGE FAILED"}</div>
        <h1>{p.battleState === "victory" ? "적 성을 돌파했다!" : "성이 함락됐다..."}</h1>
        <p>{p.battleState === "victory" ? `STAGE ${p.stage.id} 클리어! ${p.battleReward?.firstClear ? "첫 클리어" : "반복 클리어"} 보상을 받았습니다.` : "덱과 배치 타이밍을 바꿔 다시 도전하자."}</p>
        {p.battleState === "victory" && p.battleReward && <div className="result-rewards"><span>🪙 Game Gold <b>+{p.battleReward.gold.toLocaleString()}</b></span><span>💎 보석 <b>+{p.battleReward.gems.toLocaleString()}</b></span></div>}
        <div className="result-actions"><button onClick={p.onRetry}>다시 전투</button><button onClick={p.onStageSelect}>스테이지 선택</button>{p.battleState === "victory" && p.stageIndex + 1 < p.unlockedStage && <button onClick={p.onNext}>다음 스테이지 ▶</button>}</div>
      </div></div>}
    </main>
  );
}
