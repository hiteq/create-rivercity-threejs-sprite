const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { validateManifest } = require('../validator.js');
const { SpritePlayer } = require('../runtime.js');
const {
  CHARACTER_ROSTER,
  EXPANDED_FRAME_MAP,
  decodePngRgba
} = require('../sample/generate-sample-sheet.js');

test('Combat Attack Parity & Regression: Authentic punch and kick poses across all characters', () => {
  const sampleDir = path.join(__dirname, '../sample');

  // Verify EXPANDED_FRAME_MAP uses authentic NES attack sprites
  const punch0Def = EXPANDED_FRAME_MAP.find(f => f.id === 'punch-0');
  const punch1Def = EXPANDED_FRAME_MAP.find(f => f.id === 'punch-1');
  const kick0Def = EXPANDED_FRAME_MAP.find(f => f.id === 'kick-0');
  const kick1Def = EXPANDED_FRAME_MAP.find(f => f.id === 'kick-1');

  assert.equal(punch0Def.sprite, 'sprite10', 'punch-0 must use authentic NES sprite10 windup');
  assert.equal(punch1Def.sprite, 'sprite15', 'punch-1 must use authentic NES sprite15 straight strike (not truncated sprite14)');
  assert.equal(kick0Def.sprite, 'sprite11', 'kick-0 must use authentic NES sprite11 chamber');
  assert.equal(kick1Def.sprite, 'sprite21', 'kick-1 must use authentic NES sprite21 thrust kick (not walk sprite4)');

  CHARACTER_ROSTER.forEach(char => {
    const pngPath = path.join(sampleDir, char.fileName);
    const manifestPath = path.join(sampleDir, char.manifestName);

    assert.equal(fs.existsSync(pngPath), true, `PNG file must exist for ${char.id}`);
    assert.equal(fs.existsSync(manifestPath), true, `Manifest file must exist for ${char.id}`);

    const img = decodePngRgba(fs.readFileSync(pngPath));
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // 1. Verify hitboxes
    const p1Hitbox = manifest.frames['punch-1'].hitboxes?.find(h => h.type === 'attack');
    assert.ok(p1Hitbox, `${char.id} punch-1 must have attack hitbox`);
    assert.ok(p1Hitbox.rect[0] >= 20, `${char.id} punch hitbox must extend forward`);

    const k1Hitbox = manifest.frames['kick-1'].hitboxes?.find(h => h.type === 'attack');
    assert.ok(k1Hitbox, `${char.id} kick-1 must have attack hitbox`);
    assert.ok(k1Hitbox.rect[0] >= 20, `${char.id} kick hitbox must extend forward`);

    // 2. Scan punch-1 frame (frameIdx 5) for intact standing legs (regression test against severed sprite14)
    let p1PantsPixels = 0;
    const p1StartX = 5 * 32;
    for (let y = 20; y < 40; y++) {
      for (let x = 0; x < 32; x++) {
        const off = (y * img.width + (p1StartX + x)) * 4;
        const a = img.rgba[off + 3];
        const r = img.rgba[off], g = img.rgba[off + 1], b = img.rgba[off + 2];
        // Check for pants color (blue or uniform colored)
        if (a > 0 && !(r === 255 && g === 255 && b === 255) && !(r === 5 && g === 5 && b === 5)) {
          p1PantsPixels++;
        }
      }
    }
    assert.ok(
      p1PantsPixels >= 50,
      `Regression check: ${char.id} punch-1 must have intact legs (found ${p1PantsPixels} pixels, expected >= 50; severed sprite14 had only 16)`
    );

    // 3. Scan kick-1 frame (frameIdx 7) for horizontally extended kicking foot reaching past x >= 26
    let k1ExtendedPixels = 0;
    const k1StartX = 7 * 32;
    for (let y = 15; y < 35; y++) {
      for (let x = 25; x < 32; x++) {
        const off = (y * img.width + (k1StartX + x)) * 4;
        if (img.rgba[off + 3] > 0) {
          k1ExtendedPixels++;
        }
      }
    }
    assert.ok(
      k1ExtendedPixels >= 15,
      `Regression check: ${char.id} kick-1 must have outstretched kicking leg reaching past x=25 (found ${k1ExtendedPixels} pixels; walking sprite4 had 0)`
    );

    // 4. Ground Anchor Stability: Standing sole touches ground at y=39
    let p1GroundPixels = 0;
    for (let x = 0; x < 32; x++) {
      const off = (39 * img.width + (p1StartX + x)) * 4;
      if (img.rgba[off + 3] > 0) p1GroundPixels++;
    }
    assert.ok(p1GroundPixels > 0, `${char.id} punch-1 ground sole must touch y=39`);

    let k1GroundPixels = 0;
    for (let x = 0; x < 32; x++) {
      const off = (39 * img.width + (k1StartX + x)) * 4;
      if (img.rgba[off + 3] > 0) k1GroundPixels++;
    }
    assert.ok(k1GroundPixels > 0, `${char.id} kick-1 standing foot sole must touch y=39`);

    // 5. Runtime SpritePlayer Animation Flow & Event Verification
    const player = new SpritePlayer(manifest, { autoPlay: false });
    const eventsFired = [];
    player.on('event', (ev) => eventsFired.push(ev.name));

    // Punch cycle
    player.play('punch');
    assert.equal(player.getCurrentFrame().frameId, 'punch-0');
    player.update(70); // step into strike frame
    assert.equal(player.getCurrentFrame().frameId, 'punch-1');
    assert.ok(eventsFired.includes('hit'), 'Punch must fire "hit" event');

    player.update(140); // recovery frame
    assert.equal(player.getCurrentFrame().frameId, 'punch-0');

    let punchFinished = false;
    player.on('finish', () => { punchFinished = true; });
    player.update(70); // finish one-shot
    assert.equal(punchFinished, true, 'Punch animation must finish');

    // Kick cycle
    eventsFired.length = 0;
    player.play('kick');
    assert.equal(player.getCurrentFrame().frameId, 'kick-0');
    player.update(85); // step into thrust frame
    assert.equal(player.getCurrentFrame().frameId, 'kick-1');
    assert.ok(eventsFired.includes('hit'), 'Kick must fire "hit" event');

    let kickFinished = false;
    player.on('finish', () => { kickFinished = true; });
    player.update(160 + 85);
    assert.equal(kickFinished, true, 'Kick animation must finish');
  });
});
