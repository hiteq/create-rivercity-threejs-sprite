# River City / Kunio-kun Three.js Sprite Workshop & Runtime

Interactive demonstration, visual inspector, and 2.5D belt-scroll runtime toolkit for River City Ransom / Kunio-kun style pixel-art character sprites in 2D Canvas and Three.js.

## 🚀 Live Demo on GitHub Pages

Experience the live interactive workshop and 2.5D runtime directly in your browser:
👉 **[https://hiteq.github.io/create-rivercity-threejs-sprite/](https://hiteq.github.io/create-rivercity-threejs-sprite/)**

### Interactive Features
- **Authentic NES Sprite Diversity (7 Characters)**: Verified head and palette differentiation derived from community NES reference atlas (`alex.png` and `alex.json`, The Spriters Resource):
  1. **Alex / Kunio (くにお)**: Nekketsu High School (White Gakuran jacket & Royal Blue pants, classic Pompadour, `sprite1` & `sprite48`).
  2. **Ryan / Riki (りき)**: Hanazono High School (Full Royal Blue Gakuran uniform, distinct Regent Pompadour & sharp slant eyes, `sprite50` & `sprite58` with 40px head delta vs Alex).
  3. **Ivan / Tsuyoshi Gōda (剛田 剛)**: Hōryō High School Boss (Dark Jade Green uniform, straight-cut fringe bangs, `sprite49` & `sprite57`).
  4. **Randy / Ryūichi Hattori (服部 竜一)**: Reihō Academy Double Dragon (Crimson Red uniform, adapted Double Dragon curtain bangs, `sprite50_adapted`).
  5. **Slick / Taiki Yamada (山田 大樹)**: Meian High Mastermind (Deep Violet / Purple uniform, scheming slanted eyes, `sprite51` & `sprite59`).
  6. **Tex / Susumu Godai (五代 奨)**: Tanibana High Bōjutsu Boss (Dark Navy Blue uniform, spiky flattop haircut, `sprite52` & `sprite61`).
  7. **Rocko / Yasuo Sawaguchi (沢口 靖夫)**: Hakutaka Industrial High Brawler (Salmon / Coral Pink uniform, shaggy mullet hair, `sprite53` & `sprite60`).
  8. **Core Baseline**: Alex / Kunio (4-Frame Core Baseline).
- **Sequence Filmstrip & Step Inspector**: Frame-by-frame visual scrubber and step controls displaying live frame thumbnails, duration (ticks/ms), and transparent provenance classification (`SOURCED`, `ADAPTED`, `ESTIMATED`).
- **Redesigned Mobile-First Hierarchy**: Restrained neutral dark slate theme letting authentic NES character sprites be the focal point without decorative neon excess.
- **Genuine Mobile Responsiveness**: Zero horizontal overflow across viewports from 320px mobile to 4K desktop, with responsive 44px touch targets.
- **On-Screen Mobile Touch Controls**: Integrated virtual D-Pad (Up, Down, Left, Right) and combat strike buttons (Punch, Kick) allowing full 2.5D belt-scroll traversal and combat on smartphones and touch devices.
- **Interactive Character Roster**: 8 instant-switch roster chips and accessible dropdown synced in real-time.
- **Dual Viewport**: Real-time side-by-side synchronized 2D pixel canvas and Three.js 2.5D WebGL scene with orbit camera controls.
- **Action Suite**: Idle, Walk, Punch, Kick, Hurt, and Knockdown animations with 60Hz NES tick timing accuracy.
- **Head/Body Consistency Discipline**: Adheres strictly to Technōs Japan's modular $8 \times 16$ PPU metasprite composition architecture. Boss hurt/down frames transparently classified as adapted composites of shared NES combat hit geometry.
- **Ground Anchor Discipline**: Sole-anchor alignment `[16, 39]` ensuring zero horizontal or vertical drift when flipping directions or striking.
- **Sprite Sheet Atlas Inspector**: Interactive hover inspection of frame bounds, anchor points, and hitboxes.

## 📦 Directory Structure

- `create-rivercity-threejs-sprite/`
  - `assets/`: Reusable runtime classes (`SpritePlayer`, `CanvasSpriteRenderer`, `ThreeSpriteAdapter`, `validateManifest`), authentic NES reference atlas, and sample assets.
  - `demo/`: Static demo application with Three.js vendor dependencies and CSS styling.
  - `evals/`: Skill evaluation prompts and criteria.
  - `references/`: Architectural documentation, pipeline guides, source research, and art direction rules.
  - `SKILL.md`: Complete skill specification.

## 🧪 Local Verification & Tests

Run the test suite (35 automated tests including 100% pixel parity, character diversity, and combat attack parity verification):
```bash
npm test
```

Start local demo server:
```bash
npm run demo
```
Navigate to `http://127.0.0.1:8080/`.

Run automated browser verification with headless Chrome:
```bash
node create-rivercity-threejs-sprite/demo/verify-demo.js
```

## 📜 License
MIT
