# Deploying Good News (Rails)

This app is meant to run as **long-lived processes**: **Puma** for HTTP and **`bin/jobs`** for Solid Queue (ingest jobs and recurring tasks). Do **not** rely on serverless-only hosts that cannot run a job worker.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Primary PostgreSQL connection |
| `RAILS_MASTER_KEY` | Decrypts `config/credentials.yml.enc` (or use env-based secrets only) |
| `GEMINI_API_KEY` | Required for classification during ingest |
| `GEMINI_MODEL` | Optional (default `gemini-2.5-flash`) |
| `INGEST_SECRET` | Protects `/admin/rejected` |
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

Without `bin/jobs`, recurring `IngestionJob` tasks and other Solid Queue work will not run. You can still run `bin/rails articles:ingest` synchronously (e.g. from cron) without a job worker.

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

## Dokku

Dokku runs the app on your own server via Git push or CI. Use the **Dockerfile** in this repo (recommended) so the image matches other container deploys.

### App and database

1. **Create the app and Postgres service** (replace `good-news` with your app name):

   ```bash
   dokku apps:create good-news
   dokku postgres:create good-news-db
   dokku postgres:link good-news-db good-news
   ```

   Linking sets `DATABASE_URL` on the app.

2. **Multiple databases:** Production uses a primary DB plus Solid Queue / cache / cable DBs (see [`config/database.yml`](config/database.yml)). The linked Postgres plugin creates one database. Create the extra databases on **the same** instance (names must match `database.yml`, e.g. `good_news_production_cache`, `good_news_production_queue`, `good_news_production_cable`) and grant the app role from `DATABASE_URL` access to all of them. Easiest when the role differs from `good_news`: set `CACHE_DATABASE_URL`, `QUEUE_DATABASE_URL`, and `CABLE_DATABASE_URL` (see [Rails multi-db docs](https://guides.rubyonrails.org/active_record_multiple_databases.html)). Alternatively, align Postgres users with `database.yml` and use `GOOD_NEWS_DATABASE_PASSWORD` as in the environment variables section above.

3. **Configure secrets** (at minimum `RAILS_MASTER_KEY`, `GEMINI_API_KEY`, `INGEST_SECRET`, and anything else in the table):

   ```bash
   dokku config:set good-news RAILS_MASTER_KEY=... GEMINI_API_KEY=... INGEST_SECRET=...
   ```

4. **Builder:** If Dokku does not pick the Dockerfile automatically:

   ```bash
   dokku builder-dockerfile:set good-news Dockerfile
   ```

### Web and job processes

The repo root **`Procfile`** defines three stanzas:

- **`release`** — runs `./bin/rails db:prepare` once per deploy (after the image is built, before new containers are scheduled). This mirrors Heroku-style release phase behavior.
- **`web`** — `./bin/thrust ./bin/rails server` (same as the image default `CMD`).
- **`worker`** — `./bin/jobs` for Solid Queue.

Scale web and worker (leave `release` at its default; do not scale it):

```bash
dokku ps:scale good-news web=1 worker=1
```

The Docker entrypoint also runs `db:prepare` when the **web** process starts, so the DB stays in sync even without the `release` line. Optionally run a one-off:

```bash
dokku run good-news bin/rails db:prepare
```

**Zero-downtime checks:** [`app.json`](app.json) declares a startup healthcheck for **`/up`** on **port 80** (Thruster’s HTTP port). If your Dokku scheduler does not use `app.json` healthchecks, rely on the default checks or configure them on the server.

To avoid HTTP-style checks on the worker (optional):

```bash
dokku checks:skip good-news worker
```

### TLS and deploy

- HTTPS: use [dokku-letsencrypt](https://github.com/dokku/dokku-letsencrypt) (or terminate TLS upstream).

- Deploy:

  ```bash
  git remote add dokku dokku@YOUR_HOST:good-news
  git push dokku main          # use main:master if the Git deploy branch on the server is still master
  ```

Health checks can target [`GET /up`](#health-check) once the proxy is configured.

## Kamal + VPS

- Use the generated [`config/deploy.yml`](config/deploy.yml) as a starting point.
- Run at least two roles or accessories: **web** (Puma) and **jobs** (`bin/jobs`).
- Terminate TLS at your proxy (Caddy, nginx, or Kamal proxy) and enable `force_ssl` in production when appropriate.

## SSL

Terminate HTTPS at your load balancer or reverse proxy; set `config.force_ssl = true` in production when everything behind the proxy is trusted.

## Health check

Use `GET /up` for load balancer health checks.
