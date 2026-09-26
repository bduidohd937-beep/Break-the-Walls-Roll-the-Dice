import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { STORAGE_KEYS, loadNumber, saveNumber } from "../storage";
type ResourceType="wood"|"stone"; type Resources=Record<ResourceType,number>; type Workers=Partial<Record<ResourceType,string>>;
type Offline={wood:number;stone:number;seconds:number}|null;
type Args={active:boolean;workers:Workers;setResources:Dispatch<SetStateAction<Resources>>;setOfflineGather:Dispatch<SetStateAction<Offline>>;lastSeenRef:MutableRefObject<number>;getAutoAmount:(type:ResourceType)=>number;dependencies:unknown[]};
export function useGatheringProduction(a:Args){
 useEffect(()=>{
  if(!a.active)return;
  const now=Date.now(),saved=Math.max(0,loadNumber(STORAGE_KEYS.gatherLastSeen,now));
  const seconds=Math.min(8*60*60,Math.max(0,Math.floor((now-saved)/1000))),ticks=Math.floor(seconds/3);
  if(ticks>0&&(a.workers.wood||a.workers.stone)){
   const wood=a.workers.wood?ticks*a.getAutoAmount("wood"):0,stone=a.workers.stone?ticks*a.getAutoAmount("stone"):0;
   if(wood||stone){a.setResources(current=>({wood:current.wood+wood,stone:current.stone+stone}));a.setOfflineGather({wood,stone,seconds})}
  }
  a.lastSeenRef.current=now;saveNumber(STORAGE_KEYS.gatherLastSeen,now);
  const timer=window.setInterval(()=>{const tick=Date.now();a.lastSeenRef.current=tick;saveNumber(STORAGE_KEYS.gatherLastSeen,tick);a.setResources(current=>({wood:current.wood+(a.workers.wood?a.getAutoAmount("wood"):0),stone:current.stone+(a.workers.stone?a.getAutoAmount("stone"):0)}))},3000);
  return()=>{window.clearInterval(timer);saveNumber(STORAGE_KEYS.gatherLastSeen,Date.now())};
 // dependencies are intentionally supplied by App so production restarts when its inputs change.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[a.active,a.workers,...a.dependencies]);
}
