# frozen_string_literal: true

module Rss
  class Fetcher
    USER_AGENT = "GoodNewsBot/1.0 (+https://github.com/)"

    def self.fetch_entries(feed_url)
      new.fetch_entries(feed_url)
    end

    def fetch_entries(feed_url)
      conn = Faraday.new do |f|
        f.options.timeout = 20
        f.options.open_timeout = 10
        f.headers["User-Agent"] = USER_AGENT
        f.headers["Accept"] = "application/rss+xml, application/xml, text/xml, */*"
      end

      res = conn.get(feed_url)
      raise "RSS HTTP #{res.status}" unless res.success?

      feed = Feedjira.parse(res.body)
      feed.entries
    end
  end
end
