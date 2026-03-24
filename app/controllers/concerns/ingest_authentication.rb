# frozen_string_literal: true

module IngestAuthentication
  extend ActiveSupport::Concern

  private

  def authenticate_ingest!
    return if ingest_token_valid?

    respond_to do |format|
      format.json { render json: { error: "Unauthorized" }, status: :unauthorized }
      format.html { render plain: "Unauthorized", status: :unauthorized }
    end
  end

  def ingest_token_valid?
    token = request.authorization&.delete_prefix("Bearer ")&.strip
    token = params[:secret].to_s.strip if token.blank?
    return false if token.blank?

    (ENV["INGEST_SECRET"].present? && token == ENV["INGEST_SECRET"]) ||
      (ENV["CRON_SECRET"].present? && token == ENV["CRON_SECRET"])
  end
end
