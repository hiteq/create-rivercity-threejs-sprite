# Art Direction: River City & Kunio-kun Sprite Design

This guide defines the visual language, proportions, palette rules, and animation principles for creating authentic *River City Ransom* (*Downtown Nekketsu Monogatari* / 열혈 시리즈) style pixel art and adapting it cleanly into modern 2D and Three.js runtimes.

---

## 1. Visual Identity & Anatomy

Characters in the Kunio-kun universe feature a signature "delinquent Chibi / SD (Super Deformed)" aesthetic: tough, comedic, and instantly readable.

### Proportions & Silhouette
- **Height**: 32 to 36 pixels tall for standard high school delinquents (up to 40 pixels for characters with exaggerated pompadours or imposing boss silhouettes like Yamada, Gouda, or Double Dragon twins).
- **Head Ratio**: 2.0 to 2.5 heads tall total. The head is huge—occupying approximately 14–16 pixels wide by 14–18 pixels high (~40–45% of total sprite height).
- **Torso & Shoulders**: Sturdy, boxy torso (10–14 pixels wide, 8–10 pixels high). Broad shoulders suggest physical grit despite the miniature proportions.
- **Limbs**:
  - **Arms**: Thick, stubby 3–4 pixel wide limbs. Fists are exaggerated (4–6 pixels wide) to give impact to punches.
  - **Legs**: Short, wide-stance legs (8–10 pixels long) wearing baggy trousers (*bantan* / gakuran slacks) tapering into chunky rounded loafers or sneakers (6–8 pixels wide, 3–4 pixels high).
- **Outlines**:
  - Continuous, solid 1-pixel dark contour (pure black `#000000` or deep navy `#141824`).
  - No semi-transparent pixels or sub-pixel antialiasing along edges. Contours must be 1-bit crisp.
  - Avoid orphan pixels ("jaggies"); use clean 1-pixel step clusters.

---

## 2. Color Palette & Hardware Constraints

Authentic River City artwork is grounded in NES (Famicom) hardware limits. Even when building for modern Three.js engines, observing these constraints preserves the nostalgic visual identity.

### The NES 3+1 Color Rule
On the original Famicom, each 16×16 attribute cell could use only 3 opaque colors plus 1 transparent color. The Kunio series achieved rich character detail by compositing two hardware sprite layers:

1. **Head & Skin Layer**:
   - Color 1: Contour / Hair Outline (`#000000` Black)
   - Color 2: Skin Base (`#FCE0A8` Peach / Cream)
   - Color 3: Skin Shadow / Eye White (`#E09858` Warm Amber or `#FFFFFF` White for eye sclera)
2. **Body & Uniform Layer**:
   - Color 1: Contour / Seam Outline (`#000000` Black)
   - Color 2: Uniform Primary Color (e.g. `#FFFFFF` White or `#2038EC` Blue)
   - Color 3: Uniform Shadow / Accent (`#A0A0A0` Cool Gray or `#001088` Deep Navy)

### Color Indexing & Palette Swapping
Organize your sprite palette into 5–6 standardized indexed slots:
`[0: Transparent, 1: Outline, 2: Skin Base, 3: Skin Shadow, 4: Uniform Base, 5: Uniform Shadow, 6: Accent]`

By remapping slots 4 and 5, you can instantly generate rival schools and gang factions:
- **Nekketsu High (Kunio)**: White gakuran (`#FFFFFF` base, `#A4A4A4` shadow).
- **Hanazono High (Riki)**: Royal blue gakuran (`#2038EC` base, `#001088` shadow).
- **Reihou Academy**: Crimson / Maroon jacket (`#C82000` base, `#700800` shadow).
- **Senridai High**: Olive green uniform (`#487800` base, `#204000` shadow).
- **Casual / Street Wear**: T-shirt and blue jeans (`#F0F0F0` shirt, `#2858B8` denim, `#182870` denim shadow).

### Shading Discipline
- **Directional Lighting**: Light source is traditionally top-left.
- **No Pillow Shading**: Do not shade inward from every outline. Use clear planar shadow blocks (e.g. under the chin, beneath the jacket hem, between the legs).
- **Color Contrast**: Ensure at least a 30% brightness delta between base tones and shadow tones to preserve readability at 1x resolution.

---

## 3. Modular Head & Facial Expressions

The defining genius of River City Ransom is its comedic, modular facial expressions. The head acts as an emotional focal point swapped onto body poses.

