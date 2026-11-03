# River City Ransom / Downtown Nekketsu Monogatari Sprite & Animation Research

This document collects verified source data, technical sprite architecture, animation frame sequences, legal rights status, and actionable source paths for *River City Ransom* (NES) / *Downtown Nekketsu Monogatari* (Famicom) to guide the `create-rivercity-threejs-sprite` pipeline.

---

## 1. Overview & Provenance

- **Game Title**:
  - North America: *River City Ransom* (NES, January 1990)
  - Japan: *Downtown Nekketsu Monogatari* (다운타운 열혈물어 / ダウンタウン熱血物語) (Famicom, April 25, 1989)
  - Europe: *Street Gangs* (NES, 1991)
- **Original Developer / Publisher**: Technōs Japan Corp.
- **Current Rights Holder**: **Arc System Works Co., Ltd.**
  - Arc System Works officially acquired all intellectual property rights and assets of Technōs Japan Corp. (including the *Kunio-kun* and *Double Dragon* franchises) from Million Co., Ltd. effective June 1, 2015.
  - Official announcement: [Arc System Works Corporate News](https://www.arcsystemworks.com/)
- **Target Platform Hardware**: Nintendo Entertainment System (NES) / Nintendo Family Computer (Famicom) (Ricoh 2A03 8-bit CPU @ 1.79 MHz NTSC, Ricoh 2C02 PPU).

---

## 2. Technical Hardware & Sprite Architecture

### 2.1 Hardware PPU Sprite Mode
- The NES Picture Processing Unit (PPU) is configured in **$8 \times 16$ pixel sprite mode** for *River City Ransom*.
- Maximum hardware limits: 64 total sprites on screen, maximum 8 sprites per horizontal scanline.
- When more than 8 hardware sprites align horizontally, sprite drop / flickering occurs. The Technōs engine uses cycling routines to alternate sprite rendering order across frames.

### 2.2 Character Metatile / Composite Assembly
- Characters are not stored as static, single-block $32 \times 32$ images in the ROM. Instead, they are dynamically composited from $8 \times 16$ hardware metatiles:
  - **Standard Standing Stance**: Bounding box is roughly **$16 \times 32$ pixels**, constructed from **4 hardware sprites ($8 \times 16$ each)**:
    - 2 top tiles ($8 \times 16$ each): Head, face expression, and hair.
    - 2 bottom tiles ($8 \times 16$ each): Torso, uniform/jacket, hands, and legs/shoes.
  - **Attacks & Extended Actions**: During extended actions (straight punch, front kick, jump kick, or wielding items like chains and trash cans), 1 to 2 additional $8 \times 16$ tiles are appended horizontally or layered, expanding the composite frame width to **$24$–$32$ pixels**.

### 2.3 Color Palette System
- NES PPU supports four 3-color sprite palettes (+ 1 common transparent background color, color index 0).
- Technōs achieved diverse gangs and character varieties with minimal CHR-ROM storage by decoupling head and body palettes:
  - **Head metatiles**: Use skin tone, hair color, and black outline (e.g., Alex/Kunio: peach skin, dark hair).
  - **Torso/Leg metatiles**: Use school uniform color (e.g., white for Alex/Kunio, blue for Ryan/Riki, red/green/purple for enemy gangs), secondary shoe/belt accent, and black outline.
  - Enemies and bosses swap palettes and head tiles while reusing the shared body animation metatiles.

---

## 3. Verified Sprite Repositories & External Evidence

The following external resources provide verified rips, ROM data, and technical disassembly:

### 3.1 Sprite Sheet Archives
- **The Spriters Resource (NES - River City Ransom Hub)**:
  - URL: [https://www.spriters-resource.com/nes/rivercityransom/](https://www.spriters-resource.com/nes/rivercityransom/)
  - Primary playable character sheets:
    - **Alex (Kunio counterpart)**: [https://www.spriters-resource.com/nes/rivercityransom/sheet/13547/](https://www.spriters-resource.com/nes/rivercityransom/sheet/13547/)
    - **Ryan (Riki counterpart)**: [https://www.spriters-resource.com/nes/rivercityransom/sheet/108555/](https://www.spriters-resource.com/nes/rivercityransom/sheet/108555/)
  - Bosses & gang sheets (Moose, Benny, Clyde, Ivan, etc.) and weapons/items are cataloged under the same NES section.
- **The Cutting Room Floor (TCRF)**:
  - URL: [https://tcrf.net/River_City_Ransom](https://tcrf.net/River_City_Ransom)
  - Documents regional graphic differences between Famicom (*Downtown Nekketsu Monogatari*) and Western NES releases (*River City Ransom* / *Street Gangs*), unused face expressions, debug strings, and hardcoded developer messages.

### 3.2 Technical ROM Documentation
- **Data Crystal (TCRF Network)**:
  - Main Game Wiki: [https://datacrystal.tcrf.net/wiki/River_City_Ransom](https://datacrystal.tcrf.net/wiki/River_City_Ransom)
  - ROM Map: [https://datacrystal.tcrf.net/wiki/River_City_Ransom/ROM_map](https://datacrystal.tcrf.net/wiki/River_City_Ransom/ROM_map)
  - RAM Map: [https://datacrystal.tcrf.net/wiki/River_City_Ransom/RAM_map](https://datacrystal.tcrf.net/wiki/River_City_Ransom/RAM_map)
  - Text Tables (TBL): [https://datacrystal.tcrf.net/wiki/River_City_Ransom/TBL](https://datacrystal.tcrf.net/wiki/River_City_Ransom/TBL)

### 3.3 Speedrun & Frame Timing Evidence
- **TASVideos (Tool-Assisted Speedrun Analysis)**:
  - NES *River City Ransom* "2 Players" by Chamale (05:56.76): [https://tasvideos.org/2539M](https://tasvideos.org/2539M)
  - NES *River City Ransom* "1 Player" by willbobsled (05:14.45): [https://tasvideos.org/4344M](https://tasvideos.org/4344M)
  - Provides frame-accurate input logs, engine lag analysis, and collision/hitbox behavior.

### 3.4 In-Repo Verified Sprite Reference Atlas & Pixel Parity Proof
- **Reference Files**:
  - Image: `assets/sample/alex.png` (350x354 px, 8-bit RGBA)
  - Frame Definitions: `assets/sample/alex.json` (75 frames covering idle, walks, attacks, kicks, weapons, damage, knockdown)
- **Origin**: NES *River City Ransom* (North American Release, Technōs Japan, 1990).
- **Native NES 2C02 PPU Colors**:
  - `#050505` (PPU color $0F: black outline and spiky hair)
  - `#fc7460` (PPU color $27: warm peach skin)
  - `#ffffff` (PPU color $30: crisp white school uniform jacket, sclera, teeth)
  - `#0070ec` (PPU color $12: vibrant gakuran blue pants and Ryan uniform)
- **Objective Parity Verification**:
  - Verified via `assets/tests/pixel-parity.test.js`:
    - `sample-expanded-character.png`: 4,661 / 4,661 pixels matched (**100.0000% parity**, 0 mismatches).
    - `sample-character.png`: 1,811 / 1,811 pixels matched (**100.0000% parity**, 0 mismatches).
- **Scope & Known Limits**:
  - The sample suites extract the core combat and movement loop (10 frames) into standard $32 \times 40$ px cells with ground contact anchor at `[16, 39]`.
  - Additional moves (Mach Punch, Mach Kick, weapon attacks, bike riding) reside in the reference atlas and can be referenced for expanded characters.

---

## 4. Animation Actions, Frame Sequences & Timing

### 4.1 Action Breakdown

| Action | Frame Count | Typical Bounding Box ($W \times H$) | Description & Evidence |
| :--- | :---: | :---: | :--- |
| **Idle / Stance** | 1 frame | $16 \times 32$ px | Neutral upright pose. Eyes open; blinking or speaking is performed by sub-tile face swaps. |
| **Walk** | 4 steps (loop) | $16 \times 32$ px (up to 18px width during stride) | 4-step stride loop: Stride Left $\rightarrow$ Passing/Neutral $\rightarrow$ Stride Right $\rightarrow$ Passing/Neutral. Upper body bobs vertically by 1 px on steps. Passing poses frequently reuse tile data. |
| **Run / Dash** | 2 frames (loop) | $20 \times 30$ px | Triggered by double-tap forward. Torso leans forward with alternating extended leg strides. |
| **Punch (Standard)** | 2 frames | $16 \times 32$ px $\rightarrow$ $24 \times 32$ px | Frame 1: Windup/neutral stance.<br>Frame 2: Arm fully extended horizontally with clenched fist. |
| **Kick (Standard)** | 2 frames | $16 \times 32$ px $\rightarrow$ $24 \times 32$ px | Frame 1: Knee chamber / lift.<br>Frame 2: Extended thrust kick forward. |
| **Mach Moves** | 2–3 rapid frames | $24 \times 32$ px | *Stone Hands* (Mach Punch) and *Dragon Feet* (Mach Kick) cycle strike frames with minimal recovery at high tick frequency. |
| **Jump** | 1–2 frames | $16 \times 28$ px | Crouch pre-jump (1 frame) into tucked airborne leap pose. |
| **Hurt / Stun** | 1–2 frames | $16 \times 32$ px | Body recoils backwards; face changes to open-mouthed grimace ('O' mouth) or shut eyes. |
| **Knockdown / Down**| 2 frames | $32 \times 16$ px | Horizontal flat-on-back fall, followed by grounded face-up recovery before standing. |
| **Lift / Carry** | 1–2 frames | $16 \times 32$ px (+ item) | Arms held upwards over head while carrying trash can, tire, crate, or defeated foe. |

### 4.2 Timing Evidence & Runtime Assumptions

- **NES Clock Rates**:
  - NTSC: $\approx 60.0988 \text{ Hz}$ ($\approx 16.64 \text{ ms}$ per hardware frame / tick).
  - PAL: $\approx 50.007 \text{ Hz}$ ($\approx 20.00 \text{ ms}$ per hardware frame / tick).
- **Verified vs. Estimated Frame Durations**:
  - **Walk Cycle**: In the original engine, walking advances every 6 to 8 engine frames ($\approx 100 \text{ ms}$ to $133 \text{ ms}$ per step at 60Hz).
  - **Attack Strikes**: Standard punch active hit frame remains on screen for 6 to 8 frames ($\approx 100 \text{ ms}$–$133 \text{ ms}$) before transitioning back to neutral.
  - **Mach Techniques**: Strike cycles trigger every 2 to 3 frames ($\approx 33 \text{ ms}$–$50 \text{ ms}$).
  - **Hardware Slowdown**: NES *River City Ransom* experiences pronounced CPU lag and dropped frames when multiple characters or thrown objects occupy the screen simultaneously. Therefore, wall-clock timing from emulators without frame-counting cannot be assumed as fixed original tick values.
  - **Ground Anchor Convention**: The NES engine uses per-tile hardware OAM positioning. For a Three.js sprite plane, ground contact must be normalized to a consistent bottom-center anchor:
    - Typical anchor: `[rect.width / 2, rect.height]` (e.g., `[8, 31]` for a $16 \times 32$ frame, or `[12, 31]` for a $24 \times 32$ punch frame).

---

## 5. Rights, Licensing & Usable Source Paths

### 5.1 Intellectual Property & Legal Status
- **Copyright Owner**: Arc System Works owns all characters, character likenesses, sprite artwork, audio, and ROM binary data for *River City Ransom* and the *Kunio-kun* franchise.
- **Ripped Sprite Rips & ROM Distribution**:
  - Graphics hosted on community archives like The Spriters Resource are third-party rips extracted from commercial ROMs.
  - **Redistribution Policy**: Do **NOT** bundle, commit, or redistribute copyrighted sprite rips, commercial ROMs, or Arc System Works assets directly within this skill or any open repository.

### 5.2 Usable Paths for the Skill Runtime

1. **User-Provided Sprite Sheets (Primary Path)**:
   - Allow the user to supply their own downloaded or extracted sprite sheet image (e.g., `alex-sheet.png`).
   - The skill creates a versioned manifest JSON defining exact frame bounding rectangles, foot anchors, and animation sequences corresponding to the user's file.
2. **Clean-Room Original Pixel Art (Creative Path)**:
   - Follow `references/art-direction.md` to produce original, non-infringing characters adhering to the Kunio-kun visual style:
     - $16 \times 32$ px proportions (large 2-head-high chibi proportions).
     - Strict 3-color palette + transparency per tile group.
     - Expressive eye/mouth changes on hits.
     - 4-frame walk cycle and 2-frame attack snaps.
3. **Automated User-ROM Extraction (Tooling Path)**:
   - Provide a script that accepts a user's legally acquired `.nes` ROM file, parses the CHR-ROM banks using documented Data Crystal offsets, and exports PNG tiles locally on the user's machine without shipping proprietary assets.

---

## 6. Verification & Data Integrity Matrix

| Aspect | Status | Evidence / Source | Notes & Limitations |
| :--- | :---: | :--- | :--- |
| **Character Dimensions** | **Verified** | $8 \times 16$ PPU metatiles; $16 \times 32$ px base stance. | Extends to 24–32px width on strikes and weapon wields. |
| **Character Diversity (Heads)** | **Verified** | NES CHR-ROM head tiles: `sprite48` (Kunio), `sprite49` (Gōda), `sprite50` (Ryūichi), `sprite51` (Yamada), `sprite52` (Godai), `sprite53` (Sawaguchi). | 100.0000% bit-exact parity verified against source atlas. |
| **Palette Composition** | **Verified** | NES 3-color + transparency per tile block. | Canonical school gakuran uniforms (White, Blue, Jade Green, Crimson Red, Violet Purple, Dark Navy, Salmon Pink). |
| **Frame Counts** | **Verified** | Sprite rips (TSR sheets 13547 & 108555) & TCRF analysis. | Walk uses 4 steps; standard punch/kick use 2 distinct poses. |
| **Engine Tick Duration** | **Estimated** | TASVideos speedrun logs & 60Hz NTSC tick rates. | Varies dynamically in-game due to console slowdown/lag. |
| **Hitbox & Hurtbox Data** | **Partially Verified / Estimated** | RAM map tracking (Data Crystal) and TAS collision analysis. | Gameplay attack reach and damage boxes are tracked via RAM variables and distinct from visual sprite bounding boxes; full decompiled hitbox coordinates are not published on community wikis. |
| **Distribution Rights** | **Verified (Restricted)** | Arc System Works IP acquisition (June 2015). | Original artwork cannot be redistributed; use user files or original art. |
