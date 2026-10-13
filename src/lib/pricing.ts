export type ServiceId = "refresh" | "deep" | "tenancy" | "aftercare";
export type SizeId = "studio" | "1" | "2" | "3" | "4" | "5";
export type ExtraId = "oven" | "fridge" | "windows" | "laundry";

export type Service = {
  id: ServiceId;
  name: string;
  summary: string;
  hours: number[];
};

export type Size = {
  id: SizeId;
  label: string;
};

export type Extra = {
  id: ExtraId;
  label: string;
  price: number;
};

export type DayRate = {
  id: "midweek" | "weekday" | "saturday" | "sunday";
  label: string;
  factor: number;
};

export type Quote = {
  service: Service;
  size: Size;
  rate: DayRate;
  visit: number;
  extras: Extra[];
  extrasTotal: number;
  total: number;
  hours: number;
};

export const SERVICES: Service[] = [
  {
    id: "refresh",
    name: "Refresh",
    summary: "A regular clean of surfaces, floors, the kitchen and bathrooms.",
    hours: [2, 2.5, 3, 3.5, 4.5, 5.5],
  },
  {
    id: "deep",
    name: "Deep clean",
    summary: "Inside appliances, skirtings, and the details a weekly clean skips.",
    hours: [3.5, 4, 4.5, 5.5, 6.5, 7.5],
  },
  {
    id: "tenancy",
    name: "End of tenancy",
    summary: "Move-out standard, including cupboards and inside appliances.",
    hours: [4, 5, 6, 7, 8, 9],
  },
  {
    id: "aftercare",
    name: "After builders",
    summary: "Dust, debris and a first clean once the work is finished.",
    hours: [3.5, 4.5, 5.5, 6.5, 7.5, 8.5],
  },
];

export const SIZES: Size[] = [
  { id: "studio", label: "Studio" },
  { id: "1", label: "1 bed" },
  { id: "2", label: "2 bed" },
  { id: "3", label: "3 bed" },
  { id: "4", label: "4 bed" },
  { id: "5", label: "5+ beds" },
];

export const EXTRAS: Extra[] = [
  { id: "oven", label: "Inside oven", price: 28 },
  { id: "fridge", label: "Inside fridge", price: 22 },
  { id: "windows", label: "Interior windows", price: 32 },
  { id: "laundry", label: "Laundry and ironing", price: 18 },
];

const WINDOW_PRICES = [18, 24, 32, 42, 54, 68];

export function extraPrice(extraId: string, sizeId: string) {
  const extra = EXTRAS.find((item) => item.id === extraId);
  if (!extra) return 0;
  if (extra.id !== "windows") return extra.price;
  const sizeIndex = SIZES.findIndex((item) => item.id === sizeId);
  return sizeIndex < 0 ? extra.price : WINDOW_PRICES[sizeIndex];
}

const BASE: Record<ServiceId, number[]> = {
  refresh: [79, 99, 129, 159, 199, 239],
  deep: [149, 179, 219, 269, 329, 389],
  tenancy: [189, 229, 279, 339, 409, 479],
  aftercare: [169, 209, 249, 309, 369, 439],
};

export const SLOTS = ["08:00", "10:00", "12:30", "15:00"];

export function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseISODate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isRealDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return toISODate(parseISODate(iso)) === iso;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function dayRate(iso: string): DayRate {
  const day = parseISODate(iso).getDay();
  if (day === 2 || day === 3) return { id: "midweek", label: "Midweek", factor: 0.9 };
  if (day === 6) return { id: "saturday", label: "Saturday", factor: 1.15 };
  if (day === 0) return { id: "sunday", label: "Sunday", factor: 1.2 };
  return { id: "weekday", label: "Weekday", factor: 1 };
}

export function isPast(iso: string, now = new Date()) {
  return iso < toISODate(now);
}

export function isClosed(iso: string, now = new Date()) {
  if (iso === toISODate(now)) return false;
  return hashString(`closed:${iso}`) % 8 === 0;
}

