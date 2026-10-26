#!/usr/bin/env python3
"""Busca estudios en PubMed (E-utilities de NCBI, gratis y sin clave) y muestra lo necesario para elegir fuentes.

Uso:
  python3 tools/pubmed.py "choking under pressure athletes" [--max 15] [--desde 2010] [--tipo meta|rct|review|todos]
  python3 tools/pubmed.py --pmid 12345678 [23456789 ...]     -> resumen completo (abstract) de esos artículos
  python3 tools/pubmed.py "..." --json                        -> salida en JSON (para guardar en el reel)

Por defecto prioriza metaanálisis, revisiones sistemáticas, ensayos y guías.
Si defines NCBI_API_KEY en el entorno, se usa (sube el límite de peticiones).
"""
import argparse, json, os, re, sys, time, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
TIPOS = {
    "meta": '("meta-analysis"[pt] OR "systematic review"[pt])',
    "rct": '"randomized controlled trial"[pt]',
    "review": '"review"[pt]',
    "evidencia": '("meta-analysis"[pt] OR "systematic review"[pt] OR "randomized controlled trial"[pt] OR "guideline"[pt] OR "practice guideline"[pt])',
    "todos": "",
}


def get(endpoint, **params):
    if os.environ.get("NCBI_API_KEY"):
        params["api_key"] = os.environ["NCBI_API_KEY"]
    params.setdefault("tool", "reels-psico")
    url = BASE + endpoint + "?" + urllib.parse.urlencode(params)
    for i in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return r.read()
        except Exception as e:  # límite de NCBI o red inestable
            if i == 2:
                sys.exit(f"No pude consultar PubMed ({e}). ¿Hay conexión a eutils.ncbi.nlm.nih.gov?")
            time.sleep(1.5 * (i + 1))


def text(el):
    return "".join(el.itertext()).strip() if el is not None else ""


def fetch(pmids):
    root = ET.fromstring(get("efetch.fcgi", db="pubmed", id=",".join(pmids), retmode="xml"))
    res = []
    for art in root.findall(".//PubmedArticle"):
        mc = art.find("MedlineCitation")
        a = mc.find("Article")
        authors = [f'{text(x.find("LastName"))} {text(x.find("Initials"))}'.strip() for x in a.findall(".//Author") if x.find("LastName") is not None]
        year = text(a.find(".//PubDate/Year")) or re.sub(r"\D.*", "", text(a.find(".//PubDate/MedlineDate")))
        abstract = []
        for p in a.findall(".//Abstract/AbstractText"):
            lab = p.get("Label")
            abstract.append((f"{lab}: " if lab else "") + text(p))
        ids = {x.get("IdType"): x.text for x in art.findall(".//ArticleIdList/ArticleId")}
        res.append({
            "pmid": text(mc.find("PMID")),
            "titulo": text(a.find("ArticleTitle")),
            "autores": authors,
            "revista": text(a.find("Journal/ISOAbbreviation")) or text(a.find("Journal/Title")),
            "anio": year,
            "tipos": [text(x) for x in a.findall(".//PublicationType")],
            "doi": ids.get("doi", ""),
            "abstract": "\n".join(abstract),
        })
    return res


def cita(r):
    au = r["autores"]
    who = au[0] + (" et al." if len(au) > 2 else f" & {au[1]}" if len(au) == 2 else "") if au else "s. a."
    return f'{who} ({r["anio"]}). {r["titulo"]} {r["revista"]}. PMID {r["pmid"]}' + (f' · DOI {r["doi"]}' if r["doi"] else "")


def conclusion(abstract):
    m = re.search(r"(CONCLUSIONS?|INTERPRETATION|RESULTS?)\s*:\s*(.+?)(?:\n|$)", abstract, re.I)
    s = m.group(2) if m else abstract.split("\n")[-1] if abstract else ""
    return s[:420] + ("…" if len(s) > 420 else "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("consulta", nargs="?")
    ap.add_argument("--max", type=int, default=12)
    ap.add_argument("--desde", type=int)
    ap.add_argument("--tipo", default="evidencia", choices=TIPOS)
    ap.add_argument("--pmid", nargs="+")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    if a.pmid:
        rs = fetch(a.pmid)
        if a.json:
            print(json.dumps(rs, ensure_ascii=False, indent=1)); return
        for r in rs:
            print(cita(r)); print("Tipo:", ", ".join(r["tipos"])); print(); print(r["abstract"] or "(sin resumen)"); print("\n" + "-" * 80 + "\n")
        return
    if not a.consulta:
        ap.error("indica una consulta o --pmid")
    term = a.consulta
    if TIPOS[a.tipo]:
        term = f"({term}) AND {TIPOS[a.tipo]}"
    if a.desde:
        term += f' AND ("{a.desde}"[dp] : "3000"[dp])'
    ids = json.loads(get("esearch.fcgi", db="pubmed", term=term, retmax=a.max, sort="relevance", retmode="json"))["esearchresult"]
    pmids = ids.get("idlist", [])
    if not pmids:
        print(f"Sin resultados para: {term}\nPrueba términos en inglés, menos palabras o --tipo todos."); return
    rs = fetch(pmids)
    if a.json:
        print(json.dumps(rs, ensure_ascii=False, indent=1)); return
    print(f"{ids['count']} resultados · mostrando {len(rs)} · consulta: {term}\n")
    for i, r in enumerate(rs, 1):
        tipo = next((t for t in r["tipos"] if t in ("Meta-Analysis", "Systematic Review", "Randomized Controlled Trial", "Practice Guideline", "Guideline", "Review")), r["tipos"][0] if r["tipos"] else "")
        print(f"[{i}] {cita(r)}\n    Tipo: {tipo}\n    Conclusión: {conclusion(r['abstract'])}\n")


if __name__ == "__main__":
    main()
