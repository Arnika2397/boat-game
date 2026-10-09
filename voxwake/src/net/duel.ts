/** Voice Duel network client (rooms, time sync, position relay). */
export interface RoomPlayer { id: string; name: string; boat: string; paint: string; ready: boolean; connected: boolean; wins: number; host: boolean }
export interface RoomState { code: string; phase: string; config: { level: number }; players: RoomPlayer[] }
export interface DuelResultRow { id: string; name: string; finished: boolean; time: number | null; score: number; accuracy: number; flow: { wordsDictated: number; wordsTyped: number; bursts: number; wpm: number } | null; progress: number; flags: string[] }

type Handler = (m: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any

class DuelClient {
  ws: WebSocket | null = null;
  code = '';
  playerId = '';
  token = '';
  room: RoomState | null = null;
  offset = 0; // serverTime - localTime
  private handlers = new Map<string, Set<Handler>>();
  private name = 'Captain';
  private boat = 'canoe';
  private paint = 'mango';
  private wantOpen = false;
  private retries = 0;

  on(t: string, cb: Handler): () => void {
    if (!this.handlers.has(t)) this.handlers.set(t, new Set());
    this.handlers.get(t)!.add(cb);
    return () => this.handlers.get(t)?.delete(cb);
  }
  private emit(t: string, m: unknown) { this.handlers.get(t)?.forEach((h) => h(m)); }

  async createRoom(): Promise<string> {
    const r = await fetch('/api/rooms', { method: 'POST' });
    if (!r.ok) throw new Error(r.status === 429 ? 'Too many rooms — try again in a minute.' : 'Room server unavailable');
    const j = await r.json();
    return j.code as string;
  }

  connect(code: string, name: string, boat: string, paint: string): Promise<void> {
    this.code = code.toUpperCase();
    this.name = name; this.boat = boat; this.paint = paint;
    this.wantOpen = true;
    try { this.token = sessionStorage.getItem('voxwake.duel.' + this.code) ?? ''; } catch { /* ignore */ }
    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      this.ws = ws;
      let settled = false;
      ws.onopen = () => {
        this.retries = 0;
        ws.send(JSON.stringify({ t: 'hello', room: this.code, name: this.name, token: this.token || undefined, boat: this.boat, paint: this.paint }));
        this.timeSync();
      };
      ws.onmessage = (ev) => {
        let m: { t: string; [k: string]: unknown };
        try { m = JSON.parse(ev.data); } catch { return; }
        if (m.t === 'welcome') {
          this.playerId = m.playerId as string;
          this.token = m.token as string;
          try { sessionStorage.setItem('voxwake.duel.' + this.code, this.token); } catch { /* ignore */ }
          if (!settled) { settled = true; resolve(); }
        } else if (m.t === 'error' && !settled) {
          settled = true;
          this.wantOpen = false;
          reject(new Error(String(m.message || m.code)));
        } else if (m.t === 'room') this.room = m as unknown as RoomState;
        else if (m.t === 'pong') this.onPong(m.t0 as number, m.ts as number);
        this.emit(m.t, m);
      };
      ws.onerror = () => { if (!settled) { settled = true; reject(new Error('Can’t reach the room server. Start it with “npm start” (or check the network).')); } };
      ws.onclose = () => {
        this.emit('closed', {});
        if (this.wantOpen && settled && this.retries < 8) {
          this.retries++;
          const delay = Math.min(4000, 500 * 2 ** (this.retries - 1));
          this.emit('reconnecting', { delay });
          setTimeout(() => { if (this.wantOpen) this.connect(this.code, this.name, this.boat, this.paint).catch(() => {}); }, delay);
        }
      };
    });
  }

  private samples: { rtt: number; off: number }[] = [];
  timeSync() {
    this.samples = [];
    for (let i = 0; i < 8; i++) setTimeout(() => this.send({ t: 'ping', t0: Date.now() }), i * 110);
  }
  private onPong(t0: number, ts: number) {
    const now = Date.now();
    const rtt = now - t0;
    this.samples.push({ rtt, off: ts + rtt / 2 - now });
    const best = [...this.samples].sort((a, b) => a.rtt - b.rtt).slice(0, 5).map((s) => s.off).sort((a, b) => a - b);
    this.offset = best[Math.floor(best.length / 2)] ?? 0;
  }
  get rtt() { return this.samples.length ? Math.min(...this.samples.map((s) => s.rtt)) : 0; }

  send(m: Record<string, unknown>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  leave() {
    this.wantOpen = false;
    this.send({ t: 'leave' });
    this.ws?.close();
    this.ws = null;
    this.room = null;
  }

  get me() { return this.room?.players.find((p) => p.id === this.playerId); }
  get opponent() { return this.room?.players.find((p) => p.id !== this.playerId); }
  get isHost() { return !!this.me?.host; }
}

export const duel = new DuelClient();
