# Scientific Motion Studio

Generador de videos médicos y científicos que funciona **en el navegador del teléfono** (Chrome para Android). Es una aplicación web progresiva (PWA): se instala desde Chrome, abre sin conexión después de la primera visita y guarda los proyectos en el propio teléfono.

No necesita computadora, servidor ni cuentas de pago.

## Cómo usarla desde Android

1. Abre la dirección de la app en Chrome (ver «Publicación» abajo).
2. Menú ⋮ → **Añadir a pantalla de inicio** para tenerla como app.
3. **Crear** → escribe el tema, elige especialidad, duración, formato y estilo → **Generar animación**. También puedes abrir el **video de prueba**.
4. **Editor** → reproduce la vista previa y toca una escena para editar el título, el texto, la duración, la cámara, las regiones del cerebro, los neurotransmisores, etc.
5. **Exportar video** → **Generar video** → **Descargar**. El archivo queda en *Descargas* y aparece en Google Fotos. Con **Compartir** lo envías directamente a WhatsApp, Drive, etc.
6. **Proyectos** → los proyectos se guardan solos. Descarga una copia `.json` si vas a borrar los datos del navegador.

## Qué incluye esta primera versión

| Parte | Estado |
|---|---|
| Interfaz móvil (Crear, Editor, Biblioteca, Proyectos) | ✔ |
| Motor híbrido 3D (Three.js / WebGL) + 2D (Canvas) | ✔ |
| Escenas: título, cerebro 3D con 12 regiones y vías dopaminérgicas, red neuronal con impulsos, sinapsis con 8 neurotransmisores, circulación sanguínea pulsátil, célula eucariota, moléculas (dopamina, noradrenalina, serotonina, acetilcolina) | ✔ |
| Cámara cinematográfica (órbita, acercamiento, alejamiento, paneo, fija), transiciones, textos animados, etiquetas anatómicas, grano y viñeta | ✔ |
| 4 estilos visuales, formatos 9:16 y 16:9 | ✔ |
| Banda sonora procedimental (Web Audio) sincronizada con impulsos, vesículas y latidos | ✔ |
| Exportación MP4 (H.264) con WebCodecs, alternativas WebM y MediaRecorder | ✔ (ver pruebas) |
| Importación de modelos GLB/GLTF propios (guardados en IndexedDB) | ✔ |
| Aviso «Representación conceptual» y fuentes al final del video | ✔ |
| Guiones con IA, composición automática avanzada, biblioteca anatómica descargable | Fase 2 |

## Video de prueba ya exportado

`demo/enamoramiento_15s_1080x1920.mp4`: «¿Qué sucede en tu cerebro cuando te enamoras?», 15 s, 1080×1920, producido por el mismo exportador de la app (prueba automática en Chromium).

## Exportación de video: qué está probado y qué no

La app detecta lo que el navegador realmente puede hacer y elige, en este orden:

1. **WebCodecs + MP4 (H.264)**: renderiza fotograma a fotograma, así el resultado es fluido aunque el teléfono sea lento. Audio en AAC si el navegador lo codifica; si no, en Opus.
2. **WebCodecs + WebM (VP9/VP8)**, si no hay H.264.
3. **MediaRecorder** en tiempo real (MP4 si el navegador lo admite; si no, WebM), si no hay WebCodecs.

La pestaña de exportación muestra qué método usará tu navegador antes de exportar.

**Probado** (`npm run test:export`): Chromium 153 sin interfaz, en Linux. El video de prueba a 1080×1920 salió como MP4 válido con H.264 High, 450 fotogramas a 30 fps, 15 s, `moov` al inicio y audio Opus (Chromium para Linux no codifica AAC). ffmpeg lo decodifica completo sin errores. En ese servidor sin GPU (WebGL por software) tardó unos 4,5 minutos; en un teléfono con GPU debería ser bastante más rápido, pero no está medido.

**Sin probar todavía en un Android real.** Chrome para Android tiene WebCodecs con H.264 y, normalmente, AAC por hardware, así que debería producir MP4 H.264 + AAC. La primera exportación en tu teléfono es la prueba definitiva; si algo falla, la pantalla de exportación muestra el error.

Limitaciones conocidas:

- Si el audio sale en Opus dentro del MP4, se reproduce en Chrome, Google Fotos y Android 10 o posterior, pero algunas apps antiguas pueden no leer el sonido. Desmarca «Incluir banda sonora» si necesitas máxima compatibilidad.
- Durante la exportación, deja la pantalla encendida y la pestaña abierta: Android pausa las pestañas en segundo plano.
- 1080p tarda más; 720p es la opción rápida.

## Publicación gratuita (GitHub Pages)

