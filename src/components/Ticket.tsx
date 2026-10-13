import { useEffect, useRef } from "react";
import {
  formatHours,
  formatLongDate,
  formatMoney,
  formatTime,
  formatWindow,
  openSlots,
  type Quote,
  type Service,
  type Size,
} from "../lib/pricing.ts";
import type { Details } from "../types.ts";

type TicketProps = {
  service: Service;
  size: Size;
  quote: Quote | null;
  now: Date;
  date: string | null;
  time: string | null;
  taken: Record<string, string[]>;
  details: Details;
  errors: Partial<Record<keyof Details, string>>;
  formError: string;
  submitting: boolean;
  onTime: (time: string) => void;
  onDetails: (details: Details) => void;
  onSubmit: () => void;
};

export function Ticket({
  service,
  size,
  quote,
  now,
  date,
  time,
  taken,
  details,
  errors,
  formError,
  submitting,
  onTime,
  onDetails,
  onSubmit,
}: TicketProps) {
  const detailsRef = useRef<HTMLFormElement>(null);
  const hadTime = useRef(false);

  useEffect(() => {
    if (time && !hadTime.current && window.matchMedia("(max-width: 899px)").matches) {
      detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    hadTime.current = Boolean(time);
  }, [time]);

  const slots = date ? openSlots(date, taken, now) : [];

  function update(field: keyof Details, value: string) {
    onDetails({ ...details, [field]: value });
  }

  return (
    <aside className="ticket" id="ticket" aria-label="Your visit">
      <p className="ticket-kicker">Your visit</p>
      <h2>{service.name}</h2>
      <p className="ticket-size">{size.label}</p>

      {date && quote ? (
        <>
          <p className="when-line">{formatLongDate(date)}</p>
          <p className="duration">{time ? formatWindow(date, time, quote.hours) : formatHours(quote.hours)}</p>
          <div className="lines">
            <div>
              <span>{quote.rate.label} visit</span>
              <span>{formatMoney(quote.visit)}</span>
            </div>
            {quote.extras.map((extra) => (
              <div key={extra.id}>
                <span>{extra.label}</span>
                <span>{formatMoney(extra.price)}</span>
              </div>
            ))}
            <div className="grand" aria-live="polite">
              <span>Total</span>
              <span>{formatMoney(quote.total)}</span>
            </div>
          </div>
        </>
      ) : (
        <p className="ticket-hint">Choose a date. The price on each day is the full visit, including any extras.</p>
      )}

      {date ? (
        <fieldset className="slots-field">
          <legend>Time</legend>
          {slots.length > 0 ? (
            <div className="slots">
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className="slot"
                  aria-pressed={time === slot}
                  onClick={() => onTime(slot)}
                >
                  {formatTime(slot)}
                </button>
              ))}
            </div>
          ) : (
            <p className="ticket-hint">No times left on this day.</p>
          )}
        </fieldset>
      ) : null}

      {date && time && quote ? (
        <form
          className="details"
          id="details"
          ref={detailsRef}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <h3>Your details</h3>
          <Field
            id="name"
            label="Full name"
            value={details.name}
            error={errors.name}
            autoComplete="name"
            onChange={(value) => update("name", value)}
          />
          <Field
            id="email"
            label="Email"
            type="email"
            value={details.email}
            error={errors.email}
            autoComplete="email"
            onChange={(value) => update("email", value)}
          />
          <Field
            id="phone"
            label="Phone"
            type="tel"
            value={details.phone}
            error={errors.phone}
            autoComplete="tel"
            onChange={(value) => update("phone", value)}
          />
          <Field
            id="address"
            label="Address"
            value={details.address}
            error={errors.address}
            autoComplete="street-address"
            onChange={(value) => update("address", value)}
          />
          <Field
            id="postcode"
            label="Postcode"
            value={details.postcode}
            error={errors.postcode}
            autoComplete="postal-code"
            onChange={(value) => update("postcode", value.toUpperCase())}
          />
          <label className="field" htmlFor="notes">
            Access notes
            <textarea
              id="notes"
              value={details.notes}
              maxLength={400}
              placeholder="Key safe, pets, parking"
              onChange={(event) => update("notes", event.target.value)}
            />
          </label>

          {formError ? (
            <p className="err" role="alert">
              {formError}
            </p>
          ) : null}

          <button className="submit" type="submit" disabled={submitting}>
            {submitting ? "Sending confirmation…" : `Confirm · ${formatMoney(quote.total)}`}
          </button>
          <p className="fine-print">We'll email the confirmation. No payment is taken online.</p>
        </form>
      ) : null}
    </aside>
  );
}

function Field({
  id,
  label,
  value,
  error,
  onChange,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete: string;
}) {
  return (
    <label className="field" htmlFor={id}>
      {label}
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <span className="err" id={`${id}-error`}>
          {error}
        </span>
      ) : null}
    </label>
  );
}
