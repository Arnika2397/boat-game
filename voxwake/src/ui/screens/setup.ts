import { h, mount, btn, copyText } from '../dom';
import { app } from '../../app';
import { save, persist, flowKey } from '../../state';
import { flowKeyPicker } from '../flowkey';
import { flowDeck } from '../../speech/flowdeck';
import { tokenize } from '../../core/text';
import { alignBurst } from '../../core/align';
import { parseCommands } from '../../core/commands';
import { GOA_DICTIONARY } from '../../content/sentences';

const SNIPPETS: [string, string, string][] = [
  ['vox nitro', '[[nitro]]', 'Fire Nitro'],
  ['vox jump', '[[jump]]', 'Wave Jump'],
  ['vox again', '[[again]]', 'Race again'],
  ['vox play', '[[play]]', 'Start from menus'],
  ['vox skip', '[[skip]]', 'Skip a sentence'],
  ['vox ready', '[[ready]]', 'Ready up in a Duel'],
];

/** Flow Setup wizard (03 §14): ≤ 60 s, skippable. Turns Wispr Flow features into game setup steps. */
export function setupScreen() {
  let step = 0;
  const names = ['Open Wispr Flow', 'Say hello', 'Hotkeys', 'Voice shortcuts', 'Goa dictionary'];
  const stepList = h('ul', { class: 'steps' });
  const panel = h('div', null);
  const done = new Set<number>(save.flowSetupDone ? [0, 1, 2, 3, 4] : []);
  const deckHost = h('div', { style: 'margin:14px 0' });
  const isMac = () => save.settings.os === 'mac';
  const ptt = () => flowKey();

  const renderSteps = () => {
    stepList.replaceChildren(...names.map((n, i) =>
      h('li', { class: (i === step ? 'on ' : '') + (done.has(i) ? 'done' : ''), onClick: () => { step = i; render(); } }, `${i + 1}. ${n}`)));
  };

  let offBurst: (() => void) | null = null;
  const render = () => {
    renderSteps();
    offBurst?.();
    offBurst = null;
    panel.replaceChildren();
    if (step === 0) {
      const osSeg = h('div', { class: 'seg' },
        h('button', { class: isMac() ? '' : 'on', onClick: () => { save.settings.os = 'win'; persist(); render(); } }, 'Windows'),
        h('button', { class: isMac() ? 'on' : '', onClick: () => { save.settings.os = 'mac'; persist(); render(); } }, 'Mac'));
      panel.append(
        h('span', { class: 'kicker' }, 'Step 1 · 10 seconds'),
        h('h2', null, 'Your voice is the engine'),
        h('p', null, 'VOXWAKE has no throttle pedal. Sentences appear on a hanging sign — you hold your Wispr Flow key, say them, release — and the words Flow types into the game push your boat forward.'),
        h('ul', { class: 'bullets' },
          h('li', null, 'Open the Wispr Flow desktop app and sign in (get it at wisprflow.ai).'),
          h('li', null, 'Flow cleans your speech — fillers, stumbles and self-corrections never cost you. Stumble freely.'),
          h('li', null, 'No Flow? The game still works with your browser’s microphone or by typing.')),
        h('div', { class: 'row', style: 'margin-top:12px' }, h('span', { class: 'mono', style: 'font-size:13px' }, 'My computer:'), osSeg),
        h('div', { style: 'margin-top:14px;background:#fff;border:2px dashed #ddd3b2;border-radius:10px;padding:10px 12px' }, flowKeyPicker()),
        h('div', { class: 'row', style: 'margin-top:18px' }, btn('Flow is open →', 'yellow', () => { done.add(0); step = 1; render(); })));
    } else if (step === 1) {
      const status = h('div', { class: 'alert', style: 'background:#f3ecd0;color:#0b3b2a;border-color:#ddd3b2' }, 'Waiting for your voice…');
      panel.append(
        h('span', { class: 'kicker' }, 'Step 2 · the hello test'),
        h('h2', null, 'Say “Goa is calling”'),
        h('p', null, `Hold `, h('kbd', null, ptt()), ` and keep holding · say “Goa is calling” · RELEASE when done. Flow types it into the Flow Deck below.`),
        deckHost, status);
      deckHost.appendChild(flowDeck.wrap);
      flowDeck.show(true, 'setup');
      const target = tokenize('Goa is calling');
      offBurst = flowDeck.onBurst((b) => {
        const res = alignBurst(target, tokenize(b.text, true), new Set());
        const ok = res.matched / target.length >= 0.75;
        if (ok) {
          done.add(1);
          status.className = 'alert';
          status.style.cssText = 'background:#e4fbe9;color:#076b38;border-color:#a8e6b8';
          status.textContent = b.source === 'flow' ? `✓ Looks like Wispr Flow dictation! (${b.chars} chars in one burst)` :
            b.source === 'web-speech' ? '✓ Browser mic works. (Wispr Flow is faster & cleaner.)' : '✓ Typed — that works too, but dictating with Flow is way faster.';
          renderSteps();
          setTimeout(() => { if (step === 1) { step = 2; render(); } }, 1800);
        } else {
          status.className = 'alert';
          status.textContent = `Heard “${b.text}” — try again: “Goa is calling”`;
        }
      });
      if (flowDeck.speechSupported) {
        const liveBtn = h('button', { class: 'copy-btn', onClick: () => {
          save.settings.chromeLive = !save.settings.chromeLive; persist();
          liveBtn.textContent = save.settings.chromeLive ? '🔴 Chrome Live: ON' : '🎙 Chrome Live: OFF';
        } }, save.settings.chromeLive ? '🔴 Chrome Live: ON' : '🎙 Chrome Live: OFF');
        panel.append(h('div', { class: 'alert', style: 'margin-top:12px;background:#fff7d6;color:#0b3b2a;border-color:#e6d84a;text-transform:none' },
          h('b', null, 'Optional — Chrome Live (OFF by default): '),
          'Wispr Flow is the voice of this game: hold your key, speak, release. If you also want words to light up WHILE you speak, switch on Chrome Live (uses the Chrome/Edge mic); Wispr Flow’s text still verifies every word. ', liveBtn));
      }
    } else if (step === 2) {
      const rows = isMac()
        ? [['Talk: HOLD while speaking, RELEASE when done', ptt()], ['Hands-free ON / OFF (optional)', `Double-tap ${ptt()}`], ['Paste last transcript (Lost-Wake recovery)', '⌘ + Ctrl + V'], ['Cancel dictation', 'Esc']]
        : [['Talk: HOLD while speaking, RELEASE when done', ptt()], ['Hands-free ON / OFF (optional)', `Double-tap ${ptt()}`], ['Paste last transcript (Lost-Wake recovery)', 'Shift + Alt + Z'], ['Cancel dictation', 'Esc']];
      panel.append(
        h('span', { class: 'kicker' }, 'Step 3 · hands'),
        h('h2', null, 'Left hand talks, right hand steers'),
        h('table', { class: 'keys' }, ...rows.map(([a, b]) => h('tr', null, h('td', null, a), h('td', null, h('kbd', null, b))))),
        h('ul', { class: 'bullets' },
          h('li', null, `Steer with the MOUSE — one hand holds ${ptt()}, the other steers. Arrow keys can clash with Flow shortcuts.`),
          h('li', null, 'Left-click = Nitro · Right-click = Wave Jump · Shield is automatic.'),
          h('li', null, 'The game never uses Esc (that’s Flow’s cancel) — pause is F1.')),
        h('div', { class: 'row', style: 'margin-top:12px' }, btn('Got it →', 'yellow', () => { done.add(2); step = 3; render(); })));
    } else if (step === 3) {
      const st = h('div', { class: 'alert', style: 'background:#f3ecd0;color:#0b3b2a;border-color:#ddd3b2' }, 'Test: say “vox nitro”');
      panel.append(
        h('span', { class: 'kicker' }, 'Step 4 · optional · Flow snippets'),
        h('h2', null, 'Voice shortcuts'),
        h('p', null, 'In Wispr Flow → Snippets, add these. Saying the trigger expands into a secret token the game reads as a command — so it can never collide with sentence text. (Saying “vox nitro” works even without snippets.)'),
        h('table', { class: 'keys' }, ...SNIPPETS.map(([t, x, d]) => h('tr', null,
          h('td', null, h('b', null, t)), h('td', null, h('code', null, x)), h('td', null, d),
          h('td', null, h('button', { class: 'copy-btn', onClick: () => copyText(t) }, 'Copy trigger'), ' ', h('button', { class: 'copy-btn', onClick: () => copyText(x) }, 'Copy expansion'))))),
        deckHost, st);
      deckHost.appendChild(flowDeck.wrap);
      flowDeck.show(true, 'setup');
      offBurst = flowDeck.onBurst((b) => {
        const p = parseCommands(b.text);
        const c = p.commands[0];
        if (c) {
          st.className = 'alert';
          st.style.cssText = 'background:#e4fbe9;color:#076b38;border-color:#a8e6b8';
          st.textContent = c.via === 'snippet' ? `⚡ Snippet fired: ${c.cmd.toUpperCase()} — perfect.` : `🎙 Spoken command: ${c.cmd.toUpperCase()} — works! Add the snippet for zero-collision.`;
          done.add(3);
          renderSteps();
        } else st.textContent = `Heard “${b.text}” — say exactly “vox nitro”`;
      });
      panel.append(h('div', { class: 'row', style: 'margin-top:12px' }, btn('Next →', 'yellow', () => { done.add(3); step = 4; render(); })));
    } else {
      panel.append(
        h('span', { class: 'kicker' }, 'Step 5 · optional · Personal Dictionary'),
        h('h2', null, 'Teach Flow some Goa'),
        h('p', null, 'Paste these into Wispr Flow → Dictionary so it spells Goan places and foods right. After each race, the Pit Stop shows any word Flow misheard so you can add it.'),
        h('p', { class: 'mono', style: 'font-size:12px;line-height:1.8;background:#fff;border:2px dashed #ddd3b2;padding:10px;border-radius:8px;text-transform:none' }, GOA_DICTIONARY.join(' · ')),
        h('div', { class: 'row', style: 'margin-top:12px' },
          btn('Copy all', 'outline', () => { copyText(GOA_DICTIONARY.join('\n')); done.add(4); renderSteps(); }),
          btn('Finish setup ✓', 'yellow', finish)));
    }
  };

  const finish = () => {
    save.flowSetupDone = true;
    persist();
    app.go('modes');
  };

  const root = h('div', { class: 'screen veil fade-in' },
    h('div', { class: 'back-btn' }, btn('← Back', 'ghost', () => app.go('title'))),
    h('div', { class: 'card center-card' },
      h('div', { class: 'stepper' },
        h('div', null, h('div', { class: 'kicker', style: 'margin-bottom:10px' }, 'Flow setup · ≤ 60 s'), stepList,
          h('div', { style: 'margin-top:20px' }, btn('Skip for now', 'outline', finish))),
        panel)));
  mount(root);
  render();
  (root as HTMLElement & { cleanup?: () => void }).cleanup = () => {
    offBurst?.();
    document.body.appendChild(flowDeck.wrap);
    flowDeck.show(true, 'menu');
  };
}
