"use client";
import { useEffect, useRef } from "react";

// Pixel-art galaxy background: drawn at 1/PX resolution and scaled up with
// `image-rendering: pixelated`. Nebula + planet are a static dithered layer;
// stars twinkle and the odd shooting star crosses at a low, "8-bit" frame rate.

const PX = 3; // CSS pixels per art pixel
const FPS = 10;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const BLUE = ["#03061a", "#060c26", "#0a1536", "#0f1f4c", "#172c66", "#213d85", "#3254a6", "#4c72c4", "#7397dd"].map(hex);
const VIOLET = ["#03061a", "#080a28", "#110e3a", "#1b134f", "#271967", "#352181", "#4a2c9e", "#6740b8", "#8c5fd0"].map(hex);
const PLANET = ["#0a1430", "#132650", "#1f3d78", "#335ea3", "#5486c8", "#86b2e6"].map(hex);
const RING = ["#2a3f78", "#4a63a6", "#7d93cf"].map(hex);
const STAR_COLORS = ["#ffffff", "#ffffff", "#d6e4ff", "#a9c6ff", "#ffe9b5", "#c4dc8c"];

function hash(x: number, y: number, s: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function noise(x: number, y: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, s: number) {
  let t = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 5; i++) {
    t += amp * noise(x * f, y * f, s + i);
    f *= 2;
    amp *= 0.5;
  }
  return t / 0.97;
}

/** Pick a palette entry for value v (0..1) using ordered dithering. */
function dither(pal: RGB[], v: number, x: number, y: number): RGB {
  const lv = Math.max(0, Math.min(1, v)) * (pal.length - 1);
  let i = Math.floor(lv);
  if (lv - i > (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16) i++;
  return pal[Math.min(i, pal.length - 1)];
}

type Star = { x: number; y: number; kind: 0 | 1 | 2 | 3; color: string; speed: number; phase: number };

function buildScene(w: number, h: number) {
  const layer = document.createElement("canvas");
  layer.width = w;
  layer.height = h;
  const lctx = layer.getContext("2d")!;
  const img = lctx.createImageData(w, h);
  const d = img.data;

  const m = Math.min(w, h);
  // Milky-way band running bottom-left -> top-right
  const ang = Math.atan2(-h * 0.75, w);
  const nx = -Math.sin(ang), ny = Math.cos(ang);
  const cx = w * 0.5, cy = h * 0.52;
  const coreX = w * 0.38, coreY = h * 0.6;
  const bandW = m * 0.26;
  const bandAt = (x: number, y: number) => {
    const dd = ((x - cx) * nx + (y - cy) * ny) / bandW;
    return Math.exp(-dd * dd);
  };

  // planet
  const pr = Math.max(9, Math.round(m * 0.045));
  // On narrow screens the phone covers the top, so park the planet lower down.
  const narrow = w * PX < 640;
  const px = Math.round(w * (narrow ? 0.8 : 0.84)), py = Math.round(h * (narrow ? 0.86 : 0.18));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const band = bandAt(x, y);
      const n = fbm(x / 55, y / 55, 7);
      const n2 = fbm(x / 28 + 100, y / 28, 13);
      const cd = Math.hypot(x - coreX, y - coreY) / (m * 0.22);
      let v = 0.06 + 0.1 * (1 - y / h);
      v += band * Math.pow(n, 1.6) * 1.15 * (0.55 + n2 * 0.7);
      v += 0.45 * Math.exp(-cd * cd) * (0.6 + n * 0.6);
      // dark dust lane through the band
      const lane = Math.abs(((x - cx) * nx + (y - cy) * ny) / bandW + 0.08 - (n2 - 0.5) * 0.25);
      if (lane < 0.09) v *= 0.45 + lane * 5;
      const pal = fbm(x / 80 + 50, y / 80 + 50, 21) > 0.54 ? VIOLET : BLUE;
      const [r, g, b] = dither(pal, v, x, y);
      const i = (y * w + x) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  }

  const put = (x: number, y: number, c: RGB) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
  };
  // ring (back half), planet, ring (front half)
  const tilt = -0.32;
  const ring = (front: boolean) => {
    for (let k = 0; k < 720; k++) {
      const t = (k / 720) * Math.PI * 2;
      const isFront = Math.sin(t) > 0;
      if (isFront !== front) continue;
      for (let rr = 0; rr < 3; rr++) {
        const a = pr * (1.65 + rr * 0.22), b = pr * (0.36 + rr * 0.05);
        const ex = Math.cos(t) * a, ey = Math.sin(t) * b;
        const x = Math.round(px + ex * Math.cos(tilt) - ey * Math.sin(tilt));
        const y = Math.round(py + ex * Math.sin(tilt) + ey * Math.cos(tilt));
        if (!front && Math.hypot(x - px, y - py) < pr) continue;
        put(x, y, RING[rr === 1 ? 2 : rr === 0 ? 1 : 0]);
      }
    }
  };
  ring(false);
  for (let y = -pr; y <= pr; y++) {
    for (let x = -pr; x <= pr; x++) {
      const r2 = x * x + y * y;
      if (r2 > pr * pr) continue;
      const z = Math.sqrt(pr * pr - r2) / pr;
      const light = Math.max(0, (-x / pr) * 0.55 + (-y / pr) * 0.45 + z * 0.75);
      const stripes = 0.08 * Math.sin((y / pr) * 9 + noise(x / 4, y / 2, 3) * 2);
      put(px + x, py + y, dither(PLANET, light * 0.9 + stripes, px + x, py + y));
    }
  }
  ring(true);

  lctx.putImageData(img, 0, 0);

  // stars — denser inside the band
  const stars: Star[] = [];
  const target = Math.round((w * h) / 140);
  for (let tries = 0; stars.length < target && tries < target * 6; tries++) {
    const x = Math.floor(Math.random() * w), y = Math.floor(Math.random() * h);
    if (Math.random() > 0.3 + bandAt(x, y) * 0.7) continue;
    if (Math.hypot(x - px, y - py) < pr * 1.9) continue;
    const r = Math.random();
    const kind: Star["kind"] = r < 0.72 ? 0 : r < 0.93 ? 1 : r < 0.985 ? 2 : 3;
    stars.push({
      x,
      y,
      kind,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      speed: 0.6 + Math.random() * 2.2,
      phase: Math.random() * Math.PI * 2,
    });
  }
  return { layer, stars };
}

