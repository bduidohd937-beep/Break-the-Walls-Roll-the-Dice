import { useState, type CSSProperties } from "react";
import { HEROES } from "../../game/constants";
import { UNIT_SPRITE_CONFIGS } from "../../game/visuals/sprites";
import { HeroSprite } from "../shared/HeroSprite";
import "./sprite-debug.css";

// Mirrors the sprite states HeroSprite accepts; "walk" maps to the "move" clip.
type SpriteState = "idle" | "walk" | "attack" | "skill1" | "hit" | "knockback" | "death";
const STATE_ORDER: SpriteState[] = ["idle", "walk", "attack", "skill1", "hit", "knockback", "death"];
const toClip = (state: SpriteState) => (state === "walk" ? "move" as const : state);

export function SpriteDebugPanel() {
  const [unitId, setUnitId] = useState(Object.keys(UNIT_SPRITE_CONFIGS)[0] ?? "traineeSword");
  const [state, setState] = useState<SpriteState>("idle");
  const [restartKey, setRestartKey] = useState(0);
  const config = UNIT_SPRITE_CONFIGS[unitId];
  const hero = HEROES.find((candidate) => candidate.id === unitId);
  if (!config || !hero) {
    return <main className="sprite-debug-page"><h1>Sprite Debug</h1><p>이 유닛에는 UNIT_SPRITE_CONFIGS 설정이 없습니다.</p></main>;
  }
  const availableStates = STATE_ORDER.filter((candidate) => Boolean(config.animations[toClip(candidate)]));
  const animation = config.animations[toClip(state)];
  const restart = () => setRestartKey((value) => value + 1);

  return <main className="sprite-debug-page">
    <h1>스프라이트 디버그</h1>
    <p>개발 서버 전용 · 현재 UNIT_SPRITE_CONFIGS + HeroSprite 아키텍처를 검사합니다. 전투 데이터는 변경하지 않습니다.</p>
    <div className="sprite-debug-controls">
      {Object.keys(UNIT_SPRITE_CONFIGS).map((id) => (
        <button key={id} className={id === unitId ? "active" : ""} onClick={() => { setUnitId(id); setState("idle"); restart(); }}>
          {HEROES.find((candidate) => candidate.id === id)?.name ?? id}
        </button>
      ))}
    </div>
    <div className="sprite-debug-controls">
      {availableStates.map((candidate) => (
        <button key={candidate} className={candidate === state ? "active" : ""} onClick={() => { setState(candidate); restart(); }}>{candidate.toUpperCase()}</button>
      ))}
      <button onClick={restart}>Restart Animation</button>
      <a href="/">게임으로 돌아가기</a>
    </div>
    <div className="sprite-debug-layout">
      <section className="sprite-debug-preview">
        <h2>HeroSprite 렌더 · 전투 64px 슬롯</h2>
        <div className="sprite-debug-stage">
          <div className="sprite-debug-ground" />
          <div className="sprite-debug-anchor" />
          <div className="sprite-debug-hero">
            <div className="unit-sprite" style={{ "--unit-sprite-height": `${Math.round(64 * config.scale)}px`, "--unit-facing": config.facing === "LEFT" ? -1 : 1 } as CSSProperties}>
              <div className="unit-sprite-motion">
                <div className="unit-sprite-facing">
                  <HeroSprite key={`${unitId}-${state}-${restartKey}`} hero={hero} state={state} gameSpeed={1} />
                </div>
              </div>
            </div>
          </div>
        </div>
        <p>노란선 = 발 기준선 · 십자 = 배치 기준점 · 상태 버튼을 누르면 전투와 동일한 CSS 애니메이션으로 재생됩니다.</p>
        <dl>
          <dt>Unit</dt><dd>{hero.name} ({unitId})</dd>
          <dt>State</dt><dd>{state}</dd>
          <dt>Frame size</dt><dd>{config.frameWidth} × {config.frameHeight}px</dd>
          <dt>Scale</dt><dd>{config.scale}</dd>
          <dt>Pivot</dt><dd>{config.pivotX}, {config.pivotY}</dd>
          <dt>Ground offset</dt><dd>{config.groundOffsetY ?? 0}px</dd>
          <dt>Facing</dt><dd>{config.facing ?? "RIGHT"}</dd>
          <dt>Animation</dt><dd>{animation ? `${animation.frameCount} frames @ ${animation.fps}fps · ${animation.loop ? "loop" : "one-shot"} · ${(animation.frameCount / animation.fps).toFixed(3)}s` : "없음"}</dd>
          {animation?.impactFrame !== undefined && <><dt>Impact frame</dt><dd>{animation.impactFrame}</dd></>}
          {animation?.projectileSpawnFrame !== undefined && <><dt>Projectile spawn</dt><dd>{animation.projectileSpawnFrame}</dd></>}
          {animation?.syncToAttackInterval && <><dt>Sync</dt><dd>attackInterval 동기화</dd></>}
        </dl>
      </section>
      <section className="sprite-debug-source">
        <h2>원본 프레임 · {animation?.asset.split("/").pop() ?? "asset 없음"}</h2>
        <div className="sprite-debug-frames">
          {animation && Array.from({ length: animation.frameCount }, (_, index) => {
            const cellWidth = config.frameWidth / 2;
            const cellHeight = config.frameHeight / 2;
            return (
              <div key={index} className="sprite-debug-frame-cell" style={{
                width: cellWidth,
                height: cellHeight,
                backgroundImage: `url("${animation.asset}")`,
                backgroundSize: `${cellWidth * animation.frameCount}px ${cellHeight}px`,
                backgroundPosition: `${-index * cellWidth}px 0`
              }}>
                <span>{index + 1}</span>
              </div>
            );
          })}
        </div>
        <p>프레임은 HeroSprite와 동일한 asset 매핑에서 ½ 배율로 잘라 보여줍니다.</p>
      </section>
    </div>
  </main>;
}
