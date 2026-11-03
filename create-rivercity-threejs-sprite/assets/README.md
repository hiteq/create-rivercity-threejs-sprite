# Sprite Runtime & Validation Kit

Reusable sprite animation runtime, 2D Canvas player, Three.js 3D plane adapter, and JSON manifest validator for beat-em-up sprite workflows following [`references/pipeline.md`](../references/pipeline.md).

> [!IMPORTANT]
> **No Claim of Original Game Accuracy**:
> The provided sample assets and default timings are original synthetic creations designed for demonstration and automated testing. They do not represent decoded commercial ROM data and do not claim pixel or timing accuracy to any commercial *Kunio-kun* or *River City Ransom* release.

---

## Directory Structure

```text
create-rivercity-threejs-sprite/assets/
├── index.js                     # Unified module entrypoint
├── validator.js                 # Manifest schema and constraint validator
├── runtime.js                   # Animation clock, state machine & event dispatcher (SpritePlayer)
├── canvas-player.js             # Crisp pixel art 2D canvas renderer & animation player
├── three-adapter.js             # Three.js 3D plane adapter with nearest-neighbor filtering & anchor alignment
├── package.json                 # Package metadata and test scripts
├── sample/
│   ├── sample-manifest.json     # Pipeline-compliant manifest
│   ├── sample-character.png     # 128x40 RGBA original pixel art sprite sheet
│   ├── generate-sample-sheet.js # Pure Node.js script generating the sample PNG
│   └── NOTICE.md                # Provenance and CC0-1.0 license notice
└── tests/
    ├── validator.test.js        # Schema, boundary, and error reporting tests (9 tests)
    ├── runtime.test.js          # Timing, looping, events, seek, mirror, and replay tests (8 tests)
    ├── canvas-player.test.js    # 2D transform, anchor offset, overlay, and override tests (6 tests)
    └── three-adapter.test.js    # UV mapping, ground anchor, dynamic textures, and disposal tests (7 tests)
```

---

## 1. Manifest Contract

Manifests adhere to the contract in `references/pipeline.md`:

```json
{
  "version": 1,
  "image": "sample-character.png",
  "meta": {
    "character": "Sample Brawler",
    "game": "Original Sample Test Asset",
    "imageDimensions": { "width": 128, "height": 40 }
  },
  "frames": {
    "idle-0": {
      "rect": [0, 0, 32, 40],
      "anchor": [16, 39]
    },
    "punch-0": {
      "rect": [96, 0, 32, 40],
      "anchor": [16, 39],
      "hitboxes": [
        { "id": "punch_box", "type": "attack", "rect": [24, 18, 8, 8] }
      ]
    }
  },
  "animations": {
    "idle": {
      "loop": true,
      "frames": [
        { "frame": "idle-0", "durationMs": 180 }
      ]
    },
    "punch": {
      "loop": false,
      "frames": [
        {
          "frame": "punch-0",
          "durationMs": 160,
          "events": [{ "name": "hit", "timeMs": 20 }]
        }
      ]
    }
  }
}
```

### Coordinate & Anchor Rules
- `rect`: `[x, y, width, height]` in image pixels. Positive integers.
- `anchor`: `[ax, ay]` relative to rectangle top-left, representing **ground contact** (feet).
- **Horizontal Mirroring**: Mirrored around the anchor x-coordinate (`ax`), keeping feet at the exact same world coordinate when turning left/right.

---

## 2. Manifest Validator

Validate manifests programmatically or via CLI with actionable diagnostic errors.

### CLI Usage

```bash
# Validate sample manifest
node validator.js sample/sample-manifest.json

# Validate with explicit atlas bounds check
node validator.js sample/sample-manifest.json --width 128 --height 40
```

### Programmatic Usage

```javascript
const { validateManifest, assertValidManifest } = require('./validator');

const result = validateManifest(manifestData, {
  imageDimensions: { width: 128, height: 40 }
});

if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

---

## 3. Core Sprite Runtime (`SpritePlayer`)

The runtime manages animation time, variable frame durations, discrete event triggering across large frame drops, facing direction, and frame-stepping.

```javascript
const { SpritePlayer } = require('./runtime');

const player = new SpritePlayer(manifest, {
  initialAnimation: 'idle',
  facing: 'right', // 'right' or 'left'
  autoPlay: true
});

// Event handling
player.on('event', (e) => {
  console.log(`Triggered event "${e.name}" at ${e.triggerTimeMs}ms`);
});

player.on('finish', ({ animation }) => {
  console.log(`One-shot animation "${animation}" completed.`);
});

// Game loop update (e.g. 16.6ms)
player.update(16.6);

