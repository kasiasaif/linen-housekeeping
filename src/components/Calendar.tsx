import {
  formatLongDate,
  formatMoney,
  isPast,
  openSlots,
  quote,
  toISODate,
  type ExtraId,
  type ServiceId,
  type SizeId,
} from "../lib/pricing.ts";

type CalendarProps = {
  now: Date;
  month: Date;
  selected: string | null;
  serviceId: ServiceId;
  sizeId: SizeId;
  extraIds: ExtraId[];
  taken: Record<string, string[]>;
  onMonthChange: (month: Date) => void;
  onSelect: (iso: string) => void;
};

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function cellsFor(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<{ iso: string; day: number } | null> = [];

  for (let index = 0; index < firstWeekday; index += 1) cells.push(null);
  for (let day = 1; day <= days; day += 1) {
    const date = new Date(year, monthIndex, day);
    cells.push({ iso: toISODate(date), day });
  }
  return cells;
}

export function Calendar({
  now,
  month,
  selected,
  serviceId,
  sizeId,
  extraIds,
  taken,
  onMonthChange,
  onSelect,
}: CalendarProps) {
  const today = toISODate(now);
  const currentMonth = startOfMonth(now);
  const maxMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 3, 1);
  const title = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(month);
  const canPrev = month.getTime() > currentMonth.getTime();
  const canNext = month.getTime() < maxMonth.getTime();

  return (
    <section className="calendar" aria-labelledby="when-label">
      <div className="month-bar">
        <h2 id="when-label" className="section-label">
          When
        </h2>
        <div className="month-nav">
          <button
            type="button"
            className="icon-button"
            onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            disabled={!canPrev}
            aria-label="Previous month"
          >
            ‹
          </button>
          <p className="month-title">{title}</p>
          <button
            type="button"
            className="icon-button"
            onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            disabled={!canNext}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>

      <div className="weekdays" aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="cal-grid" role="group" aria-label={title}>
        {cellsFor(month).map((cell, index) => {
          if (!cell) return <span className="day day-empty" key={`empty-${index}`} />;

          const priced = quote({ serviceId, sizeId, date: cell.iso, extraIds });
          const open = openSlots(cell.iso, taken, now).length > 0 && Boolean(priced);
          const past = isPast(cell.iso, now);
          const label = !priced
            ? formatLongDate(cell.iso)
            : past
              ? `${formatLongDate(cell.iso)}, unavailable`
              : open
                ? `${formatLongDate(cell.iso)}, ${formatMoney(priced.total)}`
                : `${formatLongDate(cell.iso)}, fully booked`;

          return (
            <button
              type="button"
              key={cell.iso}
              className="day"
              disabled={!open}
              data-rate={priced?.rate.id}
              data-today={cell.iso === today ? "true" : "false"}
              aria-pressed={selected === cell.iso}
              aria-label={label}
              onClick={() => onSelect(cell.iso)}
            >
              <span className="num">{cell.day}</span>
              <span className="price">
                {open && priced ? formatMoney(priced.total) : past ? "" : "Full"}
              </span>
            </button>
          );
        })}
      </div>

      <p className="legend" id="price-legend">
        Tue and Wed are 10% less. Saturday is 15% more, Sunday 20% more. A full day has no times left.
      </p>
    </section>
  );
}
