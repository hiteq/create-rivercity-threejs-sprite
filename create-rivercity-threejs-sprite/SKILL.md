---
name: create-rivercity-threejs-sprite
description: Research, reconstruct, create, and animate River City Ransom, Kunio-kun, Downtown Nekketsu Monogatari, and 열혈 시리즈 beat-em-up sprites for 2D Canvas and Three.js projects. Use when a user wants to inspect authentic sprite sheets, reconstruct animation timing from game footage or emulator captures, build a 2.5D belt-scroll sprite runtime, import a Kunio-style character, or create original retro pixel art characters using this visual language. Maintains strict honesty between verified source data and estimated or original animation.
compatibility: Browser Canvas 2D and Three.js (r128+). Manifest validation runs on Node.js 18+.
---

# Create River City Three.js Sprite

A toolkit and guide to research, reconstruct, create, and animate *River City Ransom* (*Downtown Nekketsu Monogatari* / 열혈 시리즈) style beat-em-up sprites in 2D Canvas and Three.js.

Unlike modern 3D models or linear sprite strips, retro beat-em-up sprites depend on strict ground-anchor discipline, modular facial expressions, punchy 60Hz tick timing, and 2.5D depth sorting. This skill provides an end-to-end pipeline: from source provenance audit and JSON manifest authoring to dual 2D/3D playback and visual parity verification.

---

## The Core Mission & Honesty Principle

Always distinguish the core tiers of sprite deliverables:
1. **Sourced Reference Data**: Sprites and animation frame contours verified directly against reference archives (The Spriters Resource NES rip) preserving authentic 8x16 PPU metatiles.
2. **Adapted Composite Data**: Modular metasprites (such as boss hurt/down frames reusing shared Technōs hit geometry, or adapted hairstyles) re-paletted and composited to match character identities.
3. **Estimated Timings & Hitboxes**: 60Hz tick intervals and collision boxes calibrated for belt-scroll rhythm; labeled explicitly as estimated unless confirmed by RAM/emulator capture.
4. **Original Artwork**: Newly authored characters adhering to the Kunio-kun visual grammar, palette limits, and animation timing curves.

