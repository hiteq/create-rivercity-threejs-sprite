/**
 * Sprite Animation Runtime
 * Core animation clock and state machine supporting variable frame durations,
 * discrete event dispatching across arbitrary delta steps, looping and one-shot
 * actions, facing orientation, and frame stepping.
 */

class SpritePlayer {
  /**
   * @param {object} manifest - Validated sprite manifest.
   * @param {object} [options]
   * @param {string} [options.initialAnimation] - Initial animation name to play or queue.
   * @param {'right'|'left'|1|-1} [options.facing='right'] - Initial facing direction.
   * @param {number} [options.speed=1.0] - Playback speed multiplier.
   * @param {boolean} [options.autoPlay=false] - Whether to start playing immediately.
   */
  constructor(manifest, options = {}) {
    if (!manifest || !manifest.animations || !manifest.frames) {
      throw new Error('SpritePlayer requires a valid manifest with "animations" and "frames".');
    }

    this.manifest = manifest;
    this.currentAnimationName = null;
    this.currentAnimation = null;
    this.currentFrameIndex = 0;
    this.currentTimeMs = 0;
    this.isPlaying = false;
    this.speed = typeof options.speed === 'number' && options.speed > 0 ? options.speed : 1.0;
    this.facing = this._normalizeFacing(options.facing || 'right');
    this.isFinished = false;

    // Event listeners: 'event', 'frame', 'finish', 'loop'
    this._listeners = new Map();

    // Cache preprocessed animation timing tables for fast, precise lookups
    this._animationMetadata = new Map();
    this._preprocessAnimations();

    const initial = options.initialAnimation || Object.keys(manifest.animations)[0];
    if (initial && manifest.animations[initial]) {
      this.setAnimation(initial, { resetTime: true });
      if (options.autoPlay) {
        this.play();
      }
    }
  }

  _normalizeFacing(facing) {
    if (facing === 'left' || facing === -1) return 'left';
    return 'right';
  }

  _preprocessAnimations() {
    for (const [name, anim] of Object.entries(this.manifest.animations)) {
      const frames = anim.frames || [];
      const loop = anim.loop !== false; // defaults to true unless explicitly false

      let totalDurationMs = 0;
      const frameEntries = [];
      const eventList = [];

      for (let i = 0; i < frames.length; i++) {
        const fEntry = frames[i];
        const duration = fEntry.durationMs;
        const startMs = totalDurationMs;
        const endMs = startMs + duration;
        const frameData = this.manifest.frames[fEntry.frame];

        frameEntries.push({
          index: i,
          frameId: fEntry.frame,
          frameData,
          startMs,
          endMs,
          durationMs: duration
        });

        // Frame entry events (supports both "events" array and single/array "event")
        const rawEvents = fEntry.events !== undefined
          ? (Array.isArray(fEntry.events) ? fEntry.events : [fEntry.events])
          : (fEntry.event !== undefined ? (Array.isArray(fEntry.event) ? fEntry.event : [fEntry.event]) : []);

        for (const ev of rawEvents) {
          if (!ev) continue;
          const evName = typeof ev === 'string' ? ev : ev.name;
          const evOffset = typeof ev === 'object' && typeof ev.timeMs === 'number' ? ev.timeMs : 0;
          eventList.push({
            name: evName,
            frameIndex: i,
            frameId: fEntry.frame,
            triggerTimeMs: startMs + Math.min(Math.max(0, evOffset), duration)
          });
        }

        totalDurationMs = endMs;
      }

      // Sort events by trigger time
      eventList.sort((a, b) => a.triggerTimeMs - b.triggerTimeMs);

      this._animationMetadata.set(name, {
        name,
        loop,
        totalDurationMs,
        frames: frameEntries,
        events: eventList
      });
    }
  }

