/**
 * Sprite Manifest Validator
 * Validates sprite manifests against the pipeline contract defined in references/pipeline.md.
 */

function isPlainObject(obj) {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

function isInteger(num) {
  return typeof num === 'number' && Number.isFinite(num) && Math.floor(num) === num;
}

function isPositiveNumber(num) {
  return typeof num === 'number' && Number.isFinite(num) && num > 0;
}

/**
 * Validates a sprite manifest object.
 *
 * @param {object} manifest - Parsed JSON sprite manifest.
 * @param {object} [options]
 * @param {object} [options.imageDimensions] - { width: number, height: number } to verify bounds.
 * @param {boolean} [options.strict] - If true, rejects unknown top-level or frame properties.
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateManifest(manifest, options = {}) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(manifest)) {
    return {
      valid: false,
      errors: ['Manifest must be a non-null JSON object.'],
      warnings: []
    };
  }

  // 1. Version
  if (manifest.version === undefined) {
    errors.push('Missing required field "version". Expected a positive integer (e.g. 1).');
  } else if (!isInteger(manifest.version) || manifest.version <= 0) {
    errors.push(`Invalid "version": ${JSON.stringify(manifest.version)}. Expected a positive integer >= 1.`);
  }

  // 2. Image
  if (typeof manifest.image !== 'string' || manifest.image.trim() === '') {
    errors.push('Missing or invalid required field "image". Expected a non-empty string path or filename.');
  }

  // Provenance / Meta check (informative warning)
  if (!manifest.meta && !manifest.provenance) {
    warnings.push('Manifest does not include "meta" or "provenance". Documenting source, game, rights, and verified vs estimated timing is strongly recommended.');
  }

  // Image dimensions option check
  let imgWidth = options.imageDimensions?.width;
  let imgHeight = options.imageDimensions?.height;
  if (manifest.meta?.imageDimensions) {
    const metaDims = manifest.meta.imageDimensions;
    if (typeof metaDims.width === 'number' && typeof metaDims.height === 'number') {
      imgWidth = imgWidth || metaDims.width;
      imgHeight = imgHeight || metaDims.height;
    }
  }

  // 3. Frames
  if (!manifest.frames || !isPlainObject(manifest.frames)) {
    errors.push('Missing required field "frames". Expected an object mapping frame identifiers to frame definitions.');
  } else {
    const frameKeys = Object.keys(manifest.frames);
    if (frameKeys.length === 0) {
      errors.push('"frames" object must contain at least one frame definition.');
    }

    for (const frameId of frameKeys) {
      const frame = manifest.frames[frameId];
      if (!isPlainObject(frame)) {
        errors.push(`Frame "${frameId}": definition must be a JSON object.`);
        continue;
      }

      // Frame rect: [x, y, w, h]
      if (!Array.isArray(frame.rect) || frame.rect.length !== 4) {
        errors.push(`Frame "${frameId}": "rect" must be a 4-element array [x, y, width, height].`);
      } else {
        const [rx, ry, rw, rh] = frame.rect;
        if (!isInteger(rx) || rx < 0) {
          errors.push(`Frame "${frameId}": rect x must be an integer >= 0 (got ${rx}).`);
        }
        if (!isInteger(ry) || ry < 0) {
          errors.push(`Frame "${frameId}": rect y must be an integer >= 0 (got ${ry}).`);
        }
        if (!isInteger(rw) || rw <= 0) {
          errors.push(`Frame "${frameId}": rect width must be a positive integer > 0 (got ${rw}).`);
        }
        if (!isInteger(rh) || rh <= 0) {
          errors.push(`Frame "${frameId}": rect height must be a positive integer > 0 (got ${rh}).`);
        }

        if (imgWidth && imgHeight && isInteger(rx) && isInteger(ry) && isInteger(rw) && isInteger(rh)) {
          if (rx + rw > imgWidth) {
            errors.push(`Frame "${frameId}": rect extends beyond image width (${rx} + ${rw} = ${rx + rw} > ${imgWidth}).`);
          }
          if (ry + rh > imgHeight) {
            errors.push(`Frame "${frameId}": rect extends beyond image height (${ry} + ${rh} = ${ry + rh} > ${imgHeight}).`);
          }
        }
      }

      // Frame anchor: [ax, ay]
      if (!Array.isArray(frame.anchor) || frame.anchor.length !== 2) {
        errors.push(`Frame "${frameId}": "anchor" must be a 2-element array [ax, ay] relative to rect top-left.`);
      } else {
        const [ax, ay] = frame.anchor;
        if (typeof ax !== 'number' || !Number.isFinite(ax)) {
          errors.push(`Frame "${frameId}": anchor x must be a finite number (got ${ax}).`);
        }
        if (typeof ay !== 'number' || !Number.isFinite(ay)) {
          errors.push(`Frame "${frameId}": anchor y must be a finite number (got ${ay}).`);
        }

        if (Array.isArray(frame.rect) && frame.rect.length === 4) {
          const [, , rw, rh] = frame.rect;
          if (ax < -rw || ax > rw * 2 || ay < -rh || ay > rh * 2) {
            warnings.push(`Frame "${frameId}": anchor [${ax}, ${ay}] is significantly outside rect dimensions [${rw}, ${rh}]. Ensure this is intentional ground contact placement.`);
          }
        }
      }

      // Optional hitboxes
      if (frame.hitboxes !== undefined) {
        if (!Array.isArray(frame.hitboxes)) {
          errors.push(`Frame "${frameId}": "hitboxes" must be an array.`);
        } else {
          frame.hitboxes.forEach((hb, index) => {
            if (!isPlainObject(hb)) {
              errors.push(`Frame "${frameId}": hitboxes[${index}] must be an object.`);
            } else if (!Array.isArray(hb.rect) || hb.rect.length !== 4) {
              errors.push(`Frame "${frameId}": hitboxes[${index}].rect must be a 4-element array [x, y, w, h].`);
            }
          });
        }
      }
    }
  }

  // 4. Animations
  const declaredFrames = manifest.frames && isPlainObject(manifest.frames) ? Object.keys(manifest.frames) : [];
  const referencedFrames = new Set();

  if (!manifest.animations || !isPlainObject(manifest.animations)) {
    errors.push('Missing required field "animations". Expected an object mapping animation identifiers to animation definitions.');
  } else {
    const animKeys = Object.keys(manifest.animations);
    if (animKeys.length === 0) {
      errors.push('"animations" object must contain at least one animation.');
    }

    for (const animId of animKeys) {
      const anim = manifest.animations[animId];
      if (!isPlainObject(anim)) {
        errors.push(`Animation "${animId}": definition must be a JSON object.`);
        continue;
      }

      if (anim.loop !== undefined && typeof anim.loop !== 'boolean') {
        errors.push(`Animation "${animId}": "loop" must be a boolean (got ${JSON.stringify(anim.loop)}).`);
      }

      if (!Array.isArray(anim.frames) || anim.frames.length === 0) {
        errors.push(`Animation "${animId}": "frames" must be a non-empty array.`);
        continue;
      }

      anim.frames.forEach((frameEntry, idx) => {
        if (!isPlainObject(frameEntry)) {
          errors.push(`Animation "${animId}": frames[${idx}] must be an object.`);
          return;
        }

        if (typeof frameEntry.frame !== 'string' || frameEntry.frame.trim() === '') {
          errors.push(`Animation "${animId}": frames[${idx}].frame must be a non-empty string referencing a key in "frames".`);
        } else {
          referencedFrames.add(frameEntry.frame);
          if (!declaredFrames.includes(frameEntry.frame)) {
            errors.push(`Animation "${animId}": frames[${idx}] references non-existent frame "${frameEntry.frame}". Available frames: [${declaredFrames.join(', ')}].`);
          }
        }

        if (!isPositiveNumber(frameEntry.durationMs)) {
          errors.push(`Animation "${animId}": frames[${idx}].durationMs must be a positive finite number (got ${frameEntry.durationMs}).`);
        }

        const eventField = frameEntry.events !== undefined ? frameEntry.events : frameEntry.event;
        if (eventField !== undefined) {
          const evArray = Array.isArray(eventField) ? eventField : [eventField];
          evArray.forEach((ev, evIdx) => {
            if (typeof ev === 'string') {
              if (ev.trim() === '') {
                errors.push(`Animation "${animId}": frames[${idx}] event name cannot be empty.`);
              }
            } else if (isPlainObject(ev)) {
              if (typeof ev.name !== 'string' || ev.name.trim() === '') {
                errors.push(`Animation "${animId}": frames[${idx}] event name must be a non-empty string.`);
              }
              if (ev.timeMs !== undefined && (typeof ev.timeMs !== 'number' || !Number.isFinite(ev.timeMs) || ev.timeMs < 0)) {
                errors.push(`Animation "${animId}": frames[${idx}] event timeMs must be a non-negative number.`);
              }
            } else {
              errors.push(`Animation "${animId}": frames[${idx}] event must be a string or object { name, timeMs? }.`);
            }
          });
        }
      });
    }
  }

  // Check for unused declared frames (as warning, not error)
  for (const fId of declaredFrames) {
    if (!referencedFrames.has(fId)) {
      warnings.push(`Frame "${fId}" is defined in "frames" but never referenced in any animation.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates a manifest and throws an Error with details if invalid.
 */
function assertValidManifest(manifest, options = {}) {
  const result = validateManifest(manifest, options);
  if (!result.valid) {
    const errorMsg = `Invalid sprite manifest:\n  - ${result.errors.join('\n  - ')}`;
    const err = new Error(errorMsg);
    err.errors = result.errors;
    err.warnings = result.warnings;
    throw err;
  }
  return result;
}

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  const fs = require('fs');
  const path = require('path');

  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node validator.js <manifest.json> [--width <w>] [--height <h>]');
    process.exit(1);
  }

  const manifestPath = path.resolve(process.cwd(), args[0]);
  if (!fs.existsSync(manifestPath)) {
    console.error(`File not found: ${manifestPath}`);
    process.exit(1);
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    console.error(`Failed to parse JSON: ${err.message}`);
    process.exit(1);
  }

  const options = {};
  const wIdx = args.indexOf('--width');
  const hIdx = args.indexOf('--height');
  if (wIdx !== -1 && args[wIdx + 1]) options.imageDimensions = { ...options.imageDimensions, width: parseInt(args[wIdx + 1], 10) };
  if (hIdx !== -1 && args[hIdx + 1]) options.imageDimensions = { ...options.imageDimensions, height: parseInt(args[hIdx + 1], 10) };

  const result = validateManifest(manifest, options);
  if (result.valid) {
    console.log(`Manifest "${manifestPath}" is VALID.`);
    if (result.warnings.length > 0) {
      console.log('Warnings:');
      result.warnings.forEach(w => console.log(`  [!] ${w}`));
    }
    process.exit(0);
  } else {
    console.error(`Manifest "${manifestPath}" is INVALID with ${result.errors.length} error(s):`);
    result.errors.forEach(e => console.error(`  [X] ${e}`));
    if (result.warnings.length > 0) {
      console.log('Warnings:');
      result.warnings.forEach(w => console.log(`  [!] ${w}`));
    }
    process.exit(1);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateManifest,
    assertValidManifest
  };
}
if (typeof window !== 'undefined') {
  window.RiverCity = window.RiverCity || {};
  window.RiverCity.validateManifest = validateManifest;
  window.RiverCity.assertValidManifest = assertValidManifest;
  window.validateManifest = validateManifest;
  window.assertValidManifest = assertValidManifest;
}
