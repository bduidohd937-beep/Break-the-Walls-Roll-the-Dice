import { FullscreenToggle } from "../shared/FullscreenToggle";

export type HubTab = "home" | "gather" | "battle" | "heroes" | "summon" | "storage" | "fusion" | "shop";

type Props = {
  tab: HubTab; devMode: boolean; kingdomLevel: number; gems: number; gold: number;
  nextLevelProgress: number; onSettings: () => void;
};

export function HubHeader(p: Props) {
  return <header className="kingdom-hud">
    <div className="kingdom-hud-level" aria-label={`왕국 레벨 ${p.kingdomLevel}`}>
      <b>왕국 Lv.{p.kingdomLevel}</b>
      <div className="kingdom-hud-track" role="progressbar" aria-label="왕성 강화 자금 확보율" aria-valuenow={p.nextLevelProgress} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${p.nextLevelProgress}%`}} /></div>
      {p.devMode && <small>개발 환경</small>}
    </div>
    {p.tab !== "home" && <strong className="kingdom-hud-location">{({gather:"채집",battle:"출전",heroes:"영웅",summon:"소환",storage:"보관함",fusion:"합성",shop:"상점"} as Record<string,string>)[p.tab]}</strong>}
    <div className="kingdom-hud-wallet">
      <span className="hud-currency"><i className="hud-icon hud-gold" aria-hidden="true"/> Gold <b>{p.gold.toLocaleString()}</b></span>
      <span className="hud-currency"><i className="hud-icon hud-gem" aria-hidden="true"/> Gem <b>{p.gems.toLocaleString()}</b></span>
      <FullscreenToggle className="hud-fullscreen" />
      <button type="button" className="hud-settings" onClick={p.onSettings} aria-label="게임 설정" title="게임 설정">⚙</button>
    </div>
  </header>;
}
