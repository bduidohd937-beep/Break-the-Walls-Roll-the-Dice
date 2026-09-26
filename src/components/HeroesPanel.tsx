import type { UnitDef } from "../game/types";
import { ELEMENT_LABEL } from "../game/constants";
import type { HeroGradeName } from "../game/systems/heroGrowth";

type Grade={name:HeroGradeName|"???";multiplier:number};
type Trait={name:string;text:string};
type SoulBonus={hp:number;atk:number;speed:number};
type Props={
 heroes:UnitDef[]; ownedHeroes:string[]; deckIds:string[]; deckSlotCount:number;
 heroMode:"formation"|"upgrade"; setHeroMode:(v:"formation"|"upgrade")=>void;
 formationPage:0|1; setFormationPage:(v:0|1)=>void; dragHeroId:string|null;
 setDragHeroId:(v:string|null)=>void; touchY:{current:number|null};
 setDeckSlot:(index:number,id:string)=>void; removeDeckSlot:(index:number)=>void;
 selectedHeroId:string; setSelectedHeroId:(id:string)=>void; kingdomGold:number;soulShards:number;
 heroSouls:Record<string,number>; getLevel:(id:string)=>number; getMultiplier:(id:string,level?:number)=>number;
 getPower:(hero:UnitDef,level:number)=>number; getSoulBonus:(id:string)=>SoulBonus; getUpgradeCost:(id:string)=>number;
 getGrade:(id:string)=>Grade; getGrowth:(id:string)=>number; getTrait:(hero:UnitDef)=>Trait;
 upgradeUnit:(id:string)=>void; buySoul:(id:string)=>void;
};
export function HeroesPanel(p:Props){
 const selected=p.heroes.find(h=>h.id===p.selectedHeroId)??p.heroes[0],owned=p.ownedHeroes.includes(selected.id);
 const level=p.getLevel(selected.id),mult=p.getMultiplier(selected.id,level),nextMult=p.getMultiplier(selected.id,Math.min(10,level+1));
 const power=p.getPower(selected,level),nextPower=p.getPower(selected,Math.min(10,level+1)),soul=p.getSoulBonus(selected.id),cost=p.getUpgradeCost(selected.id),grade=p.getGrade(selected.id);
 const soulPlus=p.heroSouls[selected.id]??0,milestones=[5,10,15,20,25,30],nextMilestone=milestones.find(v=>v>soulPlus)??30;
 return <div className="hero-center">
  <div className="hero-mode-tabs"><button className={p.heroMode==="formation"?"active":""} onClick={()=>p.setHeroMode("formation")}>⚔️ 영웅 편성</button><button className={p.heroMode==="upgrade"?"active":""} onClick={()=>p.setHeroMode("upgrade")}>⬆️ 영웅 강화</button></div>
  {p.heroMode==="formation"?<><div className="formation-help">보유 영웅을 아래 출전 슬롯으로 드래그하세요. 슬롯의 영웅을 누르면 편성에서 빠집니다.</div>
   <div className="formation-roster">{p.heroes.filter(h=>p.ownedHeroes.includes(h.id)).map(h=><div key={h.id} className={`formation-hero ${p.deckIds.includes(h.id)?"in-deck":""}`} draggable onDragStart={()=>p.setDragHeroId(h.id)} onDragEnd={()=>p.setDragHeroId(null)}><span>{h.sprite}</span><b>{h.name}</b><small>{p.getGrade(h.id).name} · Lv.{p.getLevel(h.id)}</small></div>)}</div>
   <div className="formation-pager" onTouchStart={e=>{p.touchY.current=e.touches[0]?.clientY??null}} onTouchEnd={e=>{if(p.touchY.current==null)return;const end=e.changedTouches[0]?.clientY??p.touchY.current,d=end-p.touchY.current;if(d< -35)p.setFormationPage(1);if(d>35)p.setFormationPage(0);p.touchY.current=null}}>
    <button className="formation-arrow" disabled={p.formationPage===0} onClick={()=>p.setFormationPage(0)}>↑</button><div className="formation-page-label">{p.formationPage===0?"출전 1 · 슬롯 1~5":"출전 2 · 슬롯 6~10"}</div>
    <div className="formation-slots five">{Array.from({length:5},(_,local)=>{const index=p.formationPage*5+local,id=p.deckIds[index],h=p.heroes.find(x=>x.id===id);return <div key={index} className={`formation-slot ${h?"filled":""}`} onDragOver={e=>e.preventDefault()} onDrop={()=>{if(p.dragHeroId)p.setDeckSlot(index,p.dragHeroId);p.setDragHeroId(null)}} onClick={()=>h&&p.removeDeckSlot(index)}><em>{index+1}</em>{h?<><span>{h.sprite}</span><b>{h.name}</b></>:<small>DROP</small>}</div>})}</div>
    <button className="formation-arrow" disabled={p.formationPage===1} onClick={()=>p.setFormationPage(1)}>↓</button><div className="formation-dots"><i className={p.formationPage===0?"active":""}/><i className={p.formationPage===1?"active":""}/></div>
   </div></>:<div className="hero-management upgrade-only">
    <div className="hero-roster"><div className="deck-builder-title">강화할 영웅 선택</div><div className="deck-builder-grid">{p.heroes.map(h=>{const own=p.ownedHeroes.includes(h.id);return <button key={h.id} className={`deck-builder-card ${!own?"disabled":""} ${selected.id===h.id?"focused":""}`} onClick={()=>p.setSelectedHeroId(h.id)}><span>{h.sprite}</span><b>{h.name}</b><small>{own?`${p.getGrade(h.id).name} · Lv.${p.getLevel(h.id)} · 영혼 +${p.heroSouls[h.id]??0}`:"🔒 미보유"}</small></button>})}</div></div>
    <div className={`hero-detail ${!owned?"locked":""}`}><div className="hero-detail-head"><span>{selected.sprite}</span><div><small>{grade.name} · {selected.role}</small><h2>{selected.name}</h2><b>Lv.{level}</b></div></div>
    {owned&&<div className="hero-profile-strip"><span>{ELEMENT_LABEL[selected.element]}</span><span>{selected.rangeType==="ranged"?"원거리":"근거리"} · 사거리 {selected.range}</span><span>이동 {selected.speed}</span><span>출전 {selected.cost}G</span><span>쿨 {selected.cooldown}s</span></div>}
    {owned?<><div className="hero-power-card"><small>COMBAT POWER</small><b>{power.toLocaleString()}</b>{level<10&&<span>다음 Lv.{level+1} → {nextPower.toLocaleString()}</span>}</div>
    <div className="hero-trait-card"><div><small>COMBAT TRAIT</small><b>{p.getTrait(selected).name}</b></div><p>{p.getTrait(selected).text}</p><span>{selected.attackType==="splash"?"광역":"단일"} · 공격주기 {(selected.attackInterval*soul.speed).toFixed(2)}초</span></div>
    <div className="hero-stat-grid"><div><span>HP</span><b>{Math.round(selected.hp*mult*soul.hp)}</b>{level<10&&<small>→ {Math.round(selected.hp*nextMult*soul.hp)}</small>}</div><div><span>ATK</span><b>{Math.round(selected.atk*mult*soul.atk)}</b>{level<10&&<small>→ {Math.round(selected.atk*nextMult*soul.atk)}</small>}</div><div><span>공격속도</span><b>{(selected.attackInterval*soul.speed).toFixed(2)}s</b><small>영혼 성장 적용</small></div><div><span>등급 성장</span><b>Lv당 +{Math.round(p.getGrowth(selected.id)*100)}%</b><small>{grade.name}</small></div></div>
    <div className="hero-soul-panel"><div className="hero-soul-head"><span>영혼 성장</span><b>+{soulPlus}/30</b></div><div className="hero-soul-track"><i style={{width:`${(soulPlus/30)*100}%`}}/></div><div className="hero-soul-milestones">{milestones.map(v=><div key={v} className={soulPlus>=v?"reached":""}><b>+{v}</b><small>{v===5?"HP +8%":v===10?"ATK +8%":v===15?"공속 +8%":v===20?"HP +12%":v===25?"ATK +12%":"HP/ATK +10% · 공속 +5%"}</small></div>)}</div><div className="hero-soul-next">{soulPlus>=30?"영혼 성장 MAX":`다음 마일스톤 +${nextMilestone} · 중복 영웅 또는 영혼 파편으로 성장할 수 있습니다.`}</div>{soulPlus<30&&<button className="soul-shard-buy" disabled={p.soulShards<100} onClick={()=>p.buySoul(selected.id)}>🧩 영혼 파편 100 → {selected.name} 영혼 +1</button>}</div>
    <div className="hero-detail-actions single"><button disabled={level>=10||p.kingdomGold<cost} onClick={()=>p.upgradeUnit(selected.id)}>{level>=10?"MAX LEVEL":`강화 · ${cost} 🪙`}</button></div><div className="upgrade-preview">{grade.name} 성장률 적용 · Lv당 HP / ATK +{Math.round(p.getGrowth(selected.id)*100)}% · 보유 {p.kingdomGold.toLocaleString()} 🪙</div></>:<div className="hero-locked-message">🎲 소환에서 획득해야 강화할 수 있습니다.</div>}</div>
   </div>}
 </div>
}
