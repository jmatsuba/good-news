# frozen_string_literal: true

module Ingestion
  module FeedList
    module_function

    def feeds
      path = Rails.root.join("config/feeds.json")
      data = JSON.parse(File.read(path))
      from_file = data.fetch("feeds", []).map { |h| { "url" => h["url"], "sourceName" => h["sourceName"] } }
      extra = (ENV["RSS_FEED_URLS"] || "").split(",").map(&:strip).reject(&:blank?).map do |u|
        { "url" => u, "sourceName" => URI.parse(u).host }
      end
      from_file + extra
    end
  end
end
