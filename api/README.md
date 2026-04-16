# Pricing API (NestJS + PostgreSQL)

Service NestJS exposant l'endpoint `GET /prices/:id/history` pour retourner l'historique des prix formaté pour un graphique.

## Installation

```bash
cd api
npm install
cp .env.example .env
npm run build
npm run start:dev
```

## Variables d'environnement

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `SCRAPER_API_KEY`

## Schéma SQL de base

```bash
psql -d pricing -f sql/schema.sql
```

Le script est tolérant:
- sur un PostgreSQL avec TimescaleDB, l'extension est activée et `price_history` devient un hypertable.
- sur un PostgreSQL standard, le script continue sans erreur en table classique.

Si ton interface SQL affiche `extension "timescaledb" is not available`, ce n'est plus bloquant avec ce script.

## Migration Supabase Postgres 17 (partitionnement natif)

Pour un projet Supabase en Postgres 17.x, utilise la migration suivante (sans TimescaleDB):

- `/Users/guillaumesergent/Desktop/pricing/api/sql/migrations/2026-04-16_supabase_pg17_price_history_partitioning.sql`

Cette migration:

- convertit `public.price_history` en table partitionnée mensuellement par `recorded_at`
- garde les donnees existantes et cree une sauvegarde `public.price_history_legacy`
- tente d'activer/configurer `pg_partman` si disponible (sinon continue en mode manuel)

Execution:

1. Ouvre l'editeur SQL Supabase.
2. Colle le contenu du fichier de migration.
3. Execute le script dans une fenetre de maintenance.

Apres verification, tu peux supprimer la table de sauvegarde:

```sql
drop table if exists public.price_history_legacy;
```

## Endpoint

`GET /prices/:id/history`

### Headers requis

- `x-api-key: <SCRAPER_API_KEY>`

### Exemple de réponse

```json
{
  "productId": 42,
  "currency": "EUR",
  "points": [
    { "x": "2026-04-01T09:00:00.000Z", "y": 19.99 },
    { "x": "2026-04-08T09:00:00.000Z", "y": 17.49 }
  ],
  "summary": {
    "min": 17.49,
    "max": 19.99,
    "latest": 17.49,
    "firstRecordedAt": "2026-04-01T09:00:00.000Z",
    "lastRecordedAt": "2026-04-08T09:00:00.000Z"
  }
}
```

## Exemple cURL

```bash
curl -H "x-api-key: change-me" http://localhost:3000/prices/42/history
```
