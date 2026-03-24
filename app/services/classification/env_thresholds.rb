# frozen_string_literal: true

module Classification
  module EnvThresholds
    module_function

    def fetch
      {
        min_positivity: float_env("MIN_POSITIVITY", 6.0),
        max_sensationalism: float_env("MAX_SENSATIONALISM", 5.0),
        max_political_controversy: float_env("MAX_POLITICAL_CONTROVERSY", 6.0),
        min_fit_score: float_env("MIN_FIT_SCORE", 6.0)
      }
    end

    def float_env(key, default)
      v = ENV[key]
      return default if v.blank?

      Float(v).clamp(0.0, 10.0)
    rescue ArgumentError
      default
    end
  end
end
