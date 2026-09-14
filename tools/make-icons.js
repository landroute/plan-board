/* icon.svg と同じ絵を PNG で出す。依存ライブラリなし（zlib のみ）。
   Android の PWA インストールは PNG を要求するため、SVG とは別に生成する。
   使い方: node tools/make-icons.js */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const OUT = path.join(__dirname, '..');

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function draw(size, inset) {
  const buf = Buffer.alloc(size * size * 4);
  const S = v => Math.round(v / 512 * size);
  const bg = hex('#141414');
  const put = (x, y, c, a) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const na = a === undefined ? 1 : a;
    buf[i]     = Math.round(buf[i]     * (1 - na) + c[0] * na);
    buf[i + 1] = Math.round(buf[i + 1] * (1 - na) + c[1] * na);
    buf[i + 2] = Math.round(buf[i + 2] * (1 - na) + c[2] * na);
    buf[i + 3] = 255;
  };
  const rect = (x, y, w, h, r, color, alpha) => {
    const X = S(x), Y = S(y), W = S(w), H = S(h), R = S(r);
    for (let py = Y; py < Y + H; py++) for (let px = X; px < X + W; px++) {
      const dx = Math.max(X + R - px, px - (X + W - 1 - R), 0);
      const dy = Math.max(Y + R - py, py - (Y + H - 1 - R), 0);
      if (dx * dx + dy * dy <= R * R) put(px, py, color, alpha);
    }
  };
  // 背景（maskable は角丸なしで全面塗り＝セーフゾーン確保）
  if (inset) { for (let i = 0; i < size * size; i++) { const o = i * 4; buf[o] = bg[0]; buf[o+1] = bg[1]; buf[o+2] = bg[2]; buf[o+3] = 255; } }
  else rect(0, 0, 512, 512, 96, bg);

  const k = inset ? 0.72 : 1, off = inset ? 512 * (1 - k) / 2 : 0;
  const m = (v) => off + v * k;
  rect(m(128), m(104), 8 * k, 304 * k, 4 * k, hex('#4a4a46'));
  rect(m(168), m(120), 216 * k, 104 * k, 20 * k, hex('#2f6597'));
  rect(m(168), m(248), 216 * k, 60 * k, 16 * k, hex('#2f6597'), 0.55);
  rect(m(168), m(332), 216 * k, 44 * k, 14 * k, hex('#3a3a37'));
  return png(size, size, buf);
}

fs.writeFileSync(path.join(OUT, 'icon-192.png'), draw(192, false));
fs.writeFileSync(path.join(OUT, 'icon-512.png'), draw(512, false));
fs.writeFileSync(path.join(OUT, 'icon-maskable.png'), draw(512, true));
console.log('wrote icon-192.png / icon-512.png / icon-maskable.png');
