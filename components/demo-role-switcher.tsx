"use client";
import {useEffect,useRef,useState} from "react";
import {ArrowRight,Check,ChevronDown,Users,X} from "lucide-react";
type DemoPerson={id:string;name:string;membership?:string;committee?:string;staff?:string;status?:string;scope:string};
const groups:{title:string;description:string;people:DemoPerson[]}[]=[
 {title:"Residents & project committee",description:"Owner or tenant is a membership. Committee responsibility is assigned separately for one project.",people:[
  {id:"resident",name:"Ananya",membership:"Tenant",committee:"Vice President",scope:"My Dream Nest · 101"},
  {id:"neighbor",name:"Kiran",membership:"Owner",committee:"President",scope:"My Dream Nest · 102"},
  {id:"owner",name:"Non-resident owner",membership:"Owner",scope:"Owned flats & tenant membership"},
  {id:"pending",name:"New resident",membership:"Tenant",status:"Pending verification",scope:"Restricted until residence is approved"},
  {id:"sky-resident",name:"Rhea",membership:"Tenant",scope:"My Dream Skylark · 101"},
  {id:"sky-neighbor",name:"Aditya",membership:"Tenant",scope:"My Dream Skylark · 102"},
  {id:"sky-family",name:"Neha",membership:"Tenant",scope:"My Dream Skylark · 103"},
 ]},
 {title:"Project support",description:"Residence verification, complaints and moderation within the assigned project. Separate from President / Vice President accounting access.",people:[{id:"admin",name:"Project support desk",staff:"Project support",scope:"My Dream Nest · Verification & moderation"}]},
 {title:"Grocery team",description:"Warehouse fulfilment and assigned deliveries.",people:[
  {id:"warehouse",name:"Warehouse team",staff:"Warehouse",scope:"Stock · Pick · Pack · Dispatch"},
  {id:"rider1",name:"Arjun",staff:"Delivery partner",scope:"Own assigned deliveries"},
  {id:"rider2",name:"Meera",staff:"Delivery partner",scope:"Own assigned deliveries"},
 ]},
 {title:"Home services team",description:"The service desk assigns specialists. Technicians update their own assigned jobs.",people:[
  {id:"service",name:"MDP Service Desk",staff:"Service coordinator",scope:"Requests & specialist assignment"},
  {id:"tech1",name:"Ravi",staff:"Technician · Plumbing",scope:"Assigned plumbing jobs"},
  {id:"tech2",name:"Imran",staff:"Technician · Electrical",scope:"Assigned electrical jobs"},
  {id:"tech3",name:"Suresh",staff:"Technician · Tiles",scope:"Assigned tiles jobs"},
 ]},
 {title:"MDP administration",description:"Platform setup and committee appointments. Personal vaults and project accounting access remain separate.",people:[{id:"platform",name:"Platform operations",staff:"Platform administrator",scope:"MD One operations & appointments"}]},
];
export function DemoRoleSwitcher({actor,busy,onChange}:{actor:string;busy:boolean;onChange:(id:string)=>Promise<void>}){
 const [open,setOpen]=useState(false);const dialog=useRef<HTMLDialogElement>(null);
 const person=groups.flatMap(g=>g.people).find(p=>p.id===actor);
 useEffect(()=>{const el=dialog.current;if(open&&!el?.open)el?.showModal();if(!open&&el?.open)el.close();},[open]);
 return <div className="demo-role-control">
  <span className="demo-role-label">DEMO VIEW</span>
  <button className="demo-role-trigger" disabled={busy} aria-haspopup="dialog" onClick={()=>setOpen(true)}><Users size={15}/><span>{person?.name||"Choose a demo user"}</span><ChevronDown size={14}/></button>
  <dialog ref={dialog} className="demo-role-dialog" aria-labelledby="demo-role-title" onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)}>
   <header><div><p>EXPLORE MD ONE</p><h2 id="demo-role-title">Choose a demo user</h2></div><button aria-label="Close demo users" onClick={()=>setOpen(false)}><X size={21}/></button></header>
   <p className="demo-role-note">Sample identities for reviewing the app. Switching here never changes your real account or permissions.</p>
   {groups.map(group=><section key={group.title}><h3>{group.title}</h3><p>{group.description}</p><div className="demo-role-people">{group.people.map(p=><button key={p.id} disabled={busy} aria-pressed={actor===p.id} onClick={()=>{setOpen(false);void onChange(p.id);}}><div><strong>{p.name}</strong><dl>{"membership" in p&&<div><dt>Membership</dt><dd>{p.membership}</dd></div>}{"committee" in p&&<div><dt>Committee</dt><dd>{p.committee}</dd></div>}{"staff" in p&&<div><dt>Staff role</dt><dd>{p.staff}</dd></div>}{p.status&&<div><dt>Status</dt><dd>{p.status}</dd></div>}</dl><small>{p.scope}</small></div>{actor===p.id?<Check size={19}/>:<ArrowRight size={17}/>}</button>)}</div></section>)}
  </dialog>
 </div>;
}

export function DemoIdentitySummary({actor}:{actor:string}){
 const person=groups.flatMap(g=>g.people).find(p=>p.id===actor);if(!person)return null;
 return <section className="demo-identity-summary" aria-label="Your demo access"><h2>Your demo access</h2><dl>{"membership" in person&&<div><dt>Membership</dt><dd>{person.membership}</dd></div>}{"committee" in person&&<div><dt>Project committee</dt><dd>{person.committee}</dd></div>}{"staff" in person&&<div><dt>Staff role</dt><dd>{person.staff}</dd></div>}{person.status&&<div><dt>Status</dt><dd>{person.status}</dd></div>}<div><dt>Scope</dt><dd>{person.scope}</dd></div></dl><p>{actor==='admin'?"Project support handles verification, complaints and moderation. President / Vice President appointments control project accounting separately.":"Demo identity only. Personal documents, expenses and loans stay private to their account."}</p></section>;
}
