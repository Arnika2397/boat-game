import { h, mount, btn, hex } from '../dom';
import { postcardScene } from '../art';
import type { RaceContext } from '../../app';
import { RIVALS } from '../../game/bots';
import { GOA_FACTS } from '../../content/sentences';
import { flowKey } from '../../state';
import { flowDeck } from '../../speech/flowdeck';
import { parseCommands } from '../../core/commands';

/** Pre-race loading screen as a Goan postcard (with a stamp + postmark). Builds the level while you read it. */
export function postcardScreen(ctx: RaceContext, build: () => void, onGo: () => void, autoGoMs = 4500) {
  const lv = ctx.level;
  const bar = h('i');
  const goBtn = btn('Loading…', 'yellow', () => go());
  (goBtn as HTMLButtonElement).disabled = true;
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const fact = GOA_FACTS[(ctx.seed + lv.id) % GOA_FACTS.length];
  const ptt = flowKey().toUpperCase();
  const card = h('div', { class: 'postcard' },
    h('div', { class: 'pic' },
      h('div', { html: postcardScene(lv.theme.id), style: 'position:absolute;inset:0' }),
      h('div', { class: 'greet' }, 'GREETINGS FROM'),
      h('div', { class: 'place' }, lv.place)),
    h('div', { class: 'msg' },
      h('div', { class: 'stamp' }, h('span', null, 'VOXWAKE'), h('span', { class: 'big' }, ctx.mode === 'endless' ? '∞' : String(lv.id).padStart(2, '0')), h('span', null, 'GOA POST')),
      h('div', { class: 'postmark' }, h('span', null, 'VOXWAKE', h('br'), 'POST OFFICE', h('br'), date)),
      h('span', { class: 'kicker', style: 'font-family:var(--display);font-weight:800;color:var(--magenta-deep);letter-spacing:.08em' },
        ctx.mode === 'endless' ? `ENDLESS TIDE · DEPTH ${ctx.endlessDepth} · ⚓×${ctx.anchors}` : `LEVEL ${String(lv.id).padStart(2, '0')}`),
      h('h2', { style: 'font-family:var(--display);font-weight:800;color:var(--green-deep);font-size:36px;margin:0;line-height:1;transform:scaleY(1.15);transform-origin:left;max-width:62%' }, lv.name),
      h('span', { class: 'chip mag', style: 'align-self:flex-start' }, lv.kicker),
      h('div', { class: 'hand' }, lv.postcard),
      h('div', { class: 'small mono', style: 'font-size:11px;color:#5b6b60;text-transform:none' }, '✦ ' + fact),
      h('div', { class: 'rival-row' }, ...RIVALS.map((r) => h('div', { class: 'rival-pill', style: `background:${hex(r.color)};color:${r.id === 'bebinca' ? '#0b3b2a' : '#fff'}` }, h('b', null, r.short), `“${r.line}”`))),
      h('div', { class: 'small mono', style: 'font-size:12px;color:#0b3b2a' }, `HOLD ${ptt} · SPEAK THE SIGN · RELEASE  —  MOUSE STEERS · LMB / “NITRO” · RMB / “JUMP”`),
      h('div', { class: 'go-row' }, h('div', { class: 'load-bar' }, bar), goBtn)));
  const root = h('div', { class: 'screen veil' }, h('div', { class: 'postcard-wrap' }, card));
  mount(root);
  flowDeck.show(true, 'menu');
  let ready = false;
  let gone = false;
  const go = () => {
    if (!ready || gone) return;
    gone = true;
    cleanup();
    onGo();
  };
  const off = flowDeck.onBurst((b) => { if (parseCommands(b.text).commands.some((c) => c.cmd === 'play' || c.cmd === 'again')) go(); });
  const key = (e: KeyboardEvent) => { if (e.key === 'Enter') go(); };
  window.addEventListener('keydown', key);
  const cleanup = () => { off(); window.removeEventListener('keydown', key); };
  (root as HTMLElement & { cleanup?: () => void }).cleanup = cleanup;
  requestAnimationFrame(() => {
    bar.style.width = '35%';
    setTimeout(() => {
      build();
      bar.style.width = '100%';
      setTimeout(() => {
        ready = true;
        (goBtn as HTMLButtonElement).disabled = false;
        goBtn.querySelector('.sc')!.textContent = 'Set sail ▶';
        goBtn.classList.add('drop-in');
        // auto-continue so judges are never stuck on a loading card
        setTimeout(() => go(), autoGoMs);
      }, 500);
    }, 650);
  });
}
