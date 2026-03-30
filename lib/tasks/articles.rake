# frozen_string_literal: true

namespace :articles do
  desc "Run RSS ingestion (fetch feeds, classify with Gemini when configured, create articles)"
  task ingest: :environment do
    tallies = Ingestion::Runner.call
    puts "Ingest complete — fetched: #{tallies[:fetched]}, new: #{tallies[:new]}, " \
         "published: #{tallies[:published]}, rejected: #{tallies[:rejected]}"
  end

  desc "Backfill image_url (og:image) and hero attachments for published articles missing images. LIMIT=200"
  task backfill_hero_images: :environment do
    limit = ENV.fetch("LIMIT", "200").to_i
    n = Articles::BackfillHeroImages.call(limit:)
    puts "Processed #{n} articles (limit #{limit})."
  end
end
