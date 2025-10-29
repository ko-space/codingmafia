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
    phaseEndsAt: game.timers.endsAt,
    mafiaRemaining: countByRole(false).mafia
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

function resetNightFlags() {
  for (const p of Object.values(game.players)) delete p._actedNight;
}

function allNightActionsDone() {
  const alive = alivePlayers();

  const mafias = alive.filter(p => p.role === 'mafia');
  const doctors = alive.filter(p => p.role === 'doctor');
  const polices = alive.filter(p => p.role === 'police');

  const mafiaDone = mafias.length === 0 || game.night.kills !== null;               // 마피아는 '팀 1회'로 간주
  const doctorDone = doctors.every(p => !!p._actedNight) || doctors.length === 0;    // 각자 1회
  const policeDone = polices.every(p => !!p._actedNight) || polices.length === 0;    // 각자 1회

  return mafiaDone && doctorDone && policeDone;
}

// 밤 결과를 리포트 텍스트로 만들기 위한 사전 계산
function previewDawnReport(){
  const kill = game.night.kills;
  const protectedSet = game.night.protects;
  let saved = false, killedName = null, protectedName = null;

  if (kill && protectedSet.has(kill)) {
    saved = true;
    protectedName = game.players[kill]?.name || null;
  } else if (kill) {
    killedName = game.players[kill]?.name || null;
  }

  const invResults = game.night.investigations.map(({policeId,targetId})=>{
    const policeName = game.players[policeId]?.name || '(경찰)';
    const targetName = game.players[targetId]?.name || '(대상)';
    const isMafia = game.players[targetId]?.role === 'mafia';
    return { policeName, targetName, isMafia };
  });

  return { saved, killedName, protectedName, invResults };
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
let taskCounter = 0;

/** 시민용 문제: 정답 시 +delta% */
const TASK_BANK = {
  html: [
    {prompt:"<a> 태그의 href 속성은 무엇을 지정?", choices:["글자 크기","하이퍼링크 주소","문단 정렬","이미지 경로"], answer:1, delta:4},
    {prompt:"이미지를 넣는 태그는?", choices:["<video>","<img>","<figure>","<media>"], answer:1, delta:3},
    {prompt:"<img>의 대체텍스트 속성은?", choices:["title","alt","label","desc"], answer:1, delta:4},
    {prompt:"문서의 최상위 요소는?", choices:["<html>","<head>","<body>","<!doctype>"], answer:0, delta:3},
    {prompt:"문단을 만드는 태그는?", choices:["<p>","<div>","<span>","<section>"], answer:0, delta:3},
    {prompt:"가장 중요한 제목 태그는?", choices:["<h6>","<h3>","<h1>","<title>"], answer:2, delta:4},
    {prompt:"순서 없는 목록 컨테이너?", choices:["<ol>","<ul>","<li>","<dl>"], answer:1, delta:4},
    {prompt:"표의 행을 만드는 태그?", choices:["<td>","<th>","<tr>","<row>"], answer:2, delta:4},
    {prompt:"폼 제출을 담당하는 태그/속성 조합?", choices:["<form action>","<input go>","<send>","<submit>"], answer:0, delta:4},
    {prompt:"텍스트 입력 상자 타입?", choices:["type='radio'","type='text'","type='range'","type='file'"], answer:1, delta:3},
    {prompt:"체크박스 타입?", choices:["type='switch'","type='onoff'","type='checkbox'","type='toggle'"], answer:2, delta:3},
    {prompt:"라디오 버튼 그룹화는 어떤 속성으로?", choices:["class","id","name","for"], answer:2, delta:5},
    {prompt:"HTML 주석 표기?", choices:["// 주석","/* 주석 */","<!-- 주석 -->","# 주석"], answer:2, delta:3},
    {prompt:"의미 없는 레이아웃 컨테이너로 많이 쓰는 태그?", choices:["<section>","<article>","<div>","<main>"], answer:2, delta:4},
    {prompt:"인라인 텍스트 컨테이너?", choices:["<div>","<section>","<span>","<article>"], answer:2, delta:4},
    {prompt:"강조(굵게) 의미론적 태그?", choices:["<b>","<strong>","<i>","<em>"], answer:1, delta:4},
    {prompt:"기울임(강조) 의미론적 태그?", choices:["<i>","<em>","<u>","<mark>"], answer:1, delta:4},
    {prompt:"이미지 경로가 깨질 때 대신 보이는 것은?", choices:["title","alt 텍스트","id","name"], answer:1, delta:5},
    {prompt:"문서의 문자 인코딩을 지정하는 메타는?", choices:["<meta lang>","<meta charset>","<meta utf>","<meta code>"], answer:1, delta:5},
    {prompt:"외부 CSS를 연결하는 태그는?", choices:["<style>","<link>","<script>","<import>"], answer:1, delta:5},
  ],
  css: [
    {prompt:"글자 색을 빨강으로 지정", choices:["font-color:red;","color:red;","text-color:red;","fg:red;"], answer:1, delta:3},
    {prompt:"요소의 안쪽 여백", choices:["margin","padding","gap","space"], answer:1, delta:4},
    {prompt:"요소의 바깥 여백", choices:["padding","margin","border","outline"], answer:1, delta:4},
    {prompt:"두께/스타일/색 순으로 경계선 지정", choices:["border: 1 red solid;","border: solid 1 red;","border: 1px solid red;","border: red solid 1px;"], answer:2, delta:4},
    {prompt:"박스 그림자 속성", choices:["shadow","box-shadow","drop-shadow","outline"], answer:1, delta:4},
    {prompt:"모서리를 둥글게", choices:["border-round","corner","radius","border-radius"], answer:3, delta:4},
    {prompt:"inherit는 어떤 의미?", choices:["초기화","상속","덮어쓰기","무시"], answer:1, delta:3},
    {prompt:"선택자 우선순위가 가장 높은 것은?", choices:["요소 선택자","클래스","아이디","유니버설(*)"], answer:2, delta:5},
    {prompt:"display:flex의 주 용도", choices:["애니메이션","정렬/배치","색상 변경","폰트 지정"], answer:1, delta:4},
    {prompt:"flex 컨테이너의 주축 정렬", choices:["justify-content","align-items","place-items","text-align"], answer:0, delta:4},
    {prompt:"교차축 정렬", choices:["justify-content","align-items","flex-flow","align-content"], answer:1, delta:4},
    {prompt:"Grid에서 열 템플릿 지정", choices:["grid-rows","grid-template-columns","grid-gap","grid-flow"], answer:1, delta:5},
    {prompt:"미디어쿼리 최소 너비 문법", choices:["@media (min:600px)","@media (min-width:600px)","@media min-width 600","@media screen>=600"], answer:1, delta:5},
    {prompt:"상대 단위 rem은 무엇 기준?", choices:["부모 폰트","루트(html) 폰트","뷰포트","요소 너비"], answer:1, delta:4},
    {prompt:"position:sticky의 기준", choices:["스크롤 위치에 고정되는 하이브리드","항상 화면 고정","상대 위치","정적 위치"], answer:0, delta:5},
    {prompt:"z-index가 적용되려면 보통 필요한 것", choices:["position 속성","display:block","opacity","overflow"], answer:0, delta:4},
    {prompt:"투명도를 지정하는 속성", choices:["opacity","alpha","transparency","visible"], answer:0, delta:3},
    {prompt:"배경이미지 크기 꽉 채우기", choices:["background-fit:cover","background-size:cover","bg-cover:true","object-fit:cover"], answer:1, delta:5},
    {prompt:"글꼴 굵기 속성", choices:["font-weight","font-style","font-thick","font-strong"], answer:0, delta:3},
    {prompt:"transition은 무엇을 제어?", choices:["반복문","상태 전환 애니메이션","이벤트 위임","시맨틱"], answer:1, delta:4},
  ],
  js: [
    {prompt:"let과 const의 차이", choices:["const는 재할당 불가","let은 함수 스코프","둘 다 동일","const만 호이스팅"], answer:0, delta:5},
    {prompt:"배열 길이", choices:["arr.count","arr.length","len(arr)","count(arr)"], answer:1, delta:4},
    {prompt:"== 와 === 차이", choices:["없다","==는 타입 변환, ===는 엄격비교","==가 더 엄격","===는 문자열만"], answer:1, delta:5},
    {prompt:"이벤트 등록 메서드", choices:["addEventListener","onEvent","bindEvent","attachEventModern"], answer:0, delta:4},
    {prompt:"setInterval의 역할", choices:["1회 실행","주기적 반복","지연 실행 후 1회","DOM 생성"], answer:1, delta:4},
    {prompt:"JSON 문자열을 객체로", choices:["JSON.parse","JSON.encode","parseJSON","toObject"], answer:0, delta:4},
    {prompt:"배열 끝에 요소 추가", choices:["push","append","add","insert"], answer:0, delta:3},
    {prompt:"배열의 각 요소 순회 콜백", choices:["map","each","forEach","loop"], answer:2, delta:4},
    {prompt:"DOM에서 id로 요소 찾기", choices:["queryAll","getElementById","getById","selectId"], answer:1, delta:3},
    {prompt:"NaN 판별(권장)", choices:["x==NaN","Number.isNaN(x)","isNaN === x","x===NaN"], answer:1, delta:5},
    {prompt:"엄격 모드 선언", choices:["use strict;","'use strict'","strict();","enableStrict;"], answer:1, delta:4},
    {prompt:"화살표 함수의 this는?", choices:["호출부 기준","새로 바인딩됨","렉시컬(상위 스코프)","무조건 window"], answer:2, delta:5},
    {prompt:"Promise 성공 콜백", choices:["catch","then","final","done"], answer:1, delta:4},
    {prompt:"try/catch에서 finally는 언제 실행?", choices:["성공 때만","에러 때만","둘 다 이후","실행 안됨"], answer:2, delta:4},
    {prompt:"배열에서 조건 만족 첫 요소 찾기", choices:["find","filter[0]","first","match"], answer:0, delta:4},
    {prompt:"객체 전개 연산자", choices:["...obj","++obj","**obj","@@obj"], answer:0, delta:3},
    {prompt:"템플릿 리터럴 기호", choices:["' '","\" \"","` `","~ ~"], answer:2, delta:4},
    {prompt:"Number → 문자열", choices:["String(n)","n.toText()","toStr(n)","parseStr(n)"], answer:0, delta:3},
    {prompt:"문자열 → 정수", choices:["parseInt(str,10)","toInt(str)","Int(str)","Number.int(str)"], answer:0, delta:4},
    {prompt:"비동기 함수 선언 키워드", choices:["await","async","defer","prom"], answer:1, delta:4},
  ],
};

/** 마피아용 문제: 정답 시 -delta% (게이지 하락) */
const TASK_BANK_MAFIA = {
  html: [
    {prompt:"WAI-ARIA의 aria-label 주요 목적?", choices:["색상 지정","접근성 향상","배치 제어","폰트 로딩"], answer:1, delta:10},
    {prompt:"<picture>와 <source> 조합의 주된 용도", choices:["반응형 이미지 소스 전환","애니메이션","벡터 드로잉","스트리밍"], answer:0, delta:9},
    {prompt:"<template> 태그의 특징", choices:["DOM에 즉시 렌더","스크립트만 가능","비활성 DOM 조각","서버 전용"], answer:2, delta:10},
    {prompt:"<meta viewport>의 의미", choices:["인코딩 지정","모바일 뷰포트 스케일/폭 지정","색상 모드","쿠키 정책"], answer:1, delta:9},
    {prompt:"<link rel='preload'>의 역할", choices:["지연 로딩","우선 프리로드","캐시 무효화","서비스워커"], answer:1, delta:10},
    {prompt:"콘텐츠의 주 의미 영역을 지정하는 태그", choices:["<section>","<main>","<aside>","<nav>"], answer:1, delta:9},
    {prompt:"<figure>/<figcaption> 관계", choices:["표 데이터","이미지와 캡션 묶음","폼 그룹","코드 블록"], answer:1, delta:8},
    {prompt:"시맨틱 내비게이션 영역", choices:["<navigate>","<menu>","<nav>","<path>"], answer:2, delta:8},
    {prompt:"스크린리더에만 보이게 숨길 때 흔한 기법은?", choices:["display:none","visibility:hidden","sr-only 유틸리티","opacity:0"], answer:2, delta:9},
    {prompt:"서버 전송 전 입력 값 검증 우선 위치", choices:["서버만","클라만","클라+서버 모두","아무데나"], answer:2, delta:8},
  ],
  css: [
    {prompt:":root에서 선언한 --brand를 쓰는 올바른 문법", choices:["var(--brand)","root(--brand)","--brand()","use(--brand)"], answer:0, delta:9},
    {prompt:"Grid에서 repeat(3, 1fr)의 의미", choices:["3행 자동","3열 동일 분배","3칸 겹침","3배수 간격"], answer:1, delta:10},
    {prompt:"calc(100% - 48px)의 용도", choices:["수치 연산하여 동적 크기","반응형 그림자","변수 선언","정적 고정"], answer:0, delta:8},
    {prompt:"contain: layout; 의 주 효과", choices:["자식 배치 격리로 성능 향상","GPU 강제","투명도 제어","애니메이션 가속"], answer:0, delta:9},
    {prompt:"will-change 사용 시 주의점", choices:["언제나 남발","필요한 곳만 제한적으로","IE만 사용","모바일 금지"], answer:1, delta:8},
    {prompt:"clamp( min, preferred, max ) 의미", choices:["3단계 색상","폰트 합성","값을 범위로 클램프","그리드 자동"], answer:2, delta:9},
    {prompt:"@supports의 목적", choices:["브라우저 버전 검출","기능 지원 여부 분기","해상도 체크","컬러 프로파일"], answer:1, delta:9},
    {prompt:"prefers-color-scheme는 무엇?", choices:["접근성 폰트","다크모드 선호 미디어쿼리","고대비 테마","고정 팔레트"], answer:1, delta:8},
    {prompt:"BEM 네이밍에서 Block__Element--Modifier 예", choices:["btn__icon--large","btn.icon.large","btn-icon-large","btn:icon:large"], answer:0, delta:9},
    {prompt:"line-height 단위 없는 값의 의미", choices:["px","em","배수","%"], answer:2, delta:8},
  ],
  js: [
    {prompt:"클로저(closure)가 형성되는 조건", choices:["함수 내부에서 외부 스코프 변수 참조","객체 메서드만","배열 순회일 때","화살표 함수만"], answer:0, delta:10},
    {prompt:"이벤트 루프에서 마이크로태스크 큐에 들어가는 것은?", choices:["setTimeout","requestAnimationFrame","Promise.then","setInterval"], answer:2, delta:10},
    {prompt:"this 바인딩이 호출 방식에 따라 달라지는 이유", choices:["렉시컬 고정","호출 컨텍스트 기반","파일 경로 기준","브라우저만 다름"], answer:1, delta:9},
    {prompt:"async 함수는 무엇을 반환?", choices:["값 자체","Promise","Iterator","undefined"], answer:1, delta:9},
    {prompt:"debounce와 throttle의 차이", choices:["둘 다 동일","디바운스=마지막 1회, 스로틀=주기적 제한","반대이다","디바운스=주기, 스로틀=마지막"], answer:1, delta:9},
    {prompt:"深 복사(Deep Copy)로 안전한 방식", choices:["obj2 = obj1","JSON.parse(JSON.stringify(obj)) 제한적","= 만 사용","Object.assign 깊은 복사"], answer:1, delta:8},
    {prompt:"Map과 Object 차이로 옳은 것은?", choices:["키 타입 제한 동일","Map은 키 타입 제한 없음/순서 유지 우수","Object가 순서 안전","둘 다 동일"], answer:1, delta:8},
    {prompt:"이벤트 캡처링 단계에서 리스너 등록 옵션", choices:["useCapture:true","passive:true","once:true","stop:true"], answer:0, delta:8},
    {prompt:"모듈 스코프에서의 최상위 this는?", choices:["window","globalThis","undefined(모듈)","document"], answer:2, delta:9},
    {prompt:"WeakMap의 주된 장점", choices:["키가 GC 대상이어도 참조 유지","키가 GC되면 자동 해제","순회가 쉬움","직렬화에 유리"], answer:1, delta:9},
  ],
};

/** 역할에 맞춰 타입을 랜덤 선택해 문제 1개 생성 */
function nextTask(role){
  const type = ['html','css','js'][Math.floor(Math.random()*3)];
  const pool = (role === 'mafia') ? TASK_BANK_MAFIA[type] : TASK_BANK[type];
  const base = pool[Math.floor(Math.random()*pool.length)];
  return { id: 't'+(++taskCounter), prompt: base.prompt, choices: base.choices, answer: base.answer, delta: base.delta, type };
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
      resetNightFlags();             // ✅ 밤 액션 플래그 초기화
      clearTimer();                  // ✅ 밤은 타이머 미사용
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
  // SPRINT와 MEETING은 항상 타이머 사용, NIGHT만 예외(밤은 액션 완료 시 즉시 종료)
  if (game.phase === PHASES.SPRINT || game.phase === PHASES.MEETING) {
    startTimer();
  }
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

function endNightAndStartMeetingWithReport(){
  const report = previewDawnReport(); // 리포트용 데이터
  resolveNight();
  if (winCheck()) { broadcast(); return; }

  game.phase = PHASES.MEETING;
  game.logs.push('회의/투표 시작.');
  game.votes = {};
  startTimer();                        // 회의에는 타이머 사용
  io.emit('dawnReport', report);       // 새벽 리포트 전송 (클라에서 암전 표시)
  broadcast();
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
    const task = nextTask(p.role);               // ← 역할 기반 출제
    game.tasks[socket.id]=task;
    socket.emit('task',{ id:task.id, prompt:task.prompt, choices:task.choices });
  });

  socket.on('submitTask', ({id,answerIndex})=>{
    const p=game.players[socket.id]; if(!p||!p.alive||p.spectator) return;
    const t=game.tasks[socket.id];   if(!t||t.id!==id) return;
    const correct = Number(answerIndex)===t.answer;
  
    if (correct) {
      if (p.role === 'mafia') {
        increaseProgress(-t.delta, `${t.type.toUpperCase()} 프로젝트 교란 (-${t.delta}%)`);
      } else {
        increaseProgress(t.delta, `${t.type.toUpperCase()} 프로젝트 완성 (+${t.delta}%)`);
      }
    }
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
    if (allNightActionsDone()) endNightAndStartMeetingWithReport();
  });

  socket.on('nightProtect',(targetId)=>{
    const p=game.players[socket.id]; if(!p||game.phase!==PHASES.NIGHT||!p.alive||p.spectator) return;
    if (p.role!=='doctor') return; if (!oncePerNight(p)) return;
    const t=game.players[targetId]; if(!t||!t.alive||t.spectator) return;
    const self = (targetId===socket.id);
    game.night.protects.add(targetId);
    io.to(socket.id).emit('nightAck',{kind:'protect', targetName: t.name, self});
    if (allNightActionsDone()) endNightAndStartMeetingWithReport();
  });

  socket.on('nightInvestigate',(targetId)=>{
    const p=game.players[socket.id]; if(!p||game.phase!==PHASES.NIGHT||!p.alive||p.spectator) return;
    if (p.role!=='police') return; if (!oncePerNight(p)) return;
    const t=game.players[targetId]; if(!t||!t.alive||t.spectator) return;
    if (t.id===socket.id) return; // 자기 자신 불가
    game.night.investigations.push({policeId:socket.id,targetId});
    io.to(socket.id).emit('nightAck',{kind:'invest', targetName: t.name});
    if (allNightActionsDone()) endNightAndStartMeetingWithReport();
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
