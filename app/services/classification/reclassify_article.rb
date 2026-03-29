# frozen_string_literal: true

module Classification
  class ReclassifyArticle
    def self.call!(article)
      new(article).call!
    end

    def initialize(article)
      @article = article
    end

    def call!
      raise ArgumentError, "GEMINI_API_KEY is required" unless ENV["GEMINI_API_KEY"].present?

      result = Classification::Gemini.classify!(
        title: @article.title,
        summary: @article.summary,
        source_name: @article.source_name
      )
      apply_success!(result)
      :ok
    rescue StandardError => e
      apply_failure!(e)
      :error
    end

    private

    def apply_success!(result)
      c = result.classification
      published = result.published

      @article.update!(
        positivity: c.positivity,
        sensationalism: c.sensationalism,
        political_controversy: c.political_controversy,
        fit_score: c.fit_score,
        classification_json: c.as_json_for_db,
        status: published ? :published : :rejected
      )

      sync_tags!(c, published:)
    end

    def sync_tags!(c, published:)
      unless published && c.recommended_slugs.any?
        @article.tags.clear
        return
      end

      slugs = c.recommended_slugs.map(&:downcase).uniq & Ingestion::Runner::ALLOWED_SLUGS
      tags = slugs.map { |slug| Tag.find_or_create_by!(slug:) { |t| t.label = slug.capitalize } }
      @article.tags = tags
    end

    def apply_failure!(error)
      @article.update!(
        status: :rejected,
        positivity: nil,
        sensationalism: nil,
        political_controversy: nil,
        fit_score: nil,
        classification_json: {
          "error" => "classification_failed",
          "message" => error.message.to_s.truncate(1000),
          "errorClass" => error.class.name
        }
      )
      @article.tags.clear
    end
  end
end
