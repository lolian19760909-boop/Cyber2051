/*
 * ASCII Magic pieces for the city map loading screen (DESIGN.md 10.14).
 * Vendored from ascii-magic-art 1.0.2 (github.com/kailashsr38/ascii-magic-art): lib/kit.js and
 * pieces/wireframe-city.js, with the ES module syntax removed.
 *
 * MIT License
 *
 * Copyright (c) 2026 ASCII Magic (ascii-magic.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
window.CxxAsciiMagic=window.CxxAsciiMagic||(()=>{
const kit=(()=>{
/*
 * kit.js: the small toolbox every piece is built from. No dependencies, runs
 * the same in a browser and in Node.
 *
 * A piece draws into a Grid and returns grid.frame(). A Grid holds one
 * character and one colour key per cell. Colour keys are single characters
 * that index the piece's meta.palette; a space means "default ink".
 */

const RAMPS = {
  classic: " .:-=+*#%@",
  fine: " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  dots: " .·•●",
  blocks: " ░▒▓█",
  soft: " .,-~:;=!*#$@",
  lines: " -=≡",
};

/** Map 0..1 to a character of a ramp. */
function ramp(v, chars = RAMPS.classic) {
  const i = Math.max(0, Math.min(chars.length - 1, Math.floor(v * chars.length)));
  return chars[i];
}

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const fract = (v) => v - Math.floor(v);
const TAU = Math.PI * 2;

/** Deterministic PRNG (mulberry32). Same seed, same art on every load. */
function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── noise ──────────────────────────────────────────────────────────── */
function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** 2D value noise in 0..1. */
function noise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, xf), lerp(c, d, xf), yf);
}
/** Fractal noise, a few octaves of noise2, in 0..1. */
function fbm(x, y, octaves = 4, seed = 0) {
  let v = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    v += amp * noise2(x * f, y * f, seed + i * 17);
    norm += amp; amp *= 0.5; f *= 2;
  }
  return v / norm;
}

/* ── colour ─────────────────────────────────────────────────────────── */
function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const x = (v) => Math.round(v * 255).toString(16).padStart(2, "0");
  return "#" + x(f(0)) + x(f(8)) + x(f(4));
}
/** Build a palette object from a list of hex colours: keys "0".."9","a".."z". */
const KEYS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
function palette(hexes) {
  const p = {};
  hexes.forEach((h, i) => (p[KEYS[i]] = h));
  return p;
}
/** A gradient palette of n steps between colour stops, for shading by value. */
function gradient(stops, n = 10) {
  const toRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const rgb = stops.map(toRgb);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (rgb.length - 1);
    const j = Math.min(rgb.length - 2, Math.floor(t)), f = t - j;
    const c = rgb[j].map((v, k) => Math.round(lerp(v, rgb[j + 1][k], f)));
    out.push("#" + c.map((v) => v.toString(16).padStart(2, "0")).join(""));
  }
  return out;
}

