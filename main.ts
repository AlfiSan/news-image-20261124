// THE TUESDAY WORLD — a one-page newspaper front page summing up
// Tuesday 24 November 2026, drawn from scratch in pure TypeScript.
// No network, no assets: every pixel is computed here, so both runs
// of this program write byte-identical output.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

// ---- palette (newsprint) ----
const PAPER: RGB = [247, 243, 234];
const INK: RGB = [17, 17, 17];
const RED: RGB = [176, 30, 36];
const NAVY: RGB = [27, 42, 74];
const GREY: RGB = [120, 116, 108];
const LIGHT: RGB = [232, 226, 214];

type RGB = [number, number, number];

// ---- framebuffer ----
const px = new Uint8Array(W * H * 3);
function paint(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0];
    px[i * 3 + 1] = c[1];
    px[i * 3 + 2] = c[2];
  }
}
function setPix(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPix(xx, yy, c);
  }
}
function hline(x: number, y: number, w: number, t: number, c: RGB): void {
  rect(x, y, w, t, c);
}
function vline(x: number, y: number, h: number, t: number, c: RGB): void {
  rect(x, y, t, h, c);
}

// ---- 5x7 bitmap font, one row per number, bit 4 = leftmost column ----
// Headlines are set in capitals, so the font carries capitals, digits
// and punctuation; lower-case input is upper-cased at draw time.
const FONT: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  "0": [14, 17, 19, 21, 25, 17, 14],
  "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 6, 8, 16, 31],
  "3": [30, 1, 1, 14, 1, 1, 30],
  "4": [2, 6, 10, 18, 31, 2, 2],
  "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [14, 16, 30, 17, 17, 17, 14],
  "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 1, 14],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 12, 12],
  ",": [0, 0, 0, 0, 12, 4, 8],
  "'": [4, 4, 8, 0, 0, 0, 0],
  "-": [0, 0, 0, 14, 0, 0, 0],
  ":": [0, 12, 12, 0, 12, 12, 0],
  ";": [0, 12, 12, 0, 12, 4, 8],
  "!": [4, 4, 4, 4, 4, 0, 4],
  "?": [14, 17, 1, 2, 4, 0, 4],
  "(": [2, 4, 8, 8, 8, 4, 2],
  ")": [8, 4, 2, 2, 2, 4, 8],
  "/": [1, 1, 2, 4, 8, 16, 16],
  "%": [25, 25, 2, 4, 8, 19, 19],
  $: [4, 15, 20, 14, 5, 30, 4],
  "&": [12, 18, 20, 8, 21, 18, 13],
  "+": [0, 4, 4, 14, 4, 4, 0],
  "=": [0, 0, 31, 0, 31, 0, 0],
  '"': [10, 10, 0, 0, 0, 0, 0],
  "#": [10, 10, 31, 10, 31, 10, 10],
  "*": [0, 4, 21, 14, 21, 4, 0],
  _: [0, 0, 0, 0, 0, 0, 31],
  "•": [0, 4, 14, 14, 14, 4, 0],
};

function drawChar(ch: string, x: number, y: number, s: number, c: RGB): void {
  const g = FONT[ch] ?? FONT["?"];
  for (let r = 0; r < 7; r++) {
    const row = g[r];
    for (let col = 0; col < 5; col++) {
      if (row & (1 << (4 - col))) {
        rect(x + col * s, y + r * s, s, s, c);
      }
    }
  }
}

function textWidth(t: string, s: number): number {
  return t.length * 6 * s - s;
}

function drawText(t: string, x: number, y: number, s: number, c: RGB): void {
  const up = t.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    drawChar(up[i], x + i * 6 * s, y, s, c);
  }
}

function drawCentered(t: string, y: number, s: number, c: RGB): void {
  const w = textWidth(t.toUpperCase(), s);
  drawText(t, Math.floor((W - w) / 2), y, s, c);
}

// Greedy word wrap: returns lines that fit maxChars characters.
function wrap(t: string, maxChars: number): string[] {
  const words = t.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur.length === 0) {
      cur = w;
    } else if (cur.length + 1 + w.length <= maxChars) {
      cur += " " + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur.length > 0) lines.push(cur);
  return lines;
}

