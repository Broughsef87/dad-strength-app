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
//             no dependencies beyond Node's fetch and WebSocket.
//
// favicon.ico is assembled by hand: an ICO is a small directory of images, and
// PNG payloads have been valid inside it since Vista. 16 / 32 / 48.
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
const TMP = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'ds-lockups-'));
const FONTS = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600&family=Geist+Mono:wght@400&display=swap';
const wrap = (name, w, h) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONTS}">
<style>html,body{margin:0;background:transparent}svg{display:block;width:${w}px;height:${h}px}</style></head>
<body>${svg(name).toString()}</body></html>`;

if (!fs.existsSync(CHROME)) {
  console.log('\nno Chrome at ' + CHROME + ' — lockups NOT rendered; set CHROME=<path> and rerun');
  process.exit(2);
}
const PORT = 9337;
const PROFILE = path.join(TMP, 'profile');
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + PROFILE, '--remote-debugging-port=' + PORT, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets = null;
for (let i = 0; i < 60 && !targets; i++) { await sleep(250); try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); } catch { /* not up yet */ } }
if (!targets) { chrome.kill(); throw new Error('chrome did not open the debugging port'); }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map(); let loaded = 0;
ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } else if (msg.method === 'Page.loadEventFired') loaded++; };
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
await send('Page.enable');
for (const [name, w, h] of LOCKUPS) {
  const html = path.join(TMP, name.replace('.svg', '.html'));
  fs.writeFileSync(html, wrap(name, w, h));
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  const before = loaded;
  await send('Page.navigate', { url: 'file:///' + html.replace(/\\/g, '/') });
  for (let i = 0; i < 100 && loaded === before; i++) await sleep(100);
  // the faces must be in before the capture, or the wordmark is the fallback
  await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => 1)', awaitPromise: true });
  const faces = await send('Runtime.evaluate', { expression: 'document.fonts.check("600 20px \\"Space Grotesk\\"")', returnByValue: true });
  await sleep(300);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const out = path.join(SUITE, name.replace('.svg', '.png'));
  fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  console.log('wrote', path.relative(PUBLIC, out), `${w}x${h}`, 'Space Grotesk loaded:', faces.result.result.value);
}
ws.close();
// Chrome releases its profile directory a beat after the kill; removing it
// under Chrome is EPERM on Windows. Wait for exit, then a couple of tries — a
// leftover temp dir is not worth a non-zero exit.
const exited = new Promise((r) => { chrome.once('exit', r); setTimeout(r, 3000); });
chrome.kill();
await exited;
for (let i = 0; i < 3; i++) {
  try { fs.rmSync(TMP, { recursive: true, force: true }); break; } catch { await sleep(500); }
}
console.log('\nraster suite complete');
