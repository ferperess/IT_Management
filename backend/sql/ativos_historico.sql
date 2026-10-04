BEGIN;

CREATE TABLE IF NOT EXISTS public."HISTORICO_ATIVOS" (
  id bigserial PRIMARY KEY,
  comentario text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  id_ativo bigint NOT NULL,
  id_usuario bigint NOT NULL,
  CONSTRAINT "HISTORICO_ATIVOS_ativo_fkey" FOREIGN KEY (id_ativo) REFERENCES public."ATIVOS"(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "HISTORICO_ATIVOS_usuario_fkey" FOREIGN KEY (id_usuario) REFERENCES public."USUARIOS"(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "HISTORICO_ATIVOS_ativo_criado_idx"
  ON public."HISTORICO_ATIVOS" (id_ativo, criado_em);

COMMIT;
