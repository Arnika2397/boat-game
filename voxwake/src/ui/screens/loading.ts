import { h, mount, ropeSign, btn } from '../dom';
import { WAVE_LINE, boatIcon, GULLS } from '../art';
import { GOA_FACTS } from '../../content/sentences';

const STEPS = [
  { k: 'STEP 01 — WAKE THE TIDE', s: 'FILLING THE ARABIAN SEA', c: 'yellow' as const },
  { k: 'STEP 02 — PAINT THE TOWN', s: 'FRESH COAT ON EVERY BALCÃO', c: 'magenta' as const },
  { k: 'STEP 03 — CALL THE RIVALS', s: 'CAJU. BEBINCA. VASCO. SUSEGAD.', c: 'magenta' as const },
  { k: 'STEP 04 — TUNE YOUR VOICE', s: 'HOLD. SPEAK. SURGE.', c: 'yellow' as const },
];

/** Creative boot screen: rope-hung signs drop in as each real loading task finishes. */
export function loadingScreen(tasks: (() => Promise<void> | void)[], onDone: () => void) {
  const signs = STEPS.map((st) => {
    const s = ropeSign(st.c, h('div', { class: 'step' }, st.k), h('div', { class: 'sub' }, st.s));
    return s;
  });
  const boat = h('div', { class: 'boat', html: boatIcon('#FF0CCF'), style: 'left:0%' });
  const sea = h('div', { class: 'sea-line', html: WAVE_LINE });
  sea.appendChild(boat);
  const fact = h('div', { class: 'fact' }, GOA_FACTS[0]);
  const center = h('div', { class: 'center' }, sea, fact);
  const title = h('div', { class: 'big-title' }, h('span', { class: 'display' }, 'VOXWAKE'));
  const root = h('div', { class: 'screen green loading fade-in' },
    h('div', { class: 'awning' }),
    h('div', { class: 'gulls', html: GULLS, style: 'position:absolute;right:8vw;top:290px;width:120px;opacity:.8;z-index:1' }),
    h('div', { class: 'signs' }, ...signs),
    title, center);
  mount(root);

  let fi = 0;
  const factTimer = setInterval(() => {
    fi = (fi + 1) % GOA_FACTS.length;
    fact.textContent = GOA_FACTS[fi];
  }, 2600);

  const fill = sea.querySelector('.fillwave') as SVGPathElement;
  const setProgress = (p: number) => {
    boat.style.left = `calc(${p * 100}% - ${p * 54}px)`;
    fill.style.transition = 'stroke-dashoffset .4s ease';
    fill.style.strokeDashoffset = String(900 * (1 - p));
  };

  (async () => {
    for (let i = 0; i < tasks.length; i++) {
      await new Promise((r) => setTimeout(r, 380));
      try { await tasks[i](); } catch (e) { console.warn('loading task failed', e); }
      signs[i]?.classList.add('on', 'drop-in');
      setTimeout(() => signs[i]?.classList.add('swing'), 700);
      setProgress((i + 1) / tasks.length);
    }
    await new Promise((r) => setTimeout(r, 450));
    clearInterval(factTimer);
    fact.textContent = 'Best with Wispr Flow + headphones · click to unlock sound';
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener('keydown', go);
      onDone();
    };
    const go = (e: KeyboardEvent) => { if (e.key === 'Enter') finish(); };
    center.insertBefore(btn('Tap to set sail', 'stitched', finish, 'drop-in'), sea);
    window.addEventListener('keydown', go);
  })();
}
