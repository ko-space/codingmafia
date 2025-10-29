// server.js — v1 모든 요소 + 호스트툴 + 사보타주 완전판
// 설치: npm i express socket.io cors
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors({ origin: true }));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });

const PORT = process.env.PORT || 10000;

const DEFAULT_AVATAR =
  'https://mblogthumb-phinf.pstatic.net/20140606_111/sjinwon2_1402052862659ofnU1_PNG/130917_224626.png?type=w420';

const PHASES = { LOBBY:'LOBBY', SPRINT:'SPRINT', NIGHT:'NIGHT', MEETING:'MEETING', END:'END' };
const PHASE_LENGTH = { SPRINT: 90_000, NIGHT: 45_000, MEETING: 60_000 };

const game = {
  phase: PHASES.LOBBY,
  players: {},   // id -> {id,name,role,alive,spectator,avatar,_actedNight,votedFor}
  order: [],
  hostId: null,
  dayCount: 0,
  projectProgress: 0,
  logs: [],
  config: { revealOnEject:false, roles:{ mafia:3, doctor:2, police:2 } },
  votes: {},
  night: { kills:null, protects:new Set(), investigations:[] },
  timers: { handle:null, endsAt:null },
  tasks: {},     // playerId -> {id, answer, delta}
  sabotage: { active:false, endsAt:null, need:3, fixedBy:new Set() }
};

// ----------------- helpers -----------------
function broadcast(){
  const publicPlayers = Object.values(game.players).map(p=>({
    id:p.id, name:p.name, alive:p.alive, spectator:!!p.spectator, avatar:p.avatar||DEFAULT_AVATAR
  }));
  io.emit('state',{
    phase: game.phase,
    players: publicPlayers,
    projectProgress: game.projectProgress,
    dayCount: game.dayCount,
    hostId: game.hostId,
    logs: game.logs.slice(-14),
    phaseEndsAt: game.timers.endsAt,
    sabotage: {
      active: game.sabotage.active,
      endsAt: game.sabotage.endsAt,
      need: game.sabotage.need,
      progress: game.sabotage.fixedBy.size
    }
  });
  io.emit('logs', game.logs.slice(-14));
}
function personal(sock){
  const p = game.players[sock.id]; if(!p) return;
  sock.emit('you',{ id:p.id, name:p.name, role:p.role, alive:p.alive, spectator:!!p.spectator, avatar:p.avatar||DEFAULT_AVATAR });
}
function clearTimer(){ if(game.timers.handle) clearTimeout(game.timers.handle); game.timers.handle=null; game.timers.endsAt=null; }
function startTimer(){
  clearTimer();
  const len = PHASE_LENGTH[game.phase]; if(!len) return;
  game.timers.endsAt = Date.now()+len;
  game.timers.handle = setTimeout(()=> nextPhase(true), len);
}
function ensureHost(){
  if (!game.hostId){
    const next = game.order.find(id => !!game.players[id]);
    if (next){ game.hostId = next; game.logs.push(`${game.players[next].name} 님이 호스트가 되었습니다.`); }
  }
}
function increaseProgress(delta, why){
  const before = game.projectProgress;
  game.projectProgress = Math.max(0, Math.min(100, game.projectProgress + delta));
  game.logs.push(`📈 프로젝트 ${delta>=0?'+':''}${delta}% (${why}) → ${before}%→${game.projectProgress}%`);
  if (game.projectProgress >= 100){
    game.phase = PHASES.END;
    game.logs.push('🎉 프로젝트 100% 달성! 시민팀 승리');
  }
}
function winCheck(){
  const alive = Object.values(game.players).filter(p=>p.alive && !p.spectator);
  const m = alive.filter(p=>p.role==='mafia').length;
  const nonM = alive.length - m;
  if (m===0){ game.phase=PHASES.END; game.logs.push('시민팀 승리! 모든 마피아 제거.'); return true; }
  if (alive.length>0 && m>=nonM){ game.phase=PHASES.END; game.logs.push('마피아 승리! 수적 우위 달성.'); return true; }
  return false;
}
function assignRoles(){
  const ids = game.order.filter(id=>{ const p=game.players[id]; return p && !p.spectator; });
  for(let i=ids.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [ids[i],ids[j]]=[ids[j],ids[i]]; }
  const cnt = {...game.config.roles};
  ids.forEach(id=>{
    const p=game.players[id]; if(!p) return;
    if (cnt.mafia--  > 0) p.role='mafia';
    else if (cnt.doctor-- > 0) p.role='doctor';
    else if (cnt.police-- > 0) p.role='police';
    else p.role='citizen';
    p.alive=true; p._actedNight=false; p.votedFor=null;
  });
}

