"use client";
import { useEffect, useState, type FormEvent } from 'react';
import { BrandLockup } from './brand-lockup';
import { ThemeToggle } from './theme-toggle';
import './hosted-access.css';
async function request(path:string, body?:unknown) {
 const response=await fetch('/api/auth/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Please try again.');return data;
}
export function HostedAccess() {
 const [session,setSession]=useState<any>(null),[ready,setReady]=useState(false),[email,setEmail]=useState(''),[token,setToken]=useState(''),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[projectId,setProject]=useState(''),[flat,setFlat]=useState(''),[kind,setKind]=useState('owner');
 const load=async()=>{const data=await request('session');setSession(data);setProject(data.projects[0]?.id||'');};
 useEffect(()=>{load().catch(()=>{}).finally(()=>setReady(true));},[]);
 const act=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn();}catch(e:any){setError(e.message);}finally{setBusy(false);}};
 return <div className="hosted-shell"><header><a href="/" aria-label="MD One home"><BrandLockup/></a><ThemeToggle/></header><main>
  {!ready?<p role="status">Opening your home…</p>:!session?<section className="hosted-auth-card">
   <span className="hosted-eyebrow">EXCLUSIVELY FOR MY DREAM PROJECTS</span><h1>Your people.<br/>Your everyday.</h1><p>Sign in with your email. Access to your project is verified separately.</p>
   <form onSubmit={(e:FormEvent)=>{e.preventDefault();void act(async()=>{await request('otp',{email});setSent(true);});}}>
    <label>Email address<input type="email" autoComplete="email" value={email} disabled={sent||busy} onChange={e=>setEmail(e.target.value)} required/></label>
    {sent&&<><p role="status">Check your email and open the sign-in link in this browser.</p></>}
    <button className="hosted-primary" disabled={busy}>{busy?'Please wait…':sent?'Resend sign-in link':'Send sign-in link'}</button>
    {sent&&<button type="button" className="hosted-link" onClick={()=>{setSent(false);setToken('');}}>Use another email</button>}
   </form><small>Your sign-in link is personal. Open it on this device and never forward it.</small>
  </section>:<section className="hosted-member-card"><span className="hosted-eyebrow">WELCOME TO MD ONE</span><h1>A place in your community.</h1><p>Signed in as {session.user.email}</p>
   {session.memberships.some((m:any)=>m.status==='approved')?<div className="hosted-notice"><h2>Residence verified</h2><p>Your account is connected. The remaining resident modules are still being migrated to the hosted backend.</p></div>:<><p>Tell us where you live. Your project committee will verify your residence before community access is enabled.</p>
   <form onSubmit={e=>{e.preventDefault();void act(async()=>{await request('residence',{projectId,flat,kind});await load();});}}>
    <label>Your project<select value={projectId} onChange={e=>setProject(e.target.value)} required>{session.projects.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <div className="hosted-fields"><label>Flat number<input inputMode="numeric" pattern="[0-9]{2,5}" placeholder="101" value={flat} onChange={e=>setFlat(e.target.value)} required/></label><label>I am a<select value={kind} onChange={e=>setKind(e.target.value)}><option value="owner">Flat owner</option><option value="tenant">Tenant</option><option value="household">Household member</option></select></label></div>
    <button className="hosted-primary" disabled={busy}>{busy?'Saving…':'Request residence verification'}</button>
   </form></>}
   {!!session.requests.length&&<div className="hosted-requests"><h2>Your residence requests</h2>{session.requests.map((r:any)=><div key={r.id}><span>{session.projects.find((p:any)=>p.id===r.project_id)?.name} · {r.flat_label}</span><strong>{r.status}</strong></div>)}</div>}
   <button className="hosted-link" disabled={busy} onClick={()=>void act(async()=>{await request('logout',{});setSession(null);setToken('');setSent(false);})}>Sign out</button>
  </section>}{error&&<div className="hosted-error" role="alert">{error}</div>}
 </main><footer>One app. Everyday living.</footer></div>;
}
