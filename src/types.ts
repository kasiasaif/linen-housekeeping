export type Details = {
  name: string;
  email: string;
  phone: string;
  address: string;
  postcode: string;
  notes: string;
};

export type BookingReceipt = {
  reference: string;
  serviceName: string;
  sizeLabel: string;
  extras: { label: string; price: number }[];
  date: string;
  displayDate: string;
  time: string;
  endTime: string;
  endDate: string;
  timeLabel: string;
  window: string;
  hoursLabel: string;
  visit: number;
  extrasTotal: number;
  total: number;
  rateLabel: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  postcode: string;
  notes: string;
  emailSent: boolean;
  emailStatus: "sent" | "preview" | "activation" | "not_configured" | "failed";
  previewUrl: string;
  notifyUrl: string;
};
