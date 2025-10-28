// server.js — Coding Mafia Server (Render-ready)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors({ origin: true })); // 실제 배포 시: origin: ['https://ko-space.github.io']
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });

const PORT = process.env.PORT || 10000;

const DEFAULT_AVATAR =
  'https://mblogthumb-phinf.pstatic.net/20140606_111/sjinwon2_1402052862659ofnU1_PNG/130917_224626.png?type=w420';

const PHASES = {
  LOBBY: 'LOBBY',
  SPRINT: 'SPRINT',
  SABOTAGE: 'SABOTAGE',
  NIGHT: 'NIGHT',
  MEETING: 'MEETING',
  END: 'END',
};

const PHASE_LENGTH = { SPRINT: 90_000, NIGHT: 45_000, MEETING: 60_000 };

const game = {
  phase: PHASES.LOBBY,
  players: {},
  order: [],
  hostId: null,
  projectProgress: 0,
  dayCount: 0,
  sabotage: null,
  votes: {},
  night: { kills: null, protects: new Set(), investigations: [] },
  cooldowns: { sabotage: 0 },
  logs: [],
  config: { revealOnEject: false, roles: { mafia: 3, doctor: 2, police: 2 } },
  timers: { handle: null, endsAt: null },
};

// ---------------- Utility ----------------
function alivePlayers() {
  return Object.values(game.players).filter((p) => p.alive && !p.spectator);
}
function countByRole(includeDead = false) {
  const base = includeDead ? Object.values(game.players) : alivePlayers();
  const c = { mafia: 0, doctor: 0, police: 0, citizen: 0 };
  for (const p of base) c[p.role]++;
  return c;
}
function broadcast() {
  const publicPlayers = Object.values(game.players).map((p) => ({
    id: p.id,
    name: p.name,
    alive: p.alive,
    ready: p.ready,
    spectator: !!p.spectator,
    avatar: p.avatar || DEFAULT_AVATAR,
  }));
  io.emit('state', {
    phase: game.phase,
    players: publicPlayers,
    projectProgress: game.projectProgress,
    dayCount: game.dayCount,
    sabotage: game.sabotage,
    logs: game.logs.slice(-12),
    hostId: game.hostId,
    phaseEndsAt: game.timers.endsAt,
  });
}
function personalUpdate(socket) {
  const p = game.players[socket.id];
  if (p)
    socket.emit('you', {
      id: p.id,
      name: p.name,
      role: p.role,
      alive: p.alive,
      spectator: p.spectator,
      avatar: p.avatar || DEFAULT_AVATAR,
    });
}
function winCheck() {
  const alive = alivePlayers();
  const tally = countByRole(false);
  if (tally.mafia === 0) {
    game.phase = PHASES.END;
    game.logs.push('시민팀 승리! 마피아 전원 퇴출.');
    return true;
  }
  if (tally.mafia >= alive.length - tally.mafia && alive.length > 0) {
    game.phase = PHASES.END;
    game.logs.push('마피아 승리! 인원 균형 역전.');
    return true;
  }
  if (game.projectProgress >= 100) {
    game.phase = PHASES.END;
    game.logs.push('시민팀 승리! 프로젝트 100% 달성.');
    return true;
  }
  return false;
}
function clearPhaseTimer() {
  if (game.timers.handle) clearTimeout(game.timers.handle);
  game.timers.handle = null;
  game.timers.endsAt = null;
}
function startPhaseTimer() {
  clearPhaseTimer();
  const len = PHASE_LENGTH[game.phase];
  if (!len) return;
  game.timers.endsAt = Date.now() + len;
  game.timers.handle = setTimeout(() => nextPhase(true), len);
}
function assignRoles() {
  const ids = game.order.filter((id) => {
    const p = game.players[id];
    return p && p.alive && !p.spectator;
  });
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const counts = { ...game.config.roles };
  ids.forEach((id) => {
    const p = game.players[id];
    if (!p) return;
    if (counts.mafia-- > 0) return (p.role = 'mafia');
    if (counts.doctor-- > 0) return (p.role = 'doctor');
    if (counts.police-- > 0) return (p.role = 'police');
    p.role = 'citizen';
  });
}

// ---------------- Core Phases ----------------
function startGame() {
  assignRoles();
  game.dayCount = 1;
  game.phase = PHASES.SPRINT;
  game.projectProgress = 0;
  game.logs = ['게임 시작!', 'Day 1 - 스프린트 시작.'];
  for (const p of Object.values(game.players)) {
    p.alive = true;
    p.ready = false;
  }
  for (const [id, p] of Object.entries(game.players)) {
    const s = io.sockets.sockets.get(id);
    if (s)
      s.emit('you', {
        id: p.id,
        name: p.name,
        role: p.role,
        alive: p.alive,
        spectator: !!p.spectator,
        avatar: p.avatar || DEFAULT_AVATAR,
      });
  }
  startPhaseTimer();
}
function nextPhase(fromTimer = false) {
  if (winCheck()) {
    clearPhaseTimer();
    return broadcast();
  }
  switch (game.phase) {
    case PHASES.SPRINT:
      game.phase = PHASES.NIGHT;
      game.logs.push('밤(리뷰) 시작.');
      game.night = { kills: null, protects: new Set(), investigations: [] };
      break;
    case PHASES.NIGHT:
      resolveNight();
      if (winCheck()) return broadcast();
      game.phase = PHASES.MEETING;
      game.logs.push('회의/투표 시작.');
      game.votes = {};
      break;
    case PHASES.MEETING:
      resolveMeetingVote();
      if (winCheck()) return broadcast();
      game.dayCount++;
      game.phase = PHASES.SPRINT;
      game.logs.push(`Day ${game.dayCount} - 스프린트 시작.`);
      game.cooldowns.sabotage = Math.max(0, game.cooldowns.sabotage - 1);
      break;
  }
  if (!fromTimer) startPhaseTimer();
  broadcast();
}

