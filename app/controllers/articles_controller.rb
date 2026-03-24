# frozen_string_literal: true

class ArticlesController < ApplicationController
  def index
    @q = params[:q].to_s.strip.presence
    @tag = params[:tag].to_s.strip.presence
    @sort = params[:sort].to_s.presence || "newest"
    @offset = [ params[:offset].to_i, 0 ].max
    @limit = 20

    @hero = Articles::Feed.hero(take: 5)
    @tags = Articles::Feed.all_tags
    @published_count = Articles::Feed.count_published

    @show_spotlight = @offset.zero? && @q.blank? && @tag.blank?
    hero_ids = @hero.map(&:id)
    @exclude_hero_from_feed = @show_spotlight && hero_ids.any? && @published_count > hero_ids.size

    result = Articles::Feed.list(
      q: @q,
      tag: @tag,
      sort: @sort,
      limit: @limit,
      offset: @offset,
      exclude_ids: (@exclude_hero_from_feed ? hero_ids : nil)
    )

    @articles = result.articles
    @has_more = result.has_more

    @tag_items = @tags.map { |t| { slug: t.slug, label: t.label } }
    @active_tag_label = @tag && @tag_items.find { |t| t[:slug] == @tag }&.dig(:label)

    @next_params = build_next_params
  end

  def show
    @article = Articles::Feed.find_published(params[:id])
    raise ActiveRecord::RecordNotFound unless @article

    @page_title = "#{@article.title} · Good News"
    @page_description = @article.summary.truncate(160)
  end

  private

  def build_next_params
    p = {}
    p[:q] = @q if @q.present?
    p[:tag] = @tag if @tag.present?
    p[:sort] = @sort if @sort.present? && @sort != "newest"
    p[:offset] = @offset + @limit if @has_more
    p
  end
end
