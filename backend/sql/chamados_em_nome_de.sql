-- Aplicar no Supabase antes de iniciar a nova versão e gerar o Prisma Client.
BEGIN;
ALTER TABLE public."CHAMADOS" ADD COLUMN IF NOT EXISTS id_aberto_por bigint;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."CHAMADOS"'::regclass
      AND conname = 'CHAMADOS_id_aberto_por_fkey'
  ) THEN
    ALTER TABLE public."CHAMADOS" ADD CONSTRAINT "CHAMADOS_id_aberto_por_fkey"
      FOREIGN KEY (id_aberto_por) REFERENCES public."USUARIOS"(id)
      ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;
-- Chamados antigos permanecem com autor nulo, sem presumir autoria histórica.
COMMIT;
