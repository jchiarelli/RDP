#!/usr/bin/env python3
"""Verifica configuração Supabase e schema da tabela rdps"""
import os, json, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def load_env():
    """Carrega .env"""
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

def check_connection(url, key):
    """Verifica conexao basica com Supabase"""
    print("\n" + "="*60)
    print("  TESTE 1: Conexão Supabase")
    print("="*60)

    if not url or not key:
        print("❌ ERRO: Credenciais nao encontradas")
        print("   Crie arquivo .env com:")
        print("   SUPABASE_URL=https://...")
        print("   SUPABASE_KEY=...")
        return False

    print(f"✓ URL: {url}")
    print(f"✓ KEY: {key[:20]}...")

    try:
        test_req = urllib.request.Request(
            f"{url}/rest/v1/",
            headers={"apikey": key}
        )
        with urllib.request.urlopen(test_req, timeout=5) as resp:
            print(f"✓ Status: {resp.status}")
            print("✓ Conexão OK!")
            return True
    except urllib.error.HTTPError as e:
        print(f"❌ HTTP {e.code}: {e.reason}")
        return False
    except Exception as e:
        print(f"❌ Erro: {str(e)}")
        return False

def check_table(url, key):
    """Verifica se tabela rdps existe"""
    print("\n" + "="*60)
    print("  TESTE 2: Tabela 'rdps'")
    print("="*60)

    try:
        req = urllib.request.Request(
            f"{url}/rest/v1/rdps?limit=0&select=id",
            headers={"apikey": key}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            print("✓ Tabela 'rdps' existe!")

            # Tenta contar registros
            count_req = urllib.request.Request(
                f"{url}/rest/v1/rdps?select=count=exact",
                headers={"apikey": key, "Prefer": "count=exact"}
            )
            try:
                with urllib.request.urlopen(count_req, timeout=5) as count_resp:
                    count = count_resp.headers.get("Content-Range", "0").split("/")[-1]
                    print(f"✓ Registros na tabela: {count}")
            except:
                pass

            return True
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print("❌ Tabela 'rdps' NAO EXISTE no Supabase!")
            print("\n  Solução:")
            print("  1. Abra console Supabase")
            print("  2. SQL Editor")
            print("  3. Cole o schema abaixo:\n")
            print(get_schema())
            print("\n  4. Execute a query")
            return False
        else:
            print(f"❌ HTTP {e.code}: {e.reason}")
            return False
    except Exception as e:
        print(f"❌ Erro: {str(e)}")
        return False

def get_schema():
    """Retorna schema SQL para criar tabela"""
    return """
CREATE TABLE rdps (
  id bigserial PRIMARY KEY,
  arquivo TEXT NOT NULL UNIQUE,
  data DATE,
  responsavel TEXT,
  projeto_codigo TEXT,
  sistema TEXT,
  n_atividades INTEGER DEFAULT 0,
  n_pendencias INTEGER DEFAULT 0,
  participantes JSONB DEFAULT '[]'::jsonb,
  atividades JSONB DEFAULT '[]'::jsonb,
  pendencias JSONB DEFAULT '[]'::jsonb,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rdps_data ON rdps(data DESC);
CREATE INDEX idx_rdps_projeto ON rdps(projeto_codigo);
CREATE INDEX idx_rdps_arquivo ON rdps(arquivo);
""".strip()

def test_insert(url, key):
    """Tenta fazer INSERT de teste"""
    print("\n" + "="*60)
    print("  TESTE 3: INSERT de teste")
    print("="*60)

    test_payload = {
        "arquivo": "TEST_" + os.urandom(4).hex() + ".pdf",
        "data": "2026-05-13",
        "responsavel": "Test",
        "projeto_codigo": "PRJ99999"
    }

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
            print(f"✓ INSERT OK (HTTP {resp.status})")

            # Limpa
            try:
                del_req = urllib.request.Request(
                    f"{url}/rest/v1/rdps?arquivo=eq.{test_payload['arquivo']}",
                    headers={"apikey": key},
                    method="DELETE"
                )
                urllib.request.urlopen(del_req, timeout=5)
            except:
                pass

            return True
    except urllib.error.HTTPError as e:
        print(f"❌ HTTP {e.code}: {e.reason}")

        # Tenta ler error detail
        try:
            error_body = e.read().decode()
            error_json = json.loads(error_body)
            print(f"  Detail: {error_json.get('message', error_json.get('details', ''))}")
        except:
            pass

        return False
    except Exception as e:
        print(f"❌ Erro: {str(e)}")
        return False

def main():
    print("\n" + "#"*60)
    print("#  Diagnóstico Supabase RDP Sync")
    print("#"*60)

    url, key = load_env()

    if not check_connection(url, key):
        return 1

    if not check_table(url, key):
        return 1

    if not test_insert(url, key):
        return 1

    print("\n" + "="*60)
    print("  ✓ TUDO OK! Supabase configurado corretamente.")
    print("  Agora execute: python scripts/process_rdps.py")
    print("="*60 + "\n")

    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main())
