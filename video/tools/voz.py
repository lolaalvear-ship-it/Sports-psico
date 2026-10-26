#!/usr/bin/env python3
"""Genera la narración de un reel con ElevenLabs y la deja lista para sincronizar.

  python3 tools/voz.py <slug>            -> muestra el texto que se enviará y cuántos caracteres cuesta (no gasta nada)
  python3 tools/voz.py <slug> --si       -> genera reels/<slug>/audio/voz.mp3 (gasta créditos de ElevenLabs)
  python3 tools/voz.py --voces           -> lista las voces de tu cuenta (para elegir voice_id en marca.json)

Lee el texto de reels/<slug>/narracion.txt (un párrafo por línea) y la voz de video/marca.json:
  "voz": {"voice_id": "...", "modelo": "eleven_multilingual_v2", "estabilidad": 0.45, "similitud": 0.8, "estilo": 0.2, "velocidad": 1.0}
  "pronunciacion": {"TDAH": "te de a hache", "VO2max": "ve o dos máx"}
La pronunciación solo cambia lo que se envía a ElevenLabs: los subtítulos siguen mostrando la sigla escrita.
Entre párrafos se inserta una pausa breve para que tools/sync.py encuentre los cortes de escena.

La clave se lee de la variable ELEVENLABS_API_KEY o del archivo video/.env (ELEVENLABS_API_KEY=...).
"""
import argparse, json, os, re, sys, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = "https://api.elevenlabs.io/v1"


def api_key():
    k = os.environ.get("ELEVENLABS_API_KEY")
    env = ROOT / ".env"
    if not k and env.exists():
        for ln in env.read_text(encoding="utf-8").splitlines():
            if ln.strip().startswith("ELEVENLABS_API_KEY="):
                k = ln.split("=", 1)[1].strip().strip('"\'')
    if not k:
        sys.exit("Falta ELEVENLABS_API_KEY (en el entorno o en video/.env).")
    return k


def call(path, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None,
                                 headers={"xi-api-key": api_key(), "Content-Type": "application/json"},
                                 method="POST" if body else "GET")
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        sys.exit(f"ElevenLabs respondió {e.code}: {e.read().decode(errors='replace')[:400]}")


def prepare(paras, pron):
    out = []
    for p in paras:
        for k, v in sorted(pron.items(), key=lambda kv: -len(kv[0])):
            p = re.sub(rf"(?<!\w){re.escape(k)}(?!\w)", v, p)
        out.append(p)
    return ' <break time="0.4s" /> '.join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", nargs="?")
    ap.add_argument("--si", action="store_true", help="generar de verdad (gasta créditos)")
    ap.add_argument("--voces", action="store_true")
    a = ap.parse_args()

    if a.voces:
        for v in json.loads(call("/voices"))["voices"]:
            lab = v.get("labels") or {}
            print(f'{v["voice_id"]}  {v["name"]:<24} {lab.get("gender", "")} {lab.get("accent", "")} {lab.get("age", "")}')
        return
    if not a.slug:
        ap.error("indica el slug del reel")
    base = ROOT / "reels" / a.slug
    marca = json.loads((ROOT / "marca.json").read_text(encoding="utf-8"))
    voz = marca.get("voz", {})
    paras = [p.strip() for p in (base / "narracion.txt").read_text(encoding="utf-8").splitlines() if p.strip()]
    text = prepare(paras, marca.get("pronunciacion", {}))
    chars = len(re.sub(r"<break[^>]*>", "", text))
    print(text, "\n")
    print(f"{len(paras)} párrafos · {len(' '.join(paras).split())} palabras · {chars} caracteres (≈ {chars} créditos)")
    if not a.si:
        print("Vista previa: no se ha generado nada. Añade --si para generar la voz.")
        return
    if not voz.get("voice_id"):
        sys.exit('Falta "voz.voice_id" en video/marca.json (usa --voces para ver las tuyas).')
    body = {
        "text": text,
        "model_id": voz.get("modelo", "eleven_multilingual_v2"),
        "voice_settings": {
            "stability": voz.get("estabilidad", 0.45), "similarity_boost": voz.get("similitud", 0.8),
            "style": voz.get("estilo", 0.2), "use_speaker_boost": True, "speed": voz.get("velocidad", 1.0),
        },
    }
    audio = call(f'/text-to-speech/{voz["voice_id"]}?output_format=mp3_44100_128', body)
    (base / "audio").mkdir(parents=True, exist_ok=True)
    dst = base / "audio" / "voz.mp3"
    dst.write_bytes(audio)
    print("OK ->", dst)


if __name__ == "__main__":
    main()
