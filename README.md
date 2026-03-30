# Good News

A Rails 8 app that ingests RSS feeds, classifies articles using Google Gemini, and serves a curated "good news" homepage with spotlight articles, search, tag filtering, and pagination.

## Tech Stack

- **Backend:** Ruby 3.4+, Rails 8.1, PostgreSQL (UUIDs, JSONB, full-text search)
- **Frontend:** Hotwire (Turbo + Stimulus), Tailwind CSS, Importmap (no Node required)
- **Background Jobs:** Solid Queue (production), async adapter (development)
- **Storage:** Active Storage with DigitalOcean Spaces (production), local disk (development)
- **RSS Parsing:** Faraday + Feedjira
- **AI Classification:** Google Gemini REST API

## Architecture

### Models

**Article** — the core model. Each article has a `title`, `summary`, `url` (unique), `source_name`, `published_at`, an optional `image_url`, and an Active Storage `image` attachment. Classification scores are stored directly on the record: `positivity`, `sensationalism`, `political_controversy`, and `fit_score` (all floats 0–10). The full Gemini response is persisted in `classification_json` (JSONB). Articles go through a status lifecycle: `CANDIDATE` → `PUBLISHED` or `REJECTED`.

**Tag** — simple label with a unique `slug`. Tags are assigned by Gemini during classification from a fixed set: `tech`, `animals`, `health`, `politics`, `environment`, `science`, `culture`, `world`.

**ArticleTag** — join table connecting articles to tags (unique on the pair).

**IngestionRun** — audit log for each ingestion. Tracks `started_at`, `finished_at`, `status`, and counts (`fetched_count`, `new_count`, `published_count`, `rejected_count`).

All tables use UUID primary keys.

### Services

The app is organized into four service namespaces:

**`Ingestion::Runner`** orchestrates the full pipeline. For each configured feed, it fetches entries, normalizes them, runs a rule-based pre-filter, deduplicates by URL, classifies via Gemini (with exponential-backoff retries), creates the Article record, downloads the hero image, and assigns tags. Each run is capped at 8 new articles to stay within API rate limits.

**`Rss::Fetcher`** and **`Rss::Normalizer`** handle feed retrieval and entry normalization. `Rss::OgImageFetcher` provides a fallback that scrapes `og:image` / `twitter:image` meta tags when an RSS entry has no image.

**`Classification::Gemini`** sends article data to the Gemini API with a structured system prompt. Gemini returns JSON scores and metadata. `Classification::EnvThresholds` reads tunable thresholds from environment variables to decide whether an article is published or rejected. An article must be flagged as positive/uplifting by Gemini _and_ pass all four numeric thresholds.

**`Articles::Feed`** powers the frontend queries. It provides the hero/spotlight selection (highlighted articles first, then top `fit_score`), paginated listing with optional tag filtering, and full-text search using PostgreSQL `tsvector`/`tsquery` with relevance ranking.

**`Filters::RuleFilter`** applies regex-based heuristics to reject clickbait and partisan content before classification, saving API calls.

### Request Flow

```
RSS Feeds → Rss::Fetcher → Rss::Normalizer → Filters::RuleFilter
  → Classification::Gemini → Article (PUBLISHED / REJECTED)
  → Ingestion::HeroImage (Active Storage)
  → Tag assignment
```

## Setup

### Prerequisites

- Ruby 3.4+ (check `.ruby-version`)
- PostgreSQL 16+ (Homebrew: `brew install postgresql@16`)
- Bundler (`gem install bundler`)

### 1. Start PostgreSQL

```bash
brew services start postgresql@16
```

Create the development and test databases (defaults expect your macOS username on `127.0.0.1:5432`):

```bash
createdb goodnews
createdb goodnews_test
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Open `.env` and set your `GEMINI_API_KEY` (get one at [Google AI Studio](https://aistudio.google.com/app/apikey)). Without it, ingestion will still run but articles will be saved as candidates with no classification.

Leave `DATABASE_URL` unset to use the defaults in `config/database.yml`, or set it if you use a custom role or host.

### 3. Install Dependencies and Prepare the Database

```bash
bundle install
bin/rails db:prepare
```

### 4. Start the App

```bash
bin/dev
```

This runs the Rails server and Tailwind CSS watcher via Foreman. Open [http://localhost:3000](http://localhost:3000).

## Ingestion

### Manual

```bash
bin/rails articles:ingest
```

This calls `Ingestion::Runner` synchronously. It reads feeds from `config/feeds.json` (Good News Network, Positive News, ScienceDaily by default) plus any comma-separated URLs in the `RSS_FEED_URLS` env var.

### Scheduled (Production)

`IngestionJob` runs daily at midnight via Solid Queue recurring tasks (see `config/recurring.yml`). Keep `bin/jobs` running so scheduled jobs execute.

### Backfill Hero Images

For published articles missing images:

```bash
bin/rails articles:backfill_hero_images       # default batch
LIMIT=200 bin/rails articles:backfill_hero_images  # custom batch size
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes (for classification) | — | Google Gemini API key |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model identifier |
| `GEMINI_MAX_RETRIES` | No | `8` | Max retries on 429/503 |
| `GEMINI_RETRY_BASE_SECONDS` | No | `3` | Base delay for exponential backoff |
| `DATABASE_URL` | No | from `database.yml` | PostgreSQL connection string |
| `INGEST_SECRET` | Yes (for admin) | — | Secret for `/admin/rejected` endpoint |
| `MIN_POSITIVITY` | No | `6` | Minimum positivity score (0–10) |
| `MAX_SENSATIONALISM` | No | `5` | Maximum sensationalism score (0–10) |
| `MAX_POLITICAL_CONTROVERSY` | No | `6` | Maximum political controversy score (0–10) |
| `MIN_FIT_SCORE` | No | `6` | Minimum fit score (0–10) |
| `RSS_FEED_URLS` | No | — | Comma-separated extra RSS feed URLs |
| `ENRICH_OG_IMAGES` | No | `true` | Set to `false` to skip og:image fallback |
| `SPACES_ACCESS_KEY` | Production only | — | DigitalOcean Spaces access key |
| `SPACES_SECRET_KEY` | Production only | — | DigitalOcean Spaces secret key |

## Admin

View the last 50 rejected articles:

```
/admin/rejected?secret=<INGEST_SECRET>
```

Requires the `INGEST_SECRET` env var to be set and passed as a query parameter.

## Testing

```bash
RAILS_ENV=test bin/rails db:prepare
bin/rails test
```

## Deployment

See [DEPLOY.md](DEPLOY.md) for Dokku, Fly.io, Render, and Railway configurations. The production process model (`Procfile`) runs:

- **release:** `bin/rails db:prepare`
- **web:** Puma behind Thruster
- **worker:** `bin/jobs` (Solid Queue)
