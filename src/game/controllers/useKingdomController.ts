import type { Dispatch, SetStateAction } from "react";
import { FACILITY_DEFS, KINGDOM_UNLOCKS, type FacilityKey } from "../systems/kingdom";
import { STORAGE_KEYS, saveJson, saveNumber } from "../storage";

type FacilityLevels=Record<FacilityKey,number>;
type Args={kingdomLevel:number;setKingdomLevel:Dispatch<SetStateAction<number>>;kingdomGold:number;setKingdomGold:Dispatch<SetStateAction<number>>;facilityLevels:FacilityLevels;setFacilityLevels:Dispatch<SetStateAction<FacilityLevels>>};

export function useKingdomController(a:Args){
 const kingdomUpgradeCost=400*a.kingdomLevel;
 const kingdomProductionBonus=1+Math.floor((a.kingdomLevel-1)/2)*0.25;
 const kingdomSellBonus=1+Math.floor((a.kingdomLevel-1)/3)*0.1;
 const nextKingdomUnlock=KINGDOM_UNLOCKS.find(e=>e.level>a.kingdomLevel);
 const kingdomMilestone=nextKingdomUnlock?`Lv.${nextKingdomUnlock.level} · ${nextKingdomUnlock.title}`:"현재 준비된 왕국 해금 완료";
 const facilityUpgradeCost=(type:FacilityKey)=>FACILITY_DEFS[type].baseCost*a.facilityLevels[type];
 const upgradeKingdom=()=>{if(a.kingdomGold<kingdomUpgradeCost)return;const level=a.kingdomLevel+1,gold=a.kingdomGold-kingdomUpgradeCost;a.setKingdomLevel(level);a.setKingdomGold(gold);saveNumber(STORAGE_KEYS.kingdomLevel,level);saveNumber(STORAGE_KEYS.kingdomGold,gold)};
 const upgradeFacility=(type:FacilityKey)=>{const cost=facilityUpgradeCost(type);if(a.kingdomGold<cost)return;const next={...a.facilityLevels,[type]:a.facilityLevels[type]+1};const gold=a.kingdomGold-cost;a.setFacilityLevels(next);a.setKingdomGold(gold);saveJson(STORAGE_KEYS.facilityLevels,next);saveNumber(STORAGE_KEYS.kingdomGold,gold)};
 return {kingdomUpgradeCost,kingdomProductionBonus,kingdomSellBonus,kingdomUnlocks:KINGDOM_UNLOCKS,nextKingdomUnlock,kingdomMilestone,facilityDefs:FACILITY_DEFS,facilityUpgradeCost,upgradeKingdom,upgradeFacility};
}
