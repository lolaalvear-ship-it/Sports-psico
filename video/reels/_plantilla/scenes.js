// Plantilla de reel: muestra cómo se escriben las escenas con el motor (engine/) y sus kits.
// Cada escena es SC.<id> = (c, lt, d, sc) => { ... }:
//   c  contexto 2D de 1080×1920   lt tiempo local (s) desde que empieza la escena
//   d  duración de la escena       sc entrada de timeline.json (sc.marks.<clave> = segundo local de una palabra)
// Las aperturas alternativas se llaman <id>_A y <id>_B; se elige con ?open=B (render.mjs --open B)
// o con "opening" en timeline.json. Los textos y cifras de esta plantilla son de EJEMPLO.
import {
  W, H, PAL, BRAND, seg, mark, title, txt, cite, badge, start,
} from '/engine/core.js';
import { bigNumber, bars, pulseLine, chip, endCard } from '/engine/kit2d.js';
import * as M from '/engine/kitmed.js';

const SC = {};

// Apertura A · corazón que se acelera junto al deportista que corre
SC.hook_A = (c, lt, d) => {
  M.shardsBg(c, lt, { color: '#5a1420', shard: '#ffd0c0' });
  M.heart(c, W / 2, 900, 620, { color: '#d3303d', beat: M.heartBeat(lt, 70 + 70 * seg(lt, 0.5, 3.5)) });
  M.person(c, W / 2, 1470, 400, { pose: 'correr', lt });
  title(c, '¿POR QUÉ FALLAMOS', W / 2, 330, lt, 0.1, d + 0.3, { size: 70, weight: 800, spacing: 2 });
  title(c, 'CUANDO MÁS IMPORTA?', W / 2, 440, lt, 0.4, d + 0.3, { size: 70, weight: 800, spacing: 2, color: BRAND.colores.acento });
  badge(c, 'EJEMPLO', PAL.green, W / 2, 1690, seg(lt, 0.2, 0.6));
};

// Apertura B · pantalla partida: calma frente a presión
SC.hook_B = (c, lt, d) => {
  M.splitScreen(c,
    k => { M.cellsBg(k, lt, { color: '#123a5e', cell: '#7ad0e0' }); M.heart(k, W / 2, 860, 520, { color: '#2fb35a', beat: M.heartBeat(lt, 60) }); },
    k => { M.cellsBg(k, lt, { color: '#5a1420', cell: '#ff8a9a' }); M.heart(k, W / 2, 860, 520, { color: '#d3303d', beat: M.heartBeat(lt, 150) }); });
  pulseLine(c, lt, { y: 1300, bpm: 110, amp: 90, showBpm: false, alpha: 0.8 });
  title(c, 'Entrenamiento… o final.', W / 2, 330, lt, 0.1, d + 0.3, { size: 76, weight: 800 });
  badge(c, 'EJEMPLO', PAL.green, W / 2, 1690, seg(lt, 0.2, 0.6));
};

// Dato grande que cuenta, sobre torrente sanguíneo
SC.dato = (c, lt, d) => {
  M.bloodBg(c, lt, { speed: 0.6 });
  c.fillStyle = 'rgba(10,2,6,0.6)'; c.fillRect(0, 0, W, H);
  bigNumber(c, 42, lt, 0.3, { suffix: '%', y: 860 });
  title(c, 'de los deportistas (dato de ejemplo)', W / 2, 1060, lt, 0.8, d + 0.3, { size: 46, weight: 600, color: '#ffe0e6' });
  cite(c, 'Autor et al. · Revista Año', lt, 0.6, d + 0.3, 1440);
};

// Comparación entre grupos; las barras arrancan con la palabra «comparación»
SC.estudio = (c, lt, d, sc) => {
  const C = mark(sc, 'comparacion', 1.2);
  M.cellsBg(c, lt, { color: '#1c2a5a', cell: '#7fa0e0', n: 40 });
  title(c, 'EL ESTUDIO', W / 2, 330, lt, 0.1, d + 0.3, { size: 80, weight: 800, spacing: 6, color: BRAND.colores.primario });
  bars(c, [{ label: 'Grupo A', value: 38 }, { label: 'Grupo B', value: 71 }], lt, C, { x: 240, w: 600, y: 1300, h: 600, max: 100 });
  cite(c, 'Autor et al. · Revista Año', lt, 0.4, d + 0.3, 1520);
};

// Cerebro ilustrado con una región que se enciende
SC.cerebro = (c, lt, d) => {
  M.cellsBg(c, lt, { color: '#1c2a5a', cell: '#7fa0e0' });
  M.brain(c, W / 2, 940, 920, { hl: { prefrontal: seg(lt, 0.6, 1.4), temporal: 0.7 * seg(lt, 1.6, 2.4) }, lt });
  title(c, 'BAJO PRESIÓN', W / 2, 330, lt, 0.1, d + 0.3, { size: 84, weight: 800, spacing: 6 });
  chip(c, 'A', 'Prefrontal: control de la atención', W / 2, 1400, seg(lt, 1.0, 1.4), { w: 820 });
};

// Aplicación práctica: respiración lenta
SC.practica = (c, lt, d) => {
  M.cellsBg(c, lt, { color: '#14324a', cell: '#7ad0e0' });
  const breath = 0.5 - 0.5 * Math.cos(lt / 6 * Math.PI * 2);
  M.lungs(c, W / 2, 980, 900, { breath });
  title(c, 'QUÉ PUEDES HACER', W / 2, 330, lt, 0.1, d + 0.3, { size: 76, weight: 800, spacing: 4, color: BRAND.colores.primario });
  txt(c, breath > 0.5 ? 'inhala' : 'exhala', W / 2, 1520, { size: 60, weight: 700, alpha: seg(lt, 0.5, 1) });
};

SC.cierre = (c, lt, d) => endCard(c, lt, d);

// escenas cuya tipografía grande ya dice lo narrado: sin subtítulos encima
start(SC, { noCaps: ['hook', 'cierre'] });
