# frozen_string_literal: true

namespace :articles do
  desc <<~DESC.squish
    Reclassify articles with Gemini.
    IDS=id1,id2 (comma-separated UUIDs) or ALL=1.
    Optional DELAY_SECONDS=2 to pause between requests (helps avoid 429 bursts).
  DESC
  task reclassify: :environment do
    unless ENV["GEMINI_API_KEY"].present?
      abort "GEMINI_API_KEY must be set."
    end

    all_requested = %w[1 true yes y on].include?(ENV["ALL"].to_s.strip.downcase)

    scope =
      if all_requested
        if ENV["IDS"].present?
          abort "Use either IDS=... or ALL=1, not both."
        end
        Article.all
      elsif ENV["IDS"].present?
        ids = ENV["IDS"].split(",").map(&:strip).reject(&:blank?)
        abort "IDS must list at least one UUID." if ids.empty?

        found = Article.where(id: ids)
        missing = ids - found.pluck(:id).map(&:to_s)
        if missing.any?
          abort "Unknown article id(s): #{missing.join(', ')}"
        end
        found
      else
        abort "Set IDS=id1,id2 or ALL=1. See: bin/rails -T articles:reclassify"
      end

    total = scope.count
    delay = ENV["DELAY_SECONDS"].to_f
    delay = 0.0 if delay.negative?

    puts "Reclassifying #{total} article(s)..."
    puts "Pausing #{delay}s between articles (set DELAY_SECONDS to change)." if delay.positive?

    ok = 0
    err = 0
    scope.find_each.with_index do |article, index|
      sleep(delay) if index.positive? && delay.positive?

      outcome = Classification::ReclassifyArticle.call!(article)
      if outcome == :ok
        ok += 1
        puts "  OK #{article.id} → #{article.reload.status}"
      else
        err += 1
        puts "  ERR #{article.id} → #{article.reload.status} (#{article.classification_json&.dig('message')&.truncate(80)})"
      end
    end

    puts "Done. #{ok} succeeded, #{err} failed (of #{total})."
  end
end
