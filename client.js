const socket = io(SERVER_URL, { transports: ['websocket'], withCredentials: false });
let you = { id:null, name:null, role:null, alive:true };
let state = { phase:'LOBBY', players:[], projectProgress:0, sabotage:null, hostId:null };

const $ = (id)=>document.getElementById(id);
const nameInput = $('nameInput');
$('setNameBtn').onclick = ()=> socket.emit('setName', nameInput.value);
$('readyBtn').onclick = ()=> socket.emit('ready', true);
$('startBtn').onclick = ()=> socket.emit('hostStart');
$('advanceBtn').onclick = ()=> socket.emit('advancePhase');

socket.on('you', (me)=>{
  you = me;
  $('you').textContent = `나: ${you.name || '-'} / 역할: ${you.role || '-'} / ${you.alive?'생존':'사망'}`;
  document.querySelectorAll('.mafia-only').forEach(el=>{
    el.style.display = (you.role==='mafia' && you.alive) ? 'block' : 'none';
  });
  document.querySelectorAll('.host-only').forEach(el=>{
    el.style.display = (you.id && you.id===state.hostId) ? 'inline-block' : 'none';
  });
});

socket.on('investigationResult', ({targetName, mafia})=>{
  $('investResult').textContent = `조사 결과: ${targetName}는 ${mafia?'마피아':'마피아 아님'}`;
});

socket.on('state', (s)=>{
  state = s;
  $('phase').textContent = s.phase;
  $('dayCount').textContent = s.dayCount || 0;
  $('progress').value = s.projectProgress;
  $('progressText').textContent = `${s.projectProgress}%`;
  $('sabotageBox').classList.toggle('hidden', !(s.sabotage && s.phase==='SABOTAGE'));
  if (s.sabotage && s.phase==='SABOTAGE') {
    $('sabGoal').textContent = s.sabotage.goal;
    $('sabProg').textContent = s.sabotage.progress;
    updateSabTimer(s.sabotage.deadline);
  }
  const ul = $('playerList');
  ul.innerHTML = '';
  s.players.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${p.name}</span><span>${p.alive?'🟢':'🔴'}</span>`;
    if (!p.alive) li.classList.add('dead');
    ul.appendChild(li);
  });
  const ll = $('logList');
  ll.innerHTML = '';
  (s.logs||[]).forEach(x=>{
    const li = document.createElement('li');
    li.textContent = x;
    ll.appendChild(li);
  });
  document.querySelectorAll('.host-only').forEach(el=>{
    el.style.display = (you.id && you.id===s.hostId) ? 'inline-block' : 'none';
  });
  showPhaseAreas(s.phase);
  refreshSelects(s.players);
});

function showPhaseAreas(phase) {
  const areas = ['lobbyArea','sprintArea','sabotageArea','nightArea','meetingArea'];
  areas.forEach(id => $(id).classList.add('hidden'));
  if (phase==='LOBBY') $('lobbyArea').classList.remove('hidden');
  if (phase==='SPRINT') $('sprintArea').classList.remove('hidden');
  if (phase==='SABOTAGE') $('sabotageArea').classList.remove('hidden');
  if (phase==='NIGHT') $('nightArea').classList.remove('hidden');
  if (phase==='MEETING') $('meetingArea').classList.remove('hidden');
}

function refreshSelects(players) {
  const alive = players.filter(p=>p.alive);
  fillSelect('killTarget', alive);
  fillSelect('protectTarget', alive);
  fillSelect('investTarget', alive);
  fillSelect('voteTarget', alive, true);
}

function fillSelect(id, players, allowSkip=false) {
  const sel = $(id);
  if (!sel) return;
  sel.innerHTML='';
  if (allowSkip) {
    const opt = document.createElement('option');
    opt.value=''; opt.text='(건너뛰기)';
    sel.appendChild(opt);
  }
  players.forEach(p=>{
    const o = document.createElement('option');
    o.value = p.id;
    o.text = p.name;
    sel.appendChild(o);
  });
}

// Sprint tasks
$('reqTaskBtn').onclick = ()=> socket.emit('requestTask');
socket.on('task', (t)=>{
  const box = $('taskBox');
  box.classList.remove('hidden');
  $('taskPrompt').textContent = t.prompt;
  const area = $('taskChoices');
  area.innerHTML='';
  t.choices.forEach((c,i)=>{
    const btn = document.createElement('button');
    btn.textContent = c;
    btn.onclick = ()=> socket.emit('submitTask', { id: t.id, answerIndex:i });
    area.appendChild(btn);
  });
});
socket.on('taskResult', ({correct, progress})=>{
  alert(correct ? '정답! 진행률이 올랐습니다.' : '오답!');
});

// Sabotage
$('sabotageBtn').onclick = ()=> socket.emit('triggerSabotage');
$('sabTrue').onclick = ()=> socket.emit('sabotageAnswer', {correct: true});
$('sabFalse').onclick = ()=> socket.emit('sabotageAnswer', {correct: false});

function updateSabTimer(deadline) {
  function tick() {
    const remain = Math.max(0, Math.floor((deadline - Date.now())/1000));
    const el = document.getElementById('sabTimer');
    if (el) el.textContent = remain;
    if (remain<=0) return;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Night actions
$('killBtn').onclick = ()=> socket.emit('nightKill', $('killTarget').value);
$('protectBtn').onclick = ()=> socket.emit('nightProtect', $('protectTarget').value);
$('investBtn').onclick = ()=> socket.emit('nightInvestigate', $('investTarget').value);

// Voting
$('voteBtn').onclick = ()=> socket.emit('vote', $('voteTarget').value || null);

// UX niceties
document.addEventListener('DOMContentLoaded', ()=>{
  const rnd = 'Dev' + Math.floor(Math.random()*1000);
  nameInput.value = rnd;
});