const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { SpritePlayer } = require('../runtime');
const { ThreeSpriteAdapter } = require('../three-adapter');

function createMockThree() {
  class Float32BufferAttribute {
    constructor(array, itemSize) {
      this.array = array;
      this.itemSize = itemSize;
      this.needsUpdate = false;
    }
  }

  class Uint16BufferAttribute {
    constructor(array, itemSize) {
      this.array = array;
      this.itemSize = itemSize;
    }
  }

  class BufferGeometry {
    constructor() {
      this.attributes = {};
      this.index = null;
      this.disposed = false;
    }
    setAttribute(name, attribute) {
      this.attributes[name] = attribute;
    }
    setIndex(index) {
      this.index = index;
    }
    computeBoundingSphere() {}
    computeBoundingBox() {}
    dispose() {
      this.disposed = true;
    }
  }

  class MeshBasicMaterial {
    constructor(options = {}) {
      this.options = options;
      this.map = options.map || null;
      this.transparent = options.transparent;
      this.alphaTest = options.alphaTest;
      this.depthWrite = options.depthWrite;
      this.disposed = false;
    }
    dispose() {
      this.disposed = true;
    }
  }

  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.scale = { x: 1, y: 1, z: 1 };
      this.position = { x: 0, y: 0, z: 0 };
    }
  }

  return {
    NearestFilter: 1003,
    DoubleSide: 2,
    SRGBColorSpace: 'srgb',
    Float32BufferAttribute,
    Uint16BufferAttribute,
    BufferGeometry,
    MeshBasicMaterial,
    Mesh
  };
}

function createMockTexture(width = 128, height = 40) {
  return {
    image: { width, height },
    magFilter: 0,
    minFilter: 0,
    generateMipmaps: true,
    needsUpdate: false,
    disposed: false,
    dispose() {
      this.disposed = true;
    }
  };
}

function loadSampleManifest() {
  const samplePath = path.join(__dirname, '../sample/sample-manifest.json');
  return JSON.parse(fs.readFileSync(samplePath, 'utf8'));
}

test('ThreeSpriteAdapter: texture configuration and nearest filter', () => {
  const THREE = createMockThree();
  const manifest = loadSampleManifest();
  const player = new SpritePlayer(manifest);
  const texture = createMockTexture(128, 40);

  const adapter = new ThreeSpriteAdapter({
    THREE,
    manifest,
    texture,
    player
  });

  assert.equal(texture.magFilter, THREE.NearestFilter);
  assert.equal(texture.minFilter, THREE.NearestFilter);
  assert.equal(texture.generateMipmaps, false);
  assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
  assert.equal(texture.needsUpdate, true);
});

test('ThreeSpriteAdapter: material transparency and depth settings', () => {
  const THREE = createMockThree();
  const manifest = loadSampleManifest();
  const player = new SpritePlayer(manifest);
  const texture = createMockTexture(128, 40);

  const adapter = new ThreeSpriteAdapter({
    THREE,
    manifest,
    texture,
    player
  });

  assert.equal(adapter.material.transparent, true);
  assert.equal(adapter.material.alphaTest, 0.1);
  assert.equal(adapter.material.depthWrite, true);
});

test('ThreeSpriteAdapter: vertex positioning with ground anchor alignment', () => {
  const THREE = createMockThree();
  const manifest = loadSampleManifest();
  const player = new SpritePlayer(manifest);
  // idle-0: rect: [0, 0, 32, 40], anchor: [16, 39]
  const texture = createMockTexture(128, 40);
  const ppu = 0.1; // 10 pixels = 1 unit

  const adapter = new ThreeSpriteAdapter({
    THREE,
    manifest,
    texture,
    player,
    pixelsPerUnit: ppu
  });

  const pos = adapter.geometry.attributes.position.array;
  // Vertex 0: top-left (x0, y1)
  // Vertex 1: top-right (x1, y1)
  // Vertex 2: bottom-left (x0, y0)
  // Vertex 3: bottom-right (x1, y0)
  // Left: -16 * 0.1 = -1.6
  // Right: (32 - 16) * 0.1 = 1.6
  // Top: 39 * 0.1 = 3.9
  // Bottom: (39 - 40) * 0.1 = -0.1 (anchor ground contact at Y = 0)
  const approxEqual = (a, b) => Math.abs(a - b) < 1e-5;
  assert.ok(approxEqual(pos[0], -1.6), `Expected -1.6, got ${pos[0]}`); // x0
  assert.ok(approxEqual(pos[1], 3.9), `Expected 3.9, got ${pos[1]}`);   // y1
  assert.ok(approxEqual(pos[3], 1.6), `Expected 1.6, got ${pos[3]}`);   // x1
  assert.ok(approxEqual(pos[4], 3.9), `Expected 3.9, got ${pos[4]}`);   // y1
  assert.ok(approxEqual(pos[6], -1.6), `Expected -1.6, got ${pos[6]}`); // x0
  assert.ok(approxEqual(pos[7], -0.1), `Expected -0.1, got ${pos[7]}`); // y0
  assert.ok(approxEqual(pos[9], 1.6), `Expected 1.6, got ${pos[9]}`);   // x1
  assert.ok(approxEqual(pos[10], -0.1), `Expected -0.1, got ${pos[10]}`);// y0
});

