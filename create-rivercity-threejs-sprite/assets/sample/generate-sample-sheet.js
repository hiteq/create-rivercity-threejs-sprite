const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/**
 * Pure Node.js PNG encoder (IHDR, IDAT, IEND)
 */
function createPng(width, height, getPixelRgba) {
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c >>> 0;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const typeAndData = buf.subarray(4, 8 + len);
    buf.writeUInt32BE(crc32(typeAndData), 8 + len);
    return buf;
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth: 8
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter: standard
  ihdr[12] = 0; // interlace: none

  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixelRgba(x, y);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const idatData = zlib.deflateSync(rawData);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', idatData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Pure Node.js PNG decoder (RGBA)
 */
function decodePngRgba(buffer) {
  let pos = 8;
  let ihdr = null;
  const idatChunks = [];
  while (pos < buffer.length) {
    const len = buffer.readUInt32BE(pos);
    const type = buffer.toString('ascii', pos + 4, pos + 8);
    const data = buffer.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4)
      };
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    }
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const { width, height } = ihdr;
  const stride = width * 4;
  const rgba = Buffer.alloc(width * height * 4);

  function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }

  let rawOff = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rawOff++];
    const prevRowOff = (y - 1) * stride;
    const curRowOff = y * stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? rgba[curRowOff + x - 4] : 0;
      const up = y > 0 ? rgba[prevRowOff + x] : 0;
      const upLeft = (y > 0 && x >= 4) ? rgba[prevRowOff + x - 4] : 0;
      const val = raw[rawOff++];
      let res = 0;
      if (filter === 0) res = val;
      else if (filter === 1) res = (val + left) & 0xff;
      else if (filter === 2) res = (val + up) & 0xff;
      else if (filter === 3) res = (val + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) res = (val + paeth(left, up, upLeft)) & 0xff;
      rgba[curRowOff + x] = res;
    }
  }
  return { width, height, rgba };
}

// Load authentic NES source atlas
const dir = __dirname;
const alexPngPath = path.join(dir, 'alex.png');
const alexJsonPath = path.join(dir, 'alex.json');

if (!fs.existsSync(alexPngPath) || !fs.existsSync(alexJsonPath)) {
  console.error('Source assets alex.png or alex.json missing!');
  process.exit(1);
}

const alexImg = decodePngRgba(fs.readFileSync(alexPngPath));
const alexJson = JSON.parse(fs.readFileSync(alexJsonPath, 'utf8'));

/**
 * Reads a single pixel from the authentic NES atlas for a specific sprite
 */
function getSourcePixel(spriteName, sx, sy) {
  const f = alexJson.frames[spriteName].frame;
  if (sx < 0 || sx >= f.w || sy < 0 || sy >= Math.min(f.h, 32)) {
    return [0, 0, 0, 0];
  }
  const px = f.x + sx;
  const py = f.y + sy;
  const off = (py * alexImg.width + px) * 4;
  return [alexImg.rgba[off], alexImg.rgba[off + 1], alexImg.rgba[off + 2], alexImg.rgba[off + 3]];
}

// 10-frame action mapping (320x40, ground anchor [16, 39])
const EXPANDED_FRAME_MAP = [
  { id: 'idle-0',  sprite: 'sprite1',  xOff: 8, yOff: 8 },  // Neutral standing stance
  { id: 'idle-1',  sprite: 'sprite48', xOff: 8, yOff: 8 },  // Eye-blink / breathing stance
  { id: 'walk-0',  sprite: 'sprite2',  xOff: 8, yOff: 8 },  // Walk stride 1
  { id: 'walk-1',  sprite: 'sprite3',  xOff: 8, yOff: 8 },  // Walk stride 2
  { id: 'punch-0', sprite: 'sprite8',  xOff: 6, yOff: 8 },  // Punch windup
  { id: 'punch-1', sprite: 'sprite14', xOff: 5, yOff: 9 },  // Punch straight strike
  { id: 'kick-0',  sprite: 'sprite11', xOff: 4, yOff: 8 },  // Kick chamber
  { id: 'kick-1',  sprite: 'sprite4',  xOff: 4, yOff: 8 },  // Front thrust kick
  { id: 'hurt-0',  sprite: 'sprite16', xOff: 6, yOff: 10 }, // Hurt recoil
  { id: 'down-0',  sprite: 'sprite44', xOff: 0, yOff: 23 }  // Knockdown flat on back
];

