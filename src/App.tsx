import { useEffect, useRef, useState } from "react";
import { Calendar } from "./components/Calendar.tsx";
import { Confirmation } from "./components/Confirmation.tsx";
import { Ticket } from "./components/Ticket.tsx";
import {
  EXTRAS,
  SERVICES,
  SIZES,
  extraPrice,
  formatMoney,
  formatShortDate,
  formatTime,
  quote,
  startingPrice,
  type ExtraId,
  type ServiceId,
  type SizeId,
} from "./lib/pricing.ts";
import type { BookingReceipt, Details } from "./types.ts";

const EMPTY_DETAILS: Details = {
  name: "",
  email: "",
  phone: "",
  address: "",
  postcode: "",
  notes: "",
};

const FIELD_ORDER = ["name", "email", "phone", "address", "postcode"] as const;

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function validate(details: Details) {
  const errors: Partial<Record<keyof Details, string>> = {};
  if (details.name.trim().length < 2) errors.name = "Enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim())) {
    errors.email = "Enter a valid email.";
  }
  const digits = details.phone.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) errors.phone = "Enter a phone number.";
  if (details.address.trim().length < 5) errors.address = "Enter the address to clean.";
  if (details.postcode.trim().length < 2) errors.postcode = "Enter a postcode.";
  return errors;
}

