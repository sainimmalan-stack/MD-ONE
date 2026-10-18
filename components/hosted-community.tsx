"use client";
import {useCallback,useEffect,useState} from 'react';
import {ArrowLeft,ArrowRight,RefreshCw,ShieldCheck,UserRound} from 'lucide-react';
import {SocialCircle,ResidentProfile} from './experience';
import {Carpool} from './carpool';
import {Exchange} from './community-management';
async function api(path:string,method='GET',body?:unknown){const r=await fetch('/api/'+path,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to complete this request.');return d;}
export function HostedCommunity({tab,onNavigate,onAccount}:{tab:string;onNavigate:(tab:string)=>void;onAccount:()=>void}){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[profile,setProfile]=useState<string>();
 const load=useCallback(async()=>{const d=await api('community');setData({...d,hosted:true});},[]);
 useEffect(()=>{setProfile(undefined);setError('');void load().catch(e=>setError(e.message));},[tab,load]);
 useEffect(()=>{const timer=setInterval(()=>void load().catch(e=>setError(e.message)),30000);return()=>clearInterval(timer);},[load]);
 const act=async(work:()=>Promise<any>,message="Updated")=>{setBusy(true);setError('');setNotice('');try{const result=await work();await load();setNotice(message);return result||{ok:true};}catch(e:any){setError(e.message);return null;}finally{setBusy(false);}};
 const go=(target:string)=>{if(['exchange','homes','events','carpool','community','circle'].includes(target)){setProfile(undefined);onNavigate(target==='circle'?'community':target);}else if(target==='profile')setProfile(data.user.id);else onAccount();};
 return <section className="md-hosted-community">
 <nav className="section-navigation" aria-label="Community sections">{[['community','Neighbours'],['exchange','Buy & sell'],['carpool','Carpool'],['events','Events']].map(([id,label])=><button key={id} aria-current={tab===id?'page':undefined} onClick={()=>onNavigate(id)}>{label}</button>)}<button className="md-live-refresh" disabled={busy} onClick={()=>void act(load,'Updated')} aria-label="Refresh community"><RefreshCw size={16}/></button></nav>
 {error&&<p className="md-store-message" role="alert">{error}<button onClick={()=>void act(load,'Updated')}>Try again</button></p>}{notice&&<p className="md-store-message" role="status">{notice}</p>}
 {!data?<div className="md-store-empty" role="status">Opening your community…</div>:<>
 {!data.eligible&&(data.owner?<details className="md-owner-notice"><summary><ShieldCheck size={16}/><strong>Platform owner</strong><span>About resident access</span></summary><p>Your administration access is ready. Resident posting, ride connections and item listings require a verified real residence. Homes require verified ownership.</p><button className="text-link" onClick={onAccount}>Account & residence <ArrowRight size={15}/></button></details>:<div className="md-store-message"><ShieldCheck size={20}/><div><strong>Your private community</strong><p>Verify your residence to meet neighbours, share journeys and use the private marketplace.</p></div><button onClick={onAccount}>My residence <ArrowRight size={15}/></button></div>)}
 {tab==='community'&&!profile&&<div className="md-community-tools"><button className="exp-text-button" onClick={()=>setProfile(data.user.id)}><UserRound size={16}/>My profile & privacy <ArrowRight size={14}/></button></div>}
 {profile?<><button className="text-link" onClick={()=>setProfile(undefined)}><ArrowLeft size={16}/>Back to {tab==='community'?'community':tab==='exchange'?'marketplace':'carpool'}</button><ResidentProfile data={data} uid={profile} busy={busy} act={act} openProfile={setProfile} go={go}/></>:tab==='community'?<SocialCircle data={data} busy={busy} act={act} openProfile={setProfile} go={go}/>:tab==='carpool'?<Carpool data={data} busy={busy} act={act} api={api}/>:tab==='events'?<section className="living-feature-heading"><h1>Community events</h1><p>Plan something with your neighbours. Share upcoming celebrations and activities through community posts.</p><button className="button" onClick={()=>onNavigate('community')}>Open community <ArrowRight size={16}/></button></section>:<Exchange key={tab} initialSection={tab==='homes'?'homes':'items'} data={data} openProfile={setProfile}/>}
 </>}
 </section>;
}
