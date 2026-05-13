#!/usr/bin/env python3
"""Testa POST com payload real para entender o erro 400"""
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

def test_post_minimal(url, key):
    """Teste POST com payload mínimo"""
    print("\n[POST] Payload mínimo")

    payload = {
        "arquivo": "TEST_" + os.urandom(4).hex() + ".pdf",
        "data": "2026-05-13"
    }

    print(f"  Payload: {json.dumps(payload)}")

    try:
        data = json.dumps([payload]).encode("utf-8")
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
            print(f"  ✓ Status {resp.status}")
            body = resp.read().decode()
            print(f"  Response: {body[:200]}")
            return True
    except urllib.error.HTTPError as e:
        print(f"  ✗ HTTP {e.code}")
        try:
            error = e.read().decode()
            error_json = json.loads(error)
            print(f"    Message: {error_json.get('message', '')}")
            print(f"    Details: {error_json.get('details', '')}")
            print(f"    Hint: {error_json.get('hint', '')}")
        except:
            print(f"    Raw: {error[:200]}")
        return False

def test_post_with_all_fields(url, key):
    """Teste POST com todos os campos"""
    print("\n[POST] Com todos os campos")

    payload = {
        "arquivo": "TEST_FULL_" + os.urandom(4).hex() + ".pdf",
        "data": "2026-05-13",
        "responsavel": "Test User",
        "projeto_codigo": "PRJ99999",
        "sistema": "BMS",
        "n_atividades": 0,
        "n_pendencias": 0
    }

    print(f"  Payload: {json.dumps(payload)}")

    try:
        data = json.dumps([payload]).encode("utf-8")
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
            print(f"  ✓ Status {resp.status}")
            body = resp.read().decode()
            print(f"  Response: {body[:200]}")
            return True
    except urllib.error.HTTPError as e:
        print(f"  ✗ HTTP {e.code}")
        try:
            error = e.read().decode()
            error_json = json.loads(error)
            print(f"    Message: {error_json.get('message', '')}")
            print(f"    Details: {error_json.get('details', '')}")
        except:
            print(f"    Raw: {error[:200]}")
        return False

def test_check_table_schema(url, key):
    """Testa GET para ver estrutura da tabela"""
    print("\n[GET] Estrutura da tabela (um registro)")

    try:
        req = urllib.request.Request(
            f"{url}/rest/v1/rdps?limit=1",
            headers={"apikey": key}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            print(f"  ✓ Status {resp.status}")
            body = resp.read().decode()
            data = json.loads(body)

            if data:
                first_rdp = data[0]
                print(f"\n  Campos da tabela:")
                for key, val in first_rdp.items():
                    print(f"    - {key}: {type(val).__name__}")
            else:
                print("  (Tabela vazia - não conseguiu ver schema)")
            return True
    except Exception as e:
        print(f"  ✗ Erro: {e}")
        return False

def main():
    print("\n" + "#"*60)
    print("#  Teste de POST para Supabase")
    print("#"*60)

    url, key = load_env()

    if not url or not key:
        print("❌ .env não configurado!")
        return 1

    print(f"\nURL: {url}")
    print(f"KEY: {key[:30]}...")

    # Primeiro vê a estrutura
    test_check_table_schema(url, key)

    # Depois testa POST
    test_post_minimal(url, key)
    test_post_with_all_fields(url, key)

    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main())
