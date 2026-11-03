/**
 * Three.js Sprite Adapter
 * Bridges the sprite animation runtime with Three.js scenes.
 * Features:
 * - Nearest-neighbor texture filtering (no blurry pixel art)
 * - Transparent material with configurable alphaTest for clean depth sorting
 * - Dynamic vertex & UV updates matching exact manifest rects
 * - Feet anchor grounded at mesh local origin (0, 0, 0)
 * - Mirrored horizontal facing around anchor
 * - Safe resource disposal
 */

class ThreeSpriteAdapter {
  /**
   * @param {object} params
   * @param {object} params.THREE - Three.js module / namespace.
   * @param {object} params.manifest - Validated sprite manifest.
   * @param {object} params.texture - THREE.Texture sprite atlas.
   * @param {import('./runtime').SpritePlayer} params.player - SpritePlayer instance.
   * @param {number} [params.pixelsPerUnit=0.05] - World unit scaling factor (e.g. 0.05 = 20px per unit, 0.0625 = 16px per unit).
   * @param {object} [params.materialOptions] - Additional THREE.MeshBasicMaterial options.
   */
  constructor({
    THREE,
    manifest,
    texture,
    player,
    pixelsPerUnit = 0.05,
    materialOptions = {},
    imageDimensions = null
  }) {
    if (!THREE) {
      throw new Error('ThreeSpriteAdapter requires a "THREE" instance passed in parameters.');
    }
    if (!manifest || !player) {
      throw new Error('ThreeSpriteAdapter requires "manifest" and "player".');
    }

    this.THREE = THREE;
    this.manifest = manifest;
    this.texture = texture;
    this.player = player;
    this.pixelsPerUnit = pixelsPerUnit;
    this.imageDimensions = imageDimensions;

    this._lastFrameId = null;
    this._lastFacing = null;

    // Configure texture filtering for crisp pixel art
    if (this.texture) {
      this.configureTexture(this.texture);
    }

    // Build geometry and material
    this.geometry = this._createBufferGeometry();
    this.material = new this.THREE.MeshBasicMaterial({
      map: this.texture || null,
      transparent: true,
      alphaTest: 0.1,
      depthWrite: true,
      side: this.THREE.DoubleSide || 2,
      ...materialOptions
    });

    this.mesh = new this.THREE.Mesh(this.geometry, this.material);

    // Initial frame setup
    this.syncFrame(true);
  }

  /**
   * Configures a Three.js texture for nearest-neighbor pixel art rendering.
   */
  configureTexture(texture) {
    if (!texture) return;
    const { THREE } = this;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    if (THREE.SRGBColorSpace) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    if (texture.image) {
      texture.needsUpdate = true;
    }
  }

  _createBufferGeometry() {
    const { THREE } = this;
    const geometry = new THREE.BufferGeometry();

    // 4 vertices (two triangles):
    // 0: top-left, 1: top-right, 2: bottom-left, 3: bottom-right
    const positions = new Float32Array(4 * 3);
    const uvs = new Float32Array(4 * 2);
    const indices = new Uint16Array([0, 2, 1, 2, 3, 1]);

    if (THREE.Float32BufferAttribute) {
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    } else {
      // Fallback for minimal mocks
      geometry.attributes = {
        position: { array: positions, itemSize: 3, needsUpdate: false },
        uv: { array: uvs, itemSize: 2, needsUpdate: false }
      };
    }

    if (geometry.setIndex) {
      geometry.setIndex(new (THREE.Uint16BufferAttribute || Array)(indices, 1));
    } else {
      geometry.index = { array: indices };
    }

    return geometry;
  }

  getTextureDimensions() {
    if (this.imageDimensions && typeof this.imageDimensions.width === 'number' && typeof this.imageDimensions.height === 'number') {
      return this.imageDimensions;
    }

    if (this.texture && this.texture.image) {
      const w = this.texture.image.width || this.texture.image.naturalWidth;
      const h = this.texture.image.height || this.texture.image.naturalHeight;
      if (w && h) return { width: w, height: h };
    }

    if (this.manifest?.meta?.imageDimensions) {
      return this.manifest.meta.imageDimensions;
    }

    // Default fallback
    return { width: 128, height: 128 };
  }

  /**
   * Updates texture instance, applies nearest filtering, and refreshes UV mapping.
   * @param {object} texture - New THREE.Texture.
   */
  setTexture(texture) {
    this.texture = texture;
    if (this.texture) {
      this.configureTexture(this.texture);
      if (this.material) {
        this.material.map = this.texture;
        this.material.needsUpdate = true;
      }
    }
    this.syncFrame(true);
  }

