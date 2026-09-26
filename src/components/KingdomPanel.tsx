import type { FacilityKey } from "../game/systems/kingdom";
import type { ProgressionGoal } from "../game/systems/progression";

type Unlock = { level: number; icon: string; title: string; text: string };
type Facility = { name: string; icon: string; unlock: number; baseCost: number; text: (lv: number) => string };

type Props = {
  kingdomLevel:number; kingdomGold:number; kingdomProductionBonus:number; kingdomSellBonus:number;
  unlockedStage:number; stageCount:number; currentStageName?:string; ownedHeroCount:number; heroCount:number;
  deckCount:number; deckSlotCount:number; progressionGoals:ProgressionGoal[]; claimedGoals:string[];
  completedGoalCount:number; claimedGoalCount:number; nextGoalText:string; kingdomUnlocks:readonly Unlock[];
  nextKingdomUnlock?:Unlock; kingdomMilestone:string; facilityDefs:Record<FacilityKey,Facility>;
  facilityLevels:Record<FacilityKey,number>; kingdomUpgradeCost:number;
  facilityUpgradeCost:(key:FacilityKey)=>number; onClaimGoal:(goal:ProgressionGoal)=>void;
  onUpgradeKingdom:()=>void; onUpgradeFacility:(key:FacilityKey)=>void; onBattle:()=>void;
};

export function KingdomPanel(p:Props){
  return <div className="kingdom-home">
    <div className="kingdom-hero"><div className="kingdom-castle">🏰</div><div><b>퓨어 왕국</b><span>성벽 너머의 전장을 돌파하고 왕국을 성장시키세요.</span></div></div>
    <div className="home-progress"><span>현재 전선</span><b>STAGE {Math.min(p.unlockedStage,p.stageCount)} · {p.currentStageName}</b><small>보유 영웅 {p.ownedHeroCount}/{p.heroCount} · 편성 {p.deckCount}/{p.deckSlotCount}</small><small>다음 목표 · {p.nextGoalText}</small></div>
    <div className="progression-board">
      <div className="progression-head"><div><span>ADVENTURE GOALS</span><b>왕국 성장 목표</b></div><strong>{p.claimedGoalCount}/{p.progressionGoals.length}</strong></div>
      <div className="progression-meter"><span style={{width:`${(p.completedGoalCount/p.progressionGoals.length)*100}%`}}/></div>
      <div className="progression-list">{p.progressionGoals.map(goal=>{const claimed=p.claimedGoals.includes(goal.id);return <div key={goal.id} className={`progression-goal ${goal.done?"done":""} ${claimed?"claimed":""}`}><span className="goal-icon">{goal.icon}</span><div><b>{goal.title}</b><small>{goal.text}</small><em>{goal.gold>0?`🪙 ${goal.gold.toLocaleString()}`:""}{goal.gold>0&&goal.gems>0?" · ":""}{goal.gems>0?`💎 ${goal.gems}`:""}</em></div><button disabled={!goal.done||claimed} onClick={()=>p.onClaimGoal(goal)}>{claimed?"수령 완료":goal.done?"보상 수령":"진행 중"}</button></div>})}</div>
    </div>
    <div className="kingdom-unlock-road"><div className="kingdom-unlock-head"><b>왕국 성장 로드</b><span>{p.nextKingdomUnlock?`NEXT · Lv.${p.nextKingdomUnlock.level}`:"CURRENT MAX"}</span></div><div className="kingdom-unlock-list">{p.kingdomUnlocks.map(entry=><div key={entry.level} className={p.kingdomLevel>=entry.level?"unlocked":entry.level===p.nextKingdomUnlock?.level?"next":""}><span>{entry.icon}</span><b>Lv.{entry.level}</b><small>{entry.title}</small><p>{entry.text}</p></div>)}</div></div>
    <div className="facility-grid">
      <div className="facility-card castle-card"><span>🏰</span><div><b>왕성 Lv.{p.kingdomLevel}</b><small>자동채집 ×{p.kingdomProductionBonus.toFixed(2)} · 판매 ×{p.kingdomSellBonus.toFixed(2)}</small><small className="next-unlock">다음 효과: {p.kingdomMilestone}</small></div><button disabled={p.kingdomGold<p.kingdomUpgradeCost} onClick={p.onUpgradeKingdom}>강화 · {p.kingdomUpgradeCost} 🪙</button></div>
      {(Object.keys(p.facilityDefs) as FacilityKey[]).map(key=>{const f=p.facilityDefs[key],unlocked=p.kingdomLevel>=f.unlock;return <div key={key} className={`facility-card ${!unlocked?"facility-locked":""}`}><span>{f.icon}</span><div><b>{f.name} Lv.{p.facilityLevels[key]}</b><small>{unlocked?f.text(p.facilityLevels[key]):`왕성 Lv.${f.unlock}에서 해금`}</small></div><button disabled={!unlocked||p.kingdomGold<p.facilityUpgradeCost(key)} onClick={()=>p.onUpgradeFacility(key)}>{unlocked?`강화 · ${p.facilityUpgradeCost(key)} 🪙`:"잠김"}</button></div>})}
    </div>
    <button className="home-battle-cta" onClick={p.onBattle}>⚔️ 전투 출격</button>
  </div>;
}
