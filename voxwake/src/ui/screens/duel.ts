import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { h, mount, btn, hex, toast, copyText, fmtTime } from '../dom';
import { app } from '../../app';
import { duel, type DuelResultRow } from '../../net/duel';
import { save, persist, PAINTS } from '../../state';
import { LEVELS } from '../../game/levels';
import { audio } from '../../audio/audio';
import { flowDeck } from '../../speech/flowdeck';
import { parseCommands } from '../../core/commands';
import type { BoatKind } from '../../game/bots';

let publicBase = '';
async function baseUrl() {
  if (publicBase) return publicBase;
  try {
    const r = await fetch('/api/config');
    const j = await r.json();
    publicBase = j.publicBaseUrl || location.origin;
  } catch { publicBase = location.origin; }
  return publicBase;
}

const nameInput = () => {
  const i = h('input', { class: 'name own-input', maxlength: '16', value: save.name, placeholder: 'Your captain name' }) as HTMLInputElement;
  i.addEventListener('input', () => { save.name = i.value.replace(/[^\p{L}\p{N} _.-]/gu, '').slice(0, 16) || 'Captain'; persist(); });
  return i;
};

function frame(...children: (HTMLElement | null)[]) {
  const root = h('div', { class: 'screen veil fade-in' },
    h('div', { class: 'back-btn' }, btn('← Leave', 'ghost', () => { duel.leave(); app.go('modes'); })),
    h('div', { class: 'card center-card' }, ...children));
  return root;
}

function serverDown(err: string) {
  mount(frame(h('span', { class: 'kicker' }, 'Voice Duel'), h('h2', null, 'Room server unreachable'),
    h('div', { class: 'alert' }, err),
    h('ul', { class: 'bullets' },
      h('li', null, 'Run “npm run build” then “npm start” — the server hosts the game and the duel rooms on one port.'),
      h('li', null, 'Friend on another laptop? Share your LAN address or an HTTPS tunnel and set PUBLIC_BASE_URL.')),
    h('div', { class: 'row' }, btn('Retry', 'yellow', () => app.go('duel')), btn('Play Championship instead', 'outline', () => app.go('map')))));
}

export async function duelScreen(arg?: unknown) {
  const deep = app.flags.get('join');
  if (deep && !duel.room) { joinView(deep); return; }
  if (arg === 'join') { joinView(''); return; }
  if (duel.room) { lobbyView(); return; }
  // create
  mount(frame(h('span', { class: 'kicker' }, 'Voice Duel'), h('h2', null, 'Opening a room…')));
  try {
    const code = await duel.createRoom();
    await duel.connect(code, save.name, save.boat, save.paint);
    lobbyView();
  } catch (e) {
    serverDown((e as Error).message);
  }
}

