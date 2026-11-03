# River City / Kunio-kun Three.js Sprite Workshop & Runtime

Interactive demonstration, visual inspector, and 2.5D belt-scroll runtime toolkit for River City Ransom / Kunio-kun style pixel-art character sprites in 2D Canvas and Three.js.

## 🚀 Live Demo on GitHub Pages

Experience the live interactive workshop and 2.5D runtime directly in your browser:
👉 **[https://hiteq.github.io/create-rivercity-threejs-sprite/](https://hiteq.github.io/create-rivercity-threejs-sprite/)**

### Interactive Features
- **Authentic NES Sprite Graphics**: 100.0000% bit-exact pixel parity reconstructed from original *River City Ransom* NES character sprite data (Alex/Kunio & Ryan/Riki).
- **Dual Viewport**: Real-time side-by-side synchronized 2D pixel canvas and Three.js 2.5D WebGL scene with orbit camera controls.
- **Action Suite**: Idle, Walk, Punch, Kick, Hurt, and Knockdown animations with 60Hz NES tick timing accuracy.
- **Sprite Sheet Atlas Inspector**: Interactive hover inspection of frame bounds, anchor points, and hitboxes.
- **Ground Anchor Discipline**: Sole-anchor alignment `[16, 39]` ensuring zero horizontal or vertical drift when flipping directions or striking.
- **Three Character Presets**: Alex / Kunio (10-Frame Suite), Ryan / Riki (10-Frame Rival Suite), and Alex / Kunio (4-Frame Baseline).

## 📦 Directory Structure

- `create-rivercity-threejs-sprite/`
  - `assets/`: Reusable runtime classes (`SpritePlayer`, `CanvasSpriteRenderer`, `ThreeSpriteAdapter`, `validateManifest`), authentic NES reference atlas, and sample assets.
  - `demo/`: Static demo application with Three.js vendor dependencies and CSS styling.
  - `evals/`: Skill evaluation prompts and criteria.
  - `references/`: Architectural documentation, pipeline guides, source research, and art direction rules.
  - `SKILL.md`: Complete skill specification.

## 🧪 Local Verification & Tests

Run the test suite (33 automated tests including 100% pixel parity verification):
```bash
npm test
```

Start local demo server:
```bash
npm run demo
```
Navigate to `http://127.0.0.1:8080/`.

## 📜 License
MIT
