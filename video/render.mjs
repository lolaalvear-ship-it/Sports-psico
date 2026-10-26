// Renderiza el Short fotograma a fotograma en Chromium sin interfaz y lo codifica con ffmpeg.
// Uso:
//   node render.mjs                       -> output/short_sin_narracion.mp4
//   node render.mjs --stills 0.5,12,30    -> PNG de prueba en output/stills/
//   node render.mjs --from 10 --to 20     -> renderiza solo un tramo (pruebas)
//   node render.mjs --audio voz.mp3 --out output/final.mp4   -> mezcla con la narración
//   node render.mjs --src src-recuerdos ...                   -> otro proyecto (carpeta con index.html, main.js y timeline.json)
// Reels del flujo guiado (reels/<slug>/scenes.js + timeline.json, motor en engine/):
//   node render.mjs --reel <slug> --stills 0.5,3 [--open B]   -> fotogramas de prueba (apertura A o B)
//   node render.mjs --reel <slug> --cover                      -> portada.png en reels/<slug>/output/
//   node render.mjs --reel <slug> [--audio ...]                -> output/reel.mp4 (usa audio/mezcla.wav o audio/voz_final.wav si existen)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const FPS = 30;
const stills = opt('stills');
const from = parseFloat(opt('from', '0'));
const REEL = opt('reel');
const SRC = REEL ? path.join('reels', REEL) : opt('src', 'src');
const BASE = path.join(ROOT, SRC);
if (REEL && !fs.existsSync(path.join(BASE, 'scenes.js'))) { console.error(`No existe ${SRC}/scenes.js`); process.exit(1); }
const OUTDIR = REEL ? path.join(BASE, 'output') : path.join(ROOT, 'output');
const autoAudio = REEL && ['mezcla.wav', 'voz_final.wav'].map(f => path.join(BASE, 'audio', f)).find(f => fs.existsSync(f));
const audio = opt('audio', args.includes('--mute') ? undefined : autoAudio);
const open = opt('open');
const cover = args.includes('--cover');
const out = opt('out', path.join(OUTDIR, REEL ? `reel${open ? '_' + open : ''}.mp4` : 'short_sin_narracion.mp4'));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.otf': 'font/otf' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = p.startsWith('/three/') ? path.join(ROOT, 'node_modules/three/build', p.slice(7))
    : p.startsWith('/engine/') ? path.join(ROOT, p)
    : p === '/marca.json' ? path.join(ROOT, 'marca.json')
    : REEL && p === '/index.html' ? path.join(ROOT, 'engine', 'index.html')
    : path.join(BASE, p);
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'],
});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.error('[page error]', e));
page.on('requestfailed', r => console.error('[no cargó]', r.url()));
page.on('response', r => { if (r.status() >= 400) console.error('[' + r.status() + ']', r.url()); });
await page.goto(`http://127.0.0.1:${port}/${open ? '?open=' + open : ''}`);
await page.waitForFunction('window.READY === true', null, { timeout: 120000 });
const DURATION = await page.evaluate('window.DURATION');
const to = parseFloat(opt('to', String(DURATION)));

const toBuf = d => Buffer.from(d.slice(d.indexOf(',') + 1), 'base64');

if (cover) {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const t = parseFloat(opt('at', String(await page.evaluate('window.COVER_T ?? 1'))));
  const f = path.join(OUTDIR, `portada${open ? '_' + open : ''}.png`);
  fs.writeFileSync(f, toBuf(await page.evaluate(t => window.renderFrame(t, 'image/png'), t)));
  console.log('portada', t, '->', f);
} else if (stills) {
  const dir = path.join(OUTDIR, 'stills');
  fs.mkdirSync(dir, { recursive: true });
  for (const s of stills.split(',').map(Number)) {
    const d = await page.evaluate(t => window.renderFrame(t, 'image/png'), s);
    fs.writeFileSync(path.join(dir, `${open ? open + '_' : ''}t${s.toFixed(2)}.png`), toBuf(d));
    console.log('still', s);
  }
} else {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    ...(audio ? ['-i', audio] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-level', '4.1', '-r', String(FPS),
    ...(audio ? ['-af', 'apad', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-movflags', '+faststart', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n0 = Math.round(from * FPS), n1 = Math.round(to * FPS);
  const t0 = Date.now();
  for (let n = n0; n < n1; n++) {
    const d = await page.evaluate(t => window.renderFrame(t, 'image/jpeg'), n / FPS);
    if (!ff.stdin.write(toBuf(d))) await new Promise(r => ff.stdin.once('drain', r));
    if (n % 30 === 0) {
      const done = n - n0 + 1, el = (Date.now() - t0) / 1000;
      console.log(`frame ${n}/${n1}  ${(done / el).toFixed(2)} fps  ETA ${((n1 - n) * el / done / 60).toFixed(1)} min`);
    }
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('OK ->', out);
}
await browser.close();
server.close();