  /**
   * Sets or switches the current animation.
   *
   * @param {string} animationName
   * @param {object} [options]
   * @param {boolean} [options.resetTime=true]
   * @param {boolean} [options.autoPlay=true]
   */
  setAnimation(animationName, options = {}) {
    const meta = this._animationMetadata.get(animationName);
    if (!meta) {
      throw new Error(`Animation "${animationName}" does not exist in manifest.`);
    }

    const resetTime = options.resetTime !== false;
    const sameAnim = this.currentAnimationName === animationName;

    this.currentAnimationName = animationName;
    this.currentAnimation = meta;
    this.isFinished = false;

    if (resetTime || !sameAnim) {
      this.currentTimeMs = 0;
      this.currentFrameIndex = 0;
    } else {
      // Reclamp if switching with preserved progress
      if (meta.totalDurationMs > 0) {
        this.currentTimeMs = this.currentTimeMs % meta.totalDurationMs;
        this._updateFrameIndexFromTime();
      }
    }

    if (options.autoPlay) {
      this.isPlaying = true;
    }
  }

  play(animationName, options = {}) {
    if (animationName) {
      if (animationName !== this.currentAnimationName || this.isFinished || options.resetTime) {
        this.setAnimation(animationName, { resetTime: true, ...options });
      }
    } else if (this.isFinished || options.resetTime) {
      this.currentTimeMs = 0;
      this.currentFrameIndex = 0;
      this.isFinished = false;
    }
    this.isPlaying = true;
    this.isFinished = false;
    return this;
  }

  pause() {
    this.isPlaying = false;
    return this;
  }

  resume() {
    if (this.currentAnimation && !this.isFinished) {
      this.isPlaying = true;
    }
    return this;
  }

  stop() {
    this.isPlaying = false;
    this.currentTimeMs = 0;
    this.currentFrameIndex = 0;
    this.isFinished = false;
    return this;
  }

  setFacing(facing) {
    this.facing = this._normalizeFacing(facing);
    return this;
  }

  setSpeed(multiplier) {
    if (typeof multiplier === 'number' && multiplier > 0) {
      this.speed = multiplier;
    }
    return this;
  }

  seek(timeMs) {
    if (!this.currentAnimation) return;
    const meta = this.currentAnimation;
    const clamped = Math.max(0, meta.loop && meta.totalDurationMs > 0 ? timeMs % meta.totalDurationMs : Math.min(timeMs, meta.totalDurationMs));
    this.currentTimeMs = clamped;
    this._updateFrameIndexFromTime();
    if (clamped < meta.totalDurationMs) {
      this.isFinished = false;
    }
  }

  step(stepCount = 1) {
    if (!this.currentAnimation) return;
    const frames = this.currentAnimation.frames;
    if (frames.length === 0) return;

    let newIdx = this.currentFrameIndex + stepCount;
    if (this.currentAnimation.loop) {
      newIdx = ((newIdx % frames.length) + frames.length) % frames.length;
      this.isFinished = false;
    } else {
      newIdx = Math.max(0, Math.min(newIdx, frames.length - 1));
      if (newIdx < frames.length - 1) {
        this.isFinished = false;
      }
    }

    this.currentFrameIndex = newIdx;
    this.currentTimeMs = frames[newIdx].startMs;
    this._emit('frame', this.getCurrentFrame());
  }

  _updateFrameIndexFromTime() {
    if (!this.currentAnimation) return;
    const frames = this.currentAnimation.frames;
    for (let i = 0; i < frames.length; i++) {
      if (this.currentTimeMs >= frames[i].startMs && this.currentTimeMs < frames[i].endMs) {
        this.currentFrameIndex = i;
        return;
      }
    }
    this.currentFrameIndex = Math.max(0, frames.length - 1);
  }

