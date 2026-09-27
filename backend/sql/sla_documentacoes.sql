-- Executar no SQL Editor do Supabase durante a troca de versão.
-- Não executa DROP e não substitui dados de SLA existentes.
BEGIN;

ALTER TABLE public."CHAMADOS"
  ADD COLUMN IF NOT EXISTS prazo_atendimento_em timestamptz,
  ADD COLUMN IF NOT EXISTS atendimento_iniciado_em timestamptz,
  ADD COLUMN IF NOT EXISTS prazo_resolucao_em timestamptz,
  ADD COLUMN IF NOT EXISTS concluido_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz;

CREATE TABLE IF NOT EXISTS public."PAUSAS_SLA_CHAMADOS" (
  id bigserial PRIMARY KEY,
  id_chamado bigint NOT NULL,
  id_usuario_inicio bigint NOT NULL,
  id_usuario_fim bigint,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  encerrado_em timestamptz,
  motivo text NOT NULL,
  CONSTRAINT "PAUSAS_SLA_CHAMADOS_chamado_fkey" FOREIGN KEY (id_chamado) REFERENCES public."CHAMADOS"(id) ON DELETE NO ACTION,
  CONSTRAINT "PAUSAS_SLA_CHAMADOS_usuario_inicio_fkey" FOREIGN KEY (id_usuario_inicio) REFERENCES public."USUARIOS"(id) ON DELETE NO ACTION,
  CONSTRAINT "PAUSAS_SLA_CHAMADOS_usuario_fim_fkey" FOREIGN KEY (id_usuario_fim) REFERENCES public."USUARIOS"(id) ON DELETE NO ACTION
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public."PAUSAS_SLA_CHAMADOS"'::regclass AND conname = 'PAUSAS_SLA_CHAMADOS_intervalo_check') THEN
    ALTER TABLE public."PAUSAS_SLA_CHAMADOS" ADD CONSTRAINT "PAUSAS_SLA_CHAMADOS_intervalo_check" CHECK (encerrado_em IS NULL OR encerrado_em >= iniciado_em);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public."PAUSAS_SLA_CHAMADOS"'::regclass AND conname = 'PAUSAS_SLA_CHAMADOS_encerramento_check') THEN
    ALTER TABLE public."PAUSAS_SLA_CHAMADOS" ADD CONSTRAINT "PAUSAS_SLA_CHAMADOS_encerramento_check" CHECK ((encerrado_em IS NULL AND id_usuario_fim IS NULL) OR (encerrado_em IS NOT NULL AND id_usuario_fim IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public."PAUSAS_SLA_CHAMADOS"'::regclass AND conname = 'PAUSAS_SLA_CHAMADOS_motivo_check') THEN
    ALTER TABLE public."PAUSAS_SLA_CHAMADOS" ADD CONSTRAINT "PAUSAS_SLA_CHAMADOS_motivo_check" CHECK (length(btrim(motivo)) > 0);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "PAUSAS_SLA_CHAMADOS_uma_pausa_aberta_idx" ON public."PAUSAS_SLA_CHAMADOS" (id_chamado) WHERE encerrado_em IS NULL;
CREATE INDEX IF NOT EXISTS "PAUSAS_SLA_CHAMADOS_chamado_inicio_idx" ON public."PAUSAS_SLA_CHAMADOS" (id_chamado, iniciado_em);
ALTER TABLE public."PAUSAS_SLA_CHAMADOS" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public."CHAMADOS_DOCUMENTACOES" (
  id_chamado bigint NOT NULL,
  id_documentacao bigint NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "CHAMADOS_DOCUMENTACOES_pkey" PRIMARY KEY (id_chamado, id_documentacao),
  CONSTRAINT "CHAMADOS_DOCUMENTACOES_chamado_fkey" FOREIGN KEY (id_chamado) REFERENCES public."CHAMADOS"(id) ON DELETE NO ACTION,
  CONSTRAINT "CHAMADOS_DOCUMENTACOES_documentacao_fkey" FOREIGN KEY (id_documentacao) REFERENCES public."DOCUMENTACOES"(id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS "CHAMADOS_DOCUMENTACOES_documentacao_idx" ON public."CHAMADOS_DOCUMENTACOES" (id_documentacao);
ALTER TABLE public."CHAMADOS_DOCUMENTACOES" ENABLE ROW LEVEL SECURITY;

-- A coluna permanece para compatibilidade do schema. A aplicação nova não a lê.
-- Copiar e limpar juntos evita que uma execução futura restaure vínculos removidos.
LOCK TABLE public."DOCUMENTACOES" IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO public."CHAMADOS_DOCUMENTACOES" (id_chamado, id_documentacao)
SELECT id_chamado, id FROM public."DOCUMENTACOES" WHERE id_chamado IS NOT NULL
ON CONFLICT (id_chamado, id_documentacao) DO NOTHING;
UPDATE public."DOCUMENTACOES" SET id_chamado = NULL WHERE id_chamado IS NOT NULL;

COMMIT;
