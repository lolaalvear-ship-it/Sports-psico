# Reels de psicología · motor y flujo guiado

Pídele a Claude Code, abriendo esta carpeta: **«Hazme un reel sobre por qué los deportistas se bloquean en los penaltis»**.
La skill `reel` (`.claude/skills/reel/SKILL.md`) te lleva por cuatro pasos y no avanza sin tu aprobación:

| Paso | Qué hace | Tú apruebas |
|---|---|---|
| 1 · Fuentes | Busca en PubMed (`tools/pubmed.py`), propone de 3 a 6 estudios con el dato de cada uno y avisa si se contradicen | Qué fuentes entran |
| 2 · Guion | Tres ganchos y el guion con la fuente al lado de cada dato | Gancho y guion |
| 3 · Voz | ElevenLabs (`tools/voz.py`) con tu voz y pronunciación de siglas; luego recorta pausas y sincroniza | La voz (solo se paga tras aprobar el guion) |
| 4 · Vídeo | Dos aperturas (A/B) en fotogramas de prueba; después vídeo final con efectos de sonido, portada y texto del post con referencias | La apertura |

### Qué necesitas

- Node 18+ y Python 3 con `numpy`; `ffmpeg` en el PATH.
- Playwright con Chromium: `npm i -g playwright && npx playwright install chromium` (si no lo tienes ya).
- Cuenta de ElevenLabs. Crea `video/.env` con `ELEVENLABS_API_KEY=...` y pon tu `voice_id` en `video/marca.json`
  (`python3 tools/voz.py --voces` lista las de tu cuenta). Para usar los vídeos en redes necesitas un plan de pago de ElevenLabs.
- Rellena `video/marca.json`: nombre, usuario, colores, frase de cierre, estilo de subtítulos y pronunciaciones.

### Estructura

| Ruta | Contenido |
|---|---|
| `video/engine/core.js` | Utilidades, tipografía animada, citas, siluetas, grano/viñeta, cámara y composición con fundidos |
| `video/engine/captions.js` | Subtítulos palabra a palabra en 4 estilos: `karaoke`, `caja`, `pop`, `linea` |
| `video/engine/kit2d.js` | Cifra que cuenta, barras comparativas, electrocardiograma, respiración, cronómetro, estadio, diana, etiqueta, cierre de marca |
| `video/engine/kit3d.js` | Cerebro 3D con regiones resaltables (amígdala, prefrontal, corteza motora, cerebelo…), neuronas y sinapsis |
| `video/reels/_plantilla/` | Reel de ejemplo con todas las piezas; `tools/nuevo_reel.py` lo copia para cada reel nuevo |
| `video/reels/<slug>/` | `FUENTES.md`, `GUION.md`, `narracion.txt`, `scenes.js`, `timeline.json`, `POST.md`, `audio/`, `output/` |
| `video/tools/` | `pubmed.py`, `voz.py`, `prep_audio.py`, `sync.py`, `sfx.py`, `nuevo_reel.py` |

### Comandos sueltos

```bash
cd video && npm install
python3 tools/nuevo_reel.py penaltis "Por qué fallamos los penaltis"
python3 tools/voz.py penaltis --si                       # voz (gasta créditos)
python3 tools/prep_audio.py reels/penaltis/audio/voz.mp3 reels/penaltis/audio/voz_final.wav
python3 tools/sync.py --reel penaltis                    # escenas y subtítulos sincronizados
node render.mjs --reel penaltis --stills 1,2.5 --open B  # fotogramas de prueba de la apertura B
python3 tools/sfx.py penaltis                            # efectos de sonido + mezcla
node render.mjs --reel penaltis                          # reels/penaltis/output/reel.mp4
node render.mjs --reel penaltis --cover                  # reels/penaltis/output/portada.png
```

Las tipografías Inter e Inter Display van incluidas en `video/engine/fonts/` (licencia SIL OFL 1.1).

---

# Short · «¿Por qué nuestro cerebro se obsesiona con alguien que no podemos tener?»

Short vertical (1080×1920, 30 fps, 60 s, MP4/H.264) producido íntegramente por código, sin servicios de pago.

| Carpeta | Contenido |
|---|---|
| `docs/GUION.md` | Texto para la narración + guion técnico escena por escena |
| `docs/INVESTIGACION.md` | Estudios usados, qué dicen, sus límites y enlaces de verificación |
| `video/output/short_sin_narracion.mp4` | **Video final sin narración** |
| `video/src/` | Motor de escenas (Three.js + Canvas 2D) y `timeline.json` |
| `video/render.mjs` | Render fotograma a fotograma (Chromium sin interfaz → ffmpeg) |
| `video/tools/sync.py` | Sincroniza escenas y subtítulos con la voz |

## Cómo se produce

