// VOXWAKE room server: serves the built client + Voice Duel rooms over WebSocket.
// Rooms live in memory only. No audio is ever sent here — only short phrase text stats & boat positions.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT || 8080);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || '';
const ROOM_TTL_MS = Number(process.env.ROOM_TTL_MIN || 15) * 60_000;
const GRACE_MS = Number(process.env.RECONNECT_GRACE_MS || 30_000);
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon' };

/** @type {Map<string, any>} */
const rooms = new Map();
const ipRooms = new Map();
const joinFails = new Map();

function code5() {
  let c;
  do { c = Array.from({ length: 5 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join(''); } while (rooms.has(c));
  return c;
}

function send(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function roomState(room) {
  return {
    t: 'room', code: room.code, phase: room.phase, config: room.config,
    players: room.players.map((p) => ({ id: p.id, name: p.name, boat: p.boat, paint: p.paint, ready: p.ready, connected: !!p.ws, wins: p.wins, host: p.id === room.hostId })),
  };
}
function broadcast(room, msg) { for (const p of room.players) send(p.ws, msg); }
function sync(room) { broadcast(room, roomState(room)); }

function startRace(room) {
  room.phase = 'racing';
  room.seed = crypto.randomInt(1, 1_000_000);
  room.startAt = Date.now() + 4500;
  room.results = new Map();
  room.firstFinishAt = 0;
  for (const p of room.players) { p.ready = false; p.rematch = false; p.flags = []; p.lastPos = null; }
  broadcast(room, { t: 'race_init', seed: room.seed, level: room.config.level, startAt: room.startAt });
  sync(room);
}

function endRace(room, reason) {
  if (room.phase !== 'racing') return;
  room.phase = 'results';
  const rows = room.players.map((p) => {
    const r = room.results.get(p.id);
    return { id: p.id, name: p.name, finished: !!r, time: r ? r.time : Infinity, score: r?.score ?? p.lastPos?.score ?? 0, accuracy: r?.accuracy ?? 0,
      flow: r?.flow ?? null, progress: p.lastPos?.s ?? 0, flags: p.flags };
  }).sort((a, b) => (a.finished && b.finished ? a.time - b.time : a.finished ? -1 : b.finished ? 1 : b.progress - a.progress));
  if (rows[0]) { const w = room.players.find((p) => p.id === rows[0].id); if (w) w.wins++; }
  broadcast(room, { t: 'race_end', reason, results: rows.map((r) => ({ ...r, time: isFinite(r.time) ? r.time : null })), wins: Object.fromEntries(room.players.map((p) => [p.id, p.wins])) });
  sync(room);
}

// ---------- HTTP ----------
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/health') return json(res, 200, { ok: true, rooms: rooms.size });
  if (url.pathname === '/api/config') return json(res, 200, { publicBaseUrl: PUBLIC_BASE_URL, flowApiEnabled: false });
  if (url.pathname === '/api/rooms' && req.method === 'POST') {
    const ip = req.socket.remoteAddress || '?';
    const mine = (ipRooms.get(ip) || []).filter((c) => rooms.has(c));
    if (mine.length >= 3 || rooms.size >= 200) return json(res, 429, { error: 'RATE_LIMITED' });
    const code = code5();
    rooms.set(code, { code, created: Date.now(), touched: Date.now(), phase: 'waiting', players: [], hostId: null, config: { level: 1 }, seed: 0 });
    mine.push(code);
    ipRooms.set(ip, mine);
    return json(res, 200, { code });
  }
  // static
  let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (!p) p = 'index.html';
  let file = path.join(DIST, p);
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) file = path.join(DIST, 'index.html');
    fs.readFile(file, (e2, buf) => {
      if (e2) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Build the client first: npm run build'); }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600' });
      res.end(buf);
    });
  });
});
function json(res, code, body) { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); }

