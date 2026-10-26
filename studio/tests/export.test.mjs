// Prueba real de exportación: compila la app, la abre en Chromium sin interfaz,
// exporta el video de prueba con el mismo código que usa el botón «Generar video»
// y comprueba el archivo con ffprobe.
//   node tests/export.test.mjs [--res 1080|720] [--aspect 9:16|16:9] [--out ruta.mp4] [--shots]
import { createRequire } from 'node:module';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Playwright viene preinstalado de forma global (no es dependencia de la app).
const { chromium } = createRequire(import.meta.url)('playwright');

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const res = Number(arg('--res', '1080'));
const aspect = arg('--aspect', '9:16');
const outDir = path.join(root, 'tests', 'output');
fs.mkdirSync(outDir, { recursive: true });
const out = path.resolve(arg('--out', path.join(outDir, `enamoramiento_${aspect.replace(':', 'x')}_${res}.mp4`)));

const PORT = 4179;
if (!process.argv.includes('--no-build')) execFileSync('npx', ['vite', 'build'], { cwd: root, stdio: 'inherit' });
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 2500));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  page.on('console', (m) => (m.type() === 'error' || m.text().startsWith('[progreso]')) && console.log('[navegador]', m.text()));
  page.on('pageerror', (e) => console.log('[error de página]', e.message));
  await page.goto(`http://localhost:${PORT}/?test`);
  await page.waitForFunction(() => window.__sms);

  if (process.argv.includes('--shots')) {
    await page.screenshot({ path: path.join(outDir, 'ui_crear.png') });
    await page.getByText('Abrir el video de prueba').click();
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.querySelector('input[type=range]').dispatchEvent(new Event('input')));
    await page.screenshot({ path: path.join(outDir, 'ui_editor.png') });
    await page.locator('.scene-head').nth(1).click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, 'ui_escena.png'), fullPage: true });
  }

  const caps = await page.evaluate(() => window.__sms.detectCapabilities());
  console.log('Capacidades del navegador:', caps);
  const t0 = Date.now();
  const info = await page.evaluate(async ({ res, aspect }) => {
    const s = window.__sms;
    const project = s.loveDemo(aspect);
    const r = await s.exportProject(project, s.assets, { shortSide: res, audio: true, onProgress: (k, msg) => { const p = Math.floor(k * 20); if (p !== window.__p) { window.__p = p; console.log(`[progreso] ${Math.round(k * 100)} % ${msg}`); } } });
    const buf = new Uint8Array(await r.blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { b64: btoa(bin), ext: r.ext, method: r.method, videoCodec: r.videoCodec, audioCodec: r.audioCodec, w: r.width, h: r.height, notes: r.notes };
  }, { res, aspect });
  fs.writeFileSync(out, Buffer.from(info.b64, 'base64'));
  console.log(`Exportado en ${((Date.now() - t0) / 1000).toFixed(1)} s → ${out}`);
  console.log({ ...info, b64: undefined });

  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-count_frames', '-of', 'json', out]).toString());
  const v = probe.streams.find((s) => s.codec_type === 'video');
  const a = probe.streams.find((s) => s.codec_type === 'audio');
  const checks = [
    ['contenedor MP4', /mp4/.test(probe.format.format_name)],
    ['video H.264', v?.codec_name === 'h264'],
    ['resolución', v?.width === info.w && v?.height === info.h],
    ['duración ≈ 15 s', Math.abs(Number(probe.format.duration) - 15) < 0.25],
    ['450 fotogramas', Number(v?.nb_read_frames) === 450],
    ['pista de audio', !!a],
    ['moov al inicio (faststart)', fs.readFileSync(out).subarray(0, 64).includes(Buffer.from('moov')) || fs.readFileSync(out).indexOf('moov') < fs.readFileSync(out).indexOf('mdat')],
  ];
  console.log(`ffprobe: ${v?.codec_name} ${v?.profile} ${v?.width}x${v?.height} ${v?.r_frame_rate} · audio ${a?.codec_name ?? 'ninguno'} · ${probe.format.duration} s · ${(probe.format.size / 1e6).toFixed(2)} MB`);
  let ok = true;
  for (const [name, pass] of checks) { console.log(`${pass ? '✔' : '✘'} ${name}`); ok &&= pass; }
  // decodificación completa: detecta archivos corruptos
  execFileSync('ffmpeg', ['-v', 'error', '-i', out, '-f', 'null', '-']);
  console.log('✔ se decodifica completo con ffmpeg sin errores');
  for (const t of [1.5, 5, 8.5, 12, 14.3]) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', out, '-frames:v', '1', '-vf', 'scale=360:-1', path.join(outDir, `frame_${t}.jpg`)]);
  }
  process.exitCode = ok ? 0 : 1;
} finally {
  await browser.close();
  server.kill();
}
