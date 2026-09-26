export type HubTab = "home" | "gather" | "battle" | "heroes" | "summon" | "storage" | "fusion";

const HUB_PAGES: Record<HubTab, { title: string; description: string }> = {
  home: { title: "왕국", description: "성장을 관리하고 다음 출격을 준비하세요." },
  gather: { title: "채집", description: "영웅을 배치하고 자원을 모아 왕국을 성장시키세요." },
  battle: { title: "전투", description: "스테이지를 선택하고 출격할 영웅의 순서를 결정하세요." },
  heroes: { title: "영웅", description: "출전 영웅을 편성하고 보유 영웅을 강화하세요." },
  summon: { title: "소환", description: "소환 결과는 저장소에서 영입하거나 변환할 수 있습니다." },
  storage: { title: "영웅 저장소", description: "소환한 영웅을 영입하거나 영혼·파편으로 변환하세요." },
  fusion: { title: "영웅 합성소", description: "합성 가능한 영웅과 필요한 재료를 확인하세요." },
};

type Props = {
  tab: HubTab;
  devMode: boolean;
  kingdomLevel: number;
  gems: number;
  gold: number;
  clearedCount: number;
  totalStages: number;
  nextStageLabel: string;
  claimableGoals: number;
  storageCount: number;
  canNavigate: boolean;
  onBattle: () => void;
  onStorage: () => void;
};

export function HubHeader(p: Props) {
  const page = HUB_PAGES[p.tab];
  return <header className="hub-header">
    <div className="stage-select-kicker">BREAK THE WALLS · ROLL THE DICE</div>
    {p.devMode && <div className="hub-dev-label">🛠 로컬 개발자 테스트 · 전체 스테이지 해금</div>}
    <div className="hub-header-title"><div><h1>{page.title}</h1><p>{page.description}</p></div><span className="hub-header-chapter">PURE WORLD · CHAPTER 1</span></div>
    <div className="stage-select-stats">
      <span>🏯 영지 Lv.<b>{p.kingdomLevel}</b></span>
      <span>💎 보석 <b>{p.gems.toLocaleString()}</b></span>
      <span>🪙 Game Gold <b>{p.gold.toLocaleString()}</b></span>
      <span>🏆 클리어 <b>{p.clearedCount}/{p.totalStages}</b></span>
    </div>
    <div className="hub-next-actions">
      <div><small>다음 목표</small><strong>{p.nextStageLabel}</strong><span>수령 가능 목표 {p.claimableGoals}개 · 저장소 {p.storageCount}명</span></div>
      <button type="button" disabled={!p.canNavigate} onClick={p.onBattle}>⚔️ 전장 선택</button>
      <button type="button" disabled={!p.canNavigate} onClick={p.onStorage}>📦 저장소 {p.storageCount}</button>
    </div>
  </header>;
}
