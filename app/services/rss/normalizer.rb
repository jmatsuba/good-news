# frozen_string_literal: true

module Rss
  class Normalizer
    Normalized = Data.define(:title, :summary, :url, :published_at, :image_url)

    def self.normalize(entry, fetch_og_fallback: false)
      new.normalize(entry, fetch_og_fallback:)
    end

    def normalize(entry, fetch_og_fallback:)
      link = entry.url.to_s.strip
      title = entry.title.to_s.strip
      return nil if link.blank? || title.blank?

      summary = build_summary(entry)
      published_at = coerce_time(entry.published)

      image_url = pick_image(entry, link)
      image_url = OgImageFetcher.fetch(link) if image_url.blank? && fetch_og_fallback

      Normalized.new(
        title: title.truncate(500),
        summary:,
        url: link,
        published_at: published_at.respond_to?(:to_time) ? published_at.to_time : Time.zone.parse(published_at.to_s),
        image_url:
      )
    end

    private

    def coerce_time(value)
      return Time.current if value.blank?

      t = value.respond_to?(:to_time) ? value.to_time : Time.zone.parse(value.to_s)
      t || Time.current
    rescue ArgumentError
      Time.current
    end

    def build_summary(entry)
      raw = entry.summary.presence || entry.content.presence || entry.title.to_s
      raw.to_s.gsub(/\s+/, " ").strip.truncate(2000)
    end

    def pick_image(entry, page_url)
      img = entry.try(:image)
      url =
        case img
        when String then img.strip
        when nil then nil
        else img.to_s.presence
        end
      return absolutize(page_url, url) if url.present? && http_url?(url)

      # enclosure from raw SAX — best-effort via summary HTML
      first_img_from_html(entry.content.to_s, page_url) ||
        first_img_from_html(entry.summary.to_s, page_url)
    end

    def http_url?(s)
      s.to_s.match?(/\Ahttps?:\/\//i)
    end

    def absolutize(base, candidate)
      c = candidate.to_s.strip
      return nil if c.blank? || c.start_with?("data:")
      return c if http_url?(c)
      return nil if base.blank?

      URI.join(base, c).to_s
    rescue URI::InvalidURIError
      nil
    end

    def first_img_from_html(html, base_url)
      return nil if html.blank?

      html.scan(/<img[^>]+src=["']([^"']+)["']/i).each do |(src)|
        u = absolutize(base_url, src)
        return u if u && !%r{/spacer\.|/pixel\.|1x1|tracking}i.match?(u)
      end
      nil
    end
  end
end
