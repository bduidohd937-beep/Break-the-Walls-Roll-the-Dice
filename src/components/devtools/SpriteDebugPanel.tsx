import { useEffect, useState, type CSSProperties } from "react";
import { UNIT_SPRITES, type Frame } from "../../game/visuals/sprites";
import "./sprite-debug.css";

type Animation = "idle" | "walk" | "attack" | "hit" | "death";
type Bounds = { left: number; top: number; right: number; bottom: number };
const sheet = UNIT_SPRITES.traineeSword;
const stateDuration: Record<Exclude<Animation, "death">, number> = { idle: .85, walk: .55, attack: .16, hit: .14 };
const soulSteps = 6;
const fallCount = sheet.death.fall.length;
const deathCount = fallCount + 1 + soulSteps;
const deathDuration = sheet.death.fallSeconds + sheet.death.corpseSeconds + sheet.death.soulSeconds;

function frameCount(animation: Animation) { return animation === "death" ? deathCount : sheet[animation].length; }
function duration(animation: Animation) { return animation === "death" ? deathDuration : stateDuration[animation]; }
function timeForFrame(animation: Animation, index: number) {
  if (animation !== "death") return (index + .5) * duration(animation) / frameCount(animation);
  if (index < fallCount) return (index + .5) * sheet.death.fallSeconds / fallCount;
  if (index === fallCount) return sheet.death.fallSeconds + sheet.death.corpseSeconds / 2;
  return sheet.death.fallSeconds + sheet.death.corpseSeconds + (index - fallCount - .5) * sheet.death.soulSeconds / soulSteps;
}
function indexAtTime(animation: Animation, elapsed: number) {
  const count = frameCount(animation);
  if (animation !== "death") return Math.min(count - 1, Math.floor(elapsed / duration(animation) * count));
  if (elapsed < sheet.death.fallSeconds) return Math.min(fallCount - 1, Math.floor(elapsed / sheet.death.fallSeconds * fallCount));
  if (elapsed < sheet.death.fallSeconds + sheet.death.corpseSeconds) return fallCount;
  return Math.min(count - 1, fallCount + 1 + Math.floor((elapsed - sheet.death.fallSeconds - sheet.death.corpseSeconds) / sheet.death.soulSeconds * soulSteps));
}
const cropStyle = ([column, y]: Frame): CSSProperties => ({
  backgroundImage: `url("${sheet.image}")`, backgroundPosition: `${-column * 128}px ${-y * 4}px`, backgroundSize: "1024px 1024px",
});

