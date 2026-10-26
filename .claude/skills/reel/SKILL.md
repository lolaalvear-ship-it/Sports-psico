---
name: reel
description: Flujo guiado para crear un reel vertical de divulgación (psicología, psicología del deporte, neurociencia) a partir de una frase. Úsalo cuando la persona pida "hazme un vídeo/reel/short sobre…", quiera retomar un reel a medias o pida la portada o el texto del post de un reel. Busca fuentes en PubMed, escribe guion con tres ganchos, genera la voz con ElevenLabs, propone dos aperturas y entrega vídeo 1080×1920, portada y texto del post con referencias, con cuatro aprobaciones de la persona por el camino.
---

# Reel guiado: de una frase a un vídeo con fuentes

Todo ocurre en `video/`. Cada reel vive en `video/reels/<slug>/`. El motor está en `video/engine/`
(`core.js`, `captions.js`, `kit2d.js`, `kit3d.js`) y la plantilla de ejemplo en `video/reels/_plantilla/`.
La identidad (nombre, usuario, colores, voz, frase de cierre, pronunciaciones) está en `video/marca.json`.

**Regla de oro:** nada entra en el vídeo sin aprobación. Hay cuatro paradas obligatorias (🛑).
En cada una, enseña lo necesario para decidir y espera la respuesta. No avances por tu cuenta.

Habla en español, claro y breve. La persona es profesional de la psicología: su criterio manda.

## 0 · Preparar

1. Si `video/node_modules` no existe: `cd video && npm install`.
2. Si `video/marca.json` aún tiene `@tu_usuario` o `voice_id` vacío, pide esos datos antes del paso 3
   (no hace falta para empezar con las fuentes).
3. Si la persona quiere retomar un reel, lee sus `FUENTES.md`, `GUION.md` y `timeline.json` para ver en qué paso está.

## 1 · Fuentes 🛑

1. Traduce el tema a una consulta en inglés y busca:
   `python3 tools/pubmed.py "<consulta>" --max 15 [--desde 2010]`
   Si hace falta más contexto de un artículo: `python3 tools/pubmed.py --pmid <PMID> [...]`.
   Si no hay acceso a PubMed (red bloqueada), usa la búsqueda web y verifica cada artículo en pubmed.ncbi.nlm.nih.gov.
2. Elige de **3 a 6 fuentes**, priorizando metaanálisis y revisiones sistemáticas, luego ensayos y guías.
   Evita estudios con muestras mínimas salvo que sean el caso famoso del tema, y dilo.
3. Presenta una tabla: nº · cita corta (autor, año, revista) · tipo · **el dato que usarías** · límite.
4. **Si dos estudios se contradicen, dilo y pregunta cuál pesa más.** No elijas por la persona.
5. 🛑 **Aprobación 1:** ¿qué fuentes entran? Lo que no se apruebe no puede aparecer en el guion ni en pantalla.
6. Crea el reel: `python3 tools/nuevo_reel.py <slug> "<título>"` (slug corto en minúsculas con guiones)
   y escribe en `FUENTES.md` solo las aprobadas: cita completa con PMID/DOI, qué encontraron, límite y la frase del guion que lo usa.

## 2 · Guion y gancho 🛑

1. Escribe **tres ganchos** distintos (pregunta, escena en segunda persona, dato sorprendente), de 1–2 frases cada uno.
2. Escribe el guion para unos **45–60 s** (≈ 130–160 palabras):
   - un párrafo por idea; cada párrafo será una escena;
   - frases cortas y habladas, sin paréntesis ni abreviaturas raras;
   - cada dato con su fuente al lado en `GUION.md` (no en la narración): `… el 42 % [Autor 2019]`;
   - cierre que conecte con la práctica (qué puede hacer quien lo ve) y, si procede, la frase de `marca.json → cierre`.
3. Nada de afirmaciones más fuertes que la evidencia: «se asocia con», «en este estudio», etc. Si es un caso único o en animales, que se note.
4. 🛑 **Aprobación 2:** la persona elige gancho y aprueba (o corrige) el guion. Itera hasta el sí.
5. Guarda:
   - `narracion.txt`: el texto exacto que se locuta, **un párrafo por línea**, empezando por el gancho elegido;
   - `GUION.md`: los tres ganchos (marcando el elegido), el guion con fuentes y, por escena, qué se verá;
   - `reel.json → anchors`: `[["<id_escena>", "primeras palabras del párrafo"], …]` (la primera con `null`);
     `marks`: `[["<id_escena>", "<clave>", "palabra o frase exacta"]]` para los momentos que deben caer justo en una palabra.

## 3 · Voz 🛑

La voz cuesta dinero: solo se genera con el guion ya aprobado.

1. Revisa siglas, cifras y nombres propios del guion. Añade a `marca.json → pronunciacion` las que ElevenLabs pueda leer mal
   (los subtítulos siguen mostrando la forma escrita).
