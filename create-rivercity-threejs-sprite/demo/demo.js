/**
 * River City Three.js Sprite Workshop - Main Controller
 * Dual 2D Canvas & Three.js 2.5D Belt-Scroll Interactive Demo
 */

(function () {
  'use strict';

  // Preset Configurations with nested Pages base-path auto-detection
  const scriptBase = (function() {
    if (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) {
      return document.currentScript.src.replace(/\/[^\/]*$/, '/');
    }
    return '';
  })();

  const PRESETS = {
    expanded: {
      manifestPath: scriptBase ? new URL('../assets/sample/sample-expanded-manifest.json', scriptBase).href : '../assets/sample/sample-expanded-manifest.json',
      imagePath: scriptBase ? new URL('../assets/sample/sample-expanded-character.png', scriptBase).href : '../assets/sample/sample-expanded-character.png',
      name: 'Alex / Kunio (NES Authentic 10-Frame Action Suite)'
    },
    ryan: {
      manifestPath: scriptBase ? new URL('../assets/sample/sample-ryan-manifest.json', scriptBase).href : '../assets/sample/sample-ryan-manifest.json',
      imagePath: scriptBase ? new URL('../assets/sample/sample-ryan-character.png', scriptBase).href : '../assets/sample/sample-ryan-character.png',
      name: 'Ryan / Riki (NES Authentic Rival / P2 Suite)'
    },
    basic: {
      manifestPath: scriptBase ? new URL('../assets/sample/sample-manifest.json', scriptBase).href : '../assets/sample/sample-manifest.json',
      imagePath: scriptBase ? new URL('../assets/sample/sample-character.png', scriptBase).href : '../assets/sample/sample-character.png',
      name: 'Alex / Kunio (NES Authentic Core 4-Frame Baseline)'
    }
  };

  // State
  let currentPresetKey = 'expanded';
  let activeManifest = null;
  let activeImage = null;
  let activeThreeTexture = null;

  // Runtime Instances
  let player = null;
  let canvasRenderer = null;
  let threeAdapter = null;
  let rivalAdapter = null;
  let rivalPlayer = null;

  // Three.js Scene Components
  let threeScene = null;
  let threeCamera = null;
  let threeRenderer = null;
  let orbitControls = null;
  let shadowMesh = null;
  let rivalShadowMesh = null;
  let groundGrid = null;

  // 2.5D Player World Position
  const playerPos = { x: 0, y: 0, z: 0 };
  const keysDown = new Set();
  let isMoving = false;
  let baseSpeed = 1.0;

  // Canvas Inspector Settings
  let canvasScale = 6;
  let showAnchor = true;
  let showRect = true;
  let showHitboxes = true;
  let showRival = true;
  let showShadows = true;
  let currentViewMode = 'three-view'; // 'three-view', 'canvas-view', 'split-view'

  // Clock
  let lastTimestamp = performance.now();
  let isPlaying = true;
  let selectedInspectFrameId = null;

  // DOM Elements
  const charSelect = document.getElementById('char-select');
  const stageArea = document.getElementById('stage-area');
  const threeStage = document.getElementById('three-stage');
  const canvasStage = document.getElementById('canvas-stage');
  const pixelCanvas = document.getElementById('pixel-canvas');
  const pixelCtx = pixelCanvas.getContext('2d');
  const atlasCanvas = document.getElementById('atlas-canvas');
  const atlasCtx = atlasCanvas.getContext('2d');

  // Tabs & Tools
  const tabThree = document.getElementById('tab-three');
  const tabCanvas = document.getElementById('tab-canvas');
  const tabSplit = document.getElementById('tab-split');
  const threeTools = document.getElementById('three-tools');
  const canvasTools = document.getElementById('canvas-tools');

  // Playback Controls
  const btnPlayPause = document.getElementById('btn-play-pause');
  const playPauseIcon = document.getElementById('play-pause-icon');
  const playPauseText = document.getElementById('play-pause-text');
  const btnStepPrev = document.getElementById('btn-step-prev');
  const btnStepNext = document.getElementById('btn-step-next');
  const btnReset = document.getElementById('btn-reset');
  const btnToggleFacing = document.getElementById('btn-toggle-facing');
  const facingLabel = document.getElementById('facing-label');
  const timelineScrubber = document.getElementById('timeline-scrubber');
  const timecodeDisplay = document.getElementById('timecode-display');
  const eventBadge = document.getElementById('event-badge');
  const speedButtons = document.querySelectorAll('.btn-speed');

  // Camera Buttons
  const btnCam25D = document.getElementById('btn-cam-25d');
  const btnCamFront = document.getElementById('btn-cam-front');
  const btnCamIso = document.getElementById('btn-cam-iso');
  const btnRivalToggle = document.getElementById('btn-rival');
  const btnShadowsToggle = document.getElementById('btn-shadows');

  // Canvas Tool Buttons
  const btnShowAnchor = document.getElementById('btn-show-anchor');
  const btnShowRect = document.getElementById('btn-show-rect');
  const btnShowHitboxes = document.getElementById('btn-show-hitboxes');
  const btnScaleToggle = document.getElementById('btn-scale-toggle');

  // Library & Inspector
  const animList = document.getElementById('anim-list');
  const animCountPill = document.getElementById('anim-count-pill');
  const sheetDimPill = document.getElementById('sheet-dim-pill');
  const quickActionButtons = document.getElementById('quick-action-buttons');

  // Details Table
  const detailFrameId = document.getElementById('detail-frame-id');
  const detailFrameRect = document.getElementById('detail-frame-rect');
  const detailFrameAnchor = document.getElementById('detail-frame-anchor');
  const detailFrameTicks = document.getElementById('detail-frame-ticks');
  const detailFrameHitboxes = document.getElementById('detail-frame-hitboxes');

  /**
   * Initialize Application
   */
  async function init() {
    setupThreeScene();
    setupEventListeners();
    await loadPreset(currentPresetKey);
    requestAnimationFrame(renderLoop);
  }

  /**
   * Set up Three.js 2.5D Belt-Scroll Scene
   */
  function setupThreeScene() {
    if (typeof THREE === 'undefined') {
      console.error('THREE is not loaded!');
      return;
    }

    const width = threeStage.clientWidth || 800;
    const height = threeStage.clientHeight || 480;

    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x0a0c14);
    threeScene.fog = new THREE.FogExp2(0x0a0c14, 0.04);

    // 2.5D Angled Belt-Scroll Camera
    threeCamera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    setCameraPreset('25d');

    // WebGL Renderer (with robust fallback for headless/non-accelerated environments)
    try {
      threeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      threeRenderer.setSize(width, height);
      threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      if (THREE.SRGBColorSpace) {
        threeRenderer.outputColorSpace = THREE.SRGBColorSpace;
      }
      threeStage.appendChild(threeRenderer.domElement);

      // OrbitControls
      if (typeof THREE.OrbitControls !== 'undefined') {
        orbitControls = new THREE.OrbitControls(threeCamera, threeRenderer.domElement);
        orbitControls.enableDamping = true;
        orbitControls.dampingFactor = 0.08;
        orbitControls.target.set(0, 0.8, 0);
        orbitControls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below floor
      }
    } catch (webglErr) {
      console.warn('WebGL initialization failed, operating in 2D Canvas mode:', webglErr);
      threeRenderer = null;
      threeStage.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ff9100;font-family:monospace;font-size:12px;padding:24px;text-align:center;background:#0d0e15;">⚠️ WebGL context unavailable in this environment (e.g. headless/no GPU).<br><br>Switch to "2D Pixel Canvas" tab above to view full interactive sprites, timing, and hitboxes!</div>';
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    threeScene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00e5ff, 0.35);
    dirLight.position.set(5, 10, 7);
    threeScene.add(dirLight);

    // 2.5D Belt-Scroll Retro Ground Plane
    buildGroundPlane();

    // Floor Shadow Discs (Anchored at Y=0.01)
    shadowMesh = createDropShadow();
    threeScene.add(shadowMesh);

    rivalShadowMesh = createDropShadow();
    rivalShadowMesh.position.set(2.2, 0.005, -1.0);
    threeScene.add(rivalShadowMesh);

    // Resize Handler
    window.addEventListener('resize', onWindowResize);
  }

  function buildGroundPlane() {
    // Street / Floor grid
    const gridHelper = new THREE.GridHelper(20, 20, 0x00e5ff, 0x1f293d);
    gridHelper.position.y = 0;
    threeScene.add(gridHelper);
    groundGrid = gridHelper;

    // Asphalt runway
    const floorGeo = new THREE.PlaneGeometry(24, 16);
    const floorMat = new THREE.MeshBasicMaterial({
      color: 0x0e111a,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    threeScene.add(floor);
  }

  function createDropShadow() {
    // Elliptical retro drop shadow disc under feet
    const shadowGeo = new THREE.CircleGeometry(0.55, 32);
    shadowGeo.scale(1.2, 0.5, 1.0); // Flatten along Z
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(shadowGeo, shadowMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.005;
    return mesh;
  }

  function setCameraPreset(mode) {
    if (!threeCamera) return;
    if (mode === '25d') {
      // Classic 2.5D belt-scroll angle (~25 degrees elevation)
      threeCamera.position.set(0, 3.2, 6.2);
      threeCamera.lookAt(0, 0.8, 0);
      if (orbitControls) orbitControls.target.set(0, 0.8, 0);
    } else if (mode === 'front') {
      // Straight-on 2D alignment
      threeCamera.position.set(0, 1.0, 5.5);
      threeCamera.lookAt(0, 1.0, 0);
      if (orbitControls) orbitControls.target.set(0, 1.0, 0);
    } else if (mode === 'iso') {
      // Isometric action view
      threeCamera.position.set(4.5, 4.0, 4.5);
      threeCamera.lookAt(0, 0.8, 0);
      if (orbitControls) orbitControls.target.set(0, 0.8, 0);
    }
  }

  function onWindowResize() {
    if (!threeRenderer || !threeCamera) return;
    const width = threeStage.clientWidth || 800;
    const height = threeStage.clientHeight || 480;
    threeCamera.aspect = width / height;
    threeCamera.updateProjectionMatrix();
    threeRenderer.setSize(width, height);
  }

  /**
   * Load Preset Character & Manifest
   */
  async function loadPreset(presetKey) {
    const config = PRESETS[presetKey];
    if (!config) return;

    try {
      // 1. Fetch Manifest
      const resp = await fetch(config.manifestPath);
      activeManifest = await resp.json();

      // Validate manifest programmatically
      if (typeof RiverCity !== 'undefined' && RiverCity.validateManifest) {
        const valRes = RiverCity.validateManifest(activeManifest);
        if (!valRes.valid) {
          console.warn('Manifest validation warnings/errors:', valRes.errors);
        }
      }

      // 2. Load Texture / Image
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          activeImage = img;
          resolve();
        };
        img.onerror = reject;
        img.src = config.imagePath;
      });

      // 3. Initialize SpritePlayer
      const initialAnim = Object.keys(activeManifest.animations)[0] || 'idle';
      player = new (RiverCity.SpritePlayer || SpritePlayer)(activeManifest, {
        initialAnimation: initialAnim,
        facing: 'right',
        speed: baseSpeed,
        autoPlay: isPlaying
      });

      // Listen to runtime events
      player.on('event', (ev) => {
        triggerEventFlash(ev.name);
      });

      player.on('finish', () => {
        // If one-shot finished and not actively moving, return to idle
        if (!isMoving && activeManifest.animations['idle']) {
          player.play('idle');
          updateActiveAnimCard('idle');
        }
      });

      // 4. Initialize 2D Canvas Renderer
      canvasRenderer = new (RiverCity.CanvasSpriteRenderer || CanvasSpriteRenderer)({
        image: activeImage,
        scale: canvasScale,
        disableSmoothing: true
      });

      // 5. Initialize Three.js Adapter (if WebGL renderer active)
      if (threeRenderer) {
        if (threeAdapter) {
          threeAdapter.dispose(false);
        }

        const loader = new THREE.TextureLoader();
        activeThreeTexture = loader.load(config.imagePath, () => {
          if (threeAdapter) threeAdapter.configureTexture(activeThreeTexture);
        });

        threeAdapter = new (RiverCity.ThreeSpriteAdapter || ThreeSpriteAdapter)({
          THREE,
          manifest: activeManifest,
          texture: activeThreeTexture,
          player,
          pixelsPerUnit: 0.05 // 20px = 1 world unit
        });

        threeScene.add(threeAdapter.mesh);
        updatePlayer3DPosition();

        // 6. Initialize Rival Character (facing left, showing depth sorting)
        setupRivalCharacter();
      }

      // 7. Update UI
      renderAtlasCanvas();
      populateAnimationLibrary();
      populateQuickActionButtons();
      updateFrameInspector();
      updateScrubberBounds();

      sheetDimPill.textContent = `${activeImage.width}x${activeImage.height} px`;
      animCountPill.textContent = `${Object.keys(activeManifest.animations).length} Actions`;

    } catch (err) {
      console.error('Failed to load preset:', err);
    }
  }

  function setupRivalCharacter() {
    if (rivalAdapter) {
      rivalAdapter.dispose(false);
      rivalAdapter = null;
    }

    if (!showRival) {
      if (rivalShadowMesh) rivalShadowMesh.visible = false;
      return;
    }

    // Determine rival preset (if player is expanded/basic Alex, rival is Ryan; if player is Ryan, rival is Alex)
    const rivalPresetKey = currentPresetKey === 'ryan' ? 'expanded' : 'ryan';
    const rivalPreset = PRESETS[rivalPresetKey] || PRESETS.expanded;

    // Load rival manifest and texture
    fetch(rivalPreset.manifestPath)
      .then(r => r.json())
      .then(rivalManifest => {
        if (!threeScene || !showRival) return;
        const rivalTex = new THREE.TextureLoader().load(rivalPreset.imagePath);

        rivalPlayer = new (RiverCity.SpritePlayer || SpritePlayer)(rivalManifest, {
          initialAnimation: 'idle',
          facing: 'left',
          speed: 1.0,
          autoPlay: true
        });

        rivalAdapter = new (RiverCity.ThreeSpriteAdapter || ThreeSpriteAdapter)({
          THREE,
          manifest: rivalManifest,
          texture: rivalTex,
          player: rivalPlayer,
          pixelsPerUnit: 0.05
        });

        rivalAdapter.mesh.position.set(2.2, 0, -1.0);
        threeScene.add(rivalAdapter.mesh);

        if (rivalShadowMesh) {
          rivalShadowMesh.visible = showShadows;
          rivalShadowMesh.position.set(2.2, 0.005, -1.0);
        }
      })
      .catch(() => {
        // Fallback to activeManifest if fetch fails
        rivalPlayer = new (RiverCity.SpritePlayer || SpritePlayer)(activeManifest, {
          initialAnimation: 'idle',
          facing: 'left',
          speed: 1.0,
          autoPlay: true
        });

        rivalAdapter = new (RiverCity.ThreeSpriteAdapter || ThreeSpriteAdapter)({
          THREE,
          manifest: activeManifest,
          texture: activeThreeTexture,
          player: rivalPlayer,
          pixelsPerUnit: 0.05
        });

        rivalAdapter.mesh.position.set(2.2, 0, -1.0);
        threeScene.add(rivalAdapter.mesh);
      });
  }

  /**
   * Main Render Loop (Unified Clock)
   */
  function renderLoop(now) {
    requestAnimationFrame(renderLoop);

    const deltaMs = Math.min(now - lastTimestamp, 100); // Clamp large delta spikes
    lastTimestamp = now;

    // Handle 2.5D Movement Input
    handleMovement(deltaMs);

    // Update Three.js Adapter & Runtime Clock
    if (isPlaying && threeAdapter && player) {
      threeAdapter.update(deltaMs);
    }

    // Update Rival if present
    if (rivalAdapter && rivalPlayer) {
      rivalAdapter.update(deltaMs);
    }

    // Update Orbit Controls
    if (orbitControls) {
      orbitControls.update();
    }

    // Render Three.js Scene
    if (threeRenderer && threeScene && threeCamera) {
      threeRenderer.render(threeScene, threeCamera);
    }

    // Render 2D Canvas Inspector
    renderCanvasInspector();

    // Sync Scrubber and Readouts
    syncTimelineUI();

    // Highlight active frame on Atlas Canvas
    highlightAtlasActiveFrame();
  }

  /**
   * 2.5D Belt-Scroll Movement Handling
   */
  function handleMovement(deltaMs) {
    if (!player || !threeAdapter) return;

    let moveX = 0;
    let moveZ = 0;
    const speed = 0.0035 * deltaMs; // World units per frame

    if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) moveX -= speed;
    if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) moveX += speed;
    if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) moveZ -= speed;
    if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) moveZ += speed;

    if (moveX !== 0 || moveZ !== 0) {
      // Movement active
      playerPos.x = Math.max(-5, Math.min(5, playerPos.x + moveX));
      playerPos.z = Math.max(-3, Math.min(3, playerPos.z + moveZ));

      // Auto-set facing based on horizontal direction
      if (moveX > 0 && player.facing !== 'right') {
        player.setFacing('right');
        updateFacingUI();
      } else if (moveX < 0 && player.facing !== 'left') {
        player.setFacing('left');
        updateFacingUI();
      }

      // If moving and not currently in an attack/hurt action, switch to walk
      const currentAnim = player.currentAnimationName;
      if (!isMoving && currentAnim !== 'walk' && currentAnim !== 'punch' && currentAnim !== 'kick' && currentAnim !== 'hurt') {
        if (activeManifest.animations['walk']) {
          player.play('walk');
          updateActiveAnimCard('walk');
        }
      }
      isMoving = true;
    } else {
      if (isMoving) {
        // Just stopped moving
        isMoving = false;
        if (player.currentAnimationName === 'walk' && activeManifest.animations['idle']) {
          player.play('idle');
          updateActiveAnimCard('idle');
        }
      }
    }

    updatePlayer3DPosition();
  }

  function updatePlayer3DPosition() {
    if (threeAdapter && threeAdapter.mesh) {
      threeAdapter.mesh.position.set(playerPos.x, playerPos.y, playerPos.z);
    }
    if (shadowMesh) {
      shadowMesh.position.set(playerPos.x, 0.005, playerPos.z);
      shadowMesh.visible = showShadows;
    }
  }

  /**
   * Render 2D Pixel Canvas Inspector
   */
  function renderCanvasInspector() {
    if (!pixelCtx || !player || !canvasRenderer || !activeImage) return;

    const w = pixelCanvas.width;
    const h = pixelCanvas.height;
    pixelCtx.clearRect(0, 0, w, h);

    // Sole ground anchor is placed at canvas center (w/2, h/2 + 60)
    const centerX = w / 2;
    const centerY = h / 2 + 60;

    // Render sprite
    canvasRenderer.setScale(canvasScale);
    canvasRenderer.render(pixelCtx, player, centerX, centerY, {
      showAnchor,
      showRect,
      showHitboxes
    });

    // Draw reference ground line
    pixelCtx.save();
    pixelCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    pixelCtx.setLineDash([4, 4]);
    pixelCtx.beginPath();
    pixelCtx.moveTo(20, centerY);
    pixelCtx.lineTo(w - 20, centerY);
    pixelCtx.stroke();
    pixelCtx.restore();
  }

  /**
   * Render Full Sprite Sheet Atlas
   */
  function renderAtlasCanvas() {
    if (!atlasCtx || !activeImage) return;

    const scale = 2; // 2x preview in atlas viewer
    atlasCanvas.width = activeImage.width * scale;
    atlasCanvas.height = activeImage.height * scale;

    atlasCtx.imageSmoothingEnabled = false;
    atlasCtx.clearRect(0, 0, atlasCanvas.width, atlasCanvas.height);
    atlasCtx.drawImage(activeImage, 0, 0, atlasCanvas.width, atlasCanvas.height);

    // Draw frame division guides
    atlasCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    atlasCtx.lineWidth = 1;
    for (let x = 0; x <= atlasCanvas.width; x += 32 * scale) {
      atlasCtx.beginPath();
      atlasCtx.moveTo(x, 0);
      atlasCtx.lineTo(x, atlasCanvas.height);
      atlasCtx.stroke();
    }
  }

  /**
   * Highlight Currently Active Frame on Atlas Canvas
   */
  function highlightAtlasActiveFrame() {
    if (!atlasCtx || !activeImage || !player) return;

    renderAtlasCanvas();

    const frameInfo = player.getCurrentFrame();
    if (!frameInfo || !frameInfo.frame) return;

    const [sx, sy, sw, sh] = frameInfo.frame.rect;
    const scale = 2;

    atlasCtx.save();
    // Highlight active bounding box with glowing cyan rect
    atlasCtx.strokeStyle = '#00e5ff';
    atlasCtx.lineWidth = 2;
    atlasCtx.strokeRect(sx * scale, sy * scale, sw * scale, sh * scale);

    // Anchor dot
    const [ax, ay] = frameInfo.frame.anchor;
    atlasCtx.fillStyle = '#ff3366';
    atlasCtx.beginPath();
    atlasCtx.arc((sx + ax) * scale, (sy + ay) * scale, 3, 0, Math.PI * 2);
    atlasCtx.fill();
    atlasCtx.restore();

    updateFrameInspector(frameInfo.frameId, frameInfo.frame);
  }

  /**
   * Populate Animation Library UI Cards
   */
  function populateAnimationLibrary() {
    animList.innerHTML = '';
    if (!activeManifest || !activeManifest.animations) return;

    for (const [name, anim] of Object.entries(activeManifest.animations)) {
      const card = document.createElement('div');
      card.className = `anim-card ${name === player.currentAnimationName ? 'active' : ''}`;
      card.dataset.anim = name;

      const totalDuration = anim.frames.reduce((acc, f) => acc + (f.durationMs || 0), 0);
      const ticks = (totalDuration / 16.666).toFixed(1);
      const isLoop = anim.loop !== false;
      const hasEvents = anim.frames.some(f => f.events || f.event);

      card.innerHTML = `
        <div class="anim-name">${name}</div>
        <div class="anim-meta">${totalDuration}ms • ${ticks}t • ${anim.frames.length}f</div>
        <div class="anim-badge-row">
          <span class="badge-tag ${isLoop ? 'loop' : ''}">${isLoop ? 'LOOP' : 'ONESHOT'}</span>
          ${hasEvents ? '<span class="badge-tag event">EVENT</span>' : ''}
        </div>
      `;

      card.addEventListener('click', () => {
        playAnimation(name);
      });

      animList.appendChild(card);
    }
  }

  /**
   * Populate Quick Action Buttons
   */
  function populateQuickActionButtons() {
    quickActionButtons.innerHTML = '';
    if (!activeManifest || !activeManifest.animations) return;

    const priorityOrder = ['idle', 'walk', 'punch', 'kick', 'hurt', 'down'];
    for (const action of priorityOrder) {
      if (activeManifest.animations[action]) {
        const btn = document.createElement('button');
        btn.className = 'action-trigger-btn';
        btn.textContent = action.toUpperCase();
        btn.addEventListener('click', () => playAnimation(action));
        quickActionButtons.appendChild(btn);
      }
    }
  }

  function playAnimation(name) {
    if (!player || !activeManifest.animations[name]) return;
    player.play(name);
    isPlaying = true;
    updatePlayPauseButton();
    updateActiveAnimCard(name);
    updateScrubberBounds();
  }

  function updateActiveAnimCard(name) {
    const cards = animList.querySelectorAll('.anim-card');
    cards.forEach(c => {
      c.classList.toggle('active', c.dataset.anim === name);
    });
  }

  /**
   * Update Frame Inspector Data Table
   */
  function updateFrameInspector(frameId, frameData) {
    if (!frameId || !frameData) {
      const cur = player ? player.getCurrentFrame() : null;
      if (cur) {
        frameId = cur.frameId;
        frameData = cur.frame;
      }
    }
    if (!frameId || !frameData) return;

    detailFrameId.textContent = frameId;
    detailFrameRect.textContent = `[${frameData.rect.join(', ')}] (${frameData.rect[2]}x${frameData.rect[3]}px)`;
    detailFrameAnchor.textContent = `[${frameData.anchor.join(', ')}] (Sole Grounded)`;

    const cur = player ? player.getCurrentFrame() : null;
    const dur = cur ? cur.durationMs : '-';
    const ticks = cur ? (cur.durationMs / 16.666).toFixed(1) : '-';
    detailFrameTicks.textContent = `${dur} ms (${ticks} ticks @ 60Hz)`;

    if (Array.isArray(frameData.hitboxes) && frameData.hitboxes.length > 0) {
      const hbs = frameData.hitboxes.map(h => `${h.id || h.type}: [${h.rect.join(',')}]`).join('; ');
      detailFrameHitboxes.textContent = hbs;
      detailFrameHitboxes.style.color = '#ff9100';
    } else {
      detailFrameHitboxes.textContent = 'None';
      detailFrameHitboxes.style.color = 'var(--text-muted)';
    }
  }

  /**
   * Scrubber and Timeline Sync
   */
  function updateScrubberBounds() {
    if (!player) return;
    const total = player.getDuration ? player.getDuration() : (player.currentAnimation ? player.currentAnimation.totalDurationMs : 0);
    timelineScrubber.max = total;
  }

  function syncTimelineUI() {
    if (!player) return;

    const curTime = Math.round(player.currentTimeMs);
    const totalTime = player.getDuration ? player.getDuration() : (player.currentAnimation ? player.currentAnimation.totalDurationMs : 0);
    const ticks = (curTime / 16.666).toFixed(1);

    if (document.activeElement !== timelineScrubber) {
      timelineScrubber.value = curTime;
    }

    const curFrame = player.getCurrentFrame();
    const frameIndex = curFrame ? curFrame.index + 1 : 1;
    const frameCount = player.currentAnimation ? player.currentAnimation.frames.length : 1;

    timecodeDisplay.textContent = `${curTime}ms / ${totalTime}ms • Frame ${frameIndex}/${frameCount} • ${ticks}t`;
  }

  /**
   * Flash Event Badge on Discrete Events
   */
  function triggerEventFlash(eventName) {
    eventBadge.textContent = `EVENT: ${eventName}`;
    eventBadge.classList.add('flash');
    setTimeout(() => {
      eventBadge.classList.remove('flash');
    }, 400);
  }

  function updatePlayPauseButton() {
    if (isPlaying) {
      playPauseIcon.textContent = '⏸';
      playPauseText.textContent = 'Pause';
      btnPlayPause.classList.add('btn-primary');
    } else {
      playPauseIcon.textContent = '▶';
      playPauseText.textContent = 'Play';
      btnPlayPause.classList.remove('btn-primary');
    }
  }

  function updateFacingUI() {
    if (!player) return;
    facingLabel.textContent = player.facing === 'right' ? 'Right ➔' : '⬅ Left';
  }

  /**
   * Set View Mode: Three, Canvas, or Split
   */
  function setViewMode(mode) {
    currentViewMode = mode;
    tabThree.classList.toggle('active', mode === 'three-view');
    tabCanvas.classList.toggle('active', mode === 'canvas-view');
    tabSplit.classList.toggle('active', mode === 'split-view');

    if (mode === 'three-view') {
      threeStage.style.display = 'block';
      threeStage.style.width = '100%';
      canvasStage.style.display = 'none';
      threeTools.style.display = 'flex';
      canvasTools.style.display = 'none';
    } else if (mode === 'canvas-view') {
      threeStage.style.display = 'none';
      canvasStage.style.display = 'flex';
      canvasStage.style.width = '100%';
      threeTools.style.display = 'none';
      canvasTools.style.display = 'flex';
    } else if (mode === 'split-view') {
      threeStage.style.display = 'block';
      threeStage.style.width = '50%';
      threeStage.style.float = 'left';
      canvasStage.style.display = 'flex';
      canvasStage.style.width = '50%';
      canvasStage.style.float = 'left';
      threeTools.style.display = 'flex';
      canvasTools.style.display = 'flex';
    }
    onWindowResize();
  }

  /**
   * Event Listeners Setup
   */
  function setupEventListeners() {
    // Character Preset Dropdown
    charSelect.addEventListener('change', (e) => {
      currentPresetKey = e.target.value;
      loadPreset(currentPresetKey);
    });

    // View Tabs
    tabThree.addEventListener('click', () => setViewMode('three-view'));
    tabCanvas.addEventListener('click', () => setViewMode('canvas-view'));
    tabSplit.addEventListener('click', () => setViewMode('split-view'));

    // Play / Pause
    btnPlayPause.addEventListener('click', () => {
      isPlaying = !isPlaying;
      if (isPlaying) {
        player.resume();
      } else {
        player.pause();
      }
      updatePlayPauseButton();
    });

    // Step Forward / Backward
    btnStepNext.addEventListener('click', () => {
      player.pause();
      isPlaying = false;
      updatePlayPauseButton();
      player.step(1);
      if (threeAdapter) threeAdapter.syncFrame(true);
    });

    btnStepPrev.addEventListener('click', () => {
      player.pause();
      isPlaying = false;
      updatePlayPauseButton();
      player.step(-1);
      if (threeAdapter) threeAdapter.syncFrame(true);
    });

    // Reset
    btnReset.addEventListener('click', () => {
      player.seek(0);
      if (threeAdapter) threeAdapter.syncFrame(true);
    });

    // Speed Controls
    speedButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        speedButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        baseSpeed = parseFloat(btn.dataset.speed);
        if (player) player.setSpeed(baseSpeed);
      });
    });

    // Facing Toggle
    btnToggleFacing.addEventListener('click', () => {
      if (!player) return;
      const nextFacing = player.facing === 'right' ? 'left' : 'right';
      player.setFacing(nextFacing);
      updateFacingUI();
      if (threeAdapter) threeAdapter.syncFrame(true);
    });

    // Scrubber
    timelineScrubber.addEventListener('input', (e) => {
      if (!player) return;
      player.pause();
      isPlaying = false;
      updatePlayPauseButton();
      player.seek(parseFloat(e.target.value));
      if (threeAdapter) threeAdapter.syncFrame(true);
    });

    // Camera Views
    btnCam25D.addEventListener('click', () => {
      btnCam25D.classList.add('active');
      btnCamFront.classList.remove('active');
      btnCamIso.classList.remove('active');
      setCameraPreset('25d');
    });

    btnCamFront.addEventListener('click', () => {
      btnCam25D.classList.remove('active');
      btnCamFront.classList.add('active');
      btnCamIso.classList.remove('active');
      setCameraPreset('front');
    });

    btnCamIso.addEventListener('click', () => {
      btnCam25D.classList.remove('active');
      btnCamFront.classList.remove('active');
      btnCamIso.classList.add('active');
      setCameraPreset('iso');
    });

    // Rival Brawler Toggle
    btnRivalToggle.addEventListener('click', () => {
      showRival = !showRival;
      btnRivalToggle.classList.toggle('active', showRival);
      if (rivalAdapter && rivalAdapter.mesh) {
        rivalAdapter.mesh.visible = showRival;
      }
      if (rivalShadowMesh) {
        rivalShadowMesh.visible = showRival && showShadows;
      }
    });

    // Shadows Toggle
    btnShadowsToggle.addEventListener('click', () => {
      showShadows = !showShadows;
      btnShadowsToggle.classList.toggle('active', showShadows);
      if (shadowMesh) shadowMesh.visible = showShadows;
      if (rivalShadowMesh) rivalShadowMesh.visible = showRival && showShadows;
    });

    // Canvas Tools
    btnShowAnchor.addEventListener('click', () => {
      showAnchor = !showAnchor;
      btnShowAnchor.classList.toggle('active', showAnchor);
    });

    btnShowRect.addEventListener('click', () => {
      showRect = !showRect;
      btnShowRect.classList.toggle('active', showRect);
    });

    btnShowHitboxes.addEventListener('click', () => {
      showHitboxes = !showHitboxes;
      btnShowHitboxes.classList.toggle('active', showHitboxes);
    });

    btnScaleToggle.addEventListener('click', () => {
      if (canvasScale === 4) canvasScale = 6;
      else if (canvasScale === 6) canvasScale = 8;
      else canvasScale = 4;
      btnScaleToggle.textContent = `Scale: ${canvasScale}x`;
    });

    // Atlas Click to Inspect Frame
    atlasCanvas.addEventListener('click', (e) => {
      if (!activeManifest || !activeManifest.frames) return;
      const rect = atlasCanvas.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) / 2; // account for 2x scale
      const clickY = (e.clientY - rect.top) / 2;

      for (const [id, f] of Object.entries(activeManifest.frames)) {
        const [fx, fy, fw, fh] = f.rect;
        if (clickX >= fx && clickX <= fx + fw && clickY >= fy && clickY <= fy + fh) {
          updateFrameInspector(id, f);
          break;
        }
      }
    });

    // Keyboard Controls (Belt-Scroll Movement + Action Strikes)
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      keysDown.add(e.code);

      if (e.code === 'KeyJ') {
        playAnimation('punch');
      } else if (e.code === 'KeyK') {
        if (activeManifest.animations['kick']) playAnimation('kick');
        else playAnimation('punch');
      } else if (e.code === 'KeyH') {
        if (activeManifest.animations['hurt']) playAnimation('hurt');
      } else if (e.code === 'Space') {
        if (activeManifest.animations['kick']) playAnimation('kick');
        else playAnimation('punch');
      }
    });

    window.addEventListener('keyup', (e) => {
      keysDown.delete(e.code);
    });
  }

  // Expose demo API for programmatic inspection and automated testing
  window.demoApp = {
    loadPreset,
    playAnimation,
    getPlayer: () => player,
    getAdapter: () => threeAdapter,
    getCanvasRenderer: () => canvasRenderer,
    setFacing: (f) => player && player.setFacing(f),
    getActiveManifest: () => activeManifest
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
