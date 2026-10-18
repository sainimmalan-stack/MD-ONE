import { NextRequest, NextResponse } from 'next/server';
type RPC=(name:string,body?:unknown)=>Promise<any>;
const supported=/^(community|profiles|my-profile|friends|blocks|social-posts|social-reports|rides|exchange|homes|my-project|community-media)(\/|$)/;
/** Authenticated BFF adapter for the original premium screens. Authorization lives in SQL. */
export async function hostedCommunity(req:NextRequest,route:string,rpc:RPC):Promise<NextResponse|null>{
 if(!supported.test(route))return null;
 const headers={'Cache-Control':'private, no-store'};
 if(route.startsWith('community-media/')&&req.method==='GET'){
  const id=route.split('/')[1];if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:'Photo unavailable'},{status:404,headers});
  try{const media=await rpc('community_media_get',{p_id:id});return new NextResponse(Buffer.from(media.content,'base64'),{headers:{...headers,'Content-Type':media.mime,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});}catch{return NextResponse.json({error:'Photo unavailable'},{status:404,headers});}
 }
 let body:any={};
 if(req.method!=='GET'){
  const raw=await req.text();if(Buffer.byteLength(raw)>4400000)return NextResponse.json({error:'Photos exceed upload limit.'},{status:413,headers});
  try{body=JSON.parse(raw);}catch{return NextResponse.json({error:'Invalid request.'},{status:400,headers});}
  if(!body||typeof body!=='object'||Array.isArray(body))return NextResponse.json({error:'Invalid request.'},{status:400,headers});
  const photo=async(value:unknown):Promise<string>=>{
   if(value==null||value==='')return '';
   if(typeof value!=='string')throw Object.assign(new Error('Invalid photo.'),{status:422});
   const existing=/^\/api\/community-media\/([0-9a-f-]{36})$/i.exec(value);if(existing)return existing[1];
   const match=/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(value);
   if(!match||match[2].length>533336)throw Object.assign(new Error('Use a JPEG or PNG photo under 400 KB.'),{status:422});
   return rpc('community_media_add',{p_mime:match[1],p_content:match[2]});
  };
  if(route==='my-profile')body.avatar=await photo(body.avatar);
  if(route==='social-posts')body.image=await photo(body.image);
  if((route==='homes'||/^exchange(?:\/[0-9a-f-]{36})?$/i.test(route))&&body.photos){
   if(!Array.isArray(body.photos)||body.photos.length>(route==='homes'?8:5))throw Object.assign(new Error('Too many photos.'),{status:422});
   body.photos=await Promise.all(body.photos.map(photo));
  }
 }
 try{
  const query=Object.fromEntries(req.nextUrl.searchParams.entries());
  const result=await rpc('community_api',{p_route:route,p_method:req.method,p_body:body,p_query:query});
  return NextResponse.json(result,{headers});
 }catch(e:any){if(e.status===400)throw Object.assign(new Error(e.message),{status:422});throw e;}
}
