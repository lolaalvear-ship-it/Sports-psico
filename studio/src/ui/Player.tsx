import { useEffect, useRef, useState } from 'react';
import { audioSignature, renderSoundtrack } from '../engine/audio';
import { Engine, outputSize, projectDuration, timeline } from '../engine/engine';
import type { Project } from '../engine/types';
import { assets } from '../storage/models';

/** Fotograma de portada mientras no se ha reproducido (el instante 0 es negro por el fundido). */
const POSTER = 1.8;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Vista previa en tiempo real. Usa el mismo motor que la exportación, a menor resolución. */
export function Player({ project, seekTo }: { project: Project; seekTo?: { t: number; n: number } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [t, setT] = useState(POSTER);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const tRef = useRef(POSTER);
  const started = useRef(false);
  const audio = useRef<{ ctx: AudioContext | null; sig: string; buf: AudioBuffer | null; src: AudioBufferSourceNode | null }>({ ctx: null, sig: '', buf: null, src: null });
  const dur = projectDuration(project);

  useEffect(() => {
    try {
      engineRef.current = new Engine(canvasRef.current!);
    } catch (e) {
      setError('No se pudo iniciar WebGL en este navegador: ' + (e as Error).message);
    }
    return () => {
      engineRef.current?.dispose();
      audio.current.src?.stop();
      audio.current.ctx?.close();
    };
  }, []);

  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const { w, h } = outputSize(project.aspect, 540);
    eng.setSize(w, h);
    eng.setProject(project, assets).then(() => {
      setLoading(false);
      eng.render(Math.min(tRef.current, projectDuration(project)));
    }).catch((e) => setError(String(e)));
  }, [project]);

  useEffect(() => {
    if (!seekTo) return;
    started.current = true;
    tRef.current = seekTo.t;
    setT(seekTo.t);
    engineRef.current?.render(seekTo.t);
    if (playing) startAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekTo]);

  // bucle de reproducción
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      tRef.current += (now - last) / 1000;
      last = now;
      if (tRef.current >= dur) {
        tRef.current = 0;
        startAudio();
      }
      engineRef.current?.render(tRef.current);
      setT(tRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, dur]);

  function stopAudio() {
    try { audio.current.src?.stop(); } catch { /* ya detenido */ }
    audio.current.src = null;
  }
  /** Arranca el audio en la posición actual del cabezal. */
  async function startAudio() {
    stopAudio();
    const a = audio.current;
    if (!projectRef.current.audio.enabled || mutedRef.current || !a.ctx) return;
    const project = projectRef.current;
    const sig = audioSignature(project);
    if (a.sig !== sig || !a.buf) {
      a.sig = sig;
      a.buf = await renderSoundtrack(project, a.ctx.sampleRate);
    }
    if (!playingRef.current) return;
    const src = a.ctx.createBufferSource();
    src.buffer = a.buf;
    src.connect(a.ctx.destination);
    src.start(0, Math.min(tRef.current, Math.max(0, a.buf.duration - 0.01)));
    a.src = src;
  }
  const playingRef = useRef(false);
  playingRef.current = playing;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const projectRef = useRef(project);
  projectRef.current = project;

  function toggle() {
    if (playing) {
      setPlaying(false);
      stopAudio();
      return;
    }
    // el AudioContext debe crearse dentro del gesto del usuario (requisito de Android)
    if (!audio.current.ctx) audio.current.ctx = new AudioContext();
    audio.current.ctx.resume();
    if (tRef.current >= dur - 0.05 || !started.current) tRef.current = 0;
    started.current = true;
    playingRef.current = true;
    setPlaying(true);
    startAudio();
  }

  function toggleMute() {
    mutedRef.current = !muted;
    setMuted(!muted);
    if (mutedRef.current) stopAudio();
    else if (playing) startAudio();
  }

  function seek(v: number) {
    started.current = true;
    tRef.current = v;
    setT(v);
    engineRef.current?.render(v);
    if (playing) startAudio();
  }

  const tl = timeline(project);
  const portrait = project.aspect === '9:16';
  return (
    <div className="player">
      <div className={'stage ' + (portrait ? 'portrait' : 'landscape')}>
        <canvas ref={canvasRef} onClick={toggle} />
        {loading && <div className="stage-msg">Preparando escenas…</div>}
        {error && <div className="stage-msg error">{error}</div>}
        {!playing && !loading && !error && <button className="big-play" onClick={toggle} aria-label="Reproducir">▶</button>}
      </div>
      <div className="transport">
        <button className="icon" onClick={toggle} aria-label={playing ? 'Pausa' : 'Reproducir'}>{playing ? '❚❚' : '▶'}</button>
        <div className="scrub">
          <div className="marks">
            {tl.map((it) => <span key={it.scene.id} style={{ left: `${(it.start / dur) * 100}%` }} />)}
          </div>
          <input type="range" min={0} max={dur} step={0.01} value={t} onChange={(e) => seek(Number(e.target.value))} aria-label="Posición" />
        </div>
        <span className="time">{fmt(t)} / {fmt(dur)}</span>
        <button className="icon" onClick={toggleMute} aria-label="Sonido">{muted || !project.audio.enabled ? '🔇' : '🔊'}</button>
      </div>
    </div>
  );
}
