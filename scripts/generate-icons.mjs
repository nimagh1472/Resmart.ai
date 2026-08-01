/**
 * Generates the PWA icon set as flat PNGs (no image deps — raw pixels + zlib).
 * Run with: node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

const CANVAS = [0x05, 0x07, 0x0a]; // Deep Void
const CYAN = [0x38, 0xbd, 0xf8]; // Electric Cyan
const EMERALD = [0x10, 0xb9, 0x81]; // Emerald Green

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, pixelAt) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelAt(x, y);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => a.map((c, i) => Math.round(c + (b[i] - c) * t));
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** Signed distance to a rounded rectangle centred on the canvas. */
function roundedRectSdf(x, y, size, inset, radius) {
  const c = size / 2;
  const half = c - inset;
  const dx = Math.abs(x + 0.5 - c) - (half - radius);
  const dy = Math.abs(y + 0.5 - c) - (half - radius);
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - radius;
}

function makeIcon(size, { padding = 0.12 } = {}) {
  const inset = size * padding;
  const radius = (size - inset * 2) * 0.24;
  // Diagonal notch: the mark's negative space.
  const notchHalfWidth = size * 0.055;

  return (x, y) => {
    const d = roundedRectSdf(x, y, size, inset, radius);
    const coverage = clamp01(0.5 - d); // 1px antialiased edge
    if (coverage <= 0) return CANVAS;

    const t = clamp01((x / size) * 0.6 + (y / size) * 0.4);
    let fill = mix(CYAN, EMERALD, t);

    // Carve a diagonal slash out of the tile.
    const slash = Math.abs(x - y) / Math.SQRT2;
    const slashCoverage = clamp01(0.5 + (notchHalfWidth - slash));
    fill = mix(fill, CANVAS, slashCoverage);

    return mix(CANVAS, fill, coverage);
  };
}

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  ["icon-192.png", 192, { padding: 0.1 }],
  ["icon-512.png", 512, { padding: 0.1 }],
  // Maskable icons need the mark inside the 80% safe zone.
  ["icon-maskable-512.png", 512, { padding: 0.22 }],
  ["apple-touch-icon.png", 180, { padding: 0.08 }],
];

for (const [name, size, opts] of targets) {
  writeFileSync(join(OUT_DIR, name), encodePng(size, makeIcon(size, opts)));
  console.log(`wrote ${name} (${size}x${size})`);
}
