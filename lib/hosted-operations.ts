import {NextRequest,NextResponse} from 'next/server';
import sharp from 'sharp';
import {projectImage} from './project-image';
type RPC=(name:string,body?:unknown)=>Promise<any>;
export async function hostedOperations(req:NextRequest,route:string,rpc:RPC):Promise<NextResponse|null>{
 if(!/^(operations-context|my-project|appointments|appointment-options|insta-services|service-ops|service-setup)(\/|$)/.test(route))return null;
 const headers={'Cache-Control':'private, no-store'};
 try{
  if(route==='operations-context'&&req.method==='GET')return NextResponse.json(await rpc('operations_context'),{headers});
  const query=Object.fromEntries(req.nextUrl.searchParams.entries());
  let body:any={};if(req.method!=='GET'){const raw=await req.text();if(Buffer.byteLength(raw)>2800000)return NextResponse.json({error:'Keep attachments below 2 MB.'},{status:413,headers});body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('Invalid request.');}
  const attachment=/^my-project\/([0-9a-f-]{36})\/attachments(?:\/([0-9a-f-]{36}))?$/i.exec(route);
  if(attachment){
   if(req.method==='POST'&&!attachment[2]&&['image/jpeg','image/png'].includes(body.mime)){
    if(typeof body.data!=='string'||body.data.length>2666668||!/^[A-Za-z0-9+/=]+$/.test(body.data))throw new Error('Use a JPEG/PNG below 2 MB.');
    const input=Buffer.from(body.data,'base64');if(input.length>2000000)throw new Error('Keep attachments below 2 MB.');
    const image=await projectImage(input,body.mime);
    return NextResponse.json(await rpc('project_image_attachment',{p_project:attachment[1],p_name:body.name,p_width:image.width,p_height:image.height,p_pixels:image.pixels,p_redacted:body.redacted===true}),{headers});
   }
   if(req.method==='GET'&&attachment[2]){
    // Authorization checks both the project route and the actual attachment owner/scope.
    const meta=await rpc('project_api',{p_route:route,p_method:'GET'});
    const image=await rpc('project_image_pixels',{p_id:attachment[2]});
    if(!image.width||!image.height)throw new Error('PDF verification is pending.');
    const output=await sharp(Buffer.from(image.data,'base64'),{raw:{width:image.width,height:image.height,channels:3}}).jpeg({quality:90}).toBuffer();
    const name=String(meta.name).replace(/[^a-zA-Z0-9._-]/g,'_').replace(/\.[^.]*$/,'')+'.jpg';
    return new NextResponse(output,{headers:{...headers,'Content-Type':'image/jpeg','Content-Disposition':`attachment; filename="${name}"`,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});
   }
  }
  const services=/^(insta-services|service-ops|service-setup)(\/|$)/.test(route);
  return NextResponse.json(await rpc(services?'services_api':'project_api',services?{p_route:route,p_method:req.method,p_body:body}:{p_route:route,p_method:req.method,b:body,query}),{headers});
 }catch(e:any){return NextResponse.json({error:e.status&&e.status>=500?'Could not complete this request.':e.message||'Could not complete this request.'},{status:e.status===401?401:e.status===403?403:422,headers});}
}
