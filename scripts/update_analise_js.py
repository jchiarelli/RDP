#!/usr/bin/env python3
"""
Converte data/analise_ia.md em data/analise_ia.js (window.ANALISE_IA_MD = "...").
Chamado automaticamente sempre que a analise IA for atualizada.

Por que isso existe: navegador abrindo HTML via file:// bloqueia fetch() por
seguranca CORS. A solucao e injetar o conteudo via <script src> em vez de fetch.

Uso:
    python scripts/update_analise_js.py
"""
import os
import sys
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
MD = DATA / "analise_ia.md"
JS = DATA / "analise_ia.js"


def main():
    if not MD.exists():
        print("ERRO: " + str(MD) + " nao existe.")
        return 1
    md_content = MD.read_text(encoding="utf-8")
    # json.dumps escapa corretamente para string JS
    js_content = "window.ANALISE_IA_MD = " + json.dumps(md_content, ensure_ascii=False) + ";\n"
    tmp = JS.with_suffix(".js.tmp")
    tmp.write_text(js_content, encoding="utf-8")
    raw = tmp.read_bytes()
    if b"\x00" in raw:
        tmp.unlink()
        print("ERRO: null bytes detectados na escrita.")
        return 1
    os.replace(tmp, JS)
    print("OK: analise_ia.js atualizado (" + str(len(js_content)) + " bytes)")
    print("    fonte: analise_ia.md (" + str(len(md_content)) + " bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
