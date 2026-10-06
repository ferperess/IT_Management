BEGIN;

ALTER TABLE public."CHAMADOS"
  ADD COLUMN IF NOT EXISTS id_local bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public."CHAMADOS"'::regclass
      AND conname = 'CHAMADOS_id_local_fkey'
  ) THEN
    ALTER TABLE public."CHAMADOS"
      ADD CONSTRAINT "CHAMADOS_id_local_fkey"
      FOREIGN KEY (id_local)
      REFERENCES public."LOCAIS"(id)
      ON DELETE NO ACTION
      ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CHAMADOS_id_local_idx"
  ON public."CHAMADOS" (id_local);

-- Recupera a localização dos chamados antigos que já possuem ativo vinculado.
UPDATE public."CHAMADOS" AS c
SET id_local = a.id_local
FROM public."ATIVOS" AS a
WHERE c.id_ativo = a.id
  AND c.id_local IS NULL
  AND a.id_local IS NOT NULL;

COMMIT;
