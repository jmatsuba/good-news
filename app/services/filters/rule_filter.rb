# frozen_string_literal: true

module Filters
  module RuleFilter
    CLICKBAIT_RE = /\b(you won'?t believe|shocking|doctors hate|one weird trick|gone wrong|destroyed|meltdown|rage|lib(?:eral)?s?|conservative|woke)\b/i

    module_function

    def passes?(title, summary)
      text = "#{title}\n#{summary}"
      !CLICKBAIT_RE.match?(text)
    end
  end
end