/* ── the grid ───────────────────────────────────────────────────────── */
class Grid {
  constructor(cols, rows) {
    this.cols = cols; this.rows = rows;
    this.ch = new Array(cols * rows).fill(" ");
    this.co = new Array(cols * rows).fill(" ");
    this.z = new Float32Array(cols * rows);
  }
  clear(ch = " ", co = " ") { this.ch.fill(ch); this.co.fill(co); this.z.fill(-Infinity); return this; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.cols && y < this.rows; }
  /** Put a character (and optional colour key) at integer x,y. */
  set(x, y, ch, co) {
    x = Math.floor(x); y = Math.floor(y);
    if (!this.inside(x, y)) return;
    const i = x + y * this.cols;
    this.ch[i] = ch; if (co !== undefined) this.co[i] = co;
  }
  /** Depth-tested put: only draws when z is nearer (larger) than what is there. */
  setZ(x, y, z, ch, co) {
    x = Math.floor(x); y = Math.floor(y);
    if (!this.inside(x, y)) return;
    const i = x + y * this.cols;
    if (z <= this.z[i]) return;
    this.z[i] = z; this.ch[i] = ch; if (co !== undefined) this.co[i] = co;
  }
  get(x, y) { return this.inside(x, y) ? this.ch[Math.floor(x) + Math.floor(y) * this.cols] : " "; }
  /** Write a string left to right. */
  text(x, y, s, co) { for (let i = 0; i < s.length; i++) this.set(x + i, y, s[i], co); }
  /** Write a multi-line block (lines split on \n). Spaces are transparent unless solid. */
  block(x, y, s, co, solid = false) {
    s.split("\n").forEach((line, r) => {
      for (let i = 0; i < line.length; i++) if (solid || line[i] !== " ") this.set(x + i, y + r, line[i], co);
    });
  }
  hline(x0, x1, y, ch = "─", co) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, ch, co); }
  vline(x, y0, y1, ch = "│", co) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, ch, co); }
  /** Box with light, heavy, double or round corners. */
  box(x, y, w, h, style = "light", co) {
    const S = {
      light: "┌┐└┘─│", heavy: "┏┓┗┛━┃", double: "╔╗╚╝═║", round: "╭╮╰╯─│", ascii: "++++-|",
    }[style] || style;
    this.hline(x + 1, x + w - 2, y, S[4], co); this.hline(x + 1, x + w - 2, y + h - 1, S[4], co);
    this.vline(x, y + 1, y + h - 2, S[5], co); this.vline(x + w - 1, y + 1, y + h - 2, S[5], co);
    this.set(x, y, S[0], co); this.set(x + w - 1, y, S[1], co);
    this.set(x, y + h - 1, S[2], co); this.set(x + w - 1, y + h - 1, S[3], co);
  }
  fill(x, y, w, h, ch = " ", co) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, ch, co); }
  /** Bresenham line. */
  line(x0, y0, x1, y1, ch = "*", co) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (let n = 0; n < 4000; n++) {
      this.set(x0, y0, typeof ch === "function" ? ch(x0, y0) : ch, co);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  /** Ellipse outline, corrected for tall cells when aspect=0.5. */
  circle(cx, cy, r, ch = "o", co, aspect = 0.5) {
    const n = Math.max(12, Math.ceil(r * 8));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      this.set(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * aspect), ch, co);
    }
  }
  /** Call fn(x, y, u, v) for every cell; u,v in 0..1. Write via the return value [ch, co]. */
  shade(fn) {
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      const r = fn(x, y, x / (this.cols - 1), y / (this.rows - 1));
      if (r) this.set(x, y, r[0], r[1]);
    }
  }
  /** The frame a piece returns: plain text when no colours were used, else {text, color}. */
  frame() {
    const lines = [], cl = [];
    let colored = false;
    for (let y = 0; y < this.rows; y++) {
      lines.push(this.ch.slice(y * this.cols, (y + 1) * this.cols).join(""));
      const c = this.co.slice(y * this.cols, (y + 1) * this.cols).join("");
      if (!colored && c.trim()) colored = true;
      cl.push(c);
    }
    return colored ? { text: lines.join("\n"), color: cl.join("\n") } : lines.join("\n");
  }
}

/* ── 3D ─────────────────────────────────────────────────────────────── */
function rotX([x, y, z], a) { const c = Math.cos(a), s = Math.sin(a); return [x, y * c - z * s, y * s + z * c]; }
function rotY([x, y, z], a) { const c = Math.cos(a), s = Math.sin(a); return [x * c + z * s, y, -x * s + z * c]; }
function rotZ([x, y, z], a) { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c, z]; }
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
/** Perspective-project a point to grid coords. Cells are ~2x taller than wide. */
function project([x, y, z], cols, rows, fov = 1.6, dist = 4) {
  const k = fov / (z + dist);
  const s = Math.min(cols * 0.5, rows);
  return [cols / 2 + x * k * s, rows / 2 - y * k * s * 0.5, k];
}
/** Draw a wireframe from vertices + edge index pairs. */
function wire(g, verts, edges, ch = "·", co) {
  for (const [a, b] of edges) g.line(verts[a][0], verts[a][1], verts[b][0], verts[b][1], ch, co);
}

/* ── small text font (3x5) for numbers and short labels ─────────────── */
const F3 = {
  "0": "███│█ █│█ █│█ █│███", "1": " █ │██ │ █ │ █ │███", "2": "███│  █│███│█  │███",
  "3": "███│  █│███│  █│███", "4": "█ █│█ █│███│  █│  █", "5": "███│█  │███│  █│███",
  "6": "███│█  │███│█ █│███", "7": "███│  █│  █│  █│  █", "8": "███│█ █│███│█ █│███",
  "9": "███│█ █│███│  █│███", ":": "   │ █ │   │ █ │   ", " ": "   │   │   │   │   ",
  "-": "   │   │███│   │   ", ".": "   │   │   │   │ █ ", "%": "█ █│  █│ █ │█  │█ █",
};
/** Draw digits in a 3x5 block font. Returns the width used. */
function bigText(g, x, y, s, co, on = "█") {
  let cx = x;
  for (const c of String(s)) {
    const glyph = F3[c] || F3[" "];
    glyph.split("│").forEach((row, r) => { for (let i = 0; i < 3; i++) if (row[i] !== " ") g.set(cx + i, y + r, on, co); });
    cx += 4;
  }
  return cx - x;
}

