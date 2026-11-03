# Asset Notice & Provenance: River City Ransom Authentic Sprites

## 1. Provenance and Authenticity
- **Game Title**:
  - North America: *River City Ransom* (NES, 1990)
  - Japan: *Downtown Nekketsu Monogatari* (다운타운 열혈물어 / ダウンタウン熱血物語) (Famicom, April 25, 1989)
- **Original Developer / Publisher**: Technōs Japan Corp.
- **Current Rights Holder**: **Arc System Works Co., Ltd.**
  - Arc System Works officially acquired all intellectual property rights and assets of Technōs Japan Corp. (including the *Kunio-kun* and *Double Dragon* franchises) from Million Co., Ltd. effective June 1, 2015.
- **Character Identities**:
  - `sample-expanded-character.png` & `sample-character.png`: **Alex (Kunio / 国夫)**, the primary playable protagonist. Wears the iconic white school uniform jacket (Gakuran / 白学ラン) with blue pants and classic pompadour hairstyle.
  - `sample-ryan-character.png`: **Ryan (Riki / 力)**, Player 2 and rival brawler. Wears the signature full blue school uniform (青学ラン) palette swap.
- **Source Material**:
  - Original 8-bit Ricoh 2C02 PPU sprite tiles extracted from NES *River City Ransom* CHR-ROM memory / sprite rip atlas (`alex.png` and `alex.json`, 75 sprite frames).
  - Native palette colors verified:
    - `#050505` (NES Black outline & dark hair, PPU palette index $0F)
    - `#fc7460` (NES Warm peach skin tone, PPU palette index $27)
    - `#ffffff` (NES Crisp white jacket, eyes & teeth, PPU palette index $30)
    - `#0070ec` (NES Vibrant blue uniform pants & Ryan jacket, PPU palette index $12)
- **Pixel-for-Pixel Parity Audit**:
  - `sample-expanded-character.png`: 4,661 out of 4,661 non-transparent character pixels match the original NES sprite frames with **100.0000% parity** (0 mismatches).
  - `sample-character.png`: 1,811 out of 1,811 non-transparent character pixels match the original NES sprite frames with **100.0000% parity** (0 mismatches).
  - Bounded in modular $32 \times 40$ px cells with ground contact anchor at `[16, 39]` for standard 2.5D belt-scroll runtime anchoring.

## 2. Animation Sequences & Hardware Timing
- **Hardware PPU Mode**: The original NES hardware renders characters via $8 \times 16$ PPU hardware sprites composited dynamically into metasprites ($16 \times 32$ upright stance, up to $25 \times 32$ during extended strikes).
- **Animation Timings**:
  - **Walk Cycle** (133ms / 8 ticks at 60Hz per step): `walk-0` (stride 1) $\rightarrow$ `idle-0` (passing) $\rightarrow$ `walk-1` (stride 2) $\rightarrow$ `idle-0` (passing).
  - **Punch Strike** (Straight punch): `punch-0` (windup, 67ms) $\rightarrow$ `punch-1` (strike with extended fist, 133ms) $\rightarrow$ `punch-0` (recovery, 67ms).
  - **Kick Strike** (Thrust kick): `kick-0` (chamber, 80ms) $\rightarrow$ `kick-1` (thrust extension, 150ms) $\rightarrow$ `kick-0` (recovery, 80ms).
  - **Hurt / Stun**: `hurt-0` (250ms), classic open-mouthed grimace and head recoil.
  - **Down / Knockdown**: `down-0` (600ms), horizontal flat-on-back fall.

## 3. Scope & Known Limitations
- The sample suites (`sample-character.png` 4 frames and `sample-expanded-character.png` 10 frames) extract the core beat-em-up combat and navigation loop to maintain lightweight delivery and instant web loading.
- Advanced maneuvers (e.g. Stone Hands / Mach Punch, Dragon Feet / Mach Kick, Acro Circus somersaults, weapon wielding with chains and trash cans) are contained in the full 75-frame atlas `alex.png` and can be mapped into expanded manifests as needed.
