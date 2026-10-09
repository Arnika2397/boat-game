import { h } from './dom';
import { save, persist, flowKey, hasCustomKey } from '../state';

const PRESETS = ['Ctrl + Win', 'Fn', 'Alt', 'Right Alt', 'Ctrl + Alt', 'Right Ctrl'];

/** Lets each player pick (or record) their own Wispr Flow shortcut; every manual in the game uses it. */
export function flowKeyPicker(onChange?: () => void): HTMLElement {
  const wrap = h('div', { class: 'flowkey' });
  const render = () => {
    const cur = flowKey();
    const rec = h('button', { class: 'chip rec' }, '⏺ Record my key');
    rec.addEventListener('click', () => {
      rec.textContent = 'Press your Wispr Flow shortcut…';
      rec.classList.add('mag');
      const held = new Set<string>();
      let best: string[] = [];
      const name = (e: KeyboardEvent) => {
        if (e.key === 'Control') return e.location === 2 ? 'Right Ctrl' : 'Ctrl';
        if (e.key === 'Alt' || e.key === 'AltGraph') return e.location === 2 ? 'Right Alt' : 'Alt';
        if (e.key === 'Shift') return 'Shift';
        if (e.key === 'Meta' || e.key === 'OS') return navigator.userAgent.includes('Mac') ? 'Cmd' : 'Win';
        if (e.key === ' ') return 'Space';
        return e.key.length === 1 ? e.key.toUpperCase() : e.key;
      };
      const order = ['Ctrl', 'Right Ctrl', 'Shift', 'Alt', 'Right Alt', 'Win', 'Cmd'];
      const down = (e: KeyboardEvent) => {
        e.preventDefault();
        held.add(name(e));
        if (held.size >= best.length) best = [...held];
      };
      const up = (e: KeyboardEvent) => {
        e.preventDefault();
        held.delete(name(e));
        if (held.size === 0 && best.length) {
          best.sort((a, b) => (order.indexOf(a) + 99) % 99 - (order.indexOf(b) + 99) % 99);
          set(best.join(' + '));
          window.removeEventListener('keydown', down, true);
          window.removeEventListener('keyup', up, true);
        }
      };
      window.addEventListener('keydown', down, true);
      window.addEventListener('keyup', up, true);
    });
    wrap.replaceChildren(
      h('div', { class: 'mono', style: 'font-size:12px;margin-bottom:6px' }, 'My Wispr Flow shortcut: ', hasCustomKey() ? h('kbd', null, cur) : h('span', null, 'not set — the game just says “your Wispr Flow key” (optional)')),
      h('div', { class: 'row', style: 'gap:6px' },
        ...PRESETS.map((k) => h('button', { class: 'chip' + (k === cur ? ' on' : ''), onClick: () => set(k) }, k)),
        rec),
      h('div', { class: 'small', style: 'margin-top:6px' }, 'Check it in Wispr Flow → Settings → Shortcuts. In the game: HOLD it while speaking, RELEASE when the sentence is done.'));
  };
  const set = (k: string) => {
    save.settings.flowKey = k;
    persist();
    render();
    onChange?.();
  };
  render();
  return wrap;
}
