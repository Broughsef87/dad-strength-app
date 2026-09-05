// ── Chalk/Volt raster assets ─────────────────────────────────────────────────
// PNGs, PWA icons and favicon.ico from the SVGs generate-logo-suite.mjs writes.
//
//   node scripts/rasterize-logo-suite.mjs
//
// Two renderers, on purpose:
//   sharp     the pure-geometry marks — app icon, PWA icons, favicon sizes.
//             Exact, dependency-free (sharp ships with Next).
//   Chrome    the lockups. They carry "dad strength" in Space Grotesk, which is
//             not an installed font here, so librsvg would fall back to a system
//             face and the OG image would ship in the wrong type. Headless
//             Chrome loads the face from Google Fonts and renders the SVG as the
//             browser would. Same DevTools-protocol harness as the proof captures;
//             no dependencies beyond Node's fetch and WebSocket (Node 22+).
//
// favicon.ico is assembled by hand: an ICO is a small directory of images, and
// PNG payloads have been valid inside it since Vista. 16 / 32 / 48.
//
// The Chrome half refuses to produce a wrong asset rather than a fallback one:
// it fails when Node has no WebSocket, when the spawned Chrome cannot be
// reached on ITS OWN port, when a lockup document does not finish loading, and
// when either face is not a loaded FontFace. On every failure nothing is
// written and Chrome is torn down.
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUITE = path.resolve(__dirname, '../public/logo-suite');
const PUBLIC = path.resolve(__dirname, '../public');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const svg = (name) => fs.readFileSync(path.join(SUITE, name));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 1. geometry through sharp ───────────────────────────────────────────────
const png = async (name, size, out) => {
  const buf = await sharp(svg(name), { density: 144 }).resize(size, size).png().toBuffer();
  fs.writeFileSync(out, buf);
  console.log('wrote', path.relative(PUBLIC, out), size + 'px', buf.length + 'b');
  return buf;
};

await png('ds_app_icon.svg', 1024, path.join(SUITE, 'ds_app_icon.png'));
await png('ds_app_icon.svg', 512, path.join(PUBLIC, 'icon-512.png'));
await png('ds_app_icon.svg', 192, path.join(PUBLIC, 'icon-192.png'));

// favicon.ico — ICONDIR + ICONDIRENTRY[] + PNG payloads
const sizes = [16, 32, 48];
const payloads = [];
for (const s of sizes) payloads.push(await sharp(svg('ds_favicon.svg'), { density: 144 }).resize(s, s).png().toBuffer());
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
const entries = Buffer.alloc(16 * sizes.length);
let offset = 6 + entries.length;
sizes.forEach((s, i) => {
  const e = i * 16;
  entries.writeUInt8(s, e); entries.writeUInt8(s, e + 1); entries.writeUInt8(0, e + 2); entries.writeUInt8(0, e + 3);
  entries.writeUInt16LE(1, e + 4); entries.writeUInt16LE(32, e + 6);
  entries.writeUInt32LE(payloads[i].length, e + 8); entries.writeUInt32LE(offset, e + 12);
  offset += payloads[i].length;
});
const ico = Buffer.concat([header, entries, ...payloads]);
fs.writeFileSync(path.join(PUBLIC, 'favicon.ico'), ico);
console.log('wrote favicon.ico', sizes.join('/'), ico.length + 'b');

