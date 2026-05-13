# Handoff — Dashboard RDP Convergint

Documento auto-contido para iniciar nova conversa em outro modelo. Cole o conteúdo deste arquivo no início da nova sessão.

---

## 1. Identidade e contexto

**Usuário:** João Paulo Chiarelli (chiarelli.cftv@gmail.com)
**Empresa:** Convergint
**Função:** Gestor de projetos (BMS, SDAI, Security, AV, SEG)
**Preferências de comunicação:**
- Direto, lógico e estruturado
- Foco em execução e impacto
- Análise crítica em vez de validação
- Português profissional, sem clichês
- Não usar listas onde prosa serve melhor
- Não usar emojis em arquivos sem pedido explícito

**Pasta de trabalho ativa:**
`C:\Users\Joao.Chiarelli\OneDrive - Convergint\Claude\Acompanhamento de projeto\dashboard_v2`

**Nota:** a pasta está dentro do OneDrive. Sincroniza automaticamente entre máquinas. Cuidado com placeholder cloud-only (size 0).

---

## 2. O projeto

Dashboard local para acompanhar **RDPs** (Relatórios Diários de Programação) da Convergint. Sistema lê PDFs/DOCX dos colaboradores, cruza com base de Pessoas e SIBS (códigos de projeto), gera análise inteligente escrita pelo Claude pensando como gestor de projeto.

**Versão atual:** v2.3.x (após múltiplas iterações). A v1 corrompeu duas vezes e foi descartada — a pasta `_corrompidos/` guarda evidência.

### Filosofia de design

1. **Separação dados/código** — JSONs em `data/` separados do HTML/JS
2. **Escrita atômica obrigatória** — `.tmp` + sanity check + `os.replace()`
3. **Backup automático** — `_backup/` antes de cada gravação
4. **IA analisa, código estrutura** — `process_rdps.py` só extrai/cruza; análise é escrita pelo Claude lendo `texto_full` integral

---

## 3. Estrutura de arquivos

```
dashboard_v2/
├── dashboard.html              # SPA com 5 abas, ~50KB
├── start_server.bat            # Inicia servidor local
├── setup.bat / setup.ps1       # Instala deps Python
├── requirements.txt            # pdfplumber, docx2txt, pypdf, openpyxl
├── COMECE-AQUI.txt             # Quick start
├── README.md
├── HANDOFF-CONTEXTO.md         # ESTE ARQUIVO
│
├── data/
│   ├── dashboard_data.js       # window.RDP_DATA = {...}; (~1MB consolidado)
│   ├── analise_ia.md           # ANALISE escrita pelo Claude (markdown)
│   ├── analise_ia.js           # window.ANALISE_IA_MD = "..."; (gerado do .md)
│   ├── rdps.json               # 159 RDPs estruturados acumulativo
│   ├── pendencias.json         # 214 pendências deduplicadas
│   ├── projetos.json           # 39 projetos consolidados com pendências por sistema
│   ├── pessoas.json            # 51 pessoas (de Pessoas.xlsx) com nome/email/equipe/disciplina/lider
│   ├── projetos_index.json     # 1470 códigos PRJ/ASV/CTR (de SIBS xlsx)
│   ├── projetos_sibs.json      # 1717 projetos completos do SIBS
│   ├── meta.json               # generatedAt, today, totais
│   └── acoes.json              # Ações em pendências (gravadas pelo servidor)
│
├── scripts/
│   ├── process_rdps.py         # Processa PDFs/DOCX → JSONs
│   ├── update_analise_js.py    # Converte analise_ia.md → .js
│   └── serve.py                # Servidor HTTP local porta 8765
│
├── _backup/                    # Snapshots automáticos timestamp
├── logs/                       # Logs por execução
└── .claude-skill/atualizar-rdp/SKILL.md  # Skill instalável
```

### Fontes externas

