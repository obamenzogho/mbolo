const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  name.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return out;
}

function writePng(filePath, width, height, pixels) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    pixels.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  fs.writeFileSync(filePath, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

function canvas(size, bg) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    pixels[i * 4] = bg[0];
    pixels[i * 4 + 1] = bg[1];
    pixels[i * 4 + 2] = bg[2];
    pixels[i * 4 + 3] = bg[3];
  }
  return pixels;
}

function blend(pixels, size, x, y, color, alpha = 1) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (Math.floor(y) * size + Math.floor(x)) * 4;
  const a = (color[3] / 255) * alpha;
  pixels[i] = Math.round(color[0] * a + pixels[i] * (1 - a));
  pixels[i + 1] = Math.round(color[1] * a + pixels[i + 1] * (1 - a));
  pixels[i + 2] = Math.round(color[2] * a + pixels[i + 2] * (1 - a));
  pixels[i + 3] = Math.round(255 * a + pixels[i + 3] * (1 - a));
}

function roundedRect(pixels, size, x, y, w, h, r, color) {
  for (let py = Math.floor(y); py < y + h; py++) {
    for (let px = Math.floor(x); px < x + w; px++) {
      const cx = px < x + r ? x + r : px > x + w - r ? x + w - r : px;
      const cy = py < y + r ? y + r : py > y + h - r ? y + h - r : py;
      const inCorner = (px < x + r || px > x + w - r) && (py < y + r || py > y + h - r);
      if (!inCorner || Math.hypot(px - cx, py - cy) <= r) {
        blend(pixels, size, px, py, color);
      }
    }
  }
}

function circle(pixels, size, cx, cy, radius, color) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= cy + radius; y++) {
    for (let x = Math.floor(cx - radius); x <= cx + radius; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) {
        blend(pixels, size, x, y, color);
      }
    }
  }
}

function line(pixels, size, x1, y1, x2, y2, width, color) {
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    circle(pixels, size, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, width / 2, color);
  }
}

function makeLogo(size, transparent = false) {
  const green = [0, 168, 107, 255];
  const blue = [58, 117, 196, 255];
  const shadow = [3, 20, 31, 180];
  const pixels = canvas(size, transparent ? [0, 0, 0, 0] : blue);
  const pad = size * 0.08;

  roundedRect(pixels, size, pad, pad, size - pad * 2, size - pad * 2, size * 0.24, blue);

  const w = size * 0.14;
  line(pixels, size, size * 0.285, size * 0.72, size * 0.285, size * 0.30, w, shadow);
  line(pixels, size, size * 0.285, size * 0.30, size * 0.50, size * 0.55, w, shadow);
  line(pixels, size, size * 0.50, size * 0.55, size * 0.715, size * 0.30, w, shadow);
  line(pixels, size, size * 0.715, size * 0.30, size * 0.715, size * 0.72, w, shadow);

  line(pixels, size, size * 0.27, size * 0.70, size * 0.27, size * 0.28, w, green);
  line(pixels, size, size * 0.27, size * 0.28, size * 0.50, size * 0.54, w, green);
  line(pixels, size, size * 0.50, size * 0.54, size * 0.73, size * 0.28, w, green);
  line(pixels, size, size * 0.73, size * 0.28, size * 0.73, size * 0.70, w, green);

  return pixels;
}

function main() {
  const assetsDir = path.join(__dirname, '..', 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  writePng(path.join(assetsDir, 'icon.png'), 1024, 1024, makeLogo(1024));
  writePng(path.join(assetsDir, 'adaptive-icon.png'), 1024, 1024, makeLogo(1024, true));
  writePng(path.join(assetsDir, 'splash-icon.png'), 1024, 1024, makeLogo(1024, true));
  writePng(path.join(assetsDir, 'favicon.png'), 256, 256, makeLogo(256));
  console.log('[logo] Mbolo assets generated');
}

main();
