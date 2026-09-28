import type { HubTab } from "../../game/controllers/useHubNavigation";

const destinations = [
  { id:"heroes", label:"영웅", icon:"♜" },
  { id:"summon", label:"소환", icon:"✦" },
  { id:"battle", label:"출전", icon:"⚔" },
  { id:"shop", label:"상점", icon:"▣" },
  { id:"storage", label:"보관함", icon:"▤" },
] as const;

export function KingdomNav({ tab, disabled, onNavigate }: { tab:HubTab; disabled:boolean; onNavigate:(tab:HubTab)=>void }) {
  return <nav className="kingdom-bottom-nav" aria-label="왕국 하단 메뉴">{destinations.map(item=><button key={item.id} type="button" className={`kingdom-menu-button ${item.id === "battle" ? "primary" : ""} ${tab === item.id || (item.id === "summon" && tab === "fusion") ? "active" : ""}`} disabled={disabled} onClick={()=>onNavigate(item.id)}><i className={`kingdom-menu-icon icon-${item.id}`} aria-hidden="true">{item.icon}</i><span>{item.label}</span></button>)}</nav>;
}
