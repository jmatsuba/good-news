# frozen_string_literal: true

require "stringio"

module Ingestion
  module HeroImage
    USER_AGENT = Rss::OgImageFetcher::USER_AGENT

    class << self
      def attach!(article:, source_url:)
        return if source_url.blank?
        return unless article.persisted?

        body, content_type, final_url = fetch_bytes(source_url)
        return if body.blank?

        filename = filename_from(final_url, content_type)
        article.image.attach(
          io: StringIO.new(body),
          filename:,
          content_type: content_type.presence || "image/jpeg"
        )
      rescue StandardError => e
        Rails.logger.warn("[ingest] hero image attach failed for #{article.url}: #{e.class}: #{e.message}")
      end

      private

      def fetch_bytes(url, redirect_limit = 5)
        raise "too many redirects" if redirect_limit.negative?

        conn = Faraday.new do |f|
          f.options.timeout = 30
          f.options.open_timeout = 10
          f.headers["User-Agent"] = USER_AGENT
          f.headers["Accept"] = "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
        end

        res = conn.get(url)
        if [ 301, 302, 303, 307, 308 ].include?(res.status)
          loc = res.headers["location"]
          return fetch_bytes(URI.join(url, loc).to_s, redirect_limit - 1) if loc.present?
        end

        raise "HTTP #{res.status}" unless res.success?

        ct = res.headers["content-type"]&.split(";")&.first&.strip
        [ res.body.to_s, ct, url ]
      end

      def filename_from(url, content_type)
        path = URI.parse(url).path
        base = File.basename(path)
        return "hero#{extension_for_content_type(content_type)}" if base.blank? || base == "/" || !base.include?(".")

        base
      rescue URI::InvalidURIError
        "hero#{extension_for_content_type(content_type)}"
      end

      def extension_for_content_type(ct)
        case ct.to_s.downcase
        when %r{\Aimage/png}i then ".png"
        when %r{\Aimage/webp}i then ".webp"
        when %r{\Aimage/gif}i then ".gif"
        when %r{\Aimage/avif}i then ".avif"
        else ".jpg"
        end
      end
    end
  end
end
