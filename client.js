/* global SERVER_URL, io */
const SERVER = (typeof SERVER_URL !== 'undefined') ? SERVER_URL : location.origin;
const socket  = io(SERVER, { transports:['websocket'], withCredentials:false });

const DEFAULT_AVATAR='https://mblogthumb-phinf.pstatic.net/20140606_111/sjinwon2_1402052862659ofnU1_PNG/130917_224626.png?type=w420';
const $=id=>document.getElementById(id);

let you  ={ id:null, name:null, role:null, alive:true, spectator:false, avatar:DEFAULT_AVATAR };
let state={ phase:'LOBBY', hostId:null, players:[], projectProgress:0, phaseEndsAt:null, dayCount:0,
            sabotage:{active:false, endsAt:null, need:3, progress:0} };

const QUIZ_SET=[
  {q:'단골이 없는 사업자는?', a:'장의사'},
  {q:'단칸방을 얻기 위해 이사를 다니는 사람은?', a:'이사도라 덩컨'},
  {q:'담배가 목장에 간 이유는?', a:'말보로'},
  {q:'대포가 많은 해수욕장은?', a:'다대포'},
];

// -------- 암전 --------
function forceHideBlackout(){
  const o=$('blackout'); if(o) o.classList.add('hidden');
  document.querySelectorAll('.blackout').forEach(n=>{
    n.classList.add('hidden'); n.style.setProperty('display','none','important');
  });
}
function blackout(msg, ms=1000){
  const o=$('blackout'), t=$('blackoutText'); if(!o||!t) return;
  t.innerHTML=msg||''; o.classList.remove('hidden');
  const closer=()=>{ forceHideBlackout(); o.removeEventListener('click',closer); document.removeEventListener('keydown',esc); };
  const esc=(e)=>{ if(e.key==='Escape') closer(); };
  o.addEventListener('click',closer); document.addEventListener('keydown',esc);
  setTimeout(closer, ms); setTimeout(forceHideBlackout, ms+1500);
}

// -------- 로비/아바타 --------
function setLobbyVisible(vis){
  document.querySelectorAll('.lobby-only').forEach(el=> el.style.display = vis ? '' : 'none');
  ['nameInput','setNameBtn','avatarInput','setAvatarBtn','spectateBtn','joinBtn'].forEach(id=>{
    const el=$(id); if(!el) return; el.disabled=!vis; el.style.opacity= vis?'1':'0.6';
  });
}
function renderAvatarGrid(){
  const grid=$('avatarPanel'); if(!grid) return;
  grid.querySelectorAll('img[data-avatar]').forEach(img=>{
    img.classList.toggle('active', (you.avatar||DEFAULT_AVATAR)===img.src);
    img.onclick=()=> socket.emit('setAvatar', img.src);
  });
}
function toggleAvatarPanelByPhase(){
  const tg=$('avatarToggle'), pn=$('avatarPanel'); if(!pn) return;
  const isLobby = state.phase==='LOBBY';
  if (tg) tg.style.display = isLobby ? '' : 'none';
  if (!isLobby){ pn.style.display='none'; pn.dataset.collapsed='1'; }
}

// -------- 호스트 툴 --------
function setHostOnlyVisible(){
  const isHost = (you?.id && state?.hostId && you.id===state.hostId);
  document.querySelectorAll('.host-only').forEach(el=> el.style.display = isHost ? '' : 'none');
}
function bindHostTools(){
  $('applyRolesBtn').onclick=()=>{
    const mafia = parseInt(($('mafiaCount')?.value||'0'),10);
    const doctor= parseInt(($('doctorCount')?.value||'0'),10);
    const police= parseInt(($('policeCount')?.value||'0'),10);
    socket.emit('setRoleConfig',{mafia,doctor,police});
  };
  $('btnStartGame').onclick = ()=> socket.emit('hostStart');
  $('btnEndGame').onclick   = ()=> socket.emit('hostEndGame');
  $('btnResetLobby').onclick= ()=> socket.emit('hostResetLobby');
  $('revealBtn').onclick    = ()=> socket.emit('toggleReveal');
  $('btnSabo').onclick      = ()=> socket.emit('hostSabotage');
}

// -------- 코딩 미션 --------
$('reqTaskBtn')?.addEventListener('click', ()=> socket.emit('requestTask'));
socket.on('task', t=>{
  $('taskPrompt') && ($('taskPrompt').textContent = t.prompt);
  const area=$('taskChoices'); if(area){
    area.innerHTML='';
    t.choices.forEach((c,i)=>{
      const b=document.createElement('button'); b.textContent=c;
      b.onclick=()=> socket.emit('submitTask',{id:t.id,answerIndex:i});
      area.appendChild(b);
    });
  }
});
socket.on('taskResult',({correct,delta})=>{
  alert(correct?`정답! 프로젝트 +${delta}%`:`오답!`);
});

// -------- 밤 UX(행동 + 넌센스) --------
let nightTargets=null;
socket.on('nightTargets', payload=>{ nightTargets=payload; });

