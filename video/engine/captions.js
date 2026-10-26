// Subtítulos sincronizados palabra a palabra. Cuatro estilos (timeline.json "captionStyle" o marca.json "subtitulos"):
//   karaoke  bloque de hasta 3 palabras abajo; la palabra activa en el color de acento
//   caja     bloque arriba; la palabra activa en blanco dentro de un recuadro con tiradores
//   pop      una sola palabra grande en el centro, con rebote
//   linea    frase discreta sobre una píldora oscura, sin resaltado
// Cada entrada de captions: { start, end, words: [{ w, s, e }] } (la genera tools/sync.py).
const W = 1080;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const inOut = (t, a, b, fi, fo) => Math.min(seg(t, a, a + fi), 1 - seg(t, b - fo, b));

function layout(c, words, maxW) {
  const lines = [[]]; let lw = 0;
  for (const w of words) {
    const ww = c.measureText(w.w + ' ').width;
    if (lw + ww > maxW && lines[lines.length - 1].length) { lines.push([]); lw = 0; }
    lines[lines.length - 1].push({ ...w, ww }); lw += ww;
  }
  return lines;
}
function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
const active = (t, w) => t >= w.s && t < w.e + 0.05;

const STYLES = {
  karaoke(c, t, cap, B) {
    c.font = '800 62px "Inter Display"'; c.letterSpacing = '1px';
    const lines = layout(c, cap.words, 900);
    const y0 = 1330 - (lines.length - 1) * 40;
    lines.forEach((ln, li) => {
      const tw = ln.reduce((s, w) => s + w.ww, 0);
      let x = W / 2 - tw / 2;
      for (const w of ln) {
        const on = active(t, w);
        const pop = on ? 1 + 0.08 * (1 - seg(t, w.s, w.s + 0.12)) : 1;
        c.save(); c.translate(x + w.ww / 2, y0 + li * 80); c.scale(pop, pop);
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = 12; c.strokeStyle = 'rgba(0,0,0,0.85)'; c.lineJoin = 'round';
        c.strokeText(w.w, 0, 0);
        c.fillStyle = on ? B.colores.acento : '#ffffff';
        c.fillText(w.w, 0, 0);
        c.restore();
        x += w.ww;
      }
    });
  },
  caja(c, t, cap, B) {
    c.font = '700 66px "Inter Display"'; c.letterSpacing = '0px';
    const lines = layout(c, cap.words, 900);
    const y0 = 620 - (lines.length - 1) * 42;
    const sp = c.measureText(' ').width;
    lines.forEach((ln, li) => {
      const tw = ln.reduce((s, w) => s + w.ww, 0);
      let x = W / 2 - tw / 2;
      const y = y0 + li * 84;
      for (const w of ln) {
        const on = active(t, w), cx = x + (w.ww - sp) / 2;
        c.save();
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 18;
        c.fillStyle = on ? '#ffffff' : 'rgba(255,255,255,0.55)';
        c.fillText(w.w, cx, y);
        c.restore();
        if (on) {
          const bw = w.ww - sp + 24, bh = 82, bx = cx - bw / 2, by = y - bh / 2;
          const k = seg(t, w.s, w.s + 0.1);
          c.save();
          c.globalAlpha *= k;
          c.strokeStyle = B.colores.primario; c.lineWidth = 4;
          rr(c, bx, by, bw, bh, 8); c.stroke();
          c.fillStyle = B.colores.primario; c.strokeStyle = '#ffffff'; c.lineWidth = 3;
          for (const [hx, hy] of [[bx, by], [bx + bw, by + bh]]) {
            c.beginPath(); c.arc(hx, hy, 9, 0, Math.PI * 2); c.fill(); c.stroke();
          }
          c.restore();
        }
        x += w.ww;
      }
    });
  },
  pop(c, t, cap, B) {
    const w = cap.words.find(x => active(t, x)) || cap.words.filter(x => x.s <= t).pop();
    if (!w) return;
    const k = seg(t, w.s, w.s + 0.14);
    const s = 0.7 + 0.3 * (1 - Math.pow(1 - k, 3)) + 0.06 * Math.sin(k * Math.PI);
    c.save();
    c.translate(W / 2, 1250); c.scale(s, s);
    c.font = '800 118px "Inter Display"'; c.letterSpacing = '1px';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 18; c.strokeStyle = 'rgba(0,0,0,0.9)'; c.lineJoin = 'round';
    const word = w.w.toUpperCase();
    c.strokeText(word, 0, 0);
    c.fillStyle = word.replace(/[^\p{L}]/gu, '').length >= 7 ? B.colores.acento : '#ffffff';
    c.fillText(word, 0, 0);
    c.restore();
  },
  linea(c, t, cap) {
    c.font = '600 44px "Inter"'; c.letterSpacing = '0px';
    const s = cap.words.map(w => w.w).join(' ');
    const tw = Math.min(c.measureText(s).width, 940);
    c.fillStyle = 'rgba(6,10,20,0.62)';
    rr(c, W / 2 - tw / 2 - 30, 1530, tw + 60, 84, 42); c.fill();
    c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(s, W / 2, 1573, 940);
  },
};

export const CAPTION_STYLES = Object.keys(STYLES);

export function drawCaptions(c, t, captions, style, brand) {
  const cap = captions.find(k => t >= k.start && t < k.end);
  if (!cap) return;
  c.save();
  c.globalAlpha = inOut(t, cap.start, cap.end, 0.08, 0.08);
  (STYLES[style] || STYLES.karaoke)(c, t, cap, brand);
  c.restore();
}
