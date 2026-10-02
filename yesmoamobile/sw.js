// Use the common online site rather than a separate offline copy.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||event.request.mode!=='navigate')return;
 const source=new URL(event.request.url);
 if(source.origin!==self.location.origin)return;
 if(source.pathname===new URL('./',self.location.href).pathname||source.pathname===new URL('index.html',self.location.href).pathname){
  const target=new URL('../',self.location.href);target.search=source.search;
  event.respondWith(Promise.resolve(Response.redirect(target.href,302)));
 }else{event.respondWith(fetch(event.request));}
});
ㄴ
