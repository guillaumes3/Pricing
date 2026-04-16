BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_available_extensions
    WHERE name = 'timescaledb'
  ) THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS timescaledb;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'TimescaleDB available, but permission denied to create extension.';
    END;
  ELSE
    RAISE NOTICE 'TimescaleDB extension is not available on this PostgreSQL instance.';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS competitors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL UNIQUE,
  country_code CHAR(2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  ean TEXT UNIQUE,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  canonical_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  competitor_id INTEGER,
  product_id INTEGER NOT NULL,
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
  list_price NUMERIC(12, 2) CHECK (list_price IS NULL OR list_price >= 0),
  availability BOOLEAN,
  source_url TEXT,
  recorded_at TIMESTAMPTZ NOT NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_price_history_series UNIQUE (competitor_id, product_id, recorded_at)
);

ALTER TABLE price_history
  ADD COLUMN IF NOT EXISTS competitor_id INTEGER,
  ADD COLUMN IF NOT EXISTS list_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS availability BOOLEAN,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ;

ALTER TABLE price_history
  ALTER COLUMN scraped_at SET DEFAULT NOW();

UPDATE price_history
SET scraped_at = NOW()
WHERE scraped_at IS NULL;

ALTER TABLE price_history
  ALTER COLUMN scraped_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_price_history_series'
  ) THEN
    BEGIN
      ALTER TABLE price_history
      ADD CONSTRAINT uq_price_history_series UNIQUE (competitor_id, product_id, recorded_at);
    EXCEPTION
      WHEN unique_violation THEN
        RAISE NOTICE 'Duplicate rows detected, skipping unique constraint uq_price_history_series.';
    END;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_price_history_competitor'
  ) THEN
    BEGIN
      ALTER TABLE price_history
      ADD CONSTRAINT fk_price_history_competitor
      FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN foreign_key_violation THEN
        RAISE NOTICE 'Existing rows prevent fk_price_history_competitor creation.';
    END;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_price_history_product'
  ) THEN
    BEGIN
      ALTER TABLE price_history
      ADD CONSTRAINT fk_price_history_product
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN foreign_key_violation THEN
        RAISE NOTICE 'Existing rows prevent fk_price_history_product creation.';
    END;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_price_history_product_recorded_at
  ON price_history (product_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_competitor_product_recorded_at
  ON price_history (competitor_id, product_id, recorded_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'create_hypertable'
  ) THEN
    PERFORM create_hypertable('price_history', 'recorded_at', if_not_exists => TRUE);
  ELSE
    RAISE NOTICE 'create_hypertable not found, keeping regular PostgreSQL table.';
  END IF;
END
$$;

COMMIT;