export function SpriteDebugPanel() {
  const [animation, setAnimation] = useState<Animation>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [source, setSource] = useState<{ width: number; height: number; pixels: Uint8ClampedArray } | null>(null);
  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d"); if (!context) return;
      context.drawImage(image, 0, 0);
      setSource({ width: canvas.width, height: canvas.height, pixels: context.getImageData(0, 0, canvas.width, canvas.height).data });
    };
    image.src = sheet.image;
    return () => { image.onload = null; };
  }, []);
  useEffect(() => {
    if (!playing) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now(); const delta = Math.min(.1, (now - previous) / 1000); previous = now;
      setElapsed(current => {
        const next = current + delta;
        return animation === "idle" || animation === "walk" ? next % duration(animation) : Math.min(duration(animation), next);
      });
    }, 30);
    return () => window.clearInterval(timer);
  }, [animation, playing]);
  useEffect(() => { if (animation !== "idle" && animation !== "walk" && elapsed >= duration(animation)) setPlaying(false); }, [animation, elapsed]);

  const index = indexAtTime(animation, elapsed);
  const phase = animation !== "death" ? animation : index < fallCount ? "dying" : index === fallCount ? "corpse" : "soul ascend";
  const frame: Frame = animation !== "death" ? sheet[animation][index] : index < fallCount ? sheet.death.fall[index] : sheet.death.corpse;
  const soulStep = Math.max(0, index - fallCount - 1);
  const soulProgress = animation === "death" && index > fallCount ? soulStep / soulSteps : 0;
  const x = frame[0] * 32, y = frame[1];
  let bounds: Bounds | null = null;
  if (source) {
    for (let py = y; py < Math.min(source.height, y + 44); py++) for (let px = x; px < Math.min(source.width, x + 32); px++) {
      if (source.pixels[(py * source.width + px) * 4 + 3] < 16) continue;
      if (!bounds) bounds = { left: px, top: py, right: px, bottom: py };
      else { bounds.left = Math.min(bounds.left, px); bounds.top = Math.min(bounds.top, py); bounds.right = Math.max(bounds.right, px); bounds.bottom = Math.max(bounds.bottom, py); }
    }
  }
  const setState = (next: Animation) => { setAnimation(next); setElapsed(0); setPlaying(true); };
  const step = (direction: number) => { setPlaying(false); setElapsed(timeForFrame(animation, Math.max(0, Math.min(frameCount(animation) - 1, index + direction)))); };

  return <main className="sprite-debug-page">
    <h1>001 병사 · Sprite Debug</h1><p>개발 서버 전용 · 원본 시트와 현재 매핑을 비교합니다. 전투 데이터는 변경하지 않습니다.</p>
    <div className="sprite-debug-controls">{(["idle", "walk", "attack", "hit", "death"] as Animation[]).map(state => <button key={state} className={animation === state ? "active" : ""} onClick={() => setState(state)}>{state.toUpperCase()}</button>)}<button onClick={() => setState(animation)}>Restart Animation</button></div>
    <div className="sprite-debug-controls"><button onClick={() => step(-1)}>◀ Previous Frame</button><button onClick={() => setPlaying(value => !value)}>{playing ? "Pause Animation" : "Play Animation"}</button><button onClick={() => step(1)}>Next Frame ▶</button><a href="/">게임으로 돌아가기</a></div>
    <div className="sprite-debug-layout">
      <section className="sprite-debug-preview"><h2>현재 프레임 · 4배 확대</h2><div className="sprite-debug-stage"><div className="sprite-debug-ground"/><div className="sprite-debug-anchor"/><div className={`sprite-debug-frame ${animation === "death" && index >= fallCount ? "sprite-debug-corpse" : ""}`} style={cropStyle(frame)}/>{animation === "death" && index > fallCount && <div className="sprite-debug-spirit" style={{ ...cropStyle(sheet.death.soul), transform: `translateY(${-soulProgress * 84}px)`, opacity: 1 - soulProgress }}/>}</div><p>노란선 = 발 기준선 · 십자 = 배치 기준점</p>
      <dl><dt>Unit</dt><dd>001 병사</dd><dt>Animation</dt><dd>{animation}</dd><dt>Current Frame / Step</dt><dd>{index + 1} / {frameCount(animation)}</dd><dt>Source frames</dt><dd>{animation === "death" ? "6개 고유 영역 · 12개 재생 단계 (영혼 영역 반복)" : `${frameCount(animation)}개 매핑`}</dd><dt>Frame duration</dt><dd>{animation === "death" ? phase === "dying" ? (sheet.death.fallSeconds / fallCount).toFixed(3) : phase === "corpse" ? sheet.death.corpseSeconds.toFixed(3) : (sheet.death.soulSeconds / soulSteps).toFixed(3) : (duration(animation) / frameCount(animation)).toFixed(3)}초</dd><dt>Elapsed</dt><dd>{elapsed.toFixed(3)} / {duration(animation).toFixed(2)}초</dd><dt>Source</dt><dd>{source?.width ?? "…"} × {source?.height ?? "…"} px</dd><dt>Crop</dt><dd>x={x}, y={y}, w=32, h=44 요청 · 유효 높이 {Math.min(44, Math.max(0, (source?.height ?? 256) - y))}px</dd><dt>Alpha bounds</dt><dd>{bounds ? `${bounds.left - x}, ${bounds.top - y} → ${bounds.right - x}, ${bounds.bottom - y}` : "빈 프레임"}</dd><dt>Foot gap</dt><dd>{bounds ? `${43 - (bounds.bottom - y)} px (현재 crop 기준)` : "—"}</dd><dt>Render</dt><dd>128 × 176 px · nearest / pixelated</dd><dt>Anchor</dt><dd>중앙 X, crop 하단 Y · CSS transform origin 50% 88%</dd><dt>Death state</dt><dd>{animation === "death" ? phase : "alive"}</dd><dt>Damage Frame</dt><dd>{animation === "attack" ? "실제 전투: 1 / 7 (모션 시작 즉시)" : "전투 코드: attackFlash 설정과 같은 tick"}</dd></dl></section>
      <section className="sprite-debug-source"><h2>원본 PNG · 2배 확대</h2><div className="sprite-debug-atlas"><img src={sheet.image} alt="001 병사 원본 256×256 스프라이트 시트"/>{[0,48,92,132,176,224].map(value=><div key={value} className="sprite-debug-row" style={{top:value*2}}><span>y={value}</span></div>)}<div className="sprite-debug-selection" style={{left:x*2,top:y*2}}/></div><p>가로 32px 단위로 잘라 쓰지만 행의 시작 Y는 일정하지 않습니다. 선택 프레임의 노란 테두리와 원본 캐릭터 경계를 비교하세요.</p><p>사망 시체와 영혼은 같은 PNG 하단에 있으며, 현재 코드는 영혼 프레임 위쪽만 잘라 별도 레이어로 보여줍니다.</p></section>
    </div>
  </main>;
}
