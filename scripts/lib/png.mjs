// Minimal image I/O for the generator scripts — no dependencies.
//   encodePNG(w, h, rgb)  → Buffer   (RGB8, Paeth filter)
//   decodeBMP(buf)        → { w, h, rgb }   (24/32-bit, as written by macOS `sips -s format bmp`)
import zlib from "node:zlib";

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0;
});
const crc = buf => { let c = ~0; for (const v of buf) c = CRC[(c ^ v) & 255] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (type, data) => {
  const t = Buffer.from(type), len = Buffer.alloc(4), sum = Buffer.alloc(4);
  len.writeUInt32BE(data.length); sum.writeUInt32BE(crc(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, sum]);
};

export function encodePNG(w, h, rgb) {
  const stride = w * 3, raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 4;
    for (let x = 0; x < stride; x++) {
      const v = rgb[y * stride + x];
      const a = x >= 3 ? rgb[y * stride + x - 3] : 0;
      const b = y ? rgb[(y - 1) * stride + x] : 0;
      const c = x >= 3 && y ? rgb[(y - 1) * stride + x - 3] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      raw[y * (stride + 1) + 1 + x] = (v - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export function decodeBMP(buf) {
  if (buf.toString("ascii", 0, 2) !== "BM") throw new Error("not a BMP");
  const off = buf.readUInt32LE(10), w = buf.readInt32LE(18), hRaw = buf.readInt32LE(22), bpp = buf.readUInt16LE(28);
  if (bpp !== 24 && bpp !== 32) throw new Error(`unsupported BMP depth ${bpp}`);
  const h = Math.abs(hRaw), bottomUp = hRaw > 0, Bpp = bpp / 8, stride = Math.ceil((w * Bpp) / 4) * 4;
  const rgb = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    const row = off + (bottomUp ? h - 1 - y : y) * stride;
    for (let x = 0; x < w; x++) {
      const i = row + x * Bpp, o = (y * w + x) * 3;
      rgb[o] = buf[i + 2]; rgb[o + 1] = buf[i + 1]; rgb[o + 2] = buf[i];
    }
  }
  return { w, h, rgb };
}