function joinView(prefill: string) {
  const boxes = Array.from({ length: 5 }, (_, i) => h('input', { class: 'own-input', maxlength: '1', value: prefill[i] ?? '' }) as HTMLInputElement);
  boxes.forEach((b, i) => {
    b.addEventListener('input', () => {
      b.value = b.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (b.value && i < 4) boxes[i + 1].focus();
    });
    b.addEventListener('paste', (e) => {
      const t = (e.clipboardData?.getData('text') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const m = t.match(/JOIN=([A-Z0-9]{5})/i);
      const code = (m ? m[1] : t).slice(0, 5);
      if (code.length) { e.preventDefault(); boxes.forEach((bb, k) => (bb.value = code[k] ?? '')); }
    });
    b.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !b.value && i > 0) boxes[i - 1].focus(); if (e.key === 'Enter') doJoin(); });
  });
  const err = h('div');
  const camHost = h('div');
  let stopCam: (() => void) | null = null;
  const doJoin = async (codeArg?: string) => {
    const code = codeArg ?? boxes.map((b) => b.value).join('');
    if (code.length !== 5) { err.replaceChildren(h('div', { class: 'alert' }, 'Enter all 5 characters')); return; }
    stopCam?.();
    err.replaceChildren(h('p', null, 'Joining…'));
    try {
      await duel.connect(code, save.name, save.boat, save.paint);
      history.replaceState(null, '', location.pathname);
      app.flags.delete('join');
      lobbyView();
    } catch (e) {
      err.replaceChildren(h('div', { class: 'alert' }, (e as Error).message));
    }
  };
  const scan = async () => {
    camHost.replaceChildren();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      const video = h('video', { autoplay: true, playsinline: true, muted: true }) as HTMLVideoElement;
      video.srcObject = stream;
      camHost.append(h('div', { class: 'cam-frame' }, video), h('p', { class: 'small' }, 'Hold the host’s QR code up to your webcam'));
      const canvas = document.createElement('canvas');
      const g = canvas.getContext('2d', { willReadFrequently: true })!;
      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> } }).BarcodeDetector;
      const det = BD ? new BD({ formats: ['qr_code'] }) : null;
      let alive = true;
      stopCam = () => { alive = false; stream.getTracks().forEach((t) => t.stop()); };
      const loop = async () => {
        if (!alive) return;
        let text = '';
        if (video.readyState >= 2) {
          if (det) { try { const r = await det.detect(video); text = r[0]?.rawValue ?? ''; } catch { /* fall through */ } }
          if (!text) {
            canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            g.drawImage(video, 0, 0);
            const q = jsQR(g.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
            text = q?.data ?? '';
          }
        }
        const m = text.toUpperCase().match(/JOIN=([A-Z0-9]{5})/) ?? text.toUpperCase().match(/^([A-Z0-9]{5})$/);
        if (m) { audio.crate(); stopCam?.(); doJoin(m[1]); return; }
        setTimeout(loop, 110);
      };
      loop();
    } catch {
      camHost.replaceChildren(h('div', { class: 'alert' }, 'Camera blocked or unavailable — type the code instead.'));
    }
  };
  const root = frame(
    h('span', { class: 'kicker' }, 'Voice Duel · join a friend'),
    h('h2', null, 'Enter the room code'),
    h('div', { class: 'row', style: 'margin:8px 0 14px' }, h('span', { class: 'mono', style: 'font-size:13px' }, 'Your name'), nameInput()),
    h('div', { class: 'code-input' }, ...boxes),
    h('div', { class: 'row', style: 'margin-top:16px' }, btn('Join ▶', 'yellow', () => doJoin()), btn('📷 Scan QR with webcam', 'outline', scan)),
    err, camHost,
    h('p', { class: 'small', style: 'margin-top:12px' }, 'Tip: opening the invite link joins automatically.'));
  (root as HTMLElement & { cleanup?: () => void }).cleanup = () => stopCam?.();
  mount(root);
  flowDeck.show(false);
  if (prefill.length === 5) setTimeout(() => boxes[4].focus(), 50);
  else boxes[0].focus();
}

