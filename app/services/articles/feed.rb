# frozen_string_literal: true

module Articles
  class Feed
    SORTS = %w[newest relevant rated].freeze

    Result = Data.define(:articles, :has_more)

    def self.list(q:, tag:, sort:, limit:, offset:, exclude_ids: nil)
      new(q:, tag:, sort:, limit:, offset:, exclude_ids:).list
    end

    def self.hero(take: 5)
      highlighted = Article.published.highlighted.order(published_at: :desc).limit(take)
        .with_attached_image.includes(tags: []).to_a
      return highlighted if highlighted.size >= 3

      rest = Article.published
        .where.not(id: highlighted.map(&:id))
        .order(fit_score: :desc, published_at: :desc)
        .limit(take - highlighted.size)
        .with_attached_image.includes(tags: [])
        .to_a

      (highlighted + rest).first(take)
    end

    def self.count_published
      Article.published.count
    end

    def self.find_published(id)
      Article.published.with_attached_image.includes(tags: []).find_by(id:)
    end

    def self.all_tags
      Tag.order(:label)
    end

    def initialize(q:, tag:, sort:, limit:, offset:, exclude_ids:)
      @q = q.to_s.strip.presence
      @tag = tag.to_s.strip.presence
      @sort = SORTS.include?(sort.to_s) ? sort.to_s : "newest"
      @limit = limit
      @offset = offset
      @exclude_ids = exclude_ids
    end

    def list
      return list_fts if @q

      effective_sort = @sort == "relevant" ? "newest" : @sort
      scope = Article.published.with_attached_image.includes(tags: [])
      scope = scope.where.not(id: @exclude_ids) if @exclude_ids.present?
      if @tag
        scope = scope.joins(:tags).where(tags: { slug: @tag.downcase }).distinct
      end

      scope =
        if effective_sort == "rated"
          scope.order(fit_score: :desc, published_at: :desc)
        else
          scope.order(published_at: :desc)
        end

      rows = scope.limit(@limit + 1).offset(@offset).to_a
      has_more = rows.size > @limit
      Result.new(articles: has_more ? rows.take(@limit) : rows, has_more:)
    end

    private

    def list_fts
      fragments = [ "SELECT a.id FROM articles a WHERE a.status = 'PUBLISHED'" ]
      args = []

      if @exclude_ids.present?
        fragments << "AND a.id NOT IN (?)"
        args << @exclude_ids
      end

      if @tag
        fragments << <<~SQL.squish
          AND EXISTS (
            SELECT 1 FROM article_tags at
            INNER JOIN tags t ON t.id = at.tag_id
            WHERE at.article_id = a.id AND t.slug = ?
          )
        SQL
        args << @tag.downcase
      end

      fragments << <<~SQL.squish
        AND to_tsvector('english', a.title || ' ' || coalesce(a.summary, ''))
          @@ plainto_tsquery('english', ?)
        ORDER BY ts_rank(
          to_tsvector('english', a.title || ' ' || coalesce(a.summary, '')),
          plainto_tsquery('english', ?)
        ) DESC, a.published_at DESC
        LIMIT ? OFFSET ?
      SQL

      args.push(@q, @q, @limit + 1, @offset)

      sql = ActiveRecord::Base.sanitize_sql_array([ fragments.join(" "), *args ])
      id_rows = ActiveRecord::Base.connection.exec_query(sql)
      ids = id_rows.rows.map(&:first)
      has_more = ids.size > @limit
      id_list = ids.take(@limit)
      return Result.new(articles: [], has_more: false) if id_list.empty?

      articles_by_id = Article.where(id: id_list).with_attached_image.includes(tags: []).index_by { |a| a.id.to_s }
      ordered = id_list.filter_map { |id| articles_by_id[id] }
      Result.new(articles: ordered, has_more:)
    end
  end
end
