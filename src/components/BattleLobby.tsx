import type { ReactNode } from "react";
import type { StageDef, UnitDef } from "../game/types";
import { StageSelectPanel } from "./StageSelectPanel";

export function BattleLobby(p:{ stages:StageDef[]; unlockedStage:number; clearedStages:number[]; devMode:boolean; selected:number|null; onPick:(index:number)=>void; onBack:()=>void; onDeploy:(index:number)=>void; formationOpen:boolean; onFormation:()=>void; formation:ReactNode; deck:UnitDef[] }) {
  const stage=p.selected===null?null:p.stages[p.selected];
  return <section className="kingdom-battle-lobby">
    <header className="kingdom-panel-heading"><div><small>PURE WORLD · CHAPTER 1</small><h2>{stage?`STAGE ${stage.id} · ${stage.name}`:"챕터 선택 → 스테이지 선택"}</h2></div>{stage&&<button type="button" onClick={p.onBack}>← 스테이지 선택</button>}</header>
    {!stage?<><div className="kingdom-chapter">퓨어 월드 · 챕터 1 <small>전체 {p.stages.length} 스테이지</small></div><StageSelectPanel stages={p.stages} unlockedStage={p.unlockedStage} clearedStages={p.clearedStages} devMode={p.devMode} onSelect={p.onPick}/></>:<><p>출전 편성을 확인하고 전투를 시작하세요.</p><div className="battle-lobby-deck">{p.deck.map((hero,index)=><span key={`${hero.id}-${index}`}>{index+1}. {hero.name}</span>)}</div><button type="button" onClick={p.onFormation}>{p.formationOpen?"편성 닫기":"전투 편성 변경"}</button>{p.formationOpen&&p.formation}<button type="button" className="battle-lobby-launch" onClick={()=>p.onDeploy(p.selected!)}>⚔️ 출전</button></>}
  </section>;
}
