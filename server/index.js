import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXTRAS,
  SERVICES,
  SIZES,
  SLOTS,
  endDateTime,
  formatHours,
  formatLongDate,
  formatWindow,
  isRealDate,
  openSlots,
  quote,
  takenMap,
} from "../src/lib/pricing.ts";
import { emailIsConfigured, sendConfirmation } from "./email.js";
import { addBooking, connectStore, readBookings, usingDatabase } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, "../dist");
const port = Number(process.env.PORT || 3001);

let queue = Promise.resolve();

function withBookings(task) {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function text(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function validate(body, bookings) {
  const serviceId = text(body.serviceId, 40);
  const sizeId = text(body.sizeId, 20);
  const date = text(body.date, 10);
  const time = text(body.time, 5);
  const name = text(body.name, 80);
  const email = text(body.email, 120).toLowerCase();
  const phone = text(body.phone, 30);
  const address = text(body.address, 160);
  const postcode = text(body.postcode, 12).toUpperCase();
  const notes = text(body.notes, 400);
  const extraIds = Array.isArray(body.extraIds)
    ? [...new Set(body.extraIds.map((id) => text(id, 40)))]
    : [];

  if (!SERVICES.some((service) => service.id === serviceId)) {
    return { error: "Choose a type of clean." };
  }
  if (!SIZES.some((size) => size.id === sizeId)) {
    return { error: "Choose a home size." };
  }
  if (!extraIds.every((id) => EXTRAS.some((extra) => extra.id === id))) {
    return { error: "One of the extras isn't available." };
  }
  if (!isRealDate(date)) return { error: "Choose a date." };
  if (!SLOTS.includes(time)) return { error: "Choose a time." };

  const priced = quote({ serviceId, sizeId, date, extraIds });
  if (!priced) return { error: "We couldn't price that visit." };

  const slots = openSlots(date, takenMap(bookings));
  if (!slots.includes(time)) {
    return { error: "That time has just been booked. Please choose another.", status: 409 };
  }
  if (name.length < 2) return { error: "Enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return { error: "Enter a phone number." };
  if (address.length < 5) return { error: "Enter the address to clean." };
  if (postcode.length < 2) return { error: "Enter a postcode." };

  const end = endDateTime(date, time, priced.hours);
  return {
    value: {
      serviceId,
      serviceName: priced.service.name,
      sizeId,
      sizeLabel: priced.size.label,
      extraIds,
      extras: priced.extras.map((extra) => ({ label: extra.label, price: extra.price })),
      date,
      displayDate: formatLongDate(date),
      time,
      endTime: end.time,
      endDate: end.date,
      window: formatWindow(date, time, priced.hours),
      hours: priced.hours,
      hoursLabel: formatHours(priced.hours),
      visit: priced.visit,
      extrasTotal: priced.extrasTotal,
      total: priced.total,
      rateLabel: priced.rate.label,
      name,
      email,
      phone,
      address,
      postcode,
      notes,
    },
  };
}

function referenceFrom(bookings) {
  const used = new Set(bookings.map((booking) => booking.reference));
  let reference = "";
  do {
    reference = `LN-${Math.floor(10000 + Math.random() * 90000)}`;
  } while (used.has(reference));
  return reference;
}

function present(booking) {
  return {
    reference: booking.reference,
    serviceName: booking.serviceName,
    sizeLabel: booking.sizeLabel,
    extras: booking.extras,
    date: booking.date,
    displayDate: booking.displayDate,
    time: booking.time,
    endTime: booking.endTime,
    endDate: booking.endDate,
    timeLabel: booking.window.split(" – ")[0],
    window: booking.window,
    hoursLabel: booking.hoursLabel,
    visit: booking.visit,
    extrasTotal: booking.extrasTotal,
    total: booking.total,
    rateLabel: booking.rateLabel,
    name: booking.name,
    email: booking.email,
    phone: booking.phone,
    address: booking.address,
    postcode: booking.postcode,
    notes: booking.notes,
    emailSent: booking.emailSent,
    emailStatus: booking.emailStatus,
    previewUrl: booking.previewUrl || "",
    notifyUrl: booking.notifyUrl || "",
  };
}

const app = express();
app.use(express.json({ limit: "20kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, email: emailIsConfigured() });
});

app.get("/api/availability", async (_req, res) => {
  const bookings = await readBookings();
  res.json({ taken: takenMap(bookings) });
});

app.post("/api/bookings", async (req, res) => {
  try {
    const result = await withBookings(async () => {
      const bookings = await readBookings();
      const parsed = validate(req.body ?? {}, bookings);
      if (parsed.error) {
        return { status: parsed.status ?? 400, body: { error: parsed.error } };
      }

      const reference = referenceFrom(bookings);
      const draft = { ...parsed.value, reference, createdAt: new Date().toISOString() };
      const delivery = await sendConfirmation(draft);
      const booking = { ...draft, ...delivery };
      await addBooking(booking);
      console.log(
        `Booked ${reference} for ${booking.email} — email ${booking.emailStatus}`,
      );
      return { status: 201, body: { booking: present(booking) } };
    });

    res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "We couldn't reserve that visit. Please try again." });
  }
});

app.use(express.static(dist));
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api")) return next();
  res.sendFile(path.join(dist, "index.html"), (error) => {
    if (error) next();
  });
});
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

await connectStore();

app.listen(port, () => {
  console.log(`Linen booking API on http://localhost:${port}`);
  console.log(usingDatabase ? "Bookings are saved in MongoDB." : "Bookings are saved in server/data/bookings.json. Add MONGODB_URI to keep them in MongoDB.");
  console.log(emailIsConfigured() ? "Brevo is ready. Confirmations send from hello@linenhousekeeping.co.uk." : "Brevo is not connected yet. Add the API key to .env and bookings will email the customer.");
});
