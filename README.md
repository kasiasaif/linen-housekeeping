# Linen

A booking app for a housekeeping service. Customers choose a clean, see the price on the calendar, and receive a confirmation email.

## Run it

```bash
npm install
npm run dev
```

Open the local address Vite prints. On a phone, use the network address on the same Wi-Fi.

## Confirmation email

Copy `.env.example` to `.env`, add your Brevo API key and the verified sender address, then restart.

Brevo’s free plan allows 300 emails a day and does not expire. In Brevo, verify the sender address under Senders, then create an API key under SMTP & API.

Without those settings, bookings are still saved in `server/data/bookings.json`, and the confirmation screen says the email was not sent.
