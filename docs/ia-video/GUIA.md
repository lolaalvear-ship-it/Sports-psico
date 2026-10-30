# Shorts de 14 s con IA de video: guía de estilo y prompts

Formato que se busca: animación médica 3D hiperrealista, vertical y de 14 s. La cámara viaja del órgano a las moléculas y vuelve. Tiene etiquetas limpias y termina con un cierre oscuro con el usuario de Instagram.

**La IA solo genera la imagen. Todo el texto se añade después con `video/ia/montar.py`.** Los generadores de video escriben mal el texto: en los ejemplos de referencia aparecen frases inventadas como «Bloclicatitcs anticholinolinergive…». Por eso todos los prompts piden *no text*.

---

## 1. Estructura de los 14 s

| Tramo | Duración | Qué se ve | Texto (lo pone `montar.py`) |
|---|---|---|---|
| **A · Órgano** | 0–3,5 s | Plano general del órgano o tejido. La cámara avanza hacia dentro. | Nombre de la estructura o del problema |
| **B · Mecanismo** | 3,5–7,5 s | Primer plano molecular: un receptor en la membrana y una molécula que llega y se une. | Molécula y receptor, con línea guía |
| **C · Consecuencia** | 7,5–10 s | El efecto: una vía que se abre o se cierra, un tejido que cambia, un brillo o un flujo. | Efecto (↑/↓) y **PALABRA CLAVE** grande |
| **Cierre** | 10–14 s | La imagen se congela y se oscurece. Aparece el icono con el usuario. | `@tu_usuario` |

Hay dos maneras de generar el material:
- **Un clip de 10 s** que recorra A → B → C en un solo plano continuo. Es lo más parecido a los ejemplos, pero cuesta más que salga bien.
- **Tres clips de 4–5 s**, uno por tramo. `montar.py` los une con fundidos de 0,4 s. Es más fácil de controlar y, si un plano falla, solo hay que repetir ese.

## 2. Bloque de estilo (pegar siempre)

En inglés, porque Veo, Kling, Sora, Hailuo y Runway lo siguen mejor:

```
Hyperrealistic 3D medical animation, cinematic macro photography style, vertical 9:16.
Glossy, wet, translucent organic tissue in soft coral-pink and salmon tones, subsurface scattering,
candy-like saturated molecules (teal, golden yellow, violet, soft orange), shallow depth of field,
bokeh of floating particles and red blood cells in the background, soft volumetric rim light,
warm ambient glow, slow smooth continuous camera movement, no cuts.
No text, no letters, no labels, no numbers, no watermark, no logos, no UI.
```

**Negative prompt** (si la herramienta lo admite):
```
text, letters, words, captions, subtitles, watermark, logo, signature, cartoon, flat 2D, low poly,
blurry, distorted anatomy, gore, realistic blood splatter, human face, hands, fast camera, shaky camera
```

## 3. Plantillas por tramo

Cambia lo que va entre `<…>` y añade el bloque de estilo al final.

**A · Órgano**
```
Slow dolly-in towards a <órgano, p. ej. human brain / lung / liver>, highly detailed anatomical
surface, the camera gradually dives into <la zona, p. ej. the synaptic cleft between two neurons>,
<partículas o células> drifting around.
```

**B · Mecanismo (receptor y ligando)**
```
Extreme close-up of a cell membrane shown as a lipid bilayer of glossy white spheres,
a <color> transmembrane receptor protein embedded in it. <Color> <molécula> molecules float in
and one docks precisely into the receptor's binding pocket; the receptor subtly changes shape.
Camera slowly orbits.
```

**C · Consecuencia**
```
The <estructura> <efecto visible: e.g. glows brighter and fires electrical pulses / dilates and
opens wide / stiffens with white fibrous strands>, particles stream through, camera slowly pulls back
to reveal the whole <órgano>.
```

**Consejos que más ayudan**
- **Primero imagen, luego video.** Genera el fotograma inicial con un generador de imágenes y el mismo bloque de estilo, y anímalo con *image-to-video*. Así se mantienen los colores y la forma entre clips.
- **Una acción por clip.** Si pides que entre, se una, cambie de forma y se abra en 4 s, la IA mezcla todo.
- Pide **«slow»** en cada movimiento. La cámara rápida desenfoca la textura.
- **Usa el último fotograma de un clip como primera imagen del siguiente.** El fundido queda casi invisible.
- Genera 3 o 4 variantes por tramo y quédate con la que tenga la anatomía más limpia.

