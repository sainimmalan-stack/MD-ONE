"use client";
import {ArrowRight, ShoppingBasket, Wrench, LayoutDashboard, Package, Building2, CarFront, Users, CalendarDays, FolderLock, Wallet} from "lucide-react";
const shortcuts = [
 ["services","Home services",Wrench], ["myproject","Maintenance",LayoutDashboard], ["exchange","Buy & sell",Package],
 ["homes","Rent / Sale",Building2], ["carpool","Carpool",CarFront], ["circle","Neighbours",Users],
 ["community","Events",CalendarDays], ["myhome","Documents",FolderLock], ["finance","Expenses & EMI",Wallet],
] as const;
export function LivingHome({name,go,orders=[],onBasket,count=0}:{name?:string;go:(destination:string)=>void;orders?:Record<string,any>[];onBasket:()=>void;count?:number}){
 const current=orders.find(o=>!["delivered","cancelled","rejected"].includes(o.status));
 return <section className="living-home">
  <header className="living-welcome"><div><p>YOUR EVERYDAY, CONNECTED</p><h1>Hello{name?`, ${name.split(" ")[0]}`:""}.</h1></div><button className="living-basket" onClick={onBasket} aria-label={`Open basket, ${count} items`}><ShoppingBasket size={20}/>{count>0&&<span>{count}</span>}</button></header>
  <section className="living-groceries"><div className="living-grocery-copy"><span>MD ONE DAILY</span><h2>Good things.<br/>Delivered home.</h2><p>Groceries & everyday essentials.</p><button onClick={()=>go("daily")}>Shop groceries <ArrowRight size={17}/></button></div><img src="/grocery/everyday-table.png" alt="" onError={e=>{e.currentTarget.style.display="none";}}/></section>
  <section className="living-shortcuts"><h2>What do you need?</h2><div className="living-grid">{shortcuts.map(([key,label,Icon])=><button key={key} onClick={()=>go(key)}><span><Icon size={24} strokeWidth={1.6}/></span><strong>{label}</strong></button>)}</div></section>
  {current&&<button className="living-order" onClick={()=>go("orders")}><span className="living-order-icon"><Package size={22}/></span><span><strong>Your grocery order</strong><small>{String(current.status).replaceAll("_"," ")}</small></span><ArrowRight size={18}/></button>}
  <section className="living-footer-links"><button onClick={()=>go("myproject")}><LayoutDashboard size={19}/><span>Your project<small>Bills, notices & committee</small></span><ArrowRight size={16}/></button><button onClick={()=>go("community")}><CalendarDays size={19}/><span>Community events<small>See what’s coming up</small></span><ArrowRight size={16}/></button></section>
 </section>;
}
