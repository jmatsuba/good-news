# frozen_string_literal: true

class Article < ApplicationRecord
  enum :status, {
    candidate: "CANDIDATE",
    published: "PUBLISHED",
    rejected: "REJECTED"
  }, default: :candidate

  has_many :article_tags, dependent: :destroy
  has_many :tags, through: :article_tags

  scope :published, -> { where(status: :published) }
  scope :highlighted, -> { where(highlighted: true) }
end
