// Genera los iconos PNG de la PWA dibujándolos en Chromium (sin herramientas de diseño).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs><radialGradient id="g" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#16244a"/><stop offset="1" stop-color="#05070d"/></radialGradient>
<filter id="f"><feGaussianBlur stdDeviation="6"/></filter></defs>
<rect width="512" height="512" fill="url(#g)"/>
<g transform="translate(256 256) scale(${1 - pad})">
<g fill="none" stroke="#5ff2ff" stroke-width="10" stroke-linecap="round">
<path d="M-150 40 C-90 -120 -10 -60 0 0 S 90 120 150 -40" filter="url(#f)" opacity=".8"/>
<path d="M-150 40 C-90 -120 -10 -60 0 0 S 90 120 150 -40"/>
<path d="M-120 -110 L-40 -40 M40 40 L120 110 M-120 110 L-30 50 M30 -50 L120 -110" stroke="#3d8bff" stroke-width="7" opacity=".9"/></g>
<g fill="#fff"><circle r="26" fill="#ffb347"/><circle cx="-150" cy="40" r="16"/><circle cx="150" cy="-40" r="16"/>
<circle cx="-120" cy="-110" r="12" fill="#5ff2ff"/><circle cx="120" cy="110" r="12" fill="#5ff2ff"/><circle cx="-120" cy="110" r="12" fill="#5ff2ff"/><circle cx="120" cy="-110" r="12" fill="#5ff2ff"/></g></g></svg>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const out = path.join(__dirname, '..', 'public', 'icons');
  for (const [name, size, pad] of [['icon-192.png', 192, 0.12], ['icon-512.png', 512, 0.12], ['icon-maskable-512.png', 512, 0.3]]) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<body style="margin:0">${svg(pad).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
    fs.writeFileSync(path.join(out, name), await p.screenshot());
  }
  await b.close();
})();
