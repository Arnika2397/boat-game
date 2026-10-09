/** Procedural WebAudio: music stems that react to streak/Flow State, pentatonic word ticks, synth SFX. No speech output (mic-safe). */
const PENTA = [0, 2, 4, 7, 9];
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const pent = (deg: number, base = 72) => midi(base + 12 * Math.floor(deg / 5) + PENTA[((deg % 5) + 5) % 5]);

class Audio {
  ctx: AudioContext | null = null;
  master!: GainNode;
  music!: GainNode;
  sfx!: GainNode;
  amb!: GainNode;
  private noiseBuf!: AudioBuffer;
  private engineOsc: OscillatorNode | null = null;
  private engineGain!: GainNode;
  private engineFilter!: BiquadFilterNode;
  private nextBeat = 0;
  private beat = 0;
  intensity = 0; // 0 menu, 1 race base, 2 melody, 3 full, 4 flow
  transpose = 0;
  tempo = 112;
  playing = false;
  private melodyDeg = 5;
  volumes = { master: 0.8, music: 0.55, sfx: 0.9 };
  muted = false;

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
    } catch { return; }
    const c = this.ctx;
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    this.master.connect(comp).connect(c.destination);
    this.music = c.createGain();
    this.sfx = c.createGain();
    this.amb = c.createGain();
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    this.amb.connect(this.master);
    this.applyVolumes();
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startAmbience();
    this.startEngine();
    this.nextBeat = c.currentTime + 0.1;
    setInterval(() => this.schedule(), 50);
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : this.volumes.master;
    this.music.gain.value = this.volumes.music * 0.5;
    this.sfx.gain.value = this.volumes.sfx;
    this.amb.gain.value = 0.35;
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  tone(freq: number, t: number, dur: number, vol: number, type: OscillatorType = 'sine', out?: AudioNode, attack = 0.005) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    this.env(g, t, attack, vol, dur);
    o.connect(g).connect(out ?? this.sfx);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  marimba(freq: number, t: number, vol: number, out?: AudioNode) {
    this.tone(freq, t, 0.45, vol, 'sine', out);
    this.tone(freq * 4, t, 0.08, vol * 0.35, 'sine', out);
    this.tone(freq * 2, t, 0.18, vol * 0.2, 'triangle', out);
  }

  noise(t: number, dur: number, vol: number, filterType: BiquadFilterType, f0: number, f1: number, out?: AudioNode, q = 1) {
    if (!this.ctx) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, 0.01, vol, dur);
    s.connect(f).connect(g).connect(out ?? this.sfx);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
  }

  // ---------------- SFX ----------------
  word(n: number) { const t = this.now; this.marimba(pent(n + this.transpose / 2, 76), t, 0.22); }
  wordMiss() { const t = this.now; this.tone(196, t, 0.12, 0.08, 'triangle'); }
  landed() { const t = this.now; this.tone(2400, t, 0.04, 0.05, 'sine'); }
  stroke(acc: number) {
    const t = this.now + 0.05;
    const root = acc >= 0.9 ? 72 : 67;
    [0, 4, 7].forEach((iv, i) => this.marimba(midi(root + iv), t + i * 0.035, 0.12));
    this.noise(t, 0.08, 0.05, 'highpass', 6000, 9000);
  }
  stage(flawless: boolean) {
    const t = this.now + 0.08;
    this.bell(midi(84), t, 0.18);
    this.bell(midi(flawless ? 91 : 88), t + 0.12, 0.18);
    this.whoosh(0.3);
  }
  bell(freq: number, t: number, vol: number) {
    [1, 2.76, 5.4, 8.93].forEach((h, i) => this.tone(freq * h, t, 1.2 / (i + 1), vol / (i + 1.5), 'sine'));
  }
  whoosh(vol = 0.25, up = true) { const t = this.now; this.noise(t, 0.5, vol, 'bandpass', up ? 400 : 3000, up ? 4000 : 300, undefined, 2); }
  streak(level: number) {
    const t = this.now + 0.05;
    for (let i = 0; i < 3 + level; i++) this.marimba(pent(5 + i * 2 + level), t + i * 0.06, 0.12);
  }
  nitro() {
    const t = this.now;
    this.noise(t, 0.9, 0.35, 'bandpass', 300, 5000, undefined, 3);
    this.tone(55, t, 0.5, 0.4, 'sine');
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.6);
    this.env(g, t, 0.02, 0.08, 0.7);
    const f = this.ctx.createBiquadFilter();
    f.frequency.value = 2000;
    o.connect(f).connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.8);
  }
  shield() { const t = this.now; [88, 91, 96].forEach((m, i) => this.tone(midi(m), t + i * 0.05, 0.4, 0.08, 'triangle')); }
  shieldPop() { const t = this.now; this.noise(t, 0.25, 0.3, 'highpass', 3000, 8000); this.tone(1800, t, 0.2, 0.1, 'square'); }
  hit() { const t = this.now; this.tone(90, t, 0.25, 0.5, 'sine'); this.noise(t, 0.4, 0.4, 'lowpass', 2000, 200); }
  splash() { const t = this.now; this.noise(t, 0.6, 0.35, 'lowpass', 3000, 300); }
  pickup(chain: number) { const t = this.now; this.tone(pent(8 + Math.min(chain, 10), 72), t, 0.12, 0.12, 'triangle'); this.noise(t, 0.04, 0.08, 'highpass', 5000, 7000); }
  jump() { this.whoosh(0.3, true); }
  deny() { const t = this.now; this.tone(150, t, 0.15, 0.15, 'square'); this.tone(140, t + 0.08, 0.15, 0.12, 'square'); }
  ui() { const t = this.now; this.tone(1200, t, 0.05, 0.06, 'triangle'); this.noise(t, 0.03, 0.04, 'highpass', 4000, 6000); }
  hover() { const t = this.now; this.tone(1800, t, 0.03, 0.025, 'sine'); }
  countdown(n: number) { const t = this.now; this.bell(midi(n > 0 ? 69 : 81), t, n > 0 ? 0.22 : 0.3); if (n === 0) this.horn(); }
  horn() {
    const t = this.now;
    [0, 7].forEach((iv) => { this.tone(midi(55 + iv), t, 0.7, 0.12, 'sawtooth', undefined, 0.04); this.tone(midi(55 + iv) * 1.006, t, 0.7, 0.1, 'sawtooth', undefined, 0.04); });
  }
  overtake() { const t = this.now; this.whoosh(0.22, true); this.marimba(pent(10), t + 0.1, 0.12); this.marimba(pent(12), t + 0.16, 0.12); }
  overtaken() { this.whoosh(0.14, false); }
  flowOn() {
    const t = this.now;
    [60, 64, 67, 71, 74].forEach((m, i) => this.tone(midi(m + 12), t + i * 0.04, 1.6, 0.05, 'triangle', undefined, 0.3));
    for (let i = 0; i < 8; i++) this.marimba(pent(5 + i), t + i * 0.05, 0.1);
  }
  fanfare(win: boolean) {
    const t = this.now + 0.1;
    const seq = win ? [0, 4, 7, 12, 7, 12, 16] : [0, 4, 7, 4];
    seq.forEach((iv, i) => {
      this.tone(midi(67 + iv), t + i * 0.13, 0.4, 0.1, 'sawtooth', undefined, 0.02);
      this.marimba(midi(67 + iv), t + i * 0.13, 0.14);
    });
  }
  tick() { const t = this.now; this.tone(2000, t, 0.03, 0.05, 'square'); }
  crate() { const t = this.now; for (let i = 0; i < 10; i++) this.marimba(pent(i + 3), t + i * 0.045, 0.1); this.bell(midi(96), t + 0.5, 0.15); }
  stamp() { const t = this.now; this.tone(70, t, 0.18, 0.5, 'sine'); this.noise(t, 0.1, 0.3, 'lowpass', 1500, 300); }

  // ---------------- engine + ambience ----------------
  private startEngine() {
    const c = this.ctx!;
    this.engineOsc = c.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 50;
    this.engineFilter = c.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 300;
    this.engineGain = c.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.sfx);
    this.engineOsc.start();
  }
  setEngine(speed: number, on: boolean) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.now;
    this.engineOsc.frequency.setTargetAtTime(45 + speed * 3.2, t, 0.1);
    this.engineFilter.frequency.setTargetAtTime(200 + speed * 40, t, 0.1);
    this.engineGain.gain.setTargetAtTime(on ? 0.035 + speed * 0.0015 : 0, t, 0.2);
  }
  private startAmbience() {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    const g = c.createGain();
    g.gain.value = 0.12;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.12;
    const lg = c.createGain();
    lg.gain.value = 0.07;
    lfo.connect(lg).connect(g.gain);
    s.connect(f).connect(g).connect(this.amb);
    s.start();
    lfo.start();
  }
  gull() { const t = this.now; if (!this.ctx) return;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.frequency.setValueAtTime(1800, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.25);
    this.env(g, t, 0.02, 0.025, 0.25); o.connect(g).connect(this.amb); o.start(t); o.stop(t + 0.35); }

  // ---------------- music sequencer ----------------
  private schedule() {
    if (!this.ctx || !this.playing) { if (this.ctx) this.nextBeat = this.ctx.currentTime + 0.1; return; }
    const spb = 60 / this.tempo / 2; // eighth notes
    while (this.nextBeat < this.ctx.currentTime + 0.15) {
      this.playStep(this.beat, this.nextBeat);
      this.nextBeat += spb;
      this.beat++;
    }
  }
  private playStep(step: number, t: number) {
    const bar = Math.floor(step / 8) % 4;
    const s = step % 8;
    const tr = this.transpose;
    const prog = [0, -3, 5, 7]; // C Am F G (roots)
    const root = 48 + prog[bar] + tr;
    const I = this.intensity;
    const out = this.music;
    // bass
    if (s === 0 || s === 3 || s === 6) this.tone(midi(root - 12 + (s === 6 ? 7 : 0)), t, 0.35, I === 0 ? 0.16 : 0.22, 'triangle', out);
    // dholak-ish hand drum
    if (I >= 1) {
      if (s === 0 || s === 4) { this.tone(110, t, 0.18, 0.35, 'sine', out); }
      if (s === 2 || s === 5 || s === 7) this.noise(t, 0.08, 0.12, 'bandpass', 900, 600, out, 2);
      if (s === 6) this.tone(330, t, 0.08, 0.12, 'triangle', out);
    }
    // shaker
    this.noise(t, 0.04, I === 0 ? 0.025 : 0.05 + (s % 2 ? 0 : 0.02), 'highpass', 7000, 9000, out);
    // chord plucks
    if (s === 0 || (I >= 1 && s === 4)) [0, 4, 7].forEach((iv, i) => this.marimba(midi(root + 12 + iv + (bar === 1 && iv === 4 ? -1 : 0)), t + i * 0.012, I === 0 ? 0.05 : 0.06, out));
    // melody (streak ≥ 3)
    if (I >= 2 && (s % 2 === 0 || (I >= 3 && Math.random() < 0.35))) {
      this.melodyDeg += Math.random() < 0.5 ? 1 : -1;
      if (this.melodyDeg < 3) this.melodyDeg = 4;
      if (this.melodyDeg > 11) this.melodyDeg = 9;
      if (Math.random() < 0.8) this.marimba(pent(this.melodyDeg, 72 + tr), t, 0.09, out);
    }
    // flow state shimmer
    if (I >= 4 && s % 2 === 1) this.tone(pent(this.melodyDeg + 5, 72 + tr), t, 0.3, 0.035, 'triangle', out);
    if (I >= 3 && s === 7) this.noise(t, 0.15, 0.06, 'bandpass', 2000, 4000, out, 4);
  }
}

export const audio = new Audio();
