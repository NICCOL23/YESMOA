(()=>{
 const link=document.getElementById('spec-return');if(!link)return;
 const params=new URLSearchParams(location.search);
 const fromRequest=params.get('from')==='requests';
 let internalReferrer=false;
 try{internalReferrer=!!document.referrer&&new URL(document.referrer).origin===location.origin;}catch{}
 if(fromRequest){
  link.textContent='← 매입 신청으로 돌아가기';
  link.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();window.close();setTimeout(()=>location.assign(link.href),150);});
 }else if(internalReferrer&&history.length>1){
  link.textContent='← 이전 화면으로';
  link.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();history.back();});
 }
})();
