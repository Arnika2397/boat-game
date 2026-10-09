/**
 * FlowDeck — the always-focused textarea that Wispr Flow (desktop) dictates into (03 §4.1).
 * Wispr Flow inserts a whole cleaned phrase after you release the hotkey → we receive it as one "burst".
 * Typing also works (classified as keyboard / typed assist).
 */
export type BurstSource = 'flow' | 'keyboard' | 'web-speech' | 'autopilot';
export interface Burst { text: string; source: BurstSource; chars: number; events: number; spanMs: number; insertType: string }

type Listener = (b: Burst) => void;

const SR: (new () => SpeechRecognitionLike) | undefined =
  (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
  (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;

interface SpeechRecognitionLike {
  continuous: boolean; interimResults: boolean; lang: string; maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] & { length: number } }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
  start(): void; stop(): void;
}

class FlowDeckImpl {
  el!: HTMLTextAreaElement;
  wrap!: HTMLElement;
  private lastEl!: HTMLElement;
  private srcEl!: HTMLElement;
  private listeners: Listener[] = [];
  private interimListeners: ((t: string) => void)[] = [];
  private liveListeners: ((id: string, text: string, final: boolean) => void)[] = [];
  private session = 0;
  private timer = 0;
  private events = 0;
  private singleChars = 0;
  private tFirst = 0;
  private insertType = '';
  active = false;
  focusLost = false;
  onFocusChange: ((lost: boolean) => void) | null = null;
  flowSeen = false;
  lastSource: BurstSource = 'flow';
  // web speech
  private rec: SpeechRecognitionLike | null = null;
  micOn = false;
  private micRestarts: number[] = [];
  onMicState: ((on: boolean, err?: string) => void) | null = null;
  readonly speechSupported = !!SR;
  /** 0..1 microphone loudness while Live Voice is on (proves the mic hears you). */
  micLevel = 0;
  lastResultAt = 0;
  private meterStream: MediaStream | null = null;
  private meterRaf = 0;

  /** Embedded previews (e.g. an in-app browser pane) block the microphone entirely. */
  get embeddedBrowser(): boolean {
    return /Claude\/|Electron\//.test(navigator.userAgent);
  }

