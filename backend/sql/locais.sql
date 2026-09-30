BEGIN;

CREATE TABLE IF NOT EXISTS public."LOCAIS" (
  id bigserial PRIMARY KEY,
  nome varchar NOT NULL UNIQUE,
  status varchar NOT NULL DEFAULT 'ATIVO',
  CONSTRAINT "LOCAIS_nome_check" CHECK (length(btrim(nome)) > 0),
  CONSTRAINT "LOCAIS_status_check" CHECK (status IN ('ATIVO', 'INATIVO'))
);
ALTER TABLE public."LOCAIS" ENABLE ROW LEVEL SECURITY;

INSERT INTO public."LOCAIS" (nome) VALUES
  ('Secretaria'), ('Coordenação'),
  ('Laboratório 1'), ('Laboratório 2'), ('Laboratório 3'),
  ('Laboratório 4'), ('Laboratório 5'),
  ('Sala 7'), ('Sala 8'), ('Sala 9'), ('Sala 10')
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE public."ATIVOS" ADD COLUMN IF NOT EXISTS id_local bigint;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public."ATIVOS"'::regclass AND conname = 'ATIVOS_id_local_fkey') THEN
    ALTER TABLE public."ATIVOS" ADD CONSTRAINT "ATIVOS_id_local_fkey"
      FOREIGN KEY (id_local) REFERENCES public."LOCAIS"(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;

-- Preserva locais antigos fora da lista como inativos, para revisão dos responsáveis.
INSERT INTO public."LOCAIS" (nome, status)
SELECT DISTINCT btrim(localizacao), 'INATIVO' FROM public."ATIVOS"
WHERE localizacao IS NOT NULL AND length(btrim(localizacao)) > 0
ON CONFLICT (nome) DO NOTHING;

UPDATE public."ATIVOS" a SET id_local = l.id
FROM public."LOCAIS" l
WHERE a.id_local IS NULL AND btrim(a.localizacao) = l.nome;
-- A coluna de texto antiga é preservada para compatibilidade e conferência.
COMMIT;

-- Exemplos de manutenção (execute separadamente quando necessário):
-- INSERT INTO public."LOCAIS" (nome) VALUES ('Biblioteca');
-- UPDATE public."LOCAIS" SET status = 'INATIVO' WHERE id = 1;
-- UPDATE public."LOCAIS" SET nome = 'Nova Secretaria' WHERE id = 1;
