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

test('Character Diversity: All 7 authentic characters exist with valid manifests and 100% head pixel parity', () => {
  const sampleDir = path.join(__dirname, '../sample');

  assert.equal(CHARACTER_ROSTER.length, 7, 'Expected 7 distinct authentic character definitions');

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

    // 3. Anchor stability
    Object.entries(manifest.frames).forEach(([frameId, frame]) => {
      assert.deepEqual(frame.anchor, [16, 39], `Frame ${frameId} in ${char.id} must adhere to ground anchor [16, 39]`);
    });

    // 4. Parity verification against authentic source
    const parity = verifyCharacterParity(char);
    assert.equal(parity.headMismatches, 0, `Character ${char.id} must have 0 head pixel mismatches against NES source`);
    assert.equal(parseFloat(parity.rate), 100.0, `Character ${char.id} must have 100% parity on authentic head`);

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
