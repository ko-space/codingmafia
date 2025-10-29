// server.js — v1-plus
// 호스트 자동복구/선점 + 강제 종료/로비 복귀 + 밤/퀴즈/미션/타임바 + 프로젝트 게이지

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors({ origin: true }));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });
const PORT = process.env.PORT || 10000;

const DEFAULT_AVATAR='https://mblogthumb-phinf.pstatic.net/20140606_111/sjinwon2_1402052862659ofnU1_PNG/130917_224626.png?type=w420';

const PHASES = { LOBBY:'LOBBY', SPRINT:'SPRINT', NIGHT:'NIGHT', MEETING:'MEETING', END:'END' };
const PHASE_LENGTH = { SPRINT: 90_000, NIGHT: 45_000, MEETING: 60_000 };
const MAX_PLAYERS = 64;

const game = {
  phase: PHASES.LOBBY,
  players: {}, order: [], hostId: null,
  projectProgress: 0, dayCount: 0,
  votes: {},
  night: { kills: null, protects: new Set(), investigations: [] },
  logs: [],
  config: { revealOnEject: false, roles: { mafia:3, doctor:2, police:2 } },
  timers: { handle: null, endsAt: null },
  tasks: {},
};

// ===== helpers =====
function broadcast() {
  const publicPlayers = Object.values(game.players).map(p => ({
    id: p.id, name: p.name, alive: p.alive, ready: p.ready, spectator: !!p.spectator, avatar: p.avatar || DEFAULT_AVATAR
  }));
  const state = {
    phase: game.phase,
    players: publicPlayers,
    projectProgress: game.projectProgress,
    dayCount: game.dayCount,
    logs: game.logs.slice(-12),
    hostId: game.hostId,
    phaseEndsAt: game.timers.endsAt
  };
  io.emit('state', state);
  io.emit('logs', game.logs.slice(-12));
}

function personalUpdate(socket) {
  const p = game.players[socket.id];
  if (!p) return;
  socket.emit('you', { id:p.id,name:p.name,role:p.role,alive:p.alive,spectator:!!p.spectator,avatar:p.avatar||DEFAULT_AVATAR });
}

function alivePlayers(){ return Object.values(game.players).filter(p=>p.alive && !p.spectator); }

function countByRole(includeDead=false){
  const base = includeDead ? Object.values(game.players) : alivePlayers();
  const c = { mafia:0, doctor:0, police:0, citizen:0 };
  for (const p of base) c[p.role]++;
  return c;
}

function winCheck(){
  const alive = alivePlayers();
  const tally = countByRole(false);
  if (tally.mafia === 0){
    game.phase=PHASES.END; game.logs.push('시민팀 승리! 마피아 퇴출 완료.');
    return true;
  }
  if (tally.mafia >= (alive.length - tally.mafia) && alive.length>0){
    game.phase=PHASES.END; game.logs.push('마피아 승리! 인원수 역전.');
    return true;
  }
  if (game.projectProgress >= 100){
    game.phase=PHASES.END; game.logs.push('시민팀 승리! 프로젝트 100%.');
    return true;
  }
  return false;
}

function clearTimer(){ if(game.timers.handle) clearTimeout(game.timers.handle); game.timers.handle=null; game.timers.endsAt=null; }

function startTimer(){
  clearTimer();
  const len=PHASE_LENGTH[game.phase];
  if(!len) return;
  game.timers.endsAt=Date.now()+len;
  game.timers.handle=setTimeout(()=> nextPhase(true), len);
}

function increaseProgress(amount, reason){
  const before = game.projectProgress;
  game.projectProgress = Math.min(100, game.projectProgress + amount);
  game.logs.push(`📈 프로젝트 +${amount}% (${reason}) → ${before}% → ${game.projectProgress}%`);
  if (game.projectProgress >= 100) {
    game.phase = PHASES.END;
    game.logs.push('🎉 프로젝트 완성! 시민팀 승리!');
  }
}

function ensureHost() {
  if (!game.hostId) {
    const next = game.order.find(id => !!game.players[id]);
    if (next) {
      game.hostId = next;
      game.logs.push(`${game.players[next].name} 님이 호스트가 되었습니다.`);
    }
  }
}

