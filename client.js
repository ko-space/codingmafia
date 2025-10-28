// client.js — v1-plus + 암전 개선 + 호스트 선점 버튼 + 👑표시
const DEFAULT_AVATAR='https://mblogthumb-phinf.pstatic.net/20140606_111/sjinwon2_1402052862659ofnU1_PNG/130917_224626.png?type=w420';
const AVATARS=[
 "https://i.namu.wiki/i/hk1opVBuLjBA64wX9pGcbyW-8L99lDXDgyL-YLOOZvl_-aE3n1nRGN-oIYBoh7t7915XOu2fQxyWk9gv8hhd53D9EwclIyg3DCRP160SKr05uj-3-hVIHq13pzz_m9Kxn8xTduKXQTNS9fAAaX7oOA.webp",
 "https://i.namu.wiki/i/Y4tU_Lf9vV-L820w8Uuw8yV2NWj9ZZVby-ULpqoKHeV9gKe5KNjH7tsVNN_TN_fW-GY-FjRJCYcEGwqySf0BZy9MgzppV34lIk0PQsY-1UUT_bJzrR9P3bX522chs5zujXZ2Tuh7kgiXDYgcw6zxsQ.webp",
 "https://i.namu.wiki/i/PKYXMElsHDi62fTJM-7rEruQeRH-yg3f2h-el-xbcyak7WGBfYTVfod9krWiHfAXQdS9xrt3W0NaECFzABEkqF9XeZCSgknU4F-SJ2MUwLZ3Q3uoKVJrCWkpa6m4K1Z_WspFIoHkAizv9NhY1O1XhQ.webp",
 "https://i.namu.wiki/i/NouUq0_qdco8xmZa17U3EhTckFtAmO1wezmubjnx4dZIvBDpt9I0o_CbdZykHGH6AAh3y9PeZfROQg9JVXVMxzHUELJv3yeHue8U00Re4EpImuwVE-eaLfbJDp552fAr7XY1u6hHwWcU9D7bf7Z0YA.webp",
 "https://i.namu.wiki/i/SQy8g2B_58w4CBQnb1Kq-Iygr4X-ygCDi3ocl5rK20lcIzL52kVoyndLl8UNXceDezJgCdevsTVpL8CW02IIGOYP3bkuK6aMx3BUOrRG5lVIu4xXUZUW5rtZ7oKxwQEJLbQrHVB-GT35p1ygwx_OjA.webp",
 "https://i.namu.wiki/i/KD6Ek_aT38WhP-LMOMcseeavstGUJWugtL9t5-3NtN6chdOG97Ni2R_JiD_2ArXo28nGD2pvHUzcMZ06-aAVf3-eURSVtaRKvXS8JtkiPdvQCdwfIuCNHM5LQZlmW6tTVyxSJj-y0CXXOkmfIE7Jvw.webp",
 "https://i.namu.wiki/i/UDBmratqX1QWSPXwotJzf2ZzXz6f1H27F0PynbWcBKiDpuJl1uav_bl7HYXJsW4gfi4D7OZiDT_adGfH1R9-gipBcjuR6mMujtKI-wHLr-0p4euqOAinT7B8GMfNGIBTbol0LiZamulTASINsHb6_w.webp",
 "https://i.namu.wiki/i/8rZ0AIVH2-XtrbBRuwKWnDDOJpeSsDAW49Aabkno-kTRNJUPSED-bCvpWJTPJAIPpYoC6CxSC1TVodRF4YwmdW-HphBoNIKn-w33QLNMmUUBFvezJMr4u0a7JIhr3oOPIl-vXysf-EkZR8dTKfjT5g.webp",
 "https://i.namu.wiki/i/mjubMlATS5p48Blg6MC6AqBrCKmqhSszlpi5-Ks6YT7ul05JKI50jj56f1ZCo3yDDHlhsdEmGVXoQQhiYR2g24vBiXOpV6zDqH96ozFi8PCdhMX620AEvU32KFjS8_hN1WahWnhednJ-suxxztsN8g.webp",
 "https://i.namu.wiki/i/dLlFCM7Jl8tEJXzi2NqUnehd2tYSW1ZiSoqT0WMYvGIDYGcz0rqFDCLTv42IRx5Mnmx03dSC1oHVY5LmctrNFUbJLlrpJygssmV2IItkJAhascnLyU2xPhdmisA17suWWLnGWdPvSCKW5Z4v4bcSJg.webp",
 "https://i.namu.wiki/i/oXWbKionO1Fpa-lWlIiHuZhzZw4ye5Zc33FaPIdvgNZHgb28JC5EsCZsaFmwQdF9ibFck8y3DOugCw0dE_8B6E7NcTw2bLR9Wqe8a0VGmTcSpXw5kC6Br4bIBXnMd90WoVFiPRzNqFkA1xilTaG7kA.webp",
 "https://i.namu.wiki/i/ads5Cvq-WnCWlOk9SpcqxbY2mH4gZREAzNYUZajZz9YI2dqrOj3hjS4PYW-rtavF3vf_Tq1OTaNKPoijwhOYWwlksaTktAnFUFM_4IcUtdI4w0_VJKqwtbN5CDBTmvIZ2gp5mcFR_-_XrK4nc5TPGA.webp",
 "https://i.namu.wiki/i/bXMt9kYSsYnqamgFcBxFjlsBQrCWq7r9lqbNWiMNfTreBYAhMSOQxn81DH4PNa30mWOwddsgbkyuHFqBDBsvivCb9fDhT96iuOHNnGUlnLU4ugyPter65annej50lIkcS2nJKTnuMx4MjjDD7FVOZg.webp"
];