function showQuiz(title='꿈속의 넌센스'){
  const item = QUIZ_SET[Math.floor(Math.random()*QUIZ_SET.length)];
  const qa = $('quizArea'); if(!qa) return;
  qa.classList.remove('hidden');
  $('quizTitle').textContent = title;
  $('quizQ').textContent = item.q;
  $('quizMsg').textContent = '정답을 입력해 보세요!';
  $('quizA').value='';
  $('quizSubmit').onclick=()=>{
    const v=$('quizA').value.trim();
    $('quizMsg').textContent = (v===item.a)?'정답!':'땡!';
  };
}
function hideQuiz(){ $('quizArea')?.classList.add('hidden'); }

function showNightActions(role){
  const box=$('nightActions'); if(!box) return;
  box.classList.remove('hidden');
  const info=$('nightInfo'), ctr=$('nightControls'); ctr.innerHTML='';
  if (role==='mafia'){ info.textContent='죽일 사람을 선택하시오'; addTargetSelect(ctr,'kill'); }
  else if (role==='doctor'){ info.textContent='살릴 사람을 선택하시오'; addTargetSelect(ctr,'protect'); }
  else if (role==='police'){ info.textContent='조사할 사람을 선택하시오'; addTargetSelect(ctr,'invest'); }
  else { info.textContent='시민은 비밀 행동이 없습니다.'; }
}
function hideNightActions(){ $('nightActions')?.classList.add('hidden'); }
function addTargetSelect(container, kind){
  let options=[];
  if (nightTargets && nightTargets[kind]) options = nightTargets[kind];
  else options = (state.players||[]).filter(p=>p.alive && !p.spectator && p.id!==you.id).map(p=>({id:p.id,name:p.name}));
  const sel=document.createElement('select'); sel.id='nightTarget';
  options.forEach(p=>{ const o=document.createElement('option'); o.value=p.id; o.text=p.name; sel.appendChild(o); });
  const btn=document.createElement('button'); btn.textContent='확정';
  btn.onclick=()=>{
    const tid=sel.value;
    if(kind==='kill') socket.emit('nightKill',tid);
    if(kind==='protect') socket.emit('nightProtect',tid);
    if(kind==='invest') socket.emit('nightInvestigate',tid);
  };
  container.appendChild(sel); container.appendChild(btn);
}
socket.on('nightAck', payload=>{
  if(!payload||!payload.kind) return;
  const name=payload.targetName||'(알 수 없음)';
  let msg='';
  if(payload.kind==='kill') msg=`당신은 ${name}을(를) 죽이고자 합니다.`;
  if(payload.kind==='protect') msg=(payload.self?'당신은 자신의 목숨이 다른 사람보다 중요하군요':`당신은 ${name}을(를) 살리고자 합니다.`);
  if(payload.kind==='invest') msg=`당신은 ${name}을(를) 조사하고자 합니다.`;
  alert(msg);
  const title=(you.role==='mafia'?'마피아의 꿈': you.role==='doctor'?'의사의 꿈': you.role==='police'?'경찰의 꿈':'당신은 꿈속입니다');
  showQuiz(title);
});

// -------- 투표/채팅 --------
$('voteBtn')?.addEventListener('click', ()=> socket.emit('vote', $('voteTarget')?.value || null));
function sendChat(){ const i=$('chatInput'); const v=(i?.value||'').trim(); if(!v) return; socket.emit('chat', v); i.value=''; }
$('chatSend')?.addEventListener('click', sendChat);
$('chatInput')?.addEventListener('keydown', e=>{ if(e.key==='Enter') sendChat(); });

// -------- 소켓 수신 --------
socket.on('you', me=>{
  you=me;
  $('you').textContent = `나: ${you.name||'-'} / 역할: ${you.role || (you.spectator?'관전자':'-')} / ${you.alive?'생존':'사망'}`;
  setHostOnlyVisible(); renderAvatarGrid();
});

socket.on('chat', line=>{
  const box=$('chatLog'); const div=document.createElement('div'); div.className='chat-line'; div.textContent=line;
  box.appendChild(div); box.scrollTop=box.scrollHeight;
});

socket.on('reveal', ({name,isMafia})=> blackout(`${name}은(는) ${isMafia?'마피아가 맞았습니다.':'마피아가 아니었습니다.'}`, 1200));

socket.on('logs', lines=>{
  const ll=$('logList'); ll.innerHTML=''; lines.forEach(x=>{ const li=document.createElement('li'); li.textContent=x; ll.appendChild(li); });
});

