# frozen_string_literal: true

class ArticleTag < ApplicationRecord
  belongs_to :article
  belongs_to :tag
end
