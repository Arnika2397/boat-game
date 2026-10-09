import { h, mount, btn, hex, toast } from '../dom';
import { LINE_PALM, UMBRELLA, SCOOTER, CHAIR, GULLS, postcardScene } from '../art';
import { app } from '../../app';
import { save, persist, BOATS, PAINTS, WAKES, rankOf } from '../../state';
import { LEVELS, endlessLevel } from '../../game/levels';
import { RIVALS } from '../../game/bots';
import { fmtTime } from '../dom';

const HEAT = { chill: -0.08, standard: 0, hot: 0.08 } as const;
export const heatOffset = () => HEAT[save.settings.heat];

/** Championship map — the coast signpost (structure from the event's signpost art). */
export function mapScreen() {
  const unlocked = save.judgePass ? LEVELS.length : save.unlocked;
  let sel = Math.min(app.selectedLevel || unlocked, unlocked);
  const preview = h('div', { class: 'card preview drop-in' });
  const signs = h('div', { class: 'signs' });

  const renderPreview = () => {
    const isEndless = sel === 0;
    const lv = isEndless ? endlessLevel(Math.max(1, save.endless.best || 1)) : LEVELS[sel - 1];
    const best = save.levels[String(sel)];
    const heatSeg = h('div', { class: 'seg' }, ...(['chill', 'standard', 'hot'] as const).map((k) =>
      h('button', { class: save.settings.heat === k ? 'on' : '', onClick: () => { save.settings.heat = k; persist(); renderPreview(); } },
        `${k} ${k === 'chill' ? '×0.8' : k === 'hot' ? '×1.3' : '×1'} XP`)));
    preview.replaceChildren(
      h('span', { class: 'kicker' }, isEndless ? 'Endless Tide · roguelike' : `Level ${String(sel).padStart(2, '0')} · ${lv.place}`),
      h('h2', null, isEndless ? 'Endless Tide' : lv.name),
      h('div', { class: 'postcard-mini', html: postcardScene(lv.theme.id) }),
      h('p', null, isEndless ? 'Seeded courses forever. Finish top-3 to go deeper. Three anchors — lose them all and the tide wins.' : lv.tagline),
      h('div', { class: 'row' }, h('span', { class: 'chip mag' }, isEndless ? `Best depth ${save.endless.best}` : lv.kicker),
        !isEndless && best ? h('span', { class: 'chip' }, `Best ${fmtTime(best.bestTime)}`) : null),
      h('div', { class: 'rival-row' }, ...RIVALS.map((r) => h('div', { class: 'rival-pill', style: `background:${hex(r.color)};color:${r.id === 'bebinca' ? '#0b3b2a' : '#fff'}` },
        h('b', null, r.short), r.style))),
      h('div', { class: 'row', style: 'margin:8px 0 14px' }, h('span', { class: 'mono', style: 'font-size:12px' }, 'Rival heat'), heatSeg),
      h('div', { class: 'row' },
        btn(isEndless ? 'Dive in ▶' : 'Race ▶', 'yellow', () => start()),
        btn('Garage', 'outline', () => app.go('garage'))),
    );
  };

  const start = () => {
    if (sel === 0) {
      const depth = 1;
      app.startRace({ level: endlessLevel(depth), levelNumber: 6 + depth, mode: 'endless', endlessDepth: depth, anchors: 3, seed: (Date.now() & 0xffff) + depth });
    } else {
      app.selectedLevel = sel;
      app.startRace({ level: LEVELS[sel - 1], levelNumber: sel, mode: 'champ', seed: 1000 + sel * 77 + (save.races % 5) });
    }
  };

  const renderSigns = () => {
    signs.replaceChildren();
    const endlessOpen = unlocked >= 3 || save.judgePass;
    const endless = h('button', { class: 'arrow lvl leftward' + (sel === 0 ? ' selected' : '') + (endlessOpen ? '' : ' locked'),
      onClick: () => { if (!endlessOpen) { toast('Clear level 3 to unlock Endless Tide'); return; } sel = 0; renderSigns(); renderPreview(); } },
      h('span', { class: 'num' }, '∞'), h('span', { class: 'nm' }, 'ENDLESS TIDE', h('br'), h('span', { class: 'stars' }, endlessOpen ? `DEPTH ${save.endless.best}` : '🔒 CLEAR L3')));
    signs.appendChild(h('div', { class: 'sign-row' }, endless));
    LEVELS.forEach((lv, i) => {
      const n = i + 1;
      const locked = n > unlocked;
      const stars = save.levels[String(n)]?.stars ?? 0;
      const right = i % 2 === 0;
      const b = h('button', { class: `arrow lvl ${right ? 'right rightward' : 'leftward'}${locked ? ' locked' : ''}${sel === n ? ' selected' : ''}`,
        onClick: () => { if (locked) { toast(`Finish top-3 on level ${n - 1} to unlock`); return; } sel = n; renderSigns(); renderPreview(); },
        onDblclick: () => { if (!locked) { sel = n; start(); } } },
        h('span', { class: 'num' }, String(n).padStart(2, '0')),
        h('span', { class: 'nm' }, lv.name.toUpperCase(), h('br'), h('span', { class: 'stars' }, locked ? '🔒 LOCKED' : '★'.repeat(stars) + '☆'.repeat(3 - stars))),
        n === unlocked && !save.levels[String(n)] && !locked ? h('span', { class: 'newtag' }, 'NEW') : null,
        sel === n ? h('span', { class: 'boat-here', style: right ? 'left:auto;right:-50px' : '' }, '⛵') : null);
      signs.appendChild(h('div', { class: 'sign-row' }, b));
    });
  };

  const judge = h('div', { class: 'toggle' + (save.judgePass ? ' on' : ''), onClick: () => { save.judgePass = !save.judgePass; persist(); mapScreen(); } },
    h('span', { class: 'sw' }), '🎟 Judge’s pass — unlock every course');
  const r = rankOf(save.xp);
  const root = h('div', { class: 'screen green map fade-in' },
    h('div', { class: 'bg-sun' }), h('div', { class: 'bg-sea' }), h('div', { class: 'beach' }),
    h('div', { html: LINE_PALM, style: 'position:absolute;left:-30px;bottom:90px;width:260px;z-index:0' }),
    h('div', { html: GULLS, style: 'position:absolute;left:22%;top:120px;width:140px;z-index:0' }),
    h('div', { html: UMBRELLA, style: 'position:absolute;left:14%;bottom:30px;width:150px;z-index:1' }),
    h('div', { html: CHAIR, style: 'position:absolute;left:24%;bottom:20px;width:100px;z-index:1' }),
    h('div', { html: SCOOTER, style: 'position:absolute;left:58%;bottom:14px;width:150px;z-index:1' }),
    h('div', { class: 'post', style: 'left:38vw' }),
    signs, preview,
    h('div', { class: 'back-btn' }, btn('← Modes', 'ghost', () => app.go('modes'))),
    h('div', { class: 'screen-title', style: 'left:auto;right:3.5vw;top:34px;text-align:right;width:auto' },
      h('span', { class: 'mono', style: 'font-size:15px;color:#FFE600;letter-spacing:.1em' }, `RANK ${r.rank} · ${save.xp} XP · ${save.crates} 🎁`)),
    h('div', { class: 'bottom-bar', style: 'left:auto;right:3.5vw;bottom:130px' }, judge),
  );
  mount(root);
  renderSigns();
  renderPreview();
}

