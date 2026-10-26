import { useEffect, useRef, useState } from 'react';
import { outputSize } from '../engine/engine';
import type { Project } from '../engine/types';
import { detectCapabilities, exportProject, type Capabilities, type ExportResult } from '../export/exporter';
import { assets } from '../storage/models';

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'video';

export function ExportPanel({ project }: { project: Project }) {
  const [res, setRes] = useState<720 | 1080>(1080);
  const [withAudio, setWithAudio] = useState(project.audio.enabled);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ k: number; msg: string } | null>(null);
  const [result, setResult] = useState<(ExportResult & { url: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const { w, h } = outputSize(project.aspect, res);
    detectCapabilities(w, h).then(setCaps);
  }, [project.aspect, res]);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    abort.current = new AbortController();
    try {
      const r = await exportProject(project, assets, { shortSide: res, audio: withAudio, signal: abort.current.signal, onProgress: (k, msg) => setProgress({ k, msg }) });
      setResult({ ...r, url: URL.createObjectURL(r.blob) });
    } catch (e) {
      setError((e as Error).name === 'AbortError' ? 'Exportación cancelada.' : 'Error al exportar: ' + (e as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const fileName = result ? `${slug(project.name)}.${result.ext}` : '';
  const canShare = !!result && typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([result.blob], fileName, { type: result.mime })] });

  async function share() {
    if (!result) return;
    try {
      await navigator.share({ files: [new File([result.blob], fileName, { type: result.mime })], title: project.name });
    } catch { /* el usuario canceló */ }
  }

  const method = caps ? (caps.webcodecs && caps.videoCodec ? `WebCodecs · ${caps.videoCodec === 'avc' ? 'MP4 (H.264)' : 'WebM (' + caps.videoCodec.toUpperCase() + ')'}${caps.audioCodec ? ' + ' + caps.audioCodec.toUpperCase() : ' · sin codificador de audio'}` : caps.mediaRecorderMime ? `MediaRecorder en tiempo real · ${caps.mediaRecorderMime.split(';')[0]}` : 'Sin codificador de video disponible') : 'Comprobando el navegador…';

  return (
    <section className="card">
      <h2>Exportar video</h2>
      <p className="muted small">Este navegador: {method}</p>
      <div className="field">
        <span>Resolución</span>
        <div className="seg">
          <button className={res === 720 ? 'on' : ''} onClick={() => setRes(720)} disabled={busy}>720p (rápido)</button>
          <button className={res === 1080 ? 'on' : ''} onClick={() => setRes(1080)} disabled={busy}>1080p</button>
        </div>
      </div>
      <label className="check"><input type="checkbox" checked={withAudio} onChange={(e) => setWithAudio(e.target.checked)} disabled={busy} /> Incluir banda sonora</label>
      {!busy ? (
        <button className="btn primary" onClick={run}>🎬 Generar video</button>
      ) : (
        <button className="btn danger" onClick={() => abort.current?.abort()}>Cancelar</button>
      )}
      {progress && (
        <div className="progress">
          <div className="bar"><i style={{ width: `${Math.round(progress.k * 100)}%` }} /></div>
          <small>{progress.msg} · {Math.round(progress.k * 100)} %</small>
          <small className="muted">Mantén la pantalla encendida y esta pestaña abierta.</small>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {result && (
        <div className="result">
          <video src={result.url} controls playsInline className={project.aspect === '9:16' ? 'portrait' : 'landscape'} />
          <p className="small">
            {result.ext.toUpperCase()} · {result.width}×{result.height} · {result.seconds.toFixed(1)} s · {(result.blob.size / 1e6).toFixed(1)} MB · listo en {result.elapsed.toFixed(0)} s
          </p>
          {result.notes.map((n) => <p key={n} className="hint">{n}</p>)}
          <div className="row-btns">
            <a className="btn primary" href={result.url} download={fileName}>⬇ Descargar</a>
            {canShare && <button className="btn" onClick={share}>Compartir</button>}
          </div>
          <p className="hint">En Android, el archivo queda en la carpeta Descargas y aparece en Google Fotos o en la galería.</p>
        </div>
      )}
    </section>
  );
}