export function availableSlots(iso: string, now = new Date()) {
  if (!isRealDate(iso) || isPast(iso, now) || isClosed(iso, now)) return [];

  const blocked = hashString(`slot:${iso}`) % SLOTS.length;
  let slots = SLOTS.filter((_, index) => index !== blocked);
  if (slots.length < 2) slots = SLOTS.slice(0, 3);

  if (iso === toISODate(now)) {
    const minutesNow = now.getHours() * 60 + now.getMinutes();
    slots = slots.filter((slot) => {
      const [hour, minute] = slot.split(":").map(Number);
      return hour * 60 + minute >= minutesNow + 90;
    });
  }

  return slots;
}

export function takenMap(bookings: { date: string; time: string }[]) {
  const taken: Record<string, string[]> = {};
  for (const booking of bookings) {
    const slots = taken[booking.date] ?? [];
    slots.push(booking.time);
    taken[booking.date] = slots;
  }
  return taken;
}

export function openSlots(iso: string, taken: Record<string, string[]> = {}, now = new Date()) {
  const used = new Set(taken[iso] ?? []);
  return availableSlots(iso, now).filter((slot) => !used.has(slot));
}

export function quote(input: {
  serviceId: string;
  sizeId: string;
  date: string;
  extraIds?: string[];
}): Quote | null {
  const service = SERVICES.find((item) => item.id === input.serviceId);
  const sizeIndex = SIZES.findIndex((item) => item.id === input.sizeId);
  if (!service || sizeIndex < 0 || !isRealDate(input.date)) return null;

  const extras = EXTRAS.filter((item) => input.extraIds?.includes(item.id)).map((item) => ({
    ...item,
    price: extraPrice(item.id, input.sizeId),
  }));
  const extrasTotal = extras.reduce((sum, item) => sum + item.price, 0);
  const visit = Math.round(BASE[service.id][sizeIndex] * dayRate(input.date).factor);

  return {
    service,
    size: SIZES[sizeIndex],
    rate: dayRate(input.date),
    visit,
    extras,
    extrasTotal,
    total: visit + extrasTotal,
    hours: service.hours[sizeIndex],
  };
}

export function startingPrice(serviceId: ServiceId, sizeId: SizeId, extraIds: ExtraId[] = []) {
  const sizeIndex = SIZES.findIndex((item) => item.id === sizeId);
  const extrasTotal = extraIds.reduce((sum, id) => sum + extraPrice(id, sizeId), 0);
  return Math.round(BASE[serviceId][sizeIndex] * 0.9) + extrasTotal;
}

export function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatLongDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseISODate(iso));
}

export function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(parseISODate(iso));
}

export function formatTime(value: string) {
  const [hourValue, minuteValue] = value.split(":").map(Number);
  const suffix = hourValue >= 12 ? "pm" : "am";
  const hour = hourValue % 12 || 12;
  const minute = String(minuteValue).padStart(2, "0");
  return `${hour}:${minute} ${suffix}`;
}

export function formatHours(hours: number) {
  const whole = Math.floor(hours);
  const half = Math.abs(hours - whole - 0.5) < 0.001;
  if (half) return `about ${whole}½ hours`;
  if (hours === 1) return "about 1 hour";
  return `about ${hours} hours`;
}

export function endDateTime(iso: string, start: string, hours: number) {
  const [hour, minute] = start.split(":").map(Number);
  const total = hour * 60 + minute + Math.round(hours * 60);
  const end = parseISODate(iso);
  end.setDate(end.getDate() + Math.floor(total / (24 * 60)));
  const minutes = total % (24 * 60);
  return {
    date: toISODate(end),
    time: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
  };
}

export function formatWindow(iso: string, start: string, hours: number) {
  const end = endDateTime(iso, start, hours);
  const label = `${formatTime(start)} – ${formatTime(end.time)}`;
  if (end.date === iso) return label;
  return `${label} (${formatShortDate(end.date)})`;
}
