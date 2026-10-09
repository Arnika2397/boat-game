import '@fontsource/bodoni-moda/700.css';
import '@fontsource/bodoni-moda/800.css';
import '@fontsource/share-tech-mono/400.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import '@fontsource/modak/400.css';
import './styles.css';

import { app, type RaceContext, type Screen } from './app';
import { WorldView } from './world/view';
import { RaceDirector } from './game/race';
import { LEVELS, endlessLevel } from './game/levels';
import { computeRewards } from './game/rewards';
import { audio } from './audio/audio';
import { flowDeck } from './speech/flowdeck';
import { save, PAINTS } from './state';
import { duel, type DuelResultRow } from './net/duel';
import { loadingScreen } from './ui/screens/loading';
import { titleScreen } from './ui/screens/title';
import { modesScreen } from './ui/screens/modes';
import { setupScreen } from './ui/screens/setup';
import { mapScreen, garageScreen, heatOffset } from './ui/screens/map';
import { postcardScreen } from './ui/screens/postcard';
import { hudScreen, type Hud } from './ui/screens/hud';
import { resultsScreen } from './ui/screens/results';
import { settingsScreen, howtoScreen } from './ui/screens/settings';
import { duelScreen, duelResultsScreen } from './ui/screens/duel';
import { flowGate } from './ui/screens/flowgate';
import { toast } from './ui/dom';
import type { BoatKind } from './game/bots';

const canvas = document.getElementById('world') as HTMLCanvasElement;
let hud: Hud | null = null;
let renderWorld = false;
let attractRace: RaceDirector | null = null;

// ---------------- boot ----------------
function boot() {
  flowDeck.init();
  try {
    app.view = new WorldView(canvas);
  } catch (e) {
    document.getElementById('ui')!.innerHTML = '<div class="screen green" style="display:flex;align-items:center;justify-content:center"><div class="card"><h2>Graphics unavailable</h2><p>VOXWAKE needs WebGL. Try Chrome or Edge with hardware acceleration enabled.</p></div></div>';
    console.error(e);
    return;
  }
  app.view.reducedMotion = save.settings.reducedMotion;
  document.body.classList.toggle('reduced-motion', save.settings.reducedMotion);
  audio.volumes.music = save.settings.music;
  audio.volumes.sfx = save.settings.sfx;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); toast('Graphics context lost — restoring…', true); });
  canvas.addEventListener('webglcontextrestored', () => location.reload());

  loadingScreen([
    () => document.fonts.ready.then(() => undefined),
    () => setupAttract(),
    () => { const p = PAINTS[save.paint] ?? PAINTS.mango; app.thumbs.set(`${save.boat}|${save.paint}`, app.view.boatThumb(save.boat, p.color, p.accent)); },
    () => { app.view.render(); },
  ], () => {
    audio.unlock();
    audio.playing = true;
    audio.intensity = 0;
    const join = app.flags.get('join');
    if (join) app.go('duel', 'join');
    else if (app.flags.get('provider') === 'mock' || app.flags.has('level')) {
      const n = Math.max(1, Math.min(LEVELS.length, Number(app.flags.get('level')) || 1));
      app.startRace({ level: LEVELS[n - 1], levelNumber: n, mode: 'champ', seed: 1000 + n * 77 });
    } else app.go('title');
  });
  requestAnimationFrame(loop);
}

// ---------------- attract scene behind menus ----------------
function setupAttract(levelIdx = 0) {
  const lv = LEVELS[levelIdx];
  attractRace = new RaceDirector({ level: lv, seed: 4242 + levelIdx, mode: 'champ', heat: 0, levelNumber: 1,
    player: { name: 'You', boat: save.boat, color: PAINTS[save.paint]?.color ?? 0xffc21a, accent: PAINTS[save.paint]?.accent ?? 0xff0ccf } });
  attractRace.countdown = 0.61;
  app.view.attract = true;
  app.view.load(attractRace);
  app.race = attractRace;
}

function ensureAttract() {
  hud?.destroy();
  hud = null;
  if (!app.race || app.race !== attractRace || attractRace.state === 'finished') setupAttract(Math.floor(Math.random() * LEVELS.length));
  app.view.attract = true;
  audio.intensity = 0;
}

