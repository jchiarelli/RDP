# Dashboard RDP v2.1 + Gestão de Pessoas (Supabase)

Sistema de acompanhamento de RDPs com 5 abas + gestão de pessoas via Supabase. Cruzamento de bases (Pessoas + SIBS), ausências/férias, e análise IA escrita pelo Claude.

## Estrutura

```
dashboard_v2/
├── dashboard.html              # Abra no navegador (5 abas)
├── data/
│   ├── dashboard_data.js       # Dados consolidados (carregado pelo HTML)
│   ├── rdps.json               # RDPs estruturados
│   ├── pendencias.json         # Pendências deduplicadas
│   ├── projetos.json           # Projetos consolidados
│   ├── pessoas.json            # 53 colaboradores (de Pessoas.xlsx)
│   ├── projetos_index.json     # Índice PRJ→Cliente/Categoria (de SIBS.xlsx)
│   ├── meta.json
│   └── analise_ia.md           # ESCRITA PELO CLAUDE, não por código
├── scripts/
│   └── process_rdps.py         # Estrutura RDPs (não analisa)
├── logs/                       # Logs por execução
├── _backup/                    # Snapshots automáticos
└── README.md
```

## As 6 abas

1. **Visão Geral** — KPIs (Total, Enviados, Pendentes, Conformidade, Projetos, Pendências), filtros (data + equipe), gráficos por equipe e diário, tabela de colaboradores pendentes com último envio.
2. **Status Diário** — Filtros (data + equipe + status + busca). Tabela de cada colaborador com Status/Equipe/Email/Disciplina/Projeto/Arquivo. Automaticamente exclui pessoas em licença/férias.
3. **Por Equipe** — Filtros de período. Cards por equipe com líder, membros, compliance%. Ranking individual.
4. **RDPs do Dia / Projetos** — Filtros (busca, categoria, BU). Cards de projeto expansíveis. **Pendências aglomeradas por sistema (AV/BMS/Security/SDAI/SEG)**.
5. **Análise IA** — Renderiza `data/analise_ia.md`. Escrito pelo Claude lendo os RDPs, NÃO por código.
6. **Gestão de Pessoas** — Interface para gerenciar pessoas, equipes, ausências/férias. Dados persistem no Supabase.

## Supabase Integration (Pessoas & Ausências)

Desde **2026-05-13**, as pessoas e ausências são gerenciadas via Supabase:

- **Pessoas**: Armazenadas em tabela `pessoas` (id, nome, email, equipe, disciplina, lider, ativa)
- **Ausências**: Tabela `pessoas_ausencias` (pessoa_id, tipo, data_inicio, data_fim, observacao)
- **Histórico**: Tabela `pessoas_mudancas` registra todas as alterações

### Como funciona

1. **Carregamento**: `carregarPessoasSupabase()` e `carregarAusenciasSupabase()` são chamadas automaticamente no boot
2. **Caching**: Dados armazenados em `window._pessoasCache` e `window.SupabaseGestao.ausenciasCache`
3. **Lógica**: Função `pessoaEmLicenca()` verifica se pessoa está em período ativo de ausência
4. **Status Diário**: Pessoas com ausência ativa NÃO aparecem como "pendentes" (mesmo sem RDP)

### Gestão de Pessoas (aba 6)

Interface dentro do dashboard para:
- ✅ Adicionar nova pessoa (nome, email, equipe, disciplina, líder)
- ✅ Marcar ausência/férias (tipo, data início/fim, observação)
- ✅ Remover ausência
- ✅ Mudar equipe
- ✅ Remover pessoa (marca como inativa)

Todos os dados persistem no Supabase automaticamente.

---

## Como atualizar análise IA

Pedir ao Claude:

> *Atualize a análise IA dos RDPs de hoje*

O Claude lê os RDPs, sobrescreve `data/analise_ia.md` no estilo gestor de projeto (status operacional, decisões, bloqueios externos, pessoas em alerta, plano 24-48h).

## Como atualizar dados

```bash
cd dashboard_v2
python scripts/process_rdps.py                # ontem + hoje
python scripts/process_rdps.py --date 2026-05-04
python scripts/process_rdps.py --all
```

O script:
- Lê PDFs/DOCX de `../RDP/<data>/`
- Faz fuzzy match do responsável contra `pessoas.json`
- Mapeia código PRJ contra `projetos_index.json` (cliente, categoria SIBS, BU)
- Aglomera pendências por projeto e sistema
- Grava com escrita atômica + validação JSON

## Bases já carregadas

- **Pessoas.xlsx**: 53 colaboradores com nome, email, equipe, disciplina (BMS, SDAI, SEC, SEG, AV)
- **SIBS-Project_code_Report**: 1717 projetos, 1470 códigos indexados (606 PRJ, 86 ASV, 211 CTR)

## Proteção contra corrupção

Cada gravação executa: `tmp` → validar JSON → checar null bytes → `os.replace`. Backup automático em `_backup/` antes de sobrescrever.

## Próximo passo: virar skill

Quando o fluxo estiver maduro, transformar a análise IA em skill instalável (`/analise-rdp`) que faça automaticamente: ler RDPs do dia → sobrescrever `analise_ia.md` → recarregar dashboard.