function lobbyView() {
  const body = h('div');
  const qrCanvas = h('canvas') as HTMLCanvasElement;
  let joinUrl = '';
  baseUrl().then((b) => {
    joinUrl = `${b.replace(/\/$/, '')}/?join=${duel.code}`;
    QRCode.toCanvas(qrCanvas, joinUrl, { width: 220, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0B3B2A', light: '#FFFFFF' } }).catch(() => {});
    render();
  });
  const seat = (p: { name: string; boat: string; paint: string; ready: boolean; connected: boolean; wins: number; host: boolean } | undefined, me: boolean) => {
    if (!p) return h('div', { class: 'seat' }, h('p', null, h('span', { class: 'pulse-ring' }), 'Waiting for your friend…'), h('p', { class: 'small' }, 'Scan the QR · type the code · or open the link'));
    const paint = PAINTS[p.paint] ?? PAINTS.mango;
    const key = `${p.boat}|${p.paint}`;
    let src = app.thumbs.get(key);
    if (!src) { src = app.view.boatThumb(p.boat as BoatKind, paint.color, paint.accent); app.thumbs.set(key, src); }
    return h('div', { class: 'seat' + (p.ready ? ' ready' : '') },
      h('div', { class: 'kicker' }, `${p.host ? 'HOST' : 'GUEST'}${me ? ' · YOU' : ''} · ${p.connected ? '● online' : '◌ reconnecting'}`),
      h('img', { src }), h('h3', { style: 'margin:4px 0;font-family:var(--display);color:var(--green-deep)' }, p.name),
      h('div', { class: 'chip' + (p.ready ? '' : ' mag') }, p.ready ? '✓ READY' : 'NOT READY'),
      p.wins ? h('div', { class: 'small', style: 'margin-top:6px' }, `🏆 ${p.wins} win${p.wins > 1 ? 's' : ''}`) : null);
  };
  const render = () => {
    const room = duel.room;
    if (!room) return;
    const me = duel.me, op = duel.opponent;
    const lvl = room.config.level;
    const courseSeg = h('div', { class: 'seg' }, ...LEVELS.map((l) => h('button', { class: lvl === l.id ? 'on' : '', disabled: !duel.isHost,
      onClick: () => duel.send({ t: 'config', level: l.id }) }, `${l.id} ${l.place}`)));
    body.replaceChildren(
      h('div', { class: 'row', style: 'align-items:flex-start;gap:28px' },
        h('div', null,
          h('span', { class: 'kicker' }, 'Room code'), h('br'),
          h('div', { class: 'code-big' }, room.code),
          h('div', { class: 'row', style: 'margin-top:10px' },
            h('button', { class: 'copy-btn', onClick: () => copyText(room.code) }, 'Copy code'),
            h('button', { class: 'copy-btn', onClick: () => copyText(joinUrl) }, 'Copy invite link')),
          h('p', { class: 'small', style: 'max-width:360px' }, 'Friend: on your laptop open the link, or Voice Duel → Join → type the code / scan this QR with your webcam.')),
        h('div', { class: 'qr-frame' }, qrCanvas)),
      h('div', { class: 'row', style: 'margin:16px 0;gap:16px;align-items:stretch' }, h('div', { style: 'flex:1' }, seat(me, true)), h('div', { style: 'flex:1' }, seat(op, false))),
      h('div', { class: 'row' }, h('span', { class: 'mono', style: 'font-size:13px' }, duel.isHost ? 'Course' : 'Course (host picks)'), courseSeg),
      h('div', { class: 'row', style: 'margin-top:14px' },
        btn(me?.ready ? 'Cancel ready' : 'Ready! (or say “vox ready”)', me?.ready ? 'outline' : 'yellow', () => duel.send({ t: 'ready', ready: !me?.ready })),
        h('span', { class: 'small' }, op ? (op.ready ? 'Your friend is ready!' : 'Waiting for your friend to ready up…') : '')),
      h('p', { class: 'small', style: 'margin-top:12px' }, 'Same room? Use headphones — and try Whisper Mode in Wispr Flow. Voice Duel is play-fair: we check pace and text patterns but can’t prove you spoke.'));
  };
  const root = frame(h('span', { class: 'kicker' }, 'Voice Duel · lobby'), h('h2', null, 'Race a friend'), body);
  const offs = [
    duel.on('room', () => render()),
    duel.on('peer', (m) => { if (m.connected && m.id !== duel.playerId) { toast('Friend joined ✓', true); audio.crate(); } }),
    duel.on('error', (m) => toast(m.message, true, 3500)),
  ];
  const offB = flowDeck.onBurst((b) => { if (parseCommands(b.text).commands.some((c) => c.cmd === 'ready')) duel.send({ t: 'ready', ready: true }); });
  (root as HTMLElement & { cleanup?: () => void }).cleanup = () => { offs.forEach((o) => o()); offB(); };
  mount(root);
  flowDeck.show(true, 'menu');
  render();
}

/** Duel results: photo-finish reveal + side-by-side + rematch. */
export function duelResultsScreen(rows: DuelResultRow[], wins: Record<string, number>) {
  const winner = rows[0];
  const iWon = winner?.id === duel.playerId;
  const margin = rows.length > 1 && rows[0].time && rows[1].time ? Math.abs(rows[1].time - rows[0].time) : 99;
  const cell = (r: DuelResultRow | undefined, k: (r: DuelResultRow) => string) => h('td', { style: 'padding:6px 10px' }, r ? k(r) : '—');
  const me = rows.find((r) => r.id === duel.playerId);
  const op = rows.find((r) => r.id !== duel.playerId);
  const status = h('span', { class: 'small' }, '');
  const offs = [
    duel.on('room', () => {
      const o = duel.opponent;
      status.textContent = o?.ready ? '✓ Your friend wants a rematch!' : 'Waiting for your friend…';
    }),
  ];
  const root = h('div', { class: 'screen veil fade-in' },
    h('div', { class: 'card center-card', style: 'text-align:center' },
      h('span', { class: 'kicker' }, margin < 0.6 ? 'PHOTO FINISH!' : 'Voice Duel · result'),
      h('h2', { style: 'font-size:56px' }, iWon ? 'YOU WIN!' : 'REVENGE?'),
      h('p', null, winner ? `${winner.name} wins${margin < 99 ? ` by ${margin.toFixed(2)}s` : ''}` : ''),
      h('table', { class: 'keys', style: 'margin:10px auto;max-width:620px' },
        h('tr', null, h('td'), h('td', null, h('b', null, 'YOU')), h('td', null, h('b', null, op?.name ?? 'FRIEND'))),
        h('tr', null, h('td', null, 'Time'), cell(me, (r) => (r.time ? fmtTime(r.time) : 'DNF')), cell(op, (r) => (r.time ? fmtTime(r.time) : 'DNF'))),
        h('tr', null, h('td', null, 'Score'), cell(me, (r) => r.score.toLocaleString('en-IN')), cell(op, (r) => r.score.toLocaleString('en-IN'))),
        h('tr', null, h('td', null, 'Accuracy'), cell(me, (r) => `${Math.round(r.accuracy * 100)}%`), cell(op, (r) => `${Math.round(r.accuracy * 100)}%`)),
        h('tr', null, h('td', null, 'Words dictated'), cell(me, (r) => String(r.flow?.wordsDictated ?? 0)), cell(op, (r) => String(r.flow?.wordsDictated ?? 0))),
        h('tr', null, h('td', null, 'Voice WPM'), cell(me, (r) => String(r.flow?.wpm ?? 0)), cell(op, (r) => String(r.flow?.wpm ?? 0))),
        h('tr', null, h('td', null, 'Typed words ⌨'), cell(me, (r) => String(r.flow?.wordsTyped ?? 0)), cell(op, (r) => String(r.flow?.wordsTyped ?? 0))),
        h('tr', null, h('td', null, 'Match wins'), h('td', null, String(wins[duel.playerId] ?? 0)), h('td', null, String(op ? wins[op.id] ?? 0 : 0)))),
      rows.some((r) => r.flags.length) ? h('p', { class: 'small' }, '⚑ Anomaly flags: ' + rows.map((r) => r.flags.join(', ')).filter(Boolean).join(' · ')) : null,
      h('div', { class: 'row', style: 'justify-content:center;margin-top:14px' },
        btn('Rematch!', 'stitched', () => { duel.send({ t: 'rematch', yes: true }); status.textContent = 'Rematch requested — waiting for your friend…'; }),
        btn('Lobby', 'outline', () => app.go('duel')),
        btn('Leave', 'ghost', () => { duel.leave(); app.go('modes'); })),
      status));
  (root as HTMLElement & { cleanup?: () => void }).cleanup = () => offs.forEach((o) => o());
  mount(root);
  if (iWon) { audio.fanfare(true); app.view.confetti(); } else audio.fanfare(false);
  void hex;
}