  /**
   * Sets world unit scaling factor and resynchronizes vertex bounds.
   * @param {number} ppu - Pixels per unit.
   */
  setPixelsPerUnit(ppu) {
    if (typeof ppu === 'number' && ppu > 0) {
      this.pixelsPerUnit = ppu;
      this.syncFrame(true);
    }
  }

  /**
   * Updates geometry vertex positions and UV coordinates to match current frame and facing.
   */
  syncFrame(force = false) {
    const frameInfo = this.player.getCurrentFrame();
    if (!frameInfo || !frameInfo.frame) return;

    const frameId = frameInfo.frameId;
    const facing = this.player.facing;

    if (!force && frameId === this._lastFrameId && facing === this._lastFacing) {
      return;
    }

    this._lastFrameId = frameId;
    this._lastFacing = facing;

    const [sx, sy, sw, sh] = frameInfo.frame.rect;
    const [ax, ay] = frameInfo.frame.anchor;
    const ppu = this.pixelsPerUnit;
    const { width: texW, height: texH } = this.getTextureDimensions();

    // 1. Calculate local vertex positions relative to anchor (0, 0, 0)
    // Three.js: +X is right, +Y is up.
    // Ground anchor is (0, 0).
    let leftPx, rightPx;
    if (facing === 'left') {
      // Mirrored around anchor:
      // Left edge was -ax, now opposite: -(sw - ax)
      leftPx = -(sw - ax);
      rightPx = ax;
    } else {
      leftPx = -ax;
      rightPx = sw - ax;
    }

    const topPx = ay;
    const bottomPx = ay - sh;

    const x0 = leftPx * ppu;
    const x1 = rightPx * ppu;
    const y0 = bottomPx * ppu;
    const y1 = topPx * ppu;

    const pos = this.geometry.attributes.position.array;
    // Vertex 0: top-left (x0, y1, 0)
    pos[0] = x0;  pos[1] = y1;  pos[2] = 0;
    // Vertex 1: top-right (x1, y1, 0)
    pos[3] = x1;  pos[4] = y1;  pos[5] = 0;
    // Vertex 2: bottom-left (x0, y0, 0)
    pos[6] = x0;  pos[7] = y0;  pos[8] = 0;
    // Vertex 3: bottom-right (x1, y0, 0)
    pos[9] = x1;  pos[10] = y0; pos[11] = 0;

    this.geometry.attributes.position.needsUpdate = true;

    // 2. Calculate UV coordinates
    // Image coordinates: (0, 0) top-left
    // Texture coordinates: (0, 0) bottom-left, (1, 1) top-right
    let uMin = sx / texW;
    let uMax = (sx + sw) / texW;
    const vMin = 1.0 - (sy + sh) / texH;
    const vMax = 1.0 - sy / texH;

    if (facing === 'left') {
      // Swap uMin and uMax so the texture mirrors correctly with the vertex flip
      const tmp = uMin;
      uMin = uMax;
      uMax = tmp;
    }

    const uvs = this.geometry.attributes.uv.array;
    // Vertex 0: top-left
    uvs[0] = uMin; uvs[1] = vMax;
    // Vertex 1: top-right
    uvs[2] = uMax; uvs[3] = vMax;
    // Vertex 2: bottom-left
    uvs[4] = uMin; uvs[5] = vMin;
    // Vertex 3: bottom-right
    uvs[6] = uMax; uvs[7] = vMin;

    this.geometry.attributes.uv.needsUpdate = true;

    if (this.geometry.computeBoundingSphere) {
      this.geometry.computeBoundingSphere();
    }
    if (this.geometry.computeBoundingBox) {
      this.geometry.computeBoundingBox();
    }
  }

  /**
   * Advances player and updates Three.js mesh if frame changed.
   * @param {number} deltaMs - Elapsed time in milliseconds.
   */
  update(deltaMs) {
    this.player.update(deltaMs);
    this.syncFrame(false);
  }

  /**
   * Frees GPU and memory resources.
   * @param {boolean} [disposeTexture=false] - Whether to also dispose the texture.
   */
  dispose(disposeTexture = false) {
    if (this.geometry && typeof this.geometry.dispose === 'function') {
      this.geometry.dispose();
    }
    if (this.material && typeof this.material.dispose === 'function') {
      this.material.dispose();
    }
    if (disposeTexture && this.texture && typeof this.texture.dispose === 'function') {
      this.texture.dispose();
    }
    if (this.mesh && this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ThreeSpriteAdapter
  };
}
if (typeof window !== 'undefined') {
  window.RiverCity = window.RiverCity || {};
  window.RiverCity.ThreeSpriteAdapter = ThreeSpriteAdapter;
  window.ThreeSpriteAdapter = ThreeSpriteAdapter;
}
