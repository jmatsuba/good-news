module ApplicationHelper
  def format_relative_time(time)
    time = time.is_a?(Time) ? time : Time.zone.parse(time.to_s)
    diff = Time.current - time
    mins = (diff / 60).floor
    return "just now" if mins < 1
    return "#{mins}m ago" if mins < 60

    hrs = mins / 60
    return "#{hrs}h ago" if hrs < 24

    days = hrs / 24
    return "#{days}d ago" if days < 7

    time.strftime("%b %-d, %Y")
  end

  def category_chip_class(active)
    if active
      "rounded-full px-4 py-1.5 text-sm transition bg-stone-900 text-amber-50 shadow-sm"
    else
      "rounded-full px-4 py-1.5 text-sm transition border border-stone-200/80 bg-white/60 text-stone-700 hover:border-amber-300/60 hover:bg-amber-50/50"
    end
  end

  def category_chip_params(slug, q, sort)
    p = {}
    p[:q] = q if q.present?
    p[:sort] = sort if sort.present?
    p[:tag] = slug if slug.present?
    p
  end
end
