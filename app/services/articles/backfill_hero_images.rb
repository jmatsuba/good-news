# frozen_string_literal: true

module Articles
  # Fills missing image_url (via og:image) and attaches hero images for published articles.
  class BackfillHeroImages
    def self.call(limit: 200)
      new(limit:).call
    end

    def initialize(limit:)
      @limit = [ limit, 1 ].max
    end

    def call
      n = 0
      scope.find_each(batch_size: 10) do |article|
        source = article.image_url.to_s.strip.presence
        source ||= Rss::OgImageFetcher.fetch(article.url)
        next if source.blank?

        article.update_column(:image_url, source) if article.image_url.to_s.strip.blank?
        article.reload

        unless article.image.attached?
          Ingestion::HeroImage.attach!(article:, source_url: source)
        end

        n += 1
        break if n >= @limit

        sleep(0.15)
      end
      n
    end

    private

    def scope
      Article.published
        .left_joins(:image_attachment)
        .where(
          "NULLIF(TRIM(COALESCE(articles.image_url, '')), '') IS NULL " \
          "OR active_storage_attachments.id IS NULL"
        )
        .order(published_at: :desc)
    end
  end
end
