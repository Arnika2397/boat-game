import { h, btn } from '../dom';
import { flowKey, hasCustomKey } from '../../state';
import { flowDeck } from '../../speech/flowdeck';
import { tokenize } from '../../core/text';
import { alignBurst } from '../../core/align';
import { flowKeyPicker } from '../flowkey';
import { audio } from '../../audio/audio';

/**
 * Pre-race Wispr Flow check-in: the race does not start until the player has proven Wispr Flow is
 * running (a real Flow transcript lands in the Flow Deck) and switched hands-free mode back on.
 */
export function flowGate(host: HTMLElement, onDone: () => void) {
  let step = 1;
  const body = h('div');
  const status = h('div', { class: 'alert', style: 'background:#f3ecd0;color:#0b3b2a;border-color:#ddd3b2;text-transform:none;margin-top:10px' }, 'Waiting for Wispr Flow…');
  const startBtn = btn('Start race ▶', 'yellow', () => finish());
  (startBtn as HTMLButtonElement).disabled = true;
  startBtn.style.opacity = '.35';
  const target = tokenize('Goa is calling');
  const k = () => flowKey();
  const keyBox = h('div', { class: 'hidden', style: 'margin-top:10px;background:#fff;border:2px dashed #ddd3b2;border-radius:10px;padding:10px 12px' },
    flowKeyPicker(() => render()));
  const render = () => {
    body.replaceChildren(
      h('ol', { class: 'gate-steps' },
        h('li', { class: step > 1 ? 'done' : 'on' }, h('b', null, 'HOLD '), hasCustomKey() ? h('kbd', null, k()) : h('b', null, 'your Wispr Flow shortcut key'), hasCustomKey() ? ' (your Wispr Flow shortcut)' : ' (the key you use to start Wispr Flow dictation)', ' and keep holding.'),
        h('li', { class: step > 1 ? 'done' : 'on' }, 'While holding, say ', h('b', null, '“Goa is calling”'), '.'),
        h('li', { class: step > 1 ? 'done' : 'on' }, h('b', null, 'RELEASE'), ' the key when you finish — Flow types it into the game.'),
        h('li', { class: step === 2 ? 'on' : '' }, h('b', null, 'That’s the whole game: '), 'for every sentence on the sign — hold ', hasCustomKey() ? h('kbd', null, k()) : h('b', null, 'your Wispr Flow key'), ', speak it, release. Each release throws your boat forward.')),
      status,
      h('div', { class: 'row', style: 'margin-top:14px;justify-content:space-between' },
        h('button', { class: 'copy-btn', onClick: () => keyBox.classList.toggle('hidden') }, hasCustomKey() ? `Not ${k()}? Change my shortcut` : 'Optional: show my exact shortcut'),
        startBtn),
      keyBox);
  };
  const card = h('div', { class: 'card flow-gate drop-in' },
    h('span', { class: 'kicker' }, 'Before you race · Wispr Flow check'),
    h('h2', null, 'Hold · Speak · Release'),
    body);
  const wrap = h('div', { class: 'flow-gate-wrap' }, card);
  host.appendChild(wrap);
  render();
  flowDeck.focus();
  const ok = () => {
    step = 2;
    status.className = 'alert';
    status.style.cssText = 'background:#e4fbe9;color:#076b38;border-color:#a8e6b8;text-transform:none;margin-top:10px';
    status.textContent = `✓ Wispr Flow works! In the race: hold ${k()} while speaking each sentence, release when done.`;
    (startBtn as HTMLButtonElement).disabled = false;
    startBtn.style.opacity = '1';
    audio.crate();
    render();
  };
  const off = flowDeck.onBurst((b) => {
    if (step !== 1) return;
    const res = alignBurst(target, tokenize(b.text, true), new Set());
    const matched = res.matched / target.length >= 0.67;
    if (matched && (b.source === 'flow' || b.source === 'autopilot')) ok();
    else if (matched && b.source === 'keyboard') status.textContent = 'That looks typed — please say it with Wispr Flow so the judges can see Flow in action.';
    else status.textContent = `Flow typed “${b.text}” — say exactly “Goa is calling”.`;
  });
  const key = (e: KeyboardEvent) => { if (e.key === 'Enter' && step === 2 && !flowDeck.el.value) finish(); };
  window.addEventListener('keydown', key);
  let done = false;
  const finish = () => {
    if (done || step !== 2) return;
    done = true;
    off();
    window.removeEventListener('keydown', key);
    wrap.remove();
    onDone();
  };
  if (new URLSearchParams(location.search).get('autopilot') === '1') { ok(); setTimeout(finish, 900); }
}
