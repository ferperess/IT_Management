DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."PAUSAS_SLA_CHAMADOS"'::regclass
      AND conname = 'PAUSAS_SLA_CHAMADOS_intervalo_check'
  ) THEN
    ALTER TABLE public."PAUSAS_SLA_CHAMADOS"
      ADD CONSTRAINT "PAUSAS_SLA_CHAMADOS_intervalo_check"
      CHECK (encerrado_em IS NULL OR encerrado_em >= iniciado_em);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."PAUSAS_SLA_CHAMADOS"'::regclass
      AND conname = 'PAUSAS_SLA_CHAMADOS_encerramento_check'
  ) THEN
    ALTER TABLE public."PAUSAS_SLA_CHAMADOS"
      ADD CONSTRAINT "PAUSAS_SLA_CHAMADOS_encerramento_check"
      CHECK ((encerrado_em IS NULL AND id_usuario_fim IS NULL)
        OR (encerrado_em IS NOT NULL AND id_usuario_fim IS NOT NULL));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "PAUSAS_SLA_CHAMADOS_uma_pausa_aberta_idx"
  ON public."PAUSAS_SLA_CHAMADOS" (id_chamado)
  WHERE encerrado_em IS NULL;
CREATE INDEX IF NOT EXISTS "PAUSAS_SLA_CHAMADOS_chamado_inicio_idx"
  ON public."PAUSAS_SLA_CHAMADOS" (id_chamado, iniciado_em);
CREATE INDEX IF NOT EXISTS "CHAMADOS_DOCUMENTACOES_documentacao_idx"
  ON public."CHAMADOS_DOCUMENTACOES" (id_documentacao);

ALTER TABLE public."PAUSAS_SLA_CHAMADOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CHAMADOS_DOCUMENTACOES" ENABLE ROW LEVEL SECURITY;