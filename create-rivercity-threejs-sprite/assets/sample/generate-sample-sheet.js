const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

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

// Retro beat-em-up palette (Kunio / River City aesthetic)
const C_TRANSPARENT = [0, 0, 0, 0];
const C_OUTLINE = [24, 20, 36, 255];       // Dark navy outline
const C_HAIR = [44, 40, 60, 255];          // Dark hair
const C_SKIN = [252, 196, 132, 255];       // Warm skin
const C_SKIN_SHADOW = [220, 140, 92, 255]; // Shadowed skin
const C_SHIRT = [240, 240, 248, 255];      // White gakuran / shirt
const C_SHIRT_SHADOW = [170, 180, 200, 255];
const C_PANTS = [36, 52, 92, 255];         // Blue pants
const C_PANTS_SHADOW = [20, 32, 60, 255];
const C_SHOES = [120, 50, 30, 255];        // Brown school shoes
const C_WHITE = [255, 255, 255, 255];      // Eye white / shock teeth
const C_ACCENT = [255, 210, 70, 255];      // Attack highlight / hit flash

/**
 * Basic 4-frame sprite renderer (preserved for sample-character.png backward compatibility)
 */
function getBasicSpritePixel(frameIdx, fx, fy) {
  const yOffset = (frameIdx === 1) ? 1 : 0; // idle-1 bobs down 1 pixel

  // Head: y: 4..18
  const headY = fy - yOffset;
  if (headY >= 4 && headY <= 17 && fx >= 10 && fx <= 22) {
    if (headY <= 7) return C_HAIR;
    if ((headY <= 10 && (fx <= 12 || fx >= 20)) || (fx === 10 || fx === 22)) return C_HAIR;
    if (headY === 11 && (fx === 15 || fx === 19)) return C_OUTLINE;
    if (headY === 14 && fx >= 16 && fx <= 18) return C_SKIN_SHADOW;
    return (headY >= 13 && fx <= 12) ? C_SKIN_SHADOW : C_SKIN;
  }

  // Torso: y: 18..28
  const torsoY = fy - yOffset;
  if (torsoY >= 18 && torsoY <= 27 && fx >= 9 && fx <= 23) {
    if (torsoY === 18) return C_OUTLINE;
    if (fx === 9 || fx === 23) return C_OUTLINE;
    if (torsoY >= 21 && torsoY <= 25 && fx >= 15 && fx <= 17) return C_SHIRT;
    if (fx >= 10 && fx <= 14) return C_SHIRT_SHADOW;
    return C_SHIRT;
  }

  // Arms and Hands:
  if (frameIdx === 3) {
    // Punch frame: right fist extends forward to fx: 24..30, fy: 19..23
    if (fy >= 19 && fy <= 23 && fx >= 24 && fx <= 29) {
      if (fx === 29 || fy === 19 || fy === 23) return C_OUTLINE;
      return C_SKIN;
    }
  } else {
    if (torsoY >= 22 && torsoY <= 25) {
      if ((fx >= 7 && fx <= 8) || (fx >= 24 && fx <= 25)) return C_SKIN;
    }
  }

  // Belt:
  if (torsoY === 28 && fx >= 10 && fx <= 22) {
    return C_OUTLINE;
  }

  // Legs / Pants:
  if (frameIdx === 2) {
    // Walk frame: legs parted
    if (fy >= 29 && fy <= 35) {
      if ((fx >= 9 && fx <= 13) || (fx >= 18 && fx <= 22)) {
        if (fx === 9 || fx === 13 || fx === 18 || fx === 22) return C_PANTS_SHADOW;
        return C_PANTS;
      }
    }
    if (fy >= 36 && fy <= 39) {
      if ((fx >= 8 && fx <= 14) || (fx >= 17 && fx <= 23)) {
        if (fy === 39) return C_OUTLINE;
        return C_SHOES;
      }
    }
  } else {
    // Standing legs:
    if (fy >= 29 && fy <= 35 && fx >= 11 && fx <= 21) {
      if (fx === 16) return C_OUTLINE;
      if (fx === 11 || fx === 21) return C_PANTS_SHADOW;
      return C_PANTS;
    }
    if (fy >= 36 && fy <= 39 && fx >= 10 && fx <= 22) {
      if (fx === 16 || fy === 39) return C_OUTLINE;
      return C_SHOES;
    }
  }

  return C_TRANSPARENT;
}

