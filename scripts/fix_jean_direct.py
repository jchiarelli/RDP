#!/usr/bin/env python3
"""Corrige participantes do RDP do Jean (PRJ29927 - AV)"""
import json, urllib.request

# Credenciais (hardcoded para este script específico)
SUPABASE_URL = "https://rycygvzfuleezfjrdeaz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5Y3lndnpmdWxlZXpmanJkZWF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUyNTY0NCwiZXhwIjoyMDk0MTAxNjQ0fQ.UciIrXVAi-x5fOEx_-JgZ5boKlA6r2Yl7M0hddRMsUI"

print("\n" + "="*70)
print("  CORRIGINDO: RDP do Jean (PRJ29927 - AV)")
print("="*70)

try:
    # 1. Busca o RDP do Jean
    print("\n1. Buscando RDP do Jean no Supabase...")
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/rdps?arquivo=ilike.%25Jean%25Kevyn%25&projeto_codigo=eq.PRJ29927&select=id,arquivo,data,participantes",
        headers={"apikey": SUPABASE_KEY}
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        data = json.loads(resp.read().decode())
        if not data:
            print("   ❌ RDP não encontrado")
            exit(1)

        rdp = data[0]
        rdp_id = rdp['id']
        print(f"   ✓ Encontrado!")
        print(f"     - Arquivo: {rdp['arquivo']}")
        print(f"     - ID: {rdp_id}")

        # Mostra participantes atuais
        try:
            partic_atuais = json.loads(rdp.get('participantes', '[]'))
        except:
            partic_atuais = []

        print(f"     - Participantes ANTES: {len(partic_atuais)}")
        for p in partic_atuais[:5]:  # Mostra até 5
            nome = p.get('nome') if isinstance(p, dict) else p
            print(f"       • {nome}")
        if len(partic_atuais) > 5:
            print(f"       ... e mais {len(partic_atuais) - 5}")

    # 2. Atualiza para participantes vazio
    print("\n2. Atualizando participantes para []...")
    update_payload = json.dumps({"participantes": []}).encode("utf-8")
    update_req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/rdps?id=eq.{rdp_id}",
        data=update_payload,
        headers={
            "apikey": SUPABASE_KEY,
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        },
        method="PATCH"
    )

    with urllib.request.urlopen(update_req, timeout=5) as resp:
        result = json.loads(resp.read().decode())
        if result:
            print(f"   ✓ RDP atualizado com sucesso!")
            print(f"     - Participantes DEPOIS: {result[0]['participantes']}")
        else:
            print(f"   ⚠ Atualização OK mas sem resposta")

except Exception as e:
    print(f"\n❌ Erro: {e}")
    exit(1)

print("\n" + "="*70)
print("✓ CONCLUSÃO: RDP do Jean corrigido. Gislan removida dos participantes.")
print("="*70 + "\n")