  private async startMeter() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!this.micOn) { stream.getTracks().forEach((t) => t.stop()); return; }
      this.meterStream = stream;
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const tick = () => {
        if (!this.micOn) { ctx.close(); return; }
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / buf.length);
        this.micLevel = this.micLevel * 0.6 + Math.min(1, rms * 6) * 0.4;
        this.wrap.style.setProperty('--lvl', this.micLevel.toFixed(3));
        this.meterRaf = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* the recogniser reports mic errors itself */ }
  }

  init() {
    this.el = document.getElementById('flowdeck') as HTMLTextAreaElement;
    this.wrap = document.getElementById('flowdeck-wrap')!;
    this.lastEl = document.getElementById('fd-last')!;
    this.srcEl = document.getElementById('fd-src')!;
    this.el.addEventListener('beforeinput', (e) => {
      this.insertType = (e as InputEvent).inputType;
    });
    this.el.addEventListener('input', (e) => {
      const ie = e as InputEvent;
      if (ie.isComposing) return;
      if (!this.events) this.tFirst = performance.now();
      this.events++;
      if (ie.inputType === 'insertText' && (ie.data?.length ?? 0) === 1) this.singleChars++;
      this.wrap.classList.add('typing');
      clearTimeout(this.timer);
      const typedLike = this.singleChars >= 3;
      this.timer = window.setTimeout(() => this.flush(), typedLike ? 1100 : 230);
    });
    this.el.addEventListener('paste', () => {
      clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.flush(), 30);
    });
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(this.timer);
        this.flush();
      }
    });
    this.el.addEventListener('blur', (e) => {
      const rt = (e as FocusEvent).relatedTarget as HTMLElement | null;
      if (rt && rt.classList?.contains('own-input')) return;
      if (this.active) setTimeout(() => { if (this.active && document.hasFocus() && !this.ownInputFocused()) this.focus(); }, 60);
    });
    window.addEventListener('blur', () => {
      if (!this.active) return;
      this.focusLost = true;
      this.onFocusChange?.(true);
    });
    window.addEventListener('focus', () => {
      if (this.active) this.focus();
      if (this.focusLost) { this.focusLost = false; this.onFocusChange?.(false); }
    });
    // keep focus when clicking anywhere that is not an interactive control
    window.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      const t = e.target as HTMLElement;
      if (t.closest('button, input, select, a, .own-input, textarea')) return;
      e.preventDefault();
      this.focus();
    }, { capture: true });
  }

  private ownInputFocused() {
    const a = document.activeElement as HTMLElement | null;
    return !!a && a !== this.el && (a.classList.contains('own-input') || a.tagName === 'INPUT' || a.tagName === 'SELECT');
  }

  private flush() {
    const text = this.el.value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 600);
    const typed = this.singleChars >= 3 && this.events >= text.length * 0.6;
    const span = performance.now() - this.tFirst;
    const events = this.events, insertType = this.insertType;
    this.el.value = '';
    this.events = 0;
    this.singleChars = 0;
    this.wrap.classList.remove('typing');
    if (!text) return;
    const source: BurstSource = typed ? 'keyboard' : 'flow';
    if (!typed && text.length >= 8) this.flowSeen = true;
    this.emit({ text, source, chars: text.length, events, spanMs: span, insertType });
  }

  emit(b: Burst) {
    this.lastSource = b.source;
    this.showLast(b.text, b.source);
    this.wrap.classList.remove('pulse');
    void this.wrap.offsetWidth;
    this.wrap.classList.add('pulse');
    for (const l of this.listeners) l(b);
  }

  showLast(text: string, source: BurstSource) {
    this.lastEl.classList.remove('live-text');
    this.lastEl.textContent = '“' + text + '”';
    this.lastEl.classList.remove('show');
    void this.lastEl.offsetWidth;
    this.lastEl.classList.add('show');
    this.setSourceLabel(source);
  }

  setSourceLabel(source: BurstSource) {
    const label = { flow: 'WISPR FLOW ✓', keyboard: 'KEYBOARD ASSIST', 'web-speech': '● CHROME LIVE + WISPR FLOW', autopilot: 'DEMO AUTOPILOT' }[source];
    this.srcEl.textContent = label;
    this.srcEl.dataset.src = source;
  }

  onBurst(cb: Listener): () => void {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter((l) => l !== cb); };
  }
  /** Live Voice: every interim + final result of every utterance, as it grows word by word. */
  onLive(cb: (id: string, text: string, final: boolean) => void): () => void {
    this.liveListeners.push(cb);
    return () => { this.liveListeners = this.liveListeners.filter((l) => l !== cb); };
  }
  get liveActive() { return this.micOn && this.liveListeners.length > 0; }

  onInterim(cb: (t: string) => void): () => void {
    this.interimListeners.push(cb);
    return () => { this.interimListeners = this.interimListeners.filter((l) => l !== cb); };
  }

  show(on: boolean, mode: 'race' | 'setup' | 'menu' = 'race') {
    this.wrap.classList.toggle('hidden', !on);
    this.wrap.dataset.mode = mode;
    this.active = on;
    if (on) this.focus();
  }

  focus() {
    if (document.activeElement !== this.el) this.el.focus({ preventScroll: true });
  }

  // ---------- Web Speech fallback (Chrome/Edge) ----------
  toggleMic(lang = 'en-IN') {
    if (this.micOn) { this.stopMic(); return; }
    if (!SR) { this.onMicState?.(false, 'Speech recognition isn’t available in this browser. Open the game in Google Chrome or Microsoft Edge.'); return; }
    if (this.embeddedBrowser) { this.onMicState?.(false, 'EMBEDDED'); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    rec.maxAlternatives = 1;
    let lastFinal = -1;
    this.session++;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (this.liveListeners.length) {
          // real-time path: stream the growing utterance straight to the game
          const text = r[0].transcript.trim();
          if (text) {
            this.lastResultAt = performance.now();
            this.lastEl.textContent = '🎙 ' + text;
            this.lastEl.classList.add('live-text');
            for (const l of this.liveListeners) l(`${this.session}-${i}`, text, r.isFinal);
            if (r.isFinal) { this.lastEl.textContent = '“' + text + '”'; this.wrap.classList.remove('pulse'); void this.wrap.offsetWidth; this.wrap.classList.add('pulse'); }
          }
          if (!r.isFinal) interim += r[0].transcript;
          continue;
        }
        if (r.isFinal) {
          if (i > lastFinal) {
            lastFinal = i;
            const text = r[0].transcript.trim();
            if (text) this.emit({ text, source: 'web-speech', chars: text.length, events: 1, spanMs: 0, insertType: 'speech' });
          }
        } else interim += r[0].transcript;
      }
      for (const l of this.interimListeners) l(interim);
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      const msg: Record<string, string> = {
        'not-allowed': 'Microphone blocked. Click the 🔒/mic icon in the address bar → Allow, then turn Chrome Live on again.',
        'service-not-allowed': 'This browser blocks speech recognition. Open the game in Google Chrome or Microsoft Edge.',
        'audio-capture': 'No microphone found. Plug one in (or pick it in Windows Sound settings) and try again.',
        network: 'The speech service is unreachable. Live Voice needs internet and Google Chrome or Microsoft Edge (Brave/Firefox don’t support it).',
        'language-not-supported': 'This speech language isn’t supported here. Try en-US in Settings.',
      };
      if (msg[e.error]) {
        this.micOn = false;
        this.stopMeter();
        this.onMicState?.(false, msg[e.error]);
      }
    };
    rec.onend = () => {
      if (!this.micOn) return;
      const now = Date.now();
      this.micRestarts = this.micRestarts.filter((t) => now - t < 60000);
      if (this.micRestarts.length >= 30) { this.stopMic(); this.onMicState?.(false, 'Browser speech keeps stopping — switched back to Wispr Flow / typing.'); return; }
      this.micRestarts.push(now);
      lastFinal = -1;
      this.session++;
      setTimeout(() => { try { if (this.micOn) rec.start(); } catch { /* already started */ } }, 120);
    };
    try {
      rec.start();
      this.rec = rec;
      this.micOn = true;
      this.lastResultAt = performance.now();
      this.wrap.classList.add('live');
      this.setSourceLabel('web-speech');
      this.onMicState?.(true);
      this.startMeter();
    } catch (err) {
      this.onMicState?.(false, String(err));
    }
  }

  private stopMeter() {
    cancelAnimationFrame(this.meterRaf);
    this.meterStream?.getTracks().forEach((t) => t.stop());
    this.meterStream = null;
    this.micLevel = 0;
    this.wrap.classList.remove('live');
  }

  stopMic() {
    this.micOn = false;
    this.stopMeter();
    try { this.rec?.stop(); } catch { /* noop */ }
    this.rec = null;
    this.onMicState?.(false);
  }
}

