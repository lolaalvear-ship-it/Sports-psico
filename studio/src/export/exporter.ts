import {
  AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, WebMOutputFormat,
  canEncodeAudio, getFirstEncodableAudioCodec, getFirstEncodableVideoCodec,
  type AudioCodec, type VideoCodec,
} from 'mediabunny';
import { renderSoundtrack } from '../engine/audio';
import { Engine, outputSize, projectDuration } from '../engine/engine';
import type { AssetResolver } from '../engine/runtime';
import type { Project } from '../engine/types';

export interface ExportOptions {
  shortSide: 720 | 1080;
  audio: boolean;
  onProgress?: (k: number, msg: string) => void;
  signal?: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  mime: string;
  ext: 'mp4' | 'webm';
  method: 'webcodecs' | 'mediarecorder';
  videoCodec: string;
  audioCodec: string | null;
  width: number;
  height: number;
  seconds: number;
  elapsed: number;
  notes: string[];
}

export interface Capabilities {
  webcodecs: boolean;
  videoCodec: VideoCodec | null;
  audioCodec: AudioCodec | null;
  mediaRecorderMime: string | null;
}

const MR_TYPES = [
  'video/mp4;codecs=avc1.640028,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

/** Qué puede hacer este navegador. Se comprueba de verdad, no se supone. */
export async function detectCapabilities(w = 1080, h = 1920): Promise<Capabilities> {
  const webcodecs = typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
  let videoCodec: VideoCodec | null = null, audioCodec: AudioCodec | null = null;
  if (webcodecs) {
    videoCodec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'vp8'], { width: w, height: h });
    const order: AudioCodec[] = videoCodec === 'avc' ? ['aac', 'opus'] : ['opus'];
    audioCodec = typeof AudioEncoder !== 'undefined' ? await getFirstEncodableAudioCodec(order, { numberOfChannels: 2, sampleRate: 48000 }) : null;
  }
  const mediaRecorderMime = typeof MediaRecorder !== 'undefined' ? MR_TYPES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null : null;
  return { webcodecs, videoCodec, audioCodec, mediaRecorderMime };
}

/**
 * Exporta el proyecto a video.
 * 1) WebCodecs: renderiza fotograma a fotograma (más lento o más rápido que tiempo real,
 *    según el teléfono) y produce MP4 H.264 cuando el navegador lo permite.
 * 2) Si no hay WebCodecs: MediaRecorder graba en tiempo real (MP4 si el navegador lo admite; si no, WebM).
 */
export async function exportProject(project: Project, assets: AssetResolver, o: ExportOptions): Promise<ExportResult> {
  const { w, h } = outputSize(project.aspect, o.shortSide);
  const caps = await detectCapabilities(w, h);
  const canvas = document.createElement('canvas');
  const engine = new Engine(canvas);
  try {
    engine.setSize(w, h);
    o.onProgress?.(0, 'Preparando escenas…');
    await engine.setProject(project, assets);
    if (caps.webcodecs && caps.videoCodec) return await viaWebCodecs(engine, project, caps, w, h, o);
    if (caps.mediaRecorderMime) return await viaMediaRecorder(engine, project, caps.mediaRecorderMime, w, h, o);
    throw new Error('Este navegador no puede codificar video (ni WebCodecs ni MediaRecorder). Usa Chrome actualizado.');
  } finally {
    engine.dispose();
  }
}