// ----------------- tasks (coding) -----------------
const BANK=[
  {p:'다음 중 JS에서 배열 길이를 구하는 코드는?', c:['arr.count()','len(arr)','arr.length','size(arr)'], a:2, d:5},
  {p:'HTTP 상태 200의 의미는?', c:['Not Found','OK','Redirect','Server Error'], a:1, d:4},
  {p:'CSS로 글자색을 빨강으로 지정하는 올바른 코드는?', c:['color: #ff0000;','font-color: red;','text-color: red;','fg: red;'], a:0, d:3},
  {p:'Git에서 변경사항을 스테이징하는 명령은?', c:['git push','git add','git fetch','git log'], a:1, d:4},
  {p:'const x = 1; x = 2; 의 결과는?', c:['x는 2가 된다','에러가 난다','암묵적 형변환','경고만 뜬다'], a:1, d:4},
];

// ----------------- sabotage -----------------
function triggerSabotage(byHost=false){
  if (game.phase!==PHASES.SPRINT || game.sabotage.active) return;
  game.sabotage.active = true;
  game.sabotage.endsAt = Date.now()+30_000;
  game.sabotage.need = 3;
  game.sabotage.fixedBy = new Set();
  game.logs.push(`🚨 긴급 이슈 발생! ${byHost?'(호스트 트리거) ':''}30초 내 'fix' 3명이 해결 필요`);
  setTimeout(()=> resolveSabotage(), 30_000);
  broadcast();
}
function resolveSabotage(){
  if (!game.sabotage.active) return;
  const success = game.sabotage.fixedBy.size >= game.sabotage.need;
  if (success){
    increaseProgress(+3, '사보타주 해결');
    game.logs.push('✅ 긴급 이슈 해결!');
  } else {
    increaseProgress(-5, '사보타주 미해결');
    game.logs.push('❌ 긴급 이슈 미해결(프로젝트 -5%)');
  }
  game.sabotage.active=false; game.sabotage.endsAt=null;
  broadcast();
}

// ----------------- phase flow -----------------
function startGame(){
  assignRoles();
  game.phase = PHASES.SPRINT;
  game.dayCount = 1;
  game.projectProgress = 0;
  game.logs = ['게임 시작!','Day 1 - 스프린트 시작.'];
  if (Math.random()<0.25) triggerSabotage(false); // 가끔 자동
  startTimer(); broadcast();
}
function emitNightTargets(){
  for (const [id,p] of Object.entries(game.players)){
    if (!p.alive || p.spectator) continue;
    const s = io.sockets.sockets.get(id); if(!s) continue;
    if (p.role==='mafia'){
      const list = Object.values(game.players)
        .filter(x=>x.alive && !x.spectator && x.id!==id && x.role!=='mafia')
        .map(x=>({id:x.id,name:x.name}));
      s.emit('nightTargets',{ kill:list });
    } else if (p.role==='doctor'){
      const list = Object.values(game.players)
        .filter(x=>x.alive && !x.spectator)
        .map(x=>({id:x.id,name:x.name}));
      s.emit('nightTargets',{ protect:list });
    } else if (p.role==='police'){
      const list = Object.values(game.players)
        .filter(x=>x.alive && !x.spectator && x.id!==id)
        .map(x=>({id:x.id,name:x.name}));
      s.emit('nightTargets',{ invest:list });
    }
  }
}
function resolveNight(){
  const k = game.night.kills;
  const prot = game.night.protects;
  if (k && !prot.has(k) && game.players[k]){
    game.players[k].alive=false;
    game.logs.push(`${game.players[k].name}이(가) 밤에 제거되었습니다.`);
  } else if (k){
    game.logs.push(`${game.players[k].name}은(는) 의사에 의해 보호되었습니다.`);
    increaseProgress(+2,'의사 보호 성공');
  }
}
function resolveVote(){
  let max=0, target=null, tie=false;
  for (const [pid,cnt] of Object.entries(game.votes)){
    if (cnt>max){ max=cnt; target=pid; tie=false; }
    else if (cnt===max){ tie=true; }
  }
  if (!tie && target && game.players[target] && game.players[target].alive){
    const isM = game.players[target].role==='mafia';
    const nm  = game.players[target].name;
    game.players[target].alive=false;
    game.logs.push(`투표로 ${nm} 추방!${game.config.revealOnEject?` (역할:${game.players[target].role})`:''}`);
    if (isM) increaseProgress(+10, '마피아 추방 성공');
    return { name:nm, isMafia:isM };
  }
  game.logs.push('동률/표부족으로 추방 없음.');
  return null;
}
function nextPhase(fromTimer=false){
  if (winCheck()){ clearTimer(); return broadcast(); }
  switch (game.phase){
    case PHASES.SPRINT:
      game.phase = PHASES.NIGHT;
      game.night = { kills:null, protects:new Set(), investigations:[] };
      game.sabotage.active=false; game.sabotage.endsAt=null; // 밤엔 종료
      game.logs.push('밤이 되었습니다.');
      emitNightTargets();
      break;
    case PHASES.NIGHT:
      resolveNight();
      if (winCheck()) return broadcast();
      game.phase = PHASES.MEETING;
      game.logs.push('회의/투표 시간.');
      game.votes = {};
      Object.values(game.players).forEach(p=> p._actedNight=false);
      break;
    case PHASES.MEETING:
      const rev = resolveVote();
      if (rev) io.emit('reveal', rev);
      if (winCheck()) return broadcast();
      game.dayCount += 1;
      game.phase = PHASES.SPRINT;
      game.logs.push(`Day ${game.dayCount} - 스프린트 재개.`);
      if (Math.random()<0.25) triggerSabotage(false);
      break;
  }
  if (!fromTimer) startTimer();
  broadcast();
}

