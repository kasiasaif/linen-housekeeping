import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.join(__dirname, "data", "bookings.json");
const uri = process.env.MONGODB_URI?.trim();

let collection;

async function mongo() {
  if (!collection) {
    const client = new MongoClient(uri);
    await client.connect();
    collection = client.db(process.env.MONGODB_DB || "linen").collection("bookings");
    await collection.createIndex({ reference: 1 }, { unique: true });
    await collection.createIndex({ date: 1, time: 1 }, { unique: true });
  }
  return collection;
}

async function readFile() {
  try {
    return JSON.parse(await fs.readFile(dataFile, "utf8"));
  } catch {
    return [];
  }
}

export const usingDatabase = Boolean(uri);

export async function connectStore() {
  if (usingDatabase) await mongo();
}

export async function readBookings() {
  if (!usingDatabase) return readFile();
  return (await mongo()).find({}, { projection: { _id: 0 } }).toArray();
}

export async function addBooking(booking) {
  if (usingDatabase) {
    await (await mongo()).insertOne({ ...booking });
    return;
  }
  const bookings = await readFile();
  bookings.push(booking);
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(bookings, null, 2));
}
