-- Aplicar antes de iniciar esta versão. Não exclui ativos nem escolhe entre duplicados.
BEGIN;
LOCK TABLE public."ATIVOS" IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (
    SELECT btrim(patrimonio) FROM public."ATIVOS"
    WHERE nullif(btrim(patrimonio), '') IS NOT NULL
    GROUP BY btrim(patrimonio) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existem patrimônios duplicados. Revise os registros antes de aplicar este script.';
  END IF;
END $$;
UPDATE public."ATIVOS" SET patrimonio = nullif(btrim(patrimonio), '')
WHERE patrimonio IS DISTINCT FROM nullif(btrim(patrimonio), '');
CREATE UNIQUE INDEX IF NOT EXISTS "ATIVOS_patrimonio_key" ON public."ATIVOS" (patrimonio);
-- NULL permanece permitido para cadastros antigos; a API exige patrimônio nos novos.
COMMIT;

-- Consulta para revisar conflitos, se o script for interrompido:
-- SELECT btrim(patrimonio) AS patrimonio, array_agg(id) AS ids, array_agg(nome) AS ativos
-- FROM public."ATIVOS" WHERE nullif(btrim(patrimonio), '') IS NOT NULL
-- GROUP BY btrim(patrimonio) HAVING count(*) > 1;
