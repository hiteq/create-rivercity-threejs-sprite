const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { SpritePlayer } = require('../runtime');

function loadSampleManifest() {
  const samplePath = path.join(__dirname, '../sample/sample-manifest.json');
  return JSON.parse(fs.readFileSync(samplePath, 'utf8'));
}

test('SpritePlayer: initialization and default state', () => {
  const manifest = loadSampleManifest();
  const player = new SpritePlayer(manifest);

  assert.equal(player.currentAnimationName, 'idle');
  assert.equal(player.currentFrameIndex, 0);
  assert.equal(player.isPlaying, false);
  assert.equal(player.facing, 'right');

  const frame = player.getCurrentFrame();
  assert.equal(frame.frameId, 'idle-0');
  assert.deepEqual(player.getAnchor(), [16, 39]);
});

test('SpritePlayer: play, pause, resume, stop', () => {
  const manifest = loadSampleManifest();
  const player = new SpritePlayer(manifest);

  player.play();
  assert.equal(player.isPlaying, true);

  player.update(100);
  assert.equal(player.currentTimeMs, 100);

  player.pause();
  assert.equal(player.isPlaying, false);

  player.update(100); // Should not advance when paused
  assert.equal(player.currentTimeMs, 100);

  player.resume();
  assert.equal(player.isPlaying, true);

  player.stop();
  assert.equal(player.isPlaying, false);
  assert.equal(player.currentTimeMs, 0);
  assert.equal(player.currentFrameIndex, 0);
});

test('SpritePlayer: variable frame duration & frame switching', () => {
  const testManifest = {
    version: 1,
    image: 'sprites.png',
    frames: {
      'f0': { rect: [0, 0, 16, 16], anchor: [8, 15] },
      'f1': { rect: [16, 0, 16, 16], anchor: [8, 15] },
      'f2': { rect: [32, 0, 16, 16], anchor: [8, 15] }
    },
    animations: {
      'combo': {
        loop: true,
        frames: [
          { frame: 'f0', durationMs: 100 },
          { frame: 'f1', durationMs: 250 },
          { frame: 'f2', durationMs: 50 }
        ]
      }
    }
  };

  const player = new SpritePlayer(testManifest, { autoPlay: true });
  assert.equal(player.getCurrentFrame().frameId, 'f0');

  // At 50ms (within f0: 0..100)
  player.update(50);
  assert.equal(player.getCurrentFrame().frameId, 'f0');
  assert.equal(player.getCurrentFrame().frameIndex, 0);

  // At 120ms (within f1: 100..350)
  player.update(70);
  assert.equal(player.getCurrentFrame().frameId, 'f1');
  assert.equal(player.getCurrentFrame().frameIndex, 1);

  // At 360ms (within f2: 350..400)
  player.update(240);
  assert.equal(player.getCurrentFrame().frameId, 'f2');
  assert.equal(player.getCurrentFrame().frameIndex, 2);

  // Loop wraps at 400ms: at 410ms -> 10ms into f0
  player.update(50);
  assert.equal(player.getCurrentFrame().frameId, 'f0');
  assert.equal(player.getCurrentFrame().frameIndex, 0);
});

test('SpritePlayer: one-shot non-looping animation halts and triggers finish', () => {
  const manifest = loadSampleManifest();
  const player = new SpritePlayer(manifest);

  let finishedAnim = null;
  player.on('finish', (data) => {
    finishedAnim = data.animation;
  });

  player.play('punch'); // punch is non-looping: 80ms + 160ms = 240ms total
  assert.equal(player.currentAnimationName, 'punch');
  assert.equal(player.getCurrentFrame().loop, false);

  player.update(100);
  assert.equal(player.getCurrentFrame().frameId, 'punch-0');
  assert.equal(player.isPlaying, true);
  assert.equal(finishedAnim, null);

  // Advance past end
  player.update(200);
  assert.equal(player.isFinished, true);
  assert.equal(player.isPlaying, false);
  assert.equal(finishedAnim, 'punch');
  assert.equal(player.getCurrentFrame().frameId, 'punch-0');
});

test('SpritePlayer: discrete event firing across single and large time steps', () => {
  const testManifest = {
    version: 1,
    image: 'test.png',
    frames: {
      'step1': { rect: [0, 0, 16, 16], anchor: [8, 15] },
      'hit1': { rect: [16, 0, 16, 16], anchor: [8, 15] },
      'step2': { rect: [32, 0, 16, 16], anchor: [8, 15] }
    },
    animations: {
      'combo': {
        loop: true,
        frames: [
          { frame: 'step1', durationMs: 100, events: ['footstep_left'] },
          { frame: 'hit1', durationMs: 100, events: [{ name: 'impact', timeMs: 40 }] },
          { frame: 'step2', durationMs: 100, events: ['footstep_right'] }
        ]
      }
    }
  };

  const player = new SpritePlayer(testManifest, { autoPlay: true });
  const firedEvents = [];
  player.on('event', (e) => firedEvents.push(e.name));

  // Small step to 50ms: crosses footstep_left (at 0ms)
  player.update(50);
  assert.deepEqual(firedEvents, ['footstep_left']);

  // Next step of 100ms (to 150ms): crosses impact at 100+40 = 140ms
  player.update(100);
  assert.deepEqual(firedEvents, ['footstep_left', 'impact']);

  // Reset and test large step crossing multiple frames and events in a single update
  const player2 = new SpritePlayer(testManifest, { autoPlay: true });
  const firedEvents2 = [];
  player2.on('event', (e) => firedEvents2.push(e.name));

  // Step 250ms at once: should cross footstep_left (0ms), impact (140ms), footstep_right (200ms)
  player2.update(250);
  assert.deepEqual(firedEvents2, ['footstep_left', 'impact', 'footstep_right']);
});

