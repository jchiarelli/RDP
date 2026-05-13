# Correção: RDP do Jean (PRJ29927 - AV)

## Problema
O RDP do Jean estava mostrando **Gislan como participante**, mas ao revisar o documento original, Gislan **NÃO está listada** na seção "PROFISSIONAIS ENVOLVIDOS".

## Participantes Reais (Verificados no Documento)
1. ✓ Jean Kevyn Correia Pessoa (responsável/programador)
2. ✓ Tarley Ferreira Dos Santos (líder de implantação) - **NÃO está na tabela de pessoas**
3. ✓ Eduardo Arcanjo Raimundo (supervisor) - **NÃO está na tabela de pessoas**
4. ❌ Gislan Almeida dos Santos - **NÃO está no RDP real**

## Solução
Remover todos os participantes do campo `participantes` e deixar apenas o array vazio `[]`. 

Jean será considerado responsável (campo `responsavel`), e como Tarley e Eduardo não estão na tabela de pessoas, eles não aparecerão no dashboard de qualquer forma.

## Como Executar a Correção

### Opção 1: Via Supabase SQL Editor (Recomendado)
1. Acesse **Supabase → SQL Editor**
2. Cole o conteúdo do arquivo `fix_jean.sql`
3. Execute em 3 etapas:
   - **PASSO 1**: Execute o SELECT para verificar o estado ANTES
   - **PASSO 2**: Execute o UPDATE para corrigir
   - **PASSO 3**: Execute o SELECT final para verificar o estado DEPOIS

### Opção 2: Via Supabase Web UI (Se preferir UI)
1. Vá para **Supabase → Table Editor**
2. Abra a tabela `rdps`
3. Procure o registro com `arquivo LIKE '%Jean%Kevyn%'`
4. Edite o campo `participantes` e mude para `[]` (array vazio)
5. Clique em Save

## Verificação Após a Correção
- Recarregue o dashboard
- Vá para **Status Diário**
- Procure pelo Jean na data **2026-05-11**
- Ele deve aparecer com status **"Enviou"** como responsável
- **Gislan NÃO deve aparecer** associada a este RDP

## Próximas Verificações
Depois desta correção, verificar outros RDPs para padrões similares onde:
- Pessoas que não estão na tabela de pessoas estão listadas
- Nomes foram extraídos incorretamente dos documentos

```bash
# Script para verificar outros possíveis problemas:
# Na pasta scripts/, executar:
python3 process_rdps.py --audit
```
