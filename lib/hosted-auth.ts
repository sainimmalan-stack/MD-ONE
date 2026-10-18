import { randomBytes, createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

const accessCookie = 'md_one_access';
const refreshCookie = 'md_one_refresh';
export const hostedEnabled = () => process.env.MDP_MODE === 'production';
function config() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Hosted authentication configuration is incomplete.');
  if (!url.startsWith('https://')) throw new Error('Supabase requires HTTPS.');
  return {url:url.replace(/\/$/,''),key};
}
async function call(path:string, options:RequestInit={}, token?:string) {
  const {url,key}=config();
  const response=await fetch(`${url}${path}`,{...options,cache:'no-store',headers:{apikey:key,...(token?{Authorization:`Bearer ${token}`}:{ }),'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)});
  const body=await response.json().catch(()=>({}));
  if(!response.ok) throw Object.assign(new Error(body.msg||body.message||body.error_description||'Request could not be completed.'),{status:response.status});
  return body;
}
function sameOrigin(req:NextRequest) {
  const origin=req.headers.get('origin');
  if(!origin || origin!==`${req.nextUrl.protocol}//${req.headers.get('host')}`) throw Object.assign(new Error('Cross-origin requests are disabled.'),{status:403});
}
function json(value:unknown,status=200) { return NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}}); }
function setSession(response:NextResponse, session:any) {
  response.cookies.set(accessCookie,session.access_token,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:Math.min(session.expires_in||3600,3600)});
  response.cookies.set(refreshCookie,session.refresh_token,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:30*86400});
}
export async function hostedAuth(req:NextRequest, path:string[]) {
  try {
    const route=path.join('/');
    if(req.method!=='GET') sameOrigin(req);
    if(route==='auth/callback' && req.method==='GET') {
      const code=req.nextUrl.searchParams.get('code');
      const verifier=req.cookies.get('md_one_verifier')?.value;
      if(!code || code.length>2048 || !verifier) return NextResponse.redirect(new URL('/?auth_error=expired',req.url));
      const session=await call('/auth/v1/token?grant_type=pkce',{method:'POST',body:JSON.stringify({auth_code:code,code_verifier:verifier})});
      const response=NextResponse.redirect(new URL('/',req.url));setSession(response,session);response.cookies.delete('md_one_verifier');return response;
    }
    if(route==='auth/otp' && req.method==='POST') {
      const b=await req.json();
      if(typeof b.email!=='string'||b.email.length>254||!/^\S+@\S+\.\S+$/.test(b.email)) return json({error:'Enter a valid email address.'},400);
      const verifier=randomBytes(32).toString('base64url');
      const challenge=createHash('sha256').update(verifier).digest('base64url');
      await call('/auth/v1/otp?redirect_to='+encodeURIComponent('https://emd1.vercel.app/api/auth/callback'),{method:'POST',body:JSON.stringify({email:b.email.trim().toLowerCase(),create_user:true,code_challenge:challenge,code_challenge_method:'s256'})});
      const response=json({ok:true});response.cookies.set('md_one_verifier',verifier,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:600});return response;
    }
    if(route==='auth/verify' && req.method==='POST') {
      const b=await req.json();
      if(typeof b.email!=='string'||b.email.length>254||typeof b.token!=='string'||!/^\d{6,10}$/.test(b.token)) return json({error:'Enter the code from your email.'},400);
      const session=await call('/auth/v1/verify',{method:'POST',body:JSON.stringify({email:b.email.trim().toLowerCase(),token:b.token,type:'email'})});
      const response=json({ok:true});setSession(response,session);return response;
    }
    let token=req.cookies.get(accessCookie)?.value;
    let refreshed:any;
    let user:any;
    if(token) {try {user=await call('/auth/v1/user',{},token);}catch(e:any){if(e.status!==401&&e.status!==403)throw e;token=undefined;}}
    if(!user) {
      const refresh=req.cookies.get(refreshCookie)?.value;
      if(!refresh) return json({error:'Sign in to MD One.'},401);
      refreshed=await call('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:refresh})});
      token=refreshed.access_token;
      user=await call('/auth/v1/user',{},token);
    }
    const respond=(value:unknown,status=200)=>{const response=json(value,status);if(refreshed)setSession(response,refreshed);return response;};
    if(route==='auth/logout'&&req.method==='POST') {
      await call('/auth/v1/logout',{method:'POST'},token);
      const response=json({ok:true});response.cookies.delete(accessCookie);response.cookies.delete(refreshCookie);return response;
    }
    if(route==='auth/session'&&req.method==='GET') {
      const [projects,requests,memberships]=await Promise.all([
        call('/rest/v1/projects?select=id,name,status&order=name',{},token),
        call('/rest/v1/residence_requests?select=id,project_id,flat_label,kind,status,created_at&order=created_at.desc',{},token),
        call('/rest/v1/memberships?select=id,status,kind,flat_id',{},token)
      ]);
      return respond({user:{id:user.id,email:user.email},projects,requests,memberships});
    }
    if(route==='auth/residence'&&req.method==='POST') {
      const b=await req.json();
      if(!/^[0-9a-f-]{36}$/i.test(b.projectId||'')||!/^\d{2,5}$/.test(b.flat||'')||!['owner','tenant','household'].includes(b.kind))return respond({error:'Choose your project, numeric flat number and residence type.'},400);
      await call('/rest/v1/residence_requests',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({user_id:user.id,project_id:b.projectId,flat_label:b.flat,kind:b.kind,status:'pending'})},token);
      return respond({ok:true});
    }
    return respond({error:'This module is awaiting its hosted data migration.'},503);
  } catch(e:any) {return json({error:e.status&&e.status<500?e.message:'Hosted service could not complete this request.'},e.status>=400&&e.status<500?e.status:503);}
}