// 4-frame core mapping (128x40, ground anchor [16, 39])
const BASIC_FRAME_MAP = [
  EXPANDED_FRAME_MAP[0], // idle-0 (sprite1)
  EXPANDED_FRAME_MAP[1], // idle-1 (sprite48)
  EXPANDED_FRAME_MAP[2], // walk-0 (sprite2)
  EXPANDED_FRAME_MAP[5]  // punch-0 (sprite14)
];

// NES Blue jacket uniform palette for Ryan / Rival brawler
const NES_BLUE = [0, 112, 236, 255]; // NES 2C02 color $12

function getExpandedPixel(x, y, isRyan = false) {
  const frameIdx = Math.floor(x / 32);
  const fx = x % 32;
  const fy = y;
  const def = EXPANDED_FRAME_MAP[frameIdx];
  const sx = fx - def.xOff;
  const sy = fy - def.yOff;
  const [r, g, b, a] = getSourcePixel(def.sprite, sx, sy);

  if (isRyan && a > 0) {
    // Body gakuran uniform swap: white jacket pixels in body (sy >= 9, eye sclera is sy 5..7) become blue gakuran
    if (r === 255 && g === 255 && b === 255 && sy >= 9) {
      return NES_BLUE;
    }
  }

  return [r, g, b, a];
}

function getBasicPixel(x, y) {
  const frameIdx = Math.floor(x / 32);
  const fx = x % 32;
  const fy = y;
  const def = BASIC_FRAME_MAP[frameIdx];
  const sx = fx - def.xOff;
  const sy = fy - def.yOff;
  return getSourcePixel(def.sprite, sx, sy);
}

// 1. Generate sample-character.png (128x40, 4 frames)
const basePng = createPng(128, 40, getBasicPixel);
const basePath = path.join(dir, 'sample-character.png');
fs.writeFileSync(basePath, basePng);
console.log(`[Authentic NES] Generated sample-character.png (128x40, ${basePng.length} bytes)`);

// 2. Generate sample-expanded-character.png (320x40, 10 frames)
const expPng = createPng(320, 40, (x, y) => getExpandedPixel(x, y, false));
const expPath = path.join(dir, 'sample-expanded-character.png');
fs.writeFileSync(expPath, expPng);
console.log(`[Authentic NES] Generated sample-expanded-character.png (320x40, ${expPng.length} bytes)`);

// 3. Generate sample-ryan-character.png (320x40, 10 frames - Ryan/Riki Rival)
const ryanPng = createPng(320, 40, (x, y) => getExpandedPixel(x, y, true));
const ryanPath = path.join(dir, 'sample-ryan-character.png');
fs.writeFileSync(ryanPath, ryanPng);
console.log(`[Authentic NES] Generated sample-ryan-character.png (320x40, ${ryanPng.length} bytes)`);

// 4. Pixel-Level Comparison Verification against source alex.png
function verifyParity(genPngBuffer, frameMap, name) {
  const genImg = decodePngRgba(genPngBuffer);
  let totalChecked = 0;
  let matches = 0;
  let mismatches = 0;

  frameMap.forEach((def, frameIdx) => {
    const f = alexJson.frames[def.sprite].frame;
    for (let sy = 0; sy < Math.min(f.h, 32); sy++) {
      for (let sx = 0; sx < f.w; sx++) {
        const srcPx = f.x + sx;
        const srcPy = f.y + sy;
        const srcOff = (srcPy * alexImg.width + srcPx) * 4;
        const srcA = alexImg.rgba[srcOff + 3];

        const genPx = frameIdx * 32 + def.xOff + sx;
        const genPy = def.yOff + sy;
        const genOff = (genPy * genImg.width + genPx) * 4;

        if (srcA > 0) {
          totalChecked++;
          const match = (
            alexImg.rgba[srcOff] === genImg.rgba[genOff] &&
            alexImg.rgba[srcOff + 1] === genImg.rgba[genOff + 1] &&
            alexImg.rgba[srcOff + 2] === genImg.rgba[genOff + 2] &&
            alexImg.rgba[srcOff + 3] === genImg.rgba[genOff + 3]
          );
          if (match) matches++;
          else mismatches++;
        }
      }
    }
  });

  const rate = (matches / totalChecked * 100).toFixed(4);
  console.log(`[Verification] ${name}: ${matches}/${totalChecked} non-transparent pixels matched (${rate}% parity, ${mismatches} mismatches)`);
  return { totalChecked, matches, mismatches, rate };
}

verifyParity(expPng, EXPANDED_FRAME_MAP, 'sample-expanded-character.png');
verifyParity(basePng, BASIC_FRAME_MAP, 'sample-character.png');

module.exports = {
  createPng,
  decodePngRgba,
  verifyParity
};
