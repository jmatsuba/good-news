# frozen_string_literal: true

class IngestionJob < ApplicationJob
  queue_as :default

  def perform
    Ingestion::Runner.call
  end
end
