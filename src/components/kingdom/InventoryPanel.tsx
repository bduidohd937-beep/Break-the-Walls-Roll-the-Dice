import { useState } from "react";
import type { ReactNode } from "react";

const filters = ["전체", "장비", "재료", "조각"] as const;
export function InventoryPanel({ summonStorage, shards }: { summonStorage:ReactNode; shards:number }) {
  const [filter,setFilter]=useState<typeof filters[number]>("전체");
  return <section className="kingdom-inventory"><h2>보관함</h2><div className="inventory-filters">{filters.map(value=><button key={value} type="button" className={filter===value?"active":""} onClick={()=>setFilter(value)}>{value}</button>)}</div>{filter==="전체"?<><p>소환 결과를 영입하거나 영혼·파편으로 변환할 수 있습니다.</p>{summonStorage}</>:filter==="조각"?<div className="inventory-slot"><b>영혼 파편</b><span>{shards.toLocaleString()}개</span></div>:<div className="inventory-slot"><b>{filter}</b><span>등록된 아이템이 없습니다 · 준비 중</span></div>}</section>;
}