const QUIZ_SET=[
  {q:'단골이 없는 사업자는?', a:'장의사'},
  {q:'단칸방을 얻기 위해 이사를 다니는 사람은?', a:'이사도라 덩컨'},
  {q:'담배가 목장에 간 이유는?', a:'말보로'},
  {q:'대포가 많은 해수욕장은?', a:'다대포'}
];

const socket = io(SERVER_URL,{transports:['websocket'],withCredentials:false});
let you={id:null,name:null,role:null,alive:true,spectator:false,avatar:DEFAULT_AVATAR};
let state={phase:'LOBBY',players:[],projectProgress:0,hostId:null,phaseEndsAt:null,dayCount:0,logs:[],nightTargets:null};

const $=id=>document.getElementById(id);

// ----- blackout 개선 -----
function forceHideBlackout(){
  const o = $('blackout');
  if (o) o.classList.add('hidden');
}
function blackout(msg, ms=1000){
  const o = $('blackout');
  const t = $('blackoutText');
  t.innerHTML = msg;
  o.classList.remove('hidden');

  const closer = () => { o.classList.add('hidden'); o.removeEventListener('click', closer); document.removeEventListener('keydown', esc); };
  const esc = (e)=>{ if(e.key==='Escape') closer(); };

  o.addEventListener('click', closer);
  document.addEventListener('keydown', esc);

  setTimeout(closer, ms);
  setTimeout(forceHideBlackout, Math.max(ms, 2500));
}

// ----- UI 토글 -----
function setLobbyVisible(vis){
  document.querySelectorAll('.lobby-only').forEach(el=> el.style.display= vis?'':'none');
  $('lobby').style.display = vis? '' : 'none';
}
function setHostOnlyVisible(){
  const isHost = (you.id && you.id === state.hostId);
  document.querySelectorAll('.host-only').forEach(el => {
    el.style.display = isHost ? '' : 'none';
  });
  // 호스트 공석이면 '호스트 되기' 버튼 노출
  const claim = $('claimHostBtn');
  if (claim) claim.style.display = (!state.hostId ? '' : 'none');
}
function renderAvatarGrid(selected){
  const grid=$('avatarGrid'); grid.innerHTML='';
  AVATARS.forEach(url=>{
    const btn=document.createElement('button');
    btn.className='avatar-btn'+(selected===url?' active':'');
    const img=document.createElement('img'); img.className='avatar-img'; img.src=url;
    btn.onclick=()=> socket.emit('setAvatar', url);
    btn.appendChild(img); grid.appendChild(btn);
  });
}

// ----- Chat -----
function sendChat(){
  const v=($('chatInput').value||'').trim();
  if(!v) return;
  socket.emit('chat', v);
  $('chatInput').value='';
}

// ----- Tasks -----
$('reqTaskBtn').onclick=()=> socket.emit('requestTask');
socket.on('task',t=>{
  $('taskPrompt').textContent=t.prompt;
  const area=$('taskChoices'); area.innerHTML='';
  t.choices.forEach((c,i)=>{
    const b=document.createElement('button'); b.textContent=c;
    b.onclick=()=> socket.emit('submitTask',{id:t.id,answerIndex:i});
    area.appendChild(b);
  });
});
socket.on('taskResult',({correct,delta})=>{
  alert(correct?`정답! 프로젝트 +${delta}%`:`오답!`);
});

