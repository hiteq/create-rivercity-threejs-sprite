const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CHROME_PORT = 9223;
const LIVE_URL = 'https://hiteq.github.io/create-rivercity-threejs-sprite/';

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
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Chrome remote debugging did not respond in time.');
}

async function runLiveVerification() {
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

  console.log(`[Live Verify] Spawning Chrome headless at port ${CHROME_PORT}...`);
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
  };

  try {
    const wsUrl = await getWsDebugUrl();
    console.log(`[Live Verify] Chrome CDP WebSocket ready: ${wsUrl}`);

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

    await sendCommand('Runtime.enable');
    await sendCommand('Page.enable');

    console.log(`[Live Verify] Navigating to ${LIVE_URL}...`);
    await sendCommand('Page.navigate', { url: LIVE_URL });

    // Wait for redirect and assets to load
    await new Promise((r) => setTimeout(r, 4000));

    async function evaluate(expression) {
      const res = await sendCommand('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      return res.result ? res.result.value : null;
    }

    console.log('[Live Verify] Checking page state...');
    const checks = {};
    checks.finalUrl = await evaluate('window.location.href');
    checks.title = await evaluate('document.title');
    checks.threeLoaded = await evaluate('typeof THREE !== "undefined"');
    checks.runtimeLoaded = await evaluate('typeof RiverCity !== "undefined" && typeof RiverCity.SpritePlayer === "function"');
    checks.adapterLoaded = await evaluate('typeof RiverCity.ThreeSpriteAdapter === "function"');
    checks.animCardsCount = await evaluate('document.querySelectorAll(".anim-card").length');
    checks.quickButtonsCount = await evaluate('document.querySelectorAll(".action-trigger-btn").length');
    checks.canvasWidth = await evaluate('document.getElementById("pixel-canvas").width');
    checks.atlasWidth = await evaluate('document.getElementById("atlas-canvas").width');
    checks.threeCanvasExists = await evaluate('!!document.querySelector(".three-container canvas")');

    // Test interactivity: trigger punch action
    await evaluate('document.querySelector(".anim-card[data-anim=\'punch\']").click()');
    await new Promise((r) => setTimeout(r, 500));
    checks.punchActive = await evaluate('document.getElementById("detail-frame-id").textContent');

    // Test switching preset to ryan
    await evaluate('window.demoApp.loadPreset("ryan")');
    await new Promise((r) => setTimeout(r, 800));
    checks.ryanAnimCount = await evaluate('document.querySelectorAll(".anim-card").length');
    checks.ryanAtlasWidth = await evaluate('document.getElementById("atlas-canvas").width');

    // Test switching preset to basic
    await evaluate('window.demoApp.loadPreset("basic")');
    await new Promise((r) => setTimeout(r, 800));
    checks.basicAnimCount = await evaluate('document.querySelectorAll(".anim-card").length');
    checks.basicAtlasWidth = await evaluate('document.getElementById("atlas-canvas").width');

    // Test switching back to expanded
    await evaluate('window.demoApp.loadPreset("expanded")');
    await new Promise((r) => setTimeout(r, 800));
    checks.expandedAnimCount = await evaluate('document.querySelectorAll(".anim-card").length');

    // Test 3D camera orbit control interaction
    await evaluate(`
      const canvas = document.querySelector(".three-container canvas");
      if (canvas) {
        canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100, buttons: 1 }));
        canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 120, buttons: 1 }));
        canvas.dispatchEvent(new MouseEvent('mouseup', { clientX: 150, clientY: 120, buttons: 1 }));
      }
    `);

    // Capture screenshot
    const screenshotRes = await sendCommand('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = path.join(__dirname, 'demo-live-pages-verified.png');
    fs.writeFileSync(screenshotPath, Buffer.from(screenshotRes.data, 'base64'));
    console.log(`[Live Verify] Screenshot saved to: ${screenshotPath}`);

    console.log('\n=== LIVE GITHUB PAGES VERIFICATION RESULTS ===');
    console.log(`Final URL: ${checks.finalUrl}`);
    console.log(`Page Title: ${checks.title}`);
    console.log(`THREE.js Loaded: ${checks.threeLoaded ? 'PASS' : 'FAIL'}`);
    console.log(`RiverCity SpritePlayer Loaded: ${checks.runtimeLoaded ? 'PASS' : 'FAIL'}`);
    console.log(`ThreeSpriteAdapter Loaded: ${checks.adapterLoaded ? 'PASS' : 'FAIL'}`);
    console.log(`3D WebGL Canvas Active: ${checks.threeCanvasExists ? 'PASS' : 'FAIL'}`);
    console.log(`2D Pixel Canvas Width: ${checks.canvasWidth}px`);
    console.log(`Atlas Canvas Width: ${checks.atlasWidth}px`);
    console.log(`Expanded Animation Cards: ${checks.animCardsCount}`);
    console.log(`Quick Action Buttons: ${checks.quickButtonsCount}`);
    console.log(`Interactivity (Punch trigger): ${checks.punchActive}`);
    console.log(`Preset Switching (Basic -> ${checks.basicAnimCount} cards, Atlas: ${checks.basicAtlasWidth}px)`);
    console.log(`Preset Switching (Expanded -> ${checks.expandedAnimCount} cards)`);
    console.log(`Page Console Exceptions: ${pageErrors.length}`);
    if (pageErrors.length > 0) {
      console.error('Console errors:', pageErrors);
    }
    console.log('==============================================\n');

    ws.close();
    cleanup();

    if (!checks.threeLoaded || !checks.runtimeLoaded || !checks.threeCanvasExists || pageErrors.length > 0) {
      process.exit(1);
    } else {
      console.log('ALL LIVE GITHUB PAGES VERIFICATION CHECKS PASSED SUCCESSFULLY.');
      process.exit(0);
    }
  } catch (err) {
    console.error('[Live Verify] Error:', err);
    cleanup();
    process.exit(1);
  }
}

runLiveVerification();