- `..\Pessoas.xlsx` — 51 pessoas em 5 equipes (BMS, BMS Dev.Telas, SDAI, SEC, AV-THIAGO BELLAZZI)
- `..\SIBS-Project_code_Report-20260429054014.xlsx` — 1717 projetos com códigos
- `..\RDP\YYYY-MM-DD\` — pastas com PDFs e DOCX dos RDPs do dia

---

## 4. As 5 abas do dashboard

1. **Visão Geral** — KPIs (Total Esperado, Enviados, Pendentes, Conformidade %, Projetos, Pendências) com filtro de **range de datas** (DE/ATÉ + botões 7d e 30d) e equipe. Gráficos: Desempenho por Equipe (% no período) e Entrega Diária (RDPs/dia útil). Tabela: Colaboradores Pendentes (não enviaram nenhum RDP no período).

2. **Status Diário** — Filtros (data + equipe + status + busca). Tabela com Status / Colaborador / Equipe / Email / Disciplina / Projeto / Arquivo.

3. **Por Equipe** — Filtros DE/ATÉ. Cards por equipe com líder, membros, compliance%. Ranking individual.

4. **RDPs do Dia / Projetos** — Filtros (busca, categoria, BU). Cards de projeto expansíveis. Pendências aglomeradas por **sistema** (BMS/AV/Security/SDAI/SEG). **Cada pendência tem botão "+ adicionar ação"** com responsável, prazo e status (Aberta → Em andamento → Concluída). Persistência via servidor (data/acoes.json) com fallback localStorage.

5. **Análise IA** — Renderiza `analise_ia.md` (markdown → HTML). **Escrita pelo Claude lendo os RDPs integralmente, não por código.**

---

## 5. Como rodar

### Opção A — Servidor (recomendado)

```
duplo clique em start_server.bat
→ abre http://localhost:8765/dashboard.html
→ ações persistem em data/acoes.json
```

### Opção B — Direto (file://)

```
duplo clique em dashboard.html
→ ações ficam em localStorage do navegador
```

### Atualizar dataset

```
python scripts/process_rdps.py                 # ontem + hoje
python scripts/process_rdps.py --date 2026-05-04
python scripts/process_rdps.py --all            # todas as datas
```

Se erro `No module named pdfplumber`: rode `setup.bat` primeiro.

### Atualizar análise IA

Pedir ao Claude: *"atualize a análise IA dos RDPs de hoje"* ou variações.
O Claude lê os RDPs (campo `texto_full` no `rdps.json`) e reescreve `data/analise_ia.md`. Depois roda `python scripts/update_analise_js.py` para regenerar o `.js`.

---

## 6. Automações instaladas

### Schedule diário

- **Nome:** `rdp-diario-1200`
- **Cron:** `0 12 * * *` (todo dia 12:00 local time)
- **Arquivo:** `C:\Users\Joao.Chiarelli\Documents\Claude\Scheduled\rdp-diario-1200\SKILL.md`
- **Ação:** Processa RDPs dos 2 dias anteriores + regenera análise IA
- **Importante:** clicar "Run now" uma vez no painel Scheduled para pré-aprovar permissões de bash/python

### Skill on-demand

- **Nome:** `atualizar-rdp`
- **Origem:** `dashboard_v2/.claude-skill/atualizar-rdp/SKILL.md`
- **Trigger:** "atualize os RDPs", "rode a analise IA", "processa os RDPs de hoje"
- **Instalação:** ver `.claude-skill/INSTALAR-SKILL.txt`

---

## 7. Decisões técnicas importantes

### Persistência de ações (pendências)

- **Servidor:** http.server stdlib em `scripts/serve.py`. Endpoints `GET /api/acoes` e `POST /api/acoes`. Escrita atômica em `data/acoes.json`. Backup em `_backup/acoes_<timestamp>.json`.
- **Fallback:** localStorage do navegador se servidor offline. Migração automática localStorage → servidor quando reconecta.
- **Boot tolerante:** `acoesBootstrap()` é fire-and-forget no DOMContentLoaded. Se travar, a UI renderiza mesmo assim.

### Identificação de pessoas em RDPs

Cada RDP tem tabela "PROFISSIONAIS ENVOLVIDOS" com até 4 nomes. O parser extrai TODOS os participantes (não só quem assina o arquivo) e marca como "enviou no dia" no dashboard.

**Edge case:** alguns PDFs têm texto sem espaços (`NoéliodeBritoOliveira`). Função `desgrudar_nome()` insere espaços antes de maiúsculas e o fuzzy match `SequenceMatcher 0.65+` corrige inconsistências contra Pessoas.xlsx.

### Datas inválidas

Alguns nomes de arquivo têm formato `2026-30-04` (mês 30 = inválido) em vez de `2026-04-30`. Função `normalize_date()` em Python detecta swap mês↔dia heuristicamente. JS tem `isValidISODate()` para nunca chamar `new Date()` com data inválida (causava `RangeError`).

### Líder das equipes

Pessoas.xlsx tem coluna `Equipe` no formato `"PRG BRA - DISCIPLINA - LIDER"`. Parser limpa "PRG BRA -", normaliza espaços, separa disciplina (1º trecho) e líder (último trecho). Equipe `"AV - THIAGO BELLAZZI"` tem THIAGO BELLAZZI como líder.

### Pendências — 3 fontes

1. Seção formal "PENDÊNCIAS" do RDP (bullets)
2. Tabela "ATIVIDADES" com STATUS Paralisado/Pendente/Não-Solucionado/Atrasado
3. Frases em prosa: "aguardando", "ainda falta", "atividade paralisada", "sem comunicação"

---

## 8. Estado atual do dataset (em 2026-05-05)

- **159 RDPs** processados (~25 dias)
- **214 pendências** deduplicadas
- **39 projetos** com RDPs
- **51 pessoas** ativas em 5 equipes
- **1470 códigos** SIBS indexados (606 PRJ, 86 ASV, 211 CTR)

**Top projetos com mais pendências:**
| Projeto | Cliente | Sistema | N |
|---|---|---|---|
| PRJ53722 | VIA APPIA | BMS | 91 |
| PRJ19620 | AEROPORTO RECIFE | BMS | 20 |
| PRJ35873 | SCALA | BMS | 7 |
| PRJ57394 | GE AEROSPACE | SEG | 6 |
| PRJ47108 | GOOGLE | SDAI | 4 |

---

## 9. Armadilhas conhecidas (cuidado)

### a) Linter trunca arquivos longos

Editar arquivos grandes (>20KB) via tool `Edit` ou `Write` ocasionalmente trunca o final. Sempre validar:
- Para Python: `py_compile.compile()`
- Para HTML: contar `<script>` e `</script>` (devem bater)
- Para JS: `node -e "new Function(...)"` em cada `<script>` inline

Solução de recovery: usar `python` via bash para reescrever via `os.replace()` direto.

### b) PDFs com texto grudado

Alguns PDFs vêm sem espaços. Já tratado em `extract_profissionais()` mas pode aparecer em outras seções.

### c) OneDrive cloud-only

Arquivos com size 0 são placeholder do OneDrive. Script já detecta e pula com warning.

### d) Datas com formato YYYY-DD-MM

Já tratado, mas se aparecer mês > 12 e dia > 12, descartar (não dá pra inferir).

### e) Servidor `serve.py` não inicia

Em alguns Windows com Python instalado via Microsoft Store, o `python` no PATH pode não funcionar. Tentar `py -3 scripts/serve.py` ou instalar Python de python.org.

### f) Encoding do Windows

Sempre forçar `encoding="utf-8"` ao abrir arquivos no Python. Default Windows é cp1252 e quebra com acentos.

---

## 10. Onde a Análise IA é gerada

**Arquivo:** `data/analise_ia.md`

**Formato esperado** (sigam essa estrutura):

```
# Análise IA · Acompanhamento de RDP