async function viaWebCodecs(engine: Engine, p: Project, caps: Capabilities, w: number, h: number, o: ExportOptions): Promise<ExportResult> {
  const t0 = performance.now();
  const notes: string[] = [];
  const videoCodec = caps.videoCodec!;
  const isMp4 = videoCodec === 'avc';
  const fps = p.fps;
  const dur = projectDuration(p);
  const output = new Output({
    format: isMp4 ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(),
    target: new BufferTarget(),
  });
  const video = new CanvasSource(engine.canvas, { codec: videoCodec, bitrate: QUALITY_HIGH, keyFrameInterval: 2 });
  output.addVideoTrack(video, { frameRate: fps });

  let audioCodec: AudioCodec | null = null;
  let audioSrc: AudioBufferSource | null = null;
  if (o.audio) {
    audioCodec = caps.audioCodec;
    if (audioCodec && (await canEncodeAudio(audioCodec, { numberOfChannels: 2, sampleRate: 48000 }))) {
      audioSrc = new AudioBufferSource({ codec: audioCodec, bitrate: 160_000 });
      output.addAudioTrack(audioSrc);
      if (isMp4 && audioCodec === 'opus') notes.push('Audio en Opus: este navegador no codifica AAC. Se reproduce en Chrome y en Android 10 o posterior; algunas apps antiguas podrían no leer el audio.');
    } else {
      audioCodec = null;
      notes.push('Este navegador no puede codificar audio: el video se exportó sin sonido.');
    }
  }
  await output.start();
  if (audioSrc) {
    o.onProgress?.(0.01, 'Generando banda sonora…');
    const buf = await renderSoundtrack(p);
    await audioSrc.add(buf);
    audioSrc.close();
  }
  const frames = Math.round(dur * fps);
  for (let f = 0; f < frames; f++) {
    if (o.signal?.aborted) {
      await output.cancel();
      throw new DOMException('Exportación cancelada', 'AbortError');
    }
    const t = f / fps;
    engine.render(t, f);
    await video.add(t, 1 / fps);
    if (f % 5 === 0) {
      o.onProgress?.(0.02 + 0.95 * (f / frames), `Fotograma ${f + 1} de ${frames}`);
      await new Promise((r) => setTimeout(r, 0)); // deja respirar a la interfaz
    }
  }
  video.close();
  o.onProgress?.(0.98, 'Cerrando archivo…');
  await output.finalize();
  const buffer = (output.target as BufferTarget).buffer!;
  const mime = isMp4 ? 'video/mp4' : 'video/webm';
  if (!isMp4) notes.push('Este navegador no codifica H.264: se exportó WebM (VP9/VP8). Android lo reproduce en Chrome y en la mayoría de reproductores.');
  return {
    blob: new Blob([buffer], { type: mime }), mime, ext: isMp4 ? 'mp4' : 'webm', method: 'webcodecs',
    videoCodec, audioCodec, width: w, height: h, seconds: dur, elapsed: (performance.now() - t0) / 1000, notes,
  };
}

/** Alternativa en tiempo real: el video tarda exactamente su duración en grabarse. */
async function viaMediaRecorder(engine: Engine, p: Project, mime: string, w: number, h: number, o: ExportOptions): Promise<ExportResult> {
  const t0 = performance.now();
  const notes = ['Grabación en tiempo real con MediaRecorder: no cambies de app ni apagues la pantalla mientras graba.'];
  const dur = projectDuration(p);
  const stream = engine.canvas.captureStream(p.fps);
  let actx: AudioContext | null = null;
  if (o.audio) {
    actx = new AudioContext({ sampleRate: 48000 });
    const buf = await renderSoundtrack(p);
    const src = actx.createBufferSource();
    src.buffer = buf;
    const dest = actx.createMediaStreamDestination();
    src.connect(dest);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    src.start(actx.currentTime + 0.05);
  }
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((res) => (rec.onstop = () => res()));
  rec.start(500);
  const start = performance.now() + 50;
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      if (t >= dur || o.signal?.aborted) return resolve();
      engine.render(Math.max(0, t));
      o.onProgress?.(t / dur, `Grabando ${t.toFixed(1)} / ${dur.toFixed(1)} s`);
      requestAnimationFrame(tick);
    };
    tick();
  });
  rec.stop();
  await done;
  await actx?.close();
  if (o.signal?.aborted) throw new DOMException('Exportación cancelada', 'AbortError');
  const type = mime.split(';')[0];
  const ext = type === 'video/mp4' ? 'mp4' : 'webm';
  return {
    blob: new Blob(chunks, { type }), mime: type, ext, method: 'mediarecorder',
    videoCodec: mime, audioCodec: o.audio ? 'según el navegador' : null, width: w, height: h, seconds: dur,
    elapsed: (performance.now() - t0) / 1000, notes,
  };
}
