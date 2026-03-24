# frozen_string_literal: true

module Admin
  class RejectedController < ApplicationController
    def index
      expected = ENV["INGEST_SECRET"]
      if expected.blank? || params[:secret].to_s != expected
        render :not_available, layout: false
        return
      end

      @articles = Article.where(status: :rejected).order(published_at: :desc).limit(50)
    end
  end
end
