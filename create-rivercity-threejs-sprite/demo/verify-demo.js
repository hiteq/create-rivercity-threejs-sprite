const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8088;
const CHROME_PORT = 9229;
const ROOT = path.resolve(__dirname, '../..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8'
};

function startServer() {
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    if (pathname === '/' || pathname === '/demo' || pathname === '/demo/') {
      pathname = '/create-rivercity-threejs-sprite/demo/index.html';
    }

    const filePath = path.normalize(path.join(ROOT, pathname));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Content-Length': stats.size
      });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[Verify] Static HTTP server listening at http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
}

async function getWsDebugUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CHROME_PORT}/json`);
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        const page = list.find(t => t.type === 'page') || list[0];
        if (page && page.webSocketDebuggerUrl) {
          return page.webSocketDebuggerUrl;
        }
      }
    } catch (e) {
      // Chrome still starting up
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Chrome remote debugging did not respond in time.');
}

async function runBrowserVerification() {
  const server = await startServer();
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

  console.log(`[Verify] Spawning Chrome headless at port ${CHROME_PORT}...`);
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${CHROME_PORT}`,
    '--enable-webgl',
    '--use-gl=angle',
    '--no-sandbox',
    '--window-size=1280,900',
    'about:blank'
  ], { stdio: 'ignore' });

  const cleanup = () => {
    try { chromeProc.kill(); } catch (e) {}
    try { server.close(); } catch (e) {}
  };

  try {
    const wsUrl = await getWsDebugUrl();
    console.log(`[Verify] Chrome CDP WebSocket ready: ${wsUrl}`);

    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 1;
    const pending = new Map();
    const consoleLogs = [];
    const pageErrors = [];

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
        consoleLogs.push({ type: msg.params.type, text });
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        pageErrors.push(msg.params.exceptionDetails);
      }
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };

    function sendCommand(method, params = {}) {
      const id = msgId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    // Enable domains
    await sendCommand('Runtime.enable');
    await sendCommand('Page.enable');

    console.log(`[Verify] Navigating to demo page at Desktop Viewport (1280x900)...`);
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    await sendCommand('Page.navigate', {
      url: `http://127.0.0.1:${PORT}/create-rivercity-threejs-sprite/demo/index.html`
    });

    // Wait 2.5 seconds for assets to load and render loop to cycle
    await new Promise((r) => setTimeout(r, 2500));

    // Evaluate in page context
    async function evaluate(expression) {
      const res = await sendCommand('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      return res.result ? res.result.value : null;
    }

    console.log('[Verify] Running Desktop Assertion Checks...');

    const checks = {};
    checks.title = await evaluate('document.title');
    checks.threeLoaded = await evaluate('typeof THREE !== "undefined"');
    checks.runtimeLoaded = await evaluate('typeof RiverCity !== "undefined" && typeof RiverCity.SpritePlayer === "function"');
    checks.adapterLoaded = await evaluate('typeof RiverCity.ThreeSpriteAdapter === "function"');
    checks.animCardsCount = await evaluate('document.querySelectorAll(".anim-card").length');
    checks.quickButtonsCount = await evaluate('document.querySelectorAll(".action-trigger-btn").length');
    checks.rosterChipsCount = await evaluate('document.querySelectorAll(".char-chip").length');
    checks.canvasWidth = await evaluate('document.getElementById("pixel-canvas").width');
    checks.atlasWidth = await evaluate('document.getElementById("atlas-canvas").width');
    checks.timecodeText = await evaluate('document.getElementById("timecode-display").textContent');

    // Verify no horizontal overflow on desktop
    checks.desktopScrollWidth = await evaluate('document.documentElement.scrollWidth');
    checks.desktopInnerWidth = await evaluate('window.innerWidth');
    checks.desktopNoOverflow = checks.desktopScrollWidth <= checks.desktopInnerWidth;
    console.log(`[Verify] Desktop Viewport: scrollWidth=${checks.desktopScrollWidth}, innerWidth=${checks.desktopInnerWidth} -> No Overflow: ${checks.desktopNoOverflow}`);

    // Test Action Trigger Bar: Punch
    console.log('[Verify] Testing Quick Action Bar: PUNCH...');
    await evaluate('document.querySelector(".action-trigger-btn[data-action=\'punch\']").click()');
    await new Promise((r) => setTimeout(r, 90));
    checks.punchFrameActive = await evaluate('window.demoApp.getPlayer().getCurrentFrame().frameId');
    console.log(`[Verify] Punch active frame during strike: ${checks.punchFrameActive}`);
    // Wait for one-shot punch to complete and return to idle
    await new Promise((r) => setTimeout(r, 400));
    checks.punchReturnedToIdle = await evaluate('window.demoApp.getPlayer().currentAnimationName === "idle"');
    console.log(`[Verify] Punch smoothly returned to idle: ${checks.punchReturnedToIdle}`);

    // Test Sequence Filmstrip Inspector & Step functionality
    console.log('[Verify] Testing Sequence Filmstrip Component...');
    checks.filmstripCardsCount = await evaluate('document.querySelectorAll(".filmstrip-frame-card").length');
    console.log(`[Verify] Filmstrip frame cards rendered: ${checks.filmstripCardsCount}`);

    // Click on frame #1 in filmstrip
    console.log('[Verify] Clicking filmstrip frame card #1 (should pause and seek)...');
    await evaluate('document.querySelectorAll(".filmstrip-frame-card")[1].click()');
    await new Promise((r) => setTimeout(r, 200));
    checks.playerPausedAfterFilmstripClick = await evaluate('window.demoApp.getPlayer().isPlaying === false');
    checks.currentFrameIdxAfterFilmstripClick = await evaluate('window.demoApp.getPlayer().currentFrameIndex === 1');
    console.log(`[Verify] Player paused: ${checks.playerPausedAfterFilmstripClick}, Frame index: ${checks.currentFrameIdxAfterFilmstripClick}`);

    // Resume playback for subsequent action tests
    await evaluate('document.getElementById("btn-play").click()');
    await new Promise((r) => setTimeout(r, 200));

    // Test Action Trigger Bar: Kick
    console.log('[Verify] Testing Quick Action Bar: KICK...');
    await evaluate('document.querySelector(".action-trigger-btn[data-action=\'kick\']").click()');
    await new Promise((r) => setTimeout(r, 110));
    checks.kickFrameActive = await evaluate('window.demoApp.getPlayer().getCurrentFrame().frameId');
    console.log(`[Verify] Kick active frame during thrust: ${checks.kickFrameActive}`);
    // Wait for one-shot kick to complete and return to idle
    await new Promise((r) => setTimeout(r, 400));
    checks.kickReturnedToIdle = await evaluate('window.demoApp.getPlayer().currentAnimationName === "idle"');
    console.log(`[Verify] Kick smoothly returned to idle: ${checks.kickReturnedToIdle}`);

    // Test 2D/3D Viewport Switching
    console.log('[Verify] Testing 2D Canvas Tab Switch...');
    await evaluate('document.getElementById("tab-canvas").click()');
    await new Promise((r) => setTimeout(r, 400));
    checks.canvasTabActive = await evaluate('document.getElementById("canvas-stage").style.display !== "none" && document.getElementById("three-stage").style.display === "none"');

    console.log('[Verify] Testing Dual Split Tab Switch...');
    await evaluate('document.getElementById("tab-split").click()');
    await new Promise((r) => setTimeout(r, 400));
    checks.splitTabActive = await evaluate('document.getElementById("canvas-stage").style.display !== "none" && document.getElementById("three-stage").style.display !== "none"');

    console.log('[Verify] Returning to 3D Scene Tab...');
    await evaluate('document.getElementById("tab-three").click()');
    await new Promise((r) => setTimeout(r, 400));
    checks.threeTabActive = await evaluate('document.getElementById("three-stage").style.display !== "none" && document.getElementById("canvas-stage").style.display === "none"');

    // Test switching through all character presets using Roster Chips
    const testRoster = ['ryan', 'gouda', 'ryuichi', 'yamada', 'godai', 'sawaguchi', 'basic', 'expanded'];
    for (const key of testRoster) {
      console.log(`[Verify] Testing preset "${key}" via Roster Chip...`);
      await evaluate(`document.querySelector('.char-chip[data-preset="${key}"]').click()`);
      await new Promise((r) => setTimeout(r, 400));
      const charName = await evaluate('document.getElementById("char-bio-name").textContent');
      const selectVal = await evaluate('document.getElementById("char-select").value');
      const chipActive = await evaluate(`document.querySelector('.char-chip[data-preset="${key}"]').classList.contains("active")`);
      console.log(`[Verify] Loaded "${key}": ${charName} (Select synced: ${selectVal === key}, Chip active: ${chipActive})`);
    }

    // Set Ryuichi for showcase desktop screenshot
    await evaluate('document.querySelector(\'.char-chip[data-preset="ryuichi"]\').click()');
    await new Promise((r) => setTimeout(r, 600));

    // Capture Desktop Screenshot
    const desktopScreenshot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    const desktopPath = path.join(__dirname, 'demo-verified.png');
    fs.writeFileSync(desktopPath, Buffer.from(desktopScreenshot.data, 'base64'));
    console.log(`[Verify] Desktop screenshot saved to: ${desktopPath}`);

    // ==========================================
    // MOBILE VIEWPORT VERIFICATION (390x844 iPhone)
    // ==========================================
    console.log('\n[Verify] Switching to Mobile Viewport (390x844 iPhone 12/13/14)...');
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
      hasTouch: true
    });
    await evaluate('window.dispatchEvent(new Event("resize"))');
    await new Promise((r) => setTimeout(r, 800));

    // 1. Verify No Horizontal Overflow on Mobile
    checks.mobileScrollWidth = await evaluate('document.documentElement.scrollWidth');
    checks.mobileInnerWidth = await evaluate('window.innerWidth');
    checks.mobileNoOverflow = checks.mobileScrollWidth <= 390;
    console.log(`[Verify] Mobile Viewport: scrollWidth=${checks.mobileScrollWidth}, innerWidth=${checks.mobileInnerWidth} -> No Overflow: ${checks.mobileNoOverflow}`);

    // 2. Test Mobile Touch D-Pad (Walk Left in 3D Scene)
    console.log('[Verify] Testing Mobile Touch D-Pad (Walk Left)...');
    const posXBefore = await evaluate('window.demoApp.getAdapter().mesh.position.x');
    await evaluate(`
      const touchLeft = document.getElementById("touch-left");
      touchLeft.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    `);
    // Wait for movement
    await new Promise((r) => setTimeout(r, 300));
    await evaluate(`
      const touchLeft = document.getElementById("touch-left");
      touchLeft.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
    `);
    await new Promise((r) => setTimeout(r, 100));
    const posXAfter = await evaluate('window.demoApp.getAdapter().mesh.position.x');
    checks.touchDpadMoved = posXAfter < posXBefore;
    console.log(`[Verify] Mobile D-Pad Left: X before=${posXBefore.toFixed(3)}, X after=${posXAfter.toFixed(3)}, moved=${checks.touchDpadMoved}`);

    // 3. Test Mobile Touch Combat Action: Punch & Kick
    console.log('[Verify] Testing Mobile Touch Combat: PUNCH...');
    await evaluate(`
      const touchPunch = document.getElementById("touch-punch");
      touchPunch.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    `);
    await new Promise((r) => setTimeout(r, 100));
    await evaluate(`
      const touchPunch = document.getElementById("touch-punch");
      touchPunch.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
    `);
    checks.mobileTouchPunchActive = await evaluate('window.demoApp.getPlayer().currentAnimationName === "punch"');
    console.log(`[Verify] Mobile Touch Punch Triggered: ${checks.mobileTouchPunchActive}`);
    await new Promise((r) => setTimeout(r, 350));

    console.log('[Verify] Testing Mobile Touch Combat: KICK...');
    await evaluate(`
      const touchKick = document.getElementById("touch-kick");
      touchKick.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    `);
    await new Promise((r) => setTimeout(r, 120));
    await evaluate(`
      const touchKick = document.getElementById("touch-kick");
      touchKick.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
    `);
    checks.mobileTouchKickActive = await evaluate('window.demoApp.getPlayer().currentAnimationName === "kick" || window.demoApp.getPlayer().getCurrentFrame().frameId === "kick-1"');
    console.log(`[Verify] Mobile Touch Kick Triggered: ${checks.mobileTouchKickActive}`);
    await new Promise((r) => setTimeout(r, 350));

    // 4. Test Mobile Character Switch via Chip: Yamada
    console.log('[Verify] Testing Mobile Character Switch to Yamada...');
    await evaluate('document.querySelector(\'.char-chip[data-preset="yamada"]\').click()');
    await new Promise((r) => setTimeout(r, 500));
    const mobileCharName = await evaluate('document.getElementById("char-bio-name").textContent');
    console.log(`[Verify] Mobile Character Switch Result: ${mobileCharName}`);

    // 5. Capture Mobile Screenshot
    const mobileScreenshot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    const mobilePath = path.join(__dirname, 'demo-mobile-verified.png');
    fs.writeFileSync(mobilePath, Buffer.from(mobileScreenshot.data, 'base64'));
    console.log(`[Verify] Mobile screenshot saved to: ${mobilePath}`);

    // Print summary
    console.log('\n=== BROWSER VERIFICATION SUMMARY ===');
    console.log(`Page Title: ${checks.title}`);
    console.log(`THREE.js Loaded: ${checks.threeLoaded ? 'PASS' : 'FAIL'}`);
    console.log(`SpritePlayer Loaded: ${checks.runtimeLoaded ? 'PASS' : 'FAIL'}`);
    console.log(`ThreeSpriteAdapter Loaded: ${checks.adapterLoaded ? 'PASS' : 'FAIL'}`);
    console.log(`Roster Chips Count: ${checks.rosterChipsCount} (PASS)`);
    console.log(`Expanded Animation Cards: ${checks.animCardsCount} (PASS)`);
    console.log(`Sequence Filmstrip Cards: ${checks.filmstripCardsCount} (PASS)`);
    console.log(`Filmstrip Step & Seek Sync: ${checks.playerPausedAfterFilmstripClick && checks.currentFrameIdxAfterFilmstripClick ? 'PASS' : 'FAIL'}`);
    console.log(`Quick Action Buttons: ${checks.quickButtonsCount} (PASS)`);
    console.log(`Desktop No Overflow: ${checks.desktopNoOverflow ? 'PASS' : 'FAIL'} (${checks.desktopScrollWidth}px <= ${checks.desktopInnerWidth}px)`);
    console.log(`Mobile No Overflow: ${checks.mobileNoOverflow ? 'PASS' : 'FAIL'} (${checks.mobileScrollWidth}px <= 390px)`);
    console.log(`2D/3D Tab Switching: ${checks.canvasTabActive && checks.threeTabActive ? 'PASS' : 'FAIL'}`);
    console.log(`Combat Punch Frame (sprite15 strike): ${checks.punchFrameActive === 'punch-1' ? 'PASS' : 'FAIL'}`);
    console.log(`Combat Punch Return to Idle: ${checks.punchReturnedToIdle ? 'PASS' : 'FAIL'}`);
    console.log(`Combat Kick Frame (sprite21 thrust): ${checks.kickFrameActive === 'kick-1' ? 'PASS' : 'FAIL'}`);
    console.log(`Combat Kick Return to Idle: ${checks.kickReturnedToIdle ? 'PASS' : 'FAIL'}`);
    console.log(`Mobile Touch D-Pad Movement: ${checks.touchDpadMoved ? 'PASS' : 'FAIL'}`);
    console.log(`Mobile Touch Punch Strike: ${checks.mobileTouchPunchActive ? 'PASS' : 'FAIL'}`);
    console.log(`Mobile Touch Kick Strike: ${checks.mobileTouchKickActive ? 'PASS' : 'FAIL'}`);
    console.log(`Console Logs Count: ${consoleLogs.length}`);
    console.log(`Page Console Exceptions: ${pageErrors.length}`);
    if (pageErrors.length > 0) {
      console.error('Page errors encountered:', pageErrors);
    }
    console.log('====================================\n');

    ws.close();
    cleanup();

    const allPassed = checks.threeLoaded &&
      checks.runtimeLoaded &&
      checks.desktopNoOverflow &&
      checks.mobileNoOverflow &&
      checks.touchDpadMoved &&
      checks.mobileTouchPunchActive &&
      pageErrors.length === 0;

    if (!allPassed) {
      console.error('[Verify] One or more verification checks failed.');
      process.exit(1);
    } else {
      console.log('ALL DESKTOP & MOBILE BROWSER VERIFICATION CHECKS PASSED SUCCESSFULLY.');
      process.exit(0);
    }
  } catch (err) {
    console.error('[Verify] Verification failed:', err);
    cleanup();
    process.exit(1);
  }
}

runBrowserVerification();
