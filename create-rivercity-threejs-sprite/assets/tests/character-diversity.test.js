const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { validateManifest } = require('../validator.js');
const { SpritePlayer } = require('../runtime.js');
const { CanvasSpriteRenderer } = require('../canvas-player.js');
const {
  CHARACTER_ROSTER,
  decodePngRgba,
  verifyCharacterParity
} = require('../sample/generate-sample-sheet.js');

test('Character Diversity: All 7 authentic characters exist with distinct art, honest provenance, and verified head parity', () => {
  const sampleDir = path.join(__dirname, '../sample');

  assert.equal(CHARACTER_ROSTER.length, 7, 'Expected 7 distinct character definitions in roster');

  const alexDef = CHARACTER_ROSTER.find(c => c.id === 'alex');
  const ryanDef = CHARACTER_ROSTER.find(c => c.id === 'ryan');
  const ryuichiDef = CHARACTER_ROSTER.find(c => c.id === 'ryuichi');

  // Verify Ryan has distinct art and does NOT reuse Kunio/Alex head
  assert.ok(alexDef && ryanDef && ryuichiDef);
  assert.notEqual(ryanDef.headSprite, alexDef.headSprite, 'Ryan must NOT use same head as Kunio/Alex (sprite1)');
  assert.equal(ryanDef.headSprite, 'sprite50', 'Ryan must use authentic rival pompadour sprite50');
  assert.notEqual(ryanDef.headSprite, ryuichiDef.headSprite, 'Ryan and Ryuichi must have distinct head specifications');

  // Verify pixel-level head distinction between Alex and Ryan
  const alexImg = decodePngRgba(fs.readFileSync(path.join(sampleDir, alexDef.fileName)));
  const ryanImg = decodePngRgba(fs.readFileSync(path.join(sampleDir, ryanDef.fileName)));
  let headDiffCount = 0;
  for (let y = 8; y < 20; y++) {
    for (let x = 8; x < 25; x++) {
      const off = (y * 320 + x) * 4;
      if (
        alexImg.rgba[off] !== ryanImg.rgba[off] ||
        alexImg.rgba[off + 1] !== ryanImg.rgba[off + 1] ||
        alexImg.rgba[off + 2] !== ryanImg.rgba[off + 2]
      ) {
        headDiffCount++;
      }
    }
  }
  assert.ok(headDiffCount >= 25, `Ryan must have visibly distinct head art from Alex (found ${headDiffCount} differing head pixels)`);

  CHARACTER_ROSTER.forEach(char => {
    const pngPath = path.join(sampleDir, char.fileName);
    const manifestPath = path.join(sampleDir, char.manifestName);

    // 1. Files exist
    assert.equal(fs.existsSync(pngPath), true, `PNG file must exist for ${char.id}: ${char.fileName}`);
    assert.equal(fs.existsSync(manifestPath), true, `Manifest file must exist for ${char.id}: ${char.manifestName}`);

    // 2. Manifest validation
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const valResult = validateManifest(manifest, {
      imageDimensions: { width: 320, height: 40 }
    });
    assert.equal(valResult.valid, true, `Manifest must be valid for ${char.id}: ${valResult.errors.join(', ')}`);
    assert.equal(valResult.errors.length, 0);

    // 2b. Provenance categorization check
    assert.ok(manifest.meta?.provenanceTier, `${char.id} must specify honest provenance tier`);
    assert.ok(manifest.meta?.provenanceDetails?.frameClassifications, `${char.id} must detail frame classifications`);
    assert.ok(manifest.frames['idle-0'].provenance, `${char.id} idle-0 must have provenance metadata`);
    assert.ok(manifest.frames['hurt-0'].provenance, `${char.id} hurt-0 must have provenance metadata`);

    // 3. Anchor stability
    Object.entries(manifest.frames).forEach(([frameId, frame]) => {
      assert.deepEqual(frame.anchor, [16, 39], `Frame ${frameId} in ${char.id} must adhere to ground anchor [16, 39]`);
    });

    // 4. Parity verification against authentic source
    const parity = verifyCharacterParity(char);
    assert.equal(parity.headMismatches, 0, `Character ${char.id} must have 0 head pixel mismatches against specification`);
    assert.equal(parseFloat(parity.rate), 100.0, `Character ${char.id} must have 100% parity on head specification`);

    // 5. Runtime SpritePlayer instantiation & animation verification
    const player = new SpritePlayer(manifest, {
      initialAnimation: 'idle',
      facing: 'right'
    });
    assert.equal(player.currentAnimationName, 'idle');
    assert.equal(player.getCurrentFrame().frameId, 'idle-0');

    // Step through animations
    player.play('walk');
    assert.equal(player.currentAnimationName, 'walk');
    player.update(150);
    assert.equal(player.getCurrentFrame().frameId, 'idle-0');

    player.play('punch');
    assert.equal(player.currentAnimationName, 'punch');
    player.update(70);
    assert.equal(player.getCurrentFrame().frameId, 'punch-1');

    player.play('kick');
    assert.equal(player.currentAnimationName, 'kick');
    player.update(85);
    assert.equal(player.getCurrentFrame().frameId, 'kick-1');

    player.play('hurt');
    assert.equal(player.currentAnimationName, 'hurt');
    assert.equal(player.getCurrentFrame().frameId, 'hurt-0');

    player.play('down');
    assert.equal(player.currentAnimationName, 'down');
    assert.equal(player.getCurrentFrame().frameId, 'down-0');
  });
});
