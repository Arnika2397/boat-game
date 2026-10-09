// Voice Duel server test: two WebSocket clients create/join a room, ready up, race, finish, rematch.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 18080 + Math.floor(Math.random() * 1000);
const BASE = `http://localhost:${PORT}`;
let proc;

before(async () => {
  proc = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`${BASE}/api/health`); if (r.ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});
after(() => proc?.kill());

function client() {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`, { headers: { origin: BASE } });
  const inbox = [];
  const waiters = [];
  ws.on('message', (d) => {
    const m = JSON.parse(String(d));
    const w = waiters.findIndex((x) => x.t === m.t && (!x.pred || x.pred(m)));
    if (w >= 0) waiters.splice(w, 1)[0].res(m); else inbox.push(m);
  });
  const next = (t, pred) => {
    const i = inbox.findIndex((m) => m.t === t && (!pred || pred(m)));
    if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
    return new Promise((res, rej) => { waiters.push({ t, pred, res }); setTimeout(() => rej(new Error('timeout waiting for ' + t)), 4000); });
  };
  const open = new Promise((r) => ws.on('open', r));
  return { ws, next, open, send: (m) => ws.send(JSON.stringify(m)) };
}

test('health + room creation returns a 5-char code from the safe alphabet', async () => {
  const r = await fetch(`${BASE}/api/rooms`, { method: 'POST' });
  const j = await r.json();
  assert.match(j.code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/);
});

test('unknown room → ROOM_NOT_FOUND', async () => {
  const c = client();
  await c.open;
  c.send({ t: 'hello', room: 'ZZZZZ', name: 'x' });
  const e = await c.next('error');
  assert.equal(e.code, 'ROOM_NOT_FOUND');
  c.ws.close();
});

test('two players: join, ready, synced race_init, finish → race_end, rematch → new seed; third player rejected', async () => {
  const { code } = await (await fetch(`${BASE}/api/rooms`, { method: 'POST' })).json();
  const a = client(), b = client();
  await Promise.all([a.open, b.open]);
  a.send({ t: 'hello', room: code, name: 'Asha' });
  const wa = await a.next('welcome');
  assert.equal(wa.role, 'host');
  b.send({ t: 'hello', room: code.toLowerCase(), name: 'Ben' });
  const wb = await b.next('welcome');
  assert.equal(wb.role, 'guest');
  const c = client();
  await c.open;
  c.send({ t: 'hello', room: code, name: 'Cat' });
  assert.equal((await c.next('error')).code, 'ROOM_FULL');
  c.ws.close();
  a.send({ t: 'config', level: 4 });
  b.send({ t: 'config', level: 2 });
  assert.equal((await b.next('error')).code, 'NOT_HOST');
  a.send({ t: 'ready', ready: true });
  b.send({ t: 'ready', ready: true });
  const [ia, ib] = await Promise.all([a.next('race_init'), b.next('race_init')]);
  assert.equal(ia.seed, ib.seed);
  assert.equal(ia.startAt, ib.startAt);
  assert.equal(ia.level, 4);
  a.send({ t: 'pos', s: 10, lat: 1, v: 12, score: 50 });
  const p = await b.next('peer_pos');
  assert.equal(p.s, 10);
  a.send({ t: 'finish', time: 40.5, score: 3000, accuracy: 0.97, flow: { wordsDictated: 60, wordsTyped: 0, bursts: 12, wpm: 110 } });
  b.send({ t: 'finish', time: 42.1, score: 2800, accuracy: 0.9, flow: { wordsDictated: 55, wordsTyped: 3, bursts: 14, wpm: 98 } });
  const end = await a.next('race_end');
  assert.equal(end.results[0].name, 'Asha');
  assert.equal(end.wins[wa.playerId], 1);
  a.send({ t: 'rematch', yes: true });
  b.send({ t: 'rematch', yes: true });
  const r2 = await a.next('race_init');
  assert.notEqual(r2.seed, ia.seed);
  a.ws.close();
  b.ws.close();
});

test('cross-origin WebSocket is refused', async () => {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`, { headers: { origin: 'https://evil.example' } });
  const outcome = await new Promise((r) => { ws.on('open', () => r('open')); ws.on('error', () => r('refused')); ws.on('close', () => r('refused')); });
  assert.equal(outcome, 'refused');
});
