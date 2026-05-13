# Guia de Sincronização RDP → Supabase

## Visão Geral

A partir de **2026-05-13**, os RDPs processados são sincronizados automaticamente com a tabela `rdps` no Supabase via REST API.

**Workflow:**
```
RDP PDFs → process_rdps.py → rdps.json → Supabase (automático)
                                       ↓
                                  Dashboard
```

---

## 1. Configuração (⚙️ Uma vez)

### 1.1 Criar arquivo `.env`

Na raiz de `dashboard_v2/`, crie arquivo `.env`:

```
SUPABASE_URL=https://rycygvzfuleezfjrdeaz.supabase.co
SUPABASE_KEY=sb_publishable_eOTgToeBo1pDGtPqCcXnrQ_W-3THsrT
```

✅ **Já configurado!** Arquivo `.env` foi criado automaticamente.

### 1.2 Verificar Schema Supabase

Tabela `rdps` deve ter colunas:
- `arquivo` (text, PRIMARY KEY) — identificador único
- `data` (date)
- `responsavel` (text)
- `projeto_codigo` (text)
- `sistema` (text)
- `n_atividades` (integer)
- `n_pendencias` (integer)
- `participantes` (jsonb)
- `atividades` (jsonb)
- `pendencias` (jsonb)

---

## 2. Como Carregar RDPs Localmente

### Opção A: Hoje + Ontem (padrão)
```bash
cd dashboard_v2
python scripts/process_rdps.py
```

### Opção B: Data Específica
```bash
python scripts/process_rdps.py --date 2026-05-13
```

### Opção C: Todos os RDPs no histórico
```bash
python scripts/process_rdps.py --all
```

**Output:**
```
============================================================
  RDPs: 154 (novos: 2)
  Pendencias: 43
  Projetos: 18
  Sincronizados com Supabase: 154
  Erros: 0 | Warnings: 3
============================================================
```

---

## 3. Sincronização Automática (Opção C)

### Scheduled Task: `daily-rdp-sync`

Roda **automaticamente todo dia ao meio-dia (12:04 PM)**.

**Você pode:**
- ✅ Deixar rodando sozinho (recomendado)
- ✅ Rodar manualmente clicando "Run now" na interface Cowork
- ✅ Modificar horário: abra `daily-rdp-sync/SKILL.md` e ajuste `cronExpression`

---

## 4. Verificar Sync

### 4.1 Console do Dashboard

Abra dashboard e verifique console (F12):
```
✅ Supabase conectado
✅ RDPs carregados do Supabase: 154
✅ Ausências carregadas: 2
✅ Dashboard renderizado
```

### 4.2 Arquivo de Log

Cada execução gera log em:
```
dashboard_v2/logs/process_YYYYMMDD_HHMMSS.log
```

Procure por:
```
RDPs sincronizados com Supabase: N
```

### 4.3 Verificar Tabela Supabase

Na console Supabase, navegue até `rdps` table:
- Filtre por `data >= hoje`
- Verifique se `arquivo` e `n_pendencias` estão preenchidos

---

## 5. Troubleshooting

### ❌ "Sincronizados com Supabase: 0"

**Causa:** Credenciais inválidas ou URL incorreta

**Solução:**
1. Verifique `.env` está no diretório `dashboard_v2/`
2. Confirm `SUPABASE_URL` e `SUPABASE_KEY` corretos
3. Teste:
   ```bash
   curl -H "apikey: YOUR_KEY" "https://YOUR_URL/rest/v1/rdps?limit=1"
   ```

### ❌ "pdfplumber not found"

**Solução:**
```bash
pip install pdfplumber docx2txt --break-system-packages
```

### ❌ "Nenhum arquivo encontrado"

**Causa:** Pasta `../RDP/<data>/` não tem PDFs

**Solução:** Certifique-se que RDP PDFs estão em:
```
C:\Users\Joao.Chiarelli\RDP\2026-05-13\
C:\Users\Joao.Chiarelli\RDP\2026-05-12\
```

---

## 6. Fluxo Completo

```
1. User coloca RDP PDF em ../RDP/<data>/
        ↓
2. Roda: python scripts/process_rdps.py
        ↓
3. Script processa e gera data/rdps.json
        ↓
4. Sync automático envia para Supabase
        ↓
5. Dashboard recarrega
        ↓
6. Dados aparecem em todas as abas
```

---

## 7. Próximos Passos

- [ ] Configurar alertas se sync falhar (email/Slack)
- [ ] Automatizar leitura de PDFs de uma caixa de entrada (OneDrive/Drive)
- [ ] Criar skill `/analise-rdp` que atualiza `analise_ia.md` automaticamente
- [ ] Medir tempo de sync e otimizar se > 5 min

---

**Última atualização:** 2026-05-13  
**Implementado por:** Claude