El flujo `.github/workflows/studio-pages.yml` compila la app y la publica en GitHub Pages en cada cambio. Solo hay que activarlo una vez, desde el teléfono:

1. En github.com, abre el repositorio → **Settings** → **Pages**.
2. En **Source**, elige **GitHub Actions**.
3. Ve a **Actions** → «Publicar Scientific Motion Studio» → **Run workflow**.
4. La dirección será **https://lolaalvear-ship-it.github.io/Sports-psico/**

GitHub Pages es gratis porque el repositorio es público (en uno privado requiere un plan de pago; la alternativa gratuita sería Cloudflare Pages o Netlify). Por defecto, el entorno `github-pages` solo acepta publicaciones desde la rama predeterminada del repositorio (`claude/brain-obsession-short-video-newwuv`). Si la publicación desde la rama de esta app se rechaza, haz una de estas dos cosas: fusiona el pull request en la rama predeterminada, o ve a **Settings → Environments → github-pages** y añade la rama `claude/scientific-motion-studio-pwa-91v1v8` a las ramas permitidas.

## ¿Hace falta un servidor?

Para esta fase, no. Todo (render, audio, codificación y almacenamiento) ocurre en el teléfono.

En las fases siguientes:

| Función | Servicio | Costo |
|---|---|---|
| Alojamiento de la app | GitHub Pages / Cloudflare Pages | Gratis |
| Guiones con IA | API de Claude (Anthropic) mediante una función sin servidor (Cloudflare Workers, plan gratuito de 100 000 solicitudes/día) para no exponer la clave | Pago por uso de la API: un guion corto consume unos pocos miles de tokens (céntimos de dólar) |
| Voz narrada | ElevenLabs o similar | Plan gratuito limitado; planes de pago desde unos 5 USD/mes |
| Render en la nube (videos largos o 4K) | Remotion Lambda o un servidor con Chromium + ffmpeg | De pago; solo si el teléfono no basta |

## Arquitectura

```
src/
  engine/
    engine.ts        Motor: compone WebGL + Canvas 2D, transiciones, fundidos. render(t) es determinista.
    scenes/          Un archivo por tipo de escena + registro (index.ts)
    overlay.ts       Títulos, textos, etiquetas con línea guía, leyendas, aviso conceptual, grano
    audio.ts         Banda sonora con OfflineAudioContext
    styles.ts        Estilos visuales
  export/exporter.ts WebCodecs (mediabunny) → MP4/WebM; MediaRecorder como alternativa
  generator/         Composición por plantillas + video de prueba
  storage/           Proyectos (localStorage) y modelos GLB (IndexedDB)
  ui/                Interfaz React
```

**Decisión técnica:** las escenas usan Three.js directamente en lugar de React Three Fiber. Para exportar, cada fotograma debe dibujarse en un instante exacto (`render(t)`) y componerse con la capa 2D en un solo lienzo. El bucle de React Three Fiber está pensado para tiempo real y añadiría una capa sin aportar nada aquí. React se usa para toda la interfaz.

**Añadir un tipo de escena:** crea `src/engine/scenes/mi-escena.ts` con una función `SceneBuilder` (devuelve `scene`, `camera`, `update(lt)`, `labels()`), regístrala en `scenes/index.ts` y añade su tipo en `types.ts`.

**Modelos anatómicos GLB/GLTF:** Biblioteca → Importar modelo. El archivo se guarda en el navegador, se centra y se escala solo, y se puede ver con sus materiales o como holograma. Fuentes con licencia abierta: BodyParts3D (CC BY-SA), NIH 3D, Sketchfab (filtra por licencia CC).

## Rigor científico

- Las escenas marcadas como conceptuales muestran el aviso «Representación conceptual». Los brillos, partículas y colores son recursos didácticos, no imágenes reales.
- Las proporciones están exageradas para que se vean (por ejemplo, la hendidura sináptica real mide unos 20 nm).
- En las moléculas se omiten los hidrógenos, y la leyenda lo indica.
- Los textos generados automáticamente son un borrador: revísalos y añade tus fuentes antes de publicar.

Fuentes del video de prueba: Fisher, Aron y Brown (2005), *J Neurophysiol* 94:327–337 (activación del área tegmental ventral y del núcleo caudado en amor romántico temprano); Bartels y Zeki (2000), *NeuroReport* 11:3829–3834; Young y Wang (2004), *Nat Neurosci* 7:1048–1054 (oxitocina y vasopresina en el vínculo de pareja, sobre todo en roedores).

## Desarrollo

```bash
npm install
npm run dev            # servidor local
npm run build          # compila a dist/
npm run test:export    # exporta el video de prueba en Chromium y lo verifica con ffprobe
```