1. `video/src/main.js` dibuja cada instante `t`: el cerebro 3D (una nube de unos 90 000 puntos con surcos, ATV, estriado y vías dopaminérgicas), la red de neuronas con impulsos, la sinapsis con vesículas y dopamina, escenas cinematográficas en 2D (siluetas con luz de contorno, lluvia, bokeh, amanecer), textos animados, grano y viñeta.
2. `render.mjs` abre la página en Chromium sin interfaz, pide los 1800 fotogramas uno a uno y los pasa a ffmpeg (libx264, CRF 17, `+faststart`).

```bash
cd video && npm install
node render.mjs                         # video completo
node render.mjs --stills 1,15,30        # fotogramas de prueba en PNG
```

## Versión final con narración

- `video/output/short_final.mp4`: video con la voz y escenas sincronizadas, sin subtítulos (≈60,6 s).
- `video/audio/voz.mp3`: narración original (ElevenLabs, 66,6 s).

La narración original duraba 66,6 s. Para dejarla en unos 60 s sin que suene acelerada:
1. Las pausas de más de 0,45 s se recortaron a 0,45 s, de 66,6 a 63,4 s.
2. Se aplicó `atempo=1.06`, que acelera sin cambiar el tono.
3. Se normalizó el volumen a −14 LUFS, el estándar de redes (`loudnorm`), y quedó en 59,8 s.

Los subtítulos dinámicos están desactivados (`"showCaptions": false` en `video/src/timeline.json`). Para activarlos, cambia ese valor a `true` y vuelve a renderizar.

## Fase 2: incorporar la narración

1. Genera la voz con el texto de `docs/GUION.md`. Para una mejor sincronía, deja una pausa breve (unos 0,3 s) entre párrafos.
2. Envía el MP3. Después se ejecuta lo siguiente:

```bash
python3 tools/sync.py voz.mp3            # re-temporiza escenas + subtítulos palabra a palabra
node render.mjs --audio voz.mp3 --out output/short_final.mp4
```

`sync.py` no usa reconocimiento de voz. Detecta las pausas con ffmpeg y, como el texto es conocido, asigna cada párrafo y cada palabra a su tramo. Así cada escena empieza con la frase que ilustra, y los subtítulos aparecen en bloques de hasta 3 palabras, con la palabra activa resaltada.

---

# Short 2 · «¿Por qué recuerdas con detalle lo que te hizo sufrir?»

| Archivo | Contenido |
|---|---|
| `docs/tema2-recuerdos/GUION.md` | Texto de la narración y plan de escenas |
| `docs/tema2-recuerdos/INVESTIGACION.md` | Estudios usados (McGaugh, Cahill, Kensinger, Payne, Talarico & Rubin, Walker) y sus límites |
| `video/output/short_recuerdos_final.mp4` | **Video final con narración** (sin subtítulos) |
| `video/src-recuerdos/` | Escenas del segundo Short (mismo motor: amígdala, hipocampo, sinapsis bloqueable…) |
| `video/projects/recuerdos.json` | Anclas de escena y marcas de palabras para `sync.py` |

```bash
python3 tools/sync.py audio/voz_recuerdos_final.wav --config projects/recuerdos.json
node render.mjs --src src-recuerdos --audio audio/voz_recuerdos_final.wav --out output/short_recuerdos_final.mp4
```

La narración original duraba 61,6 s. Solo se recortaron las pausas de más de 0,45 s, sin cambiar la velocidad de la voz, y se normalizó el volumen. Quedó en 58,8 s.

---

# Short 3 · «¿Por qué sentimos que alguien nos observa cuando estamos solos?»

| Archivo | Contenido |
|---|---|
| `docs/tema3-observado/GUION.md` | Texto de la narración y plan de escenas |
| `docs/tema3-observado/INVESTIGACION.md` | Hallazgos científicos separados de las creencias paranormales, con fuentes |
| `video/output/short_observado_final.mp4` | **Video final con narración** (sin subtítulos) |
| `video/src-observado/` | Escenas: pasillo, ojos, amígdala, campo visual, detector de humo, ciencia frente a creencia, robot de Blanke |
| `video/projects/observado.json` | Anclas, marcas y la frontera fijada del primer párrafo (`breaks`) |

```bash
python3 tools/prep_audio.py audio/voz_observado.mp3 audio/voz_observado_final.wav --max-pause 0.5 --keep 60.47 --tempo 1.03
python3 tools/sync.py audio/voz_observado_final.wav --config projects/observado.json
node render.mjs --src src-observado --audio audio/voz_observado_final.wav --out output/short_observado_final.mp4
```

`tools/prep_audio.py` recorta pausas largas, salvo las indicadas con `--keep` (aquí, la pausa dramática antes de «eres tú»), aplica un tempo suave y normaliza el volumen a −14 LUFS.