// Inspection & Control
player.setFacing('left'); // Mirrored around anchor
player.step(1);           // Step 1 frame forward
player.seek(150);         // Jump to 150ms
player.play('punch');     // Switch to one-shot punch
```

---

## 4. Canvas 2D Player (`CanvasSpriteRenderer`)

Renders the sprite onto a 2D HTML Canvas, automatically maintaining nearest-neighbor pixel sharpness and aligning the ground anchor.

```javascript
const { CanvasSpriteRenderer } = require('./canvas-player');

const renderer = new CanvasSpriteRenderer({
  image: characterImage, // HTMLImageElement or ImageBitmap
  scale: 2               // 2x integer pixel scale
});

// Inside render loop:
// (destX, destY) is the world position where the character's feet touch the ground
renderer.render(ctx, player, destX, destY, {
  showAnchor: false,   // Set true to draw ground anchor crosshair
  showRect: false,     // Set true to draw frame boundary
  showHitboxes: false  // Set true to render attack hitboxes
});
```

---

## 5. Three.js 3D Adapter (`ThreeSpriteAdapter`)

Creates a camera-facing or 3D world plane whose local origin `(0, 0, 0)` is anchored at the character's feet.

```javascript
import * as THREE from 'three';
import { ThreeSpriteAdapter } from './three-adapter.js';

const texture = new THREE.TextureLoader().load('sample/sample-character.png');

const adapter = new ThreeSpriteAdapter({
  THREE,
  manifest,
  texture,
  player,
  pixelsPerUnit: 0.05 // 20 sprite pixels = 1 Three.js world unit
});

// Add sprite mesh to scene
scene.add(adapter.mesh);

// Set world position (feet grounded at y = 0)
adapter.mesh.position.set(0, 0, 0);

// In animation loop
function animate(time) {
  requestAnimationFrame(animate);
  const deltaMs = clock.getDelta() * 1000;
  adapter.update(deltaMs);
  renderer.render(scene, camera);
}

// Cleanup when unmounting or changing scenes
adapter.dispose(true);
```

### Key Three.js Features
- **Nearest-Neighbor Filtering**: `texture.magFilter = THREE.NearestFilter`, `texture.minFilter = THREE.NearestFilter`, `texture.generateMipmaps = false`.
- **Alpha & Depth**: `transparent: true`, `alphaTest: 0.1`, and `depthWrite: true` prevent transparent pixel depth sorting conflicts.
- **Anchor Alignment**: Mesh geometry vertices are offset so `(0, 0, 0)` local space is the foot contact anchor.
- **Facing Mirror**: Switching `player.setFacing('left')` dynamically flips UVs and vertices around the anchor.

---

## 6. Running Tests

The test suite runs with Node.js built-in test runner (`node:test`) and requires zero external dependencies.

```bash
cd create-rivercity-threejs-sprite/assets
npm test
```

Test coverage includes:
- **Validator** (`tests/validator.test.js`): Schema conformance, negative bounds, missing frames, invalid anchors, non-positive durations, and unused frame warnings.
- **Runtime** (`tests/runtime.test.js`): Variable durations, looping wrap, one-shot clamping and finish events, multi-frame event traversal, seeking, and anchor bounds.
- **Canvas Player** (`tests/canvas-player.test.js`): Nearest-neighbor flag, drawImage transform calculations, left-facing horizontal mirror, and debug overlays.
- **Three.js Adapter** (`tests/three-adapter.test.js`): Texture filtering, depth settings, anchor ground alignment, UV calculations, facing flips, and resource disposal.

---

## 8. Interactive Demonstration Workbench

A complete local interactive demonstration inspired by [3d.internet.dev](https://3d.internet.dev/) is available in `create-rivercity-threejs-sprite/demo/`:

```bash
# From assets directory:
npm run demo

# Or from project root:
node create-rivercity-threejs-sprite/demo/server.js
```

Open `http://127.0.0.1:8080/` to test:
- Dual real-time Three.js 2.5D belt-scroll scene and 2D pixel canvas inspector.
- Real-time 2.5D belt-scroll keyboard controls (<kbd>WASD</kbd> / <kbd>Arrows</kbd>, <kbd>J</kbd> punch, <kbd>K</kbd> kick, <kbd>H</kbd> hurt).
- 2.5D depth sorting with a rival brawler at deeper $Z$.
- Atlas frame inspector and animation library deck.
- Scrubber with frame-accurate 60Hz tick readout.

1. **Depth Sorting in 3D**:
   Transparent pixel planes in 3D require careful camera depth handling. `alphaTest: 0.1` is enabled by default to discard fully transparent fragments from depth buffer writes. For overlapping sprites on the same depth plane, scene-level renderOrder or distance sorting is recommended.
2. **Single Atlas Texture**:
   The current adapter assumes all frames of a given character are packed into a single texture atlas referenced by `manifest.image`.
3. **Accuracy Disclaimer**:
   As stated in `references/pipeline.md`, timing and hitbox data should be confirmed against verified gameplay footage or rom captures before claiming historical fidelity.
