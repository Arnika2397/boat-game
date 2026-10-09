import * as THREE from 'three';
import { h, mount, btn, hex, toast, fmtTime, ropeSign } from '../dom';
import { app } from '../../app';
import { audio } from '../../audio/audio';
import { flowDeck, Autopilot } from '../../speech/flowdeck';
import { save, persist, flowKey, hasCustomKey } from '../../state';
import type { RaceDirector, RaceEvent, Source } from '../../game/race';
import type { Stage } from '../../game/stage';
import { RIVALS } from '../../game/bots';
import { tokenize } from '../../core/text';
import { parseCommands } from '../../core/commands';

const STREAK_CALLS: Record<number, string> = { 3: 'SMOOTH!', 5: 'ON FIRE!', 8: 'UNSTOPPABLE!', 10: 'PERFECT FLOW!' };
const HAZARD_LINES = ['Mind the buoy, Captain!', 'Splash and carry on!', 'That one had your name on it!', 'Shake it off — keep talking!'];
const OVERTAKE_LINES = ['Bye-bye, {n}!', 'You passed {n} like they dropped anchor!', '{n} is eating your wake!', 'Smooth as a Fontainhas lane!'];

export interface Hud {
  update(dt: number): void;
  destroy(): void;
  root: HTMLElement;
}

