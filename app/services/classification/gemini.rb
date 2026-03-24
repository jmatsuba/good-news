# frozen_string_literal: true

module Classification
  class Gemini
    SYSTEM = <<~PROMPT.squish
      You are a strict editor for a "good news" site. Score each article for:
      - positivity (0-10): uplifting, constructive, solutions-oriented, hope.
      - sensationalism (0-10): higher if headline/snippet is clickbait, outrage, fear-mongering, or hype.
      - politicalControversy (0-10): higher if primarily partisan conflict, culture-war framing, or likely to polarize.
      - fitScore (0-10): overall fit for a calm, neutral, non-sensational good-news site.

      isPositiveUplifting: true only if the story is clearly net-positive and appropriate for a general audience.

      recommendedSlugs: choose zero or more from: tech, animals, health, politics, environment, science, culture, world — only if clearly relevant.

      rejectReason: short text if the story should be rejected (partisan attack, tragedy-focused, unclear, etc.), else null.

      Respond with JSON only (no markdown fences), single object with keys: positivity, sensationalism, politicalControversy, fitScore, isPositiveUplifting, recommendedSlugs, rejectReason.
    PROMPT

    Result = Data.define(:classification, :published)

    def self.classify!(title:, summary:, source_name:)
      new.classify!(title:, summary:, source_name:)
    end

    def classify!(title:, summary:, source_name:)
      api_key = ENV.fetch("GEMINI_API_KEY")
      model = ENV["GEMINI_MODEL"].presence || "gemini-2.0-flash"
      url = "https://generativelanguage.googleapis.com/v1beta/models/#{model}:generateContent"
      payload = {
        systemInstruction: { parts: [ { text: SYSTEM } ] },
        contents: [
          {
            role: "user",
            parts: [ {
              text: "Classify this article and output only the JSON object described in your instructions.\n\nArticle:\n#{user_json(title, summary, source_name)}"
            } ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      }

      conn = Faraday.new do |f|
        f.options.timeout = 60
        f.options.open_timeout = 15
      end

      res = conn.post(url) do |req|
        req.params["key"] = api_key
        req.headers["Content-Type"] = "application/json"
        req.body = payload.to_json
      end

      raise "Gemini HTTP #{res.status}" unless res.success?

      body = JSON.parse(res.body)
      text = body.dig("candidates", 0, "content", "parts", 0, "text")
      raise "Empty classification response" if text.blank?

      parsed = parse_json_from_model_text(text)
      c = ClassificationPayload.parse!(parsed)
      published = passes_thresholds?(c)
      Result.new(classification: c, published:)
    end

    private

    def user_json(title, summary, source_name)
      {
        title:,
        summary: summary.to_s.truncate(4000),
        sourceName: source_name
      }.to_json
    end

    def parse_json_from_model_text(raw)
      trimmed = raw.strip
      body = if (m = trimmed.match(/\A```(?:json)?\s*([\s\S]*?)```\z/m))
               m[1].strip
             else
               trimmed
             end
      JSON.parse(body)
    end

    def passes_thresholds?(c)
      t = EnvThresholds.fetch
      return false unless c.is_positive_uplifting
      return false if c.positivity < t[:min_positivity]
      return false if c.sensationalism > t[:max_sensationalism]
      return false if c.political_controversy > t[:max_political_controversy]
      return false if c.fit_score < t[:min_fit_score]

      true
    end

    class ClassificationPayload
      attr_reader :positivity, :sensationalism, :political_controversy, :fit_score,
                  :is_positive_uplifting, :recommended_slugs, :reject_reason

      def self.parse!(hash)
        h = hash.stringify_keys
        new(
          positivity: coerce_float(h["positivity"]),
          sensationalism: coerce_float(h["sensationalism"]),
          political_controversy: coerce_float(h["politicalControversy"] || h["political_controversy"]),
          fit_score: coerce_float(h["fitScore"] || h["fit_score"]),
          is_positive_uplifting: coerce_bool(h["isPositiveUplifting"] || h["is_positive_uplifting"]),
          recommended_slugs: coerce_slug_array(h["recommendedSlugs"] || h["recommended_slugs"]),
          reject_reason: h["rejectReason"] || h["reject_reason"]
        )
      end

      def self.coerce_float(v)
        raise ArgumentError, "missing score" if v.nil?

        Float(v).clamp(0.0, 10.0)
      end

      def self.coerce_bool(v)
        ActiveModel::Type::Boolean.new.cast(v)
      end

      def self.coerce_slug_array(v)
        return [] if v.nil?

        arr = v.is_a?(Array) ? v : [ v ]
        arr.map { |s| s.to_s.downcase }
      end

      def initialize(positivity:, sensationalism:, political_controversy:, fit_score:,
                     is_positive_uplifting:, recommended_slugs:, reject_reason:)
        @positivity = positivity
        @sensationalism = sensationalism
        @political_controversy = political_controversy
        @fit_score = fit_score
        @is_positive_uplifting = is_positive_uplifting
        @recommended_slugs = recommended_slugs
        @reject_reason = reject_reason
      end

      def as_json_for_db
        {
          "positivity" => positivity,
          "sensationalism" => sensationalism,
          "politicalControversy" => political_controversy,
          "fitScore" => fit_score,
          "isPositiveUplifting" => is_positive_uplifting,
          "recommendedSlugs" => recommended_slugs,
          "rejectReason" => reject_reason
        }
      end
    end
  end
end