// ===== role assign =====
function assignRoles(){
  const ids = game.order.filter(id=>{ const p=game.players[id]; return p && p.alive && !p.spectator; });
  for (let i=ids.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [ids[i],ids[j]]=[ids[j],ids[i]]; }
  const counts = { ...game.config.roles };
  ids.forEach(id=>{
    const p=game.players[id]; if(!p) return;
    if (counts.mafia-- > 0) p.role='mafia';
    else if (counts.doctor-- > 0) p.role='doctor';
    else if (counts.police-- > 0) p.role='police';
    else p.role='citizen';
  });
}

// ===== tasks =====
let taskCounter=0;
const TASK_BANK=[
  {prompt:'다음 중 JS에서 배열 길이를 구하는 코드는?', choices:['arr.count()','len(arr)','arr.length','size(arr)'], answer:2, delta:5},
  {prompt:'HTTP 상태 200의 의미는?', choices:['Not Found','OK','Redirect','Server Error'], answer:1, delta:4},
  {prompt:'CSS로 글자색을 빨강으로 지정하는 올바른 코드는?', choices:['color: #ff0000;','font-color: red;','text-color: red;','fg: red;'], answer:0, delta:3},
  {prompt:'Git에서 변경사항을 스테이징하는 명령은?', choices:['git push','git add','git fetch','git log'], answer:1, delta:4},
  {prompt:'const x = 1; x = 2; 의 결과는?', choices:['x는 2가 된다','에러가 난다','암묵적 형변환','경고만 뜬다'], answer:1, delta:4},
];
function nextTask(){
  const base = TASK_BANK[(taskCounter++) % TASK_BANK.length];
  return { id: 't'+taskCounter, prompt: base.prompt, choices: base.choices, answer: base.answer, delta: base.delta };
}

// ===== phase controls =====
function startGame(){
  assignRoles();
  game.dayCount=1; game.phase=PHASES.SPRINT;
  game.projectProgress=0; game.logs=['게임 시작!','Day 1 - 스프린트 시작.'];
  for (const p of Object.values(game.players)){ p.alive=true; p.ready=false; p.votedFor=null; }
  for (const [id,p] of Object.entries(game.players)){
    const s=io.sockets.sockets.get(id);
    if (s) s.emit('you',{ id:p.id,name:p.name,role:p.role,alive:p.alive,spectator:!!p.spectator,avatar:p.avatar||DEFAULT_AVATAR });
  }
  startTimer(); broadcast();
}

function emitNightTargets(){
  for (const [id,p] of Object.entries(game.players)){
    if (!p.alive || p.spectator) continue;
    const s=io.sockets.sockets.get(id); if (!s) continue;
    if (p.role==='mafia'){
      const list = alivePlayers().filter(x=> x.id!==id && x.role!=='mafia').map(x=>({id:x.id,name:x.name}));
      s.emit('nightTargets',{ kill: list });
    } else if (p.role==='doctor'){
      const list = alivePlayers().map(x=>({id:x.id,name:x.name}));
      s.emit('nightTargets',{ protect: list });
    } else if (p.role==='police'){
      const list = alivePlayers().filter(x=> x.id!==id).map(x=>({id:x.id,name:x.name}));
      s.emit('nightTargets',{ invest: list });
    }
  }
}

function nextPhase(fromTimer=false){
  if (winCheck()){ clearTimer(); return broadcast(); }
  switch (game.phase){
    case PHASES.SPRINT:
      game.phase = PHASES.NIGHT;
      game.logs.push('밤이 되었습니다.');
      game.night = { kills:null, protects:new Set(), investigations:[] };
      emitNightTargets();
      break;
    case PHASES.NIGHT:
      resolveNight();
      if (winCheck()) return broadcast();
      game.phase = PHASES.MEETING;
      game.logs.push('회의/투표 시작.');
      game.votes = {};
      break;
    case PHASES.MEETING:
      const reveal = resolveMeetingVote();
      if (reveal){ io.emit('reveal', reveal); }
      if (winCheck()) return broadcast();
      game.dayCount += 1;
      game.phase = PHASES.SPRINT;
      game.logs.push(`Day ${game.dayCount} - 스프린트 시작.`);
      break;
  }
  if (!fromTimer) startTimer();
  broadcast();
}

function resolveNight(){
  const kill = game.night.kills;
  const protectedSet = game.night.protects;
  let doctorProtected=false;
  if (kill && !protectedSet.has(kill) && game.players[kill]){
    game.players[kill].alive=false;
    game.logs.push(`${game.players[kill].name}이(가) 밤에 제거되었습니다.`);
  } else if (kill){
    doctorProtected=true;
    game.logs.push(`${game.players[kill].name}은(는) 의사에 의해 보호되었습니다.`);
  }
  if (doctorProtected) increaseProgress(2,'의사 보호 성공');
}