// ── 2. the lockups through Chrome ───────────────────────────────────────────
const LOCKUPS = [
  ['ds_banner_dark.svg', 1500, 500], ['ds_banner_light.svg', 1500, 500],
  ['ds_horizontal_dark.svg', 1200, 300], ['ds_horizontal_light.svg', 1200, 300],
];
// LOCKUP_FONTS_URL overrides the stylesheet — a test hook: point it somewhere
// unreachable and the run must fail before writing a single lockup.
const FONTS = process.env.LOCKUP_FONTS_URL || 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600&family=Geist+Mono:wght@400&display=swap';
const wrap = (name, w, h) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONTS}">
<style>html,body{margin:0;background:transparent}svg{display:block;width:${w}px;height:${h}px}</style></head>
<body>${svg(name).toString()}</body></html>`;

// Node 20 satisfies Next's engine range but has no global WebSocket without
// --experimental-websocket; failing here beats failing after Chrome is up.
if (typeof WebSocket !== 'function') {
  throw new Error('rasterize-logo-suite needs Node 22+ (global WebSocket); on Node 20 run with --experimental-websocket. Nothing written.');
}
if (!fs.existsSync(CHROME)) {
  throw new Error('no Chrome at ' + CHROME + ' — lockups NOT rendered; set CHROME=<path> and rerun. Nothing written.');
}

const TMP = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'ds-lockups-'));
const PROFILE = path.join(TMP, 'profile');
// --remote-debugging-port=0: Chrome picks a free port and writes it to
// DevToolsActivePort inside OUR profile dir, so the endpoint we connect to is
// this process's Chrome and no other — a fixed port could attach to a
// developer's own debugging Chrome and screenshot an unrelated page.
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + PROFILE, '--remote-debugging-port=0', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });

const teardown = async () => {
  const exited = new Promise((r) => { chrome.once('exit', r); setTimeout(r, 3000); });
  chrome.kill();
  await exited;
  for (let i = 0; i < 3; i++) {
    try { fs.rmSync(TMP, { recursive: true, force: true }); break; } catch { await sleep(500); }
  }
};

let ws = null;
try {
  let port = null;
  const active = path.join(PROFILE, 'DevToolsActivePort');
  for (let i = 0; i < 80 && !port; i++) {
    await sleep(250);
    try { port = parseInt(fs.readFileSync(active, 'utf8').split('\n')[0], 10) || null; } catch { /* not written yet */ }
  }
  if (!port) throw new Error('chrome did not publish DevToolsActivePort');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = targets.find((t) => t.type === 'page' && t.url === 'about:blank');
  if (!page) throw new Error('no about:blank page target in the spawned Chrome');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(); let loaded = 0;
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } else if (msg.method === 'Page.loadEventFired') loaded++; };
  const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  await send('Page.enable');

  for (const [name, w, h] of LOCKUPS) {
    const html = path.join(TMP, name.replace('.svg', '.html'));
    fs.writeFileSync(html, wrap(name, w, h));
    const url = 'file:///' + html.replace(/\\/g, '/');
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });

    // The navigation has to COMPLETE and land on THIS document. A failed or
    // stalled navigation leaves the previous lockup in the page, its fonts
    // already loaded, and the gate below would pass it under the wrong name.
    const before = loaded;
    const nav = await send('Page.navigate', { url });
    if (nav.result && nav.result.errorText) throw new Error(`${name}: navigation failed: ${nav.result.errorText}. Nothing written.`);
    for (let i = 0; i < 100 && loaded === before; i++) await sleep(100);
    if (loaded === before) throw new Error(`${name}: load event never fired. Nothing written.`);
    const here = await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
    if (here.result.result.value !== url) throw new Error(`${name}: wrong document loaded: ${here.result.result.value}. Nothing written.`);

    // Both faces must be IN before the capture, or the wordmark is a system
    // fallback — and a fallback PNG that exits 0 would be committed as the OG
    // image. A loaded FontFace per family, not check(): when the stylesheet
    // itself is unreachable no @font-face is registered, load() resolves with []
    // and check() answers true because nothing is pending.
    const faces = await send('Runtime.evaluate', {
      expression: `Promise.all([
        document.fonts.load('600 20px "Space Grotesk"'),
        document.fonts.load('400 20px "Geist Mono"'),
      ]).then(([g, m]) => JSON.stringify({
        grotesk: g.some((f) => f.family.replace(/["']/g, '') === 'Space Grotesk' && f.status === 'loaded'),
        mono: m.some((f) => f.family.replace(/["']/g, '') === 'Geist Mono' && f.status === 'loaded'),
      })).catch(() => JSON.stringify({ grotesk: false, mono: false }))`,
      awaitPromise: true, returnByValue: true,
    });
    const have = JSON.parse(faces.result.result.value);
    if (!have.grotesk || !have.mono) {
      throw new Error(`${name}: required faces not loaded (Space Grotesk ${have.grotesk}, Geist Mono ${have.mono}) — Google Fonts unreachable? Nothing written.`);
    }
    await sleep(300);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const out = path.join(SUITE, name.replace('.svg', '.png'));
    fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
    console.log('wrote', path.relative(PUBLIC, out), `${w}x${h}`, 'faces: Space Grotesk + Geist Mono');
  }
} finally {
  if (ws) ws.close();
  await teardown();
}
console.log('\nraster suite complete');
