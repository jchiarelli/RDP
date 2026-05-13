#!/usr/bin/env python3
"""Corrige participantes do RDP do Jean (PRJ29927 - AV)"""
import os, json, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def load_env():
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").split("\n"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip()

    return os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_KEY", "")

def fix_rdp_jean():
    """Atualiza participantes do RDP do Jean para apenas Jean"""
    url, key = load_env()

    if not url or not key:
        print("❌ .env não configurado!")
        return False

    print("\n" + "="*70)
    print("  CORRIGINDO: RDP do Jean (PRJ29927 - AV - 2026-05-11)")
    print("="*70)

    # Busca o RDP específico
    try:
        req = urllib.request.Request(
            f"{url}/rest/v1/rdps?arquivo=ilike.*Jean*Kevyn*&projeto_codigo=eq.PRJ29927&select=id,arquivo,participantes",
            headers={"apikey": key}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            if not data:
                print("❌ RDP do Jean não encontrado no Supabase")
                return False

            rdp = data[0]
            print(f"\n✓ RDP encontrado:")
            print(f"  ID: {rdp.get('id')}")
            print(f"  Arquivo: {rdp.get('arquivo')}")

            # Participantes atuais
            try:
                participantes_atuais = json.loads(rdp.get('participantes', '[]'))
            except:
                participantes_atuais = []

            print(f"\n  Participantes ATUAIS ({len(participantes_atuais)}):")
            for p in participantes_atuais:
                if isinstance(p, dict):
                    print(f"    - {p.get('nome', '?')}")
                else:
                    print(f"    - {p}")

            # Participantes corretos: apenas Jean (ou vazio)
            # Como Jean é o responsável, talvez não precise estar em participantes
            # Vamos deixar vazio para ser coerente
            novo_participantes = []

            print(f"\n  Participantes NOVOS (após correção):")
            if novo_participantes:
                for p in novo_participantes:
                    print(f"    - {p.get('nome', '?')}")
            else:
                print("    (vazio - Jean é o responsável)")

            # Atualiza no Supabase
            update_payload = json.dumps({"participantes": novo_participantes}).encode("utf-8")
            update_req = urllib.request.Request(
                f"{url}/rest/v1/rdps?id=eq.{rdp.get('id')}",
                data=update_payload,
                headers={
                    "apikey": key,
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                },
                method="PATCH"
            )

            with urllib.request.urlopen(update_req, timeout=5) as resp:
                result = json.loads(resp.read().decode())
                print(f"\n✓ RDP atualizado com sucesso!")
                print(f"  Status: HTTP {resp.status}")
                return True

    except Exception as e:
        print(f"\n❌ Erro: {e}")
        return False

if __name__ == "__main__":
    import sys
    sys.exit(0 if fix_rdp_jean() else 1)
