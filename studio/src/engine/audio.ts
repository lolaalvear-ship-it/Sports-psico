import { timeline, projectDuration } from './engine';
import { rng } from './math';
import { HEART_HZ } from './scenes/blood';
import { SYNAPSE_BURST } from './scenes/synapse';
import type { Project } from './types';

const CHORDS: Record<Project['audio']['mood'], number[]> = {
  ambiental: [55, 82.41, 110, 164.81, 246.94], // La con quinta y novena
  calido: [73.42, 110, 146.83, 185, 220], // Re mayor abierto
  tension: [61.74, 92.5, 123.47, 130.81, 185], // Si con novena menor
};

/** Firma de lo que afecta al audio (para no recalcularlo sin necesidad). */
export const audioSignature = (p: Project) =>
  JSON.stringify([p.audio, p.scenes.map((s) => [s.kind, s.duration, s.params.heartbeat])]);

/**
 * Banda sonora procedimental: colchón armónico, transiciones con ráfagas de ruido
 * y sonidos sincronizados con lo que se ve (impulsos, vesículas, latidos).
 * Se calcula con OfflineAudioContext, así suena igual en la vista previa y en el video.
 */
export async function renderSoundtrack(p: Project, sampleRate = 48000): Promise<AudioBuffer> {
  const dur = Math.max(0.5, projectDuration(p));
  const ctx = new OfflineAudioContext(2, Math.ceil(dur * sampleRate), sampleRate);
  const master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3;
  master.connect(comp).connect(ctx.destination);
  const r = rng(99);

  // colchón
  const pad = ctx.createGain();
  pad.gain.setValueAtTime(0, 0);
  pad.gain.linearRampToValueAtTime(0.16, Math.min(2.5, dur * 0.3));
  pad.gain.setValueAtTime(0.16, Math.max(0, dur - 1.5));
  pad.gain.linearRampToValueAtTime(0, dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 700;
  lp.Q.value = 0.7;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.08;
  const lfoAmt = ctx.createGain();
  lfoAmt.gain.value = 350;
  lfo.connect(lfoAmt).connect(lp.frequency);
  lfo.start();
  pad.connect(lp).connect(master);
  CHORDS[p.audio.mood].forEach((f, i) => {
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = i < 2 ? 'sine' : 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      const g = ctx.createGain();
      g.gain.value = i < 2 ? 0.5 : 0.12;
      const pan = ctx.createStereoPanner();
      pan.pan.value = det < 0 ? -0.4 : 0.4;
      o.connect(g).connect(pan).connect(pad);
      o.start();
      o.stop(dur);
    }
  });

  // ruido compartido
  const noise = ctx.createBuffer(1, sampleRate * 2, sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1;

  const whoosh = (t: number, len: number, gain: number) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(3500, t + len * 0.7);
    bp.frequency.exponentialRampToValueAtTime(800, t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + len * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(bp).connect(g).connect(master);
    src.start(t, r());
    src.stop(t + len + 0.05);
  };
  const ping = (t: number, f: number, gain: number, decay: number, pan = 0) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    const pn = ctx.createStereoPanner();
    pn.pan.value = pan;
    o.connect(g).connect(pn).connect(master);
    o.start(t);
    o.stop(t + decay + 0.05);
  };
  const thump = (t: number, gain: number) => {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.35);
  };
  const heartbeat = (from: number, to: number, gain: number) => {
    for (let t = from + 0.3; t < to - 0.2; t += 1 / HEART_HZ) {
      thump(t, gain);
      thump(t + 0.24, gain * 0.6); // «lub-dub»
    }
  };

  for (const it of timeline(p)) {
    const { scene: s, start, end } = it;
    if (it.index > 0) whoosh(Math.max(0, start - 0.45), 0.9, 0.12);
    switch (s.kind) {
      case 'title':
        whoosh(start + 0.1, 1.6, 0.08);
        ping(start + 0.4, 880, 0.06, 2.5);
        break;
      case 'network':
        for (let t = start + 0.5; t < end; t += 0.18 + r() * 0.3) ping(t, 900 + r() * 900, 0.025, 0.25, r() * 1.6 - 0.8);
        break;
      case 'synapse':
        for (let t = start + SYNAPSE_BURST.first; t < end; t += SYNAPSE_BURST.period) {
          whoosh(t - 0.5, 0.5, 0.05); // impulso que baja por el axón
          for (let k = 0; k < 4; k++) ping(t + k * 0.04, 520 + k * 140, 0.05, 0.35, k * 0.3 - 0.45);
        }
        break;
      case 'blood':
        heartbeat(start, end, 0.5);
        break;
      case 'brain':
        if (s.params.heartbeat) heartbeat(start, end, 0.35);
        break;
      default:
        break;
    }
  }
  return ctx.startRendering();
}