function resolveMeetingVote(){
  const tally = game.votes;
  let max=0, target=null, tie=false;
  for (const [pid,count] of Object.entries(tally)){
    if (count>max){ max=count; target=pid; tie=false; }
    else if (count===max){ tie=true; }
  }
  if (!tie && target && game.players[target] && game.players[target].alive){
    const role = game.players[target].role;
    const name = game.players[target].name;
    game.players[target].alive=false;
    const revealText = game.config.revealOnEject ? ` (역할: ${role})` : ' (역할 비공개)';
    game.logs.push(`투표로 ${name} 추방!${revealText}`);
    if (role==='mafia') increaseProgress(10,'마피아 추방 성공');
    return { name, isMafia: role==='mafia' };
  } else {
    game.logs.push('동률 혹은 표 부족으로 추방 없음.');
    return null;
  }
}

// ===== hard end / reset lobby =====
function hardEndGame(reason='호스트에 의해 게임이 종료되었습니다.'){
  clearTimer();
  if (game.phase !== PHASES.END) game.phase = PHASES.END;
  game.logs.push(`🛑 ${reason}`);
  broadcast();
}

function resetToLobby(reason='호스트가 로비로 복귀시켰습니다.'){
  clearTimer();
  // 플레이어 상태 정리
  for (const p of Object.values(game.players)){
    p.alive = true;
    p.ready = false;
    p.votedFor = null;
    p.role = null; // 역할 초기화
  }
  // 게임 변수 초기화
  game.phase = PHASES.LOBBY;
  game.projectProgress = 0;
  game.dayCount = 0;
  game.votes = {};
  game.tasks = {};
  game.night = { kills:null, protects:new Set(), investigations:[] };
  game.logs.push(`↩️ ${reason}`);
  broadcast();
}