export const flowDeck = new FlowDeckImpl();

/** Demo Autopilot: plays the sentence like a skilled Wispr Flow user (for demos with no mic, and for testing). */
export class Autopilot {
  private timer = 0;
  running = false;
  constructor(private getTarget: () => string | null, private wpm = 115, private accuracy = 0.96) {}
  start() {
    this.running = true;
    this.loop();
  }
  stop() {
    this.running = false;
    clearTimeout(this.timer);
  }
  private loop() {
    if (!this.running) return;
    const target = this.getTarget();
    if (!target) { this.timer = window.setTimeout(() => this.loop(), 400); return; }
    const words = target.split(/\s+/);
    // say the remaining words in one or two Flow-style bursts
    const chunk = words.length > 7 && Math.random() < 0.6 ? Math.ceil(words.length / 2) : words.length;
    const said = words.slice(0, chunk).map((w) => (Math.random() > this.accuracy ? w.slice(0, Math.max(1, w.length - 2)) + 'x' : w)).join(' ');
    const ms = (chunk * 60000) / this.wpm + 700 + Math.random() * 500;
    this.timer = window.setTimeout(() => {
      if (!this.running) return;
      flowDeck.emit({ text: said, source: 'autopilot', chars: said.length, events: 1, spanMs: 0, insertType: 'insertFromPaste' });
      this.timer = window.setTimeout(() => this.loop(), 250);
    }, ms);
  }
}