  /**
   * Advances animation by delta milliseconds.
   * Accurately fires all events crossed even during large frame drops / time steps.
   *
   * @param {number} deltaMs - Elapsed time in milliseconds.
   */
  update(deltaMs) {
    if (!this.isPlaying || !this.currentAnimation || deltaMs <= 0 || this.isFinished) {
      return;
    }

    const meta = this.currentAnimation;
    const totalMs = meta.totalDurationMs;
    if (totalMs <= 0) return;

    const effectiveDelta = deltaMs * this.speed;
    const prevTime = this.currentTimeMs;
    const prevIndex = this.currentFrameIndex;

    if (!meta.loop) {
      // Non-looping (one-shot) animation
      const targetTime = prevTime + effectiveDelta;
      this._dispatchEventsInRange(prevTime, targetTime, false);

      if (targetTime >= totalMs) {
        this.currentTimeMs = totalMs;
        this.currentFrameIndex = meta.frames.length - 1;
        this.isFinished = true;
        this.isPlaying = false;
        this._emit('finish', { animation: meta.name });
      } else {
        this.currentTimeMs = targetTime;
        this._updateFrameIndexFromTime();
      }
    } else {
      // Looping animation
      let remainingDelta = effectiveDelta;
      let curr = prevTime;

      while (remainingDelta > 0) {
        const timeToEnd = totalMs - curr;
        if (remainingDelta >= timeToEnd) {
          // Cross through end of loop
          this._dispatchEventsInRange(curr, totalMs, true);
          remainingDelta -= timeToEnd;
          curr = 0;
          this._emit('loop', { animation: meta.name });
        } else {
          const nextTime = curr + remainingDelta;
          this._dispatchEventsInRange(curr, nextTime, false);
          curr = nextTime;
          remainingDelta = 0;
        }
      }

      this.currentTimeMs = curr;
      this._updateFrameIndexFromTime();
    }

    if (this.currentFrameIndex !== prevIndex) {
      this._emit('frame', this.getCurrentFrame());
    }
  }

  _dispatchEventsInRange(startMs, endMs, isLoopCycleEnd) {
    const meta = this.currentAnimation;
    if (!meta || meta.events.length === 0) return;

    for (const ev of meta.events) {
      const t = ev.triggerTimeMs;
      // Trigger condition: (startMs < t <= endMs) or (t == 0 when starting at 0)
      const triggered = (startMs === 0 && t === 0) || (t > startMs && (isLoopCycleEnd ? t <= endMs : t <= endMs));
      if (triggered) {
        this._emit('event', {
          name: ev.name,
          animation: meta.name,
          frameIndex: ev.frameIndex,
          frameId: ev.frameId,
          triggerTimeMs: ev.triggerTimeMs
        });
      }
    }
  }

  getCurrentFrame() {
    if (!this.currentAnimation) return null;
    const frames = this.currentAnimation.frames;
    const entry = frames[this.currentFrameIndex] || frames[0];
    if (!entry) return null;

    const timeInFrame = Math.max(0, this.currentTimeMs - entry.startMs);
    const normalizedProgress = entry.durationMs > 0 ? Math.min(1.0, timeInFrame / entry.durationMs) : 0;

    return {
      animationName: this.currentAnimation.name,
      frameIndex: this.currentFrameIndex,
      frameId: entry.frameId,
      frame: entry.frameData,
      durationMs: entry.durationMs,
      timeInFrameMs: timeInFrame,
      normalizedProgress,
      facing: this.facing,
      isFinished: this.isFinished,
      loop: this.currentAnimation.loop
    };
  }

  getAnchor() {
    const current = this.getCurrentFrame();
    if (current && current.frame && Array.isArray(current.frame.anchor)) {
      return current.frame.anchor;
    }
    return [0, 0];
  }

  /**
   * Returns total duration of current animation in milliseconds.
   * @returns {number}
   */
  getDuration() {
    return this.currentAnimation ? this.currentAnimation.totalDurationMs : 0;
  }

  /**
   * Returns sprite rectangle coordinates relative to foot anchor [0, 0].
   * Takes facing into account.
   */
  getRelativeBounds(scale = 1) {
    const current = this.getCurrentFrame();
    if (!current || !current.frame) return { x: 0, y: 0, width: 0, height: 0 };

    const [ax, ay] = current.frame.anchor;
    const [, , w, h] = current.frame.rect;

    if (this.facing === 'left') {
      // Mirrored around anchor x
      return {
        x: -(w - ax) * scale,
        y: -ay * scale,
        width: w * scale,
        height: h * scale
      };
    }

    return {
      x: -ax * scale,
      y: -ay * scale,
      width: w * scale,
      height: h * scale
    };
  }

  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this._listeners.has(event)) {
      this._listeners.get(event).delete(callback);
    }
  }

  _emit(event, data) {
    const set = this._listeners.get(event);
    if (set) {
      for (const cb of set) {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in "${event}" listener:`, err);
        }
      }
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SpritePlayer
  };
}
if (typeof window !== 'undefined') {
  window.RiverCity = window.RiverCity || {};
  window.RiverCity.SpritePlayer = SpritePlayer;
  window.SpritePlayer = SpritePlayer;
}
