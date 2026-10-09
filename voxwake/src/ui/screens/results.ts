import { h, mount, btn, hex, fmtTime, copyText } from '../dom';
import { postcardScene } from '../art';
import { app, type RaceContext } from '../../app';
import { audio } from '../../audio/audio';
import { save, rankOf, rankTitle, cumXP } from '../../state';
import { openCrate, type RewardSummary } from '../../game/rewards';
import { LEVELS } from '../../game/levels';
import type { RaceResults } from '../../game/race';
import { flowDeck } from '../../speech/flowdeck';
import { parseCommands } from '../../core/commands';

export function resultsScreen(ctx: RaceContext, r: RaceResults, rw: RewardSummary, actions: { again: () => void; next: (() => void) | null; map: () => void }) {
  const win = r.place === 1;
  const headline = ctx.mode === 'endless'
    ? (rw.endless!.over ? 'THE TIDE WINS' : rw.endless!.advanced ? `DEPTH ${rw.endless!.depth} CLEARED!` : 'ANCHOR LOST!')
    : win ? 'VICTORY!' : r.place <= 3 ? 'ON THE PODIUM!' : r.margin < 1.5 ? 'SO CLOSE…' : 'NICE WAKE!';
  const starsEl = h('div', { class: 'stars' }, ...[0, 1, 2].map((i) => h('span', { class: i < rw.stars ? 'on' : '', style: `animation-delay:${0.6 + i * 0.35}s` }, '★')));
  setTimeout(() => { for (let i = 0; i < rw.stars; i++) setTimeout(() => audio.stamp(), i * 350); }, 600);

  const podium = h('div', { class: 'podium' }, ...r.order.map((o, i) => h('div', { class: 'row' + (o.r.isPlayer ? ' me' : ''), style: `animation-delay:${i * 0.1}s` },
    h('span', { class: 'pl' }, String(i + 1)), h('span', { class: 'sw', style: `width:14px;height:14px;border-radius:4px;border:2px solid #0b3b2a;background:${hex(o.r.color)}` }),
    h('span', null, o.r.isPlayer ? 'YOU' : o.r.short), h('span', { class: 'tm' }, fmtTime(o.b.finishTime)))));
  const tauntRival = r.order.find((o) => o.r.rival && (win ? true : o.b.place < r.place))?.r.rival;
  const quote = tauntRival ? h('div', { class: 'commentary', style: `position:relative;left:auto;top:auto;transform:none;margin-top:14px;white-space:normal;border-left-color:${hex(tauntRival.color)}` },
    h('b', null, tauntRival.name.toUpperCase()), win ? tauntRival.concede : tauntRival.taunt) : null;

  // ---------- stats + flow stats ----------
  const stat = (k: string, v: string) => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
  const tab = h('div');
  const tabs = h('div', { class: 'tabs' });
  const pages: Record<string, () => HTMLElement> = {
    'Race': () => h('div', { class: 'stat-grid' },
      stat('Score', r.score.toLocaleString('en-IN')), stat('Time', fmtTime(r.time) + (rw.newBest ? ' ★PB' : '')),
      stat('Accuracy', `${Math.round(r.accuracy * 100)}%`), stat('Best streak', String(r.bestStreak)),
      stat('Sentences', String(r.stages)), stat('Cashews', String(r.pickups)),
      stat('Hazards hit', String(r.hits)), stat('Nitros used', String(r.nitros))),
    'Flow stats': () => h('div', null,
      h('div', { class: 'stat-grid' },
        stat('Words dictated', String(r.flow.wordsDictated)), stat('Words typed', String(r.flow.wordsTyped)),
        stat('Voice bursts', String(r.flow.bursts)), stat('Voice WPM', String(r.flow.wpm)),
        stat('Est. time saved', `${r.flow.savedSec}s`), stat('Snippet commands', String(r.flow.snippets + r.flow.spoken)),
        stat('✦ Flow-verified', `${r.flow.verified} words · ${r.flow.verifiedPct}%`)),
      h('p', { class: 'small' }, `est. = vs typing at 40 WPM · ${r.flow.voicePct}% of your words were spoken · lifetime ${save.flowLifetime.words} words dictated`)),
    'Cost you time': () => {
      const tips: string[] = [];
      if (r.slowest) tips.push(`Slowest sentence: “${r.slowest.text}” took ${r.slowest.sec.toFixed(1)}s. Try saying it in one breath — Flow handles long phrases.`);
      if (r.hits) tips.push(`${r.hits} hazard hit${r.hits > 1 ? 's' : ''} — each costs ~1s. Keep the mouse moving; Shields come from 4 clean phrases in a row.`);
      if (r.nitros === 0) tips.push('You never used Nitro! Left-click (or say “vox nitro”) when the chip glows.');
      if (r.flow.wordsTyped > r.flow.wordsDictated) tips.push('Most words were typed — dictating with Wispr Flow is ~3× faster.');
      if (!tips.length) tips.push('Honestly? Nothing. That was clean. Try Hot heat.');
      return h('ul', { class: 'bullets' }, ...tips.map((t) => h('li', null, t)));
    },
    'Pit stop': () => r.misheard.length
      ? h('div', null, h('p', null, 'Words Flow may have misheard — add them to your Wispr Flow dictionary:'),
        h('ul', { class: 'bullets pit' }, ...r.misheard.map((m) => h('li', null, `${m.word} → heard “${m.heard}”`))),
        btn('Copy dictionary entries', 'outline', () => copyText([...new Set(r.misheard.map((m) => m.word))].join('\n'))))
      : h('p', null, 'No misheard words this race. Flow nailed it. ✦'),
  };
  let cur = 'Race';
  const renderTab = () => {
    tabs.replaceChildren(...Object.keys(pages).map((k) => h('button', { class: k === cur ? 'on' : '', onClick: () => { cur = k; renderTab(); } }, k)));
    tab.replaceChildren(pages[cur]());
  };
  renderTab();
  const statsCard = h('div', { class: 'card', style: 'animation:dropIn .6s .1s both' }, h('span', { class: 'kicker' }, ctx.level.name), h('h2', null, 'Race report'), tabs, tab);

  // ---------- progress ----------
  const rk = rankOf(rw.xpBefore);
  const xpFill = h('i', { style: `width:${rk.pct * 100}%` });
  const xpLbl = h('span', null, `+${rw.xpGain} XP`);
  const crateCount = h('span', { class: 'chip' }, `🎁 ×${save.crates}`);
  const crateBox = h('div', { class: 'crate' }, h('div', { class: 'box' }), h('div', { class: 'lid' }));
  const reveal = h('div', { style: 'min-height:84px' });
  crateBox.addEventListener('click', () => {
    stopQueue();
    if (save.crates <= 0) { reveal.replaceChildren(h('p', { class: 'small' }, 'No crates left — race again for more!')); return; }
    crateBox.classList.remove('open');
    crateBox.classList.add('shake');
    audio.tick();
    setTimeout(() => {
      const item = openCrate();
      crateBox.classList.remove('shake');
      crateBox.classList.add('open');
      audio.crate();
      app.view.confetti();
      crateCount.textContent = `🎁 ×${save.crates}`;
      reveal.replaceChildren(h('div', { class: 'reveal' },
        item.color !== undefined ? h('div', { class: 'sw', style: `background:linear-gradient(135deg, ${hex(item.color)} 60%, ${hex(item.accent!)} 60%)` }) : h('div', { style: 'font-size:34px' }, item.kind === 'wake' ? '🌊' : '✨'),
        h('b', { class: `rar-${item.rarity}` }, `${item.rarity.toUpperCase()} · ${item.name}`), h('br'),
        h('span', { class: 'small' }, `${item.kind === 'xp' ? '' : 'New ' + item.kind + '! Equip it in the Garage · '}Epic in ≤ ${6 - save.pity}`)));
    }, 650);
  });
  const nextIdx = ctx.mode === 'champ' ? ctx.level.id + 1 : 0;
  const nextLv = nextIdx && nextIdx <= LEVELS.length ? LEVELS[nextIdx - 1] : null;
  const nextUnlocked = nextLv && (nextIdx <= save.unlocked || save.judgePass);
  const progCard = h('div', { class: 'card', style: 'animation:dropIn .6s .2s both' },
    h('span', { class: 'kicker' }, `Rank ${rw.rankAfter} · ${rankTitle(rw.rankAfter)}`),
    h('div', { class: 'xpbar' }, xpFill, xpLbl),
    h('p', { class: 'small' }, rw.nextStarHint),
    rw.unlockedLevel ? h('div', { class: 'alert', style: 'background:#fff7b0;color:#076b38;border-color:#e6d84a' }, `🔓 NEW COURSE UNLOCKED: ${LEVELS[rw.unlockedLevel - 1].name.toUpperCase()}`) : null,
    rw.endless ? h('div', { class: 'alert', style: 'background:#e4fbe9;color:#076b38;border-color:#a8e6b8' },
      `DEPTH ${rw.endless.depth} · TIDE SCORE ${rw.endless.tide.toLocaleString('en-IN')} · ⚓×${Math.max(0, rw.endless.anchors)}`) : null,
    h('div', { class: 'row', style: 'justify-content:space-between;margin-top:8px' }, h('b', { style: 'font-family:var(--display);color:var(--green-deep);font-size:20px' }, 'Tiffin Crate'), crateCount),
    crateBox, h('p', { class: 'small', style: 'text-align:center;margin:0' }, 'Click the crate!'), reveal,
    nextLv ? h('div', { class: 'teaser', style: 'margin-top:8px' },
      h('div', { class: 'thumb', html: postcardScene(nextLv.theme.id) }),
      h('div', null, h('span', { class: 'kicker' }, nextUnlocked ? 'Up next' : 'Locked — finish top-3'), h('div', { style: 'font-family:var(--display);font-weight:800;color:var(--green-deep);font-size:20px' }, nextLv.name),
        h('span', { class: 'chip mag', style: 'font-size:10px' }, nextLv.kicker))) : null);

  // ---------- actions + auto-queue ----------
  const ringC = 2 * Math.PI * 22;
  const queueRing = h('div', { class: 'queue-ring', html: `<svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="5"/><circle class="q" cx="26" cy="26" r="22" fill="none" stroke="#FFE600" stroke-width="5" stroke-dasharray="${ringC}" stroke-dashoffset="0" transform="rotate(-90 26 26)"/></svg>` });
  const qText = h('span', { class: 'mono', style: 'font-size:13px' }, '');
  const endlessNext = rw.endless && !rw.endless.over;
  const primary = endlessNext ? 'Dive deeper ▶' : nextUnlocked && (win || r.place <= 3) ? 'Next level ▶' : 'Race again ⏎';
  const doPrimary = () => { stopQueue(); cleanup(); (endlessNext || (nextUnlocked && r.place <= 3) ? (actions.next ?? actions.again) : actions.again)(); };
  const act = h('div', { class: 'actions' },
    btn(primary, 'stitched', doPrimary),
    primary.startsWith('Race again') ? (nextUnlocked ? btn('Next level ▶', 'yellow', () => { stopQueue(); cleanup(); actions.next?.(); }) : null) : btn('Race again', 'yellow', () => { stopQueue(); cleanup(); actions.again(); }),
    btn('Map', 'ghost', () => { stopQueue(); cleanup(); actions.map(); }),
    queueRing, qText);
  const root = h('div', { class: 'screen veil fade-in' },
    h('div', { class: 'results' },
      h('div', { class: 'head' }, h('div', null, h('span', { class: 'display' }, headline), h('div', { class: 'mono', style: 'color:#FFE600;margin-top:16px;font-size:15px' }, `P${r.place} OF ${r.order.length} · ${ctx.level.name.toUpperCase()} · SAY “VOX AGAIN” TO GO`),
        h('span', { class: 'chip mag', style: 'margin-top:10px;display:inline-block' }, `✦ ${r.flow.verifiedPct}% WISPR FLOW-VERIFIED · ${r.flow.verified} WORDS`)), starsEl),
      h('div', null, podium, quote), statsCard, progCard, act));
  mount(root);
  flowDeck.show(true, 'menu');
  // XP bar fill animation (+ rank up)
  setTimeout(() => {
    const after = rankOf(save.xp);
    if (rw.rankAfter > rw.rankBefore) {
      xpFill.style.width = '100%';
      setTimeout(() => {
        xpFill.style.transition = 'none';
        xpFill.style.width = '0%';
        void xpFill.offsetWidth;
        xpFill.style.transition = '';
        xpFill.style.width = `${after.pct * 100}%`;
        audio.fanfare(true);
        const ru = h('div', { class: 'rankup' }, h('div', { class: 'card' }, h('span', { class: 'kicker' }, 'Rank up!'), h('h2', { style: 'font-size:48px' }, `Rank ${after.rank}`), h('p', null, rankTitle(after.rank)),
          after.rank === 2 ? h('p', null, '🔓 Shack Runner unlocked in the Garage') : after.rank <= 5 ? h('p', null, '🔓 A new boat waits in the Garage') : null));
        document.getElementById('ui')!.appendChild(ru);
        setTimeout(() => ru.remove(), 2700);
      }, 1500);
    } else xpFill.style.width = `${after.pct * 100}%`;
    xpLbl.textContent = `+${rw.xpGain} XP · ${save.xp - (after.rank === 1 ? 0 : cumXP(after.rank - 1))}/${after.need} to rank ${after.rank + 1}`;
  }, 400);
  if (win) setTimeout(() => app.view.confetti(), 300);

  let qLeft = 12, qTimer = 0, hovering = false;
  const qCircle = queueRing.querySelector('.q') as SVGCircleElement;
  const tickQ = () => {
    if (!hovering) qLeft -= 0.1;
    qCircle.setAttribute('stroke-dashoffset', String(ringC * (1 - qLeft / 12)));
    qText.textContent = `${primary.replace(/[▶⏎]/g, '').trim()} in ${Math.ceil(qLeft)}s`;
    if (qLeft <= 0) doPrimary();
  };
  qTimer = window.setInterval(tickQ, 100);
  root.addEventListener('pointerenter', () => (hovering = true));
  root.addEventListener('pointerleave', () => (hovering = false));
  const stopQueue = () => { clearInterval(qTimer); queueRing.style.opacity = '0'; qText.textContent = ''; };
  root.addEventListener('pointerdown', () => stopQueue(), { capture: true });
  const off = flowDeck.onBurst((b) => {
    const c = parseCommands(b.text).commands[0];
    if (!c) return;
    if (c.cmd === 'again' || c.cmd === 'play') doPrimary();
    if (c.cmd === 'next' && actions.next) { stopQueue(); cleanup(); actions.next(); }
    if (c.cmd === 'menu') { stopQueue(); cleanup(); actions.map(); }
  });
  const key = (e: KeyboardEvent) => { if (e.key === 'Enter' && !flowDeck.el.value) doPrimary(); };
  window.addEventListener('keydown', key);
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearInterval(qTimer);
    off();
    window.removeEventListener('keydown', key);
  };
  (root as HTMLElement & { cleanup?: () => void }).cleanup = cleanup;
}