// ---------------- routing ----------------
app.go = (s: Screen, arg?: unknown) => {
  renderWorld = !(s === 'title' || s === 'loading' || s === 'map');
  if (s !== 'race') ensureAttract();
  switch (s) {
    case 'title': titleScreen(); break;
    case 'modes': modesScreen(); break;
    case 'setup': setupScreen(); break;
    case 'map': mapScreen(); break;
    case 'garage': garageScreen(); break;
    case 'settings': settingsScreen(); break;
    case 'howto': howtoScreen(); break;
    case 'duel': duelScreen(arg); break;
    default: titleScreen();
  }
};

function playerLook() {
  const p = PAINTS[save.paint] ?? PAINTS.mango;
  return { name: save.name || 'You', boat: save.boat, color: p.color, accent: p.accent };
}

app.startRace = (ctx: RaceContext) => {
  hud?.destroy();
  hud = null;
  if (app.race) app.race.paused = true;
  app.ctx = ctx;
  renderWorld = true;
  let race: RaceDirector | null = null;
  postcardScreen(ctx, () => {
    race = new RaceDirector({ level: ctx.level, seed: ctx.seed, mode: ctx.mode === 'duel' ? 'duel' : 'champ', heat: ctx.mode === 'duel' ? 0 : heatOffset(),
      levelNumber: ctx.levelNumber, player: playerLook(), opponent: ctx.mode === 'duel' ? duelOpponentLook() : undefined });
    app.view.attract = false;
    app.view.load(race);
    app.race = race;
    race.paused = true; // hold the countdown until the card is dismissed
  }, () => {
    if (!race) return;
    beginRace(race, ctx);
  }, ctx.mode === 'duel' ? 0 : 4500);
};

function beginRace(race: RaceDirector, ctx: RaceContext) {
  app.view.cinematic = 3.2;
  race.paused = false;
  if (ctx.mode === 'duel' && duelStartAt) {
    const ms = duelStartAt - (Date.now() + duel.offset);
    race.countdown = Math.max(0.8, ms / 1000 + 0.6);
  } else race.countdown = 3.6 + 1.0;
  audio.playing = true;
  audio.intensity = 1;
  hud = hudScreen(race, {
    duel: ctx.mode === 'duel',
    onEnd: () => finishRace(race, ctx),
    onRestart: () => app.startRace({ ...ctx, seed: ctx.seed + 1 }),
    onQuit: () => app.go('map'),
  });
  // Wispr Flow check-in: the first race of a session waits until Flow is proven ON (judges see Flow at work)
  if (save.settings.flowCheck && !flowGatePassed && ctx.mode !== 'duel') {
    race.paused = true;
    race.gate = true;
    flowGate(hud.root, () => {
      flowGatePassed = true;
      race.gate = false;
      race.paused = false;
      app.view.cinematic = 3.2;
    });
  }
}
let flowGatePassed = false;

function finishRace(race: RaceDirector, ctx: RaceContext) {
  if (app.race !== race) return;
  const r = race.results();
  app.lastResults = r;
  if (ctx.mode === 'duel') return; // the room server announces the result (race_end)
  hud?.destroy();
  hud = null;
  const rw = computeRewards(ctx, r, save.settings.heat);
  const nextLevel = ctx.mode === 'champ' && ctx.level.id < LEVELS.length && (save.unlocked > ctx.level.id || save.judgePass) ? ctx.level.id + 1 : 0;
  resultsScreen(ctx, r, rw, {
    again: () => {
      if (ctx.mode === 'endless' && rw.endless?.over) app.startRace({ level: endlessLevel(1), levelNumber: 7, mode: 'endless', endlessDepth: 1, anchors: 3, seed: (Date.now() & 0xffff) });
      else app.startRace({ ...ctx, seed: ctx.seed + 1, anchors: rw.endless ? rw.endless.anchors : ctx.anchors });
    },
    next: ctx.mode === 'endless'
      ? (rw.endless && !rw.endless.over ? () => {
        const depth = rw.endless!.advanced ? (ctx.endlessDepth ?? 1) + 1 : ctx.endlessDepth ?? 1;
        app.startRace({ level: endlessLevel(depth), levelNumber: 6 + depth, mode: 'endless', endlessDepth: depth, anchors: rw.endless!.anchors, seed: ctx.seed + 31 });
      } : null)
      : nextLevel ? () => { app.selectedLevel = nextLevel; app.startRace({ level: LEVELS[nextLevel - 1], levelNumber: nextLevel, mode: 'champ', seed: 1000 + nextLevel * 77 + (save.races % 5) }); } : null,
    map: () => app.go('map'),
  });
}

