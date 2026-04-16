BEGIN;

-- 1) TimescaleDB must be available for this migration.
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 2) Ensure scraped_at exists and is usable as the time partition key.
ALTER TABLE public.price_history
  ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ;

UPDATE public.price_history
SET scraped_at = COALESCE(scraped_at, recorded_at, NOW())
WHERE scraped_at IS NULL;

ALTER TABLE public.price_history
  ALTER COLUMN scraped_at SET DEFAULT NOW(),
  ALTER COLUMN scraped_at SET NOT NULL;

-- 3) Unique/primary constraints on hypertables must include the partitioning key.
--    We replace incompatible keys safely.
DO $constraints$
DECLARE
  pkey_name text;
  pkey_has_scraped_at boolean;
  uq_exists boolean;
  uq_has_scraped_at boolean;
BEGIN
  SELECT con.conname,
         EXISTS (
           SELECT 1
           FROM unnest(con.conkey) AS attnum
           JOIN pg_attribute att
             ON att.attrelid = con.conrelid
            AND att.attnum = attnum
           WHERE att.attname = 'scraped_at'
         )
  INTO pkey_name, pkey_has_scraped_at
  FROM pg_constraint con
  WHERE con.conrelid = 'public.price_history'::regclass
    AND con.contype = 'p'
  LIMIT 1;

  IF pkey_name IS NOT NULL AND NOT pkey_has_scraped_at THEN
    EXECUTE format('ALTER TABLE public.price_history DROP CONSTRAINT %I', pkey_name);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.price_history'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.price_history
      ADD CONSTRAINT price_history_pkey PRIMARY KEY (id, scraped_at);
  END IF;

  SELECT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conrelid = 'public.price_history'::regclass
             AND conname = 'uq_price_history_series'
         )
  INTO uq_exists;

  IF uq_exists THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint con
      JOIN unnest(con.conkey) AS attnum ON TRUE
      JOIN pg_attribute att
        ON att.attrelid = con.conrelid
       AND att.attnum = attnum
      WHERE con.conrelid = 'public.price_history'::regclass
        AND con.conname = 'uq_price_history_series'
        AND att.attname = 'scraped_at'
    )
    INTO uq_has_scraped_at;

    IF NOT uq_has_scraped_at THEN
      ALTER TABLE public.price_history DROP CONSTRAINT uq_price_history_series;
      ALTER TABLE public.price_history
        ADD CONSTRAINT uq_price_history_series
        UNIQUE (competitor_id, product_id, recorded_at, scraped_at);
    END IF;
  ELSE
    ALTER TABLE public.price_history
      ADD CONSTRAINT uq_price_history_series
      UNIQUE (competitor_id, product_id, recorded_at, scraped_at);
  END IF;
END
$constraints$;

-- 4) Convert to hypertable partitioned on scraped_at.
SELECT create_hypertable(
  'public.price_history',
  'scraped_at',
  chunk_time_interval => INTERVAL '7 days',
  migrate_data => TRUE,
  if_not_exists => TRUE,
  create_default_indexes => FALSE
);

-- 5) Indexes tuned for competitor/product/time filtering.
CREATE INDEX IF NOT EXISTS idx_price_history_competitor_scraped_at
  ON public.price_history (competitor_id, scraped_at DESC, product_id)
  INCLUDE (price, currency, availability);

CREATE INDEX IF NOT EXISTS idx_price_history_competitor_product_scraped_at
  ON public.price_history (competitor_id, product_id, scraped_at DESC)
  INCLUDE (price, list_price, availability);

CREATE INDEX IF NOT EXISTS idx_price_history_product_scraped_at
  ON public.price_history (product_id, scraped_at DESC)
  INCLUDE (price, currency, competitor_id);

-- 6) Compression + retention on raw data (6 months), while keeping aggregates.
ALTER TABLE public.price_history SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'product_id, competitor_id',
  timescaledb.compress_orderby = 'scraped_at DESC'
);

SELECT add_compression_policy(
  'public.price_history',
  compress_after => INTERVAL '30 days',
  if_not_exists => TRUE
);

SELECT add_retention_policy(
  'public.price_history',
  drop_after => INTERVAL '6 months',
  if_not_exists => TRUE
);

-- 7) Continuous aggregate for daily min/avg/max by product_id.
CREATE MATERIALIZED VIEW IF NOT EXISTS public.daily_price_stats
WITH (timescaledb.continuous) AS
SELECT
  time_bucket(INTERVAL '1 day', scraped_at) AS day_bucket,
  product_id,
  MIN(price) AS min_price,
  AVG(price)::NUMERIC(12,2) AS avg_price,
  MAX(price) AS max_price
FROM public.price_history
GROUP BY 1, 2
WITH NO DATA;

-- Keep serving from precomputed data even if old raw chunks are dropped.
ALTER MATERIALIZED VIEW public.daily_price_stats
  SET (timescaledb.materialized_only = TRUE);

CREATE INDEX IF NOT EXISTS idx_daily_price_stats_product_day
  ON public.daily_price_stats (product_id, day_bucket DESC);

SELECT add_continuous_aggregate_policy(
  'public.daily_price_stats',
  start_offset => INTERVAL '6 months',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '15 minutes',
  if_not_exists => TRUE
);

-- Optional first backfill to warm the cache.
CALL refresh_continuous_aggregate(
  'public.daily_price_stats',
  NOW() - INTERVAL '6 months',
  NOW()
);

-- 8) Standardized product upsert for scraper ingestion.
CREATE OR REPLACE FUNCTION public.upsert_product(
  p_sku TEXT,
  p_name TEXT,
  p_ean TEXT DEFAULT NULL,
  p_brand TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_canonical_url TEXT DEFAULT NULL
)
RETURNS TABLE(product_id INTEGER)
LANGUAGE sql
AS $$
  INSERT INTO public.products (sku, name, ean, brand, category, canonical_url, updated_at)
  VALUES (p_sku, p_name, p_ean, p_brand, p_category, p_canonical_url, NOW())
  ON CONFLICT (sku)
  DO UPDATE SET
    name = CASE
      WHEN LENGTH(EXCLUDED.name) > LENGTH(public.products.name) THEN EXCLUDED.name
      ELSE public.products.name
    END,
    ean = COALESCE(public.products.ean, EXCLUDED.ean),
    brand = COALESCE(EXCLUDED.brand, public.products.brand),
    category = COALESCE(EXCLUDED.category, public.products.category),
    canonical_url = COALESCE(EXCLUDED.canonical_url, public.products.canonical_url),
    updated_at = NOW()
  RETURNING public.products.id;
$$;

COMMIT;