// ----- Night: quiz & actions -----
function showQuiz(title='꿈속의 넌센스'){
  const item=QUIZ_SET[Math.floor(Math.random()*QUIZ_SET.length)];
  $('quizArea').classList.remove('hidden');
  $('quizTitle').textContent=title;
  $('quizQ').textContent=item.q;
  $('quizMsg').textContent='정답을 입력해 보세요!';
  $('quizA').value='';
  $('quizSubmit').onclick=()=>{
    const ans=($('quizA').value||'').trim();
    $('quizMsg').textContent = (ans===item.a) ? '정답!' : '땡!';
  };
}
function hideQuiz(){ $('quizArea').classList.add('hidden'); }

let lastNightTargets=null;
socket.on('nightTargets', payload=>{
  lastNightTargets = payload; // { kill:[], protect:[], invest:[] } 일부만 올 수도 있음
});
function showNightActions(role){
  const box=$('nightActions'); box.classList.remove('hidden');
  const info=$('nightInfo'), ctr=$('nightControls'); ctr.innerHTML='';
  if(role==='mafia'){ info.textContent='죽일 사람을 선택하시오'; addTargetSelect(ctr,'kill'); }
  else if(role==='doctor'){ info.textContent='살릴 사람을 선택하시오'; addTargetSelect(ctr,'protect'); }
  else if(role==='police'){ info.textContent='조사할 사람을 선택하시오'; addTargetSelect(ctr,'invest'); }
  else{ info.textContent='시민은 비밀 행동이 없습니다.'; }
}
function hideNightActions(){ $('nightActions').classList.add('hidden'); }
function addTargetSelect(container,kind){
  let options=[];
  if (lastNightTargets && lastNightTargets[kind]){
    options = lastNightTargets[kind];
  } else {
    options = state.players.filter(p=>p.alive && !p.spectator && p.id!==you.id).map(p=>({id:p.id,name:p.name}));
  }
  const sel=document.createElement('select'); sel.id='nightTarget';
  options.forEach(p=>{ const o=document.createElement('option'); o.value=p.id; o.text=p.name; sel.appendChild(o); });
  const btn=document.createElement('button'); btn.textContent='확정';
  btn.onclick=()=>{
    const targetId=sel.value;
    if(kind==='kill') socket.emit('nightKill',targetId);
    if(kind==='protect') socket.emit('nightProtect',targetId);
    if(kind==='invest') socket.emit('nightInvestigate',targetId);
  };
  container.appendChild(sel); container.appendChild(btn);
}

socket.on('nightAck', payload=>{
  if(!payload||!payload.kind) return;
  const name = payload.targetName || '(알 수 없음)';
  let msg='';
  if(payload.kind==='kill') msg=`당신은 ${name}을(를) 죽이고자 합니다.`;
  if(payload.kind==='protect') msg=(payload.self? '당신은 자신의 목숨이 다른 사람보다 중요하군요' : `당신은 ${name}을(를) 살리고자 합니다.`);
  if(payload.kind==='invest') msg=`당신은 ${name}을(를) 조사하고자 합니다.`;
  alert(msg);
  // 선택 후엔 넌센스로 복귀
  showQuiz('꿈속의 넌센스');
});

// 투표
$('voteBtn').onclick=()=> socket.emit('vote', $('voteTarget').value || null);

// 프로필/로비 버튼
$('setNameBtn').onclick=()=> socket.emit('setName',($('nameInput').value||'').trim());
$('setAvatarBtn').onclick=()=> socket.emit('setAvatar',($('avatarInput').value||DEFAULT_AVATAR).trim());
$('spectateBtn').onclick=()=> socket.emit('setSpectator',true);
$('joinBtn').onclick=()=> socket.emit('setSpectator',false);
$('applyRolesBtn').onclick=()=>{
  const mafia=parseInt($('mafiaCount').value||'0',10);
  const doctor=parseInt($('doctorCount').value||'0',10);
  const police=parseInt($('policeCount').value||'0',10);
  socket.emit('setRoleConfig',{mafia,doctor,police});
};
$('revealBtn').onclick=()=> socket.emit('toggleReveal');
$('startBtn').onclick=()=> socket.emit('hostStart');

// 소켓 핸들러
socket.on('you',me=>{
  you=me;
  $('you').textContent = `나: ${you.name||'-'} / 역할: ${you.role|| (you.spectator?'관전자':'-')} / ${you.alive?'생존':'사망'}`;
  setHostOnlyVisible();
  if(state.phase==='LOBBY'){ renderAvatarGrid(you.avatar||DEFAULT_AVATAR); }
});
socket.on('chat', line=>{
  const box=$('chatLog');
  const div=document.createElement('div'); div.className='chat-line'; div.textContent=line;
  box.appendChild(div); box.scrollTop=box.scrollHeight;
});
socket.on('reveal', ({name,isMafia})=>{
  blackout(`${name}은(는) ${isMafia?'마피아가 맞았습니다.':'마피아가 아니었습니다.'}`, 1200);
});