/**
 * Expanded 10-frame action suite renderer:
 * Frame 0: idle-0 (stance)
 * Frame 1: idle-1 (breathing dip)
 * Frame 2: walk-0 (left stride)
 * Frame 3: walk-1 (right stride)
 * Frame 4: punch-0 (windup)
 * Frame 5: punch-1 (strike impact with hit hitbox)
 * Frame 6: kick-0 (chamber knee)
 * Frame 7: kick-1 (front kick with hit hitbox)
 * Frame 8: hurt-0 (shock O_O face & stagger)
 * Frame 9: down-0 (knocked down flat on back)
 */
function getExpandedSpritePixel(frameIdx, fx, fy) {
  // Ground anchor is fixed at (16, 39)
  switch (frameIdx) {
    case 0: // idle-0
      return getBasicSpritePixel(0, fx, fy);

    case 1: // idle-1 (bob)
      return getBasicSpritePixel(1, fx, fy);

    case 2: // walk-0 (left stride)
      return getBasicSpritePixel(2, fx, fy);

    case 3: { // walk-1 (right stride, reversed arm/leg stride)
      // Head
      if (fy >= 4 && fy <= 17 && fx >= 10 && fx <= 22) {
        if (fy <= 7) return C_HAIR;
        if ((fy <= 10 && (fx <= 12 || fx >= 20)) || (fx === 10 || fx === 22)) return C_HAIR;
        if (fy === 11 && (fx === 15 || fx === 19)) return C_OUTLINE;
        if (fy === 14 && fx >= 16 && fx <= 18) return C_SKIN_SHADOW;
        return (fy >= 13 && fx <= 12) ? C_SKIN_SHADOW : C_SKIN;
      }
      // Torso
      if (fy >= 18 && fy <= 27 && fx >= 9 && fx <= 23) {
        if (fy === 18 || fx === 9 || fx === 23) return C_OUTLINE;
        if (fy >= 21 && fy <= 25 && fx >= 15 && fx <= 17) return C_SHIRT;
        if (fx >= 10 && fx <= 14) return C_SHIRT_SHADOW;
        return C_SHIRT;
      }
      // Hands (swung opposite)
      if (fy >= 21 && fy <= 24 && ((fx >= 6 && fx <= 8) || (fx >= 24 && fx <= 26))) {
        return C_SKIN;
      }
      // Belt
      if (fy === 28 && fx >= 10 && fx <= 22) return C_OUTLINE;
      // Stride legs: right foot forward (fx 19..25, fy 36..39), left foot back (fx 7..13, fy 36..39)
      if (fy >= 29 && fy <= 35) {
        if ((fx >= 8 && fx <= 12) || (fx >= 19 && fx <= 23)) {
          if (fx === 8 || fx === 12 || fx === 19 || fx === 23) return C_PANTS_SHADOW;
          return C_PANTS;
        }
      }
      if (fy >= 36 && fy <= 39) {
        if ((fx >= 7 && fx <= 13) || (fx >= 18 && fx <= 24)) {
          if (fy === 39) return C_OUTLINE;
          return C_SHOES;
        }
      }
      return C_TRANSPARENT;
    }

    case 4: { // punch-0 (windup)
      const hx = fx - 1;
      if (fy >= 4 && fy <= 17 && hx >= 10 && hx <= 22) {
        if (fy <= 7) return C_HAIR;
        if ((fy <= 10 && (hx <= 12 || hx >= 20)) || (hx === 10 || hx === 22)) return C_HAIR;
        if (fy === 11 && (hx === 15 || hx === 19)) return C_OUTLINE;
        if (fy === 14 && hx >= 16 && hx <= 18) return C_SKIN_SHADOW;
        return C_SKIN;
      }
      if (fy >= 18 && fy <= 27 && hx >= 9 && hx <= 23) {
        if (fy === 18 || hx === 9 || hx === 23) return C_OUTLINE;
        if (fy >= 22 && fy <= 25 && fx >= 10 && fx <= 13) return C_SKIN;
        return C_SHIRT;
      }
      if (fy === 28 && fx >= 10 && fx <= 22) return C_OUTLINE;
      if (fy >= 29 && fy <= 35 && fx >= 11 && fx <= 21) {
        if (fx === 16) return C_OUTLINE;
        return C_PANTS;
      }
      if (fy >= 36 && fy <= 39 && fx >= 10 && fx <= 22) {
        if (fy === 39) return C_OUTLINE;
        return C_SHOES;
      }
      return C_TRANSPARENT;
    }

    case 5: // punch-1 (strike impact)
      return getBasicSpritePixel(3, fx, fy);

    case 6: { // kick-0 (chamber knee)
      if (fy >= 4 && fy <= 17 && fx >= 10 && fx <= 22) {
        if (fy <= 7) return C_HAIR;
        if ((fy <= 10 && (fx <= 12 || fx >= 20)) || (fx === 10 || fx === 22)) return C_HAIR;
        if (fy === 11 && (fx === 15 || fx === 19)) return C_OUTLINE;
        return C_SKIN;
      }
      if (fy >= 18 && fy <= 27 && fx >= 9 && fx <= 23) {
        if (fy === 18 || fx === 9 || fx === 23) return C_OUTLINE;
        if (fy >= 20 && fy <= 23 && (fx === 13 || fx === 19)) return C_SKIN;
        return C_SHIRT;
      }
      if (fy === 28 && fx >= 10 && fx <= 22) return C_OUTLINE;
      if (fy >= 29 && fy <= 35 && fx >= 11 && fx <= 16) return C_PANTS;
      if (fy >= 36 && fy <= 39 && fx >= 10 && fx <= 17) {
        if (fy === 39) return C_OUTLINE;
        return C_SHOES;
      }
      if (fy >= 25 && fy <= 29 && fx >= 19 && fx <= 24) {
        if (fy === 25 || fx === 24) return C_PANTS_SHADOW;
        return C_PANTS;
      }
      return C_TRANSPARENT;
    }

    case 7: { // kick-1 (extended front kick)
      if (fy >= 5 && fy <= 17 && fx >= 9 && fx <= 21) {
        if (fy <= 8) return C_HAIR;
        if (fy === 11 && (fx === 13 || fx === 17)) return C_OUTLINE;
        if (fy === 14 && fx >= 15 && fx <= 17) return C_OUTLINE;
        return C_SKIN;
      }
      if (fy >= 18 && fy <= 27 && fx >= 8 && fx <= 21) {
        if (fy === 18 || fx === 8 || fx === 21) return C_OUTLINE;
        return C_SHIRT;
      }
      if (fy === 28 && fx >= 9 && fx <= 20) return C_OUTLINE;
      if (fy >= 29 && fy <= 35 && fx >= 9 && fx <= 15) return C_PANTS;
      if (fy >= 36 && fy <= 39 && fx >= 8 && fx <= 16) {
        if (fy === 39) return C_OUTLINE;
        return C_SHOES;
      }
      if (fy >= 24 && fy <= 28 && fx >= 16 && fx <= 25) {
        if (fy === 24 || fy === 28) return C_PANTS_SHADOW;
        return C_PANTS;
      }
      if (fy >= 23 && fy <= 28 && fx >= 25 && fx <= 30) {
        if (fx === 30 || fy === 28) return C_OUTLINE;
        return C_SHOES;
      }
      return C_TRANSPARENT;
    }

    case 8: { // hurt-0 (iconic O_O hit shock face & stagger)
      if (fy >= 4 && fy <= 17 && fx >= 7 && fx <= 20) {
        if (fy <= 7) return C_HAIR;
        if ((fy >= 9 && fy <= 12) && ((fx >= 10 && fx <= 13) || (fx >= 16 && fx <= 19))) {
          if (fy === 11 && (fx === 11 || fx === 18)) return C_OUTLINE;
          return C_WHITE;
        }
        if (fy >= 14 && fy <= 16 && fx >= 13 && fx <= 16) {
          return C_OUTLINE;
        }
        return C_SKIN;
      }
      if (fy >= 18 && fy <= 27 && fx >= 6 && fx <= 20) {
        if (fy === 18 || fx === 6 || fx === 20) return C_OUTLINE;
        if (fy >= 20 && fy <= 23 && (fx === 5 || fx === 22)) return C_SKIN;
        return C_SHIRT;
      }
      if (fy === 28 && fx >= 7 && fx <= 19) return C_OUTLINE;
      if (fy >= 29 && fy <= 35 && fx >= 8 && fx <= 20) {
        if (fx === 14) return C_OUTLINE;
        return C_PANTS;
      }
      if (fy >= 36 && fy <= 39 && fx >= 7 && fx <= 21) {
        if (fy === 39) return C_OUTLINE;
        return C_SHOES;
      }
      return C_TRANSPARENT;
    }

    case 9: { // down-0 (horizontal flat on back / knocked out)
      if (fy >= 28 && fy <= 37 && fx >= 3 && fx <= 13) {
        if (fx <= 6) return C_HAIR;
        if ((fy === 30 && (fx === 8 || fx === 10)) || (fy === 32 && (fx === 8 || fx === 10)) || (fy === 31 && fx === 9)) return C_OUTLINE;
        if (fy === 34 && fx >= 8 && fx <= 10) return C_SKIN_SHADOW;
        return C_SKIN;
      }
      if (fy >= 30 && fy <= 37 && fx >= 14 && fx <= 22) {
        if (fy === 30 || fy === 37) return C_OUTLINE;
        return C_SHIRT;
      }
      if (fy >= 32 && fy <= 38 && fx >= 23 && fx <= 28) {
        return C_PANTS;
      }
      if (fy >= 34 && fy <= 39 && fx >= 29 && fx <= 31) {
        if (fy === 39) return C_OUTLINE;
        return C_SHOES;
      }
      return C_TRANSPARENT;
    }

    default:
      return C_TRANSPARENT;
  }
}

function main() {
  const dir = __dirname;

  // 1. Generate standard 128x40 sample-character.png (4 frames)
  const basePng = createPng(128, 40, (x, y) => {
    const frameIdx = Math.floor(x / 32);
    const fx = x % 32;
    const fy = y;
    return getBasicSpritePixel(frameIdx, fx, fy);
  });
  const basePath = path.join(dir, 'sample-character.png');
  fs.writeFileSync(basePath, basePng);
  console.log(`Generated standard sample-character.png (128x40, ${basePng.length} bytes)`);

  // 2. Generate expanded 320x40 sample-expanded-character.png (10 frames)
  const expPng = createPng(320, 40, (x, y) => {
    const frameIdx = Math.floor(x / 32);
    const fx = x % 32;
    const fy = y;
    return getExpandedSpritePixel(frameIdx, fx, fy);
  });
  const expPath = path.join(dir, 'sample-expanded-character.png');
  fs.writeFileSync(expPath, expPng);
  console.log(`Generated expanded sample-expanded-character.png (320x40, ${expPng.length} bytes)`);
}

if (require.main === module) {
  main();
}

module.exports = {
  createPng,
  getBasicSpritePixel,
  getExpandedSpritePixel
};