return {RAMPS,ramp,clamp,lerp,smooth,fract,TAU,rng,noise2,fbm,hsl,KEYS,palette,gradient,Grid,rotX,rotY,rotZ,dot,norm,project,wire,bigText};
})();
const pieces={};
pieces["wireframe-city"]=(()=>{const {RAMPS,ramp,clamp,lerp,smooth,fract,TAU,rng,noise2,fbm,hsl,KEYS,palette,gradient,Grid,rotX,rotY,rotZ,dot,norm,project,wire,bigText}=kit;
/* wireframe-city: a night flight down an avenue through a wireframe city, glowing edges racing past. */

/* small 3D kit for this piece: view space has +z away from the viewer, larger depth is nearer. */
const LT = (() => { const v = [-0.55, 0.62, -0.56], l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; })();
/** Lambert plus a specular glint, 0..1, for a unit view-space normal. */
function lit(n, amb = 0.1, sp = 0.55, pw = 22) {
  const d = n[0] * LT[0] + n[1] * LT[1] + n[2] * LT[2];
  const rz = 2 * d * n[2] - LT[2];
  const s = d > 0 && rz < 0 ? Math.pow(-rz, pw) : 0;
  return Math.min(1, amb + Math.max(0, d) * (1 - amb) * 0.88 + s * sp);
}
/** Rotation matrix from Euler angles (x, then y, then z). */
function mat(ax, ay, az) {
  const a = Math.cos(ax), b = Math.sin(ax), c = Math.cos(ay), d = Math.sin(ay), e = Math.cos(az), f = Math.sin(az);
  // R = Rz * Ry * Rx
  return [e * c, e * d * b - f * a, e * d * a + f * b, f * c, f * d * b + e * a, f * d * a - e * b, -d, c * b, c * a];
}
const mul = (m, n) => [
  m[0] * n[0] + m[1] * n[3] + m[2] * n[6], m[0] * n[1] + m[1] * n[4] + m[2] * n[7], m[0] * n[2] + m[1] * n[5] + m[2] * n[8],
  m[3] * n[0] + m[4] * n[3] + m[5] * n[6], m[3] * n[1] + m[4] * n[4] + m[5] * n[7], m[3] * n[2] + m[4] * n[5] + m[5] * n[8],
  m[6] * n[0] + m[7] * n[3] + m[8] * n[6], m[6] * n[1] + m[7] * n[4] + m[8] * n[7], m[6] * n[2] + m[7] * n[5] + m[8] * n[8]];
const app = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
/** Filled triangle in screen cells with a depth test; points are [x, y, depth]. */
function tri(g, a, b, c, ch, co) {
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(area) < 1e-6) return;
  const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(g.cols - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(g.rows - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5, py = y + 0.5;
    const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area;
    const w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area;
    const w2 = 1 - w0 - w1;
    if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
    g.setZ(x, y, w0 * a[2] + w1 * b[2] + w2 * c[2], typeof ch === "function" ? ch(w0, w1, w2) : ch, co);
  }
}
/** A depth-tested line between projected points, nudged toward the viewer by bias. */
function seg(g, a, b, ch, co, bias = 0) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) * 1.5));
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    g.setZ(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f + bias, typeof ch === "function" ? ch(f) : ch, co);
  }
}
/** Character for a line drawn in screen direction dx, dy (tall cells). */
function slopeChar(dx, dy) {
  const a = Math.atan2(dy * 2, dx), s = Math.abs(Math.sin(a)), c = Math.abs(Math.cos(a));
  if (s < 0.38) return "─";
  if (c < 0.38) return "│";
  return (dx > 0) === (dy > 0) ? "╲" : "╱";
}
const BLK = "░▒▓█";
/** Block shade glyph for a light level 0..1. */
const blk = (l) => BLK[l < 0.2 ? 0 : l < 0.42 ? 1 : l < 0.68 ? 2 : 3];

