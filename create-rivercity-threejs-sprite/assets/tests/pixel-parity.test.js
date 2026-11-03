const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

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

test('Pixel Parity: 100% objective pixel comparison against authentic River City Ransom NES source', () => {
  const sampleDir = path.join(__dirname, '../sample');
  const sourcePath = path.join(sampleDir, 'alex.png');
  const sourceJsonPath = path.join(sampleDir, 'alex.json');
  const expPath = path.join(sampleDir, 'sample-expanded-character.png');
  const basePath = path.join(sampleDir, 'sample-character.png');

  assert.equal(fs.existsSync(sourcePath), true, 'Source alex.png exists');
  assert.equal(fs.existsSync(sourceJsonPath), true, 'Source alex.json exists');
  assert.equal(fs.existsSync(expPath), true, 'Generated sample-expanded-character.png exists');
  assert.equal(fs.existsSync(basePath), true, 'Generated sample-character.png exists');

  const sourceImg = decodePngRgba(fs.readFileSync(sourcePath));
  const sourceJson = JSON.parse(fs.readFileSync(sourceJsonPath, 'utf8'));
  const expImg = decodePngRgba(fs.readFileSync(expPath));
  const baseImg = decodePngRgba(fs.readFileSync(basePath));

  // Expanded 10 frames check (authentic NES River City Ransom suite)
  const expFrames = [
    { sprite: 'sprite1',  xOff: 8, yOff: 8 },  // idle-0
    { sprite: 'sprite48', xOff: 8, yOff: 8 },  // idle-1
    { sprite: 'sprite2',  xOff: 8, yOff: 8 },  // walk-0
    { sprite: 'sprite3',  xOff: 8, yOff: 8 },  // walk-1
    { sprite: 'sprite10', xOff: 7, yOff: 8 },  // punch-0 (authentic NES punch windup)
    { sprite: 'sprite15', xOff: 7, yOff: 8 },  // punch-1 (authentic NES straight strike)
    { sprite: 'sprite11', xOff: 2, yOff: 8 },  // kick-0 (authentic NES kick chamber)
    { sprite: 'sprite21', xOff: 1, yOff: 10 }, // kick-1 (authentic NES front thrust kick)
    { sprite: 'sprite16', xOff: 6, yOff: 10 }, // hurt-0
    { sprite: 'sprite44', xOff: 0, yOff: 23 }  // down-0
  ];

  let expTotalChecked = 0;
  let expMatches = 0;
  let expMismatches = 0;

  expFrames.forEach((def, frameIdx) => {
    const f = sourceJson.frames[def.sprite].frame;
    for (let sy = 0; sy < Math.min(f.h, 32); sy++) {
      for (let sx = 0; sx < f.w; sx++) {
        const srcPx = f.x + sx;
        const srcPy = f.y + sy;
        const srcOff = (srcPy * sourceImg.width + srcPx) * 4;
        const srcA = sourceImg.rgba[srcOff + 3];

        const genPx = frameIdx * 32 + def.xOff + sx;
        const genPy = def.yOff + sy;
        const genOff = (genPy * expImg.width + genPx) * 4;

        if (srcA > 0) {
          expTotalChecked++;
          const match = (
            sourceImg.rgba[srcOff] === expImg.rgba[genOff] &&
            sourceImg.rgba[srcOff + 1] === expImg.rgba[genOff + 1] &&
            sourceImg.rgba[srcOff + 2] === expImg.rgba[genOff + 2] &&
            sourceImg.rgba[srcOff + 3] === expImg.rgba[genOff + 3]
          );
          if (match) expMatches++;
          else expMismatches++;
        }
      }
    }
  });

  assert.equal(expMismatches, 0, `Expected 0 mismatches in sample-expanded-character.png, got ${expMismatches}`);
  assert.equal(expMatches, expTotalChecked);
  assert.equal(expMatches, 4740, `Expected 4740 verified non-transparent pixels, got ${expMatches}`);

  // Base 4 frames check
  const baseFrames = [
    expFrames[0],
    expFrames[1],
    expFrames[2],
    expFrames[5]
  ];

  let baseTotalChecked = 0;
  let baseMatches = 0;
  let baseMismatches = 0;

  baseFrames.forEach((def, frameIdx) => {
    const f = sourceJson.frames[def.sprite].frame;
    for (let sy = 0; sy < Math.min(f.h, 32); sy++) {
      for (let sx = 0; sx < f.w; sx++) {
        const srcPx = f.x + sx;
        const srcPy = f.y + sy;
        const srcOff = (srcPy * sourceImg.width + srcPx) * 4;
        const srcA = sourceImg.rgba[srcOff + 3];

        const genPx = frameIdx * 32 + def.xOff + sx;
        const genPy = def.yOff + sy;
        const genOff = (genPy * baseImg.width + genPx) * 4;

        if (srcA > 0) {
          baseTotalChecked++;
          const match = (
            sourceImg.rgba[srcOff] === baseImg.rgba[genOff] &&
            sourceImg.rgba[srcOff + 1] === baseImg.rgba[genOff + 1] &&
            sourceImg.rgba[srcOff + 2] === baseImg.rgba[genOff + 2] &&
            sourceImg.rgba[srcOff + 3] === baseImg.rgba[genOff + 3]
          );
          if (match) baseMatches++;
          else baseMismatches++;
        }
      }
    }
  });

  assert.equal(baseMismatches, 0, `Expected 0 mismatches in sample-character.png, got ${baseMismatches}`);
  assert.equal(baseMatches, baseTotalChecked);
  assert.equal(baseMatches, 1867, `Expected 1867 verified non-transparent pixels, got ${baseMatches}`);
});
