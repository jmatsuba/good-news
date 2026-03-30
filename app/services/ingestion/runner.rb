# frozen_string_literal: true

module Ingestion
  class Runner
    ALLOWED_SLUGS = %w[tech animals health politics environment science culture world].freeze

    MAX_NEW_ARTICLES_PER_RUN = 8
    CLASSIFY_MAX_ATTEMPTS = 3
    CLASSIFY_RETRY_BASE_SECONDS = 1.0

    def self.call
      new.call
    end

    def call
      run = IngestionRun.create!(status: "running")
      tallies = { fetched: 0, new: 0, published: 0, rejected: 0 }

      begin
        catch(:ingestion_article_limit) do
          Ingestion::FeedList.feeds.each { |feed| process_feed(feed, tallies) }
        end

        run.update!(
          status: "success",
          finished_at: Time.current,
          fetched_count: tallies[:fetched],
          new_count: tallies[:new],
          published_count: tallies[:published],
          rejected_count: tallies[:rejected]
        )

        tallies
      rescue StandardError => e
        run.update!(
          status: "failed",
          finished_at: Time.current,
          fetched_count: tallies[:fetched],
          new_count: tallies[:new],
          published_count: tallies[:published],
          rejected_count: tallies[:rejected],
          error_message: e.message
        )
        raise
      end
    end

    private

    def process_feed(feed, tallies)
      items =
        begin
          Rss::Fetcher.fetch_entries(feed["url"])
        rescue StandardError
          return
        end

      items.each do |entry|
        tallies[:fetched] += 1
        norm = Rss::Normalizer.normalize(
          entry,
          fetch_og_fallback: ENV["ENRICH_OG_IMAGES"] != "false"
        )
        next unless norm

        next unless Filters::RuleFilter.passes?(norm.title, norm.summary)

        next if Article.exists?(url: norm.url)

        throw(:ingestion_article_limit) if tallies[:new] >= MAX_NEW_ARTICLES_PER_RUN

        tallies[:new] += 1
        process_new_item(feed, norm, tallies)
      end
    end

    def process_new_item(feed, norm, tallies)
      unless ENV["GEMINI_API_KEY"].present?
        article = Article.create!(
          title: norm.title,
          summary: norm.summary,
          url: norm.url,
          source_name: feed["sourceName"],
          published_at: norm.published_at,
          image_url: norm.image_url,
          status: :candidate,
          classification_json: { "error" => "GEMINI_API_KEY missing" }
        )
        Ingestion::HeroImage.attach!(article:, source_url: norm.image_url)
        return
      end

      result =
        begin
          classify_with_retries(norm, feed)
        rescue StandardError => e
          Rails.logger.warn("[ingest] classification failed for #{norm.url}: #{e.class}: #{e.message}")
          article = Article.create!(
            title: norm.title,
            summary: norm.summary,
            url: norm.url,
            source_name: feed["sourceName"],
            published_at: norm.published_at,
            image_url: norm.image_url,
            status: :rejected,
            classification_json: {
              "error" => "classification_failed",
              "message" => e.message.to_s.truncate(1000),
              "errorClass" => e.class.name
            }
          )
          Ingestion::HeroImage.attach!(article:, source_url: norm.image_url)
          tallies[:rejected] += 1
          return
        end

      c = result.classification
      published = result.published
      if published
        tallies[:published] += 1
      else
        tallies[:rejected] += 1
      end

      article = Article.create!(
        title: norm.title,
        summary: norm.summary,
        url: norm.url,
        source_name: feed["sourceName"],
        published_at: norm.published_at,
        image_url: norm.image_url,
        status: published ? :published : :rejected,
        positivity: c.positivity,
        sensationalism: c.sensationalism,
        political_controversy: c.political_controversy,
        fit_score: c.fit_score,
        classification_json: c.as_json_for_db
      )
      Ingestion::HeroImage.attach!(article:, source_url: norm.image_url)

      return unless published && c.recommended_slugs.any?

      slugs = c.recommended_slugs.map(&:downcase).uniq & ALLOWED_SLUGS
      slugs.each do |slug|
        tag = Tag.find_or_create_by!(slug:) { |t| t.label = slug.capitalize }
        article.tags << tag unless article.tags.include?(tag)
      end
    end

    def classify_with_retries(norm, feed)
      last_error = nil
      CLASSIFY_MAX_ATTEMPTS.times do |attempt|
        return Classification::Gemini.classify!(
          title: norm.title,
          summary: norm.summary,
          source_name: feed["sourceName"]
        )
      rescue StandardError => e
        last_error = e
        if attempt < CLASSIFY_MAX_ATTEMPTS - 1
          wait = CLASSIFY_RETRY_BASE_SECONDS * (2**attempt)
          Rails.logger.warn(
            "[ingest] classification attempt #{attempt + 1}/#{CLASSIFY_MAX_ATTEMPTS} failed for #{norm.url}, " \
            "retrying in #{wait}s: #{e.class}: #{e.message}"
          )
          sleep(wait)
        end
      end
      raise last_error
    end
  end
end