function hardEnd(reason='호스트 강제 종료'){
  clearTimer(); game.phase=PHASES.END; game.logs.push(`🛑 ${reason}`); broadcast();
}
function resetLobby(reason='호스트가 로비로 복귀시켰습니다.'){
  clearTimer();
  for (const p of Object.values(game.players)){ p.role=null; p.alive=true; p.votedFor=null; p._actedNight=false; }
  game.phase=PHASES.LOBBY; game.dayCount=0; game.projectProgress=0;
  game.votes={}; game.night={kills:null,protects:new Set(),investigations:[]}; game.tasks={};
  game.sabotage={active:false, endsAt:null, need:3, fixedBy:new Set()};
  game.logs.push(`↩️ ${reason}`); broadcast();
}

// ----------------- sockets -----------------
io.on('connection', socket=>{
  const name = 'Player'+Math.floor(Math.random()*900+100);
  game.players[socket.id] = { id:socket.id, name, role:null, alive:true, spectator:false, avatar:DEFAULT_AVATAR, _actedNight:false, votedFor:null };
  game.order.push(socket.id);
  game.logs.push(`${name} 입장.`);

  ensureHost(); personal(socket); broadcast();

  // Profile
  socket.on('setName',v=>{ const p=game.players[socket.id]; if(!p) return; p.name=String(v||'').trim().slice(0,20); broadcast(); });
  socket.on('setAvatar',url=>{ const p=game.players[socket.id]; if(!p) return; p.avatar=/^https?:\/\//i.test(url)?url:DEFAULT_AVATAR; broadcast(); });
  socket.on('setSpectator',f=>{ const p=game.players[socket.id]; if(!p) return; p.spectator=!!f; broadcast(); });

  // Chat
  socket.on('chat',txt=>{ const p=game.players[socket.id]; if(!p) return; io.emit('chat', `${p.name}: ${String(txt||'').slice(0,200)}`); });

  // Host tools
  socket.on('setRoleConfig',({mafia,doctor,police})=>{
    if (socket.id!==game.hostId) return;
    game.config.roles = {
      mafia: Math.max(0,Math.min(10,parseInt(mafia||0))),
      doctor: Math.max(0,Math.min(10,parseInt(doctor||0))),
      police: Math.max(0,Math.min(10,parseInt(police||0)))
    };
    game.logs.push(`역할 설정: 마피아${game.config.roles.mafia}/의사${game.config.roles.doctor}/경찰${game.config.roles.police}`);
    broadcast();
  });
  socket.on('toggleReveal',()=>{ if(socket.id!==game.hostId) return; game.config.revealOnEject=!game.config.revealOnEject; game.logs.push(`추방 시 역할 공개: ${game.config.revealOnEject?'ON':'OFF'}`); broadcast(); });
  socket.on('hostStart',()=>{ if(socket.id!==game.hostId) return; startGame(); });
  socket.on('hostEndGame',()=>{ if(socket.id!==game.hostId) return; hardEnd(); });
  socket.on('hostResetLobby',()=>{ if(socket.id!==game.hostId) return; resetLobby(); });
  socket.on('claimHost',()=>{ if(!game.hostId){ game.hostId=socket.id; game.logs.push(`${game.players[socket.id].name} 님이 호스트를 선점했습니다.`); broadcast(); }});
  socket.on('transferHost', id=>{ if(socket.id!==game.hostId) return; if(game.players[id]){ game.hostId=id; game.logs.push('호스트 양도 완료.'); broadcast(); }});
  socket.on('hostSabotage',()=>{ if(socket.id!==game.hostId) return; triggerSabotage(true); });

  // Tasks
  socket.on('requestTask',()=>{
    if (game.phase!==PHASES.SPRINT) return;
    const t=BANK[Math.floor(Math.random()*BANK.length)];
    const id='t'+Date.now();
    game.tasks[socket.id]={id,answer:t.a,delta:t.d};
    socket.emit('task',{id, prompt:t.p, choices:t.c});
  });
  socket.on('submitTask',({id,answerIndex})=>{
    const t=game.tasks[socket.id]; if(!t || t.id!==id) return;
    const ok = Number(answerIndex)===t.answer;
    if (ok) increaseProgress(t.delta,'코딩 미션');
    socket.emit('taskResult',{correct:ok, delta: ok?t.delta:0});
    delete game.tasks[socket.id]; broadcast();
  });

  // Sabotage fix
  socket.on('fixSabotage', ()=>{
    if (!game.sabotage.active) return;
    const p = game.players[socket.id]; if(!p || p.spectator || !p.alive) return;
    game.sabotage.fixedBy.add(socket.id);
    if (game.sabotage.fixedBy.size >= game.sabotage.need) resolveSabotage();
    broadcast();
  });

  // Night actions
  function once(p){ if(p._actedNight) return false; p._actedNight=true; return true; }
  socket.on('nightKill',tid=>{
    const p=game.players[socket.id]; if(!p||!p.alive||p.spectator||game.phase!==PHASES.NIGHT||p.role!=='mafia'||!once(p)) return;
    const t=game.players[tid]; if(!t||!t.alive||t.spectator||t.role==='mafia') return;
    game.night.kills=tid; io.to(socket.id).emit('nightAck',{kind:'kill',targetName:t.name});
  });
  socket.on('nightProtect',tid=>{
    const p=game.players[socket.id]; if(!p||!p.alive||p.spectator||game.phase!==PHASES.NIGHT||p.role!=='doctor'||!once(p)) return;
    const t=game.players[tid]; if(!t||!t.alive||t.spectator) return;
    game.night.protects.add(tid);
    io.to(socket.id).emit('nightAck',{kind:'protect',targetName:t.name,self:tid===socket.id});
  });
  socket.on('nightInvestigate',tid=>{
    const p=game.players[socket.id]; if(!p||!p.alive||p.spectator||game.phase!==PHASES.NIGHT||p.role!=='police'||!once(p)) return;
    const t=game.players[tid]; if(!t||!t.alive||t.spectator||t.id===socket.id) return;
    game.night.investigations.push({policeId:socket.id,targetId:tid});
    io.to(socket.id).emit('nightAck',{kind:'invest',targetName:t.name});
  });

  // Meeting
  socket.on('vote',tid=>{
    const p=game.players[socket.id]; if(!p||!p.alive||p.spectator||game.phase!==PHASES.MEETING||p.votedFor) return;
    p.votedFor = tid || 'skip';
    game.votes[p.votedFor]=(game.votes[p.votedFor]||0)+1;
    broadcast();
  });

  // Disconnect
  socket.on('disconnect',()=>{
    const p=game.players[socket.id];
    if (p){ game.logs.push(`${p.name} 퇴장.`); delete game.players[socket.id]; }
    game.order = game.order.filter(x=>x!==socket.id);
    if (game.hostId === socket.id) game.hostId = null;
    ensureHost(); broadcast();
  });
});

app.get('/health', (_,res)=>res.send('OK'));
server.listen(PORT, ()=> console.log('✅ server on', PORT));
