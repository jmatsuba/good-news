# frozen_string_literal: true

module Rss
  class OgImageFetcher
    USER_AGENT = "GoodNewsBot/1.0 (+https://github.com/)"

    def self.fetch(page_url)
      new.fetch(page_url)
    end

    def fetch(page_url)
      conn = Faraday.new do |f|
        f.options.timeout = 10
        f.options.open_timeout = 5
        f.headers["User-Agent"] = USER_AGENT
        f.headers["Accept"] = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"
      end

      res = conn.get(page_url)
      return nil unless res.success?

      html = res.body.to_s
      patterns = [
        %r{<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']}i,
        %r{<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']}i,
        %r{<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']}i,
        %r{<meta[^>]+name=["']twitter:image:src["'][^>]+content=["']([^"']+)["']}i
      ]

      patterns.each do |re|
        m = html.match(re)
        next unless m&.captures&.first

        u = absolutize(page_url, m[1])
        return u if u
      end
      nil
    rescue Faraday::Error, SocketError
      nil
    end

    private

    def absolutize(base, candidate)
      c = candidate.to_s.strip
      return nil if c.blank?

      return c if c.match?(/\Ahttps?:\/\//i)
      return nil if base.blank?

      URI.join(base, c).to_s
    rescue URI::InvalidURIError
      nil
    end
  end
end
