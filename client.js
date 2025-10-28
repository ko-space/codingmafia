const DEFAULT_AVATAR = 'https://mblogthumb-phinf.pstatic.net/20140606_111/sjinwon2_1402052862659ofnU1_PNG/130917_224626.png?type=w420';

// 제공된 갤러리 이미지 목록
const AVATARS = [
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

const socket = io(SERVER_URL, { transports: ['websocket'], withCredentials: false });
let you = { id:null, name:null, role:null, alive:true, spectator:false, avatar:DEFAULT_AVATAR };
let state = { phase:'LOBBY', players:[], projectProgress:0, sabotage:null, hostId:null, phaseEndsAt:null };

const $ = (id)=>document.getElementById(id);

// Controls
$('setNameBtn').onclick   = ()=> socket.emit('setName', ( $('nameInput').value || '' ).trim());
$('setAvatarBtn').onclick = ()=> socket.emit('setAvatar', ( $('avatarInput').value || DEFAULT_AVATAR ).trim());
$('spectateBtn').onclick  = ()=> socket.emit('setSpectator', true);
$('joinBtn').onclick      = ()=> socket.emit('setSpectator', false);

// Host-only controls
$('applyRolesBtn').onclick = ()=>{
  const mafia  = parseInt($('mafiaCount').value||'0',10);
  const doctor = parseInt($('doctorCount').value||'0',10);
  const police = parseInt($('policeCount').value||'0',10);
  socket.emit('setRoleConfig', { mafia, doctor, police });
};
$('revealBtn').onclick  = ()=> socket.emit('toggleReveal');
$('startBtn').onclick   = ()=> socket.emit('hostStart');
$('advanceBtn').onclick = ()=> socket.emit('advancePhase');

// Avatar gallery render
function renderAvatarGrid(selectedUrl){
  const grid = $('avatarGrid');
  grid.innerHTML = '';
  AVATARS.forEach(url => {
    const btn = document.createElement('button');
    btn.className = 'avatar-btn' + (selectedUrl===url?' active':'');
    btn.onclick = ()=> {
      socket.emit('setAvatar', url);
    };
    const img = document.createElement('img');
    img.className = 'avatar-img';
    img.src = url;
    btn.appendChild(img);
    grid.appendChild(btn);
  });
}

// Sprint tasks
$('reqTaskBtn')?.addEventListener('click', ()=> socket.emit('requestTask'));
socket.on('task', (t)=>{
  const box = $('taskBox'); box.classList.remove('hidden');
  $('taskPrompt').textContent = t.prompt;
  const area = $('taskChoices'); area.innerHTML='';
  t.choices.forEach((c,i)=>{
    const btn=document.createElement('button'); btn.textContent=c;
    btn.onclick=()=> socket.emit('submitTask', { id: t.id, answerIndex:i });
    area.appendChild(btn);
  });
});
socket.on('taskResult', ({correct})=> alert(correct ? '정답! 진행률이 올랐습니다.' : '오답!'));

// Sabotage
$('sabotageBtn')?.addEventListener('click', ()=> socket.emit('triggerSabotage'));
$('sabTrue')?.addEventListener('click', ()=> socket.emit('sabotageAnswer', {correct:true}));
$('sabFalse')?.addEventListener('click', ()=> socket.emit('sabotageAnswer', {correct:false}));

function updateSabTimer(deadline) {
  function tick(){
    const remain = Math.max(0, Math.floor((deadline - Date.now())/1000));
    const el = document.getElementById('sabTimer'); if (el) el.textContent = remain;
    if (remain<=0) return; requestAnimationFrame(tick);
  } requestAnimationFrame(tick);
}

// Night actions
$('killBtn')?.addEventListener('click', ()=> socket.emit('nightKill', $('killTarget').value));
$('protectBtn')?.addEventListener('click', ()=> socket.emit('nightProtect', $('protectTarget').value));
$('investBtn')?.addEventListener('click', ()=> socket.emit('nightInvestigate', $('investTarget').value));

// Voting
$('voteBtn')?.addEventListener('click', ()=> socket.emit('vote', $('voteTarget').value || null));

// Socket events
socket.on('you', (me)=>{
  you = me;
  $('you').textContent = `나: ${you.name || '-'} / 역할: ${you.role || (you.spectator?'관전자':'-')} / ${you.alive?'생존':'사망'}`;
  document.querySelectorAll('.mafia-only').forEach(el=>{
    el.style.display = (you.role==='mafia' && you.alive && !you.spectator) ? 'block' : 'none';
  });
  document.querySelectorAll('.host-only').forEach(el=>{
    el.style.display = (you.id && you.id===state.hostId) ? 'inline-flex' : 'none';
  });
  renderAvatarGrid(you.avatar || DEFAULT_AVATAR);
});

socket.on('investigationResult', ({targetName, mafia})=>{
  document.getElementById('investResult').textContent = `조사 결과: ${targetName}는 ${mafia?'마피아':'마피아 아님'}`;
});

socket.on('state', (s)=>{
  state = s;
  $('phase').textContent = s.phase;
  $('dayCount').textContent = s.dayCount || 0;
  $('progress').value = s.projectProgress;
  $('progressText').textContent = `${s.projectProgress}%`;

  if (s.phaseEndsAt) {
    const loop = ()=> {
      const left = Math.max(0, Math.floor((s.phaseEndsAt - Date.now())/1000));
      $('phase').title = `남은 시간: ${left}s`;
      if (left>0 && state.phase===s.phase) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } else {
    $('phase').removeAttribute('title');
  }

  // Players
  const ul = $('playerList'); ul.innerHTML = '';
  s.players.forEach(p=>{
    const li = document.createElement('li');
    const img = document.createElement('img'); img.className='player-avatar'; img.src = p.avatar || DEFAULT_AVATAR;
    const name = document.createElement('span'); name.textContent = `${p.name}${p.spectator?' (관전)':''}`;
    const status = document.createElement('span'); status.textContent = p.alive?'🟢':'🔴';
    if (!p.alive) { name.classList.add('dead'); li.classList.add('dead'); }
    li.appendChild(img); li.appendChild(name); li.appendChild(status);
    ul.appendChild(li);
  });

  // Logs
  const ll = $('logList'); ll.innerHTML='';
  (s.logs||[]).forEach(x=>{ const li=document.createElement('li'); li.textContent=x; ll.appendChild(li); });

  // Phase areas
  ['lobbyArea','sprintArea','sabotageArea','nightArea','meetingArea']
    .forEach(id => document.getElementById(id).classList.add('hidden'));
  if (s.phase==='LOBBY') $('lobbyArea').classList.remove('hidden');
  if (s.phase==='SPRINT') $('sprintArea').classList.remove('hidden');
  if (s.phase==='SABOTAGE') $('sabotageArea').classList.remove('hidden');
  if (s.phase==='NIGHT') $('nightArea').classList.remove('hidden');
  if (s.phase==='MEETING') $('meetingArea').classList.remove('hidden');

  // Night selects & vote
  const alive = s.players.filter(p=>p.alive && !p.spectator);
  fillSelect('killTarget', alive);
  fillSelect('protectTarget', alive);
  fillSelect('investTarget', alive);
  fillSelect('voteTarget', alive, true);

  // sabotage box
  document.querySelector('#sabotageBox').classList.toggle('hidden', !(s.sabotage && s.phase==='SABOTAGE'));
  if (s.sabotage && s.phase==='SABOTAGE') {
    document.getElementById('sabGoal').textContent = s.sabotage.goal;
    document.getElementById('sabProg').textContent = s.sabotage.progress;
    updateSabTimer(s.sabotage.deadline);
  }

  // host-only visibility
  document.querySelectorAll('.host-only').forEach(el=>{
    el.style.display = (you.id && you.id===s.hostId) ? 'inline-flex' : 'none';
  });
});

function fillSelect(id, players, allowSkip=false) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML='';
  if (allowSkip) {
    const opt = document.createElement('option');
    opt.value=''; opt.text='(건너뛰기)';
    sel.appendChild(opt);
  }
  players.forEach(p=>{
    const o=document.createElement('option'); o.value=p.id; o.text=p.name; sel.appendChild(o);
  });
}

// defaults
document.addEventListener('DOMContentLoaded', ()=>{
  $('nameInput').value = 'Dev' + Math.floor(Math.random()*1000);
  renderAvatarGrid(DEFAULT_AVATAR);
});
