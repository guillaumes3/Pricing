BEGIN;

DO $migration$
DECLARE
  parent_is_partitioned boolean;
  legacy_exists boolean;
  min_ts timestamptz;
  max_ts timestamptz;
  legacy_time_col text;
  legacy_scraped_col text;
  has_id boolean;
  has_competitor_id boolean;
  has_product_id boolean;
  has_price boolean;
  has_currency boolean;
  has_list_price boolean;
  has_availability boolean;
  has_source_url boolean;
  id_expr text;
  id_sort_expr text;
  competitor_expr text;
  product_expr text;
  price_expr text;
  currency_expr text;
  list_price_expr text;
  availability_expr text;
  source_url_expr text;
  recorded_expr text;
  scraped_expr text;
  part_start date;
  part_stop date;
  month_start date;
  month_end date;
  partition_name text;
BEGIN
  IF to_regclass('public.price_history') IS NULL THEN
    RAISE EXCEPTION 'Table public.price_history does not exist. Run the base schema before this migration.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_partitioned_table pt
    JOIN pg_class c ON c.oid = pt.partrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'price_history'
  )
  INTO parent_is_partitioned;

  IF parent_is_partitioned THEN
    RAISE NOTICE 'public.price_history is already partitioned. Skipping conversion.';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'price_history_legacy'
  )
  INTO legacy_exists;

  IF legacy_exists THEN
    RAISE EXCEPTION 'public.price_history_legacy already exists. Inspect previous migration attempt before retrying.';
  END IF;

  ALTER TABLE public.price_history RENAME TO price_history_legacy;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.price_history_legacy'::regclass
      AND conname = 'price_history_pkey'
  ) THEN
    ALTER TABLE public.price_history_legacy RENAME CONSTRAINT price_history_pkey TO price_history_legacy_pkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.price_history_legacy'::regclass
      AND conname = 'uq_price_history_series'
  ) THEN
    ALTER TABLE public.price_history_legacy RENAME CONSTRAINT uq_price_history_series TO uq_price_history_series_legacy;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.price_history_legacy'::regclass
      AND conname = 'fk_price_history_competitor'
  ) THEN
    ALTER TABLE public.price_history_legacy RENAME CONSTRAINT fk_price_history_competitor TO fk_price_history_competitor_legacy;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.price_history_legacy'::regclass
      AND conname = 'fk_price_history_product'
  ) THEN
    ALTER TABLE public.price_history_legacy RENAME CONSTRAINT fk_price_history_product TO fk_price_history_product_legacy;
  END IF;

  ALTER INDEX IF EXISTS public.idx_price_history_product_recorded_at
    RENAME TO idx_price_history_product_recorded_at_legacy;

  ALTER INDEX IF EXISTS public.idx_price_history_competitor_product_recorded_at
    RENAME TO idx_price_history_competitor_product_recorded_at_legacy;

  CREATE SEQUENCE IF NOT EXISTS public.price_history_id_seq;

  CREATE TABLE public.price_history (
    id integer NOT NULL DEFAULT nextval('public.price_history_id_seq'::regclass),
    competitor_id integer,
    product_id integer NOT NULL,
    price numeric(12, 2) NOT NULL CHECK (price >= 0),
    currency varchar(8) NOT NULL DEFAULT 'EUR',
    list_price numeric(12, 2) CHECK (list_price IS NULL OR list_price >= 0),
    availability boolean,
    source_url text,
    recorded_at timestamptz NOT NULL,
    scraped_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT price_history_pkey PRIMARY KEY (id, recorded_at),
    CONSTRAINT uq_price_history_series UNIQUE (competitor_id, product_id, recorded_at),
    CONSTRAINT fk_price_history_competitor FOREIGN KEY (competitor_id) REFERENCES public.competitors(id) ON DELETE CASCADE,
    CONSTRAINT fk_price_history_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE
  ) PARTITION BY RANGE (recorded_at);

  IF to_regclass('public.price_history_id_seq') IS NOT NULL THEN
    EXECUTE 'ALTER SEQUENCE public.price_history_id_seq OWNED BY public.price_history.id';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'price_history_legacy'
      AND column_name = 'id'
  )
  INTO has_id;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'price_history_legacy'
      AND column_name = 'competitor_id'
  )
  INTO has_competitor_id;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'price_history_legacy'
      AND column_name = 'product_id'
  )
  INTO has_product_id;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'price_history_legacy'
      AND column_name = 'price'
  )
  INTO has_price;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'price_history_legacy'
      AND column_name = 'currency'
  )
  INTO has_currency;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'price_history_legacy'
      AND column_name = 'list_price'
  )
  INTO has_list_price;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'price_history_legacy'
      AND column_name = 'availability'
  )
  INTO has_availability;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'price_history_legacy'
      AND column_name = 'source_url'
  )
  INTO has_source_url;

  SELECT c.column_name
  INTO legacy_time_col
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'price_history_legacy'
    AND c.column_name IN ('recorded_at', 'scraped_at', 'created_at', 'updated_at')
  ORDER BY CASE c.column_name
    WHEN 'recorded_at' THEN 1
    WHEN 'scraped_at' THEN 2
    WHEN 'created_at' THEN 3
    WHEN 'updated_at' THEN 4
    ELSE 5
  END
  LIMIT 1;

  SELECT c.column_name
  INTO legacy_scraped_col
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'price_history_legacy'
    AND c.column_name IN ('scraped_at', 'recorded_at', 'created_at', 'updated_at')
  ORDER BY CASE c.column_name
    WHEN 'scraped_at' THEN 1
    WHEN 'recorded_at' THEN 2
    WHEN 'created_at' THEN 3
    WHEN 'updated_at' THEN 4
    ELSE 5
  END
  LIMIT 1;

  IF NOT has_product_id THEN
    RAISE EXCEPTION 'Column product_id is required in public.price_history_legacy.';
  END IF;

  IF NOT has_price THEN
    RAISE EXCEPTION 'Column price is required in public.price_history_legacy.';
  END IF;

  id_expr := CASE
    WHEN has_id THEN 'COALESCE(id::integer, nextval(''public.price_history_id_seq''::regclass))'
    ELSE 'nextval(''public.price_history_id_seq''::regclass)'
  END;
  id_sort_expr := CASE WHEN has_id THEN 'id::integer' ELSE '1' END;
  competitor_expr := CASE WHEN has_competitor_id THEN 'competitor_id::integer' ELSE 'NULL::integer' END;
  product_expr := 'product_id::integer';
  price_expr := 'price::numeric(12, 2)';
  currency_expr := CASE WHEN has_currency THEN 'COALESCE(currency::varchar, ''EUR'')' ELSE '''EUR''::varchar' END;
  list_price_expr := CASE WHEN has_list_price THEN 'list_price::numeric(12, 2)' ELSE 'NULL::numeric(12, 2)' END;
  availability_expr := CASE
    WHEN has_availability THEN
      'CASE
         WHEN availability IS NULL THEN NULL
         WHEN lower(availability::text) IN (''true'', ''t'', ''1'', ''yes'', ''y'', ''in_stock'', ''available'', ''en stock'', ''disponible'') THEN true
         WHEN lower(availability::text) IN (''false'', ''f'', ''0'', ''no'', ''n'', ''out_of_stock'', ''unavailable'', ''rupture'', ''indisponible'') THEN false
         ELSE NULL
       END'
    ELSE 'NULL::boolean'
  END;
  source_url_expr := CASE WHEN has_source_url THEN 'source_url::text' ELSE 'NULL::text' END;
  recorded_expr := CASE
    WHEN legacy_time_col IS NOT NULL THEN format('%I::timestamptz', legacy_time_col)
    ELSE 'NOW()'
  END;
  scraped_expr := CASE
    WHEN legacy_scraped_col IS NOT NULL THEN format('%I::timestamptz', legacy_scraped_col)
    WHEN legacy_time_col IS NOT NULL THEN format('%I::timestamptz', legacy_time_col)
    ELSE 'NOW()'
  END;

  IF legacy_time_col IS NULL THEN
    min_ts := date_trunc('month', now())::timestamptz;
    max_ts := min_ts;
  ELSE
    EXECUTE format(
      'SELECT min(%I::timestamptz), max(%I::timestamptz) FROM public.price_history_legacy',
      legacy_time_col,
      legacy_time_col
    )
    INTO min_ts, max_ts;

    IF min_ts IS NULL THEN
      min_ts := date_trunc('month', now())::timestamptz;
      max_ts := min_ts;
    END IF;
  END IF;

  part_start := (date_trunc('month', min_ts) - interval '1 month')::date;
  part_stop := (date_trunc('month', max_ts) + interval '7 month')::date;

  month_start := part_start;
  WHILE month_start < part_stop LOOP
    month_end := (month_start + interval '1 month')::date;
    partition_name := format('price_history_p%s', to_char(month_start, 'YYYYMM'));

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.price_history FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      month_start::timestamptz,
      month_end::timestamptz
    );

    month_start := month_end;
  END LOOP;

  EXECUTE format(
    $sql$
    INSERT INTO public.price_history (
      id,
      competitor_id,
      product_id,
      price,
      currency,
      list_price,
      availability,
      source_url,
      recorded_at,
      scraped_at
    )
    SELECT
      ranked.id,
      ranked.competitor_id,
      ranked.product_id,
      ranked.price,
      ranked.currency,
      ranked.list_price,
      ranked.availability,
      ranked.source_url,
      ranked.recorded_at,
      ranked.scraped_at
    FROM (
      SELECT
        %s AS id,
        %s AS competitor_id,
        %s AS product_id,
        %s AS price,
        %s AS currency,
        %s AS list_price,
        %s AS availability,
        %s AS source_url,
        %s AS recorded_at,
        %s AS scraped_at,
        row_number() OVER (
          PARTITION BY %s, %s, %s
          ORDER BY %s DESC NULLS LAST, %s DESC
        ) AS dedupe_rank
      FROM public.price_history_legacy
    ) AS ranked
    WHERE ranked.competitor_id IS NULL
       OR ranked.dedupe_rank = 1
    ORDER BY ranked.recorded_at, ranked.id
    $sql$,
    id_expr,
    competitor_expr,
    product_expr,
    price_expr,
    currency_expr,
    list_price_expr,
    availability_expr,
    source_url_expr,
    recorded_expr,
    scraped_expr,
    competitor_expr,
    product_expr,
    recorded_expr,
    scraped_expr,
    id_sort_expr
  );

  CREATE TABLE IF NOT EXISTS public.price_history_default
    PARTITION OF public.price_history DEFAULT;

  CREATE INDEX IF NOT EXISTS idx_price_history_product_recorded_at
    ON public.price_history (product_id, recorded_at DESC);

  CREATE INDEX IF NOT EXISTS idx_price_history_competitor_product_recorded_at
    ON public.price_history (competitor_id, product_id, recorded_at DESC);

  IF to_regclass('public.price_history_id_seq') IS NOT NULL THEN
    PERFORM setval(
      'public.price_history_id_seq',
      COALESCE((SELECT max(id) FROM public.price_history), 1),
      true
    );
  END IF;
END
$migration$;

DO $partman$
DECLARE
  partman_schema text;
  parent_registered boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_available_extensions
    WHERE name = 'pg_partman'
  ) THEN
    RAISE NOTICE 'pg_partman is not available on this project. Keeping manual partition maintenance.';
    RETURN;
  END IF;

  CREATE SCHEMA IF NOT EXISTS extensions;

  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_partman WITH SCHEMA extensions;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'pg_partman is available but permission was denied to create it. Keeping manual partition maintenance.';
      RETURN;
  END;

  SELECT n.nspname
  INTO partman_schema
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'create_parent'
  ORDER BY CASE WHEN n.nspname = 'partman' THEN 0 WHEN n.nspname = 'extensions' THEN 1 ELSE 2 END
  LIMIT 1;

  IF partman_schema IS NULL THEN
    RAISE NOTICE 'pg_partman create_parent() was not found. Keeping manual partition maintenance.';
    RETURN;
  END IF;

  BEGIN
    EXECUTE format(
      $$SELECT %I.create_parent(
          p_parent_table := 'public.price_history',
          p_control := 'recorded_at',
          p_type := 'native',
          p_interval := '1 month',
          p_premake := 6
      )$$,
      partman_schema
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'create_parent() skipped: %', SQLERRM;
  END;

  BEGIN
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I.part_config WHERE parent_table = %L)',
      partman_schema,
      'public.price_history'
    )
    INTO parent_registered;

    IF parent_registered THEN
      EXECUTE format(
        'UPDATE %I.part_config
         SET infinite_time_partitions = true,
             premake = GREATEST(premake, 6),
             retention = %L,
             retention_keep_table = false
         WHERE parent_table = %L',
        partman_schema,
        '12 months',
        'public.price_history'
      );
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'pg_partman configuration skipped: %', SQLERRM;
  END;
END
$partman$;

COMMIT;
