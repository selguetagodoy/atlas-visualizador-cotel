#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
README = ROOT / "README.md"
ROBOTS = ROOT / "robots.txt"
SITEMAP = ROOT / "sitemap.xml"

CANONICAL = "https://atlas-visualizador-cotel.vercel.app/"
ATLAS = "https://selguetagodoy.github.io/atlas-desconexion-digital-chile.html"
VERSION_DOI = "https://doi.org/10.5281/zenodo.22921209"


def main() -> int:
    failures: list[str] = []
    warnings: list[str] = []

    if not INDEX.exists():
        failures.append("index.html missing")
        html = ""
    else:
        html = INDEX.read_text(encoding="utf-8", errors="replace")

    if f'<link rel="canonical" href="{CANONICAL}"' not in html:
        failures.append("canonical URL missing or changed")

    jsonld_blocks = re.findall(
        r'<script type="application/ld\+json">\s*(.*?)\s*</script>',
        html,
        flags=re.S,
    )
    if not jsonld_blocks:
        failures.append("JSON-LD missing")
    else:
        for i, block in enumerate(jsonld_blocks, start=1):
            try:
                payload = json.loads(block)
            except json.JSONDecodeError as exc:
                failures.append(f"JSON-LD block {i} invalid: {exc}")
                continue
            serialized = json.dumps(payload, ensure_ascii=False)
            for required in (ATLAS, VERSION_DOI, "Sebastián Elgueta Godoy"):
                if required not in serialized:
                    failures.append(f"JSON-LD missing required relation: {required}")

    for required in (ATLAS, VERSION_DOI):
        if required not in html:
            failures.append(f"index.html missing canonical research link: {required}")

    refs = re.findall(r'(?:href|src)="([^"]+)"', html)
    for ref in refs:
        parsed = urlparse(ref)
        if parsed.scheme in {"http", "https", "mailto", "data"} or ref.startswith("#"):
            continue
        target = ROOT / ref.split("#", 1)[0].split("?", 1)[0]
        if not target.exists():
            failures.append(f"missing local target: {ref}")

    if not ROBOTS.exists():
        failures.append("robots.txt missing")
    else:
        robots = ROBOTS.read_text(encoding="utf-8", errors="replace")
        if "Sitemap: https://atlas-visualizador-cotel.vercel.app/sitemap.xml" not in robots:
            failures.append("robots.txt canonical sitemap declaration missing")

    if not SITEMAP.exists():
        failures.append("sitemap.xml missing")
    else:
        try:
            tree = ET.parse(SITEMAP)
            root = tree.getroot()
            ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
            locs = [n.text.strip() for n in root.findall(".//sm:loc", ns) if n.text]
            if CANONICAL not in locs:
                failures.append("canonical visualizer URL missing from sitemap")
        except ET.ParseError as exc:
            failures.append(f"sitemap.xml invalid: {exc}")

    if not README.exists():
        failures.append("README.md missing")
    else:
        readme = README.read_text(encoding="utf-8", errors="replace")
        if re.search(r'[A-Za-z]:\\Users\\', readme):
            failures.append("README contains a local Windows user path")
        for required in (ATLAS, VERSION_DOI):
            if required not in readme:
                failures.append(f"README missing research provenance link: {required}")

    print(f"Atlas visualizer QA: {len(failures)} failures · {len(warnings)} warnings")
    for warning in warnings:
        print("WARN:", warning)
    if failures:
        for failure in failures:
            print("ERROR:", failure)
        return 1
    print("OK: visualizer provenance, local assets and SEO metadata are consistent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
