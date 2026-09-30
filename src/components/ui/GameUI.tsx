import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export function GamePanel({ className="", children, ...props }: HTMLAttributes<HTMLElement> & { children:ReactNode }) {
  return <section className={`ui-panel ${className}`} {...props}>{children}</section>;
}

export function GameCard({ className="", children, selected=false, ...props }: HTMLAttributes<HTMLDivElement> & { children:ReactNode; selected?:boolean }) {
  return <div className={`ui-card ${selected?"is-selected":""} ${className}`} {...props}>{children}</div>;
}

export function GameButton({ className="", tone="default", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?:"default"|"primary"|"ghost"|"danger" }) {
  return <button className={`ui-button ui-button--${tone} ${className}`} {...props}/>;
}

export function IconButton({ className="", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`ui-icon-button ${className}`} {...props}/>;
}

export function SectionTitle({ eyebrow, children, action }: { eyebrow?:string; children:ReactNode; action?:ReactNode }) {
  return <div className="ui-section-title"><div>{eyebrow&&<small>{eyebrow}</small>}<h2>{children}</h2></div>{action&&<div>{action}</div>}</div>;
}

export function Badge({ children, tone="default" }: { children:ReactNode; tone?:"default"|"gold"|"muted"|"success" }) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}

export function ProgressBar({ value, max=100, label }: { value:number; max?:number; label?:string }) {
  const pct=Math.max(0,Math.min(100,(value/max)*100));
  return <div className="ui-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><span style={{width:`${pct}%`}}/></div>;
}

export function ResourceDisplay({ icon, label, value, className="" }: { icon:ReactNode; label:string; value:string|number; className?:string }) {
  return <div className={`ui-resource ${className}`}><span className="ui-resource-icon">{icon}</span><span className="ui-resource-label">{label}</span><b>{typeof value==="number"?value.toLocaleString():value}</b></div>;
}