socket.on('state', s=>{
  const prevPhase=state.phase;
  state=s;

  // Bars
  $('projBar').style.width = (s.projectProgress||0) + '%';
  $('projText').textContent = (s.projectProgress||0) + '%';
  $('phaseLabel').textContent = s.phase;

  // Phase timer progress
  if (s.phaseEndsAt) {
    const total = (s.phase=== 'SPRINT'?90000 : s.phase==='NIGHT'?45000 : s.phase==='MEETING'?60000:0);
    const tick = ()=>{
      const left = Math.max(0, Math.floor((s.phaseEndsAt - Date.now())/1000));
      $('phaseTime').textContent = left + 's';
      const remainMs = Math.max(0, s.phaseEndsAt - Date.now());
      const pct = total ? Math.max(0, Math.min(100, (1 - remainMs/total)*100)) : 0;
      $('phaseBar').style.width = pct + '%';
      if (left>0 && state.phase===s.phase) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } else {
    $('phaseTime').textContent='--s';
    $('phaseBar').style.width='0%';
  }

  // Lobby-only
  setLobbyVisible(s.phase==='LOBBY');

  // 전환 오버레이
  if (prevPhase!==s.phase){
    if (s.phase==='SPRINT' && prevPhase==='LOBBY'){
      blackout(`당신은 <b>${you.role||'-'}</b> 입니다`,900);
    } else if (s.phase==='NIGHT'){
      blackout('밤이 되었습니다',800);
    } else if (s.phase==='SPRINT' && prevPhase==='MEETING'){
      blackout('날이 밝았습니다',800);
    }
  }
  if (s.phase!=='LOBBY'){ setTimeout(()=>forceHideBlackout(), 1000); }

  // Players
  const ul=$('playerList'); ul.innerHTML='';
  s.players.forEach(p=>{
    const li=document.createElement('li');
    const img=document.createElement('img'); img.className='player-avatar'; img.src=p.avatar||DEFAULT_AVATAR;
    const name=document.createElement('span'); 
    const isHost = (p.id === s.hostId);
    name.textContent=(isHost?'👑 ':'') + p.name + (p.spectator?' (관전)':'');
    const status=document.createElement('span'); status.textContent=p.alive?'🟢':'🔴';
    if(!p.alive){ name.classList.add('dead'); li.classList.add('dead'); }
    li.appendChild(img); li.appendChild(name); li.appendChild(status); ul.appendChild(li);
  });

  // Meeting select
  const alive = s.players.filter(p=>p.alive && !p.spectator);
  const sel=$('voteTarget'); sel.innerHTML='';
  const skip=document.createElement('option'); skip.value=''; skip.text='(건너뛰기)'; sel.appendChild(skip);
  alive.forEach(p=>{ const o=document.createElement('option'); o.value=p.id; o.text=p.name; sel.appendChild(o); });

  // Night UX
  if (s.phase==='NIGHT'){
    if (you.role==='mafia' || you.role==='doctor' || you.role==='police'){
      showNightActions(you.role);
      showQuiz('꿈속의 넌센스');
    } else {
      hideNightActions();
      showQuiz('당신은 꿈속입니다');
    }
  } else {
    hideNightActions(); hideQuiz();
  }

  document.getElementById('meetingArea').classList.toggle('hidden', s.phase!=='MEETING');

  // 호스트 UI 토글
  setHostOnlyVisible();
});

// Logs
socket.on('logs', lines=>{
  const ll=$('logList'); ll.innerHTML='';
  lines.forEach(x=>{ const li=document.createElement('li'); li.textContent=x; ll.appendChild(li); });
});

// 초기화
document.addEventListener('DOMContentLoaded',()=>{
  $('nameInput').value='Dev'+Math.floor(Math.random()*1000);
  renderAvatarGrid(DEFAULT_AVATAR);
  setLobbyVisible(true);
  forceHideBlackout();

  // chat enter
  $('chatSend').onclick=sendChat;
  $('chatInput').addEventListener('keydown',e=>{ if(e.key==='Enter') sendChat(); });

  // '호스트 되기' 버튼 생성
  const claimBtn = document.createElement('button');
  claimBtn.id = 'claimHostBtn';
  claimBtn.textContent = '호스트 되기';
  claimBtn.style.display = 'none';
  claimBtn.onclick = () => socket.emit('claimHost');
  document.getElementById('lobby').appendChild(claimBtn);
});
