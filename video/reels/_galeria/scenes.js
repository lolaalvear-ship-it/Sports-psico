// Galería del kit médico: una escena por pieza para revisar el aspecto de cada ilustración.
// node render.mjs --reel _galeria --stills 1,4,7,...
import { W, H, seg, title, start } from '/engine/core.js';
import * as M from '/engine/kitmed.js';

const SC = {};
const T = (c, s, lt) => title(c, s, W / 2, 240, lt, 0, 99, { size: 64, weight: 800 });
SC.corazon = (c, lt) => {
  M.splitScreen(c,
    k => { M.shardsBg(k, lt, { color: '#0f4a3a' }); M.heart(k, W / 2, 900, 640, { color: '#2fb35a', beat: M.heartBeat(lt, 60) }); },
    k => { M.shardsBg(k, lt, { color: '#5a1a1a' }); M.heart(k, W / 2, 900, 640, { color: '#d3303d', beat: M.heartBeat(lt, 140) }); });
  M.person(c, 330, 1450, 520, { pose: 'caer', eyes: 'closed' });
  M.person(c, 820, 1530, 480, { pose: 'tumbado', eyes: 'closed', shirt: '#f08a2a' });
  T(c, 'corazón · personaje', lt);
};
SC.cerebro = (c, lt) => {
  M.cellsBg(c, lt, { color: '#1c2a5a', cell: '#7fa0e0' });
  M.brain(c, W / 2, 900, 900, { hl: { prefrontal: seg(lt, 0, 1), cerebelo: 0.6 }, lt });
  T(c, 'cerebro · lóbulos', lt);
};
SC.hueso = (c, lt) => {
  M.shardsBg(c, lt);
  M.bone(c, W / 2, 1000, 1300, { fracture: 1, hematoma: 0.9, lt });
  T(c, 'hueso · fractura · hematoma', lt);
};
SC.ovulo = (c, lt) => {
  M.cellsBg(c, lt);
  M.ovum(c, W / 2, 950, 300, lt, { approach: seg(lt, 0, 2.5) });
  T(c, 'óvulo · espermatozoides', lt);
};
SC.boca = (c, lt) => {
  M.mouthBg(c, lt, { open: 0.6 });
  M.pill(c, 380, 950, 90, { rot: 0.4 }); M.pill(c, 700, 880, 80, { type: 'oval', rot: -0.6 }); M.pill(c, 560, 1150, 80, { type: 'capsule', rot: 0.3 });
  T(c, 'boca · fármacos', lt);
};
SC.mucosa = (c, lt) => {
  M.tissueBg(c, lt);
  M.stomach(c, W / 2, 1000, 900, { ulcer: 1, lt });
  T(c, 'mucosa · estómago · úlcera', lt);
};
SC.pulmon = (c, lt) => {
  M.cellsBg(c, lt, { color: '#14324a', cell: '#7ad0e0' });
  M.lungs(c, W / 2, 1000, 1000, { breath: 0.5 + 0.5 * Math.sin(lt * 1.5) });
  T(c, 'pulmones', lt);
};
SC.sangre = (c, lt) => {
  M.bloodBg(c, lt);
  M.kidney(c, 330, 1000, 700); M.syringe(c, 700, 1400, 600, { rot: -0.4, plunger: seg(lt, 0, 3) });
  T(c, 'sangre · riñón · jeringa', lt);
};
SC.neurona = (c, lt) => {
  M.cellsBg(c, lt, { color: '#101a3a', cell: '#5a7ad0', n: 40 });
  M.neuron(c, 260, 950, 700, { pulse: (lt * 0.5) % 1 });
  M.person(c, 540, 1650, 380, { pose: 'correr', lt });
  T(c, 'neurona · corredor', lt);
};
start(SC, { noCaps: Object.keys(SC) });
