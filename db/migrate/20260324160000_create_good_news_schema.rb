# frozen_string_literal: true

class CreateGoodNewsSchema < ActiveRecord::Migration[8.1]
  def change
    enable_extension "pgcrypto" unless extension_enabled?("pgcrypto")

    create_table :articles, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.string :title, null: false
      t.text :summary, null: false
      t.string :url, null: false
      t.string :source_name, null: false
      t.datetime :published_at, null: false
      t.string :image_url

      t.float :positivity
      t.float :sensationalism
      t.float :political_controversy
      t.float :fit_score

      t.string :status, null: false, default: "CANDIDATE"
      t.boolean :highlighted, null: false, default: false

      t.jsonb :classification_json

      t.timestamps
    end

    add_index :articles, :url, unique: true
    add_index :articles, [ :status, :published_at ], order: { published_at: :desc }
    add_index :articles, :published_at, order: { published_at: :desc }
    add_index :articles, :fit_score, order: { fit_score: :desc }

    create_table :tags, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.string :slug, null: false
      t.string :label, null: false
      t.timestamps
    end

    add_index :tags, :slug, unique: true

    create_table :article_tags, id: false do |t|
      t.references :article, null: false, foreign_key: true, type: :uuid, index: false
      t.references :tag, null: false, foreign_key: true, type: :uuid, index: false
    end

    add_index :article_tags, [ :article_id, :tag_id ], unique: true
    add_index :article_tags, :tag_id
    add_index :article_tags, :article_id

    create_table :ingestion_runs, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.datetime :started_at, null: false, default: -> { "CURRENT_TIMESTAMP" }
      t.datetime :finished_at
      t.string :status, null: false
      t.integer :fetched_count, null: false, default: 0
      t.integer :new_count, null: false, default: 0
      t.integer :published_count, null: false, default: 0
      t.integer :rejected_count, null: false, default: 0
      t.text :error_message
    end
  end
end