### Iconic Facial Archetypes
| Expression | Visual Design | When to Use |
|------------|---------------|-------------|
| **Determined (기본/결의)** | Narrowed eyes (2px dark pupil with 1px brow slant), tight closed mouth. | Idle, Walk, Aiming, Guard. |
| **Attack Shout (기합/공격)** | Furrowed brows, open mouth (2×2px dark center with 1px white tooth outline). | Punch, Kick, Throwing items. |
| **Hit Shock (피격 충격)** | Giant circular white eyes (`O_O`, 3×3px), gaping vertical oval mouth (3×4px). Hair kicked slightly back. | Taking damage, gut punch, wall collision. |
| **Groggy / Knockout (실신/다운)** | Swollen lump on cheek, spiral or "X" eyes, tongue sticking out sideways. | Downed on ground, dizzy state, KO. |
| **Delinquent Smirk (도발)** | Asymmetric mouth grin (1px angled slit), raised single eyebrow. | Victory taunt, intro sequence. |

> **Implementation Tip**: Align the neck pivot point across all facial variants so expressions can be dynamically layered onto standard body animation frames without re-drawing the entire torso.

---

## 4. Beat-Em-Up Animation Vocabulary & Timing

Beat-em-up animations demand punchy, asymmetric timing. Never use linear tweening or uniform durations across frames. 

Use 60Hz tick intervals: **4 ticks (~67ms)**, **6 ticks (~100ms)**, **8 ticks (~133ms)**, **12 ticks (~200ms)**.

```
                    PUNCH TIMING CURVE
Frame 0: Anticipation (4 ticks / 67ms)    [Short windup]
Frame 1: Active Strike (8 ticks / 133ms)   [HOLD: Maximum extension, hit spark]
Frame 2: Recovery    (4 ticks / 67ms)    [Quick snapback to idle]
```

### Action Choreography

#### 1. Idle Stance (1–2 frames, loop)
- **Frame 0 (Stance)**: Feet slightly wider than shoulder width, fists held near chest (160ms–240ms).
- **Frame 1 (Breathing/Bob)**: Head and shoulders dip 1 pixel down, knees flex slightly (120ms–160ms). *Optional: 1-frame static stance is also faithful to original NES games.*

#### 2. Walk Cycle (4 frames, loop)
- **Frame 0 (Right Contact)**: Right foot forward, left foot back. Left arm swings forward. (133ms / 8 ticks)
- **Frame 1 (Passing/Recoil)**: Feet meet at center, body lifts 1px, right heel lifts. (133ms / 8 ticks)
- **Frame 2 (Left Contact)**: Left foot forward, right foot back. Right arm swings forward. (133ms / 8 ticks)
- **Frame 3 (Passing/Recoil)**: Feet meet at center, body lifts 1px, left heel lifts. (133ms / 8 ticks)
- *Total cycle*: ~533ms. Must have a distinct bouncy bobbing rhythm.

#### 3. Run / Dash (2–3 frames, loop)
- Torso pitches forward 3–4 pixels. Arms pump aggressively. Back leg kicks up behind at 45°.
- Fast timing: 80ms–100ms per frame.

#### 4. Standard Punch / Straight (3 frames, one-shot)
- **Frame 0 (Windup)**: Fist draws back against ribcage, shoulder rolls inward (67ms).
- **Frame 1 (Impact)**: Giant fist (5×5px) thrust fully outward, front foot stomps down, generates hit event (133ms).
- **Frame 2 (Retract)**: Fist pulls back halfway (67ms).

#### 5. Mach Punch (마하펀치) (4 frames, high-speed loop)
- Rapid alternating left and right punches with horizontal white/skin motion trails extending from knuckles.
- Ultra-fast timing: 50ms–67ms per frame (3–4 ticks).

#### 6. Jump & Flying Dropkick (2–3 frames)
- **Frame 0 (Ascent)**: Knees tucked tight to chest, arms raised.
- **Frame 1 (Peak / Dropkick)**: Body tilted horizontally, one leg extended fully forward, other tucked underneath.
- **Frame 2 (Landing)**: Deep crouch compression (67ms) before recovering to stance.

#### 7. Hurt & Stagger (2 frames, one-shot)
- **Frame 0 (Heavy Impact)**: Head snaps backward, torso arcs backward, iconic "Hit Shock" face active (133ms–160ms).
- **Frame 1 (Rebound)**: Weight shifts slightly forward as character regains footing (100ms).

