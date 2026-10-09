import { h, mount, btn, toast } from '../dom';
import { app } from '../../app';
import { save, persist, resetSave, flowKey } from '../../state';
import { flowKeyPicker } from '../flowkey';
import { audio } from '../../audio/audio';

export function settingsScreen() {
  const slider = (label: string, val: number, set: (v: number) => void) => {
    const inp = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(val), class: 'own-input' }) as HTMLInputElement;
    inp.addEventListener('input', () => { set(parseFloat(inp.value)); persist(); audio.applyVolumes(); });
    return h('div', { class: 'row', style: 'justify-content:space-between;margin:10px 0' }, h('span', { class: 'mono', style: 'font-size:13px' }, label), inp);
  };
  const toggle = (label: string, on: boolean, set: (v: boolean) => void) => {
    const t = h('div', { class: 'toggle' + (on ? ' on' : ''), style: 'color:#0b3b2a' }, h('span', { class: 'sw', style: 'border-color:#0b3b2a;background:' + (on ? '#FF0CCF' : '#ddd3b2') }), label);
    t.addEventListener('click', () => { set(!t.classList.contains('on')); persist(); settingsScreen(); });
    return t;
  };
  const langSel = h('select', { class: 'own-input', style: 'font-family:var(--mono);padding:6px;border:2px solid #0b3b2a;border-radius:8px' },
    ...['en-IN', 'en-US', 'en-GB'].map((l) => h('option', { value: l, selected: save.settings.lang === l }, l))) as HTMLSelectElement;
  langSel.addEventListener('change', () => { save.settings.lang = langSel.value; persist(); });
  const root = h('div', { class: 'screen veil fade-in' },
    h('div', { class: 'back-btn' }, btn('← Back', 'ghost', () => app.go('title'))),
    h('div', { class: 'card center-card', style: 'width:min(640px,90vw)' },
      h('span', { class: 'kicker' }, 'Settings'),
      h('h2', null, 'Tune the boat'),
      slider('Master volume', audio.volumes.master, (v) => (audio.volumes.master = v)),
      slider('Music', save.settings.music, (v) => { save.settings.music = v; audio.volumes.music = v; }),
      slider('Sound effects', save.settings.sfx, (v) => { save.settings.sfx = v; audio.volumes.sfx = v; }),
      h('div', { style: 'margin:14px 0;display:flex;flex-direction:column;gap:12px' },
        toggle('Reduced motion (no shake, sway, FOV kick)', save.settings.reducedMotion, (v) => { save.settings.reducedMotion = v; document.body.classList.toggle('reduced-motion', v); app.view.reducedMotion = v; }),
        toggle('Chrome Live (optional, OFF by default) — also show words while you speak, via the Chrome/Edge mic', save.settings.chromeLive, (v) => (save.settings.chromeLive = v)),
        toggle('Mac keyboard hints', save.settings.os === 'mac', (v) => (save.settings.os = v ? 'mac' : 'win')),
        toggle('Wispr Flow check before the first race of each session', save.settings.flowCheck, (v) => (save.settings.flowCheck = v))),
      h('div', { style: 'margin:6px 0 14px;background:#fff;border:2px dashed #ddd3b2;border-radius:10px;padding:10px 12px' }, flowKeyPicker()),
      h('div', { class: 'row' }, h('span', { class: 'mono', style: 'font-size:13px' }, 'Browser-mic language'), langSel),
      h('div', { class: 'alert', style: 'margin-top:16px;background:#f3ecd0;color:#0b3b2a;border-color:#ddd3b2;text-transform:none' },
        'Privacy: VOXWAKE never records or stores audio. Wispr Flow handles your voice under its own policy. Browser speech (optional) is processed by your browser vendor. Championship runs 100% on this device; Voice Duel only sends the text of your phrases to the room server.'),
      h('div', { class: 'row', style: 'margin-top:16px' },
        btn('Redo Flow setup', 'outline', () => app.go('setup')),
        btn('Reset progress', 'outline', () => { if (confirm('Reset all progress?')) { resetSave(); toast('Progress reset'); app.go('title'); } }),
        btn('Done', 'yellow', () => app.go('title')))));
  mount(root);
}

export function howtoScreen() {
  const ptt = flowKey();
  const root = h('div', { class: 'screen veil fade-in' },
    h('div', { class: 'back-btn' }, btn('← Back', 'ghost', () => app.go('title'))),
    h('div', { class: 'card center-card' },
      h('span', { class: 'kicker' }, 'How to play · 20 seconds'),
      h('h2', null, 'No pedal. Your voice is the engine.'),
      h('div', { class: 'howto' },
        h('div', { class: 'stepc' }, h('div', { class: 'ico' }, '⌨️'), h('div', { class: 'big' }, '1 · HOLD'), h('p', null, 'Press and HOLD ', h('kbd', null, ptt), ' — the key you use to start Wispr Flow dictation')),
        h('div', { class: 'stepc' }, h('div', { class: 'ico' }, '🗣️'), h('div', { class: 'big' }, '2 · SPEAK'), h('p', null, 'Keep holding and read the whole sentence on the hanging sign')),
        h('div', { class: 'stepc' }, h('div', { class: 'ico' }, '🚤'), h('div', { class: 'big' }, '3 · RELEASE'), h('p', null, 'Let go when the sentence is done — Flow types it and your boat SURGES'))),
      h('ul', { class: 'bullets' },
        h('li', null, 'Hold while speaking, release when you finish the sentence. Then hold again for the next one — a quick rhythm keeps your boat fast.'),
        h('li', null, 'Silence = your boat slows down. Keep the sentences flowing to keep the throttle up.'),
        h('li', null, 'Clean phrases build a STREAK (×2 score) and fill the FLOW ring → 8 s of FLOW STATE.'),
        h('li', null, 'Steer with the mouse. Left-click = NITRO (earned by 90%+ sentences). Right-click = WAVE JUMP (from bonus gates). SHIELD is automatic (4 clean phrases in a row).'),
        h('li', null, 'Bonus gates: say the gate phrase AND steer through the arch.'),
        h('li', null, 'Stumbles, “um”s and self-corrections are fine — Wispr Flow cleans them up.'),
        h('li', null, 'Optional: “🎙 CHROME LIVE” (off by default) also lights up words while you speak. Wispr Flow stays the main voice input.')),
      h('div', { class: 'row', style: 'margin-top:12px' }, btn('Let’s race', 'yellow', () => app.go(save.flowSetupDone ? 'modes' : 'setup')))));
  mount(root);
}
