// Draws images/icon.png (128x128): a dark tile with a ring in three segments, green, orange, red.
// No dependencies: 4x4 supersampling and a hand-written PNG encoder. Run: npm run icon
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const S = 128, SS = 4;
const bg = [30, 30, 34], segs = [[137, 209, 133], [209, 134, 22], [241, 76, 76]];
const cx = S / 2, cy = S / 2, rOut = 46, rIn = 32, corner = 24, gap = 0.16; // gap in radians

function sample(x, y) {
  // Rounded-square tile.
  const qx = Math.max(Math.abs(x - cx) - (S / 2 - corner), 0), qy = Math.max(Math.abs(y - cy) - (S / 2 - corner), 0);
  if (Math.hypot(qx, qy) > corner) return null;
  const d = Math.hypot(x - cx, y - cy);
  if (d < rIn || d > rOut) return bg;
  let a = Math.atan2(x - cx, -(y - cy)); // 0 at top, clockwise
  if (a < 0) a += 2 * Math.PI;
  const third = (2 * Math.PI) / 3, i = Math.floor(a / third), off = a - i * third;
  return off < gap / 2 || off > third - gap / 2 ? bg : segs[i];
}

const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;
  for (let x = 0; x < S; x++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
      const c = sample(x + (i + 0.5) / SS, y + (j + 0.5) / SS);
      if (c) { r += c[0]; g += c[1]; b += c[2]; n++; }
    }
    const o = y * (S * 4 + 1) + 1 + x * 4;
    raw[o] = n ? r / n : 0; raw[o + 1] = n ? g / n : 0; raw[o + 2] = n ? b / n : 0;
    raw[o + 3] = Math.round((n / (SS * SS)) * 255);
  }
}

const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td));
  return Buffer.concat([len, td, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
]);
const out = path.join(__dirname, "..", "images", "icon.png");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log(`wrote ${out}`);
