#!/usr/bin/env python3
"""Monta un Short de 14 s a partir de clips generados con IA de video.

La IA solo pone la imagen. Este script añade todo el texto, para que salga bien escrito:
etiquetas con línea guía, palabra clave final, marca de agua y cierre oscurecido con el usuario.

1. Recorta cada clip, lo encuadra en 1080×1920 y los une con fundidos cortos.
2. Si los clips no llegan a la duración total, congela el último fotograma.
3. Dibuja las capas de texto en PNG (Pillow) y las superpone con aparición y desaparición suaves.
4. Añade la música (opcional) con fundido de salida, o una pista muda.

Uso: python3 ia/montar.py ia/proyectos/cafeina/proyecto.json [--out salida.mp4] [--preview 2,6,12]
"""
import argparse, json, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
AQUI = Path(__file__).resolve().parent
FUENTES = {
    "texto": [AQUI / "fuentes/Inter-SemiBold.otf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"],
    "titulo": [AQUI / "fuentes/InterDisplay-Bold.otf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"],
}
FADE = 0.35


def fuente(tipo, tam):
    for p in FUENTES[tipo]:
        if Path(p).exists():
            return ImageFont.truetype(str(p), tam)
    return ImageFont.load_default(tam)


def lienzo():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))


def px(p):
    return int(p[0] * W), int(p[1] * H)


