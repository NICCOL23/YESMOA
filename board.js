(() => {
'use strict';
const root=document.createElement('main');root.className='request-board';root.hidden=true;
root.innerHTML=`<div class="request-list-heading"><div class="request-heading-copy"><h1 tabindex="-1">매입 신청</h1><p class="request-intro">판매할 중고 물품을 등록하면 확인 후 연락드립니다.</p></div><a class="request-spec" href="spec-check.html" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M12 16v5M7 21h10"/></svg><span>내 컴퓨터 사양 확인 ↗</span></a><button class="primary" id="new-request">매입 신청하기</button></div><p class="notice" id="board-status" role="status" aria-live="polite"></p><section class="auth"><button id="show-admin" type="button">관리자 로그인</button><div id="admin-auth" hidden><div id="account"></div><form id="login-form"><label for="login-email">관리자 이메일</label><input id="login-email" type="email" required autocomplete="email" placeholder="로그인 링크를 받을 이메일"><button type="submit">로그인 링크 받기</button></form><button id="logout" hidden>로그아웃</button></div></section><section id="request-list"><section class="request-guide" aria-label="매입 절차 안내"><strong>처음 신청하시나요? 매입 절차를 확인하세요.</strong><div class="request-guide-buttons"><button type="button" data-guide="visit" aria-expanded="false" aria-controls="request-guide-content">직접 방문</button><button type="button" data-guide="parcel" aria-expanded="false" aria-controls="request-guide-content">택배 발송·수거</button><button type="button" data-guide="pickup" aria-expanded="false" aria-controls="request-guide-content">출장 매입</button><button type="button" data-guide="quick" aria-expanded="false" aria-controls="request-guide-content">카카오 T 퀵</button><div class="request-guide-actions"><button type="button" data-open-purchase>전체 매입 절차 보기</button><button type="button" id="close-request-guide" hidden>안내 접기</button></div></div><div id="request-guide-content" hidden><h2></h2><p class="guide-intro"></p><h3>진행 순서</h3><ol class="guide-steps"></ol><h3>준비 사항</h3><ul class="guide-preparation"></ul><h3>자주 묻는 질문</h3><div class="guide-faq"></div></div></section><div id="admin-tools" hidden><button id="toggle-trash">삭제한 글 보기</button></div><div class="table-wrap"><table><thead><tr><th>번호</th><th>분류</th><th>제목</th><th>작성자</th><th>작성일</th><th>조회수</th></tr></thead><tbody id="request-rows"></tbody></table></div><div class="pagination"><button id="previous">이전</button><span id="page-label"></span><button id="next">다음</button></div></section><section id="request-write" hidden><h2>매입 신청서 작성</h2><form class="request-form" autocomplete="off" novalidate><div class="fields" id="request-fields"></div><div class="toolbar"><button type="button" class="back-list">목록으로</button><button type="submit" class="primary" id="request-submit">신청 등록</button></div></form></section><section id="request-unlock" hidden><h2>신청 내용 확인</h2><form id="unlock-form"><label for="unlock-password">비밀번호</label><input id="unlock-password" type="password" autocomplete="off" required><p class="error" id="unlock-error" role="alert"></p><div class="toolbar"><button type="button" class="back-list">목록으로</button><button type="submit" class="primary">확인</button></div></form><p>등록할 때 정한 비밀번호를 입력하세요. 비밀번호를 아는 사람은 이 글을 볼 수 있습니다.</p><div id="legacy-auth" hidden><p>기존 이메일 인증으로 등록한 글입니다. 기존 작성자 또는 관리자가 로그인해야 합니다.</p><button id="legacy-login">기존 계정 로그인</button></div></section><section id="request-detail" hidden><h2>신청 상세</h2><div id="detail-content"></div><button class="back-list">목록으로</button></section>`;
document.querySelector('.site-nav').after(root);
const originals=[...document.body.children].filter(el=>el!==root&&el.tagName!=='SCRIPT'&&!el.matches('.site-nav,dialog'));
const $=s=>root.querySelector(s);const status=text=>$('#board-status').textContent=text;
let priceManager;
let client,user=null,page=1,total=0,search='',loading=false,isAdmin=false,trash=false,selectedId=null,reloadPending=false,editingId=null,detailData=null,authRevision=0,mutationPending=false;
const completion=document.createElement('dialog');
completion.className='request-completion';
completion.setAttribute('aria-labelledby','completion-title');
completion.innerHTML='<h2 id="completion-title">신청 완료</h2><p>매입 신청이 정상적으로 접수되었습니다.<br>신청 내용을 확인한 후 연락드리겠습니다. 감사합니다.</p><button type="button" class="primary">확인</button>';
root.append(completion);
const adminRoute=()=>location.hash==='#admin';
const canManage=()=>adminRoute()&&isAdmin;
function returnToList(){location.hash=adminRoute()?'admin':'requests';view('list');loadList();}
completion.querySelector('button').onclick=()=>completion.close();
completion.addEventListener('close',returnToList);
const editSection=document.createElement('section');editSection.id='request-edit';editSection.hidden=true;
editSection.innerHTML='<h2>매입 신청 수정</h2><form id="edit-form"><div class="fields" id="edit-fields"></div><div class="toolbar"><button type="button" id="edit-cancel">취소</button><button type="submit" class="primary">저장</button></div></form>';
root.append(editSection);
const fields=[['title','제목','text',true],['category','매입 방식','select',true],['author','작성자','text',true],['password','비밀번호','password',true],['password_confirm','비밀번호 확인','password',true],['phone','연락처','tel',true],['bank_name','은행명','text',false],['account_number','계좌번호','text',false],['body','본문','textarea',true]];
for(const [name,label,type,required] of fields){const wrap=document.createElement('div');if(name==='title'||name==='body'||name==='phone')wrap.className='wide';const lab=document.createElement('label');lab.htmlFor='request-'+name;lab.textContent=label+(required?' *':'');let input=document.createElement(type==='select'?'select':type==='textarea'?'textarea':'input');input.id=lab.htmlFor;input.name=name;input.autocomplete='off';input.required=required;if(input.tagName==='INPUT')input.type=type;if(type==='select')for(const value of ['직접 방문','직접 발송','택배 방문','출장 매입','데이터 삭제','기타']){const option=new Option(value||'분류를 선택하세요',value);input.add(option);}if(type==='textarea'){input.rows=9;input.maxLength=10000;input.placeholder='제품명, 사양, 수량, 작동 여부와 상태를 적어주세요.';}else if(type!=='select'&&type!=='date')input.maxLength=name==='title'?150:100;if(type==='date')input.max=new Date().toLocaleDateString('sv-SE');if(type==='password'){input.minLength=4;input.maxLength=72;input.autocomplete='new-password';}const error=document.createElement('p');error.className='error';error.id=name+'-error';input.setAttribute('aria-describedby',error.id);wrap.append(lab,input,error);$('#request-fields').append(wrap);}
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
$('.request-form').insertAdjacentHTML('beforeend',`<div class="request-privacy"><p class="password-help">비밀번호는 4자 이상으로 설정하고 확인란에 동일하게 입력해주세요. 제목에 개인정보를 적지 마세요.</p><details><summary>개인정보 수집·이용 안내 보기</summary><p>수집 항목: 작성자, 연락처, 은행명·계좌번호(선택), 신청 내용<br>이용 목적: 매입 상담, 신청 확인 및 정산<br>보관 기간: 처리 완료 후 90일 이내 파기. 거래 성립 시 필요한 보관 기간은 별도로 안내합니다.<br>비밀번호를 잊으면 고객이 직접 신청 내용을 조회할 수 없습니다. 다른 서비스에서 쓰는 비밀번호는 사용하지 마세요.</p></details><label class="consent" for="request-consent"><input type="checkbox" id="request-consent" name="consent" required aria-describedby="consent-error">개인정보 수집·이용에 동의합니다. *</label><p class="privacy-required">동의를 거부하면 신청할 수 없습니다.</p><p class="error" id="consent-error"></p></div>`);
$('.request-form').append($('.request-form > .toolbar'));
const authBox=$('.auth');root.append(authBox);authBox.hidden=true;
const customerLink=document.createElement('a');customerLink.href='#requests';customerLink.textContent='고객 화면으로 돌아가기';customerLink.className='customer-return';root.append(customerLink);customerLink.hidden=true;
$('#show-admin').setAttribute('aria-controls','admin-auth');$('#show-admin').setAttribute('aria-expanded','false');
const smsPanel=document.createElement('details');smsPanel.id='sms-settings';smsPanel.hidden=true;
smsPanel.innerHTML='<summary>문자 알림 설정</summary><form id="sms-form" autocomplete="off"><label for="sms-recipient">관리자 수신 휴대폰 번호</label><input id="sms-recipient" type="tel" inputmode="tel" maxlength="13" placeholder="수신 번호를 입력해 주세요" autocomplete="off"><label class="consent"><input id="sms-enabled" type="checkbox">새 신청 문자 알림 켜기</label><button type="submit">설정 저장</button></form><p id="sms-mode"></p><p id="sms-status" role="status" aria-live="polite"></p><h3>최근 알림 처리 기록</h3><ul id="sms-logs"></ul>';
root.append(smsPanel);
const smsLabels={pending:'처리 대기',processing:'발송 처리 중',simulated:'모의 발송 완료 (실제 문자 없음)',accepted:'문자 서비스 접수 완료',failed:'발송 실패',unknown:'발송 결과 확인 필요',skipped:'알림 꺼짐 — 발송 안 함'};
function showSmsSettings(data){$('#sms-recipient').value=data.recipient||'';$('#sms-enabled').checked=data.enabled===true;$('#sms-mode').textContent=data.live_ready?'실제 문자 발송 설정 · 수신 번호 변경은 이후 신청부터 적용됩니다.':'서비스 준비 중 · 모의 발송 상태입니다. 실제 문자는 발송되지 않습니다.';$('#sms-logs').replaceChildren();for(const log of data.logs||[]){const li=document.createElement('li');li.textContent=new Date(log.created_at).toLocaleString('ko-KR')+' · '+(smsLabels[log.status]||'확인 필요')+(log.result_code?' · '+log.result_code:'');$('#sms-logs').append(li);}if(!data.logs?.length)$('#sms-logs').textContent='아직 알림 처리 기록이 없습니다.';}
async function loadSmsSettings(){if(!canManage())return;const revision=authRevision;const {data,error}=await client.rpc('yesmoa_sms_settings_get');if(revision!==authRevision||!canManage())return;if(error){$('#sms-status').textContent='문자 알림 설정을 불러오지 못했습니다. 잠시 후 다시 열어주세요.';return;}showSmsSettings(data);}
smsPanel.addEventListener('toggle',()=>{if(smsPanel.open)loadSmsSettings();});
$('#sms-form').onsubmit=async e=>{e.preventDefault();if(!canManage())return;const button=e.target.querySelector('button');if(button.disabled)return;const phone=$('#sms-recipient').value.replace(/[\s-]/g,'');const enabled=$('#sms-enabled').checked;if((phone&&!/^01[016789][0-9]{7,8}$/.test(phone))||(enabled&&!phone)){$('#sms-status').textContent='올바른 휴대폰 번호를 입력해주세요.';$('#sms-recipient').focus();return;}button.disabled=true;const revision=authRevision;try{const {data,error}=await client.rpc('yesmoa_sms_settings_save',{p_recipient:phone,p_enabled:enabled});if(error)throw error;if(revision!==authRevision||!canManage())return;showSmsSettings(data);$('#sms-status').textContent='설정을 저장했습니다. 이후 접수되는 신청부터 적용됩니다.';}catch{if(revision===authRevision)$('#sms-status').textContent='저장하지 못했습니다. 입력 내용은 유지됩니다.';}finally{button.disabled=false;}};
function updateNavigationOffset(){const bottom=document.querySelector('.site-nav').getBoundingClientRect().bottom;root.style.setProperty('--request-nav-bottom',Math.max(0,bottom)+8+'px');const box=root.getBoundingClientRect();const padding=parseFloat(getComputedStyle(root).paddingLeft);root.style.setProperty('--request-heading-left',box.left+padding+'px');root.style.setProperty('--request-heading-width',Math.max(0,root.clientWidth-padding*2)+'px');const height=$('.request-list-heading').getBoundingClientRect().height;if(height>0)root.style.setProperty('--request-list-heading-height',height+'px');}
new ResizeObserver(updateNavigationOffset).observe(document.querySelector('.site-nav'));window.addEventListener('resize',updateNavigationOffset);updateNavigationOffset();
new ResizeObserver(updateNavigationOffset).observe($('.request-list-heading'));
function view(which){root.classList.toggle('is-writing',which==='write');root.classList.toggle('is-listing',which==='list');$('#new-request').hidden=which!=='list'||adminRoute();updateNavigationOffset();for(const id of ['list','write','detail','unlock','edit'])$('#request-'+id).hidden=id!==which;root.querySelector('h1').focus();}
function updateAdminScreen(){
 priceManager?.sync();
 const admin=adminRoute();if(admin)$('#request-list').before(authBox);else root.append(authBox);root.classList.toggle('is-admin',admin);authBox.hidden=!admin;customerLink.hidden=!admin;
 if(admin&&$('#price-settings'))authBox.after($('#price-settings'));
 root.querySelector('h1').textContent=admin?'매입 신청 관리':'매입 신청';
 $('#admin-tools').hidden=!canManage();smsPanel.hidden=!canManage();
 $('#show-admin').hidden=admin;$('#admin-auth').hidden=!admin;
 $('#new-request').hidden=admin||$('#request-list').hidden;
 if(admin&&!isAdmin)for(const id of ['list','write','detail','unlock','edit'])$('#request-'+id).hidden=true;
}
function route(){if(priceManager&&!priceManager.guardRoute())return;const guideDialog=document.querySelector('dialog.purchase-dialog');if(guideDialog?.open)guideDialog.close();closeGuide();const open=location.hash.startsWith('#requests')||adminRoute();root.hidden=!open;originals.forEach(el=>{el.hidden=open;});
 $('#detail-content').replaceChildren();$('#edit-fields').replaceChildren();detailData=null;editingId=null;selectedId=null;trash=false;page=1;status('');
 if(!adminRoute()){smsPanel.open=false;$('#sms-form').reset();$('#sms-logs').replaceChildren();}
 if(open){view(location.hash==='#requests/new'?'write':'list');updateAdminScreen();if(location.hash!=='#requests/new')loadList();root.scrollIntoView();}}

// Approved purchase guidance: edit each method's intro, steps, prep and FAQ here.
const guideData={
  "visit": {
    "title": "직접 방문",
    "intro": "방문 일정과 주소를 먼저 확인한 뒤 제품을 직접 가져오는 방법입니다.",
    "steps": [
      "품목·수량·작동 상태를 알려 사전 상담합니다.",
      "방문 날짜·시간과 정확한 주소를 확인합니다.",
      "제품과 구성품을 전달하고 검수를 진행합니다.",
      "검수 결과와 최종 금액에 동의한 뒤 협의한 방식으로 정산합니다."
    ],
    "prep": [
      "제품·전원 어댑터 등 보유한 구성품을 함께 준비해 주세요.",
      "중요한 자료를 백업하고 저장장치 처리 요청을 미리 알려주세요.",
      "제품 목록과 신청 번호를 준비하면 접수 확인에 도움이 됩니다."
    ],
    "faq": [
      [
        "방문 전에 예약해야 하나요?",
        "제품 수령과 검수 가능 여부를 확인할 수 있도록 방문 전 날짜와 시간을 협의해 주세요."
      ],
      [
        "모델명이나 사양을 몰라도 되나요?",
        "제품 전체와 모델 라벨 사진을 준비해 상담해 주세요. 알고 계신 수량과 작동 상태도 함께 알려주세요."
      ],
      [
        "검수는 얼마나 걸리나요?",
        "품목·수량·작동 상태에 따라 달라집니다. 방문 전에 예상 소요 시간을 상담해 주세요."
      ],
      [
        "고장 난 제품은 어떻게 처리하나요?",
        "불량 여부를 사전에 알려주세요. 매입 가능 여부를 확인하고, 제외 제품의 반환 또는 처리 방법은 고객과 협의합니다."
      ],
      [
        "정산은 언제 되나요?",
        "검수 후 최종 금액을 확인하고 협의한 일정과 방식으로 정산합니다. 방문 즉시 지급 여부는 사전에 확인해 주세요."
      ]
    ]
  },
  "parcel": {
    "title": "택배 발송·수거",
    "intro": "직접 택배를 보내거나, 상담 후 택배기사 방문 수거 가능 여부를 확인하는 방법입니다. 신청서 제출만으로 수거가 예약되지는 않습니다.",
    "steps": [
      "품목·수량·상태를 알려 상담하고 전달 방법·배송지·비용을 확인합니다.",
      "제품별로 개별 보호 포장하고 박스 안의 빈 공간을 완충재로 채웁니다.",
      "직접 발송은 협의한 주소로 보내고, 방문 수거는 예약 확정 안내를 받은 뒤 준비합니다.",
      "입고 후 검수 결과와 최종 금액을 확인하고 협의한 방식으로 정산합니다."
    ],
    "prep": [
      "부품끼리 부딪히지 않도록 나누어 포장하고 박스가 움직이지 않게 고정해 주세요.",
      "신청 번호와 품목·수량 메모를 동봉해 주세요. 신청 번호가 없으면 담당자와 접수 확인 정보를 협의해 주세요.",
      "생년월일·주민등록번호·비밀번호를 적어 보내지 마세요.",
      "직접 발송 후 운송장 번호를 보관해 주세요."
    ],
    "faq": [
      [
        "어디로 보내면 되나요?",
        "발송 전 담당자에게 정확한 수령 주소와 수령 가능 여부를 확인해 주세요. 확인되지 않은 주소로 먼저 보내지 마세요."
      ],
      [
        "포장은 어떻게 하나요?",
        "제품을 개별 보호 포장하고 튼튼한 박스와 충분한 완충재를 사용해 주세요. 무겁거나 파손 위험이 큰 제품은 포장 방법을 먼저 상담해 주세요."
      ],
      [
        "배송비는 누가 부담하나요?",
        "품목·수량·지역과 운송 방법에 따라 조건을 협의합니다. 선불·착불 및 비용 부담을 발송 전에 확인해 주세요."
      ],
      [
        "택배기사 방문 수거도 가능한가요?",
        "주소·포장 상태·물량을 알려 가능 여부와 일정을 상담해 주세요. 담당자의 예약 확정 안내를 받아야 수거가 진행됩니다."
      ],
      [
        "입고 후 언제 정산되나요?",
        "제품 검수 후 최종 금액에 동의한 뒤 협의한 일정으로 정산합니다. 예상 검수 기간은 발송 전에 확인해 주세요."
      ],
      [
        "매입되지 않는 제품은 반송되나요?",
        "검수 결과를 안내한 뒤 반송 여부·비용 또는 다른 처리 방법을 협의합니다. 고객의 의사를 확인해 진행합니다."
      ]
    ]
  },
  "pickup": {
    "title": "출장 매입",
    "intro": "기업·사무실·PC방 등의 여러 장비나 운반이 어려운 제품은 현장 조건을 확인해 출장 가능 여부를 상담합니다.",
    "steps": [
      "품목·수량·지역·작동 상태와 현장 사진을 준비해 상담합니다.",
      "방문 가능 여부와 일정, 철거·운반 범위 및 비용을 협의합니다.",
      "현장에서 제품과 인수 목록을 확인하고 협의한 방식으로 인계·검수합니다.",
      "검수 결과와 최종 금액을 확인한 뒤 정산하고 협의한 거래 서류를 확인합니다."
    ],
    "prep": [
      "장비 목록 또는 전체 사진과 대략적인 수량을 준비해 주세요.",
      "주차·엘리베이터·층수·반출 동선과 현장 담당자를 확인해 주세요.",
      "회사 장비는 반출 승인과 저장장치 처리 방식을 먼저 정해 주세요.",
      "필요한 인수 내역·견적서 등 거래 서류를 상담 시 알려주세요."
    ],
    "faq": [
      [
        "소량도 출장 매입이 가능한가요?",
        "품목·수량·장비 가치와 현장 조건을 확인한 뒤 안내합니다. 최소 수량은 상담해 주세요."
      ],
      [
        "어느 지역까지 방문하나요?",
        "현장 지역과 주소를 알려주시면 방문 가능 여부를 확인해 안내합니다."
      ],
      [
        "출장비나 운송비가 있나요?",
        "거리·물량·반출 조건에 따라 사전에 협의합니다. 방문 확정 전에 비용 부담을 확인해 주세요."
      ],
      [
        "주말에도 방문할 수 있나요?",
        "희망 날짜와 시간을 알려주세요. 운영 일정과 현장 조건을 확인한 뒤 가능 여부를 안내합니다."
      ],
      [
        "철거와 운반도 해주나요?",
        "필요한 작업 범위를 사진과 함께 알려주세요. 가능한 작업과 추가 비용 여부를 사전에 협의합니다."
      ],
      [
        "기업 거래 서류를 받을 수 있나요?",
        "필요한 서류 종류를 상담 시 알려주세요. 발급 가능 여부와 시점, 거래 처리 방법을 확인해 안내합니다."
      ]
    ]
  },
  "quick": {
    "title": "카카오 T 퀵",
    "intro": "YESMOA와 수령 조건을 먼저 협의한 뒤 고객이 카카오 T 앱에서 퀵을 접수해 제품을 보내는 방법입니다.",
    "steps": [
      "제품 종류·크기·수량을 알려 수령 가능 여부·주소·시간·비용 부담을 확인합니다.",
      "제품을 개별 보호 포장하고 운송 중 움직이거나 충격받지 않도록 고정합니다.",
      "협의한 조건에 맞춰 고객이 카카오 T 앱에서 퀵을 접수합니다.",
      "도착 후 검수 결과와 최종 금액을 확인하고 협의한 방식으로 정산합니다."
    ],
    "prep": [
      "보낼 제품의 크기·무게·수량과 포장 상태를 확인해 주세요.",
      "담당자에게 확인한 수령 주소·연락처·시간을 준비해 주세요.",
      "신청 번호와 품목·수량 메모를 함께 보내 접수 건을 확인할 수 있게 해주세요.",
      "운송 수단과 서비스 이용 조건은 앱에서 확인하고 제품에 맞게 선택해 주세요."
    ],
    "faq": [
      [
        "어떻게 접수하나요?",
        "먼저 YESMOA와 발송 조건을 협의한 뒤 고객이 카카오 T 앱에서 접수합니다. 이 웹페이지에서는 예약이나 결제를 진행하지 않습니다."
      ],
      [
        "도착지는 무엇을 입력하나요?",
        "담당자에게 확인한 수령 주소와 수령 담당 연락처를 사용해 주세요. 발송 전에 다시 확인해 주세요."
      ],
      [
        "퀵 비용은 어떻게 결제하나요?",
        "고객과 YESMOA가 비용 부담을 먼저 협의하고, 앱에서 제공하는 결제 조건을 확인해 진행해 주세요. 무료 운송은 사전 확인 없이 적용되지 않습니다."
      ],
      [
        "어떤 제품을 보낼 수 있나요?",
        "제품 크기·무게·수량과 파손 위험을 알려 상담해 주세요. 선택한 운송 서비스의 취급 가능 조건도 확인해야 합니다."
      ],
      [
        "도착하면 바로 정산되나요?",
        "도착 후 검수를 거쳐 최종 금액에 동의한 뒤 협의한 일정으로 정산합니다. 즉시 또는 당일 정산 여부는 발송 전에 확인해 주세요."
      ]
    ]
  }
};
function closeGuide(){$('#close-request-guide').hidden=true;$('#request-guide-content').hidden=true;root.querySelectorAll('[data-guide]').forEach(b=>b.setAttribute('aria-expanded','false'));}
root.querySelectorAll('[data-guide]').forEach(button=>button.onclick=()=>{
 const wasOpen=button.getAttribute('aria-expanded')==='true';closeGuide();if(wasOpen)return;
 const data=guideData[button.dataset.guide],panel=$('#request-guide-content');
 panel.querySelector('h2').textContent=data.title;panel.querySelector('.guide-intro').textContent=data.intro;
 for(const [selector,items] of [['.guide-steps',data.steps],['.guide-preparation',data.prep]])panel.querySelector(selector).replaceChildren(...items.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
 panel.querySelector('.guide-faq').replaceChildren(...data.faq.map(([question,answer])=>{const details=document.createElement('details'),summary=document.createElement('summary'),p=document.createElement('p');summary.textContent='Q. '+question;p.textContent='A. '+answer;details.append(summary,p);return details;}));
 panel.hidden=false;$('#close-request-guide').hidden=false;button.setAttribute('aria-expanded','true');
});
$('#close-request-guide').onclick=closeGuide;
const link=document.createElement('a');link.href='#requests';link.textContent='매입 신청';document.querySelector('.nav-menu').append(link);
$('#new-request').onclick=()=>{status('');location.hash='requests/new';};root.querySelectorAll('.back-list').forEach(b=>b.onclick=()=>{returnToList();});
function friendly(error){if(/Submission limit|Please wait/.test(error?.message||''))return '잠시 후 다시 등록해주세요. 접수 시도 횟수가 제한되었습니다.';if(/Invalid input|Consent required|Invalid date/.test(error?.message||''))return '필수 입력값, 날짜, 동의 및 비밀번호를 확인해주세요.';if(/relation|column|function|schema cache|permission|row-level/i.test(error?.message||''))return '데이터베이스 설정이 아직 완료되지 않았습니다. 사이트 관리자에게 문의해주세요.';return '요청을 처리하지 못했습니다. 연결 상태를 확인하고 다시 시도해주세요.';}
async function loadList(){if(!client||(adminRoute()&&!isAdmin))return;if(loading){reloadPending=true;return;}loading=true;const revision=authRevision,management=canManage();$('#request-rows').replaceChildren();try{const {data,error}=await client.rpc(management?'yesmoa_admin_list':'yesmoa_list_requests',{p_search:search,p_page:page,...(management?{p_deleted:trash}:{})});if(revision!==authRevision||management!==canManage())return;if(error)throw error;total=Number(data?.total||0);for(const row of data?.rows||[]){const tr=document.createElement('tr');for(const val of [row.number,row.category,row.title,row.author_masked,new Date(row.created_at).toLocaleDateString('sv-SE'),row.views]){const td=document.createElement('td');td.textContent=val;tr.append(td);}const button=document.createElement('button');button.className='title-button';button.textContent=row.title;button.onclick=()=>loadDetail(row);tr.children[2].replaceChildren(button);if(canManage()){if(!trash){const edit=document.createElement('button');edit.textContent='수정';edit.onclick=()=>loadDetail(row,true);tr.children[2].append(document.createTextNode(' '),edit);}const action=document.createElement('button');action.textContent=trash?'복구':'삭제';action.onclick=()=>manageDelete(row.id,trash);tr.children[2].append(document.createTextNode(' '),action);}$('#request-rows').append(tr);}if(!total){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='등록된 매입 신청이 없습니다.';tr.append(td);$('#request-rows').append(tr);}$('#page-label').textContent=`${page} / ${Math.max(1,Math.ceil(total/10))}`;$('#previous').disabled=page===1;$('#next').disabled=page*10>=total;}catch(error){status(friendly(error));}finally{loading=false;if(reloadPending){reloadPending=false;loadList();}}}
$('#previous').onclick=()=>{page--;loadList();};$('#next').onclick=()=>{page++;loadList();};
function renderDetail(data){detailData=data;const out=$('#detail-content');out.replaceChildren();const dl=document.createElement('dl');for(const [name,label] of fields.filter(f=>!f[0].startsWith('password'))){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=data[name]||'미입력';dd.className='detail';dl.append(dt,dd);}out.append(dl);if(canManage()){const actions=document.createElement('div');actions.className='toolbar';const edit=document.createElement('button');edit.textContent='수정';edit.onclick=()=>startEdit(data);const remove=document.createElement('button');remove.textContent='삭제';remove.className='danger';remove.onclick=()=>manageDelete(selectedId,false);actions.append(edit,remove);out.append(actions);}view('detail');}
async function loadDetail(row,edit=false){selectedId=row.id;status('');if(row.deleted_at){status('삭제한 글은 복구한 뒤 조회해주세요.');return;}if(canManage()||(row.legacy&&user)){const revision=authRevision,hash=location.hash;try{const {data,error}=await client.rpc('yesmoa_request_detail',{p_id:row.id});if(revision!==authRevision||hash!==location.hash)return;if(error)throw error;if(data){renderDetail(data);if(edit&&canManage())startEdit(data);return;}}catch(error){status(friendly(error));return;}}$('#unlock-form').reset();$('#unlock-error').textContent='';$('#legacy-auth').hidden=!row.legacy;$('#unlock-form').hidden=!!row.legacy;view('unlock');if(!row.legacy)$('#unlock-password').focus();}
$('#unlock-form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('[type=submit]');if(b.disabled)return;b.disabled=true;const revision=authRevision,id=selectedId,hash=location.hash;try{const {data,error}=await client.rpc('yesmoa_password_detail',{p_id:selectedId,p_password:$('#unlock-password').value});if(revision!==authRevision||id!==selectedId||hash!==location.hash)return;if(error)throw error;const messages={incorrect:'비밀번호가 일치하지 않습니다.',locked:'확인 시도가 5회에 도달했습니다. 15분 후 다시 시도해주세요.',legacy:'기존 작성자 또는 관리자가 로그인해야 합니다.',unavailable:'조회할 수 없는 신청입니다.'};if(data?.error){$('#unlock-error').textContent=messages[data.error]||'내용을 확인할 수 없습니다.';return;}if(!data?.data)throw new Error('No data');e.target.reset();renderDetail(data.data);}catch(error){$('#unlock-error').textContent=friendly(error);}finally{b.disabled=false;}};
async function manageDelete(id,restore){if(!canManage()||mutationPending)return;if(!confirm(restore?'이 글을 복구할까요?':'이 신청을 삭제하시겠습니까? 삭제한 글은 관리자 화면에서 복구할 수 있습니다.'))return;mutationPending=true;try{const {data,error}=await client.rpc('yesmoa_admin_delete',{p_id:id,p_restore:restore});if(error)throw error;if(!data)throw new Error('No data');status(restore?'복구했습니다.':'신청을 삭제했습니다.');detailData=null;returnToList();}catch(error){status(friendly(error));}finally{mutationPending=false;}}
function startEdit(data){
 if(!canManage()||mutationPending)return;
 editingId=selectedId;$('#edit-fields').replaceChildren();status('');
 for(const [name,label,type,required] of fields.filter(f=>!f[0].startsWith('password'))){
  const original=$('#request-'+name);const input=original.cloneNode(true);
  input.id='edit-'+name;input.value=data[name]||'';input.required=required;
  input.removeAttribute('aria-describedby');input.removeAttribute('aria-invalid');
  const wrapper=document.createElement('div');if(name==='title'||name==='body'||name==='phone')wrapper.className='wide';
  const lab=document.createElement('label');lab.htmlFor=input.id;lab.textContent=label+(required?' *':'');wrapper.append(lab,input);$('#edit-fields').append(wrapper);if(name==='title'){input.hidden=false;titlePicker(input,data[name]||'');}
 }
 view('edit');$('#edit-title-choice').focus();
}
$('#edit-cancel').onclick=()=>{if(canManage()&&!mutationPending&&detailData)renderDetail(detailData);};
$('#edit-form').onsubmit=async e=>{
 e.preventDefault();if(!canManage()||mutationPending||!editingId)return;
 const form=e.target;if(!form.elements.title.value.trim()){status('문의 제목을 선택하거나 직접 입력해주세요.');$('#edit-title-choice').focus();return;}if(!form.reportValidity())return;
 const payload={};for(const [name]of fields.filter(f=>!f[0].startsWith('password'))){const input=form.elements[name];payload[name]=input.value.trim()||null;if(input.required&&!payload[name]){status('필수 항목을 입력해주세요.');input.focus();return;}}
 mutationPending=true;const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
 const id=editingId;const revision=authRevision;
 try{
  const {data,error}=await client.rpc('yesmoa_admin_update',{p_id:id,p_data:payload});
  if(error)throw error;if(!data)throw new Error('No saved request');
  if(revision!==authRevision||!canManage())return;
  detailData={...detailData,...payload};renderDetail(detailData);status('신청 내용을 수정했습니다.');loadList();
 }catch(error){status(friendly(error)+' 입력 내용은 유지됩니다.');}
 finally{mutationPending=false;buttons.forEach(b=>b.disabled=false);}
};
$('#toggle-trash').onclick=()=>{trash=!trash;page=1;$('#toggle-trash').textContent=trash?'전체 신청 보기':'삭제한 글 보기';loadList();};
$('#show-admin').onclick=()=>{$('#admin-auth').hidden=!$('#admin-auth').hidden;$('#show-admin').setAttribute('aria-expanded',String(!$('#admin-auth').hidden));};
$('#legacy-login').onclick=()=>{location.hash='admin';};
$('#login-form').onsubmit=async e=>{e.preventDefault();if(!client)return;const b=e.target.querySelector('button');b.disabled=true;try{const url=new URL(location.href);url.hash='';const {error}=await client.auth.signInWithOtp({email:$('#login-email').value.trim(),options:{emailRedirectTo:url.href}});if(error)throw error;status('로그인 링크를 이메일로 보냈습니다. 메일의 링크를 열어주세요.');}catch(error){status(friendly(error));}finally{b.disabled=false;}};
$('#logout').onclick=async()=>{const {error}=await client.auth.signOut();if(error){status('로그아웃에 실패했습니다. 다시 시도해주세요.');return;}$('.request-form').reset();$('#detail-content').replaceChildren();view('list');trash=false;page=1;updateAdminScreen();loadList();status('로그아웃했습니다.');};
$('.request-form').onsubmit=async e=>{e.preventDefault();const form=e.target;let valid=true;for(const input of form.elements){if(!input.name)continue;const ok=input.checkValidity()&&(!input.required||input.type==='checkbox'||input.value.trim().length>0);input.setAttribute('aria-invalid',String(!ok));$('#'+input.name+'-error').textContent=ok?'':(input.name==='consent'?'개인정보 수집·이용에 동의해주세요.':'올바른 값을 입력해주세요.');if(!ok&&valid){(input.hidden?$('#request-title-choice'):input).focus();valid=false;}}const pass=form.elements.password,check=form.elements.password_confirm;if(pass.value.length<4){$('#password-error').textContent='비밀번호를 4자 이상 입력해주세요.';pass.setAttribute('aria-invalid','true');valid=false;}if(pass.value!==check.value){$('#password_confirm-error').textContent='비밀번호가 일치하지 않습니다.';check.setAttribute('aria-invalid','true');valid=false;}if(new TextEncoder().encode(pass.value).length>72){$('#password-error').textContent='비밀번호는 UTF-8 기준 72바이트 이하로 입력해주세요.';valid=false;}if(!valid)return;if(!client){status('접수 기능을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');return;}const b=$('#request-submit');if(b.disabled)return;b.disabled=true;const payload={};for(const [name]of fields)payload[name]=form.elements[name].value.trim()||null;payload.password=form.elements.password.value;delete payload.password_confirm;payload.consent=true;try{const {data,error}=await client.rpc('yesmoa_submit_request',{p_data:payload});if(error)throw error;if(!data)throw new Error('No saved request');form.reset();status('매입 신청이 정상적으로 접수되었습니다.');page=1;search='';completion.showModal();}catch(error){status(friendly(error)+' 입력 내용은 유지됩니다.');}finally{b.disabled=false;}};
async function init(){for(const prefix of ['#requests','#admin'])if(location.hash.startsWith(prefix+'#'))history.replaceState(null,'',location.pathname+location.search+location.hash.slice(prefix.length));const returningFromEmail=location.hash.includes('access_token=')||location.search.includes('code=');if(!window.supabase){status('로그인 기능을 불러오지 못했습니다. 새로고침해주세요.');return;}client=window.supabase.createClient('https://rkjifgvzmetzdnawehnt.supabase.co','sb_publishable_Z_M0Q7RhYEVTTsEdaW1wnw_4qP5adyy',{auth:{persistSession:true,detectSessionInUrl:true}});priceManager=window.YESMOA_PRICES.mount(root,{client,canManage});function account(session){
 const revision=++authRevision;
 user=session?.user||null;isAdmin=false;trash=false;
 $('#account').textContent=user?'로그인 완료 · 관리자 권한 확인 중 · '+user.email:'로그인되지 않았습니다. 이메일의 로그인 링크를 열어주세요.';
 $('#login-form').hidden=!!user;$('#logout').hidden=!user;
 $('#show-admin').textContent=user?'관리자 권한 확인 중':'관리자 로그인';
 $('#admin-tools').hidden=true;smsPanel.hidden=true;smsPanel.open=false;$('#sms-form').reset();$('#sms-logs').replaceChildren();$('#sms-mode').textContent='';$('#sms-status').textContent='';$('#toggle-trash').textContent='삭제한 글 보기';
 $('#detail-content').replaceChildren();detailData=null;editingId=null;
 if(location.hash.startsWith('#requests')||adminRoute()){view(location.hash==='#requests/new'?'write':'list');updateAdminScreen();}
 if(!user){loadList();return;}
 $('#admin-auth').hidden=false;
 // Supabase auth callbacks must return before starting another auth-backed RPC.
 setTimeout(async()=>{
  const {data,error}=await client.rpc('yesmoa_is_admin');
  if(revision!==authRevision)return;
  isAdmin=!error&&data===true;
  $('#account').textContent=(error?'관리자 권한 확인 실패 · ':isAdmin?'관리자 로그인 완료 · ':'일반 계정 로그인 완료 · ')+user.email;
  $('#show-admin').textContent=isAdmin?'관리자 로그인 완료':'로그인 계정 보기';
  if(returningFromEmail&&isAdmin)location.hash='admin';if(adminRoute()&&isAdmin)view('list');updateAdminScreen();page=1;
  if(error)status('관리자 권한을 확인하지 못했습니다. 새로고침 후 다시 확인해주세요.');
  else if(adminRoute())status(isAdmin?'관리자로 로그인했습니다. 신청을 수정하거나 삭제할 수 있습니다.':'이 계정에는 관리자 권한이 없습니다. 로그아웃한 뒤 관리자 계정으로 로그인해주세요.');
  loadList();
 },0);
}client.auth.onAuthStateChange((event,session)=>{if(event==='TOKEN_REFRESHED'&&session?.user?.id===user?.id)return;account(session);if(returningFromEmail&&session?.user)location.hash='admin';});const {data,error}=await client.auth.getSession();if(error)status('로그인 상태를 확인하지 못했습니다.');account(data?.session);if(returningFromEmail&&user){$('#admin-auth').hidden=false;location.hash="admin";}route();}
window.addEventListener('hashchange',route);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&(location.hash==='#requests'||adminRoute()))loadList();});window.addEventListener('pageshow',e=>{if(e.persisted&&(location.hash==='#requests'||adminRoute()))loadList();});init();
})();