// ---------------- Voice Duel wiring ----------------
let duelStartAt = 0;
const remoteTarget = { s: 0, lat: 0, v: 0, fin: false, ft: 0, at: 0 };
let posAcc = 0;
let finishSent = false;

function duelOpponentLook() {
  const o = duel.opponent;
  const p = PAINTS[o?.paint ?? 'magenta'] ?? PAINTS.magenta;
  return { name: o?.name ?? 'Friend', boat: (o?.boat ?? 'shack') as BoatKind, color: p.color, accent: p.accent };
}

duel.on('race_init', (m) => {
  duelStartAt = m.startAt;
  finishSent = false;
  Object.assign(remoteTarget, { s: 0, lat: 0, v: 0, fin: false, ft: 0, at: 0 });
  const lv = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, (m.level ?? 1) - 1))];
  app.startRace({ level: lv, levelNumber: lv.id, mode: 'duel', seed: m.seed });
});
duel.on('peer_pos', (m) => Object.assign(remoteTarget, { s: m.s, lat: m.lat, v: m.v, fin: m.fin, ft: m.ft, at: performance.now() }));
duel.on('race_end', (m) => {
  // let a fresh finish celebrate for a moment, otherwise (forfeit / timeout) show the result straight away
  const justFinished = !!app.race?.player.finished && app.ctx?.mode === 'duel';
  setTimeout(() => showDuelResults(m.results, m.wins), justFinished ? 1800 : 0);
});
duel.on('peer', (m) => { if (!m.connected && m.id !== duel.playerId && app.ctx?.mode === 'duel') toast('Friend disconnected — holding their seat for 30 s', true, 3000); });
duel.on('reconnecting', () => toast('Reconnecting to the room…', true, 1500));

function showDuelResults(rows: DuelResultRow[], wins: Record<string, number>) {
  hud?.destroy();
  hud = null;
  app.view.orbitFinish = 0.01;
  duelResultsScreen(rows, wins);
}

function duelTick(dt: number, race: RaceDirector) {
  // smooth the remote boat toward the latest snapshot (extrapolate ≤ 250 ms)
  const age = Math.min(0.25, (performance.now() - remoteTarget.at) / 1000);
  const b = race.boats[1];
  if (b) {
    const ts = remoteTarget.s + remoteTarget.v * age;
    const s = b.s + (ts - b.s) * Math.min(1, dt * 8);
    const lat = b.lat + (remoteTarget.lat - b.lat) * Math.min(1, dt * 8);
    race.setRemote(s, lat, remoteTarget.v, remoteTarget.fin, remoteTarget.ft);
  }
  posAcc += dt;
  const p = race.player;
  if (posAcc >= 0.1 && race.state !== 'countdown') {
    posAcc = 0;
    duel.send({ t: 'pos', s: p.s, lat: p.lat, v: p.v, score: p.score, stage: race.stageIndex, fin: p.finished, ft: p.finishTime });
  }
  if (p.finished && !finishSent) {
    finishSent = true;
    const r = race.results();
    duel.send({ t: 'finish', time: p.finishTime, score: p.score, accuracy: r.accuracy, flow: r.flow });
  }
}

// ---------------- main loop ----------------
let last = performance.now();
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const race = app.race;
  if (race) {
    if (race === attractRace) {
      race.player.T = Math.max(race.player.T, 0.62);
      race.setSteer(Math.sin(now / 2400) * 0.5);
      if (race.state === 'finished') setupAttract(Math.floor(Math.random() * LEVELS.length));
    }
    race.update(dt * app.timeScale);
    if (app.ctx?.mode === 'duel' && race !== attractRace) duelTick(dt, race);
  }
  if (renderWorld || race !== attractRace) {
    app.view.update(dt * app.timeScale);
    hud?.update(dt);
    app.view.render();
  }
  requestAnimationFrame(loop);
}

if (app.flags.has('test')) (window as unknown as { __VOXWAKE__: unknown }).__VOXWAKE__ = { app, save, flowDeck };
boot();
