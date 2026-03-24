# frozen_string_literal: true

class IngestController < ApplicationController
  include IngestAuthentication

  skip_forgery_protection

  before_action :authenticate_ingest!

  def show
    handle_ingest
  end

  def create
    handle_ingest
  end

  private

  def handle_ingest
    if Rails.env.production?
      IngestionJob.perform_later
      return render_html_queued if params[:ui] == "1"

      return render json: { ok: true, queued: true }
    else
      tallies = Ingestion::Runner.call
      payload = {
        ok: true,
        fetchedCount: tallies[:fetched],
        newCount: tallies[:new],
        publishedCount: tallies[:published],
        rejectedCount: tallies[:rejected]
      }
      return render_html_success(payload) if params[:ui] == "1"

      render json: payload
    end
  rescue StandardError => e
    message = e.message.presence || "Ingest failed"
    if params[:ui] == "1"
      render html: html_page(ok: false, error: message).html_safe, status: :internal_server_error
    else
      render json: { ok: false, error: message }, status: :internal_server_error
    end
  end

  def render_html_queued
    html = <<~HTML
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>Ingest queued · Good News</title>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1rem; color: #1c1917; }
          a { color: #92400e; }
        </style>
      </head>
      <body>
        <h1 style="font-size:1.25rem;font-weight:600">Ingest queued</h1>
        <p>Background job enqueued. Run <code>bin/jobs</code> (or your host equivalent) so it executes.</p>
        <p><a href="/">← Back to site</a></p>
      </body>
      </html>
    HTML
    render html: html.html_safe, content_type: "text/html"
  end

  def render_html_success(body)
    render html: html_page(**body).html_safe, content_type: "text/html"
  end

  def html_page(ok:, fetchedCount: nil, newCount: nil, publishedCount: nil, rejectedCount: nil, error: nil)
    title = ok ? "Ingest finished" : "Ingest failed"
    rows =
      if ok
        <<~ROWS
          <ul style="margin:1rem 0;padding-left:1.25rem;line-height:1.7">
            <li>Fetched: <strong>#{fetchedCount}</strong></li>
            <li>New URLs: <strong>#{newCount}</strong></li>
            <li>Published: <strong>#{publishedCount}</strong></li>
            <li>Rejected: <strong>#{rejectedCount}</strong></li>
          </ul>
        ROWS
      else
        %(<p style="color:#b91c1c">#{ERB::Util.html_escape(error)}</p>)
      end

    <<~HTML
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>#{ERB::Util.html_escape(title)} · Good News</title>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1rem; color: #1c1917; }
          a { color: #92400e; }
        </style>
      </head>
      <body>
        <h1 style="font-size:1.25rem;font-weight:600">#{ERB::Util.html_escape(title)}</h1>
        #{rows}
        <p><a href="/">← Back to site</a></p>
      </body>
      </html>
    HTML
  end
end
