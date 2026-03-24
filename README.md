# Good News

Rails 8 app that ingests RSS feeds, classifies articles with Google Gemini, and serves a curated “good news” homepage (Spotlight + Latest), search, tags, and article pages.

## Stack

- Ruby 3.4+, Rails 8.1, PostgreSQL, Hotwire (Turbo + Stimulus), Tailwind CSS
- Background jobs: Solid Queue in production (`bin/jobs` + recurring tasks); async adapter in development
- Ingest: `config/feeds.json` plus optional `RSS_FEED_URLS`

## Setup

1. Copy [`.env.example`](.env.example) to `.env` and set at least `DATABASE_URL` and `GEMINI_API_KEY` for full ingest.

2. Start Postgres (optional local Docker):

   ```bash
   docker compose up -d
   ```

3. Install gems and prepare the database:

   ```bash
   bundle install
   bin/rails db:prepare
   ```

4. Run the app:

   ```bash
   bin/dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Ingest

- **Development:** `GET` or `POST` `/ingest` with `Authorization: Bearer <INGEST_SECRET>` or `?secret=` runs ingestion **synchronously** and returns JSON or HTML (`&ui=1`).
- **Production:** the same endpoints **enqueue** [`IngestionJob`](app/jobs/ingestion_job.rb); you must run **`bin/jobs`** (or your platform’s worker) so jobs execute. HTML `ui=1` explains that the job was queued.

Recurring ingest is configured in [`config/recurring.yml`](config/recurring.yml) for production (daily at midnight, server time).

## Admin

- Rejected samples (last 50): `/admin/rejected?secret=<INGEST_SECRET>` (requires `INGEST_SECRET` set).

## Deployment

See [DEPLOY.md](DEPLOY.md) for Fly.io, Render, Railway, and Kamal-style setups (Puma + `bin/jobs` + PostgreSQL).

## Test database

Tests expect `DATABASE_URL_TEST` or the default URL in `config/database.yml` (e.g. `goodnews_test` on port 5433). Create the DB with:

```bash
RAILS_ENV=test bin/rails db:create db:migrate
```

## Migrating from the old Prisma app

This schema uses **UUID** primary keys. The previous Next.js app used Prisma **cuid** strings. To reuse an existing Postgres database you must either **copy/transform** rows (map old IDs to new UUIDs and rewrite foreign keys) or start from an empty database and re-ingest.
