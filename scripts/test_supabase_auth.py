#!/usr/bin/env python3
"""Testa diferentes formas de autenticar com Supabase"""
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

def test_1_simple_get(url, key):
    """Teste 1: GET simples com apikey"""
    print("\n[1] GET simples com header 'apikey'")
    try:
        req = urllib.request.Request(
            f"{url}/rest/v1/rdps?limit=1",
            headers={"apikey": key}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            print(f"  ✓ Status {resp.status}")
            return True
    except urllib.error.HTTPError as e:
        print(f"  ✗ HTTP {e.code}")
        try:
            error = e.read().decode()
            print(f"    Detail: {error[:100]}")
        except:
            pass
        return False

def test_2_with_auth_header(url, key):
    """Teste 2: Authorization header (Bearer token)"""
    print("\n[2] GET com Authorization header (Bearer)")
    try:
        req = urllib.request.Request(
            f"{url}/rest/v1/rdps?limit=1",
            headers={"Authorization": f"Bearer {key}"}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            print(f"  ✓ Status {resp.status}")
            return True
    except urllib.error.HTTPError as e:
        print(f"  ✗ HTTP {e.code}")
        return False

def test_3_with_content_type(url, key):
    """Teste 3: Com Content-Type"""
    print("\n[3] GET com Content-Type + apikey")
    try:
        req = urllib.request.Request(
            f"{url}/rest/v1/rdps?limit=1",
            headers={
                "apikey": key,
                "Content-Type": "application/json"
            }
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            print(f"  ✓ Status {resp.status}")
            return True
    except urllib.error.HTTPError as e:
        print(f"  ✗ HTTP {e.code}")
        return False

def test_4_post_empty(url, key):
    """Teste 4: POST com body vazio"""
    print("\n[4] POST com body vazio")
    try:
        req = urllib.request.Request(
            f"{url}/rest/v1/rdps?limit=1",
            data=b"",
            headers={
                "apikey": key,
                "Content-Type": "application/json"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            print(f"  ✓ Status {resp.status}")
            return True
    except urllib.error.HTTPError as e:
        print(f"  ✗ HTTP {e.code}")
        return False

def test_5_with_user_agent(url, key):
    """Teste 5: Com User-Agent (como browser)"""
    print("\n[5] GET com User-Agent como browser")
    try:
        req = urllib.request.Request(
            f"{url}/rest/v1/rdps?limit=1",
            headers={
                "apikey": key,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            print(f"  ✓ Status {resp.status}")
            return True
    except urllib.error.HTTPError as e:
        print(f"  ✗ HTTP {e.code}")
        return False

def main():
    print("\n" + "#"*60)
    print("#  Teste de Autenticação Supabase (diferentes métodos)")
    print("#"*60)

    url, key = load_env()

    if not url or not key:
        print("❌ .env não configurado!")
        return 1

    print(f"\nURL: {url}")
    print(f"KEY: {key[:30]}...")

    results = []
    results.append(("GET + apikey header", test_1_simple_get(url, key)))
    results.append(("GET + Authorization Bearer", test_2_with_auth_header(url, key)))
    results.append(("GET + Content-Type", test_3_with_content_type(url, key)))
    results.append(("POST + body vazio", test_4_post_empty(url, key)))
    results.append(("GET + User-Agent", test_5_with_user_agent(url, key)))

    print("\n" + "="*60)
    print("  RESUMO")
    print("="*60)

    for name, result in results:
        status = "✓" if result else "✗"
        print(f"  {status} {name}")

    if any(r for _, r in results):
        print("\n✓ Encontrado método que funciona!")
        print("  Use este método no script sync")
        return 0
    else:
        print("\n❌ Nenhum método funcionou")
        print("\nPossíveis causas:")
        print("  1. Credenciais inválidas (URL ou KEY incorretos)")
        print("  2. Tabela 'rdps' não existe no Supabase")
        print("  3. Projeto Supabase está pausado/desativado")
        print("\nPróximos passos:")
        print("  1. Verifique se dashboard.html consegue conectar")
        print("  2. Abra console do browser (F12) e veja logs")
        print("  3. Confirme URL e KEY no dashboard.html vs .env")
        return 1

if __name__ == "__main__":
    import sys
    sys.exit(main())
