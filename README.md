# Good News

Rails 8 app that ingests RSS feeds, classifies articles with Google Gemini, and serves a curated “good news” homepage (Spotlight + Latest), search, tags, and article pages.

## Stack

- Ruby 3.4+, Rails 8.1, PostgreSQL, Hotwire (Turbo + Stimulus), Tailwind CSS
- Background jobs: Solid Queue in production (`bin/jobs` + recurring tasks); async adapter in development
- Ingest: `config/feeds.json` plus optional `RSS_FEED_URLS`

## Setup

1. Install and start PostgreSQL (Homebrew):

   ```bash
   brew install postgresql@16
   brew services start postgresql@16
   ```

   Create the app databases (defaults use your macOS username on `127.0.0.1:5432`):

   ```bash
   createdb goodnews
   createdb goodnews_test
   ```

2. Copy [`.env.example`](.env.example) to `.env`. Set `GEMINI_API_KEY` for full ingest. Leave `DATABASE_URL` unset to use the defaults in `config/database.yml`, or set it if you use a non-default role or host.

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

Run ingestion manually or from a scheduler:

```bash
bin/rails articles:ingest
```

This calls [`Ingestion::Runner`](app/services/ingestion/runner.rb) synchronously. Production also runs [`IngestionJob`](app/jobs/ingestion_job.rb) on a schedule via [`config/recurring.yml`](config/recurring.yml) (daily at midnight, server time); keep **`bin/jobs`** running so those jobs execute.

## Admin

- Rejected samples (last 50): `/admin/rejected?secret=<INGEST_SECRET>` (requires `INGEST_SECRET` set).

## Deployment

See [DEPLOY.md](DEPLOY.md) for Dokku, Fly.io, Render, and Railway setups (Puma + `bin/jobs` + PostgreSQL).

## Test database

Tests expect `DATABASE_URL_TEST` or the default URL in `config/database.yml` (e.g. `goodnews_test` on port 5432). Create the DB with:

```bash
RAILS_ENV=test bin/rails db:create db:migrate
```