socket.on('state', s=>{
  const prev = state.phase;
  state = s;

  // 상단 바
  $('projBar').style.width = (s.projectProgress||0)+'%';
  $('projText').textContent = (s.projectProgress||0)+'%';
  $('phaseLabel').textContent = s.phase;

  if (s.phaseEndsAt){
    const total = (s.phase==='SPRINT'?90000 : s.phase==='NIGHT'?45000 : s.phase==='MEETING'?60000 : 0);
    const end   = s.phaseEndsAt;
    const tick=()=>{
      const now=Date.now();
      const left=Math.max(0, Math.floor((end-now)/1000));
      $('phaseTime').textContent = left+'s';
      const pct= total ? Math.max(0,Math.min(100,(1-(end-now)/total)*100)) : 0;
      $('phaseBar').style.width = pct+'%';
      if (left>0 && state.phase===s.phase) requestAnimationFrame(tick);
    }; requestAnimationFrame(tick);
  } else {
    $('phaseTime').textContent='--s'; $('phaseBar').style.width='0%';
  }

  // 화면 전환 연출
  if (prev!==s.phase){
    if (s.phase==='SPRINT' && prev==='LOBBY') blackout(`당신은 <b>${you.role||'-'}</b> 입니다`, 1200);
    else if (s.phase==='NIGHT') blackout('밤이 되었습니다', 900);
    else if (s.phase==='SPRINT' && prev==='MEETING') blackout('날이 밝았습니다', 900);
    setTimeout(()=>forceHideBlackout(), 350);
  }

  // 로비/아바타
  setLobbyVisible(s.phase==='LOBBY');
  toggleAvatarPanelByPhase();

  // 플레이어 리스트
  const ul=$('playerList'); ul.innerHTML='';
  (s.players||[]).forEach(p=>{
    const li=document.createElement('li');
    const img=document.createElement('img'); img.className='player-avatar'; img.src=p.avatar||DEFAULT_AVATAR;
    const name=document.createElement('span'); name.textContent=(p.id===s.hostId?'👑 ':'')+p.name+(p.spectator?' (관전)':'');
    const dot=document.createElement('span'); dot.textContent=p.alive?'🟢':'🔴';
    if(!p.alive){ name.classList.add('dead'); li.classList.add('dead'); }
    li.appendChild(img); li.appendChild(name); li.appendChild(dot); ul.appendChild(li);
  });

  // 투표 대상
  const alive=(s.players||[]).filter(p=>p.alive && !p.spectator);
  const sel=$('voteTarget'); sel.innerHTML=''; const skip=document.createElement('option'); skip.value=''; skip.text='(건너뛰기)'; sel.appendChild(skip);
  alive.forEach(p=>{ const o=document.createElement('option'); o.value=p.id; o.text=p.name; sel.appendChild(o); });

  // 낮 레이아웃 강조
  const isDay=s.phase==='SPRINT';
  $('missionCard').style.opacity = isDay?'1':'0.5';
  $('chatCard').style.opacity    = isDay?'1':'0.85';

  // 밤 UX
  if (s.phase==='NIGHT'){
    if (you.role==='mafia'||you.role==='doctor'||you.role==='police'){ showNightActions(you.role); showQuiz('꿈속의 넌센스'); }
    else { hideNightActions(); showQuiz('당신은 꿈속입니다'); }
  } else { hideNightActions(); hideQuiz(); }

  // 회의 영역 토글
  $('meetingArea').classList.toggle('hidden', s.phase!=='MEETING');

  // 사보타주 UI
  const sb=$('sabo');
  if (s.sabotage?.active){
    sb.classList.remove('hidden');
    $('saboNeed').textContent = s.sabotage.need;
    $('saboProg').textContent = s.sabotage.progress;
    const end=s.sabotage.endsAt;
    const tick=()=>{
      const left=Math.max(0, Math.floor((end-Date.now())/1000));
      $('saboTime').textContent = left+'s';
      if (left>0 && state.sabotage?.active) requestAnimationFrame(tick);
    }; requestAnimationFrame(tick);
  } else {
    sb.classList.add('hidden');
    $('saboTime').textContent='--';
  }

  setHostOnlyVisible();
});

socket.on('connect', ()=>{
  // 기본 닉네임 채워두기
  const nameInput=$('nameInput'); if(nameInput && !nameInput.value) nameInput.value='Dev'+Math.floor(Math.random()*1000);
});

// -------- 초기 바인딩 --------
document.addEventListener('DOMContentLoaded', ()=>{
  // 프로필
  $('setNameBtn').onclick = ()=> socket.emit('setName', ($('nameInput')?.value||'').trim());
  $('setAvatarBtn').onclick= ()=> socket.emit('setAvatar', ($('avatarInput')?.value||DEFAULT_AVATAR).trim());
  $('spectateBtn').onclick = ()=> socket.emit('setSpectator', true);
  $('joinBtn').onclick     = ()=> socket.emit('setSpectator', false);

  // 호스트 선점
  $('claimHostBtn') && ($('claimHostBtn').onclick=()=> socket.emit('claimHost'));

  // 아바타 접기/펼치기
  const tg=$('avatarToggle'), pn=$('avatarPanel');
  if (tg && pn){
    pn.dataset.collapsed='1'; pn.style.display='none';
    tg.onclick=()=>{ const c=pn.dataset.collapsed==='1'; pn.dataset.collapsed=c?'0':'1'; pn.style.display=c?'':'none'; };
  }

  // 호스트 툴
  bindHostTools();

  // 사보타주 fix
  $('saboFixBtn').onclick = ()=> socket.emit('fixSabotage');

  setLobbyVisible(true); forceHideBlackout();
});