**Atualização:** DD/MM/YYYY · **Período coberto:** RDPs de DD/MM (N) e DD/MM (N)
**Analista:** IA atuando como gestor de projeto experiente
**Fonte:** leitura direta dos PDFs/DOCX

---

## Status Operacional
ESTÁVEL / COM ATENÇÃO / EM RISCO + síntese 2-3 frases

## Leitura Executiva do Dia
- O que avançou
- O que travou
- O que requer ação imediata

## Decisões do Gestor (próximas 24-48h)
### 1. PRJxxxxx — Cliente / Nome (CRÍTICO)
**Por quê:** análise factual
**Decisão sugerida:** bullets

## Bloqueios Externos Identificados
| tabela |

## Pessoas em Alerta
### Jornada / Carga
### Dia improdutivo
### Pendências carregadas

## Plano de Ação 24-48h
| # | Ação | Quem | Prazo |

## Sucessos do Período (registrar)
## Métricas do Período
## Observação para o Gestor
```

**Princípios:** direto, concreto (citar PRJxxxxx + cliente + nome), crítico (apontar falhas), acionável (ação tem responsável e prazo), não fingir análise via parsing.

Após editar o `.md`, rodar `python scripts/update_analise_js.py` para o dashboard ver.

---

## 11. Como continuar em outro modelo

Cole este documento inteiro como contexto inicial. Diga ao novo modelo:

> Eu uso este dashboard local. Pasta de trabalho:
> `C:\Users\Joao.Chiarelli\OneDrive - Convergint\Claude\Acompanhamento de projeto\dashboard_v2`
>
> Vamos continuar daqui. [seu pedido]

O modelo deve:
1. Ler primeiro este arquivo (`HANDOFF-CONTEXTO.md`)
2. Validar que `data/dashboard_data.js`, `data/rdps.json`, `data/pessoas.json` estão íntegros
3. Aplicar as mesmas convenções (escrita atômica, sem inventar, IA analisa não código)
4. Respeitar minhas preferências (direto, sem floreios, sem emojis)

## 12. Histórico de tasks (para referência)

Foram concluídas ~43 tasks ao longo do desenvolvimento. As mais recentes:
- #42: Sanitizar datas inválidas (YYYY-DD-MM swap)
- #43: Schedule diário 12:00 + skill on-demand `atualizar-rdp`

---

*Documento criado em 2026-05-05. Atualizar a cada virada de versão maior do dashboard.*
