/**
 * create-rivercity-threejs-sprite Assets Runtime & Validation Kit
 */

const { validateManifest, assertValidManifest } = require('./validator');
const { SpritePlayer } = require('./runtime');
const { CanvasSpriteRenderer, CanvasAnimationPlayer } = require('./canvas-player');
const { ThreeSpriteAdapter } = require('./three-adapter');

module.exports = {
  // Validator
  validateManifest,
  assertValidManifest,

  // Core Runtime
  SpritePlayer,

  // 2D Canvas
  CanvasSpriteRenderer,
  CanvasAnimationPlayer,

  // 3D Three.js Adapter
  ThreeSpriteAdapter
};
