// Minimal server matching the new client (v2 design)
const express=require('express'); const http=require('http'); const {Server}=require('socket.io'); const cors=require('cors');
const app=express(); app.use(cors({origin:true})); const server=http.createServer(app); const io=new Server(server,{cors:{origin:true}});
const PORT=process.env.PORT||10000;
const DEFAULT_AVATAR='https://mblogthumb-phinf.pstatic.net/20140606_111/sjinwon2_1402052862659ofnU1_PNG/130917_224626.png?type=w420';
const PHASES={LOBBY:'LOBBY',SPRINT:'SPRINT',NIGHT:'NIGHT',MEETING:'MEETING',END:'END'}; const PHASE_LENGTH={SPRINT:90000,NIGHT:45000,MEETING:60000};
const game={phase:PHASES.LOBBY,players:{},order:[],hostId:null,projectProgress:0,dayCount:0,logs:[],votes:{},timers:{handle:null,endsAt:null},config:{revealOnEject:false,roles:{mafia:3,doctor:2,police:2}},tasks:{}};
function broadcast(){ const publicPlayers=Object.values(game.players).map(p=>({id:p.id,name:p.name,alive:p.alive,ready:p.ready,spectator:!!p.spectator,avatar:p.avatar||DEFAULT_AVATAR})); const state={phase:game.phase,players:publicPlayers,projectProgress:game.projectProgress,dayCount:game.dayCount,logs:game.logs.slice(-12),hostId:game.hostId,phaseEndsAt:game.timers.endsAt}; io.emit('state',state); io.emit('logs',game.logs.slice(-12)); }
function personalUpdate(s){ const p=game.players[s.id]; if(!p)return; s.emit('you',{id:p.id,name:p.name,role:p.role,alive:p.alive,spectator:!!p.spectator,avatar:p.avatar||DEFAULT_AVATAR}); }
function startTimer(){ if(game.timers.handle) clearTimeout(game.timers.handle); const len=PHASE_LENGTH[game.phase]; if(!len){game.timers.endsAt=null;return;} game.timers.endsAt=Date.now()+len; game.timers.handle=setTimeout(()=>nextPhase(true),len); }
function assignRoles(){ const ids=game.order.filter(id=>{const p=game.players[id]; return p && p.alive && !p.spectator;}); for(let i=ids.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [ids[i],ids[j]]=[ids[j],ids[i]];} const c={...game.config.roles}; ids.forEach(id=>{ const p=game.players[id]; if(c.mafia-->0) p.role='mafia'; else if(c.doctor-->0) p.role='doctor'; else if(c.police-->0) p.role='police'; else p.role='citizen'; }); }
function startGame(){ assignRoles(); game.dayCount=1; game.phase=PHASES.SPRINT; game.projectProgress=0; game.logs=['게임 시작!','Day 1 - 스프린트 시작.']; for (const p of Object.values(game.players)){ p.alive=true; p.ready=false; p.votedFor=null; } for (const [id,p] of Object.entries(game.players)){ const s=io.sockets.sockets.get(id); if(s) s.emit('you',{id:p.id,name:p.name,role:p.role,alive:p.alive,spectator:!!p.spectator,avatar:p.avatar||DEFAULT_AVATAR}); } startTimer(); broadcast(); }
function nextPhase(timer){ switch(game.phase){ case PHASES.SPRINT: game.phase=PHASES.NIGHT; game.logs.push('밤이 되었습니다.'); break; case PHASES.NIGHT: game.phase=PHASES.MEETING; game.logs.push('회의/투표 시작.'); game.votes={}; break; case PHASES.MEETING: game.dayCount++; game.phase=PHASES.SPRINT; game.logs.push('스프린트 재개.'); break; } if(!timer) startTimer(); broadcast(); }
const TASK_BANK=[{prompt:'JS 배열 길이?',choices:['arr.count()','len(arr)','arr.length','size(arr)'],answer:2,delta:5},{prompt:'HTTP 200?',choices:['Not Found','OK','Redirect','Server Error'],answer:1,delta:4}]; let tId=0;
io.on('connection',socket=>{
  const defaultName='Player'+Math.floor(Math.random()*900+100);
  game.players[socket.id]={id:socket.id,name:defaultName,role:null,alive:true,ready:false,votedFor:null,spectator:false,avatar:DEFAULT_AVATAR};
  game.order.push(socket.id); if(!game.hostId) game.hostId=socket.id; game.logs.push(`${defaultName} 입장.`); personalUpdate(socket); broadcast();
  socket.on('setName',name=>{ const p=game.players[socket.id]; if(!p) return; p.name=String(name||'').trim().slice(0,20); broadcast(); });
  socket.on('setAvatar',url=>{ const p=game.players[socket.id]; if(!p) return; p.avatar=/^https?:/i.test(url)?url:DEFAULT_AVATAR; broadcast(); });
  socket.on('setSpectator',f=>{ const p=game.players[socket.id]; if(!p) return; p.spectator=!!f; broadcast(); });
  socket.on('chat',text=>{ const p=game.players[socket.id]; if(!p) return; io.emit('chat',`${p.name}: ${String(text||'').slice(0,200)}`); });
  socket.on('requestTask',()=>{ if(game.phase!=='SPRINT') return; const p=game.players[socket.id]; if(!p||!p.alive||p.spectator) return; const t=TASK_BANK[(tId++)%TASK_BANK.length]; const task={id:'t'+tId,prompt:t.prompt,choices:t.choices,answer:t.answer,delta:t.delta}; game.tasks[socket.id]=task; socket.emit('task',{id:task.id,prompt:task.prompt,choices:task.choices}); });
  socket.on('submitTask',({id,answerIndex})=>{ const p=game.players[socket.id]; if(!p||!p.alive||p.spectator) return; const t=game.tasks[socket.id]; if(!t||t.id!==id) return; const ok=Number(answerIndex)===t.answer; if(ok){ game.projectProgress=Math.min(100, game.projectProgress + t.delta); game.logs.push(`📈 프로젝트 +${t.delta}% (코딩 미션)`); } socket.emit('taskResult',{correct:ok,delta: ok?t.delta:0}); delete game.tasks[socket.id]; broadcast(); });
  socket.on('setRoleConfig',({mafia,doctor,police})=>{ if(socket.id!==game.hostId) return; game.config.roles={mafia:parseInt(mafia||0),doctor:parseInt(doctor||0),police:parseInt(police||0)}; game.logs.push('역할 설정 변경'); broadcast(); });
  socket.on('toggleReveal',()=>{ if(socket.id!==game.hostId) return; game.config.revealOnEject=!game.config.revealOnEject; game.logs.push(`역할공개=${game.config.revealOnEject}`); broadcast(); });
  socket.on('hostStart',()=>{ if(socket.id!==game.hostId) return; startGame(); });
  socket.on('vote',tid=>{ const p=game.players[socket.id]; if(!p||game.phase!=='MEETING'||!p.alive||p.spectator) return; if(p.votedFor) return; p.votedFor=tid||'skip'; game.votes[p.votedFor]=(game.votes[p.votedFor]||0)+1; broadcast(); });
  socket.on('disconnect',()=>{ const p=game.players[socket.id]; if(p){ game.logs.push(`${p.name} 퇴장.`); delete game.players[socket.id]; game.order=game.order.filter(x=>x!==socket.id); if(game.hostId===socket.id) game.hostId=game.order[0]||null; } broadcast(); });
});
app.get('/health',(req,res)=>res.send('OK')); server.listen(PORT,()=>console.log('Server on',PORT));
