import type { Track } from "@/site.config";

type Note = { freq: number; ms: number };

const SEMI: Record<string, number> = { c: -9, d: -7, e: -5, f: -4, g: -2, a: 0, b: 2 };

/** Minimal RTTTL parser (the classic ringtone text format). */
export function parseRtttl(src: string): Note[] {
  const [, defs = "", data = ""] = src.split(":");
  let d = 4,
    o = 6,
    bpm = 63;
  for (const kv of defs.split(",")) {
    const [k, v] = kv.trim().split("=");
    if (k === "d") d = Number(v) || d;
    if (k === "o") o = Number(v) || o;
    if (k === "b") bpm = Number(v) || bpm;
  }
  const whole = (60000 / bpm) * 4;
  const out: Note[] = [];
  for (const raw of data.split(",")) {
    const m = raw.trim().toLowerCase().match(/^(\d+)?([a-gp])(#?)(\.?)(\d)?(\.?)$/);
    if (!m) continue;
    let ms = whole / (m[1] ? Number(m[1]) : d);
    if (m[4] || m[6]) ms *= 1.5;
    let freq = 0;
    if (m[2] !== "p") {
      const oct = m[5] ? Number(m[5]) : o;
      freq = 440 * Math.pow(2, oct - 5 + (SEMI[m[2]] + (m[3] ? 1 : 0)) / 12);
    }
    out.push({ freq, ms });
  }
  return out;
}

/** Tiny music player: plays audio files via <audio>, ringtones via WebAudio. */
export class Player {
  index = 0;
  playing = false;
  elapsed = 0;
  duration = 0;
  private loaded = -1;
  private audio?: HTMLAudioElement;
  private ctx?: AudioContext;
  private oscs: OscillatorNode[] = [];
  private startAt = 0;
  private total = 0;
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    public tracks: Track[],
    private onChange: () => void,
  ) {}

  get track(): Track | undefined {
    return this.tracks[this.index];
  }

  private emit() {
    this.onChange();
  }

  private ensureAudio() {
    if (this.audio) return this.audio;
    const a = new Audio();
    a.preload = "metadata";
    a.addEventListener("timeupdate", () => {
      this.elapsed = a.currentTime;
      this.emit();
    });
    a.addEventListener("loadedmetadata", () => {
      this.duration = a.duration || 0;
      this.emit();
    });
    a.addEventListener("ended", () => this.next(true));
    a.addEventListener("error", () => {
      this.playing = false;
      this.emit();
    });
    this.audio = a;
    return a;
  }

  private ensureCtx() {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  private stopAll() {
    this.audio?.pause();
    for (const o of this.oscs) {
      try {
        o.stop();
      } catch {}
    }
    this.oscs = [];
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  private start(i: number) {
    this.stopAll();
    const t = this.tracks[i];
    if (!t) return;
    this.index = i;
    this.loaded = i;
    this.elapsed = 0;
    this.duration = 0;
    this.playing = true;

    if ("src" in t) {
      const a = this.ensureAudio();
      a.src = t.src;
      a.currentTime = 0;
      a.play().catch(() => {
        this.playing = false;
        this.emit();
      });
    } else {
      const ctx = this.ensureCtx();
      void ctx.resume();
      const gain = ctx.createGain();
      gain.gain.value = 0.05;
      gain.connect(ctx.destination);
      const t0 = ctx.currentTime + 0.05;
      let time = t0;
      for (const n of parseRtttl(t.ringtone)) {
        const len = n.ms / 1000;
        if (n.freq) {
          const osc = ctx.createOscillator();
          osc.type = "square";
          osc.frequency.value = n.freq;
          osc.connect(gain);
          osc.start(time);
          osc.stop(time + len * 0.9);
          this.oscs.push(osc);
        }
        time += len;
      }
      this.startAt = t0;
      this.total = time - t0;
      this.duration = this.total;
      this.timer = setInterval(() => {
        const el = ctx.currentTime - this.startAt;
        if (el >= this.total) {
          this.stopAll();
          this.playing = false;
          this.loaded = -1;
          this.elapsed = 0;
        } else {
          this.elapsed = Math.max(0, el);
        }
        this.emit();
      }, 150);
    }
    this.emit();
  }

  toggle() {
    const t = this.track;
    if (!t) return;
    if (this.playing) {
      if ("src" in t) this.audio?.pause();
      else void this.ctx?.suspend();
      this.playing = false;
    } else if (this.loaded === this.index) {
      if ("src" in t) void this.audio?.play();
      else void this.ctx?.resume();
      this.playing = true;
    } else {
      this.start(this.index);
      return;
    }
    this.emit();
  }

  next(auto = false) {
    if (!this.tracks.length) return;
    const i = (this.index + 1) % this.tracks.length;
    if (this.playing || auto) {
      if (auto && i === 0) {
        this.stopAll();
        this.playing = false;
        this.loaded = -1;
        this.index = 0;
        this.elapsed = 0;
        this.emit();
        return;
      }
      this.start(i);
    } else {
      this.select(i);
    }
  }

  prev() {
    if (!this.tracks.length) return;
    const i = (this.index - 1 + this.tracks.length) % this.tracks.length;
    if (this.playing) this.start(i);
    else this.select(i);
  }

  private select(i: number) {
    this.stopAll();
    this.index = i;
    this.loaded = -1;
    this.elapsed = 0;
    this.duration = 0;
    this.emit();
  }

  destroy() {
    this.stopAll();
    void this.ctx?.close();
    this.ctx = undefined;
    this.playing = false;
    this.loaded = -1;
  }
}

/** Short keypad beep on its own context, so it still works while music is paused. */
let beepCtx: AudioContext | null = null;
export function keyBeep(freq = 1400) {
  try {
    beepCtx ??= new AudioContext();
    const ctx = beepCtx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    g.gain.value = 0.025;
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.045);
  } catch {}
}
