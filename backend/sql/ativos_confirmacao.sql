-- Aplicar no SQL Editor do Supabase antes de iniciar a nova versão.
-- Os nomes existentes são preservados; preencher o patrimônio na edição do ativo.
BEGIN;
ALTER TABLE public."ATIVOS" ADD COLUMN IF NOT EXISTS patrimonio varchar;
ALTER TABLE public."CHAMADOS"
  ADD COLUMN IF NOT EXISTS exige_confirmacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmacao_pendente boolean NOT NULL DEFAULT false;
COMMIT;
