const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { validateManifest, assertValidManifest } = require('../validator');

test('Validator: valid sample manifest', () => {
  const samplePath = path.join(__dirname, '../sample/sample-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(samplePath, 'utf8'));

  const result = validateManifest(manifest, {
    imageDimensions: { width: 128, height: 40 }
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.doesNotThrow(() => assertValidManifest(manifest));
});

test('Validator: valid expanded sample manifest', () => {
  const expandedPath = path.join(__dirname, '../sample/sample-expanded-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(expandedPath, 'utf8'));

  const result = validateManifest(manifest, {
    imageDimensions: { width: 320, height: 40 }
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.doesNotThrow(() => assertValidManifest(manifest));
});

test('Validator: rejects non-object or null input', () => {
  assert.equal(validateManifest(null).valid, false);
  assert.equal(validateManifest("string").valid, false);
  assert.equal(validateManifest([]).valid, false);
});

test('Validator: version checks', () => {
  const base = {
    image: 'test.png',
    frames: { 'f1': { rect: [0, 0, 16, 16], anchor: [8, 15] } },
    animations: { 'idle': { frames: [{ frame: 'f1', durationMs: 100 }] } }
  };

  // Missing version
  assert.equal(validateManifest(base).valid, false);

  // Non-integer or negative version
  assert.equal(validateManifest({ ...base, version: 0 }).valid, false);
  assert.equal(validateManifest({ ...base, version: 1.5 }).valid, false);
  assert.equal(validateManifest({ ...base, version: '1' }).valid, false);

  // Valid version
  assert.equal(validateManifest({ ...base, version: 1 }).valid, true);
});

test('Validator: image path checks', () => {
  const base = {
    version: 1,
    frames: { 'f1': { rect: [0, 0, 16, 16], anchor: [8, 15] } },
    animations: { 'idle': { frames: [{ frame: 'f1', durationMs: 100 }] } }
  };

  assert.equal(validateManifest({ ...base, image: '' }).valid, false);
  assert.equal(validateManifest({ ...base, image: null }).valid, false);
  assert.equal(validateManifest({ ...base, image: 'sprites.png' }).valid, true);
});

test('Validator: frame rect bounds and validations', () => {
  const validBase = {
    version: 1,
    image: 'sprites.png',
    animations: { 'idle': { frames: [{ frame: 'f1', durationMs: 100 }] } }
  };

  // Invalid rect shape
  let res = validateManifest({
    ...validBase,
    frames: { 'f1': { rect: [0, 0, 16], anchor: [8, 15] } }
  });
  assert.equal(res.valid, false);
  assert.match(res.errors[0], /4-element array/);

  // Negative rect coordinate
  res = validateManifest({
    ...validBase,
    frames: { 'f1': { rect: [-1, 0, 16, 16], anchor: [8, 15] } }
  });
  assert.equal(res.valid, false);

  // Zero width or height
  res = validateManifest({
    ...validBase,
    frames: { 'f1': { rect: [0, 0, 0, 16], anchor: [8, 15] } }
  });
  assert.equal(res.valid, false);

  // Out of bounds check with imageDimensions
  res = validateManifest({
    ...validBase,
    frames: { 'f1': { rect: [20, 0, 50, 16], anchor: [8, 15] } }
  }, { imageDimensions: { width: 64, height: 64 } });
  assert.equal(res.valid, false);
  assert.match(res.errors[0], /extends beyond image width/);
});

test('Validator: anchor validation', () => {
  const validBase = {
    version: 1,
    image: 'sprites.png',
    animations: { 'idle': { frames: [{ frame: 'f1', durationMs: 100 }] } }
  };

  let res = validateManifest({
    ...validBase,
    frames: { 'f1': { rect: [0, 0, 16, 16], anchor: [8] } }
  });
  assert.equal(res.valid, false);

  res = validateManifest({
    ...validBase,
    frames: { 'f1': { rect: [0, 0, 16, 16], anchor: ['center', 'bottom'] } }
  });
  assert.equal(res.valid, false);
});

test('Validator: animation references and durations', () => {
  const base = {
    version: 1,
    image: 'sprites.png',
    frames: { 'f1': { rect: [0, 0, 16, 16], anchor: [8, 15] } }
  };

  // Reference non-existent frame
  let res = validateManifest({
    ...base,
    animations: { 'idle': { frames: [{ frame: 'non_existent_frame', durationMs: 100 }] } }
  });
  assert.equal(res.valid, false);
  assert.match(res.errors[0], /references non-existent frame/);

  // Non-positive duration
  res = validateManifest({
    ...base,
    animations: { 'idle': { frames: [{ frame: 'f1', durationMs: 0 }] } }
  });
  assert.equal(res.valid, false);

  res = validateManifest({
    ...base,
    animations: { 'idle': { frames: [{ frame: 'f1', durationMs: -50 }] } }
  });
  assert.equal(res.valid, false);

  // Empty frames array in animation
  res = validateManifest({
    ...base,
    animations: { 'idle': { frames: [] } }
  });
  assert.equal(res.valid, false);

  // Single event string
  res = validateManifest({
    ...base,
    animations: { 'punch': { frames: [{ frame: 'f1', durationMs: 100, event: 'hit_active' }] } }
  });
  assert.equal(res.valid, true);
});

test('Validator: warnings for unused frames and missing provenance', () => {
  const manifest = {
    version: 1,
    image: 'sprites.png',
    frames: {
      'f1': { rect: [0, 0, 16, 16], anchor: [8, 15] },
      'unused-frame': { rect: [16, 0, 16, 16], anchor: [8, 15] }
    },
    animations: {
      'idle': { frames: [{ frame: 'f1', durationMs: 100 }] }
    }
  };

  const res = validateManifest(manifest);
  assert.equal(res.valid, true);
  assert.ok(res.warnings.some(w => w.includes('unused-frame')));
  assert.ok(res.warnings.some(w => w.includes('provenance')));
});

test('Validator: assertValidManifest throws descriptive error', () => {
  const invalid = { version: 1 };
  assert.throws(
    () => assertValidManifest(invalid),
    (err) => err.message.includes('Invalid sprite manifest') && Array.isArray(err.errors)
  );
});