#### 8. Knockdown & Ground Sprawl (3–4 frames)
- **Frame 0 (Airborne Tumbler)**: Body spinning horizontally through the air (120ms).
- **Frame 1 (Ground Impact)**: Slams onto back with small dust puff / bounce (80ms).
- **Frame 2 (Flat Down)**: Sprawled completely flat on floor, face up or down (held for 600ms–1200ms depending on KO state).
- **Frame 3 (Get-up)**: Pushing up to hands and knees, rising back into fighting stance (160ms).

---

## 5. Foot Anchor & Pivot Discipline

In a 2.5D belt-scroll environment (Three.js or Canvas), the **Foot Anchor (Pivot)** is the sacred point of ground contact.

```
+-------------------+
|     (Head)        |
|     [O_O]         |
|     / | \         |
|      / \          |
|     L   R         |
+---------*---------+  <--- Anchor Point [anchorX, anchorY]
        (Pivot)             Must be at the ground sole level!
```

### Why Bounding-Box Centering Ruins Animation
- During a punch, an outstretched fist adds 8 pixels of width to the front of the frame.
- If you center sprites using bounding-box centers, the character will visibly slide **backward** when punching!
- **Strict Rule**: Always define the anchor relative to the sole contact point between the feet. The anchor must remain stationary on the ground plane across idle, walk, and attack animations.
- During jumping or airborne knockdown, the anchor remains on the projected ground shadow below the unit, or vertical displacement is driven by the physics/engine Y-coordinate.

---

## 6. Step-by-Step Character Creation Workflow

1. **Step 1: Silhouette Block-out (1x Scale)**
   - Open your pixel editor (Aseprite, Photoshop, etc.) with a 32×36 canvas.
   - Use a single solid dark color to block out head volume, torso, and stance width.
   - Test readability at 100% zoom. If the silhouette does not look instantly recognizable, adjust before detailing.
2. **Step 2: Head & Face Sculpting**
   - Carve the iconic jawline and pompadour/hair fringe.
   - Place the eye line roughly 1/3 from the bottom of the head.
   - Build both the "Determined" and "Hit Shock" faces to confirm head geometry.
3. **Step 3: Palette Application & Color Blocking**
   - Fill base skin (`#FCE0A8`) and uniform (`#FFFFFF` or school color).
   - Add 1-pixel shadow accents under the hair fringe, neck, jacket hem, and crotch.
   - Keep total color count under 6 colors.
4. **Step 4: Keyframe Animation Drafting**
   - Draw key extremes for Walk (Contact frames) and Punch (Impact frame).
   - Ensure the ground anchor position remains fixed on the canvas coordinate grid.
5. **Step 5: In-betweening & Timing Assignment**
   - Draw intermediate passing frames.
   - Assign NES 60Hz tick durations (67ms, 133ms, etc.).
6. **Step 6: Atlas Assembly & JSON Manifest Generation**
   - Pack frames into an atlas image with 1-pixel transparent gutters to avoid texture bleeding.
   - Record exact bounding rectangles `[x, y, w, h]` and anchor coordinates `[ax, ay]`.
7. **Step 7: Verification**
   - Inspect at 1x, 2x, 3x, and 4x nearest-neighbor scaling.
   - Check against light (`#E0E0E0`) and dark (`#202020`) backgrounds.
   - Verify that feet stay firmly planted during combat actions.

---

## 7. Common Mistakes & Quality Checklist

| Defect | Root Cause | Proper Fix |
|--------|------------|------------|
| **Pillow Shading** | Shading along the inner contour of every body part. | Choose a single directional light source (top-left) and paint bold geometric shadow blocks. |
| **Foot Skating / Jitter** | Changing anchor coordinates between animation frames. | Align all standing frame anchors to the exact floor contact point. |
| **Linear "Tween" Sluggishness** | Giving every frame the exact same 100ms duration. | Use snappy anticipation (67ms), lingering impact hold (133ms), and fast recovery (67ms). |
| **Blurry Edges in Three.js** | Bilinear texture filtering enabled. | Set `magFilter = THREE.NearestFilter` and `minFilter = THREE.NearestFilter`. |
| **Sub-pixel Halos** | Antialiased brush used in pixel editor. | Use hard 1-pixel pencil with 100% opacity. Sprite outline must be 1-bit crisp. |
| **Incorrect Head Scale** | Drawing realistic 7-head tall anatomy. | Reset to 2.0–2.5 head proportions. The head must be massive and expressive. |
