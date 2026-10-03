import { useRef } from "react";
import type { CSSProperties, PointerEvent } from "react";
import type { StageDef, Unit } from "../../game/types";
import { cameraLeftAfterDrag, getBattleCameraGeometry, type BattleViewMode } from "../../game/systems/battleCamera";
import type { BattleDeathEffect } from "../../game/visuals/sprites";
import { BattleUnit } from "./BattleUnit";

type DamagePopup = { id: number; x: number; value: number; critical?: boolean };

type Props = {
  stage: StageDef;
  waveIndex: number;
  gameSpeed: number;
  heroes: Unit[];
  enemies: Unit[];
  deathEffects: BattleDeathEffect[];
  damagePopups: DamagePopup[];
  castleHp: number;
  enemyCastleHp: number;
  castleHit: "our" | "enemy" | null;
  bossPhaseTwo: boolean;
  bossDisplayIcon: string;
  bossDisplayName: string;
  bossHpPercent: number;
  bossUnit?: Unit;
  bossDefeated: boolean;
  bossCharge: number;
  bossPhase: number;
  waveProgress: number;
  notice: string;
  waveThreat: string;
  viewMode: BattleViewMode;
  cameraLeft: number;
  onCameraLeft: (left: number) => void;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function BattleViewport(p: Props) {
  const cameraDrag = useRef<{ pointerId: number; startX: number; startLeft: number } | null>(null);
  const camera = getBattleCameraGeometry(p.viewMode, p.cameraLeft);
  const bossWave = p.stage.waveMeta[p.waveIndex]?.boss;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (p.viewMode !== "narrow" || !event.isPrimary || event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("button")) return;
    cameraDrag.current = { pointerId: event.pointerId, startX: event.clientX, startLeft: camera.left };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = cameraDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const width = event.currentTarget.getBoundingClientRect().width;
    p.onCameraLeft(cameraLeftAfterDrag(drag.startLeft, event.clientX - drag.startX, width, camera.span));
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (cameraDrag.current?.pointerId === event.pointerId) cameraDrag.current = null;
  };

  const worldStyle = {
    left: `${camera.worldOffsetPercent}%`,
    width: `${camera.worldWidthPercent}%`
  } as CSSProperties;

  return (
    <div
      className={`battle-sky ${p.viewMode === "narrow" ? "camera-narrow" : "camera-wide"}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      aria-label={p.viewMode === "narrow" ? "근접 전장, 좌우로 끌어 카메라 이동" : "전체 전장"}
    >
      <div className="battle-world" style={worldStyle}>
        <div className="pixel-sky-grid" />
        <div className="cloud c1" />
        <div className="cloud c2" />
        <div className="mountains" />
        <div className="battle-horizon" />
        <div className="lane">
          <div className="lane-ground" /><div className="lane-grid" /><div className="lane-center-line" />
          <div className="castle-zone our-zone" /><div className="castle-zone enemy-zone" />
          <div className={`castle our-castle ${p.castleHit === "our" ? "castle-hit" : ""}`} style={{ left: "7%" }}>
            <div className="castle-visual">
              <div className="tower"><span className="castle-glyph">🏰</span></div>
              <div className="castle-label">우리 성</div>
              <div className="castle-hp"><span style={{ width: `${clamp(p.castleHp / 10, 0, 100)}%` }} /></div>
            </div>
          </div>
          <div className={`castle enemy-castle ${p.castleHit === "enemy" ? "castle-hit" : ""}`} style={{ left: "93%" }}>
            <div className="castle-visual">
              <div className="tower"><span className="castle-glyph">🏯</span></div>
              <div className="castle-label">적 성</div>
              <div className="castle-hp enemy"><span style={{ width: `${clamp((p.enemyCastleHp / p.stage.enemyCastleHp) * 100, 0, 100)}%` }} /></div>
            </div>
          </div>
          {p.heroes.map((unit) => <BattleUnit key={unit.uid} unit={unit} gameSpeed={p.gameSpeed} />)}
          {p.enemies.map((unit) => <BattleUnit key={unit.uid} unit={unit} gameSpeed={p.gameSpeed} />)}
          {p.deathEffects.map((effect) => effect.unit
            ? <BattleUnit key={`dead-${effect.id}`} unit={effect.unit} gameSpeed={p.gameSpeed} dyingProgress={Math.min(0.999, 1 - effect.life / effect.duration)} />
            : <div key={effect.id} style={{ position: "absolute", zIndex: 17, left: `${effect.x}%`, top: effect.team === "hero" ? "42%" : "48%", transform: "translate(-50%,-50%)", fontSize: 25, pointerEvents: "none", opacity: Math.min(1, effect.life * 3) }}>{effect.team === "hero" ? "💥" : "💢"}</div>)}
          {p.damagePopups.map((popup) => <div key={popup.id} className={`damage-popup ${popup.critical ? "critical" : ""}`} style={{ left: `${popup.x}%` }}>-{popup.value}</div>)}
        </div>
      </div>

      {bossWave && p.bossUnit && <div className={`boss-bar ${p.bossPhaseTwo ? "enraged" : ""}`}>
        <div className="boss-title">{p.bossDisplayIcon} BOSS · {p.bossDisplayName} {p.bossPhaseTwo ? "· ENRAGED" : ""}</div>
        <div className="boss-hp"><span style={{ width: `${p.bossHpPercent}%` }} /></div>
        <div className="boss-hp-text">{`${Math.ceil(p.bossUnit.currentHp)} / ${p.bossUnit.hp}`}</div>
        <div className="boss-mechanic-status">{p.stage.id === 40
          ? `전하 ${Math.min(10, Math.floor(p.bossCharge / 4))}/10`
          : p.stage.id === 50 && p.stage.bossMechanic?.phaseElements
            ? `현재 페이즈 · ${p.stage.bossMechanic.phaseElements[Math.max(0, p.bossPhase)] ?? p.stage.bossMechanic.phaseElements[0]}`
            : p.stage.mechanic}</div>
      </div>}
      <div className="wave-banner">
        <div className="wave-title">STAGE {p.stage.id} · WAVE {p.waveIndex + 1}/{p.stage.waves.length} · {p.stage.waveMeta[p.waveIndex]?.name}</div>
        <div className="wave-progress"><span style={{ width: `${clamp(p.waveProgress, 0, 100)}%` }} /></div>
        <div className="wave-notice">{p.notice}</div>
        {p.waveThreat && <div className="wave-threat">{p.waveThreat}</div>}
      </div>
      {p.viewMode === "narrow" && <div className="camera-hint" aria-hidden="true">전장 좌우로 밀어 이동</div>}
    </div>
  );
}