/** Garage: pick hull + paint + wake (cosmetic; boats unlock by rank). */
export function garageScreen() {
  const r = rankOf(save.xp);
  const grid = h('div', { class: 'garage-grid' });
  const sw = h('div', { class: 'swatches' });
  const wk = h('div', { class: 'row' });
  const render = () => {
    const p = PAINTS[save.paint];
    grid.replaceChildren(...BOATS.map((b) => {
      const locked = r.rank < b.rank && !save.judgePass;
      const key = `${b.kind}|${save.paint}`;
      let src = app.thumbs.get(key);
      if (!src) { src = app.view.boatThumb(b.kind, p.color, p.accent); app.thumbs.set(key, src); }
      return h('div', { class: 'boat-card' + (save.boat === b.kind ? ' on' : '') + (locked ? ' locked' : ''),
        onClick: () => { if (locked) { toast(`Reach rank ${b.rank} to unlock`); return; } save.boat = b.kind; persist(); render(); } },
        h('img', { src, alt: b.name }), h('div', { class: 'nm' }, b.name), h('div', { class: 'bl' }, locked ? `🔒 RANK ${b.rank}` : b.blurb));
    }));
    sw.replaceChildren(...Object.entries(PAINTS).map(([k, v]) => {
      const owned = save.paints.includes(k) || save.judgePass;
      return h('div', { class: 'swatch' + (save.paint === k ? ' on' : '') + (owned ? '' : ' locked'), title: `${v.name} (${v.rarity})${owned ? '' : ' — find it in a Tiffin Crate'}`,
        style: `background:linear-gradient(135deg, ${hex(v.color)} 60%, ${hex(v.accent)} 60%)`,
        onClick: () => { if (!owned) { toast('Win Tiffin Crates to collect this paint'); return; } save.paint = k; persist(); render(); } });
    }));
    wk.replaceChildren(...Object.entries(WAKES).map(([k, v]) => {
      const owned = save.wakes.includes(k) || save.judgePass;
      return h('button', { class: 'chip' + (save.wake === k ? ' mag' : ''), style: owned ? '' : 'opacity:.35',
        onClick: () => { if (!owned) { toast('Find this wake in a Tiffin Crate'); return; } save.wake = k; persist(); render(); } }, v.name);
    }));
  };
  const root = h('div', { class: 'screen veil fade-in' },
    h('div', { class: 'back-btn' }, btn('← Back', 'ghost', () => app.go('map'))),
    h('div', { class: 'card center-card' },
      h('span', { class: 'kicker' }, `Garage · rank ${r.rank}`),
      h('h2', null, 'Pick your boat'),
      grid,
      h('h2', { style: 'font-size:24px;margin-top:20px' }, 'Paint'), sw,
      h('h2', { style: 'font-size:24px;margin-top:20px' }, 'Wake'), wk,
      h('p', { class: 'small', style: 'margin-top:14px' }, 'All cosmetics are earned by racing — Tiffin Crates drop after every race. No purchases, ever.'),
      h('div', { class: 'row', style: 'margin-top:10px' }, btn('Done', 'yellow', () => app.go('map')))));
  mount(root);
  render();
}
