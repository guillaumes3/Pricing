BEGIN;

CREATE TABLE IF NOT EXISTS public.product_competitor_links (
  id BIGSERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  competitor_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_product_competitor_links_product_competitor UNIQUE (product_id, competitor_id),
  CONSTRAINT chk_product_competitor_links_url_not_blank CHECK (LENGTH(BTRIM(url)) > 0)
);

ALTER TABLE public.product_competitor_links
  ADD COLUMN IF NOT EXISTS product_id INTEGER,
  ADD COLUMN IF NOT EXISTS competitor_id INTEGER,
  ADD COLUMN IF NOT EXISTS url TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE public.product_competitor_links
  ALTER COLUMN product_id SET NOT NULL,
  ALTER COLUMN competitor_id SET NOT NULL,
  ALTER COLUMN url SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_product_competitor_links_product'
      AND conrelid = 'public.product_competitor_links'::regclass
  ) THEN
    ALTER TABLE public.product_competitor_links
      ADD CONSTRAINT fk_product_competitor_links_product
      FOREIGN KEY (product_id)
      REFERENCES public.products(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_product_competitor_links_competitor'
      AND conrelid = 'public.product_competitor_links'::regclass
  ) THEN
    ALTER TABLE public.product_competitor_links
      ADD CONSTRAINT fk_product_competitor_links_competitor
      FOREIGN KEY (competitor_id)
      REFERENCES public.competitors(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_product_competitor_links_product_competitor'
      AND conrelid = 'public.product_competitor_links'::regclass
  ) THEN
    ALTER TABLE public.product_competitor_links
      ADD CONSTRAINT uq_product_competitor_links_product_competitor
      UNIQUE (product_id, competitor_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_product_competitor_links_url_not_blank'
      AND conrelid = 'public.product_competitor_links'::regclass
  ) THEN
    ALTER TABLE public.product_competitor_links
      ADD CONSTRAINT chk_product_competitor_links_url_not_blank
      CHECK (LENGTH(BTRIM(url)) > 0);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_product_competitor_links_product
  ON public.product_competitor_links (product_id);

CREATE INDEX IF NOT EXISTS idx_product_competitor_links_competitor
  ON public.product_competitor_links (competitor_id);

COMMIT;