// ===== sockets =====
io.on('connection', (socket)=>{
  if (Object.keys(game.players).length >= MAX_PLAYERS){
    socket.emit('full',{message:'방이 가득 찼습니다.'}); socket.disconnect(); return;
  }
  const defaultName='Player'+Math.floor(Math.random()*900+100);
  game.players[socket.id]={ id:socket.id, name:defaultName, role:null, alive:true, ready:false, votedFor:null, spectator:false, avatar:DEFAULT_AVATAR };
  game.order.push(socket.id);
  game.logs.push(`${defaultName} 입장.`);

  ensureHost(); // 호스트 자동 복구

  personalUpdate(socket);
  broadcast();

  // profile
  socket.on('setName',(name)=>{ const p=game.players[socket.id]; if(!p) return; p.name=String(name||'').trim().slice(0,20); broadcast(); });
  socket.on('setAvatar',(url)=>{ const p=game.players[socket.id]; if(!p) return; p.avatar=/^https?:\/\//i.test(url)?url:DEFAULT_AVATAR; broadcast(); });
  socket.on('setSpectator',(flag)=>{ const p=game.players[socket.id]; if(!p) return; p.spectator=!!flag; broadcast(); });

  // chat
  socket.on('chat', (text)=>{
    const p=game.players[socket.id]; if(!p) return;
    const line = `${p.name}: ${String(text||'').slice(0,200)}`;
    io.emit('chat', line);
  });

  // tasks
  socket.on('requestTask', ()=>{
    if (game.phase!==PHASES.SPRINT) return;
    const p=game.players[socket.id]; if(!p||!p.alive||p.spectator) return;
    const task=nextTask();
    game.tasks[socket.id]=task;
    socket.emit('task',{ id:task.id, prompt:task.prompt, choices:task.choices });
  });
  socket.on('submitTask', ({id,answerIndex})=>{
    const p=game.players[socket.id]; if(!p||!p.alive||p.spectator) return;
    const t=game.tasks[socket.id]; if(!t||t.id!==id) return;
    const correct = Number(answerIndex)===t.answer;
    if (correct) increaseProgress(t.delta,'코딩 미션 성공');
    socket.emit('taskResult',{correct,delta: correct?t.delta:0});
    delete game.tasks[socket.id];
    broadcast();
  });

  // host: config
  socket.on('setRoleConfig', ({mafia,doctor,police})=>{
    if (socket.id!==game.hostId) return;
    game.config.roles={
      mafia:Math.max(0,Math.min(10,parseInt(mafia||0))),
      doctor:Math.max(0,Math.min(10,parseInt(doctor||0))),
      police:Math.max(0,Math.min(10,parseInt(police||0)))
    };
    game.logs.push(`역할 설정: 마피아${game.config.roles.mafia}/의사${game.config.roles.doctor}/경찰${game.config.roles.police}`);
    broadcast();
  });
  socket.on('toggleReveal',()=>{
    if (socket.id!==game.hostId) return;
    game.config.revealOnEject = !game.config.revealOnEject;
    game.logs.push(`설정: 추방 시 역할 공개 = ${game.config.revealOnEject?'ON':'OFF'}`);
    broadcast();
  });

  // host: game lifecycle
  socket.on('hostStart',()=>{
    if (socket.id!==game.hostId) return;
    startGame();
  });

  socket.on('hostEndGame', ()=>{
    if (socket.id !== game.hostId) return;
    hardEndGame('호스트 강제 종료');
  });

  socket.on('hostResetLobby', ()=>{
    if (socket.id !== game.hostId) return;
    resetToLobby('호스트에 의해 로비로 복귀');
  });

  // night actions
  function oncePerNight(p){ if(p._actedNight) return false; p._actedNight=true; return true; }

  socket.on('nightKill',(targetId)=>{
    const p=game.players[socket.id]; if(!p||game.phase!==PHASES.NIGHT||!p.alive||p.spectator) return;
    if (p.role!=='mafia') return; if (!oncePerNight(p)) return;
    const t=game.players[targetId]; if(!t||!t.alive||t.spectator) return;
    if (t.role==='mafia') return; // 같은 마피아 금지
    game.night.kills = targetId;
    io.to(socket.id).emit('nightAck',{kind:'kill', targetName: t.name});
  });

  socket.on('nightProtect',(targetId)=>{
    const p=game.players[socket.id]; if(!p||game.phase!==PHASES.NIGHT||!p.alive||p.spectator) return;
    if (p.role!=='doctor') return; if (!oncePerNight(p)) return;
    const t=game.players[targetId]; if(!t||!t.alive||t.spectator) return;
    const self = (targetId===socket.id);
    game.night.protects.add(targetId);
    io.to(socket.id).emit('nightAck',{kind:'protect', targetName: t.name, self});
  });

  socket.on('nightInvestigate',(targetId)=>{
    const p=game.players[socket.id]; if(!p||game.phase!==PHASES.NIGHT||!p.alive||p.spectator) return;
    if (p.role!=='police') return; if (!oncePerNight(p)) return;
    const t=game.players[targetId]; if(!t||!t.alive||t.spectator) return;
    if (t.id===socket.id) return; // 자기 자신 불가
    game.night.investigations.push({policeId:socket.id,targetId});
    io.to(socket.id).emit('nightAck',{kind:'invest', targetName: t.name});
  });

  // meeting vote
  socket.on('vote',(targetId)=>{
    const p=game.players[socket.id]; if(!p||game.phase!==PHASES.MEETING||!p.alive||p.spectator) return;
    if (p.votedFor) return;
    p.votedFor = targetId || 'skip';
    if (!game.votes[p.votedFor]) game.votes[p.votedFor]=0;
    game.votes[p.votedFor]+=1;
    broadcast();
  });

  // host: 선점/양도
  socket.on('claimHost', ()=>{
    if (!game.hostId && game.players[socket.id]) {
      game.hostId = socket.id;
      game.logs.push(`${game.players[socket.id].name} 님이 호스트를 선점했습니다.`);
      broadcast();
    }
  });
  socket.on('transferHost', (targetId)=>{
    if (socket.id !== game.hostId) return;
    if (game.players[targetId]) {
      game.hostId = targetId;
      game.logs.push(`${game.players[socket.id].name} ➜ ${game.players[targetId].name}에게 호스트 양도`);
      broadcast();
    }
  });

  socket.on('disconnect',()=>{
    const p=game.players[socket.id];
    if (p){
      game.logs.push(`${p.name} 퇴장.`);
      delete game.players[socket.id];
      game.order = game.order.filter(x=>x!==socket.id);
    }
    if (game.hostId === socket.id) game.hostId = null; // 공석 처리
    ensureHost(); // 자동 복구
    broadcast();
  });
});

app.get('/health',(req,res)=> res.send('OK'));
server.listen(PORT, ()=> console.log(`✅ Server running on ${PORT}`));
