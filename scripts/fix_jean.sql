-- ==================================================================================
-- CORREÇÃO: RDP do Jean (PRJ29927 - AV - 2026-05-11)
-- Remove Gislan dos participantes, mantém apenas dados corretos
-- ==================================================================================

-- 1. VERIFICAR ANTES DA CORREÇÃO
SELECT
  id,
  arquivo,
  data,
  responsavel,
  participantes
FROM rdps
WHERE projeto_codigo = 'PRJ29927'
  AND arquivo ILIKE '%Jean%Kevyn%';

-- 2. CORRIGIR: Remover participantes (deixar array vazio)
UPDATE rdps
SET participantes = '[]'::jsonb
WHERE projeto_codigo = 'PRJ29927'
  AND arquivo ILIKE '%Jean%Kevyn%';

-- 3. VERIFICAR DEPOIS DA CORREÇÃO
SELECT
  id,
  arquivo,
  data,
  responsavel,
  participantes
FROM rdps
WHERE projeto_codigo = 'PRJ29927'
  AND arquivo ILIKE '%Jean%Kevyn%';