export default function Galaxy() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let scene: ReturnType<typeof buildScene> | null = null;
    let raf = 0, last = 0, resizeTimer: ReturnType<typeof setTimeout> | undefined;
    let shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
    let nextShoot = performance.now() + 2500 + Math.random() * 4000;

    const setup = () => {
      const w = Math.ceil(window.innerWidth / PX);
      const h = Math.ceil(window.innerHeight / PX);
      canvas.width = w;
      canvas.height = h;
      scene = buildScene(w, h);
      draw(performance.now());
    };

    const draw = (now: number) => {
      if (!scene) return;
      const { layer, stars } = scene;
      const t = now / 1000;
      ctx.globalAlpha = 1;
      ctx.drawImage(layer, 0, 0);
      for (const s of stars) {
        const tw = reduce ? 1 : 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
        const level = tw > 0.66 ? 1 : tw > 0.33 ? 0.6 : 0.3; // 3-step twinkle
        ctx.fillStyle = s.color;
        if (s.kind === 0) {
          ctx.globalAlpha = level * 0.65;
          ctx.fillRect(s.x, s.y, 1, 1);
        } else if (s.kind === 1) {
          ctx.globalAlpha = level;
          ctx.fillRect(s.x, s.y, 1, 1);
        } else {
          const arm = s.kind === 3 && level === 1 ? 2 : 1;
          ctx.globalAlpha = level;
          ctx.fillRect(s.x, s.y, 1, 1);
          ctx.globalAlpha = level * 0.55;
          ctx.fillRect(s.x - arm, s.y, arm, 1);
          ctx.fillRect(s.x + 1, s.y, arm, 1);
          ctx.fillRect(s.x, s.y - arm, 1, arm);
          ctx.fillRect(s.x, s.y + 1, 1, arm);
        }
      }
      // shooting star
      if (!reduce) {
        if (!shoot && now > nextShoot) {
          const w = canvas.width, h = canvas.height;
          shoot = { x: Math.random() * w * 0.7 + w * 0.15, y: Math.random() * h * 0.35, vx: 3, vy: 1.4, life: 22 };
          if (Math.random() < 0.5) {
            shoot.vx = -3;
            shoot.x += w * 0.15;
          }
        }
        if (shoot) {
          ctx.fillStyle = "#ffffff";
          for (let k = 0; k < 10; k++) {
            ctx.globalAlpha = Math.max(0, 1 - k / 10) * Math.min(1, shoot.life / 8);
            ctx.fillRect(Math.round(shoot.x - shoot.vx * k * 0.6), Math.round(shoot.y - shoot.vy * k * 0.6), 1, 1);
          }
          shoot.x += shoot.vx;
          shoot.y += shoot.vy;
          if (--shoot.life <= 0) {
            shoot = null;
            nextShoot = now + 5000 + Math.random() * 9000;
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden || now - last < 1000 / FPS) return;
      last = now;
      draw(now);
    };

    const onResize = () => {
      // Ignore small height changes (mobile address bar showing/hiding)
      const w = Math.ceil(window.innerWidth / PX), h = Math.ceil(window.innerHeight / PX);
      if (w === canvas.width && Math.abs(h - canvas.height) < canvas.height * 0.2) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(setup, 200);
    };

    setup();
    if (!reduce) raf = requestAnimationFrame(loop);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className="nk-galaxy" aria-hidden />;
}
