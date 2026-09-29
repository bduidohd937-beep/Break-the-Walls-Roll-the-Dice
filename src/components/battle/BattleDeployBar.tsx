import { useRef } from "react";
import type { CSSProperties, MouseEvent, PointerEvent } from "react";
import type { UnitDef } from "../../game/types";
import { ELEMENT_CLASS } from "../../game/constants";
import { HeroSprite } from "../shared/HeroSprite";
import { battleDeckPageAfterSwipe } from "../../game/systems/battleCamera";

type Props = {
  visibleDeck: UnitDef[];
  battleDeckPage: 0 | 1;
  onDeckPage: (page: 0 | 1) => void;
  deployCooldowns: Record<string, number>;
  battleGold: number;
  pauseScreen: boolean;
  deckCount: number;
  deckSlotCount: number;
  kingdomLevel: number;
  ownedHeroCount: number;
  heroTotal: number;
  getUnitLevel: (id: string) => number;
  onDeploy: (hero: UnitDef) => void;
};

export function BattleDeployBar(p: Props) {
  const swipeStart = useRef<{ pointerId: number; x: number } | null>(null);
  const suppressClickUntil = useRef(0);
  const suppressionTimer = useRef<number | undefined>(undefined);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!event.isPrimary) return;
    swipeStart.current = { pointerId: event.pointerId, x: event.clientX };
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    const delta = event.clientX - start.x;
    if (Math.abs(delta) < 42) return;

    suppressClickUntil.current = Date.now() + 500;
    window.clearTimeout(suppressionTimer.current);
    suppressionTimer.current = window.setTimeout(() => { suppressClickUntil.current = 0; }, 500);

    const nextPage = battleDeckPageAfterSwipe(p.battleDeckPage, delta, p.deckCount);
    if (nextPage === p.battleDeckPage) return;
    p.onDeckPage(nextPage);
  };

  const onPointerCancel = (event: PointerEvent<HTMLElement>) => {
    if (swipeStart.current?.pointerId === event.pointerId) swipeStart.current = null;
  };

  const onClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (Date.now() >= suppressClickUntil.current) return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <>
      <section
        className="deck-panel"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClickCapture={onClickCapture}
      >
        <div className="battle-deck-header">
          <b>⚔️ 출전 영웅 · {p.battleDeckPage === 0 ? "1~5" : "6~10"}</b>
          <span>탭 출격 · 좌우 밀어 슬롯 전환 · {p.deckCount}/{p.deckSlotCount}</span>
        </div>
        <div className="battle-deck-pages">
          <button className="swap-btn" disabled={p.battleDeckPage === 0} onClick={() => p.onDeckPage(0)} aria-label="출전 슬롯 1~5">‹</button>
          <div key={p.battleDeckPage} className={`deck-slots ${p.battleDeckPage === 1 ? "slide-next" : "slide-prev"}`}>
            {p.visibleDeck.slice(p.battleDeckPage * 5, p.battleDeckPage * 5 + 5).map((hero, localIndex) => {
              const slot = p.battleDeckPage * 5 + localIndex;
              const cooldown = p.deployCooldowns[hero.id] ?? 0;
              const lacksGold = p.battleGold < hero.cost;
              const cooling = cooldown > 0;
              const disabled = lacksGold || cooling;
              return (
                <div key={hero.id} className={`hero-card-wrap ${disabled ? "disabled" : "ready"} ${lacksGold ? "no-gold" : ""} ${cooling ? "cooling" : ""}`}>
                  <button className="hero-card" title={hero.story} disabled={p.pauseScreen} onClick={() => p.onDeploy(hero)} aria-label={`${hero.name} 출격, 비용 ${hero.cost}${cooling ? `, 대기 ${cooldown.toFixed(1)}초` : ""}`}>
                    <div className={`hero-sprite ${ELEMENT_CLASS[hero.element]}`}>
                      <HeroSprite hero={hero} variant="deploy" /><span className="spark" />
                    </div>
                    <div className="hero-name"><em>{slot === 9 ? "0" : slot + 1}</em> {hero.name}</div>
                    <div className="hero-meta"><span>Lv.{p.getUnitLevel(hero.id)}</span><b>🪙 {hero.cost}</b></div>
                    <div className="cooldown">{cooling ? `⏱ ${cooldown.toFixed(1)}s` : lacksGold ? `🪙 ${Math.ceil(hero.cost - p.battleGold)} 부족` : "출격 가능"}</div>
                    {cooling && <div className="cooldown-mask" style={{ "--cooldown-ratio": `${Math.min(100, (cooldown / hero.cooldown) * 100)}%` } as CSSProperties} />}
                  </button>
                </div>
              );
            })}
          </div>
          <button className="swap-btn" disabled={p.battleDeckPage === 1 || p.deckCount <= 5} onClick={() => p.onDeckPage(1)} aria-label="출전 슬롯 6~10">›</button>
        </div>
      </section>
      <div className="deck-indicator">영웅 편성 {p.deckCount}/{p.deckSlotCount} · 영지 Lv.{p.kingdomLevel} · 보유 {p.ownedHeroCount}/{p.heroTotal}</div>
    </>
  );
}