// ---------- WebSocket ----------
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
server.on('upgrade', (req, sock, head) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname !== '/ws') return sock.destroy();
  const origin = req.headers.origin;
  if (origin) {
    try {
      const oh = new URL(origin).hostname;
      const hh = (req.headers.host || '').split(':')[0];
      const allowed = oh === hh || oh === 'localhost' || oh === '127.0.0.1' || (PUBLIC_BASE_URL && new URL(PUBLIC_BASE_URL).hostname === oh);
      if (!allowed) return sock.destroy();
    } catch { return sock.destroy(); }
  }
  wss.handleUpgrade(req, sock, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress || '?';
  let player = null;
  let room = null;
  let msgCount = 0, violations = 0;
  const flood = setInterval(() => { msgCount = 0; }, 1000);
  ws.on('message', (raw) => {
    if (++msgCount > 40) { if (++violations >= 3) ws.close(4008, 'flood'); return; }
    let m;
    try { m = JSON.parse(String(raw)); } catch { return send(ws, { t: 'error', code: 'BAD_PAYLOAD', message: 'Bad JSON' }); }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'ping') return send(ws, { t: 'pong', t0: m.t0, ts: Date.now() });
    if (m.t === 'hello') {
      const code = String(m.room || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      room = rooms.get(code);
      if (!room) {
        const f = (joinFails.get(ip) || []).filter((t) => Date.now() - t < 60_000);
        f.push(Date.now());
        joinFails.set(ip, f);
        return send(ws, { t: 'error', code: f.length > 5 ? 'RATE_LIMITED' : 'ROOM_NOT_FOUND', message: 'That code doesn’t exist or has expired.' });
      }
      const name = String(m.name || 'Captain').replace(/[^\p{L}\p{N} _.-]/gu, '').slice(0, 16) || 'Captain';
      const existing = m.token && room.players.find((p) => p.token === m.token);
      if (existing) {
        if (existing.ws && existing.ws !== ws) { send(existing.ws, { t: 'error', code: 'REPLACED', message: 'Opened in another tab' }); existing.ws.close(4001); }
        existing.ws = ws;
        clearTimeout(existing.graceTimer);
        player = existing;
      } else {
        if (room.players.length >= 2) return send(ws, { t: 'error', code: 'ROOM_FULL', message: 'Room is full.' });
        player = { id: crypto.randomUUID().slice(0, 8), token: crypto.randomUUID(), name, ws, ready: false, wins: 0, boat: 'canoe', paint: 'mango', flags: [] };
        room.players.push(player);
        if (!room.hostId) room.hostId = player.id;
        if (room.players.length === 2 && room.phase === 'waiting') room.phase = 'lobby';
      }
      player.boat = ['canoe', 'shack', 'dhow', 'cat', 'ferry'].includes(m.boat) ? m.boat : player.boat;
      player.paint = typeof m.paint === 'string' ? m.paint.slice(0, 16) : player.paint;
      room.touched = Date.now();
      send(ws, { t: 'welcome', playerId: player.id, token: player.token, role: player.id === room.hostId ? 'host' : 'guest', serverTime: Date.now() });
      if (room.phase === 'racing') send(ws, { t: 'race_init', seed: room.seed, level: room.config.level, startAt: room.startAt, resume: true });
      broadcast(room, { t: 'peer', id: player.id, connected: true });
      return sync(room);
    }
    if (!player || !room) return;
    room.touched = Date.now();
    switch (m.t) {
      case 'ready':
        if (room.phase !== 'lobby' && room.phase !== 'results') return;
        player.ready = !!m.ready;
        if (room.phase === 'results') room.phase = 'lobby';
        sync(room);
        if (room.players.length === 2 && room.players.every((p) => p.ready)) startRace(room);
        break;
      case 'config':
        if (player.id !== room.hostId) return send(ws, { t: 'error', code: 'NOT_HOST', message: 'Only the host can change the course.' });
        room.config.level = Math.max(1, Math.min(6, Number(m.level) || 1));
        sync(room);
        break;
      case 'boat':
        player.boat = ['canoe', 'shack', 'dhow', 'cat', 'ferry'].includes(m.boat) ? m.boat : player.boat;
        player.paint = typeof m.paint === 'string' ? m.paint.slice(0, 16) : player.paint;
        sync(room);
        break;
      case 'pos': {
        if (room.phase !== 'racing') return;
        const s = Number(m.s) || 0, v = Number(m.v) || 0;
        const prev = player.lastPos;
        // plausibility: honest-play checks only (we cannot prove speech)
        if (prev && (s - prev.s) / Math.max(0.05, (Date.now() - prev.at) / 1000) > 50 && !player.flags.includes('implausible-speed')) player.flags.push('implausible-speed');
        player.lastPos = { s, at: Date.now(), score: Number(m.score) || 0 };
        for (const p of room.players) if (p !== player) send(p.ws, { t: 'peer_pos', id: player.id, s, lat: Number(m.lat) || 0, v, score: Number(m.score) || 0, stage: Number(m.stage) || 0, fin: !!m.fin, ft: Number(m.ft) || 0 });
        break;
      }
      case 'finish':
        if (room.phase !== 'racing' || room.results.has(player.id)) return;
        room.results.set(player.id, { time: Number(m.time) || 0, score: Number(m.score) || 0, accuracy: Number(m.accuracy) || 0, flow: m.flow && typeof m.flow === 'object' ? {
          wordsDictated: Number(m.flow.wordsDictated) || 0, wordsTyped: Number(m.flow.wordsTyped) || 0, bursts: Number(m.flow.bursts) || 0, wpm: Number(m.flow.wpm) || 0 } : null });
        if (!room.firstFinishAt) {
          room.firstFinishAt = Date.now();
          setTimeout(() => endRace(room, 'timeout'), 30_000);
        }
        if (room.results.size >= room.players.length) endRace(room, 'finish');
        break;
      case 'rematch':
        player.ready = true;
        if (room.phase === 'results') room.phase = 'lobby';
        sync(room);
        if (room.players.length === 2 && room.players.every((p) => p.ready)) setTimeout(() => startRace(room), 1200);
        break;
      case 'leave':
        ws.close(1000);
        break;
    }
  });
  ws.on('close', () => {
    clearInterval(flood);
    if (!player || !room) return;
    if (player.ws === ws) player.ws = null;
    broadcast(room, { t: 'peer', id: player.id, connected: false, graceMs: GRACE_MS });
    player.graceTimer = setTimeout(() => {
      if (player.ws) return;
      room.players = room.players.filter((p) => p !== player);
      if (room.phase === 'racing') endRace(room, 'forfeit');
      if (room.hostId === player.id) room.hostId = room.players[0]?.id ?? null;
      if (!room.players.length) rooms.delete(room.code);
      else { room.phase = room.phase === 'racing' ? 'results' : 'waiting'; sync(room); }
    }, GRACE_MS);
    sync(room);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [code, r] of rooms) if (now - r.touched > ROOM_TTL_MS) { broadcast(r, { t: 'error', code: 'ROOM_EXPIRED', message: 'Room expired' }); rooms.delete(code); }
}, 60_000);

server.listen(PORT, () => {
  console.log(`VOXWAKE server on http://localhost:${PORT}  (Voice Duel rooms + static client from ./dist)`);
  if (!fs.existsSync(DIST)) console.log('  (no ./dist yet — run "npm run build", or use "npm run dev" for the Vite dev server)');
});