## 4. Montaje

1. Crea una carpeta en `video/ia/proyectos/<tema>/` con `clips/` y un `proyecto.json`. Copia el de `cafeina/` como modelo.
2. Ajusta en el JSON:
   - `usuario`: tu @ de Instagram.
   - `clips`: archivo, `desde` (segundo de inicio dentro del clip) y `duracion`.
   - `etiquetas`: `texto` (admite `\n`, `↑`, `↓`, `²⁺`, `β₂`), `desde` y `hasta` en segundos, `pos` (centro de la píldora) y `punto` (opcional, adonde apunta la línea). Las coordenadas van de 0 a 1: `[0.5, 0.5]` es el centro de la pantalla.
   - `palabra_clave`: el texto grande del final.
   - `musica`: `{ "archivo": "musica.mp3", "volumen": 0.7, "desde": 0 }`, o `null` para una pista muda.
3. Comprueba la posición de las etiquetas sin esperar al render completo:
   ```bash
   cd video
   python3 ia/montar.py ia/proyectos/cafeina/proyecto.json --preview 2,6,9,12
   ```
   Los fotogramas se guardan en `ia/proyectos/cafeina/preview/`. Mueve `pos` y `punto` hasta que la línea toque la estructura correcta.
4. Render final, en 1080×1920, 30 fps, H.264 y `+faststart`:
   ```bash
   python3 ia/montar.py ia/proyectos/cafeina/proyecto.json
   ```

Los clips pueden venir en cualquier tamaño o proporción: se encuadran a 9:16 recortando por el centro. Si entre todos no llegan a 14 s, se congela el último fotograma bajo el cierre, igual que en los ejemplos.

## 5. Proyecto de ejemplo: cafeína

Ya configurado en `video/ia/proyectos/cafeina/proyecto.json`. Solo falta poner los tres clips en `clips/`.

**Idea:** durante el día se acumula adenosina, que al unirse a sus receptores frena las neuronas y da sueño. La cafeína tiene una forma parecida: ocupa el receptor sin activarlo, y la adenosina no puede actuar.

| Archivo | Prompt (+ bloque de estilo) |
|---|---|
| `clips/1_cerebro.mp4` | Slow dolly-in towards a glowing human brain, the camera dives between branching neurons with soft pink glowing synapses; small pale blue molecules slowly accumulate around the synapses. |
| `clips/2_adenosina.mp4` | Extreme close-up of a neuron membrane as a lipid bilayer of glossy white spheres with a violet receptor protein; pale blue molecules float in and dock into the receptor; the neuron's glow slowly dims. Camera slowly orbits. |
| `clips/3_cafeina.mp4` | Same membrane and violet receptor; bright golden molecules arrive and occupy the receptor pocket, pale blue molecules bounce off unable to bind; the neuron lights up with bright electrical pulses travelling along its branches. Camera slowly pulls back. |

Etiquetas del ejemplo: «Adenosina ↑», «Receptor A1», «Actividad neuronal ↓», «Cafeína», «Receptor bloqueado» y la palabra clave **ALERTA**.

## 6. Ideas de temas (psicología, cerebro y deporte)

- **Dopamina y recompensa:** la vesícula libera dopamina hacia el receptor D2. Palabra clave: «MOTIVACIÓN».
- **Cortisol antes de competir:** la glándula suprarrenal libera cortisol hacia el receptor del hipocampo. Palabra clave: «ESTRÉS».
- **Endorfinas al correr:** las endorfinas se unen al receptor opioide μ. Palabra clave: «EUFORIA DEL CORREDOR».
- **Ácido láctico y fatiga:** la fibra muscular acumula H⁺, que inhibe la contracción. Palabra clave: «FATIGA».
- **Memoria muscular:** la mielina engrosa el axón y el impulso viaja más rápido. Palabra clave: «AUTOMATIZACIÓN».
- **Sueño y recuperación:** el sistema glinfático limpia el cerebro durante el sueño. Palabra clave: «RECUPERACIÓN».

Antes de publicar, contrasta cada mecanismo con una fuente, como en `docs/*/INVESTIGACION.md`. La IA dibuja lo que le pides, aunque sea incorrecto.
