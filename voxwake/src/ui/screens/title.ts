import { h, mount, btn } from '../dom';
import { SUNRISE, PALM_CORNER, boatIcon } from '../art';
import { app } from '../../app';
import { save } from '../../state';
import { flowDeck } from '../../speech/flowdeck';
import { parseCommands } from '../../core/commands';

/** Title — structure follows the event hero (giant Didone wordmark + Devanagari sticker + mono meta + stitched CTA + rising sun). */
export function titleScreen() {
  const letters = 'VOXWAKE'.split('').map((c, i) => h('span', { class: 'l', style: `animation-delay:${0.15 + i * 0.07}s` }, c));
  const flowOk = save.flowSetupDone || flowDeck.flowSeen;
  const root = h('div', { class: 'screen green fade-in' },
    h('div', { class: 'title-top' },
      h('div', { class: 'logo-mark' }, 'वॉक्स', h('small', null, 'VOX · WAKE')),
      h('div', { class: 'nav' },
        h('button', { class: 'link', onClick: () => app.go('howto') }, 'How to play'),
        h('button', { class: 'link', onClick: () => app.go('setup') }, 'Flow setup'),
        h('button', { class: 'link', onClick: () => app.go('settings') }, 'Settings'),
        btn('Play', 'stitched', () => app.go(save.flowSetupDone ? 'modes' : 'setup')),
      ),
    ),
    h('div', { class: 'wordmark' },
      h('div', { style: 'position:relative;display:inline-block' },
        h('span', { class: 'word' }, ...letters),
        h('div', { class: 'sticker', title: 'गोंय — “Goem”, Goa in Konkani' }, 'गोंय'),
      ),
    ),
    h('div', { class: 'meta' }, h('span', null, 'Goa, India · Your voice is the engine'), h('span', null, 'Built for Hacker House Goa ’26')),
    h('div', { class: 'sunrise', html: SUNRISE }),
    h('div', { class: 'palm-corner l', html: PALM_CORNER }),
    h('div', { class: 'palm-corner r', html: PALM_CORNER }),
    h('div', { class: 'title-boat', html: boatIcon('#FF0CCF') }),
    h('div', { class: 'flow-chip' }, h('span', { class: 'dot', style: flowOk ? '' : 'background:#FF0CCF;box-shadow:0 0 10px #FF0CCF' }),
      flowOk ? 'Wispr Flow: looks ready ✓' : 'Wispr Flow: not set up — press Flow setup'),
    h('div', { class: 'press-hint' }, 'Press Enter · or say “vox play”'),
  );
  mount(root);
  flowDeck.show(true, 'menu');
  const off = flowDeck.onBurst((b) => {
    const p = parseCommands(b.text);
    if (p.commands.some((c) => c.cmd === 'play')) go();
  });
  const go = () => { cleanup(); app.go(save.flowSetupDone ? 'modes' : 'setup'); };
  const key = (e: KeyboardEvent) => { if (e.key === 'Enter' && document.activeElement === flowDeck.el && !flowDeck.el.value) go(); };
  window.addEventListener('keydown', key);
  const cleanup = () => { off(); window.removeEventListener('keydown', key); };
  (root as HTMLElement & { cleanup?: () => void }).cleanup = cleanup;
}
