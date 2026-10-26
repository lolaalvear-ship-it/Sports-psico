import { useState } from 'react';
import { STYLES } from '../engine/styles';
import type { Aspect, Project } from '../engine/types';
import { DURATIONS, SPECIALTIES, generateProject, loveDemo } from '../generator/generator';

export function CreateView({ onCreate }: { onCreate: (p: Project) => void }) {
  const [topic, setTopic] = useState('');
  const [specialty, setSpecialty] = useState(SPECIALTIES[0]);
  const [duration, setDuration] = useState(15);
  const [aspect, setAspect] = useState<Aspect>('9:16');
  const [styleId, setStyleId] = useState(STYLES[0].id);

  return (
    <div className="view">
      <section className="card hero-card">
        <h2>Video de prueba</h2>
        <p className="muted">«¿Qué sucede en tu cerebro cuando te enamoras?» · 15 s · 9:16</p>
        <button className="btn primary" onClick={() => onCreate(loveDemo(aspect))}>Abrir el video de prueba</button>
      </section>

      <section className="card">
        <h2>Nuevo video</h2>
        <label className="field">
          <span>Tema científico</span>
          <textarea rows={2} placeholder="Ej.: ¿Cómo se forma un recuerdo?" value={topic} onChange={(e) => setTopic(e.target.value)} />
        </label>
        <label className="field">
          <span>Especialidad</span>
          <select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
            {SPECIALTIES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <div className="field">
          <span>Duración</span>
          <div className="seg">
            {DURATIONS.map((d) => <button key={d} className={d === duration ? 'on' : ''} onClick={() => setDuration(d)}>{d} s</button>)}
          </div>
        </div>
        <div className="field">
          <span>Formato</span>
          <div className="seg">
            <button className={aspect === '9:16' ? 'on' : ''} onClick={() => setAspect('9:16')}>9:16 vertical</button>
            <button className={aspect === '16:9' ? 'on' : ''} onClick={() => setAspect('16:9')}>16:9 horizontal</button>
          </div>
        </div>
        <div className="field">
          <span>Estilo visual</span>
          <div className="styles">
            {STYLES.map((s) => (
              <button key={s.id} className={'style-chip ' + (s.id === styleId ? 'on' : '')} onClick={() => setStyleId(s.id)}>
                <i style={{ background: `linear-gradient(135deg, ${s.primary}, ${s.secondary} 55%, ${s.accent})` }} />
                <b>{s.name}</b>
                <small>{s.description}</small>
              </button>
            ))}
          </div>
        </div>
        <button className="btn primary" onClick={() => onCreate(generateProject({ topic, specialty, duration, aspect, styleId }))} disabled={!topic.trim()}>
          Generar animación
        </button>
        <p className="hint">Fase 1: las escenas se eligen con plantillas según la especialidad y palabras clave del tema. Los textos son un borrador: revísalos en el editor antes de exportar.</p>
      </section>
    </div>
  );
}
