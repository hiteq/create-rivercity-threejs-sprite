# Sprite pipeline

## Source and catalog

Record game, platform, release, character, source URL or local path, license/rights status, access date, and which frames and timings are verified. A visible sprite sheet alone rarely proves animation order or duration: capture a video, game observations or trustworthy documentation when exact timing matters. Keep derived estimates identifiable.

## Manifest contract

Use a versioned JSON manifest. Example coordinates are illustrative, not original game data:

```json
{
  "version": 1,
  "image": "character.png",
  "frames": {
    "idle-0": {"rect": [0, 0, 32, 40], "anchor": [16, 39]}
  },
  "animations": {
    "idle": {"loop": true, "frames": [{"frame": "idle-0", "durationMs": 160}]}
  }
}
```

Rectangles are x, y, width, height in image pixels; anchors are relative to the rectangle's top-left and represent the ground contact. Frame durations are positive milliseconds. Define coordinate origin, facing direction and mirror axis. Events belong to frame entries, with explicit names and timing. Add hitboxes only if the task needs them and distinguish invented gameplay hitboxes from source evidence. For horizontal mirroring, transform the image around the anchor, including any event/hitbox coordinates.

## Implement and check

Validate positive integer rectangles within image bounds, existing frame references, positive finite durations, valid anchors, nonempty sequences, and supported fields. Include actionable error messages. Use the same animation clock for 2D and 3D; specify how seek, reset, looping and large time steps affect events. Test boundaries and multiple crossed frames. Use transparent material and nearest texture filtering for a Three.js plane; consider alpha test, depth sorting and camera projection in the actual scene. Keep texture orientation and UV edges correct to avoid neighboring-cell bleeding. Test multiple sprites and camera angles where required.

## Deliver

Provide manifest, atlas if rights allow, preview, runtime, validator, source notes and instructions. Include what is verified, what is estimated, missing assets, and exact commands used to run and check the project. A single invented sample does not constitute a decoded series catalog.