2. Vista previa sin gasto: `python3 tools/voz.py <slug>` y di cuántos caracteres (≈ créditos) va a costar.
3. Generar: `python3 tools/voz.py <slug> --si` → `audio/voz.mp3`. La persona la escucha.
4. 🛑 **Aprobación 3:** ¿vale la voz? Si no, ajusta pronunciaciones, puntuación o `marca.json → voz` y vuelve a generar.
5. Ajusta duración y volumen: `python3 tools/prep_audio.py reels/<slug>/audio/voz.mp3 reels/<slug>/audio/voz_final.wav [--tempo 1.03] [--keep <s>]`
   (recorta pausas largas, sin cambiar el tono; normaliza a −14 LUFS). Objetivo: ≤ 60 s si es posible.
6. Sincroniza: `python3 tools/sync.py --reel <slug>` → `timeline.json` con tiempos de escena, marcas y subtítulos palabra a palabra.
   Si no encuentra suficientes pausas: `--noise -30` o `--min-sil 0.12`; si un corte cae mal, usa `breaks` en `reel.json`.

## 4 · Apertura A/B y vídeo 🛑

1. Reescribe `scenes.js` del reel para este guion (la plantilla es solo un ejemplo):
   - una función `SC.<id>` por cada escena de `anchors`; la primera en dos versiones, `SC.<id>_A` y `SC.<id>_B`;
   - **estilo por defecto: lámina médica ilustrada** con `kitmed.js` (`import * as M from '/engine/kitmed.js'`).
     Cada escena empieza con un fondo médico y tiene al menos una pieza dibujada que ilustre lo narrado:
     fondos `tissueBg`, `bloodBg`, `cellsBg`, `shardsBg`, `mouthBg`, `splitScreen` (comparaciones lado a lado);
     piezas `heart`, `brain` (lóbulos resaltables), `lungs`, `stomach`, `kidney`, `bone` (fractura, hematoma), `ovum`, `rbc`,
     `neuron`, `pill`, `syringe` y `person` (de pie, correr, tumbado, caer, sentado);
     ve ejemplos de cada una en `reels/_galeria/scenes.js` y la combinación completa en `reels/_plantilla/scenes.js`;
   - complementos: `kit2d.js` (bigNumber, bars, pulseLine, breathRing, stopwatch, target, chip, endCard),
     `kit3d.js` (cerebro 3D de puntos, neuronas, sinapsis: estilo «neón», úsalo solo si la persona lo pide) y
     `core.js` (title, txt, wrap, cite, badge, bokeh, siluetas…);
   - si el tema necesita un órgano o elemento que no existe en el kit, dibújalo en `kitmed.js` con las mismas técnicas
     (`volume` para dar volumen y textura, `tube` para vasos y conductos, `ball` para esferas) y añádelo a la galería;
   - en pantalla, cada dato lleva su `cite('Autor et al. · Revista Año', …)`; solo datos de `FUENTES.md`;
   - usa `mark(sc, '<clave>', defecto)` para que lo visual caiga en la palabra;
   - termina con `start(SC, { noCaps: [...] })` listando las escenas cuyo texto grande ya dice lo narrado.
2. Fotogramas de prueba de ambas aperturas y de cada escena:
   `node render.mjs --reel <slug> --stills 1,2.5 --open A` y `--open B`, más `--stills <t1>,<t2>,…` del resto.
   Mira tú los PNG (`reels/<slug>/output/stills/`) antes de enseñarlos: texto cortado, solapes, cifras correctas.
   Opcional: clip de la apertura `node render.mjs --reel <slug> --open B --to 4 --out reels/<slug>/output/B_preview.mp4`.
3. 🛑 **Aprobación 4:** la persona elige apertura A o B (y pide retoques si quiere). Guarda la elegida en `timeline.json → "opening"`.
4. Efectos de sonido: `python3 tools/sfx.py <slug>` (whoosh en cada cambio de escena y golpe suave en cada marca) → `audio/mezcla.wav`.
5. Render final: `node render.mjs --reel <slug>` → `output/reel.mp4` (1080×1920, 30 fps, H.264 + AAC; usa `mezcla.wav` automáticamente).
   Tarda unos minutos; usa `run_in_background` si es largo.
6. Portada: `node render.mjs --reel <slug> --cover [--at <segundo>]` → `output/portada.png` (por defecto `timeline.json → cover`).

## 5 · Entrega

1. Escribe `POST.md`: texto del post (gancho en la primera línea, 3–6 líneas de valor, llamada a la acción suave),
   **referencias** completas en formato breve (autor, año, revista, DOI o PMID) y los hashtags de `marca.json`.
2. Resume: ruta del vídeo, de la portada y del texto del post, duración y estilo de subtítulos.
3. Publicar o programar en redes **solo si la persona lo pide explícitamente**.

## Ajustes rápidos

- Estilo de subtítulos: `timeline.json → "captionStyle"`: `karaoke`, `caja`, `pop` o `linea` (por defecto `marca.json → subtitulos`).
  Quitar subtítulos: `"showCaptions": false`. Sin acercamiento de cámara: `"camera": "none"` (global o por escena).
- Sin whoosh en una escena: `"sfx": false` en esa escena; marca sin golpe: clave que empiece por `_`.
- `sync.py` conserva estos ajustes al re-sincronizar.
