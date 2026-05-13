#!/usr/bin/env python3
"""Inspeciona schema da tabela rdps e foreign keys"""
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

def inspect_rdps_schema(url, key):
    """Obtém um registro da tabela para ver os campos"""
    print("\n" + "="*60)
    print("  INSPEÇÃO: Estrutura da tabela rdps")
    print("="*60)

    try:
        req = urllib.request.Request(
            f"{url}/rest/v1/rdps?limit=1",
            headers={"apikey": key}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            if data:
                print("\n✓ Campos encontrados:")
                for field, value in data[0].items():
                    val_type = type(value).__name__
                    print(f"  - {field}: {val_type} = {value}")
            else:
                print("✓ Tabela vazia (nenhum registro para inspecionar)")
                print("  Use: SELECT * FROM rdps LIMIT 1 no SQL Editor")
            return True
    except Exception as e:
        print(f"❌ Erro: {e}")
        return False

def check_projeto_codigo_constraint(url, key):
    """Verifica se projeto_codigo é nullable e lista projetos válidos"""
    print("\n" + "="*60)
    print("  CONSTRAINT: projeto_codigo (Foreign Key)")
    print("="*60)

    # Tenta listar projetos (se tabela existe)
    try:
        req = urllib.request.Request(
            f"{url}/rest/v1/projetos?limit=10",
            headers={"apikey": key}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            print(f"\n✓ Tabela 'projetos' existe com {len(data)} registros:")
            for proj in data:
                print(f"  - {proj.get('codigo', proj.get('id', '?'))}: {proj.get('nome', proj.get('titulo', ''))}")
            return True
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print("\n❌ Tabela 'projetos' NAO existe!")
            print("\nSoluções:")
            print("  1. Criar tabela projetos no Supabase")
            print("  2. Ou remover a foreign key de rdps")
            print("  3. Ou deixar projeto_codigo como NULL nos INSERTs")
            return False
        else:
            print(f"\n⚠️  HTTP {e.code}: {e.reason}")
            print("  (Pode ser que 'projetos' exista mas tenha restrições de acesso)")
            return False

def test_insert_without_projeto(url, key):
    """Tenta INSERT sem projeto_codigo"""
    print("\n" + "="*60)
    print("  TESTE: INSERT sem projeto_codigo")
    print("="*60)

    test_payload = {
        "arquivo": "DIAG_" + os.urandom(4).hex() + ".pdf",
        "data": "2026-05-13",
        "responsavel": "Teste Diagnóstico"
        # sem projeto_codigo
    }

    print(f"\n  Payload: {json.dumps(test_payload)}")

    try:
        data = json.dumps([test_payload]).encode("utf-8")
        req = urllib.request.Request(
            f"{url}/rest/v1/rdps",
            data=data,
            headers={
                "apikey": key,
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            print(f"\n✓ INSERT OK (HTTP {resp.status})")
            result = json.loads(resp.read().decode())
            print(f"  Registro criado: {result}")

            # Limpa
            try:
                del_req = urllib.request.Request(
                    f"{url}/rest/v1/rdps?arquivo=eq.{test_payload['arquivo']}",
                    headers={"apikey": key},
                    method="DELETE"
                )
                urllib.request.urlopen(del_req, timeout=5)
                print("  (Registro de teste removido)")
            except:
                pass

            return True
    except urllib.error.HTTPError as e:
        print(f"\n❌ HTTP {e.code}: {e.reason}")
        try:
            error_body = e.read().decode()
            error_json = json.loads(error_body)
            print(f"  Detail: {error_json.get('message', error_json.get('details', ''))}")
        except:
            pass
        return False

def main():
    print("\n" + "#"*60)
    print("#  Inspeção de Schema - Supabase RDP")
    print("#"*60)

    url, key = load_env()

    if not url or not key:
        print("❌ .env não configurado!")
        return 1

    print(f"\nURL: {url}")
    print(f"KEY: {key[:20]}...")

    inspect_rdps_schema(url, key)
    check_projeto_codigo_constraint(url, key)
    test_insert_without_projeto(url, key)

    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main())
