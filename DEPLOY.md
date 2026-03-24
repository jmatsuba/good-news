# Deploying Good News (Rails)

This app is meant to run as **long-lived processes**: **Puma** for HTTP and **`bin/jobs`** for Solid Queue (ingest jobs and recurring tasks). Do **not** rely on serverless-only hosts that cannot run a job worker.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Primary PostgreSQL connection |
| `RAILS_MASTER_KEY` | Decrypts `config/credentials.yml.enc` (or use env-based secrets only) |
| `GEMINI_API_KEY` | Required for classification during ingest |
| `GEMINI_MODEL` | Optional (default `gemini-2.0-flash`) |
| `INGEST_SECRET` | Protects `/ingest` and `/admin/rejected` |
| `CRON_SECRET` | Optional second token accepted for `/ingest` (e.g. external cron) |
| `MIN_POSITIVITY`, `MAX_SENSATIONALISM`, `MAX_POLITICAL_CONTROVERSY`, `MIN_FIT_SCORE` | Classification thresholds |
| `RSS_FEED_URLS` | Optional comma-separated extra feeds |
| `ENRICH_OG_IMAGES` | Set to `true` to fetch `og:image` when RSS has no image |

Production also uses Solid Queue **separate databases** for cache, queue, and cable as generated in `config/database.yml`. Set:

- `GOOD_NEWS_DATABASE_PASSWORD` (and ensure four databases exist), **or**
- Override with the appropriate `*_DATABASE_URL` variables as described in [Rails multi-db docs](https://guides.rubyonrails.org/active_record_multiple_databases.html).

Run:

```bash
bin/rails db:prepare
```

on the server so primary, cache, queue, and cable schemas are created.

## Processes

1. **Web:** `bin/rails server` or Puma via your process manager.
2. **Jobs:** `bin/jobs` — required in production for `IngestionJob` and for [`config/recurring.yml`](config/recurring.yml) (daily ingest).

Without `bin/jobs`, enqueued ingests and recurring tasks will not run.

## Fly.io

- Create an app, attach a Postgres cluster (or external Postgres).
- Set secrets for `RAILS_MASTER_KEY`, `DATABASE_URL`, `GEMINI_API_KEY`, `INGEST_SECRET`, etc.
- Run a **web** process (`bundle exec puma`) and a **jobs** process (`bin/jobs`).
- See [Fly Rails guide](https://fly.io/docs/rails/).

## Render

- **Web Service:** build command `bundle install && bundle exec rails assets:precompile db:migrate`, start `bundle exec puma -C config/puma.rb`.
- **Background Worker:** start `bundle exec bin/jobs` (same repo, same env).
- Add managed PostgreSQL and point `DATABASE_URL` (and queue/cache URLs if split).

## Railway

- One service for the web process, one for `bin/jobs`, plus a PostgreSQL plugin.
- Set env vars on both services.

## Kamal + VPS

- Use the generated [`config/deploy.yml`](config/deploy.yml) as a starting point.
- Run at least two roles or accessories: **web** (Puma) and **jobs** (`bin/jobs`).
- Terminate TLS at your proxy (Caddy, nginx, or Kamal proxy) and enable `force_ssl` in production when appropriate.

## SSL

Terminate HTTPS at your load balancer or reverse proxy; set `config.force_ssl = true` in production when everything behind the proxy is trusted.

## Health check

Use `GET /up` for load balancer health checks.
