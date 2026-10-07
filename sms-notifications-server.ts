import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
export function notificationText(title) {
 return `[YESMOA] 새 매입 신청이 접수되었습니다.\n제목: ${String(title).replace(/[\r\n\x00-\x1f]/g,' ').slice(0,150)}\n확인: https://yesmoa.kr/#requests`;
}
export async function sendNotification(job,config,fetcher=fetch) {
 if(job.mode==='mock')return {status:'simulated',code:'MOCK_NO_SMS'};
 if(config.liveEnabled!=='true')return {status:'failed',code:'LIVE_NOT_APPROVED'};
 if(!config.key||!config.secret||!/^0\d{8,10}$/.test(config.from||''))return {status:'failed',code:'PROVIDER_NOT_CONFIGURED'};
 if(!/^01[016789]\d{7,8}$/.test(job.recipient))return {status:'failed',code:'INVALID_RECIPIENT'};
 const date=new Date().toISOString(),salt=crypto.randomUUID().replaceAll('-','');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(config.secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(date+salt)))).map(n=>n.toString(16).padStart(2,'0')).join('');
 try {
  const response=await fetcher('https://api.solapi.com/messages/v4/send-many/detail',{
   method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',Authorization:`HMAC-SHA256 apiKey=${config.key}, date=${date}, salt=${salt}, signature=${signature}`},
   body:JSON.stringify({messages:[{to:job.recipient,from:config.from,text:notificationText(job.title),type:'LMS',subject:'YESMOA 매입 접수',customFields:{notificationId:job.id}}],allowDuplicates:false})
  });
  if(response.status>=500)return {status:'unknown',code:'PROVIDER_5XX'};
  if(!response.ok)return {status:'failed',code:`HTTP_${response.status}`};
  const result=await response.json();const message=result.messageList?.[0];
  if(result.failedMessageList?.length)return {status:'failed',code:String(result.failedMessageList[0].statusCode||'PROVIDER_REJECTED')};
  if(!message?.messageId)return {status:'unknown',code:'INVALID_PROVIDER_RESPONSE'};
  return {status:'accepted',providerId:message.messageId,code:String(message.statusCode||'ACCEPTED')};
 }catch{return {status:'unknown',code:'NETWORK_OUTCOME_UNKNOWN'};}
}

Deno.serve(async req=>{
 const workerKey=Deno.env.get('SMS_WORKER_TOKEN');
 if(req.method!=='POST'||!workerKey||req.headers.get('x-sms-worker-token')!==workerKey)return new Response('Unauthorized',{status:401});
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const {data:jobs,error}=await client.rpc('yesmoa_sms_claim');
 if(error)return new Response('Queue unavailable',{status:503});
 let processed=0;
 for(const job of jobs||[]){
  const result=await sendNotification(job,{liveEnabled:Deno.env.get('SMS_LIVE_ENABLED'),key:Deno.env.get('SOLAPI_API_KEY'),secret:Deno.env.get('SOLAPI_API_SECRET'),from:Deno.env.get('SOLAPI_SENDER_NUMBER')});
  const {error:finishError}=await client.rpc('yesmoa_sms_finish',{p_id:job.id,p_status:result.status,p_provider_id:result.providerId||null,p_code:result.code});
  if(finishError)return new Response('Result recording unavailable',{status:503});
  processed++;
 }
 return Response.json({processed});
});