def sombra(img, radio=10, alfa=150):
    """Sombra suave bajo el texto para que se lea sobre cualquier fondo."""
    a = img.split()[3].filter(ImageFilter.GaussianBlur(radio)).point(lambda v: min(255, v * alfa // 255))
    s = Image.new("RGBA", img.size, (0, 0, 0, 255))
    s.putalpha(a)
    return Image.alpha_composite(s, img)


def etiqueta(e):
    """Píldora oscura translúcida con texto blanco y, si hay `punto`, una línea fina hacia la estructura."""
    img = lienzo()
    d = ImageDraw.Draw(img)
    f = fuente("texto", e.get("tam", 38))
    lineas = e["texto"].split("\n")
    alto_l = f.size * 1.25
    ancho = max(d.textlength(l, font=f) for l in lineas)
    pad_x, pad_y = 26, 16
    cx, cy = px(e["pos"])
    caja = (cx - ancho / 2 - pad_x, cy - alto_l * len(lineas) / 2 - pad_y,
            cx + ancho / 2 + pad_x, cy + alto_l * len(lineas) / 2 + pad_y)
    if "punto" in e:
        x, y = px(e["punto"])
        bx = min(max(x, caja[0]), caja[2])
        by = caja[3] if y > caja[3] else caja[1] if y < caja[1] else y
        d.line([(bx, by), (x, y)], fill=(255, 255, 255, 220), width=3)
        d.ellipse((x - 7, y - 7, x + 7, y + 7), fill=(255, 255, 255, 240))
    d.rounded_rectangle(caja, radius=14, fill=(20, 20, 24, 165), outline=(255, 255, 255, 70), width=2)
    for i, l in enumerate(lineas):
        d.text((cx, caja[1] + pad_y + alto_l * (i + 0.5)), l, font=f, fill="white", anchor="mm")
    return img


def palabra_clave(k):
    img = lienzo()
    d = ImageDraw.Draw(img)
    tam = k.get("tam", 84)
    f = fuente("titulo", tam)
    while d.textlength(k["texto"], font=f) > W * 0.9 and tam > 40:
        tam -= 4
        f = fuente("titulo", tam)
    d.text(px(k.get("pos", [0.5, 0.83])), k["texto"], font=f, fill="white", anchor="mm")
    return sombra(img, 14, 200)


def icono_camara(d, cx, cy, lado, color, grosor):
    """Glifo genérico de cámara: cuadrado redondeado, lente y punto."""
    r = lado / 2
    d.rounded_rectangle((cx - r, cy - r, cx + r, cy + r), radius=lado * 0.28, outline=color, width=grosor)
    rl = lado * 0.23
    d.ellipse((cx - rl, cy - rl, cx + rl, cy + rl), outline=color, width=grosor)
    rp = lado * 0.055
    px_, py_ = cx + lado * 0.26, cy - lado * 0.26
    d.ellipse((px_ - rp, py_ - rp, px_ + rp, py_ + rp), fill=color)


def degradado(mascara):
    """Colorea una máscara con un degradado diagonal violeta → rosa → naranja."""
    w, h = mascara.size
    g = Image.new("RGBA", (w, h))
    paradas = [(0.0, (131, 58, 220)), (0.5, (225, 48, 108)), (1.0, (252, 175, 69))]
    pix = g.load()
    for y in range(h):
        for x in range(w):
            t = min(1.0, max(0.0, (x / w * 0.5 + (1 - y / h) * 0.5)))
            for (t0, c0), (t1, c1) in zip(paradas, paradas[1:]):
                if t <= t1:
                    u = (t - t0) / (t1 - t0)
                    pix[x, y] = tuple(int(a + (b - a) * u) for a, b in zip(c0, c1)) + (255,)
                    break
    g.putalpha(mascara)
    return g


def marca_agua(usuario, conf):
    img = lienzo()
    d = ImageDraw.Draw(img)
    x, y = px(conf.get("pos", [0.895, 0.27]))
    if conf.get("icono", True):
        icono_camara(d, x, y - 40, 50, (255, 255, 255, 230), 5)
    f = fuente("texto", 26)
    d.text((x, y + 12), usuario.upper(), font=f, fill=(255, 255, 255, 230), anchor="mm")
    return sombra(img, 6, 160)


def cierre(usuario, conf):
    img = lienzo()
    cx, cy = W // 2, int(H * 0.47)
    if conf.get("icono", True):
        lado = 150
        m = Image.new("L", (lado + 20, lado + 20), 0)
        icono_camara(ImageDraw.Draw(m), (lado + 20) / 2, (lado + 20) / 2, lado, 255, 14)
        img.alpha_composite(degradado(m), (cx - (lado + 20) // 2, cy - (lado + 20) // 2))
    d = ImageDraw.Draw(img)
    d.text((cx, cy + 175), usuario.upper(), font=fuente("texto", 50), fill="white", anchor="mm")
    if conf.get("texto"):
        d.text((cx, cy + 250), conf["texto"], font=fuente("texto", 34), fill=(255, 255, 255, 200), anchor="mm")
    return sombra(img, 10, 170)


def oscuro(alfa):
    return Image.new("RGBA", (W, H), (0, 0, 0, int(255 * alfa)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("proyecto")
    ap.add_argument("--out")
    ap.add_argument("--preview", help="solo exporta fotogramas PNG en estos segundos, p. ej. 2,6,12")
    a = ap.parse_args()

    ruta = Path(a.proyecto).resolve()
    base = ruta.parent
    p = json.loads(ruta.read_text(encoding="utf-8"))
    total = float(p.get("duracion", 14.0))
    c = p.get("cierre", {})
    t_cierre = total - float(c.get("duracion", 4.0))
    usuario = p["usuario"]
    xf = float(p.get("fundido", 0.4))
    out = Path(a.out).resolve() if a.out else base / p.get("salida", "short.mp4")

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        args, filtros = [], []

        # 1. Clips → [v]
        clips = p["clips"]
        for i, cl in enumerate(clips):
            args += ["-i", str(base / cl["archivo"])]
            ini = float(cl.get("desde", 0))
            dur = f":duration={cl['duracion']}" if "duracion" in cl else ""
            filtros.append(f"[{i}:v]trim=start={ini}{dur},setpts=PTS-STARTPTS,"
                           f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
                           f"fps={FPS},setsar=1,format=yuv420p[c{i}]")
        durs = []
        for cl in clips:
            if "duracion" in cl:
                durs.append(float(cl["duracion"]))
            else:
                r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                                    str(base / cl["archivo"])], capture_output=True, text=True, check=True)
                durs.append(float(r.stdout) - float(cl.get("desde", 0)))
        prev, acum = "c0", durs[0]
        for i in range(1, len(clips)):
            if xf > 0:
                filtros.append(f"[{prev}][c{i}]xfade=transition=fade:duration={xf}:offset={acum - xf:.3f}[x{i}]")
                acum += durs[i] - xf
            else:
                filtros.append(f"[{prev}][c{i}]concat=n=2:v=1:a=0[x{i}]")
                acum += durs[i]
            prev = f"x{i}"
        relleno = max(0.0, total - acum) + 0.5
        filtros.append(f"[{prev}]tpad=stop_mode=clone:stop_duration={relleno:.3f},trim=duration={total},setpts=PTS-STARTPTS[v]")

        # 2. Capas de texto: (imagen, inicio, fin, fundido de entrada)
        capas = []
        for e in p.get("etiquetas", []):
            capas.append((etiqueta(e), e["desde"], e.get("hasta", total), FADE))
        if p.get("palabra_clave"):
            k = p["palabra_clave"]
            capas.append((palabra_clave(k), k["desde"], k.get("hasta", total), 0.5))
        if p.get("marca_agua", {}).get("activa", True):
            capas.append((marca_agua(usuario, p.get("marca_agua", {})), 0, t_cierre, FADE))
        capas.append((oscuro(c.get("oscuridad", 0.68)), t_cierre, total, 0.8))
        capas.append((cierre(usuario, c), t_cierre + 0.3, total, 0.6))

        cur = "v"
        n0 = len(clips)
        for j, (img, t0, t1, fin) in enumerate(capas):
            png = tmp / f"capa{j}.png"
            img.save(png)
            args += ["-loop", "1", "-framerate", str(FPS), "-t", str(total), "-i", str(png)]
            fx = f"fade=in:st={t0}:d={fin}:alpha=1"
            if t1 < total:
                fx += f",fade=out:st={t1 - FADE}:d={FADE}:alpha=1"
            filtros.append(f"[{n0 + j}:v]format=rgba,{fx}[o{j}]")
            filtros.append(f"[{cur}][o{j}]overlay=0:0:format=auto[v{j}]")
            cur = f"v{j}"
        filtros.append(f"[{cur}]format=yuv420p[vout]")

        if a.preview:
            seg = tmp / "prev.mp4"
            subprocess.run(["ffmpeg", "-v", "error", "-y", *args, "-filter_complex", ";".join(filtros),
                            "-map", "[vout]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", str(seg)], check=True)
            dst = base / "preview"
            dst.mkdir(exist_ok=True)
            for s in a.preview.split(","):
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", s, "-i", str(seg), "-frames:v", "1",
                                str(dst / f"t{float(s):05.2f}.png")], check=True)
            print(f"Fotogramas en {dst}")
            return

        # 3. Audio
        m = p.get("musica")
        na = n0 + len(capas)
        if m:
            args += ["-i", str(base / m["archivo"])]
            vol = m.get("volumen", 0.8)
            filtros.append(f"[{na}:a]atrim=start={m.get('desde', 0)}:duration={total},asetpts=PTS-STARTPTS,"
                           f"volume={vol},afade=in:d=0.3,afade=out:st={total - 1.5}:d=1.5,"
                           f"aformat=sample_rates=48000:channel_layouts=stereo[aout]")
        else:
            args += ["-f", "lavfi", "-t", str(total), "-i", "anullsrc=r=48000:cl=stereo"]
            filtros.append(f"[{na}:a]anull[aout]")

        out.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", *args, "-filter_complex", ";".join(filtros),
                        "-map", "[vout]", "-map", "[aout]", "-t", str(total),
                        "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out)], check=True)
        print(f"Listo: {out}")


if __name__ == "__main__":
    main()