// ----------------- Actions -----------------
function resolveNight() {
  const kill = game.night.kills;
  const protected = game.night.protects;
  if (kill && !protected.has(kill) && game.players[kill]) {
    game.players[kill].alive = false;
    game.logs.push(`${game.players[kill].name}이(가) 밤에 제거되었습니다.`);
  } else if (kill) {
    game.logs.push(`${game.players[kill].name}은(는) 의사에 의해 보호되었습니다.`);
  }
}
function resolveMeetingVote() {
  const tally = game.votes;
  let max = 0,
    target = null,
    tie = false;
  for (const [pid, count] of Object.entries(tally)) {
    if (count > max) {
      max = count;
      target = pid;
      tie = false;
    } else if (count === max) tie = true;
  }
  if (!tie && target && game.players[target] && game.players[target].alive) {
    const role = game.players[target].role;
    game.players[target].alive = false;
    const reveal = game.config.revealOnEject
      ? ` (역할: ${role})`
      : ' (역할 비공개)';
    game.logs.push(`투표로 ${game.players[target].name} 추방!${reveal}`);
  } else game.logs.push('동률 혹은 표 부족으로 추방 없음.');
}

// ----------------- Socket.IO -----------------
io.on('connection', (socket) => {
  const defaultName = 'Player' + Math.floor(Math.random() * 900 + 100);
  game.players[socket.id] = {
    id: socket.id,
    name: defaultName,
    role: null,
    alive: true,
    ready: false,
    spectator: false,
    avatar: DEFAULT_AVATAR,
  };
  game.order.push(socket.id);
  if (!game.hostId) game.hostId = socket.id;
  game.logs.push(`${defaultName} 입장.`);
  personalUpdate(socket);
  broadcast();

  socket.on('setName', (name) => {
    const p = game.players[socket.id];
    if (!p) return;
    p.name = String(name || '').trim().slice(0, 20);
    broadcast();
  });
  socket.on('setAvatar', (url) => {
    const p = game.players[socket.id];
    if (!p) return;
    p.avatar = /^https?:/.test(url) ? url : DEFAULT_AVATAR;
    broadcast();
  });
  socket.on('setSpectator', (flag) => {
    const p = game.players[socket.id];
    if (!p) return;
    p.spectator = !!flag;
    broadcast();
  });
  socket.on('ready', (flag) => {
    const p = game.players[socket.id];
    if (!p || game.phase !== PHASES.LOBBY) return;
    p.ready = !!flag;
    broadcast();
  });

  // Host controls
  socket.on('setRoleConfig', ({ mafia, doctor, police }) => {
    if (socket.id !== game.hostId) return;
    game.config.roles = {
      mafia: Math.max(0, Math.min(10, mafia)),
      doctor: Math.max(0, Math.min(10, doctor)),
      police: Math.max(0, Math.min(10, police)),
    };
    game.logs.push(
      `역할 설정: 마피아${mafia}/의사${doctor}/경찰${police}`
    );
    broadcast();
  });
  socket.on('toggleReveal', () => {
    if (socket.id !== game.hostId) return;
    game.config.revealOnEject = !game.config.revealOnEject;
    game.logs.push(
      `설정: 추방 시 역할 공개 = ${
        game.config.revealOnEject ? 'ON' : 'OFF'
      }`
    );
    broadcast();
  });
  socket.on('hostStart', () => {
    if (socket.id !== game.hostId) return;
    startGame();
    broadcast();
  });
  socket.on('advancePhase', () => {
    if (socket.id !== game.hostId) return;
    nextPhase(false);
  });

  // Voting
  socket.on('vote', (targetId) => {
    const p = game.players[socket.id];
    if (!p || p.spectator || !p.alive || game.phase !== PHASES.MEETING)
      return;
    if (p.votedFor) return;
    p.votedFor = targetId || 'skip';
    game.votes[p.votedFor] = (game.votes[p.votedFor] || 0) + 1;
    broadcast();
  });

  socket.on('disconnect', () => {
    const p = game.players[socket.id];
    if (p) {
      game.logs.push(`${p.name} 퇴장.`);
      delete game.players[socket.id];
      game.order = game.order.filter((x) => x !== socket.id);
      if (game.hostId === socket.id) {
        game.hostId = game.order[0] || null;
      }
    }
    broadcast();
  });
});

app.get('/health', (req, res) => res.send('OK'));
server.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