// Draw wrapped text, returns the y just below the last line.
function drawWrapped(
  t: string,
  x: number,
  y: number,
  maxChars: number,
  s: number,
  c: RGB,
  maxLines?: number,
): number {
  const lines = wrap(t, maxChars);
  const n = maxLines === undefined ? lines.length : Math.min(lines.length, maxLines);
  for (let i = 0; i < n; i++) {
    drawText(lines[i], x, y + i * (7 * s + 2 * s), s, c);
  }
  return y + n * (7 * s + 2 * s);
}

// ---- PNG encoder (color type 2, 8-bit RGB, filter 0) ----
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- the day's news: every item below was reported on 24 Nov 2026 ----
// Lead: the Russian drone over Poland, plus the Kyiv-region toll.
const LEAD_KICKER = "WAR IN EUROPE";
const LEAD_HEAD = "RUSSIAN DRONE ENTERS POLISH AIRSPACE";
const LEAD_DECK =
  "WARSAW AUTHORISES A SHOOT-DOWN, THEN HOLDS FIRE AS THE DRONE TURNS EAST. NATO SENDS AWACS AFTER TWO BREACHES IN FOUR DAYS.";
const SUB_HEAD = "KYIV REGION TOLL CLIMBS TO 11 IN DYMER";
const SUB_DECK =
  "RESCUERS DIG THROUGH A FLATTENED BLOCK OF FLATS AS NIGHTLY BARRAGES GRIND ON INTO A FIFTH WINTER OF WAR.";

interface Medium {
  kicker: string;
  head: string;
  deck: string;
  bar: RGB;
}
const MEDIUM: Medium[] = [
  {
    kicker: "THE GULF",
    head: "THREE TANKERS HIT MINES IN HORMUZ",
    deck: "IRAN SAYS THE SHIPS CAUGHT FIRE IN THE STRAIT. OIL HOLDS NEAR A THREE-MONTH LOW AS SHIPPING RISK PERSISTS.",
    bar: RED,
  },
  {
    kicker: "BRITAIN",
    head: "12,000 EVACUATED IN MANCHESTER",
    deck: "A CONCERT CROWD IS CLEARED AFTER A GAS ALERT AND AN UNKNOWN SUBSTANCE AT THE VENUE.",
    bar: NAVY,
  },
];

interface Cell {
  kicker: string;
  head: string;
}
const GRID: Cell[] = [
  { kicker: "TECH", head: "HUANG BACK AT NVIDIA AS CHIEF" },
  { kicker: "CLIMATE", head: "COP31 TALKS COLLAPSE WITH NO DEAL" },
  { kicker: "DIPLOMACY", head: "PEACE PLAN DIVIDES EUROPE" },
  { kicker: "AMERICAS", head: "US NAMES CARTEL A TERROR GROUP" },
  { kicker: "BRAZIL", head: "BOLSONARO BACK IN JAIL" },
  { kicker: "HEALTH", head: "TYPHOID DRIVE FOR 50M CHILDREN" },
  { kicker: "EUROPE", head: "EU READIES 22ND RUSSIA PACKAGE" },
  { kicker: "TRADE", head: "TRUMP SEALS JAPAN TRADE DEAL" },
  { kicker: "TRADE", head: "US-INDONESIA DEAL; EU WARNS" },
  { kicker: "IRAN", head: "SINGER GETS 74 LASHES" },
  { kicker: "ASIA", head: "HIMALAYAN FLOOD: SCORES MISSING" },
  { kicker: "INDIA", head: "EX-MP JAILED FOR LIFE" },
  { kicker: "ASIA", head: "THAI-CAMBODIA TRUCE HOLDS" },
  { kicker: "AMERICA", head: "US TO REWRITE CITIZENSHIP TEST" },
  { kicker: "CHINA", head: "HONG KONG COURT REJECTS SONG BAN" },
  { kicker: "AMERICA", head: "SENATE TO VOTE ON $9.4BN CUTS" },
  { kicker: "JAPAN", head: "JAPAN ACTS ON FOREIGNER FEARS" },
  { kicker: "KOREA", head: "SEOUL MINISTER QUITS OVER AI ROW" },
];

const TICKER =
  "BRENT $88.97  •  WTI $79.94  •  NIKKEI RALLIES  •  NVIDIA SOARS";