export default function App() {
  const [now, setNow] = useState(() => new Date());
  const [serviceId, setServiceId] = useState<ServiceId>("refresh");
  const [sizeId, setSizeId] = useState<SizeId>("2");
  const [extraIds, setExtraIds] = useState<ExtraId[]>([]);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [errors, setErrors] = useState<Partial<Record<keyof Details, string>>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [taken, setTaken] = useState<Record<string, string[]>>({});
  const [offline, setOffline] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmation, setConfirmation] = useState<BookingReceipt | null>(null);
  const [ticketVisible, setTicketVisible] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  const service = SERVICES.find((item) => item.id === serviceId) ?? SERVICES[0];
  const size = SIZES.find((item) => item.id === sizeId) ?? SIZES[2];
  const visitQuote = date ? quote({ serviceId, sizeId, date, extraIds }) : null;
  const showBar = Boolean(date && visitQuote && !ticketVisible && !confirmation);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const timers: number[] = [];
    let cancel = false;

    async function load(attempt = 0) {
      try {
        const response = await fetch("/api/availability");
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { taken?: Record<string, string[]> };
        if (cancel) return;
        setTaken(data.taken ?? {});
        setOffline(false);
      } catch {
        if (cancel) return;
        if (attempt < 3) {
          timers.push(window.setTimeout(() => void load(attempt + 1), 500));
          return;
        }
        setOffline(true);
      }
    }

    void load();
    return () => {
      cancel = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [refreshKey]);

  useEffect(() => {
    if (confirmation) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [confirmation]);

  useEffect(() => {
    const node = ticketRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setTicketVisible(entry.isIntersecting), {
      threshold: 0.2,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [confirmation]);

  function toggleExtra(id: ExtraId) {
    setExtraIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function selectDate(iso: string) {
    setDate(iso);
    setTime(null);
    setFormError("");
  }

  async function submit() {
    if (!date || !time) return;
    const nextErrors = validate(details);
    setErrors(nextErrors);
    const firstInvalid = FIELD_ORDER.find((field) => nextErrors[field]);
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      setFormError("");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          sizeId,
          extraIds,
          date,
          time,
          name: details.name.trim(),
          email: details.email.trim(),
          phone: details.phone.trim(),
          address: details.address.trim(),
          postcode: details.postcode.trim(),
          notes: details.notes.trim(),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        booking?: BookingReceipt;
      };

      if (response.status === 409) {
        setTime(null);
        setFormError(data.error ?? "That time has just been booked. Please choose another.");
        setRefreshKey((key) => key + 1);
        return;
      }
      if (!response.ok || !data.booking) {
        setFormError(data.error ?? "We couldn't reserve that visit. Please try again.");
        return;
      }

      setConfirmation(data.booking);
      setDate(null);
      setTime(null);
      setErrors({});
      setDetails((current) => ({ ...current, notes: "" }));
      setRefreshKey((key) => key + 1);
    } catch {
      setFormError("We couldn't reach the booking desk. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function bookAnother() {
    setConfirmation(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="app">
      <a className="skip" href="#booking">
        Skip to booking
      </a>
      <header className="header">
        <div className="header-inner">
          <button type="button" className="wordmark" onClick={bookAnother}>
            Linen
            <span>Housekeeping</span>
          </button>
          <p className="header-note">By appointment</p>
        </div>
      </header>

      {confirmation ? (
        <Confirmation booking={confirmation} onReset={bookAnother} />
      ) : (
        <main className={showBar ? "shell has-bar" : "shell"} id="booking">
          <div className="layout">
            <div className="chooser">
              <div className="intro">
                <h1>See the price, then pick the day.</h1>
                <p className="lede">The calendar shows the full visit price for the clean and home you choose.</p>
                {offline ? (
                  <p className="offline">The booking desk is reconnecting. You can still look through prices.</p>
                ) : null}
              </div>

              <section className="picker">
                <h2 className="section-label">Kind of clean</h2>
                <div className="services" role="group" aria-label="Kind of clean">
                  {SERVICES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="service"
                      aria-pressed={serviceId === item.id}
                      onClick={() => setServiceId(item.id)}
                    >
                      <strong>{item.name}</strong>
                      <em>{formatMoney(startingPrice(item.id, sizeId, extraIds))}</em>
                    </button>
                  ))}
                </div>
                <p className="service-note">{service.summary}</p>
              </section>

              <section className="picker">
                <h2 className="section-label">Home</h2>
                <div className="choices" role="group" aria-label="Home size">
                  {SIZES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="choice"
                      aria-pressed={sizeId === item.id}
                      onClick={() => setSizeId(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="picker">
                <h2 className="section-label">Extras</h2>
                <div className="choices" role="group" aria-label="Extras">
                  {EXTRAS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="choice"
                      aria-pressed={extraIds.includes(item.id)}
                      onClick={() => toggleExtra(item.id)}
                    >
                      {item.label}
                      <span> {formatMoney(extraPrice(item.id, sizeId))}</span>
                    </button>
                  ))}
                </div>
              </section>

              <Calendar
                now={now}
                month={month}
                selected={date}
                serviceId={serviceId}
                sizeId={sizeId}
                extraIds={extraIds}
                taken={taken}
                onMonthChange={setMonth}
                onSelect={selectDate}
              />
            </div>

            <div ref={ticketRef}>
              <Ticket
                service={service}
                size={size}
                quote={visitQuote}
                now={now}
                date={date}
                time={time}
                taken={taken}
                details={details}
                errors={errors}
                formError={formError}
                submitting={submitting}
                onTime={(slot) => {
                  setTime(slot);
                  setFormError("");
                }}
                onDetails={(next) => {
                  setDetails(next);
                  setErrors({});
                }}
                onSubmit={() => void submit()}
              />
            </div>
          </div>
        </main>
      )}

      {showBar && date && visitQuote ? (
        <div className="mobile-bar">
          <div>
            <strong>{formatMoney(visitQuote.total)}</strong>
            <span>
              {formatShortDate(date)}
              {time ? ` · ${formatTime(time)}` : ""}
            </span>
          </div>
          <button type="button" onClick={() => ticketRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            {time ? "Your details" : "See times"}
          </button>
        </div>
      ) : null}

      <footer className="footer">
        <div className="footer-inner">
          <p>Linen housekeeping</p>
          <p>The price on the calendar is the full visit.</p>
        </div>
      </footer>
    </div>
  );
}
