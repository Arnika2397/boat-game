import { audio } from '../audio/audio';

type Child = Node | string | number | null | undefined | false | Child[];
type Props = Record<string, unknown> & { class?: string; style?: string };

/** Tiny hyperscript helper. Text is always inserted as text nodes (no innerHTML from data). */
export function h(tag: string, props: Props | null = null, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k === 'html') el.innerHTML = String(v); // only used with our own static SVG strings
      else if (k.startsWith('on') && typeof v === 'function') {
        const ev = k.slice(2).toLowerCase();
        if (ev === 'click') {
          el.addEventListener('click', (e) => { audio.ui(); (v as (e: Event) => void)(e); });
          el.addEventListener('pointerenter', () => audio.hover());
        } else el.addEventListener(ev, v as EventListener);
      } else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el: HTMLElement, c: Child) {
  if (c === null || c === undefined || c === false) return;
  if (Array.isArray(c)) { c.forEach((x) => append(el, x)); return; }
  el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
}

export const ui = () => document.getElementById('ui')!;

export function mount(el: HTMLElement) {
  const root = ui();
  root.querySelectorAll(':scope > .screen').forEach((n) => {
    (n as HTMLElement & { cleanup?: () => void }).cleanup?.();
    n.remove();
  });
  root.appendChild(el);
  return el;
}

let toastWrap: HTMLElement | null = null;
export function toast(msg: string, mag = false, ms = 2200) {
  if (!toastWrap) {
    toastWrap = h('div', { class: 'toast-wrap' });
    document.body.appendChild(toastWrap);
  }
  const t = h('div', { class: 'toast' + (mag ? ' mag' : '') }, msg);
  toastWrap.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

export function btn(label: string, kind: 'yellow' | 'outline' | 'ghost' | 'magenta' | 'stitched', onClick: () => void, extra = ''): HTMLElement {
  const cls = kind === 'stitched' ? 'btn stitched' : `btn btn-${kind}`;
  return h('button', { class: `${cls} ${extra}`, onClick }, h('span', { class: 'sc' }, label));
}

export function ropeSign(kind: 'yellow' | 'magenta' | 'cream', ...children: Child[]): HTMLElement {
  return h('div', { class: `rope-sign ${kind}-sign` }, h('div', { class: 'ropes' }), h('div', { class: 'inner' }, ...children));
}

export function copyText(text: string) {
  try {
    navigator.clipboard.writeText(text);
    toast('Copied!');
  } catch {
    toast('Copy failed — select and copy manually');
  }
}

export function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return '--:--.-';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

export const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
