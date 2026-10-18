import {NextRequest} from "next/server";
import {hostedAuth} from "./hosted-auth";
import {canReviewStaffDemo} from "./showcase-policy";
/** Uses the real, verified Supabase session. Demo cookies and request body flags are never trusted. */
export async function showcaseOwnerAccess(req:NextRequest){
 if(!req.cookies.has("md_one_access")&&!req.cookies.has("md_one_refresh"))return {allowed:false,cookies:[]};
 const authRequest=new NextRequest(new URL("/api/auth/session",req.url),{method:"GET",headers:req.headers});
 const response=await hostedAuth(authRequest,["auth","session"]);
 const session=response.ok?await response.json():null;
 return {allowed:canReviewStaffDemo(session,process.env.MD_ONE_FOUNDER_USER_ID),cookies:response.cookies.getAll()};
}