test('ThreeSpriteAdapter: UV mapping for sprite sheet frames', () => {
  const THREE = createMockThree();
  const manifest = loadSampleManifest();
  const player = new SpritePlayer(manifest);
  const texture = createMockTexture(128, 40);

  const adapter = new ThreeSpriteAdapter({
    THREE,
    manifest,
    texture,
    player
  });

  // idle-0: [0, 0, 32, 40] on 128x40 image
  // uMin: 0/128 = 0, uMax: 32/128 = 0.25
  // vMin: 1 - 40/40 = 0, vMax: 1 - 0/40 = 1.0
  const uvs0 = adapter.geometry.attributes.uv.array;
  assert.equal(uvs0[0], 0);    // top-left u
  assert.equal(uvs0[1], 1.0);  // top-left v
  assert.equal(uvs0[2], 0.25); // top-right u
  assert.equal(uvs0[3], 1.0);  // top-right v
  assert.equal(uvs0[4], 0);    // bottom-left u
  assert.equal(uvs0[5], 0);    // bottom-left v
  assert.equal(uvs0[6], 0.25); // bottom-right u
  assert.equal(uvs0[7], 0);    // bottom-right v

  // Advance to idle-1: rect: [32, 0, 32, 40]
  player.play('idle');
  adapter.update(2900); // idle-0 is 2800ms, so 2900ms enters idle-1

  const uvs1 = adapter.geometry.attributes.uv.array;
  // uMin: 32/128 = 0.25, uMax: 64/128 = 0.5
  assert.equal(uvs1[0], 0.25);
  assert.equal(uvs1[2], 0.5);
  assert.equal(uvs1[4], 0.25);
  assert.equal(uvs1[6], 0.5);
});

test('ThreeSpriteAdapter: facing left flips UVs and horizontal vertex alignment', () => {
  const THREE = createMockThree();
  const manifest = loadSampleManifest();
  const player = new SpritePlayer(manifest);
  player.setFacing('left');
  const texture = createMockTexture(128, 40);

  const adapter = new ThreeSpriteAdapter({
    THREE,
    manifest,
    texture,
    player,
    pixelsPerUnit: 1
  });

  const uvs = adapter.geometry.attributes.uv.array;
  // Facing left: uMin and uMax are inverted so the image displays horizontally mirrored
  assert.equal(uvs[0], 0.25); // top-left u is now uMax
  assert.equal(uvs[2], 0);    // top-right u is now uMin
  assert.equal(uvs[4], 0.25); // bottom-left u
  assert.equal(uvs[6], 0);    // bottom-right u
});

test('ThreeSpriteAdapter: resource cleanup on dispose()', () => {
  const THREE = createMockThree();
  const manifest = loadSampleManifest();
  const player = new SpritePlayer(manifest);
  const texture = createMockTexture(128, 40);

  const adapter = new ThreeSpriteAdapter({
    THREE,
    manifest,
    texture,
    player
  });

  adapter.dispose(true);
  assert.equal(adapter.geometry.disposed, true);
  assert.equal(adapter.material.disposed, true);
  assert.equal(texture.disposed, true);
});

test('ThreeSpriteAdapter: setTexture, setPixelsPerUnit and explicit imageDimensions', () => {
  const THREE = createMockThree();
  const manifest = loadSampleManifest();
  const player = new SpritePlayer(manifest);
  const texture1 = createMockTexture(128, 40);

  const adapter = new ThreeSpriteAdapter({
    THREE,
    manifest,
    texture: texture1,
    player,
    pixelsPerUnit: 0.1,
    imageDimensions: { width: 256, height: 80 }
  });

  // Verify explicit imageDimensions overrides mock texture dimensions
  assert.deepEqual(adapter.getTextureDimensions(), { width: 256, height: 80 });

  // Test setPixelsPerUnit
  adapter.setPixelsPerUnit(0.2);
  assert.equal(adapter.pixelsPerUnit, 0.2);
  const pos = adapter.geometry.attributes.position.array;
  // idle-0: anchor=[16, 39], rect=[0, 0, 32, 40]
  // with ppu=0.2: left=-16 * 0.2 = -3.2
  assert.ok(Math.abs(pos[0] - (-3.2)) < 1e-5);

  // Test setTexture
  const texture2 = createMockTexture(256, 80);
  adapter.setTexture(texture2);
  assert.equal(adapter.texture, texture2);
  assert.equal(texture2.magFilter, THREE.NearestFilter);
  assert.equal(adapter.material.map, texture2);
});