### Mandatory Pixel-Level Fidelity & Verification Rule
- **No Inauthentic Placeholders for Authentic Demands**: When authentic River City Ransom / Kunio-kun graphics are requested, generic geometric shapes, procedural approximations, or stylistically divergent placeholders are strictly prohibited.
- **Pixel-by-Pixel Source Inspection**: Research credible references (NES CHR-ROM rips, The Spriters Resource, The Cutting Room Floor, TASVideos frame logs). Inspect source images pixel-by-pixel to identify exact metatile compositing, contour outlines, and facial expressions.
- **Objective Verification Requirement**: **Do NOT claim raw ROM dump extraction or bit-exact gameplay parity without evidence**. Test and report consistency against the bundled reference atlas (e.g. 100% RGBA match for sourced head tiles), verify character differentiation (e.g. Ryan's distinct regent pompadour `sprite50` vs Alex `sprite1`), and classify adapted frames honestly.
- **Exact NES Palette Adherence**: Strictly map colors to the NES Ricoh 2C02 PPU palette ($0F `#050505` black outline/hair, $27 `#fc7460` warm peach skin, $30 `#ffffff` white gakuran/eyes, $12 `#0070ec` gakuran blue).
- **Full Provenance & Legal Clarity**: State exact game version, developer (Technōs Japan), current rights holder (**Arc System Works Co., Ltd.**), ripper/archive URL, and any remaining animation or coverage gaps.

> **Honesty About Tools & Evidence**: Unlike platforms or engines with cleanly extracted static sequence tables, Famicom/NES *River City Ransom* dynamically composited hardware 8×16 OAM sprites (metasprites) and swapped palettes via 6502 assembly routines. Unless you have verified an exact frame sequence with an emulator frame-advance log, **always label extracted timing as estimated** and clearly document what was tested.

---

## Quick Decision Matrix

| Decision | Default Choice | Alternative / When to Change |
|---|---|---|
| **Renderer** | Dual Runtime (Bundled `assets/canvas-player.js` for 2D inspector + `assets/three-adapter.js` for Three.js 2.5D scene) | Canvas only for 2D pixel review; Three.js for isometric / belt-scroll games |
| **Art Source** | User-supplied sprite sheet or clean prototype placeholder | Author new art via `references/art-direction.md` when original character is requested |
| **Animation Scope** | Core Beat-Em-Up Suite: `idle`, `walk`, `punch`, `hurt`, `down` | Expand to `mach_punch`, `kick`, `jump_kick`, `dash`, `lift` for complete fighters |
| **Projection** | 2.5D Camera-Facing Billboard Plane (Angled 20°–30° or Orthographic) | Fixed vertical billboard facing camera directly with Y-elevation jumping |
| **Texture Filter** | `THREE.NearestFilter` (both min & mag) | Never use bilinear/bicubic filtering—it ruins pixel art contours |

---

## Step 1: Research & Source Provenance Audit

Before writing runtime code, audit the source material:
1. **Identify Platform & Release**: Note exact game and version (e.g. Famicom *Downtown Nekketsu Monogatari* 1989, NES *River City Ransom* 1989, PC Engine Super CD-ROM², or GBA *River City Ransom EX*). Frame counts, palettes, and resolution vary across releases.
2. **Record Asset Provenance**:
   - Source URL, author/ripper, and date obtained.
   - Licensing / copyright status: Do not distribute commercial ROMs or ripped art; build importers that accept user-provided PNG sheets and manifests.
3. **Audit Animation Evidence**:
   - Inspect raw image bounds and palette indexing.
   - If frame order is uncertain, cross-reference against emulator frame-advance recordings.
   - Document verified ticks (e.g. 8 ticks = 133.3ms at 60Hz) vs estimated durations.

### Character Diversity & Authentic NES Metasprite Composition

Technōs Japan achieved rich character diversity in *Downtown Nekketsu Monogatari* within strict Famicom/NES hardware constraints by decoupling head metatiles and body metatiles:
- **Head Metatiles ($8 \times 16 \times 2$)**: Unique hair contours, bangs, eye shapes, and expressions (e.g., Kunio's pompadour, Gōda's fringe bangs, Ryūichi's center-parted hair, Yamada's scheming eyes, Godai's spiky flattop, Sawaguchi's mullet).
- **Body Metatiles**: Shared combat and locomotion metasprites (walk strides, straight punch, thrust kick, hurt recoil, flat knockdown).
- **Canonical School Uniform Palettes**: Palette lookup tables assigned to body tiles (e.g., Nekketsu White, Hanazono Blue, Hōryō Jade Green, Reihō Crimson Red, Meian Violet Purple, Tanibana Navy Blue, Hakutaka Salmon Pink).

When building character suites:
1. **Verifiable Source Pixels**: Ground all character faces in bit-exact extracted NES PPU tiles (`sprite48`–`53`, `sprite56`–`61`).
2. **Head/Body Consistency**: Maintain exact head offsets (`headDx`, `headDy`) across walk strides, punch extensions, and kick chambers so that each character feels cohesive across the entire action loop.
3. **Honesty About Composition vs Hand-Drawn Art**: Clearly document that dynamic combat actions use modular metasprite head-swapping and canonical uniform recoloring (mirroring original NES hardware behavior) rather than falsely promising unique per-character hand-drawn attack poses.

---

## Step 2: The Manifest Data Contract

Every character uses a versioned JSON manifest (`manifest.json`). Frame coordinates are integer pixels; durations are positive milliseconds.

```json
{
  "version": 1,
  "image": "kunio-sheet.png",
  "meta": {
    "character": "kunio-prototype",
    "provenance": "Original creation inspired by Downtown Nekketsu Monogatari",
    "timingConfidence": "estimated",
    "sourceImage": "kunio-sheet.png"
  },
  "frames": {
    "idle-0": { "rect": [0, 0, 32, 36], "anchor": [16, 35] },
    "walk-0": { "rect": [32, 0, 32, 36], "anchor": [16, 35] },
    "walk-1": { "rect": [64, 0, 32, 36], "anchor": [16, 35] },
    "punch-0": { "rect": [96, 0, 32, 36], "anchor": [16, 35] },
    "punch-1": { "rect": [128, 0, 40, 36], "anchor": [16, 35] }
  },
  "animations": {
    "idle": {
      "loop": true,
      "frames": [{ "frame": "idle-0", "durationMs": 240 }]
    },
    "walk": {
      "loop": true,
      "frames": [
        { "frame": "walk-0", "durationMs": 133 },
        { "frame": "walk-1", "durationMs": 133 }
      ]
    },
    "punch": {
      "loop": false,
      "frames": [
        { "frame": "punch-0", "durationMs": 67 },
        { "frame": "punch-1", "durationMs": 133, "events": ["hit_active"] },
        { "frame": "punch-0", "durationMs": 67 }
      ]
    }
  }
}
```

### Essential Coordinate Rules
- `rect`: `[x, y, width, height]` in sheet pixels. Top-left is `[0, 0]`.
- `anchor`: `[anchorX, anchorY]` relative to the frame's top-left. **Must point to the ground sole contact point between the feet.**
- **Horizontal Facing**: Mirroring across horizontal axes must pivot around `anchorX`. Never mirror about bounding-box centers.
- Consult `references/pipeline.md` for full validation schema and edge-case handling.

### Bundled Manifest Validator
Use the bundled validator (`assets/validator.js`) to assert schema and boundary correctness before loading into scenes:
```bash
# Validate manifest CLI
node create-rivercity-threejs-sprite/assets/validator.js path/to/manifest.json

# Validate with atlas image dimension bounds checking
node create-rivercity-threejs-sprite/assets/validator.js path/to/manifest.json --width 128 --height 40
```
Programmatic verification in code:
```javascript
const { validateManifest, assertValidManifest } = require('./assets/validator');
const result = validateManifest(manifest, { imageDimensions: { width: 128, height: 40 } });
if (!result.valid) console.error(result.errors);
```

---

## Step 3: Authoring Original Characters

When creating new characters or missing animations, follow `references/art-direction.md`:
1. **Anatomy & Scale**: Chibi / SD 2.0–2.5 heads tall (32–36px total height, head 14–16px wide, torso 10–14px wide).
2. **Modular Expressions**: Build modular faces (Determined stance, Open-mouth shout, Iconic "O_O" hit shock face, and KO groggy face).
3. **Palette Constraints**: Respect NES 3+1 color constraints (Outline + 2 skin tones + 2 uniform tones).
4. **Snappy Timing**: Walk cycle at 4 frames (~133ms each). Punch windup at 67ms, active strike hold at 133ms, recovery at 67ms.

---

## Step 4: Dual Runtime Architecture

This skill provides an end-to-end bundled runtime in `assets/` (`runtime.js`, `canvas-player.js`, `three-adapter.js`, and `validator.js`) sharing a unified animation clock and manifest data contract.

### 1. 2D Canvas Inspector (`assets/canvas-player.js`)
- Renders sprite at 1x, 2x, 4x integer scale without antialiasing (`imageSmoothingEnabled = false`).
- Draws debug overlays: bounding box (green), anchor point crosshair (red), and active hitboxes (blue/red).
- Horizontal flipping mirrors cleanly around the foot anchor without positional drift.
- Usage:
  ```javascript
  const { SpritePlayer } = require('./assets/runtime');
  const { CanvasSpriteRenderer } = require('./assets/canvas-player');

  const player = new SpritePlayer(manifest, { initialAnimation: 'idle' });
  const renderer = new CanvasSpriteRenderer({ image, scale: 2 });
  // In render loop (aligned to world ground point destX, destY):
  renderer.render(ctx, player, destX, destY, { showAnchor: true, showHitboxes: true });
  ```

### 2. Three.js 2.5D Beat-Em-Up Scene (`assets/three-adapter.js`)
In beat-em-up games, movement follows 2.5D belt-scroll coordinates:
- **X-axis**: Screen horizontal (lateral left/right).
- **Z-axis**: Depth along the ground plane (moving up/down screen).
- **Y-axis**: Vertical jump elevation / gravity (off the ground plane).

The bundled `ThreeSpriteAdapter` manages texture filtering, material alpha cutoff, dynamic UVs, and mesh vertex geometry anchored at local `(0, 0, 0)`:

```javascript
import * as THREE from 'three';
import { SpritePlayer } from './assets/runtime.js';
import { ThreeSpriteAdapter } from './assets/three-adapter.js';

// 1. Texture Configuration (handled automatically by ThreeSpriteAdapter)
const texture = new THREE.TextureLoader().load('sample/sample-character.png');

// 2. Initialize Core Player and 3D Adapter
const player = new SpritePlayer(manifest, { initialAnimation: 'idle', facing: 'right' });
const adapter = new ThreeSpriteAdapter({
  THREE,
  manifest,
  texture,
  player,
  pixelsPerUnit: 0.05 // 20 pixels = 1 Three.js world unit
});

// 3. Add to Scene and Position on Ground Plane
scene.add(adapter.mesh);
adapter.mesh.position.set(0, 0, 0); // Foot contact anchored at ground (Y = 0)

// 4. Animation Loop
function animate(time) {
  requestAnimationFrame(animate);
  adapter.update(clock.getDelta() * 1000); // advances SpritePlayer and updates mesh UVs/vertices
  renderer.render(scene, camera);
}
```

#### Under the Hood: Texture & Ground Anchor Math
- **Texture Filtering**: `THREE.NearestFilter` is enforced on both `magFilter` and `minFilter`, mipmaps are disabled (`generateMipmaps = false`), and `colorSpace = THREE.SRGBColorSpace` is configured to prevent blur or color banding.
- **Material Settings**: `transparent: true`, `alphaTest: 0.1` (or `0.5`), and `depthWrite: true` avoid transparent-pixel depth sorting conflicts.
- **Anchor Math**: Vertices are dynamically adjusted so that ground contact `[ax, ay]` sits precisely at `(0, 0, 0)` in local space:
  - Facing Right: vertex X extends from `-ax * ppu` to `(w - ax) * ppu`.
  - Facing Left: vertex X extends from `-(w - ax) * ppu` to `ax * ppu` with inverted UVs.
  - Height: vertex Y extends from `(ay - h) * ppu` to `ay * ppu`.
- **Resource Disposal**: Call `adapter.dispose(true)` to cleanly release geometry, material, and GPU textures when unmounting.

---

## Step 5: Verification & Parity Checklist

Run this checklist before completing any sprite integration:

- [ ] **Automated Test Suite**: Run `cd create-rivercity-threejs-sprite/assets && npm test` to verify all 31 automated unit tests across validator, runtime clock, canvas player, and Three.js adapter.
- [ ] **Pixel Sharpness**: Nearest-neighbor filtering active; zero blur or sub-pixel seam bleeding.
- [ ] **Ground Anchor Stability**: Feet remain firmly planted across `idle`, `walk`, and `punch` without jumping, sliding, or jittering.
- [ ] **Facing & Mirroring**: Flipping direction mirrors horizontally around the anchor without shifting the unit position.
- [ ] **Animation Integrity**: Loops cycle seamlessly; one-shot animations (`punch`, `hurt`) cleanly return to `idle` upon completion.
- [ ] **Event Timing**: Action events (`hit_active`) fire exactly once at the designated frame crossing, even under large delta-time steps.
- [ ] **2.5D Depth Sorting**: Characters with higher Z-coordinates render in front of characters further up the ground plane.
- [ ] **Honesty & Licensing Notice**: Manifest notes document provenance, license status, and whether timing was emulator-verified or estimated.

---

## Rules That Prevent Most Bugs

- **The Anchor is Ground Zero**: Never use bounding-box center for sprite alignment. A punch with an outstretched arm will yank the body backward if centered by bounding box.
- **Nearest-Neighbor Sampling is Mandatory**: Any bilinear filtering (`LinearFilter`) ruins pixel art outlines and blurs color clusters.
- **Separate Screen Coordinates from World Physics**: In 2.5D, depth is Z and lateral is X. Jumping is Y elevation. Never bake Y jump movement directly into sprite pixel frames.
- **Guard Against UV Bleeding**: When packing atlases, leave at least 1 pixel of transparent gutter between adjacent frames to prevent texture bleeding under mipmap/perspective rendering.
- **Always Test Against Light and Dark Backgrounds**: Transparent edges can hide dark fringe artifacts or missed background color fills.
- **Never Claim Source Authenticity Without Evidence**: If timings or frames are reconstructed from visual memory, document them explicitly as estimated.

---

## Reference Navigation

| Task | Document to Read |
|---|---|
| Creating original Kunio-style characters, palettes, modular heads, and frame timing | `references/art-direction.md` |
| Detailed JSON manifest specification, coordinate math, and validator rules | `references/pipeline.md` |
| Historical hardware, sprite architecture, TCRF/DataCrystal links, and verified vs estimated evidence | `references/source-research.md` |
| Bundled runtime, canvas player, Three.js adapter, sample assets & test suite | `assets/README.md` and `assets/tests/` |
| Interactive demonstration workbench & visual parity inspector | `demo/README.md` and `demo/index.html` (Run: `npm run demo`) |
| Reference packaging and architecture benchmark | https://3d.internet.dev/ |
