#!/usr/bin/env python3
"""Sincroniza escenas y subtítulos con la narración (MP3) sin modelos de reconocimiento de voz.

Como el texto exacto de la narración es conocido (narracion.txt, un párrafo por línea), basta con:
  1. detectar los silencios del audio con ffmpeg (silencedetect);
  2. asignar cada fin de párrafo a la pausa que mejor encaja (programación dinámica);
  3. dentro de cada párrafo, repartir las palabras por el tiempo hablado según su longitud,
     respetando las pausas internas (comas, puntos suspensivos).
Escribe src/timeline.json con escenas re-temporizadas, marcas de palabras clave y subtítulos.

Uso:  python3 tools/sync.py voz.mp3 [--config projects/x.json] [--noise -35] [--min-sil 0.18]
      Sin --config usa el proyecto del primer Short (narracion.txt -> src/timeline.json).
"""
import json, re, subprocess, sys, unicodedata, argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# escena -> frase del texto donde empieza (se busca en orden)
ANCHORS = [
    ("phone", None), ("window", "Alguien"), ("scan", "En 2010"), ("memories", "quince"),
    ("vta", "Al ver"), ("pathway", "y el estriado"), ("neurons", "La dopamina"), ("synapse", "en monos"),
    ("cards", "En un estudio"), ("thoughts", "porque pensaban"), ("bear", "Y tratar"),
    ("rebound", "el pensamiento suprimido"), ("pain", "Además"), ("dawn", "No es debilidad"),
    ("release", "Y entenderlo"),
]
# marcas: (escena, clave, palabra) -> tiempo local de esa palabra dentro de la escena
MARKS = [("phone", "duda", "duda"), ("window", "aun", "aun"), ("neurons", "tambien", "también"),
         ("rebound", "volvia", "volvía"), ("dawn", "cerebro", "Es un cerebro"),
         ("pathway", "deseo", "deseo"), ("pathway", "adiccion", "adicción"),
         ("release", "l1", "Y entenderlo"), ("release", "l2", "el primer paso"), ("release", "l3", "para soltar")]
LEAD = 0.2   # la imagen entra un poco antes que la palabra
TAIL = 1.0   # cola tras la última palabra


def norm(w):
    w = unicodedata.normalize("NFD", w.lower())
    return re.sub(r"[^a-z0-9ñ]", "", "".join(ch for ch in w if unicodedata.category(ch) != "Mn"))


def duration(audio):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", audio],
                         capture_output=True, text=True).stdout
    return float(out.strip())


