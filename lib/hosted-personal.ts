import {NextRequest,NextResponse} from 'next/server';
import {personalFile} from './personal-file';
import {amortize} from './finance';
export async function hostedPersonal(req:NextRequest,route:string,rpc:(name:string,body?:unknown)=>Promise<any>):Promise<NextResponse|null>{
 if(!/^personal(?:\/|$)/.test(route))return null;
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
 try{
  if(route==='personal'&&req.method==='GET')return NextResponse.json(await rpc('personal_api',{p_action:'context'}),{headers});
  const match=/^personal\/documents\/([0-9a-f-]{36})$/i.exec(route);
  if(match&&req.method==='GET'){
   const d=await rpc('personal_api',{p_action:'download',p_body:{id:match[1]}});
   const name=String(d.name).replace(/[^a-zA-Z0-9._-]/g,'_').replace(/\.[^.]*$/,'')+(d.mime==='application/pdf'?'.pdf':'.jpg');
   return new NextResponse(Buffer.from(d.data,'base64'),{headers:{...headers,'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${name}"`,'Content-Security-Policy':"sandbox; default-src 'none'"}});
  }
  if(req.method!=='POST')return NextResponse.json({error:'Method not allowed'},{status:405,headers});
  const raw=await req.text();if(Buffer.byteLength(raw)>2800000)return NextResponse.json({error:'Choose a file below 2 MB.'},{status:413,headers});
  const b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b))throw new Error('Invalid details.');
  if(route==='personal/emi')return NextResponse.json(amortize(b.principal,b.rate,b.months,b.prepayment),{headers});
  const action=route.slice(9);
  if(action==='document')Object.assign(b,await personalFile(b.data,b.mime));
  return NextResponse.json(await rpc('personal_api',{p_action:action,p_body:b}),{headers});
 }catch(e:any){return NextResponse.json({error:e.status>=500?'My Home is temporarily unavailable. Please retry.':e.message||'Check your details.'},{status:e.status===401?401:e.status===403?403:422,headers});}
}
