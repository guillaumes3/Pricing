# Pricing Dynamic Engine

## Supabase Postgres 17 migration (without TimescaleDB)

If your Supabase project runs on Postgres 17.x, do not use `CREATE EXTENSION timescaledb`.

Use this migration instead:

- `/Users/guillaumesergent/Desktop/pricing/sql/migrations/2026-04-16_supabase_pg17_price_history_partitioning.sql`

What it does:

- converts `public.price_history` to native monthly partitioning on `recorded_at`
- keeps data in place and preserves constraints/indexes used by the API
- keeps a rollback copy in `public.price_history_legacy`
- enables/configures `pg_partman` when available, otherwise continues with manual partitions

Recommended run order:

```sql
-- 1) check your server major version
show server_version;

-- 2) run the migration file content in Supabase SQL Editor
```

After validation, you can remove the backup table manually:

```sql
drop table if exists public.price_history_legacy;
```
