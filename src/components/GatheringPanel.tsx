import type { UnitDef } from "../game/types";
import { GATHER_REGIONS, type GatherRegionKey, type ResourceType } from "../game/systems/gathering";

type Props={
 resources:Record<ResourceType,number>; offlineGather:{wood:number;stone:number;seconds:number}|null;
 onDismissOffline:()=>void; gatherRegion:GatherRegionKey; onRegion:(key:GatherRegionKey)=>void;
 isRegionUnlocked:(key:GatherRegionKey)=>boolean; gatherHp:Record<ResourceType,number>;
 gatherMaxHp:Record<ResourceType,number>; gatherReward:Record<ResourceType,number>; gatherHit:ResourceType|null;
 workers:Partial<Record<ResourceType,string>>; heroes:UnitDef[]; ownedHeroes:string[]; kingdomSellBonus:number;
 getEfficiency:(id?:string)=>number; getAttackDamage:(type:ResourceType)=>number; getAutoAmount:(type:ResourceType)=>number;
 onGather:(type:ResourceType)=>void; onSell:(type:ResourceType)=>void; onAssign:(type:ResourceType,id:string)=>void;
};
export function GatheringPanel(p:Props){
 const region=GATHER_REGIONS[p.gatherRegion];
 return <div className="gather-hub">
  <div className="resource-storage"><span>📦 보관함</span><b>🌲 {p.resources.wood} 나무</b><b>🪨 {p.resources.stone} 돌</b></div>
  {p.offlineGather&&<div className="offline-gather-result"><div><b>🌙 오프라인 채집 정산</b><span>최대 8시간까지 자동 생산이 누적됩니다.</span></div><strong>{p.offlineGather.wood>0?`🌲 +${p.offlineGather.wood}`:""} {p.offlineGather.stone>0?`🪨 +${p.offlineGather.stone}`:""}</strong><small>{Math.floor(p.offlineGather.seconds/60)}분 생산</small><button onClick={p.onDismissOffline}>확인</button></div>}
  <div className="gather-region-progress"><b>🗺️ 채집 지역</b>{(Object.keys(GATHER_REGIONS) as GatherRegionKey[]).map(key=>{const r=GATHER_REGIONS[key],unlocked=p.isRegionUnlocked(key);return <button key={key} disabled={!unlocked} className={p.gatherRegion===key?"active":""} onClick={()=>p.onRegion(key)}>{r.icon} {r.name}<br/><small>{unlocked?`HP ×${r.scale} · 보상 ×${r.scale}`:`STAGE ${r.unlockStage} 필요`}</small></button>})}</div>
  <div className="region-bonus">{region.icon} {region.name} · {region.description}</div>
  <div className="gather-grid">{(["wood","stone"] as const).map(type=>{const isWood=type==="wood",assigned=p.workers[type]?p.heroes.find(h=>h.id===p.workers[type]):undefined,max=p.gatherMaxHp[type]*region.scale,hp=(p.gatherHp[type]/max)*100;return <div className={`gather-site resource-battle ${p.gatherHit===type?"resource-hit":""}`} key={type}>
   <h2>{isWood?"🌲 왕국 숲":"🪨 채석장"}</h2><p>{isWood?"거목을 쓰러뜨려 목재를 획득하세요.":"광맥을 파괴해 석재를 획득하세요."}</p>
   <div className="resource-arena">{assigned&&<div className="worker-fighter"><span>{assigned.sprite}</span><small>{assigned.name}</small><b>효율 ×{p.getEfficiency(assigned.id).toFixed(2)}</b><i>{isWood?"🪓":"⛏️"}</i></div>}<button className="resource-target" onClick={()=>p.onGather(type)}><span className="resource-object">{isWood?"🌳":"🪨"}</span><span className="resource-impact">{isWood?"🪵":"✦"}</span></button></div>
   <div className="resource-hp"><span style={{width:`${hp}%`}}/></div><div className="resource-hp-label">{p.gatherHp[type]} / {max} HP · 공격 피해 {p.getAttackDamage(type)} · 파괴 보상 +{p.gatherReward[type]*region.scale}</div>
   <button className="gather-action" onClick={()=>p.onGather(type)}>{assigned?`${assigned.sprite} ${assigned.name} 공격`:isWood?"🪓 벌목 공격":"⛏️ 채광 공격"}</button>
   <button className="sell-action" disabled={p.resources[type]<=0} onClick={()=>p.onSell(type)}>전부 판매 · +{Math.round(p.resources[type]*(isWood?5:8)*p.kingdomSellBonus)} 🪙</button>
   <div className="worker-box"><b>자동 채집</b><span>{assigned?`${assigned.sprite} ${assigned.name} · 자동 생산 +${p.getAutoAmount(type)}/3초 · 효율 ×${p.getEfficiency(assigned.id).toFixed(2)}`:"영웅을 배치하면 자동 생산"}</span></div>
   <div className="worker-list">{p.ownedHeroes.map(id=>{const h=p.heroes.find(x=>x.id===id);if(!h)return null;const busy=Object.entries(p.workers).some(([key,value])=>key!==type&&value===id);return <button key={id} disabled={busy} className={p.workers[type]===id?"assigned":""} onClick={()=>p.onAssign(type,id)}>{h.sprite}<small>{h.name}<br/>×{p.getEfficiency(h.id).toFixed(2)}</small></button>})}</div>
  </div>})}</div>
 </div>;
}
