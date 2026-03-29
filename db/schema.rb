# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_03_24_160000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"
  enable_extension "pgcrypto"

  create_table "article_tags", id: false, force: :cascade do |t|
    t.uuid "article_id", null: false
    t.uuid "tag_id", null: false
    t.index ["article_id", "tag_id"], name: "index_article_tags_on_article_id_and_tag_id", unique: true
    t.index ["article_id"], name: "index_article_tags_on_article_id"
    t.index ["tag_id"], name: "index_article_tags_on_tag_id"
  end

  create_table "articles", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.jsonb "classification_json"
    t.datetime "created_at", null: false
    t.float "fit_score"
    t.boolean "highlighted", default: false, null: false
    t.string "image_url"
    t.float "political_controversy"
    t.float "positivity"
    t.datetime "published_at", null: false
    t.float "sensationalism"
    t.string "source_name", null: false
    t.string "status", default: "CANDIDATE", null: false
    t.text "summary", null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.string "url", null: false
    t.index ["fit_score"], name: "index_articles_on_fit_score", order: :desc
    t.index ["published_at"], name: "index_articles_on_published_at", order: :desc
    t.index ["status", "published_at"], name: "index_articles_on_status_and_published_at", order: { published_at: :desc }
    t.index ["url"], name: "index_articles_on_url", unique: true
  end

  create_table "ingestion_runs", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.text "error_message"
    t.integer "fetched_count", default: 0, null: false
    t.datetime "finished_at"
    t.integer "new_count", default: 0, null: false
    t.integer "published_count", default: 0, null: false
    t.integer "rejected_count", default: 0, null: false
    t.datetime "started_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.string "status", null: false
  end

  create_table "tags", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "label", null: false
    t.string "slug", null: false
    t.datetime "updated_at", null: false
    t.index ["slug"], name: "index_tags_on_slug", unique: true
  end

  add_foreign_key "article_tags", "articles"
  add_foreign_key "article_tags", "tags"
end
