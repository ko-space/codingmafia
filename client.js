
const DEFAULT_AVATAR="https://mblogthumb-phinf.pstatic.net/20140606_111/sjinwon2_1402052862659ofnU1_PNG/130917_224626.png?type=w420";
const AVATARS=["https://i.namu.wiki/i/hk1opVBuLjBA64wX9pGcbyW-8L99lDXDgyL-YLOOZvl_-aE3n1nRGN-oIYBoh7t7915XOu2fQxyWk9gv8hhd53D9EwclIyg3DCRP160SKr05uj-3-hVIHq13pzz_m9Kxn8xTduKXQTNS9fAAaX7oOA.webp"];
const socket = io(SERVER_URL,{transports:["websocket"]});
let you={}; let state={phase:"LOBBY",players:[],projectProgress:0,hostId:null,phaseEndsAt:null,dayCount:0,logs:[]};
const $=id=>document.getElementById(id);
function setLobbyVisible(v){ document.querySelectorAll(".lobby-only").forEach(el=> el.style.display=v?"":"none"); }
function setHostOnlyVisible(){ document.querySelectorAll(".host-only").forEach(el=> el.style.display=(you.id&&you.id===state.hostId)?"":"none"); }
function renderAvatarGrid(selected){ const g=$("avatarGrid"); g.innerHTML=""; AVATARS.forEach(u=>{ const b=document.createElement("button"); b.className="avatar-btn"+(selected===u?" active":""); b.onclick=()=>socket.emit("setAvatar",u); const i=document.createElement("img"); i.className="avatar-img"; i.src=u; b.appendChild(i); g.appendChild(b); });}
$("setNameBtn").onclick=()=> socket.emit("setName",($("nameInput").value||"").trim());
$("setAvatarBtn").onclick=()=> socket.emit("setAvatar",($("avatarInput").value||DEFAULT_AVATAR).trim());
$("spectateBtn").onclick=()=> socket.emit("setSpectator",true);
$("joinBtn").onclick=()=> socket.emit("setSpectator",false);
$("applyRolesBtn").onclick=()=>{ socket.emit("setRoleConfig",{mafia:3,doctor:2,police:2}); };
$("revealBtn").onclick=()=> socket.emit("toggleReveal");
$("startBtn").onclick=()=> socket.emit("hostStart");
$("chatSend").onclick=()=>{ const v=($("chatInput").value||"").trim(); if(v){ socket.emit("chat",v); $("chatInput").value=""; }};
$("reqTaskBtn").onclick=()=> socket.emit("requestTask");
socket.on("you", me=>{ you=me; $("you").textContent=`나: ${you.name||"-"} / 역할: ${you.role|| (you.spectator?"관전자":"-")} / ${you.alive?"생존":"사망"}`; setHostOnlyVisible(); if(state.phase==="LOBBY") renderAvatarGrid(you.avatar||DEFAULT_AVATAR); });
socket.on("chat", line=>{ const box=$("chatLog"); const div=document.createElement("div"); div.className="chat-line"; div.textContent=line; box.appendChild(div); box.scrollTop=box.scrollHeight; });
socket.on("task", t=>{ $("taskPrompt").textContent=t.prompt; const area=$("taskChoices"); area.innerHTML=""; t.choices.forEach((c,i)=>{ const b=document.createElement("button"); b.textContent=c; b.onclick=()=> socket.emit("submitTask",{id:t.id,answerIndex:i}); area.appendChild(b); }); });
socket.on("taskResult", r=> alert(r.correct?`정답! +${r.delta}%`:"오답!"));
socket.on("logs", lines=>{ const ll=$("logList"); ll.innerHTML=""; lines.forEach(x=>{ const li=document.createElement("li"); li.textContent=x; ll.appendChild(li); }); });
socket.on("state", s=>{ const prev=state.phase; state=s; $("projBar").style.width=(s.projectProgress||0)+"%"; $("projText").textContent=(s.projectProgress||0)+"%"; $("phaseLabel").textContent=s.phase; setLobbyVisible(s.phase==="LOBBY"); const ul=$("playerList"); ul.innerHTML=""; s.players.forEach(p=>{ const li=document.createElement("li"); const img=document.createElement("img"); img.className="player-avatar"; img.src=p.avatar; const name=document.createElement("span"); name.textContent=p.name+(p.spectator?" (관전)":""); const status=document.createElement("span"); status.textContent=p.alive?"🟢":"🔴"; if(!p.alive){ name.classList.add("dead"); li.classList.add("dead"); } li.appendChild(img); li.appendChild(name); li.appendChild(status); ul.appendChild(li); }); if (prev!==s.phase){ if (s.phase==="SPRINT" && prev==="LOBBY") blackout(`당신은 <b>${you.role||"-"}</b> 입니다`,1500); if (s.phase==="NIGHT") blackout("밤이 되었습니다",1000); if (s.phase==="SPRINT" && prev==="MEETING") blackout("날이 밝았습니다",1000); } });
function blackout(msg,ms){ const o=$("blackout"), t=$("blackoutText"); t.innerHTML=msg; o.classList.remove("hidden"); setTimeout(()=>o.classList.add("hidden"), ms||1200); }
document.addEventListener("DOMContentLoaded",()=>{ $("nameInput").value="Dev"+Math.floor(Math.random()*1000); renderAvatarGrid(DEFAULT_AVATAR); setLobbyVisible(true); });