const EDGE = gradient(["#0a2a3a", "#0e5a6e", "#18a0b8", "#4ee6f0", "#c8ffff"], 10);
const EDGE2 = gradient(["#2a0a30", "#5a1468", "#a02ab8", "#e85ae8", "#ffc8ff"], 10);
const SKY = gradient(["#02030a", "#060a1c", "#0e1430", "#1c1640", "#341848"], 6);
const meta = {
  slug: "wireframe-city",
  name: "Wireframe City Flyby",
  category: "solids",
  note: "A night flight down a long avenue between wireframe towers, cyan and magenta edges racing past over a gridded street.",
  tags: ["3d", "wireframe", "city", "flyover", "synthwave", "hero"],
  cols: 100, rows: 34, fps: 30,
  palette: palette([...EDGE, ...EDGE2, ...SKY, "#04060e", "#070a16", "#121c36"]),
};

function create() {
  const { cols, rows } = meta;
  const g = new Grid(cols, rows);
  const BL = 7, NB = 24;       // block length along the avenue; blocks in the repeating strip
  const r = rng(12);
  const towers = [];
  for (let j = 0; j < NB; j++) for (const side of [-1, 1]) for (let lane = 0; lane < 3; lane++) {
    const w = 2 + r() * 2.2, dpt = 2.4 + r() * 2.8;
    const h = lane === 0 ? 3 + r() * 9 : 6 + r() * 16;
    towers.push({ x: side * (5 + lane * 6.5 + r() * 1.5), z: j * BL + r() * 2, w, d: dpt, h, hue: r() < 0.3 ? 1 : 0 });
  }
  const LEN = NB * BL;
  const FOC = 30, HOR = 12;
  const P = (v) => { const z = Math.max(0.05, v[2]); return [cols / 2 + (v[0] / z) * FOC, HOR - (v[1] / z) * FOC * 0.5, 1 / z]; };
  const FACES = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [1, 2, 6, 5], [0, 3, 7, 4]];
  const EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  return (t) => {
    g.clear();
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (y <= HOR) g.set(x, y, y > HOR - 3 ? "▒" : "░", KEYS[20 + Math.min(5, Math.floor((y / HOR) * 6))]);
      else g.set(x, y, "░", KEYS[27]);
    }
    const camZ = t * 8, camY = 3.2 + 0.6 * Math.sin(t * 0.4), camX = 0.8 * Math.sin(t * 0.3);
    // street grid lines
    for (let k = 0; k < 40; k++) {
      const zw = Math.ceil(camZ / 2) * 2 + k * 2, z = zw - camZ;
      if (z < 0.6) continue;
      const a = P([-60 - camX, -camY, z]), b = P([60 - camX, -camY, z]);
      seg(g, a, b, "─", KEYS[Math.max(0, 4 - Math.floor(z / 14))], -1);
    }
    for (let lx = -36; lx <= 36; lx += 4) {
      const a = P([lx - camX, -camY, 0.8]), b = P([lx - camX, -camY, 90]);
      seg(g, a, b, lx === 0 ? "┊" : slopeChar(b[0] - a[0], b[1] - a[1]), KEYS[lx === 0 ? 13 : 2], -1);
    }
    const tilt = 0.04 * Math.sin(t * 0.3);
    for (const tw of towers) {
      let z = ((tw.z - camZ) % LEN + LEN) % LEN;
      if (z < 1.2 || z > 95) continue;
      const x0 = tw.x - camX - tw.w / 2, x1 = x0 + tw.w, y0 = -camY, y1 = tw.h - camY, z0 = z, z1 = z + tw.d;
      const V = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]
        .map(([x, y, zz]) => [x + y * tilt, y - x * tilt, zz]);
      const S = V.map(P);
      for (const f of FACES) { tri(g, S[f[0]], S[f[1]], S[f[2]], "░", KEYS[28]); tri(g, S[f[0]], S[f[2]], S[f[3]], "░", KEYS[28]); }
      const bright = Math.max(0, Math.min(9, Math.floor(10 - z / 9)));
      for (const [a, b] of EDGES) seg(g, S[a], S[b], slopeChar(S[b][0] - S[a][0], S[b][1] - S[a][1]), KEYS[tw.hue * 10 + bright], 0.004);
      // floor lines on the face toward the avenue
      const near = tw.x < 0 ? [1, 5] : [0, 4];
      for (let fy = 2.5; fy < tw.h - 0.5; fy += 2.5) {
        const a = P([V[near[0]][0], fy - camY, z0]), b = P([V[near[1]][0], fy - camY, z1]);
        seg(g, a, b, "·", KEYS[tw.hue * 10 + Math.max(0, bright - 3)], 0.002);
      }
    }
    return g.frame();
  };
}

return {meta,create};
})();
return Object.freeze({pieces});
})();