test('SpritePlayer: supports single "event" field in addition to "events" array', () => {
  const testManifest = {
    version: 1,
    image: 'test.png',
    frames: {
      'f0': { rect: [0, 0, 16, 16], anchor: [8, 15] },
      'f1': { rect: [16, 0, 16, 16], anchor: [8, 15] }
    },
    animations: {
      'punch': {
        loop: false,
        frames: [
          { frame: 'f0', durationMs: 100 },
          { frame: 'f1', durationMs: 100, event: 'hit_strike' }
        ]
      }
    }
  };

  const player = new SpritePlayer(testManifest, { autoPlay: true });
  const fired = [];
  player.on('event', (e) => fired.push(e.name));

  player.update(150);
  assert.deepEqual(fired, ['hit_strike']);
});

test('SpritePlayer: seek and step', () => {
  const manifest = loadSampleManifest();
  const player = new SpritePlayer(manifest);
  player.play('idle'); // idle-0: 180ms, idle-1: 180ms

  player.seek(200);
  assert.equal(player.currentFrameIndex, 1);
  assert.equal(player.getCurrentFrame().frameId, 'idle-1');

  // Step backward
  player.step(-1);
  assert.equal(player.currentFrameIndex, 0);
  assert.equal(player.getCurrentFrame().frameId, 'idle-0');

  // Step forward
  player.step(1);
  assert.equal(player.currentFrameIndex, 1);
});

test('SpritePlayer: facing direction and relative bounds', () => {
  const manifest = loadSampleManifest();
  const player = new SpritePlayer(manifest);
  // idle-0: rect: [0, 0, 32, 40], anchor: [16, 39]

  // Default facing right
  player.setFacing('right');
  assert.equal(player.facing, 'right');
  const boundsRight = player.getRelativeBounds(2); // scale = 2
  // x = -16 * 2 = -32, y = -39 * 2 = -78, w = 32 * 2 = 64, h = 40 * 2 = 80
  assert.deepEqual(boundsRight, { x: -32, y: -78, width: 64, height: 80 });

  // Facing left: mirrored around anchor x
  player.setFacing('left');
  assert.equal(player.facing, 'left');
  const boundsLeft = player.getRelativeBounds(2);
  // w = 32, ax = 16 => -(32 - 16) * 2 = -32, exactly symmetrical ground footprint!
  assert.deepEqual(boundsLeft, { x: -32, y: -78, width: 64, height: 80 });

  // Asymmetrical anchor test
  const asymManifest = {
    version: 1,
    image: 'test.png',
    frames: {
      'f0': { rect: [0, 0, 50, 40], anchor: [10, 40] } // 10px from left, 40px from right
    },
    animations: {
      'idle': { frames: [{ frame: 'f0', durationMs: 100 }] }
    }
  };
  const asymPlayer = new SpritePlayer(asymManifest);

  asymPlayer.setFacing('right');
  assert.deepEqual(asymPlayer.getRelativeBounds(1), { x: -10, y: -40, width: 50, height: 40 });

  asymPlayer.setFacing('left');
  // When facing left, body extends 40px to the left and 10px to the right of anchor
  assert.deepEqual(asymPlayer.getRelativeBounds(1), { x: -40, y: -40, width: 50, height: 40 });
});

test('SpritePlayer: replaying finished one-shot animation resets time and starts over', () => {
  const manifest = loadSampleManifest();
  const player = new SpritePlayer(manifest);

  player.play('punch');
  player.update(300); // Punch finishes (240ms duration)
  assert.equal(player.isFinished, true);
  assert.equal(player.isPlaying, false);
  assert.equal(player.currentTimeMs, 240);

  // Calling play('punch') again must replay from frame 0
  player.play('punch');
  assert.equal(player.isFinished, false);
  assert.equal(player.isPlaying, true);
  assert.equal(player.currentTimeMs, 0);
  assert.equal(player.currentFrameIndex, 0);

  // Test seek and step on finished animation
  player.seek(50);
  assert.equal(player.isFinished, false);
  assert.equal(player.currentTimeMs, 50);

  player.play();
  player.update(300); // Finish again
  assert.equal(player.isFinished, true);

  player.step(-1);
  assert.equal(player.isFinished, false);
});
