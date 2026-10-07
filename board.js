(() => {
'use strict';
const root=document.createElement('main');root.className='request-board';root.hidden=true;
root.innerHTML=`<p class="kicker">YESMOA / PURCHASE REQUEST</p><h1 tabindex="-1">매입 신청</h1><p>판매할 중고 물품을 등록하면 확인 후 연락드립니다.</p><p class="notice" id="board-status" role="status" aria-live="polite"></p><section class="auth"><button id="show-admin" type="button">관리자 로그인</button><div id="admin-auth" hidden><div id="account"></div><form id="login-form"><label for="login-email">관리자 이메일</label><input id="login-email" type="email" required autocomplete="email" placeholder="로그인 링크를 받을 이메일"><button type="submit">로그인 링크 받기</button></form><button id="logout" hidden>로그아웃</button></div></section><section id="request-list"><div class="toolbar"><input id="request-search" aria-label="제목 검색" placeholder="제목을 검색하세요"><button id="search-button">검색</button><button class="primary" id="new-request">매입 신청하기</button></div><p>신청 내용은 비밀번호를 아는 사람 또는 관리자만 확인할 수 있습니다.</p><div id="admin-tools" hidden><button id="toggle-trash">삭제한 글 보기</button></div><div class="table-wrap"><table><thead><tr><th>번호</th><th>분류</th><th>제목</th><th>작성자</th><th>작성일</th><th>조회수</th></tr></thead><tbody id="request-rows"></tbody></table></div><div class="pagination"><button id="previous">이전</button><span id="page-label"></span><button id="next">다음</button></div></section><section id="request-write" hidden><h2>매입 신청서 작성</h2><form class="request-form" autocomplete="off" novalidate><div class="fields" id="request-fields"></div><div class="toolbar"><button type="button" class="back-list">목록으로</button><button type="submit" class="primary" id="request-submit">신청 등록</button></div></form></section><section id="request-unlock" hidden><h2>신청 내용 확인</h2><form id="unlock-form"><label for="unlock-password">비밀번호</label><input id="unlock-password" type="password" autocomplete="off" required><p class="error" id="unlock-error" role="alert"></p><div class="toolbar"><button type="button" class="back-list">목록으로</button><button type="submit" class="primary">확인</button></div></form><p>등록할 때 정한 비밀번호를 입력하세요. 비밀번호를 아는 사람은 이 글을 볼 수 있습니다.</p><div id="legacy-auth" hidden><p>기존 이메일 인증으로 등록한 글입니다. 기존 작성자 또는 관리자가 로그인해야 합니다.</p><button id="legacy-login">기존 계정 로그인</button></div></section><section id="request-detail" hidden><h2>신청 상세</h2><div id="detail-content"></div><button class="back-list">목록으로</button></section>`;
document.querySelector('.site-nav').after(root);
const originals=[...document.body.children].filter(el=>el!==root&&el.tagName!=='SCRIPT'&&!el.matches('.site-nav,dialog'));
const $=s=>root.querySelector(s);const status=text=>$('#board-status').textContent=text;
let client,user=null,page=1,total=0,search='',loading=false,isAdmin=false,trash=false,selectedId=null,reloadPending=false,editingId=null,detailData=null,authRevision=0,mutationPending=false;
const completion=document.createElement('dialog');
completion.className='request-completion';
completion.setAttribute('aria-labelledby','completion-title');
completion.innerHTML='<h2 id="completion-title">신청 완료</h2><p>매입 신청이 정상적으로 접수되었습니다.<br>신청 내용을 확인한 후 연락드리겠습니다. 감사합니다.</p><button type="button" class="primary">확인</button>';
root.append(completion);
function returnToList(){location.hash='requests';view('list');loadList();}
completion.querySelector('button').onclick=()=>completion.close();
completion.addEventListener('close',returnToList);
const editSection=document.createElement('section');editSection.id='request-edit';editSection.hidden=true;
editSection.innerHTML='<h2>매입 신청 수정</h2><form id="edit-form"><div class="fields" id="edit-fields"></div><div class="toolbar"><button type="button" id="edit-cancel">취소</button><button type="submit" class="primary">저장</button></div></form>';
root.append(editSection);
const fields=[['title','제목','text',true],['category','매입 방식','select',true],['author','작성자','text',true],['password','비밀번호','password',true],['password_confirm','비밀번호 확인','password',true],['birth_date','생년월일','date',false],['phone','연락처','tel',true],['bank_name','은행명','text',false],['account_number','계좌번호','text',false],['body','본문','textarea',true]];
for(const [name,label,type,required] of fields){const wrap=document.createElement('div');if(name==='title'||name==='body')wrap.className='wide';const lab=document.createElement('label');lab.htmlFor='request-'+name;lab.textContent=label+(required?' *':'');let input=document.createElement(type==='select'?'select':type==='textarea'?'textarea':'input');input.id=lab.htmlFor;input.name=name;input.autocomplete='off';input.required=required;if(input.tagName==='INPUT')input.type=type;if(type==='select')for(const value of ['직접 방문','직접 발송','택배 방문','출장 매입','데이터 삭제','기타']){const option=new Option(value||'분류를 선택하세요',value);input.add(option);}if(type==='textarea'){input.rows=9;input.maxLength=10000;input.placeholder='제품명, 사양, 수량, 작동 여부와 상태를 적어주세요.';}else if(type!=='select'&&type!=='date')input.maxLength=name==='title'?150:100;if(type==='date')input.max=new Date().toLocaleDateString('sv-SE');if(type==='password'){input.minLength=4;input.maxLength=72;input.autocomplete='new-password';}const error=document.createElement('p');error.className='error';error.id=name+'-error';input.setAttribute('aria-describedby',error.id);wrap.append(lab,input,error);$('#request-fields').append(wrap);}
const titleChoices=['매입 신청합니다','매입 견적 문의합니다','컴퓨터·노트북 매입 문의합니다','컴퓨터 부품·고장 제품 매입 문의합니다','기업·기관 대량 매입 문의합니다'];
function titlePicker(input,value=''){
 const select=document.createElement('select');select.id=input.id+'-choice';select.autocomplete='off';
 for(const text of ['문의 제목을 선택해 주세요',...titleChoices,'기타 문의 / 직접 입력'])select.add(new Option(text,text==='문의 제목을 선택해 주세요'?'':text));
 const label=input.parentElement.querySelector('label');label.htmlFor=select.id;
 input.before(select);input.setAttribute('aria-label','제목 직접 입력');input.placeholder='문의 제목을 입력해 주세요';
 const hint=document.createElement('p');hint.className='title-help';hint.textContent='제목은 공개됩니다. 이름·연락처 등 개인정보를 적지 마세요.';input.after(hint);
 const sync=()=>{const custom=select.value==='기타 문의 / 직접 입력';input.hidden=!custom;if(!custom)input.value=select.value;};
 select.value=value?(titleChoices.includes(value)?value:'기타 문의 / 직접 입력'):'';sync();if(value)input.value=value;
 select.addEventListener('change',()=>{input.value='';sync();if(!input.hidden)input.focus();});
 input.form.addEventListener('reset',()=>setTimeout(()=>{select.value='';sync();},0));
 return select;
}
titlePicker($('#request-title'));
const information=document.createElement('div');information.className='request-information';
const bodyField=$('#request-body').parentElement;bodyField.classList.add('request-body-field');bodyField.classList.remove('wide');
for(const field of [...$('#request-fields').children])if(field!==bodyField)information.append(field);
$('#request-fields').prepend(information);
$('.request-form').insertAdjacentHTML('beforeend',`<div class="request-privacy"><p class="password-help">비밀번호는 4자 이상으로 설정하고 확인란에 동일하게 입력해주세요. 제목에 개인정보를 적지 마세요.</p><details><summary>개인정보 수집·이용 안내 보기</summary><p>수집 항목: 작성자, 생년월일(선택), 연락처, 은행명·계좌번호(선택), 신청 내용<br>이용 목적: 매입 상담, 신청 확인 및 정산<br>보관 기간: 처리 완료 후 90일 이내 파기. 거래 성립 시 필요한 보관 기간은 별도로 안내합니다.<br>비밀번호를 잊으면 고객이 직접 신청 내용을 조회할 수 없습니다. 다른 서비스에서 쓰는 비밀번호는 사용하지 마세요.</p></details><label class="consent" for="request-consent"><input type="checkbox" id="request-consent" name="consent" required aria-describedby="consent-error">개인정보 수집·이용에 동의합니다. *</label><p class="privacy-required">동의를 거부하면 신청할 수 없습니다.</p><p class="error" id="consent-error"></p></div>`);
$('.request-form').append($('.request-form > .toolbar'));
const authBox=$('.auth');root.append(authBox);
$('#show-admin').setAttribute('aria-controls','admin-auth');$('#show-admin').setAttribute('aria-expanded','false');
const smsPanel=document.createElement('details');smsPanel.id='sms-settings';smsPanel.hidden=true;
smsPanel.innerHTML='<summary>문자 알림 설정</summary><form id="sms-form" autocomplete="off"><label for="sms-recipient">관리자 수신 휴대폰 번호</label><input id="sms-recipient" type="tel" inputmode="tel" maxlength="13" placeholder="수신 번호를 입력해 주세요" autocomplete="off"><label class="consent"><input id="sms-enabled" type="checkbox">새 신청 문자 알림 켜기</label><button type="submit">설정 저장</button></form><p id="sms-mode"></p><p id="sms-status" role="status" aria-live="polite"></p><h3>최근 알림 처리 기록</h3><ul id="sms-logs"></ul>';
root.append(smsPanel);
const smsLabels={pending:'처리 대기',processing:'발송 처리 중',simulated:'모의 발송 완료 (실제 문자 없음)',accepted:'문자 서비스 접수 완료',failed:'발송 실패',unknown:'발송 결과 확인 필요',skipped:'알림 꺼짐 — 발송 안 함'};
function showSmsSettings(data){$('#sms-recipient').value=data.recipient||'';$('#sms-enabled').checked=data.enabled===true;$('#sms-mode').textContent=data.live_ready?'실제 문자 발송 설정 · 수신 번호 변경은 이후 신청부터 적용됩니다.':'서비스 준비 중 · 모의 발송 상태입니다. 실제 문자는 발송되지 않습니다.';$('#sms-logs').replaceChildren();for(const log of data.logs||[]){const li=document.createElement('li');li.textContent=new Date(log.created_at).toLocaleString('ko-KR')+' · '+(smsLabels[log.status]||'확인 필요')+(log.result_code?' · '+log.result_code:'');$('#sms-logs').append(li);}if(!data.logs?.length)$('#sms-logs').textContent='아직 알림 처리 기록이 없습니다.';}
async function loadSmsSettings(){if(!isAdmin)return;const revision=authRevision;const {data,error}=await client.rpc('yesmoa_sms_settings_get');if(revision!==authRevision||!isAdmin)return;if(error){$('#sms-status').textContent='문자 알림 설정을 불러오지 못했습니다. 잠시 후 다시 열어주세요.';return;}showSmsSettings(data);}
smsPanel.addEventListener('toggle',()=>{if(smsPanel.open)loadSmsSettings();});
$('#sms-form').onsubmit=async e=>{e.preventDefault();if(!isAdmin)return;const button=e.target.querySelector('button');if(button.disabled)return;const phone=$('#sms-recipient').value.replace(/[\s-]/g,'');const enabled=$('#sms-enabled').checked;if((phone&&!/^01[016789][0-9]{7,8}$/.test(phone))||(enabled&&!phone)){$('#sms-status').textContent='올바른 휴대폰 번호를 입력해주세요.';$('#sms-recipient').focus();return;}button.disabled=true;const revision=authRevision;try{const {data,error}=await client.rpc('yesmoa_sms_settings_save',{p_recipient:phone,p_enabled:enabled});if(error)throw error;if(revision!==authRevision||!isAdmin)return;showSmsSettings(data);$('#sms-status').textContent='설정을 저장했습니다. 이후 접수되는 신청부터 적용됩니다.';}catch{if(revision===authRevision)$('#sms-status').textContent='저장하지 못했습니다. 입력 내용은 유지됩니다.';}finally{button.disabled=false;}};
function updateNavigationOffset(){const bottom=document.querySelector('.site-nav').getBoundingClientRect().bottom;root.style.setProperty('--request-nav-bottom',Math.max(0,bottom)+8+'px');const box=root.getBoundingClientRect();const padding=parseFloat(getComputedStyle(root).paddingLeft);root.style.setProperty('--request-heading-left',box.left+padding+'px');root.style.setProperty('--request-heading-width',Math.max(0,root.clientWidth-padding*2)+'px');}
new ResizeObserver(updateNavigationOffset).observe(document.querySelector('.site-nav'));window.addEventListener('resize',updateNavigationOffset);updateNavigationOffset();
function view(which){root.classList.toggle('is-writing',which==='write');updateNavigationOffset();for(const id of ['list','write','detail','unlock','edit'])$('#request-'+id).hidden=id!==which;root.querySelector('h1').focus();}
function route(){const open=location.hash.startsWith('#requests');root.hidden=!open;originals.forEach(el=>{el.hidden=open;});if(open){view(location.hash==='#requests/new'?'write':'list');if(location.hash!=='#requests/new')loadList();root.scrollIntoView();}}
const link=document.createElement('a');link.href='#requests';link.textContent='매입 신청';document.querySelector('.nav-menu').append(link);
$('#new-request').onclick=()=>{status('');location.hash='requests/new';};root.querySelectorAll('.back-list').forEach(b=>b.onclick=()=>{location.hash='requests';view('list');loadList();});
function friendly(error){if(/Submission limit|Please wait/.test(error?.message||''))return '잠시 후 다시 등록해주세요. 접수 시도 횟수가 제한되었습니다.';if(/Invalid input|Consent required|Invalid date/.test(error?.message||''))return '필수 입력값, 날짜, 동의 및 비밀번호를 확인해주세요.';if(/relation|column|function|schema cache|permission|row-level/i.test(error?.message||''))return '데이터베이스 설정이 아직 완료되지 않았습니다. 사이트 관리자에게 문의해주세요.';return '요청을 처리하지 못했습니다. 연결 상태를 확인하고 다시 시도해주세요.';}
async function loadList(){if(!client)return;if(loading){reloadPending=true;return;}loading=true;$('#request-rows').replaceChildren();try{const {data,error}=await client.rpc(isAdmin?'yesmoa_admin_list':'yesmoa_list_requests',{p_search:search,p_page:page,...(isAdmin?{p_deleted:trash}:{})});if(error)throw error;total=Number(data?.total||0);for(const row of data?.rows||[]){const tr=document.createElement('tr');for(const val of [row.number,row.category,row.title,row.author_masked,new Date(row.created_at).toLocaleDateString('sv-SE'),row.views]){const td=document.createElement('td');td.textContent=val;tr.append(td);}const button=document.createElement('button');button.className='title-button';button.textContent=row.title;button.onclick=()=>loadDetail(row);tr.children[2].replaceChildren(button);if(isAdmin){if(!trash){const edit=document.createElement('button');edit.textContent='수정';edit.onclick=()=>loadDetail(row,true);tr.children[2].append(document.createTextNode(' '),edit);}const action=document.createElement('button');action.textContent=trash?'복구':'삭제';action.onclick=()=>manageDelete(row.id,trash);tr.children[2].append(document.createTextNode(' '),action);}$('#request-rows').append(tr);}if(!total){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='등록된 매입 신청이 없습니다.';tr.append(td);$('#request-rows').append(tr);}$('#page-label').textContent=`${page} / ${Math.max(1,Math.ceil(total/10))}`;$('#previous').disabled=page===1;$('#next').disabled=page*10>=total;}catch(error){status(friendly(error));}finally{loading=false;if(reloadPending){reloadPending=false;loadList();}}}
$('#search-button').onclick=()=>{search=$('#request-search').value.trim();page=1;loadList();};$('#request-search').onkeydown=e=>{if(e.key==='Enter')$('#search-button').click();};$('#previous').onclick=()=>{page--;loadList();};$('#next').onclick=()=>{page++;loadList();};
function renderDetail(data){detailData=data;const out=$('#detail-content');out.replaceChildren();const dl=document.createElement('dl');for(const [name,label] of fields.filter(f=>!f[0].startsWith('password'))){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=data[name]||'미입력';dd.className='detail';dl.append(dt,dd);}out.append(dl);if(isAdmin){const actions=document.createElement('div');actions.className='toolbar';const edit=document.createElement('button');edit.textContent='수정';edit.onclick=()=>startEdit(data);const remove=document.createElement('button');remove.textContent='삭제';remove.className='danger';remove.onclick=()=>manageDelete(selectedId,false);actions.append(edit,remove);out.append(actions);}view('detail');}
async function loadDetail(row,edit=false){selectedId=row.id;status('');if(row.deleted_at){status('삭제한 글은 복구한 뒤 조회해주세요.');return;}if(isAdmin||(row.legacy&&user)){try{const {data,error}=await client.rpc('yesmoa_request_detail',{p_id:row.id});if(error)throw error;if(data){renderDetail(data);if(edit&&isAdmin)startEdit(data);return;}}catch(error){status(friendly(error));return;}}$('#unlock-form').reset();$('#unlock-error').textContent='';$('#legacy-auth').hidden=!row.legacy;$('#unlock-form').hidden=!!row.legacy;view('unlock');if(!row.legacy)$('#unlock-password').focus();}
$('#unlock-form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('[type=submit]');if(b.disabled)return;b.disabled=true;try{const {data,error}=await client.rpc('yesmoa_password_detail',{p_id:selectedId,p_password:$('#unlock-password').value});if(error)throw error;const messages={incorrect:'비밀번호가 일치하지 않습니다.',locked:'확인 시도가 5회에 도달했습니다. 15분 후 다시 시도해주세요.',legacy:'기존 작성자 또는 관리자가 로그인해야 합니다.',unavailable:'조회할 수 없는 신청입니다.'};if(data?.error){$('#unlock-error').textContent=messages[data.error]||'내용을 확인할 수 없습니다.';return;}if(!data?.data)throw new Error('No data');e.target.reset();renderDetail(data.data);}catch(error){$('#unlock-error').textContent=friendly(error);}finally{b.disabled=false;}};
async function manageDelete(id,restore){if(!isAdmin||mutationPending)return;if(!confirm(restore?'이 글을 복구할까요?':'이 신청을 삭제하시겠습니까? 삭제한 글은 관리자 화면에서 복구할 수 있습니다.'))return;mutationPending=true;try{const {data,error}=await client.rpc('yesmoa_admin_delete',{p_id:id,p_restore:restore});if(error)throw error;if(!data)throw new Error('No data');status(restore?'복구했습니다.':'신청을 삭제했습니다.');detailData=null;returnToList();}catch(error){status(friendly(error));}finally{mutationPending=false;}}
function startEdit(data){
 if(!isAdmin||mutationPending)return;
 editingId=selectedId;$('#edit-fields').replaceChildren();status('');
 for(const [name,label,type,required] of fields.filter(f=>!f[0].startsWith('password'))){
  const original=$('#request-'+name);const input=original.cloneNode(true);
  input.id='edit-'+name;input.value=data[name]||'';input.required=required;
  input.removeAttribute('aria-describedby');input.removeAttribute('aria-invalid');
  const wrapper=document.createElement('div');if(name==='title'||name==='body')wrapper.className='wide';
  const lab=document.createElement('label');lab.htmlFor=input.id;lab.textContent=label+(required?' *':'');wrapper.append(lab,input);$('#edit-fields').append(wrapper);if(name==='title'){input.hidden=false;titlePicker(input,data[name]||'');}
 }
 view('edit');$('#edit-title-choice').focus();
}
$('#edit-cancel').onclick=()=>{if(!mutationPending&&detailData)renderDetail(detailData);};
$('#edit-form').onsubmit=async e=>{
 e.preventDefault();if(!isAdmin||mutationPending||!editingId)return;
 const form=e.target;if(!form.elements.title.value.trim()){status('문의 제목을 선택하거나 직접 입력해주세요.');$('#edit-title-choice').focus();return;}if(!form.reportValidity())return;
 const payload={};for(const [name]of fields.filter(f=>!f[0].startsWith('password'))){const input=form.elements[name];payload[name]=input.value.trim()||null;if(input.required&&!payload[name]){status('필수 항목을 입력해주세요.');input.focus();return;}}
 mutationPending=true;const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
 const id=editingId;const revision=authRevision;
 try{
  const {data,error}=await client.rpc('yesmoa_admin_update',{p_id:id,p_data:payload});
  if(error)throw error;if(!data)throw new Error('No saved request');
  if(revision!==authRevision)return;
  detailData={...detailData,...payload};renderDetail(detailData);status('신청 내용을 수정했습니다.');loadList();
 }catch(error){status(friendly(error)+' 입력 내용은 유지됩니다.');}
 finally{mutationPending=false;buttons.forEach(b=>b.disabled=false);}
};
$('#toggle-trash').onclick=()=>{trash=!trash;page=1;$('#toggle-trash').textContent=trash?'전체 신청 보기':'삭제한 글 보기';loadList();};
$('#show-admin').onclick=()=>{$('#admin-auth').hidden=!$('#admin-auth').hidden;$('#show-admin').setAttribute('aria-expanded',String(!$('#admin-auth').hidden));};
$('#legacy-login').onclick=()=>{$('#admin-auth').hidden=false;$('#login-email').focus();};
$('#login-form').onsubmit=async e=>{e.preventDefault();if(!client)return;const b=e.target.querySelector('button');b.disabled=true;try{const url=new URL(location.href);url.hash='';const {error}=await client.auth.signInWithOtp({email:$('#login-email').value.trim(),options:{emailRedirectTo:url.href}});if(error)throw error;status('로그인 링크를 이메일로 보냈습니다. 메일의 링크를 열어주세요.');}catch(error){status(friendly(error));}finally{b.disabled=false;}};
$('#logout').onclick=async()=>{const {error}=await client.auth.signOut();if(error){status('로그아웃에 실패했습니다. 다시 시도해주세요.');return;}$('.request-form').reset();$('#detail-content').replaceChildren();view('list');trash=false;page=1;loadList();status('로그아웃했습니다.');};
$('.request-form').onsubmit=async e=>{e.preventDefault();const form=e.target;let valid=true;for(const input of form.elements){if(!input.name)continue;const ok=input.checkValidity()&&(!input.required||input.type==='checkbox'||input.value.trim().length>0);input.setAttribute('aria-invalid',String(!ok));$('#'+input.name+'-error').textContent=ok?'':(input.name==='consent'?'개인정보 수집·이용에 동의해주세요.':'올바른 값을 입력해주세요.');if(!ok&&valid){(input.hidden?$('#request-title-choice'):input).focus();valid=false;}}const pass=form.elements.password,check=form.elements.password_confirm;if(pass.value.length<4){$('#password-error').textContent='비밀번호를 4자 이상 입력해주세요.';pass.setAttribute('aria-invalid','true');valid=false;}if(pass.value!==check.value){$('#password_confirm-error').textContent='비밀번호가 일치하지 않습니다.';check.setAttribute('aria-invalid','true');valid=false;}if(new TextEncoder().encode(pass.value).length>72){$('#password-error').textContent='비밀번호는 UTF-8 기준 72바이트 이하로 입력해주세요.';valid=false;}if(!valid)return;if(!client){status('접수 기능을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');return;}const b=$('#request-submit');if(b.disabled)return;b.disabled=true;const payload={};for(const [name]of fields)payload[name]=form.elements[name].value.trim()||null;payload.password=form.elements.password.value;delete payload.password_confirm;payload.consent=true;try{const {data,error}=await client.rpc('yesmoa_submit_request',{p_data:payload});if(error)throw error;if(!data)throw new Error('No saved request');form.reset();status('매입 신청이 정상적으로 접수되었습니다.');page=1;search='';$('#request-search').value='';completion.showModal();}catch(error){status(friendly(error)+' 입력 내용은 유지됩니다.');}finally{b.disabled=false;}};
async function init(){if(location.hash.startsWith('#requests#'))history.replaceState(null,'',location.pathname+location.search+location.hash.slice('#requests'.length));const returningFromEmail=location.hash.includes('access_token=')||location.search.includes('code=');if(!window.supabase){status('로그인 기능을 불러오지 못했습니다. 새로고침해주세요.');return;}client=window.supabase.createClient('https://rkjifgvzmetzdnawehnt.supabase.co','sb_publishable_Z_M0Q7RhYEVTTsEdaW1wnw_4qP5adyy',{auth:{persistSession:true,detectSessionInUrl:true}});function account(session){
 const revision=++authRevision;
 user=session?.user||null;isAdmin=false;trash=false;
 $('#account').textContent=user?'로그인 완료 · 관리자 권한 확인 중 · '+user.email:'로그인되지 않았습니다. 이메일의 로그인 링크를 열어주세요.';
 $('#login-form').hidden=!!user;$('#logout').hidden=!user;
 $('#show-admin').textContent=user?'관리자 권한 확인 중':'관리자 로그인';
 $('#admin-tools').hidden=true;smsPanel.hidden=true;smsPanel.open=false;$('#sms-form').reset();$('#sms-logs').replaceChildren();$('#sms-mode').textContent='';$('#sms-status').textContent='';$('#toggle-trash').textContent='삭제한 글 보기';
 $('#detail-content').replaceChildren();detailData=null;editingId=null;
 if(location.hash.startsWith('#requests'))view('list');
 if(!user){loadList();return;}
 $('#admin-auth').hidden=false;
 // Supabase auth callbacks must return before starting another auth-backed RPC.
 setTimeout(async()=>{
  const {data,error}=await client.rpc('yesmoa_is_admin');
  if(revision!==authRevision)return;
  isAdmin=!error&&data===true;
  $('#account').textContent=(error?'관리자 권한 확인 실패 · ':isAdmin?'관리자 로그인 완료 · ':'일반 계정 로그인 완료 · ')+user.email;
  $('#show-admin').textContent=isAdmin?'관리자 로그인 완료':'로그인 계정 보기';
  $('#admin-tools').hidden=!isAdmin;smsPanel.hidden=!isAdmin;page=1;
  if(error)status('관리자 권한을 확인하지 못했습니다. 새로고침 후 다시 확인해주세요.');
  else status(isAdmin?'관리자로 로그인했습니다. 신청을 수정하거나 삭제할 수 있습니다.':'로그인했습니다. 이 계정에는 관리자 권한이 없습니다.');
  loadList();
 },0);
}client.auth.onAuthStateChange((event,session)=>{if(event==='TOKEN_REFRESHED'&&session?.user?.id===user?.id)return;account(session);if(returningFromEmail&&session?.user&&!location.hash.startsWith('#requests'))location.hash='requests';});const {data,error}=await client.auth.getSession();if(error)status('로그인 상태를 확인하지 못했습니다.');account(data?.session);if(returningFromEmail&&user){$('#admin-auth').hidden=false;location.hash="requests";}route();}
window.addEventListener('hashchange',route);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&location.hash==='#requests')loadList();});window.addEventListener('pageshow',e=>{if(e.persisted&&location.hash==='#requests')loadList();});init();
})();




