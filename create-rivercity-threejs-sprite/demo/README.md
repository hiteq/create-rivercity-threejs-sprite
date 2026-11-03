# River City Three.js Sprite Interactive Demonstration

An interactive, responsive dual 2D/3D demonstration and inspection workbench for *River City Ransom* (*Downtown Nekketsu Monogatari* / 열혈 시리즈) style beat-em-up sprites, inspired by [3d.internet.dev](https://3d.internet.dev/).

---

## 🌟 Overview & Key Features

- **Dual Real-time Viewports**:
  - **Three.js 2.5D Belt-Scroll Scene**: Real WebGL scene driven by `ThreeSpriteAdapter` featuring authentic 2.5D belt-scroll coordinates ($X$ = lateral, $Z$ = depth, $Y$ = elevation), drop-shadow disc anchored at sole level ($Y=0.01$), retro grid floor, and camera presets (2.5D Classic angled, Orthogonal front, High Isometric, and free OrbitControls).
  - **2D Canvas Pixel Inspector**: Rendered via `CanvasSpriteRenderer` at nearest-neighbor integer scaling (4x, 6x, 8x) with debug overlays for sole anchor crosshair, frame rect bounding box, and active attack hitboxes.
  - **Dual Split View**: Side-by-side mode displaying both 2D and 3D viewports simultaneously.
- **2.5D Belt-Scroll Depth Sorting & Rival Brawler**:
  - Includes a secondary brawler positioned deeper on the $Z$-axis facing left.
  - As the player moves around in 2.5D space, depth sorting cleanly manages layering (player behind rival when $Z < Z_{\text{rival}}$, in front when $Z > Z_{\text{rival}}$) with zero transparency glitches (`alphaTest: 0.1` and `depthWrite: true`).
- **Interactive Keyboard & Mobile Touch Play**:
  - Virtual On-Screen Touch Gamepad: D-Pad (<kbd>▲</kbd><kbd>◀</kbd><kbd>▼</kbd><kbd>▶</kbd>) for belt-scroll traversal and direct combat strike buttons (<kbd>PUNCH</kbd>, <kbd>KICK</kbd>) with 44px touch targets.
  - Desktop Keyboard controls: Move around using <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or <kbd>Arrow Keys</kbd> (automatic walk animation and direction flipping).
  - Press <kbd>J</kbd> or click **PUNCH** to trigger straight punch.
  - Press <kbd>K</kbd> or click **KICK** to trigger front kick.
  - Press <kbd>H</kbd> or click **HURT** to trigger hit shock recoil with iconic $O\_O$ face.
- **Animation Library Deck**:
  - Clickable action cards for each animation sequence (`idle`, `walk`, `punch`, `kick`, `hurt`, `down`).
  - Displays duration in milliseconds, equivalent NES 60Hz tick count (e.g. 133ms $\approx$ 8 ticks), frame count, and loop/event status.
- **Interactive Sprite Sheet & Atlas Inspector**:
  - Displays full sprite sheet atlas with real-time glowing bounding box tracking the currently rendered frame.
  - Click any frame in the atlas to inspect exact pixel coordinates: `rect [x, y, w, h]`, `anchor [ax, ay]`, step duration, ticks, and hitbox list.
- **Full Playback Bar**:
  - Play/Pause, Step Forward (+1 frame), Step Backward (-1 frame), Reset to 0ms.
  - Speed multipliers: `0.25x`, `0.5x`, `1.0x`, `2.0x`.
  - Direction toggle (`Facing Right ➔` / `Facing Left ⬅`) with zero positional drift.
  - Interactive scrubber slider and real-time event monitor badge.
- **Character Preset Switcher**:
  - **Sample Brawler (Expanded 10-Frame Action Suite)**: Full combat actions (`idle`, `walk`, `punch`, `kick`, `hurt`, `down`).
  - **Sample Character (Core 4-Frame Baseline)**: Original lightweight test harness asset.
- **Truthful Provenance & Licensing**:
  - Clear 3-tier classification badges: Verified Source vs Estimated vs Original Artwork.
  - 100% original procedural CC0 pixel art assets. Zero copyrighted ROM rips.

---

## 🚀 Quick Startup Instructions

### 1. Start the Demo Server

Run either command from your terminal:

```bash
# Option A: From project root
npm run demo

# Option B: Direct Node invocation
node create-rivercity-threejs-sprite/demo/server.js
```

The server will start at:
```
http://127.0.0.1:8080/
```
Open this URL in Google Chrome or any modern browser.

### 2. Run the Automated Test Suite

To verify all 32 unit tests covering the manifest validator, runtime animation clock, 2D canvas player, and Three.js adapter:

```bash
npm test
# Or inside the assets package:
cd create-rivercity-threejs-sprite/assets && npm test
```

---

## 🔌 Integration Guide (How to Use in Your Projects)

### Three.js 2.5D Scene Integration

```javascript
import * as THREE from 'three';
import { SpritePlayer } from './create-rivercity-threejs-sprite/assets/runtime.js';
import { ThreeSpriteAdapter } from './create-rivercity-threejs-sprite/assets/three-adapter.js';

// 1. Load manifest and texture
const manifest = await fetch('assets/sample/sample-expanded-manifest.json').then(r => r.json());
const texture = new THREE.TextureLoader().load('assets/sample/sample-expanded-character.png');

// 2. Instantiate Player and Adapter
const player = new SpritePlayer(manifest, { initialAnimation: 'idle', facing: 'right' });
const adapter = new ThreeSpriteAdapter({
  THREE,
  manifest,
  texture,
  player,
  pixelsPerUnit: 0.05 // 20 pixels = 1 Three.js unit
});

// 3. Add to Scene and Position
scene.add(adapter.mesh);
adapter.mesh.position.set(0, 0, 0); // Foot contact anchored at ground Y = 0

// 4. In Render Loop
function animate(time) {
  requestAnimationFrame(animate);
  const deltaMs = clock.getDelta() * 1000;
  adapter.update(deltaMs); // Advances clock and syncs mesh UVs and vertices
  renderer.render(scene, camera);
}
```

### 2D Canvas Inspector Integration

```javascript
import { SpritePlayer } from './create-rivercity-threejs-sprite/assets/runtime.js';
import { CanvasSpriteRenderer } from './create-rivercity-threejs-sprite/assets/canvas-player.js';

const player = new SpritePlayer(manifest, { initialAnimation: 'walk' });
const renderer = new CanvasSpriteRenderer({ image, scale: 4, disableSmoothing: true });

function renderFrame() {
  player.update(16.6);
  // Aligns foot sole to canvas coordinates (destX, destY)
  renderer.render(ctx, player, destX, destY, {
    showAnchor: true,
    showHitboxes: true
  });
}
```

---

## ⚖ The Anchor Discipline: Preventing the "Punch Recoil" Bug

In 2.5D belt-scroll brawlers, **the sole anchor point is ground zero**:
- If sprites are centered on their bounding boxes, a straight punch with an extended fist (which adds 8 pixels to the front of the frame) will shift the bounding-box center 4 pixels forward, causing the character's body to visibly **slide backward** during a punch!
- In this runtime, every frame defines an explicit sole anchor `[anchorX, anchorY]` (e.g. `[16, 39]`) placed between the feet at ground level.
- Horizontal mirroring pivots strictly around `anchorX`. Facing left mirrors the mesh or canvas drawing without shifting world position by even 1 sub-pixel.