// ---- a small radar motif for the lead story: a swept circle, a blip,
// and a dashed track standing in for an airspace incursion ----
function drawRadar(cx: number, cy: number, r: number): void {
  // concentric rings
  for (let k = 0; k < 3; k++) {
    const rr = r - k * 14;
    for (let a = 0; a < 360; a += 2) {
      const rad = (a * Math.PI) / 180;
      setPix(Math.round(cx + rr * Math.cos(rad)), Math.round(cy + rr * Math.sin(rad)), INK);
    }
  }
  // cross hairs
  hline(cx - r, cy, 2 * r, 2, INK);
  vline(cx, cy - r, 2 * r, 2, INK);
  // dashed intruder track, upper right
  for (let i = 0; i < 9; i++) {
    if (i % 2 === 0) rect(cx + 12 + i * 7, cy - 52 + i * 4, 5, 3, RED);
  }
  // the blip
  rect(cx + 66, cy - 20, 10, 10, RED);
  rect(cx + 68, cy - 22, 6, 6, RED);
}

function drawFrontPage(): void {
  paint(PAPER);
  const MX = 28; // side margin
  const CW = W - 2 * MX; // content width

  // ---- masthead ----
  hline(0, 0, W, 6, INK);
  drawCentered("THE TUESDAY WORLD", 26, 6, INK);
  hline(MX, 84, CW, 2, INK);
  drawCentered("TUESDAY, 24 NOVEMBER 2026  •  THE WORLD IN ONE PAGE", 94, 2, RED);
  hline(MX, 120, CW, 4, INK);

  // ---- lead story ----
  let y = 138;
  drawText(LEAD_KICKER, MX, y, 2, RED);
  y += 22;
  y = drawWrapped(LEAD_HEAD, MX, y, 42, 4, INK, 2);
  y += 8;
  // radar motif, right of the deck
  const radarX = W - MX - 120;
  const radarY = y + 34;
  y = drawWrapped(LEAD_DECK, MX, y, 58, 2, INK, 3);
  drawRadar(radarX, radarY, 52);
  y += 6;
  hline(MX, y, CW, 2, INK);
  y += 10;
  drawText(SUB_HEAD, MX, y, 3, INK);
  y += 30;
  y = drawWrapped(SUB_DECK, MX, y, 78, 2, INK, 2);
  y += 8;
  hline(MX, y, CW, 4, INK);
  y += 12;

  // ---- two medium stories ----
  const medTop = y;
  const medW = Math.floor((CW - 16) / 2);
  const medH = 148;
  for (let i = 0; i < 2; i++) {
    const x = MX + i * (medW + 16);
    const m = MEDIUM[i];
    rect(x, medTop, medW, 6, m.bar);
    drawText(m.kicker, x, medTop + 14, 2, RED);
    let yy = drawWrapped(m.head, x, medTop + 36, 26, 3, INK, 2);
    yy += 4;
    drawWrapped(m.deck, x, yy, 40, 2, INK, 3);
    if (i === 0) vline(x + medW + 8, medTop, medH, 1, GREY);
  }
  y = medTop + medH + 4;
  hline(MX, y, CW, 2, INK);
  y += 12;

  // ---- grid: 3 columns x 6 rows ----
  const cols = 3;
  const rows = 6;
  const gap = 14;
  const cellW = Math.floor((CW - (cols - 1) * gap) / cols);
  const gridTop = y;
  const gridBottom = 956;
  const cellH = Math.floor((gridBottom - gridTop) / rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const cell = GRID[idx];
      const x = MX + c * (cellW + gap);
      const cy = gridTop + r * cellH;
      drawText(cell.kicker, x, cy, 1, RED);
      drawWrapped(cell.head, x, cy + 12, 26, 2, INK, 3);
      if (c < cols - 1) vline(x + cellW + 7, cy, cellH - 12, 1, LIGHT);
      if (r < rows - 1) hline(x, cy + cellH - 8, cellW, 1, LIGHT);
    }
  }

  // ---- footer ticker ----
  rect(0, 968, W, 56, INK);
  drawCentered(TICKER, 988, 2, PAPER);
}

function main(): void {
  const outDir =
    process.env.MAKEFUN_OUTPUT_DIR ?? process.env.OUTPUT_DIR ?? "/output";
  drawFrontPage();
  const png = encodePNG();
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.png"), png);
}

main();