export function hudScreen(race: RaceDirector, opts: { onEnd: () => void; onRestart: () => void; onQuit: () => void; duel?: boolean }): Hud {
  const view = app.view;
  const L = race.course.length;
  // ---------- DOM ----------
  const words = h('div', { class: 'words' });
  const kick = h('div', { class: 'kick' }, h('span', { class: 'stg' }, 'STAGE 1'), h('span', { class: 'tip' }, 'SAY IT IN ONE BREATH'));
  const sign = ropeSign('cream', kick, words);
  sign.classList.add('sentence', 'swing');
  const signWrap = h('div', { class: 'sentence-wrap' }, sign);
  const scoreEl = h('span', { class: 'sc' }, '0');
  const multEl = h('span', { class: 'mult' }, '×1.0');
  const timeEl = h('div', { class: 'time' }, '00:00.0');
  const lapEl = h('div', { class: 'lap' }, '');
  const ringArc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  const ring = h('div', { class: 'flow-ring', html: `<svg viewBox="0 0 120 120"><defs><linearGradient id="fg" x1="0" x2="1"><stop offset="0" stop-color="#FF0CCF"/><stop offset="1" stop-color="#FFE600"/></linearGradient></defs>
    <circle cx="60" cy="60" r="50" fill="rgba(4,50,26,.7)" stroke="rgba(255,255,255,.18)" stroke-width="10"/></svg>` },
    h('div', { class: 'lbl' }, h('b', null, '0%'), 'FLOW'));
  ringArc.setAttribute('cx', '60'); ringArc.setAttribute('cy', '60'); ringArc.setAttribute('r', '50');
  ringArc.setAttribute('fill', 'none'); ringArc.setAttribute('stroke', 'url(#fg)'); ringArc.setAttribute('stroke-width', '10');
  ringArc.setAttribute('stroke-linecap', 'round'); ringArc.setAttribute('stroke-dasharray', String(2 * Math.PI * 50));
  ringArc.setAttribute('stroke-dashoffset', String(2 * Math.PI * 50));
  ring.querySelector('svg')!.appendChild(ringArc);
  const ringPct = ring.querySelector('b')!;
  const ladderPips = Array.from({ length: 10 }, () => h('i'));
  const ladderLbl = h('div', { class: 'ladder-lbl' }, 'STREAK 0');
  const positions = h('div', { class: 'positions' });
  const posRows = race.racers.map((r, i) => {
    const row = h('div', { class: 'pos-row' + (i === 0 ? ' me' : '') },
      h('span', { class: 'pl' }, String(i + 1)), h('span', { class: 'sw', style: `background:${hex(r.color)}` }), h('span', null, r.short), h('span', { class: 'gap' }, ''));
    positions.appendChild(row);
    return row;
  });
  const pu = (cls: string, name: string, key: string) => h('div', { class: `pu ${cls}` }, h('b', null, name), h('span', { class: 'key' }, key), h('span', { class: 'pips' }, ''));
  const nitroChip = pu('pu-nitro', 'NITRO', 'LMB');
  const shieldChip = pu('pu-shield', 'SHIELD', 'AUTO');
  const jumpChip = pu('pu-jump', 'JUMP', 'RMB');
  const kmh = h('span', { class: 'kmh' }, '0');
  const thr = Array.from({ length: 5 }, () => h('i'));
  const minimap = h('div', { class: 'minimap' }, h('div', { class: 'track' }, h('div', { class: 'sprint' })), h('span', { class: 'flag' }, '🏁'));
  const dots = race.racers.map((r, i) => {
    const d = h('div', { class: 'dot' + (i === 0 ? ' me' : ''), style: i === 0 ? '' : `background:${hex(r.color)}` });
    minimap.appendChild(d);
    return d;
  });
  for (const g of race.course.gates) minimap.appendChild(h('div', { class: 'gate', style: `left:${(g.s / L) * 100}%` }));
  const callouts = h('div', { class: 'callouts' });
  const labels = h('div', { class: 'passthrough', style: 'position:absolute;inset:0;pointer-events:none' });
  const labelEls = race.racers.map((r, i) => {
    if (i === 0) return null;
    const el = h('div', { class: 'label3d', style: `background:${hex(r.color)};color:${r.color === 0xfff1cc ? '#0b3b2a' : '#fff'}` }, r.short);
    labels.appendChild(el);
    return el;
  });
  const speedlines = h('div', { class: 'speedlines' });
  const glow = h('div', { class: 'flow-glow' });
  const lensBox = h('div', { class: 'lens hidden' });
  const micBtn = h('button', { class: 'hud-btn live-btn', title: 'Real-time capture: words count the moment you say them — no key press',
    onClick: () => { save.settings.chromeLive = !flowDeck.micOn; persist(); flowDeck.toggleMic(save.settings.lang); } }, '🎙 CHROME LIVE: OFF');
  const lensBtn = h('button', { class: 'hud-btn', onClick: () => toggleLens() }, '🔍 Flow Lens F8');
  let auto: Autopilot | null = null;
  const autoBtn = h('button', { class: 'hud-btn', onClick: () => toggleAuto() }, '🤖 Demo');
  const hudBtns = h('div', { class: 'hud-btns' },
    opts.duel ? null : h('button', { class: 'hud-btn', onClick: () => pause() }, '⏸ F1'), micBtn, lensBtn, opts.duel ? null : autoBtn);
  const hint = h('div', { class: 'hint hidden' });
  const verifiedChip = h('div', { class: 'flow-verified-chip' });
  const root = h('div', { class: 'screen hud' }, speedlines, glow,
    h('div', { class: 'score-box' }, h('div', { class: 'sc-row' }, scoreEl, multEl), timeEl, lapEl), verifiedChip,
    h('div', { class: 'left-rail' }, ring, h('div', { class: 'ladder' }, ...ladderPips), ladderLbl),
    signWrap, positions, hudBtns, lensBox, labels,
    h('div', { class: 'powerups' }, nitroChip, shieldChip, jumpChip),
    h('div', { class: 'speedo' }, kmh, h('div', { class: 'unit' }, 'KM/H'), h('div', { class: 'thr' }, ...thr)),
    minimap, callouts, hint);
  mount(root);
  flowDeck.show(true, 'race');

  // ---------- sentence sign ----------
  let wordEls: HTMLElement[] = [];
  let gateEl: HTMLElement | null = null;
  let skipEl: HTMLElement | null = null;
  const renderStage = (st: Stage, idx: number) => {
    (kick.querySelector('.stg') as HTMLElement).textContent = `STAGE ${idx + 1}`;
    const tip = flowDeck.micOn ? (idx === 0 ? '● LIVE — JUST SAY IT, NO KEY' : '● LIVE — KEEP TALKING')
      : st.display.length > 8 ? 'LONG ONE — TWO BREATHS IS FINE' : idx === 0 ? `HOLD ${flowKey().toUpperCase()} · SPEAK · RELEASE` : 'HOLD · SAY IT · RELEASE';
    (kick.querySelector('.tip') as HTMLElement).textContent = tip;
    wordEls = st.display.map((w) => h('span', { class: 'w' }, w));
    words.replaceChildren(...wordEls);
    refreshWords(st);
  };
  const refreshWords = (st: Stage) => {
    const act = st.activeDisplay();
    wordEls.forEach((el, i) => {
      const s = st.displayStatus(i);
      el.classList.remove('active', 'upcoming', 'exact', 'near', 'mercy', 'missed');
      if (s !== 'pending') el.classList.add(s);
      else if (i === act) el.classList.add('active');
      else if (act >= 0 && i > act + 4) el.classList.add('upcoming');
    });
  };
  renderStage(race.stage, 0);

  // ---------- helpers ----------
  const callout = (text: string, kind = 'good') => {
    if (callouts.children.length >= 2) callouts.firstElementChild?.remove();
    const c = h('div', { class: `callout ${kind}` }, text);
    callouts.appendChild(c);
    setTimeout(() => c.remove(), 1200);
  };
  let commentaryEl: HTMLElement | null = null;
  let lastCommentary = -10;
  const commentary = (who: string, text: string, color: number) => {
    const now = performance.now() / 1000;
    if (now - lastCommentary < 2.5) return;
    lastCommentary = now;
    commentaryEl?.remove();
    commentaryEl = h('div', { class: 'commentary', style: `border-left-color:${hex(color)}` }, h('b', null, who.toUpperCase()), text);
    root.appendChild(commentaryEl);
    const el = commentaryEl;
    setTimeout(() => el.remove(), 2600);
  };
  const floatScore = (n: number) => {
    const r = sign.getBoundingClientRect();
    const f = h('div', { class: 'float-score', style: `left:${r.right - 60}px;top:${r.bottom - 20}px` }, `+${n}`);
    document.getElementById('ui')!.appendChild(f);
    setTimeout(() => f.remove(), 1000);
  };
  const accStamp = (acc: number) => {
    sign.querySelector('.acc-stamp')?.remove();
    const s = h('div', { class: 'acc-stamp' }, `${Math.round(acc * 100)}%`);
    sign.appendChild(s);
    setTimeout(() => s.remove(), 1200);
  };
  const bounce = (el: HTMLElement, cls = 'bounce') => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  const setIntensity = () => {
    const b = race.player;
    audio.intensity = race.isFlow(0) ? 4 : b.streak >= 6 ? 3 : b.streak >= 3 ? 2 : 1;
  };
  let lastBurstAt = performance.now();
  let flowAfterFinish = false;
  let waitingForFlow: (() => void) | null = null;
  const askFlowStop = () => {
    const ring = h('b', null, '8');
    const card = h('div', { class: 'flow-stop' }, h('div', { class: 'card' },
      h('span', { class: 'kicker' }, '🏁 Finish · Wispr Flow verification'),
      h('h2', { style: 'font-size:26px' }, h('span', null, 'Release (or double-tap) '), h('kbd', null, flowKey()), h('span', null, ' so Wispr Flow verifies your race')),
      h('p', null, 'Flow types your whole race transcript — every word it confirms becomes ✦ Flow-verified. Results in ', ring, 's.'),
      h('div', { class: 'row', style: 'justify-content:center' }, btn('Skip ▶', 'outline', () => go()))));
    root.appendChild(card);
    let left = 8;
    const iv = setInterval(() => { left--; ring.textContent = String(Math.max(0, left)); if (left <= 0) go(); }, 1000);
    let gone = false;
    const go = (delay = 0) => {
      if (gone) return;
      gone = true;
      clearInterval(iv);
      waitingForFlow = null;
      setTimeout(() => { card.remove(); opts.onEnd(); }, delay);
    };
    waitingForFlow = () => { (card.querySelector('h2') as HTMLElement).textContent = '✦ Race verified by Wispr Flow!'; go(1600); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Enter' && !flowDeck.el.value) { window.removeEventListener('keydown', key); go(); } };
    window.addEventListener('keydown', key);
  };
  let micQuiet = 0;
  let nitroTipShown = false;
  let lastSource: Source = 'flow';

  // ---------- race events ----------
  race.on((e: RaceEvent) => {
    switch (e.type) {
      case 'words': {
        refreshWords(e.stage);
        e.credited.forEach((k, n) => {
          const di = e.stage.tokDisp[k];
          const el = wordEls[di];
          setTimeout(() => { if (el) bounce(el, 'pop'); audio.word(n); }, n * 55);
        });
        if (e.missed.length) setTimeout(() => audio.wordMiss(), e.credited.length * 55);
        break;
      }
      case 'burst': {
        lastBurstAt = performance.now();
        lastSource = e.source;
        audio.landed();
        if (e.target === 'live') {
          if (e.credited > 0) view.kick(2.5);
        } else if (e.target === 'main') {
          accStamp(e.accuracy);
          if (e.score) floatScore(e.score);
          if (e.credited > 0) { view.kick(e.clean ? 5 : 3); audio.stroke(e.accuracy); }
        } else if (e.target === 'none') toast('Didn’t match the sign — read the highlighted word', false, 1600);
        updateLens();
        break;
      }
      case 'flowFix': {
        if (e.words.length) {
          callout(`✦ FLOW FIX +${e.words.length}`, 'great');
          toast(`Wispr Flow corrected: ${e.words.slice(0, 5).join(', ')}${e.words.length > 5 ? '…' : ''}`, true, 2600);
        }
        if (e.verified) callout(`✦ FLOW VERIFIED ×${e.verified}`, 'epic');
        verifiedChip.textContent = `✦ WISPR FLOW VERIFIED · ${race.verifiedWords} WORDS`;
        verifiedChip.classList.add('show');
        if (e.afterFinish && waitingForFlow) { waitingForFlow(); }
        audio.bell(1320, audio.now, 0.14);
        audio.streak(1);
        const p = view.boatWorld(0, new THREE.Vector3());
        view.burst(p.x, 2, p.z, [0xff0ccf, 0xffe600, 0xffffff], 40, 6, 1, -3);
        floatScore(e.score);
        updateLens();
        break;
      }
      case 'stageDone':
        audio.stage(e.flawless);
        if (e.flawless) callout('FLAWLESS!', 'great');
        floatScore(e.bonus);
        break;
      case 'newStage':
        sign.classList.remove('swap');
        void sign.offsetWidth;
        sign.classList.add('swap');
        setTimeout(() => renderStage(e.stage, e.index), 200);
        skipEl?.remove(); skipEl = null;
        break;
      case 'streak':
        bounce(multEl);
        if (STREAK_CALLS[e.streak]) { callout(STREAK_CALLS[e.streak], e.streak >= 8 ? 'epic' : 'great'); audio.streak(Math.min(3, Math.floor(e.streak / 3))); }
        setIntensity();
        break;
      case 'powerup': {
        if (e.boat !== 0) break;
        const chip = e.kind === 'nitro' ? nitroChip : e.kind === 'shield' ? shieldChip : jumpChip;
        if (e.action === 'earn') {
          bounce(chip);
          if (e.kind === 'nitro' && !nitroTipShown) {
            nitroTipShown = true;
            callout('NITRO READY — CLICK!', 'great');
            nitroChip.appendChild(h('span', { class: 'cta' }, '← LEFT-CLICK or say “vox nitro”'));
          }
          toast(`+1 ${e.kind.toUpperCase()}${e.via === 'gate' ? ' · bonus gate!' : ''}`, true, 1400);
          if (e.kind === 'shield') audio.shield(); else audio.streak(1);
        } else if (e.action === 'use') {
          nitroChip.querySelector('.cta')?.remove();
          if (e.kind === 'nitro') { audio.nitro(); callout('NITRO!', 'epic'); view.kick(8); }
          else { audio.jump(); callout('WAVE JUMP!', 'great'); }
          const via = e.via === 'snippet' ? ' ⚡ via Flow snippet' : e.via === 'spoken' ? ' 🎙 by voice' : '';
          if (via) toast(`${e.kind.toUpperCase()}${via}`, true, 1500);
        } else if (e.action === 'deny') {
          bounce(chip, 'shake');
          audio.deny();
          toast(e.kind === 'nitro' ? 'No Nitro yet — finish a sentence at 90%+' : 'No Wave Jump yet — win one at a bonus gate', false, 1600);
        } else if (e.action === 'absorb') {
          audio.shieldPop();
          callout('SHIELD!', 'great');
        }
        break;
      }
      case 'hazard': {
        const p = view.boatWorld(e.boat, new THREE.Vector3());
        view.splash(p.x, p.z, e.boat === 0 ? 40 : 18);
        if (e.boat === 0) {
          if (!e.shielded) {
            audio.hit();
            view.hitShake();
            const f = h('div', { class: 'hit-flash' });
            root.appendChild(f);
            setTimeout(() => f.remove(), 300);
            if (Math.random() < 0.6) commentary('Commentary', HAZARD_LINES[Math.floor(Math.random() * HAZARD_LINES.length)], 0xffe600);
          }
        }
        break;
      }
      case 'pickup': {
        audio.pickup(e.chain);
        const p = view.boatWorld(0, new THREE.Vector3());
        view.burst(p.x, 1.5, p.z, [0xffe600, 0xfff6c8], 10, 4, 0.7, -3);
        if (e.chain === 5) callout('CASHEW COMBO!', 'great');
        break;
      }
      case 'flow':
        if (e.boat !== 0) break;
        glow.classList.toggle('on', e.on);
        ring.classList.toggle('on', e.on);
        if (e.on) { audio.flowOn(); commentary('Commentary', 'FLOW STATE — you ARE the engine.', 0xff0ccf); }
        setIntensity();
        break;
      case 'overtake': {
        audio.overtake();
        callout(e.place === 1 ? 'TAKE THE LEAD!' : `OVERTAKE! P${e.place}`, e.place === 1 ? 'epic' : 'good');
        const r = RIVALS.find((x) => x.short === e.passed);
        if (Math.random() < 0.6) commentary('Commentary', OVERTAKE_LINES[Math.floor(Math.random() * OVERTAKE_LINES.length)].replace('{n}', e.passed.charAt(0) + e.passed.slice(1).toLowerCase()), r?.color ?? 0xffe600);
        else if (r) commentary(r.name, r.concede, r.color);
        break;
      }
      case 'overtaken': {
        audio.overtaken();
        const r = RIVALS.find((x) => x.short === e.by);
        if (r && Math.random() < 0.7) commentary(r.name, r.taunt, r.color);
        break;
      }
      case 'finalSprint':
        audio.transpose = 2;
        audio.tempo = 121;
        commentary('Commentary', 'Final sprint — everything you’ve got!', 0xff0ccf);
        break;
      case 'gateOpen': {
        const gw = tokenize(e.gate.phrase);
        gateEl = h('div', { class: 'gate-sign' }, h('span', { class: 'lbl' }, 'BONUS GATE'), h('span', null, `SAY “${e.gate.phrase.toUpperCase()}”`), h('span', null, `· STEER ${e.gate.lat > 2 ? '→' : e.gate.lat < -2 ? '←' : '↑'}`));
        void gw;
        signWrap.appendChild(gateEl);
        audio.bell(880, audio.now, 0.12);
        break;
      }
      case 'gateResult':
        gateEl?.remove(); gateEl = null;
        if (e.success) {
          callout(`GATE! +${(e.reward ?? '').toUpperCase()}`, 'epic');
          view.confetti();
          audio.crate();
        }
        break;
      case 'callout':
        callout(e.text, e.kind);
        if (e.text.startsWith('PHRASE LOCKED') && gateEl) gateEl.classList.add('locked');
        break;
      case 'countdown':
        showCountdown(String(e.n), e.n === 3 ? 'GET READY' : e.n === 2 ? (hasCustomKey() ? `HOLD ${flowKey().toUpperCase()} TO SPEAK` : 'HOLD YOUR FLOW KEY') : 'RELEASE WHEN DONE');
        audio.countdown(e.n);
        break;
      case 'go':
        showCountdown('GO!', 'SPEAK!', true);
        audio.countdown(0);
        audio.intensity = 1;
        break;
      case 'commentary':
        commentary(e.who, e.text, e.color);
        break;
      case 'finish':
        if (e.boat === 0) {
          const place = race.player.place;
          // photo finish: a rival within 0.6 s either side → slow-motion moment
          const close = race.boats.slice(1).some((o) => {
            const gap = o.finished ? Math.abs(o.finishTime - e.time) : (race.course.length - o.s) / Math.max(4, o.v);
            return gap < 0.6;
          });
          if (close && !view.reducedMotion) {
            app.timeScale = 0.25;
            callout('PHOTO FINISH!', 'epic');
            audio.stamp();
            const fl = h('div', { class: 'hit-flash', style: 'background:rgba(255,255,255,.85)' });
            root.appendChild(fl);
            setTimeout(() => fl.remove(), 300);
            setTimeout(() => { app.timeScale = 1; callout(place === 1 ? 'BY A WHISKER!' : 'SO CLOSE!', place === 1 ? 'epic' : 'great'); }, 1300);
          } else
          callout(place === 1 ? 'VICTORY!' : `FINISH · P${place}`, place === 1 ? 'epic' : 'great');
          audio.fanfare(place <= 3);
          view.confetti();
          audio.intensity = 0;
        }
        break;
      case 'raceEnd':
        // Hybrid mode: give the player a moment to double-tap their key so Wispr Flow verifies the race
        if (flowDeck.liveActive && !flowAfterFinish && race.verifiedWords < race.wordsDictated * 0.5) askFlowStop();
        else setTimeout(() => opts.onEnd(), 2600);
        break;
    }
  });

  let cdEl: HTMLElement | null = null;
  const showCountdown = (num: string, sub: string, go = false) => {
    cdEl?.remove();
    const s = ropeSign(go ? 'magenta' : 'yellow', h('div', { class: 'num' }, num), h('div', { class: 'sub' }, sub));
    s.classList.add('drop-in');
    cdEl = h('div', { class: 'countdown' }, s);
    root.appendChild(cdEl);
    const el = cdEl;
    if (go) setTimeout(() => el.remove(), 900);
  };

  // ---------- lens / autopilot ----------
  const toggleLens = () => {
    lensBox.classList.toggle('hidden');
    lensBtn.classList.toggle('on', !lensBox.classList.contains('hidden'));
    updateLens();
  };
  const updateLens = () => {
    if (lensBox.classList.contains('hidden')) return;
    const r = race.results();
    lensBox.replaceChildren(
      h('h4', null, 'FLOW LENS · LIVE'),
      h('div', { class: 'stats' },
        h('span', null, 'Words dictated', h('br'), h('b', null, String(r.flow.wordsDictated))),
        h('span', null, 'Words typed', h('br'), h('b', null, String(r.flow.wordsTyped))),
        h('span', null, 'Bursts', h('br'), h('b', null, String(r.flow.bursts))),
        h('span', null, 'Voice WPM', h('br'), h('b', null, String(r.flow.wpm))),
        h('span', null, 'Snippets fired', h('br'), h('b', null, String(r.flow.snippets))),
        h('span', null, 'Est. time saved', h('br'), h('b', null, `${r.flow.savedSec}s`))),
      ...race.lens.slice(0, 6).map((l) => h('div', { class: 'entry' },
        h('div', { class: 'tx' }, `“${l.text}”`),
        h('div', { class: 'meta2' }, `${l.source.toUpperCase()} · t=${l.t.toFixed(1)}s → ${l.routed} · ${l.credited} words · ${Math.round(l.accuracy * 100)}% · +${(l.gain * 100).toFixed(0)}% throttle · +${l.score}`))));
  };
  const toggleAuto = () => {
    if (auto) { auto.stop(); auto = null; autoBtn.classList.remove('on'); return; }
    auto = new Autopilot(() => {
      if (race.state !== 'racing') return null;
      if (race.activeGate && !race.gateSaid.has(race.activeGate.id)) return race.activeGate.phrase;
      const st = race.stage;
      const p = st.pointer;
      if (p >= st.tokens.length) return null;
      const di = st.tokDisp[p];
      return st.display.slice(di).join(' ');
    });
    auto.start();
    autoBtn.classList.add('on');
    toast('Demo autopilot: simulates a Wispr Flow user', true);
  };
  if (app.flags.get('autopilot') === '1' || app.flags.get('provider') === 'mock') toggleAuto();

  // ---------- input ----------
  const offBurst = flowDeck.onBurst((b) => {
    // While Live Voice is streaming, a pasted Flow phrase would count the same words twice → commands only.
    // Hybrid: Live Voice already moved the boat; Wispr Flow's clean text now corrects what live misheard
    if (race.player.finished && b.source !== 'keyboard') flowAfterFinish = true;
    if (flowDeck.liveActive && b.source !== 'autopilot') { race.flowAssist(b.text, b.source); return; }
    race.handleBurst(b.text, b.source);
  });
  const offLive = flowDeck.onLive((id, text, final) => {
    lastBurstAt = performance.now();
    race.handleLive(id, text, final);
  });
  const offInterim = flowDeck.onInterim((t) => {
    if (t) { hint.classList.remove('hidden'); hint.replaceChildren(h('span', { class: 'live-dot' }), ' ' + t); }
  });
  flowDeck.onMicState = (on, err) => {
    micBtn.classList.toggle('on', on);
    micBtn.textContent = on ? '🔴 CHROME LIVE: ON' : '🎙 CHROME LIVE: OFF';
    flowDeck.setSourceLabel(on ? 'web-speech' : 'flow');
    if (on) (document.getElementById('fd-src') as HTMLElement).textContent = '● LIVE + WISPR FLOW FIX';
    if (err) { showMicHelp(err); save.settings.chromeLive = false; persist(); }
    else if (on) { micHelp?.remove(); toast('Chrome Live on — words also light up as you speak. Wispr Flow still verifies them.', true, 2800); }
  };
  let micHelp: HTMLElement | null = null;
  const showMicHelp = (err: string) => {
    micHelp?.remove();
    const url = location.origin + '/';
    const embedded = err === 'EMBEDDED';
    micHelp = h('div', { class: 'mic-help' }, h('div', { class: 'card' },
      h('span', { class: 'kicker' }, 'Live Voice can’t hear you'),
      h('h2', { style: 'font-size:26px' }, embedded ? 'Open the game in Chrome or Edge' : 'Microphone problem'),
      embedded
        ? h('p', null, 'This preview window blocks the microphone, so real-time voice can’t work here. Open ', h('b', null, url), ' in Google Chrome or Microsoft Edge and allow the microphone when asked. Wispr Flow and typing still work here.')
        : h('p', null, err),
      h('div', { class: 'row', style: 'margin-top:10px' },
        h('button', { class: 'btn btn-yellow', onClick: () => { try { navigator.clipboard.writeText(url); toast('Link copied — paste it into Chrome'); } catch { /* ignore */ } } }, h('span', { class: 'sc' }, 'Copy game link')),
        h('button', { class: 'btn btn-outline', onClick: () => { micHelp?.remove(); micHelp = null; flowDeck.focus(); } }, h('span', { class: 'sc' }, 'Close')))));
    root.appendChild(micHelp);
  };
  // remembered preference: start listening as soon as the race screen opens (mic permission is asked once)
  if (save.settings.chromeLive && !flowDeck.micOn && flowDeck.speechSupported && !flowDeck.embeddedBrowser) flowDeck.toggleMic(save.settings.lang);
  let steerKeys = 0;
  const keyState = { left: false, right: false };
  const onMove = (e: PointerEvent) => {
    if (steerKeys) return;
    const mx = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
    const v = Math.abs(mx) < 0.04 ? 0 : mx;
    race.setSteer(Math.max(-1, Math.min(1, v * 1.15)));
  };
  const onDown = (e: PointerEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('button, .card, input, .lens')) return;
    if (race.paused) return;
    if (e.button === 0) race.command('nitro', 'mouse');
    if (e.button === 2) race.command('jump', 'mouse');
  };
  const onCtx = (e: Event) => e.preventDefault();
  let keySteer = 0;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'F1') { e.preventDefault(); if (!opts.duel) pause(); }
    else if (e.key === 'F8') { e.preventDefault(); toggleLens(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); race.command('nitro', 'key'); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); race.command('jump', 'key'); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); keyState.left = true; steerKeys = 1; }
    else if (e.key === 'ArrowRight') { e.preventDefault(); keyState.right = true; steerKeys = 1; }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') keyState.left = false;
    if (e.key === 'ArrowRight') keyState.right = false;
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('contextmenu', onCtx);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);

  // ---------- pause + lost wake ----------
  let pauseEl: HTMLElement | null = null;
  const pause = (lostWake = false) => {
    if (race.state === 'finished' || pauseEl || race.gate) return;
    race.paused = true;
    audio.playing = false;
    const combo = save.settings.os === 'mac' ? '⌘ + Ctrl + V' : 'Shift + Alt + Z';
    pauseEl = h('div', { class: 'banner' }, h('div', { class: 'card', style: 'text-align:left' },
      h('span', { class: 'kicker' }, lostWake ? 'Lost wake' : 'Paused'),
      h('h2', null, lostWake ? 'The game lost focus' : 'Catch your breath'),
      lostWake ? h('div', { class: 'alert' }, `If Flow typed while you were away, click Resume, then press ${combo} to re-insert your last phrase.`) : h('p', null, 'Sip some coconut water. The sea will wait.'),
      h('div', { class: 'row', style: 'margin-top:16px' },
        btn('Resume', 'yellow', resume), btn('Restart', 'outline', () => { cleanup(); opts.onRestart(); }), btn('Quit to map', 'outline', () => { cleanup(); opts.onQuit(); }))));
    root.appendChild(pauseEl);
  };
  const resume = () => {
    pauseEl?.remove(); pauseEl = null;
    race.paused = false;
    audio.playing = true;
    flowDeck.focus();
  };
  // Live Voice listens even when the window isn't focused, so only pause for Flow/typing players
  flowDeck.onFocusChange = (lost) => { if (lost && !opts.duel && race.state === 'racing' && !flowDeck.micOn) pause(true); };

  // ---------- per-frame ----------
  let posTimer = 0;
  const tmp = new THREE.Vector3();
  const update = (dt: number) => {
    const b = race.player;
    scoreEl.textContent = b.score.toLocaleString('en-IN');
    if (race.verifiedWords > 0) {
      verifiedChip.textContent = `✦ WISPR FLOW VERIFIED · ${race.verifiedWords} WORDS`;
      verifiedChip.classList.add('show');
    }
    const mult = Math.min(3, (1 + 0.1 * Math.min(b.streak, 10)) * (race.isFlow(0) ? 1.5 : 1));
    multEl.textContent = `×${mult.toFixed(1)}`;
    timeEl.textContent = race.state === 'countdown' ? 'READY' : fmtTime(b.finished ? b.finishTime : race.time);
    lapEl.textContent = race.finalSprint ? 'FINAL SPRINT ×1.25' : `${Math.round((b.s / L) * 100)}% · ${Math.max(0, Math.round(L - b.s))} M TO GO`;
    const kmhV = Math.round(b.v * 3.6);
    kmh.textContent = String(kmhV);
    thr.forEach((t, i) => { t.className = b.T > i / 5 + 0.02 ? (i >= 3 ? 'on hi' : 'on') : ''; });
    const flowV = race.isFlow(0) ? Math.max(0, (b.flowUntil - race.time) / 8) : b.flow;
    ringArc.setAttribute('stroke-dashoffset', String(2 * Math.PI * 50 * (1 - flowV)));
    ringPct.textContent = race.isFlow(0) ? `${Math.ceil(b.flowUntil - race.time)}s` : `${Math.round(b.flow * 100)}%`;
    ladderPips.forEach((p, i) => { p.className = i < b.streak ? (i >= 7 ? 'on hot' : 'on') : ''; });
    ladderLbl.textContent = `STREAK ${b.streak}`;
    nitroChip.classList.toggle('ready', b.nitro > 0);
    nitroChip.classList.toggle('active', race.isNitro(0));
    nitroChip.querySelector('.pips')!.textContent = '●'.repeat(b.nitro) + '○'.repeat(2 - b.nitro);
    shieldChip.classList.toggle('ready', b.shield);
    shieldChip.querySelector('.pips')!.textContent = b.shield ? '●' : '○';
    jumpChip.classList.toggle('ready', b.jump > 0);
    jumpChip.querySelector('.pips')!.textContent = b.jump > 0 ? '●' : '○';
    speedlines.style.opacity = view.reducedMotion ? '0' : String(Math.max(0, (b.v - 15) / 16) * 0.8 + (race.isNitro(0) ? 0.3 : 0));
    // demo autopilot also steers around hazards and fires Nitro like a real player
    if (auto && race.state === 'racing') {
      if (b.nitro > 0 && Math.random() < dt * 0.7) race.command('nitro', 'mouse');
      const hw = race.course.halfWidth - 2;
      let target = Math.sin(race.time * 0.4) * hw * 0.4;
      for (const hz of race.course.hazards) {
        const ds = hz.s - b.s;
        if (ds < 0 || ds > 45) continue;
        const hl = race.course.hazardLat(hz, race.time);
        if (Math.abs(hl - target) < hz.r + 2.5) target = hl > 0 ? hl - hz.r - 3.5 : hl + hz.r + 3.5;
      }
      const g = race.activeGate;
      if (g) target = g.lat;
      race.setSteer(Math.max(-1, Math.min(1, target / hw)));
    }
    // keyboard steering
    if (steerKeys) {
      keySteer += ((keyState.right ? 1 : 0) - (keyState.left ? 1 : 0)) * dt * 2.2;
      keySteer *= keyState.left || keyState.right ? 1 : Math.exp(-dt * 2);
      keySteer = Math.max(-1, Math.min(1, keySteer));
      race.setSteer(keySteer);
    }
    // minimap
    race.boats.forEach((bb, i) => { dots[i].style.left = `${Math.min(100, (bb.s / L) * 100)}%`; });
    // positions list
    posTimer -= dt;
    if (posTimer <= 0) {
      posTimer = 0.2;
      const order = race.boats.map((bb, i) => ({ bb, i })).sort((x, y) => x.bb.place - y.bb.place);
      order.forEach((o, k) => {
        const row = posRows[o.i];
        row.style.transform = `translateY(${(k - o.i) * 44}px)`;
        (row.querySelector('.pl') as HTMLElement).textContent = String(k + 1);
        const gap = o.bb.finished ? fmtTime(o.bb.finishTime) : o.i === 0 ? '' : (() => {
          const d = o.bb.s - b.s;
          const sec = d / Math.max(6, b.v);
          return `${sec >= 0 ? '+' : ''}${sec.toFixed(1)}s`;
        })();
        (row.querySelector('.gap') as HTMLElement).textContent = gap;
      });
    }
    // rival labels
    labelEls.forEach((el, i) => {
      if (!el) return;
      view.boatWorld(i, tmp);
      tmp.y += 3.6;
      const p = view.project(tmp);
      const d = Math.abs(race.boats[i].s - b.s);
      el.style.display = p.visible && d < 120 && race.state !== 'countdown' ? '' : 'none';
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
    });
    // idle hint + skip chip
    if (race.state === 'racing' && !b.finished) {
      const idle = (performance.now() - lastBurstAt) / 1000;
      if (idle > 4.5 && flowDeck.micOn) {
        hint.classList.remove('hidden');
        const silentSince = (performance.now() - flowDeck.lastResultAt) / 1000;
        micQuiet = flowDeck.micLevel < 0.015 ? micQuiet + dt : 0;
        if (micQuiet > 6)
          hint.replaceChildren(h('span', { class: 'live-dot' }), ' Chrome’s mic gets no sound — click the mic icon in the address bar and pick the same microphone Wispr Flow uses');
        else if (flowDeck.micLevel > 0.12 && silentSince > 5)
          hint.replaceChildren(h('span', { class: 'live-dot' }), ' Mic hears you but no words yet — check your internet (Chrome’s live speech is online) and speak clearly');
        else hint.replaceChildren(h('span', { class: 'live-dot' }), ' Live — just read the highlighted words. Wispr Flow on? Its text will polish the result when you stop.');
      } else if (idle > 4.5 && !flowDeck.micOn) {
        hint.classList.remove('hidden');
        hint.replaceChildren('Hold ', h('kbd', null, flowKey()), ' · say the highlighted words · release when the sentence is done');
      } else if (!flowDeck.micOn) hint.classList.add('hidden');
      sign.classList.toggle('thinking', idle > 0.6 && idle < 2 && lastSource === 'flow');
      if (race.time - Math.max(race.stage.shownAt, race.stageStalledAt) > 11 && !skipEl) {
        skipEl = h('div', { class: 'skip-chip' }, btn('Skip sentence ↷', 'magenta', () => { race.skipStage(); skipEl?.remove(); skipEl = null; }));
        signWrap.appendChild(skipEl);
      }
    }
    audio.setEngine(b.v, race.state === 'racing');
    if (Math.random() < dt * 0.08) audio.gull();
  };

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    offBurst();
    offInterim();
    offLive();
    auto?.stop();
    if (flowDeck.micOn) flowDeck.stopMic();
    flowDeck.onFocusChange = null;
    flowDeck.onMicState = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('contextmenu', onCtx);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKeyUp);
    audio.setEngine(0, false);
    app.timeScale = 1;
    audio.transpose = 0;
    audio.tempo = 112;
  };
  (root as HTMLElement & { cleanup?: () => void }).cleanup = cleanup;
  return { update, destroy: cleanup, root };
}
