const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { SpritePlayer } = require('../runtime');
const { CanvasSpriteRenderer } = require('../canvas-player');

function createMockContext() {
  const calls = [];
  return {
    calls,
    imageSmoothingEnabled: true,
    save() { calls.push({ method: 'save' }); },
    restore() { calls.push({ method: 'restore' }); },
    translate(x, y) { calls.push({ method: 'translate', x, y }); },
    scale(x, y) { calls.push({ method: 'scale', x, y }); },
    drawImage(...args) { calls.push({ method: 'drawImage', args }); },
    strokeRect(...args) { calls.push({ method: 'strokeRect', args }); },
    fillRect(...args) { calls.push({ method: 'fillRect', args }); },
    beginPath() { calls.push({ method: 'beginPath' }); },
    moveTo(x, y) { calls.push({ method: 'moveTo', x, y }); },
    lineTo(x, y) { calls.push({ method: 'lineTo', x, y }); },
    stroke() { calls.push({ method: 'stroke' }); },
    arc(...args) { calls.push({ method: 'arc', args }); },
    fill() { calls.push({ method: 'fill' }); }
  };
}

function loadSampleManifest() {
  const samplePath = path.join(__dirname, '../sample/sample-manifest.json');
  return JSON.parse(fs.readFileSync(samplePath, 'utf8'));
}

test('CanvasSpriteRenderer: nearest-neighbor smoothing disabled', () => {
  const ctx = createMockContext();
  const manifest = loadSampleManifest();
  const player = new SpritePlayer(manifest);
  const renderer = new CanvasSpriteRenderer({ image: { width: 128, height: 40 } });

  renderer.render(ctx, player, 100, 200);
  assert.equal(ctx.imageSmoothingEnabled, false);
});

test('CanvasSpriteRenderer: right-facing draw coordinates and anchor offset', () => {
  const ctx = createMockContext();
  const manifest = loadSampleManifest();
  const player = new SpritePlayer(manifest);
  // idle-0: rect: [0, 0, 32, 40], anchor: [16, 39]
  const fakeImage = { width: 128, height: 40 };
  const renderer = new CanvasSpriteRenderer({ image: fakeImage, scale: 2 });

  renderer.render(ctx, player, 150, 250);

  // Checks translation to world anchor
  const translateCall = ctx.calls.find(c => c.method === 'translate');
  assert.ok(translateCall);
  assert.equal(translateCall.x, 150);
  assert.equal(translateCall.y, 250);

  // Facing right: no scale(-1, 1) call
  const scaleCall = ctx.calls.find(c => c.method === 'scale');
  assert.equal(scaleCall, undefined);

  // drawImage args: [img, sx, sy, sw, sh, dx, dy, dw, dh]
  const drawCall = ctx.calls.find(c => c.method === 'drawImage');
  assert.ok(drawCall);
  const [img, sx, sy, sw, sh, dx, dy, dw, dh] = drawCall.args;
  assert.equal(img, fakeImage);
  assert.equal(sx, 0);
  assert.equal(sy, 0);
  assert.equal(sw, 32);
  assert.equal(sh, 40);
  // With scale=2 and anchor=[16, 39]:
  // dx = -16 * 2 = -32, dy = -39 * 2 = -78
  // dw = 32 * 2 = 64, dh = 40 * 2 = 80
  assert.equal(dx, -32);
  assert.equal(dy, -78);
  assert.equal(dw, 64);
  assert.equal(dh, 80);
});

test('CanvasSpriteRenderer: left-facing horizontal mirror around anchor', () => {
  const ctx = createMockContext();
  const manifest = loadSampleManifest();
  const player = new SpritePlayer(manifest);
  player.setFacing('left');
  const fakeImage = { width: 128, height: 40 };
  const renderer = new CanvasSpriteRenderer({ image: fakeImage, scale: 1 });

  renderer.render(ctx, player, 100, 100);

  const scaleCall = ctx.calls.find(c => c.method === 'scale');
  assert.ok(scaleCall);
  assert.equal(scaleCall.x, -1);
  assert.equal(scaleCall.y, 1);

  const drawCall = ctx.calls.find(c => c.method === 'drawImage');
  assert.ok(drawCall);
  // Anchor remains aligned at -16, -39 in flipped local space
  assert.equal(drawCall.args[5], -16);
  assert.equal(drawCall.args[6], -39);
});

test('CanvasSpriteRenderer: debug overlays (anchor, rect, hitbox)', () => {
  const ctx = createMockContext();
  const manifest = loadSampleManifest();
  const player = new SpritePlayer(manifest);
  player.play('punch'); // punch-0 has hitbox: [24, 18, 8, 8]
  player.update(100); // advances into punch-0

  const fakeImage = { width: 128, height: 40 };
  const renderer = new CanvasSpriteRenderer({ image: fakeImage, scale: 1 });

  renderer.render(ctx, player, 100, 100, {
    showAnchor: true,
    showRect: true,
    showHitboxes: true
  });

  // Check that strokeRect was called for bounding box and hitbox
  const strokeRectCalls = ctx.calls.filter(c => c.method === 'strokeRect');
  assert.ok(strokeRectCalls.length >= 2, 'Expected bounding box and hitbox strokeRect calls');

  // Check that anchor crosshair / circle was drawn
  const arcCall = ctx.calls.find(c => c.method === 'arc');
  assert.ok(arcCall, 'Expected anchor circle arc call');
});

test('CanvasSpriteRenderer: options.image overrides constructor image', () => {
  const ctx = createMockContext();
  const manifest = loadSampleManifest();
  const player = new SpritePlayer(manifest);
  const defaultImage = { width: 128, height: 40 };
  const overrideImage = { width: 128, height: 40, isOverride: true };
  const renderer = new CanvasSpriteRenderer({ image: defaultImage, scale: 1 });

  renderer.render(ctx, player, 10, 10, { image: overrideImage });

  const drawCall = ctx.calls.find(c => c.method === 'drawImage');
  assert.ok(drawCall);
  assert.equal(drawCall.args[0], overrideImage);
});

test('CanvasAnimationPlayer: instantiation and rendering methods', () => {
  const manifest = loadSampleManifest();
  const player = new SpritePlayer(manifest);
  const mockCanvas = {
    width: 320,
    height: 240,
    getContext: () => createMockContext()
  };
  const fakeImage = { width: 128, height: 40 };
  const playerApp = new (require('../canvas-player').CanvasAnimationPlayer)(
    mockCanvas,
    player,
    fakeImage,
    { clearColor: '#101010' }
  );

  assert.ok(playerApp);
  playerApp.render();
  const newImage = { width: 128, height: 40, updated: true };
  playerApp.setImage(newImage);
  assert.equal(playerApp.renderer.image, newImage);
});
