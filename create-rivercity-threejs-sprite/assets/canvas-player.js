/**
 * Canvas Sprite Player & Renderer
 * Handles crisp pixel art rendering with nearest-neighbor scaling,
 * precise foot anchor alignment, horizontal mirroring around anchor,
 * and debug visualization of anchor and hitboxes.
 */

class CanvasSpriteRenderer {
  /**
   * @param {object} [options]
   * @param {CanvasImageSource} [options.image] - HTMLImageElement, ImageBitmap, or Canvas.
   * @param {number} [options.scale=1] - Pixel scale multiplier.
   * @param {boolean} [options.disableSmoothing=true] - Ensure pixel-art nearest neighbor.
   */
  constructor(options = {}) {
    this.image = options.image || null;
    this.scale = options.scale || 1;
    this.disableSmoothing = options.disableSmoothing !== false;
  }

  setImage(image) {
    this.image = image;
  }

  setScale(scale) {
    if (typeof scale === 'number' && scale > 0) {
      this.scale = scale;
    }
  }

  /**
   * Renders the current frame of a SpritePlayer onto a 2D canvas context.
   * The sprite's anchor point is aligned with (destX, destY).
   *
   * @param {CanvasRenderingContext2D} ctx - Target 2D rendering context.
   * @param {import('./runtime').SpritePlayer} player - The sprite player instance.
   * @param {number} destX - World X position (aligned with foot anchor).
   * @param {number} destY - World Y position (aligned with foot anchor).
   * @param {object} [options]
   * @param {number} [options.scale] - Override renderer scale.
   * @param {'right'|'left'} [options.facing] - Override player facing.
   * @param {boolean} [options.showAnchor=false] - Draw ground anchor crosshair.
   * @param {boolean} [options.showRect=false] - Draw frame rectangle outline.
   * @param {boolean} [options.showHitboxes=false] - Draw hitboxes if present.
   */
  render(ctx, player, destX, destY, options = {}) {
    if (!ctx || !player) return;

    const frameInfo = player.getCurrentFrame();
    if (!frameInfo || !frameInfo.frame) return;

    const scale = options.scale || this.scale || 1;
    const facing = options.facing || player.facing || 'right';
    const frame = frameInfo.frame;
    const [sx, sy, sw, sh] = frame.rect;
    const [ax, ay] = frame.anchor;

    if (this.disableSmoothing && 'imageSmoothingEnabled' in ctx) {
      ctx.imageSmoothingEnabled = false;
    }

    ctx.save();
    // 1. Translate context to target ground anchor world position
    ctx.translate(Math.round(destX), Math.round(destY));

    // 2. Mirror horizontally around anchor if facing left
    if (facing === 'left') {
      ctx.scale(-1, 1);
    }

    // 3. Draw image: anchor is (ax, ay) from top-left, so top-left is at (-ax * scale, -ay * scale)
    const drawX = -ax * scale;
    const drawY = -ay * scale;
    const drawW = sw * scale;
    const drawH = sh * scale;

    const image = options.image || this.image;
    if (image) {
      ctx.drawImage(image, sx, sy, sw, sh, drawX, drawY, drawW, drawH);
    }

    // 4. Debug Overlays (drawn in local anchor coordinate space)
    if (options.showRect) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 255, 128, 0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(drawX, drawY, drawW, drawH);
      ctx.restore();
    }

    if (options.showHitboxes && Array.isArray(frame.hitboxes)) {
      ctx.save();
      for (const hb of frame.hitboxes) {
        if (!Array.isArray(hb.rect) || hb.rect.length !== 4) continue;
        const [hbx, hby, hbw, hbh] = hb.rect;
        // Hitbox coordinates are relative to frame top-left
        const hx = drawX + hbx * scale;
        const hy = drawY + hby * scale;
        const hw = hbw * scale;
        const hh = hbh * scale;

        ctx.strokeStyle = hb.type === 'attack' ? 'rgba(255, 60, 60, 0.9)' : 'rgba(60, 160, 255, 0.9)';
        ctx.fillStyle = hb.type === 'attack' ? 'rgba(255, 60, 60, 0.25)' : 'rgba(60, 160, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.fillRect(hx, hy, hw, hh);
        ctx.strokeRect(hx, hy, hw, hh);
      }
      ctx.restore();
    }

    if (options.showAnchor) {
      ctx.save();
      ctx.strokeStyle = '#ff0055';
      ctx.fillStyle = '#ff0055';
      ctx.lineWidth = 1.5;
      // Crosshair at (0, 0)
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(4, 0);
      ctx.moveTo(0, -4);
      ctx.lineTo(0, 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
}

/**
 * High-level interactive Canvas Animation Player.
 * Useful for embedding in HTML pages or preview tools.
 */
class CanvasAnimationPlayer {
  constructor(canvas, player, imageSource, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
    this.player = player;
    this.renderer = new CanvasSpriteRenderer({
      image: imageSource,
      scale: options.scale || 2
    });

    this.options = {
      showAnchor: options.showAnchor ?? true,
      showRect: options.showRect ?? false,
      showHitboxes: options.showHitboxes ?? false,
      clearColor: options.clearColor || null,
      ...options
    };

    this._rafId = null;
    this._lastTimestamp = 0;
    this._onTick = this._onTick.bind(this);
  }

  setImage(image) {
    this.renderer.setImage(image);
  }

  start() {
    if (this._rafId !== null) return;
    this._lastTimestamp = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (typeof requestAnimationFrame !== 'undefined') {
      this._rafId = requestAnimationFrame(this._onTick);
    }
  }

  stop() {
    if (this._rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _onTick(now) {
    const deltaMs = now - this._lastTimestamp;
    this._lastTimestamp = now;

    this.player.update(deltaMs);
    this.render();

    if (typeof requestAnimationFrame !== 'undefined') {
      this._rafId = requestAnimationFrame(this._onTick);
    }
  }

  render() {
    const { canvas, ctx } = this;
    if (this.options.clearColor) {
      ctx.fillStyle = this.options.clearColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height * 0.75; // ground line

    this.renderer.render(ctx, this.player, centerX, centerY, this.options);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CanvasSpriteRenderer,
    CanvasAnimationPlayer
  };
}
if (typeof window !== 'undefined') {
  window.RiverCity = window.RiverCity || {};
  window.RiverCity.CanvasSpriteRenderer = CanvasSpriteRenderer;
  window.RiverCity.CanvasAnimationPlayer = CanvasAnimationPlayer;
  window.CanvasSpriteRenderer = CanvasSpriteRenderer;
  window.CanvasAnimationPlayer = CanvasAnimationPlayer;
}
