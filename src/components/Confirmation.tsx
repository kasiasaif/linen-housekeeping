import { formatMoney } from "../lib/pricing.ts";
import type { BookingReceipt } from "../types.ts";

type ConfirmationProps = {
  booking: BookingReceipt;
  onReset: () => void;
};

function icsStamp(date: string, time: string) {
  const [hour, minute] = time.split(":");
  return `${date.replaceAll("-", "")}T${hour}${minute}00`;
}

function icsEscape(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function downloadCalendar(booking: BookingReceipt) {
  const description = `Reference ${booking.reference}. ${booking.serviceName}, ${booking.sizeLabel}. ${formatMoney(booking.total)}.`;
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Linen//Booking//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${booking.reference}@linen.local`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`,
    `DTSTART:${icsStamp(booking.date, booking.time)}`,
    `DTEND:${icsStamp(booking.endDate, booking.endTime)}`,
    `SUMMARY:${icsEscape(`Linen ${booking.serviceName}`)}`,
    `LOCATION:${icsEscape(`${booking.address}, ${booking.postcode}`)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const file = new File([body], `${booking.reference}.ics`, { type: "text/calendar" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}

export function Confirmation({ booking, onReset }: ConfirmationProps) {
  const emailCopy =
    booking.emailStatus === "sent"
      ? `A confirmation is on its way to ${booking.email}.`
      : booking.emailStatus === "activation"
        ? `The app emailed ${booking.email}. Open that message and click Activate Form so the confirmation can be delivered.`
        : booking.emailStatus === "preview"
          ? `The confirmation for ${booking.email} is ready, along with a booking alert.`
          : booking.emailStatus === "failed"
            ? `Your visit is reserved, but the email to ${booking.email} could not be sent.`
            : `Your visit is reserved. The confirmation to ${booking.email} is sent once Brevo is connected.`;

  return (
    <section className="confirm" aria-live="polite">
      <p className="eyebrow">Confirmed</p>
      <h1>You're booked.</h1>
      <p className="lede">{booking.displayDate}, {booking.window}.</p>
      <p className="reference">Reference {booking.reference}</p>
      <p className={booking.emailSent ? "banner" : "banner warn"}>{emailCopy}</p>

      <dl className="receipt">
        <div>
          <dt>Reference</dt>
          <dd>{booking.reference}</dd>
        </div>
        <div>
          <dt>Service</dt>
          <dd>
            {booking.serviceName}, {booking.sizeLabel}
          </dd>
        </div>
        <div>
          <dt>When</dt>
          <dd>
            {booking.displayDate}
            <span>{booking.window}</span>
          </dd>
        </div>
        <div>
          <dt>Address</dt>
          <dd>
            {booking.address}
            <span>{booking.postcode}</span>
          </dd>
        </div>
        <div>
          <dt>{booking.rateLabel} visit</dt>
          <dd>{formatMoney(booking.visit)}</dd>
        </div>
        {booking.extras.map((extra) => (
          <div key={extra.label}>
            <dt>{extra.label}</dt>
            <dd>{formatMoney(extra.price)}</dd>
          </div>
        ))}
        <div className="grand">
          <dt>Total</dt>
          <dd>{formatMoney(booking.total)}</dd>
        </div>
      </dl>

      <div className="actions">
        <button type="button" className="button primary" onClick={onReset}>
          Book another visit
        </button>
        <button type="button" className="button ghost" onClick={() => downloadCalendar(booking)}>
          Add to calendar
        </button>
        {booking.previewUrl ? (
          <a className="button ghost" href={booking.previewUrl} target="_blank" rel="noreferrer">
            Open confirmation email
          </a>
        ) : null}
        {booking.notifyUrl ? (
          <a className="button ghost" href={booking.notifyUrl} target="_blank" rel="noreferrer">
            Open booking alert
          </a>
        ) : null}
      </div>
    </section>
  );
}
