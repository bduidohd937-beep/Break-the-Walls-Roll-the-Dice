import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { UnitDef } from "../types";
import { GATHER_REGIONS, getAutoGatherAmount as calculateAutoGatherAmount, getGatherAttackDamage as calculateGatherAttackDamage, getGatherEfficiency as calculateGatherEfficiency, getResourceSellPrice, type GatherRegionKey, type ResourceType } from "../systems/gathering";
import { GATHER_GRADE_BONUS, type HeroGradeName } from "../systems/heroGrowth";
import { STORAGE_KEYS, saveJson, saveNumber } from "../storage";

type Resources=Record<ResourceType,number>;
type Workers=Partial<Record<ResourceType,string>>;
type Hp=Record<ResourceType,number>;
type Grade={name:HeroGradeName|"???";multiplier:number};
type Args={
 heroes:UnitDef[]; clearedStages:number[]; devMode:boolean; gatherRegion:GatherRegionKey; resources:Resources; setResources:Dispatch<SetStateAction<Resources>>;
 workers:Workers; setWorkers:Dispatch<SetStateAction<Workers>>; gatherHp:Hp; setGatherHp:Dispatch<SetStateAction<Hp>>;
 setGatherHit:Dispatch<SetStateAction<ResourceType|null>>; kingdomSellBonus:number; kingdomProductionBonus:number;
 facilityLevels:{lumber:number;quarry:number}; setKingdomGold:Dispatch<SetStateAction<number>>;
 gatherLastSeenRef:MutableRefObject<number>; getUnitLevel:(id:string)=>number; getLevelMultiplier:(id:string)=>number; getHeroGrade:(id:string)=>Grade;
 gatherMaxHp:Hp; gatherReward:Hp;
};
export function useGatheringController(a:Args){
 const region=GATHER_REGIONS[a.gatherRegion],scale=region.scale;
 const isGatherRegionUnlocked=(key:GatherRegionKey)=>a.devMode||GATHER_REGIONS[key].unlockStage===0||a.clearedStages.includes(GATHER_REGIONS[key].unlockStage);
 const getGatherEfficiency=(heroId?:string)=>{if(!heroId)return 1;const grade=a.getHeroGrade(heroId).name;return calculateGatherEfficiency(a.getUnitLevel(heroId),GATHER_GRADE_BONUS[grade]??1)};
 const getAutoGatherAmount=(type:ResourceType)=>{const id=a.workers[type];if(!id)return 0;const level=type==="wood"?a.facilityLevels.lumber:a.facilityLevels.quarry;return calculateAutoGatherAmount(level,a.kingdomProductionBonus,getGatherEfficiency(id))};
 const getGatherAttackDamage=(type:ResourceType)=>{const id=a.workers[type],hero=id?a.heroes.find(h=>h.id===id):undefined;return calculateGatherAttackDamage(type,hero?.atk,hero?a.getLevelMultiplier(hero.id):1)};
 const gatherResource=(type:ResourceType)=>{a.setGatherHit(type);window.setTimeout(()=>a.setGatherHit(v=>v===type?null:v),140);a.setGatherHp(current=>{const damage=getGatherAttackDamage(type),max=a.gatherMaxHp[type]*scale,hp=Math.min(current[type],max),next=Math.max(0,hp-damage);if(next>0)return {...current,[type]:next};a.setResources(stored=>{const resources={...stored,[type]:stored[type]+a.gatherReward[type]*scale};saveJson(STORAGE_KEYS.resources,resources);return resources});return {...current,[type]:max}})};
 const sellResource=(type:ResourceType)=>{const amount=a.resources[type];if(amount<=0)return;const price=getResourceSellPrice(type,a.kingdomSellBonus),resources={...a.resources,[type]:0};a.setResources(resources);saveJson(STORAGE_KEYS.resources,resources);a.setKingdomGold(gold=>{const next=gold+Math.round(amount*price);saveNumber(STORAGE_KEYS.kingdomGold,next);return next})};
 const assignWorker=(type:ResourceType,heroId:string)=>{const next={...a.workers};for(const key of ["wood","stone"] as const)if(next[key]===heroId)delete next[key];if(a.workers[type]===heroId)delete next[type];else next[type]=heroId;a.setWorkers(next);saveJson(STORAGE_KEYS.workers,next);const now=Date.now();a.gatherLastSeenRef.current=now;saveNumber(STORAGE_KEYS.gatherLastSeen,now)};
 return {gatherRegions:GATHER_REGIONS,activeGatherRegion:region,gatherRegionScale:scale,isGatherRegionUnlocked,getGatherEfficiency,getAutoGatherAmount,getGatherAttackDamage,gatherResource,sellResource,assignWorker};
}
