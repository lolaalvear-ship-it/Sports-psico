// Plantilla de reel: muestra cómo se escriben las escenas con el motor (engine/) y sus kits.
// Cada escena es SC.<id> = (c, lt, d, sc) => { ... }:
//   c  contexto 2D de 1080×1920   lt tiempo local (s) desde que empieza la escena
//   d  duración de la escena       sc entrada de timeline.json (sc.marks.<clave> = segundo local de una palabra)
// Las aperturas alternativas se llaman <id>_A y <id>_B; se elige con ?open=B (render.mjs --open B)
// o con "opening" en timeline.json. Los textos y cifras de esta plantilla son de EJEMPLO.
import {
  W, H, PAL, BRAND, seg, easeOut, mark, title, txt, cite, badge, backdrop, glow, bokehField, dust, label, start,
} from '/engine/core.js';
import { bigNumber, bars, pulseLine, breathRing, stadium, chip, endCard } from '/engine/kit2d.js';
import * as K3 from '/engine/kit3d.js';

const SC = {};

// Apertura A · estadio de noche con la pregunta
SC.hook_A = (c, lt, d) => {
  stadium(c, lt, { light: 0.6 + 0.4 * seg(lt, 0, 1.2) });
  title(c, '¿POR QUÉ', W / 2, 560, lt, 0.1, d + 0.3, { size: 110, weight: 800, spacing: 6 });
  title(c, 'FALLAMOS', W / 2, 700, lt, 0.4, d + 0.3, { size: 150, weight: 800, spacing: 8, color: BRAND.colores.acento, glowPx: 40, glowColor: '#ff7a00' });
  title(c, 'CUANDO MÁS IMPORTA?', W / 2, 840, lt, 0.7, d + 0.3, { size: 76, weight: 800, spacing: 4 });
  badge(c, 'EJEMPLO', PAL.green, W / 2, 1650, seg(lt, 0.2, 0.6));
};

// Apertura B · el pulso se dispara
SC.hook_B = (c, lt, d) => {
  backdrop(c, '#14040a', '#050106');
  glow(c, W / 2, 960, 700, '#7a0a24', 0.5);
  pulseLine(c, lt, { y: 1000, bpm: t => 70 + 110 * seg(t, 0.3, 3.5), amp: 170 });
  title(c, 'Último penalti.', W / 2, 520, lt, 0.1, d + 0.3, { size: 92, weight: 800 });
  title(c, 'Tu corazón ya lo sabe.', W / 2, 640, lt, 0.9, d + 0.3, { size: 64, weight: 600, italic: true, color: '#ffb3c0' });
  badge(c, 'EJEMPLO', PAL.green, W / 2, 1650, seg(lt, 0.2, 0.6));
};

// Dato grande que cuenta
SC.dato = (c, lt, d) => {
  backdrop(c);
  bokehField(c, 4, lt, 30, ['#1a3a7a', '#2a5ab0'], { alpha: 0.35 });
  bigNumber(c, 42, lt, 0.3, { suffix: '%', y: 860 });
  title(c, 'de los deportistas (dato de ejemplo)', W / 2, 1060, lt, 0.8, d + 0.3, { size: 46, weight: 600, color: '#c9d4ea' });
  cite(c, 'Autor et al. · Revista Año', lt, 0.6, d + 0.3, 1440);
};

// Comparación entre grupos; las barras arrancan con la palabra «comparación»
SC.estudio = (c, lt, d, sc) => {
  const C = mark(sc, 'comparacion', 1.2);
  backdrop(c);
  title(c, 'EL ESTUDIO', W / 2, 330, lt, 0.1, d + 0.3, { size: 80, weight: 800, spacing: 6, color: BRAND.colores.primario });
  bars(c, [{ label: 'Grupo A', value: 38 }, { label: 'Grupo B', value: 71 }], lt, C, { x: 240, w: 600, y: 1300, h: 600, max: 100 });
  cite(c, 'Autor et al. · Revista Año', lt, 0.4, d + 0.3, 1520);
};

// Cerebro 3D con una región resaltada y su etiqueta
const amyGlow = K3.regionGlow(K3.REG.amyR, 0xff3a4a);
SC.cerebro = (c, lt, d) => {
  K3.brainBase();
  const on = seg(lt, 0.5, 1.2), pulse = 0.8 + 0.2 * Math.sin(lt * 6);
  K3.setHL(0, K3.REG.amyR, 0xff3a4a, 0.2, on * 4 * pulse);
  K3.setHL(1, K3.REG.dlpfcR, 0x5fd3ff, 0.28, on * 2.5);
  amyGlow.material.opacity = on * pulse;
  K3.orbitCam(K3.brainCam, 0.5 + lt * 0.12, 4.4, 0.5, K3.ORIGIN);
  K3.brainRoot.updateMatrixWorld();
  K3.render3D(c, K3.brainScene, K3.brainCam);
  const [px, py] = K3.project(K3.REG.amyR, K3.brainCam, K3.brainRoot);
  label(c, px, py, 1350, 'AMÍGDALA', 'alarma ante la amenaza', '#ff6a7a', seg(lt, 1.0, 1.6));
  title(c, 'BAJO PRESIÓN', W / 2, 330, lt, 0.1, d + 0.3, { size: 84, weight: 800, spacing: 6 });
};

// Aplicación práctica
SC.practica = (c, lt, d) => {
  backdrop(c, '#03101a', '#02060a');
  dust(c, 8, lt, 40, '#5fd3ff', 0.4);
  breathRing(c, lt, { y: 980, period: 6 });
  title(c, 'QUÉ PUEDES HACER', W / 2, 330, lt, 0.1, d + 0.3, { size: 76, weight: 800, spacing: 4, color: BRAND.colores.primario });
  chip(c, 'A', 'Respiración lenta antes de ejecutar', W / 2, 1460, seg(lt, 1.0, 1.4), { w: 820 });
};

SC.cierre = (c, lt, d) => endCard(c, lt, d);

// escenas cuya tipografía grande ya dice lo narrado: sin subtítulos encima
start(SC, { noCaps: ['hook', 'cierre'] });