def silences(audio, noise, min_sil):
    log = subprocess.run(["ffmpeg", "-i", audio, "-af", f"silencedetect=noise={noise}dB:d={min_sil}", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
    en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    return list(zip(st, en + [duration(audio)] * (len(st) - len(en))))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("--noise", type=float, default=-35)
    ap.add_argument("--min-sil", type=float, default=0.18)
    ap.add_argument("--config", help="JSON con text, out, anchors y marks de otro proyecto")
    a = ap.parse_args()
    text_path, out_path, anchors, marks = ROOT / "narracion.txt", ROOT / "src" / "timeline.json", ANCHORS, MARKS
    if a.config:
        cfg = json.loads(Path(a.config).read_text(encoding="utf-8"))
        text_path, out_path = ROOT / cfg["text"], ROOT / cfg["out"]
        anchors, marks = [tuple(x) for x in cfg["anchors"]], [tuple(x) for x in cfg.get("marks", [])]

    dur = duration(a.audio)
    sil = silences(a.audio, a.noise, a.min_sil)
    speech_start = sil[0][1] if sil and sil[0][0] < 0.05 else 0.0
    speech_end = sil[-1][0] if sil and sil[-1][1] >= dur - 0.05 else dur
    gaps = [(s, e) for s, e in sil if s > speech_start + 0.05 and e < speech_end - 0.05]

    paras = [p.strip() for p in text_path.read_text(encoding="utf-8").splitlines() if p.strip()]
    words = []  # (texto, párrafo)
    for pi, p in enumerate(paras):
        words += [(w, pi) for w in p.split()]
    SPOKEN = {"2010": "dosmildiez", "2011": "dosmilonce", "1994": "milnovecientosnoventaycuatro", "11s": "onceese"}  # los números se pronuncian más largos
    weight = lambda w: len(SPOKEN.get(norm(w), norm(w))) + 1.5
    pw = [sum(weight(w) for w, pi in words if pi == k) for k in range(len(paras))]
    total = sum(pw)

    # tiempo hablado acumulado -> tiempo real
    def speech_intervals(t0, t1):
        iv, cur = [], t0
        for s, e in gaps:
            if e <= t0 or s >= t1:
                continue
            if s > cur:
                iv.append((cur, s))
            cur = max(cur, e)
        if cur < t1:
            iv.append((cur, t1))
        return iv

    # 1) fronteras de párrafo: elegir pausas (DP) cercanas a la posición esperada
    allsp = speech_intervals(speech_start, speech_end)
    sp_total = sum(e - s for s, e in allsp)

    def sp_to_real(x):
        for s, e in allsp:
            if x <= e - s:
                return s + x
            x -= e - s
        return speech_end

    expected, acc = [], 0
    for k in range(len(paras) - 1):
        acc += pw[k]
        expected.append(sp_to_real(sp_total * acc / total))
    K, G = len(expected), len(gaps)
    if G < K:
        sys.exit(f"Solo detecté {G} pausas y necesito {K}. Prueba --noise -30 o --min-sil 0.12, "
                 "o deja una pausa breve entre párrafos al generar la voz.")
    INF = float("inf")
    cost = [[INF] * G for _ in range(K)]
    back = [[-1] * G for _ in range(K)]
    for g in range(G):
        mid = (gaps[g][0] + gaps[g][1]) / 2
        cost[0][g] = (mid - expected[0]) ** 2 - 0.5 * (gaps[g][1] - gaps[g][0])
    for k in range(1, K):
        for g in range(k, G):
            mid = (gaps[g][0] + gaps[g][1]) / 2
            here = (mid - expected[k]) ** 2 - 0.5 * (gaps[g][1] - gaps[g][0])
            best = min(range(k - 1, g), key=lambda h: cost[k - 1][h])
            cost[k][g] = cost[k - 1][best] + here
            back[k][g] = best
    g = min(range(K - 1, G), key=lambda h: cost[K - 1][h])
    chosen = [0] * K
    for k in range(K - 1, -1, -1):
        chosen[k] = g
        g = back[k][g]
    ends = [gaps[c][0] for c in chosen]
    starts = [gaps[c][1] for c in chosen]

    # 2) palabras dentro de cada párrafo
    timed = []
    for k, p in enumerate(paras):
        t0 = speech_start if k == 0 else starts[k - 1]
        t1 = speech_end if k == len(paras) - 1 else ends[k]
        iv = speech_intervals(t0, t1)
        tot = sum(e - s for s, e in iv)
        ws = [w for w, pi in words if pi == k]
        wt = [weight(w) for w in ws]
        S = sum(wt)
        # cada pausa interna se asigna (en orden) al corte entre palabras que mejor encaja,
        # preferentemente tras una palabra con puntuación
        cum = [sum(wt[:j + 1]) / S for j in range(len(ws) - 1)]
        gfrac, acc_t = [], 0
        for s, e in iv[:-1]:
            acc_t += e - s
            gfrac.append(acc_t / tot)
        NG, NB = len(gfrac), len(cum)
        cuts = []
        if NG and NG <= NB:
            pen = [0 if re.search(r"[,.:;?!…»]$", ws[j]) else 0.01 for j in range(NB)]
            C = [[INF] * NB for _ in range(NG)]
            Bk = [[-1] * NB for _ in range(NG)]
            for j in range(NB):
                C[0][j] = (cum[j] - gfrac[0]) ** 2 + pen[j]
            for q in range(1, NG):
                for j in range(q, NB):
                    h = min(range(q - 1, j), key=lambda x: C[q - 1][x])
                    C[q][j] = C[q - 1][h] + (cum[j] - gfrac[q]) ** 2 + pen[j]
                    Bk[q][j] = h
            j = min(range(NG - 1, NB), key=lambda x: C[NG - 1][x])
            cuts = [0] * NG
            for q in range(NG - 1, -1, -1):
                cuts[q] = j
                j = Bk[q][j]
        else:
            iv = [(iv[0][0], iv[-1][1])] if NG else iv
        groups, prev = [], 0
        for cj in cuts + [len(ws) - 1]:
            groups.append(range(prev, cj + 1))
            prev = cj + 1
        for (s0, e0), grp in zip(iv, groups):
            gs = sum(wt[j] for j in grp)
            acc = 0
            for j in grp:
                s = s0 + (e0 - s0) * acc / gs
                acc += wt[j]
                e = s0 + (e0 - s0) * acc / gs
                timed.append({"w": ws[j], "s": round(s, 3), "e": round(e, 3), "p": k})

    # 3) escenas
    flat = [norm(t["w"]) for t in timed]

    def find(phrase, frm=0):
        toks = [norm(x) for x in phrase.split()]
        for i in range(frm, len(flat) - len(toks) + 1):
            if flat[i:i + len(toks)] == toks:
                return i
        sys.exit(f"No encontré «{phrase}» en {text_path.name}")

    scenes, idx = [], 0
    for sid, phrase in anchors:
        if phrase is None:
            scenes.append({"id": sid, "start": 0.0})
            continue
        idx = find(phrase, idx)
        scenes.append({"id": sid, "start": round(max(0.0, timed[idx]["s"] - LEAD), 3)})
    final = round(speech_end + TAIL, 3)
    for i, sc in enumerate(scenes):
        sc["end"] = scenes[i + 1]["start"] if i + 1 < len(scenes) else final
    byid = {s["id"]: s for s in scenes}
    for sid, key, phrase in marks:
        sc = byid[sid]
        start_idx = find(phrase, 0)
        byid[sid].setdefault("marks", {})[key] = round(timed[start_idx]["s"] - sc["start"], 3)

    # 4) subtítulos: bloques de hasta 3 palabras, cortando en la puntuación
    caps, cur = [], []
    for i, t in enumerate(timed):
        cur.append(t)
        last = i == len(timed) - 1
        punct = re.search(r"[,.:;?!…»]$", t["w"])
        nxt_new_para = not last and timed[i + 1]["p"] != t["p"]
        if last or punct or nxt_new_para or len(cur) >= 3:
            caps.append({"start": cur[0]["s"], "end": round(cur[-1]["e"] + 0.12, 3),
                         "words": [{"w": x["w"], "s": x["s"], "e": x["e"]} for x in cur]})
            cur = []
    for i in range(len(caps) - 1):
        caps[i]["end"] = min(caps[i]["end"], caps[i + 1]["start"])

    prev = out_path
    show = json.loads(prev.read_text(encoding="utf-8")).get("showCaptions", True) if prev.exists() else True
    tl = {"duration": final, "audio": Path(a.audio).name, "showCaptions": show, "scenes": scenes, "captions": caps}
    out_path.write_text(json.dumps(tl, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Audio {dur:.2f}s · habla {speech_start:.2f}–{speech_end:.2f}s · {len(gaps)} pausas · video {final:.2f}s")
    for sc in scenes:
        print(f"  {sc['id']:<9} {sc['start']:6.2f} → {sc['end']:6.2f}  ({sc['end'] - sc['start']:.2f}s)", sc.get("marks", ""))


if __name__ == "__main__":
    main()
