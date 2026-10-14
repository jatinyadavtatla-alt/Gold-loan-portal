/**
 * Human-friendly application reference numbers, e.g. GL-20260314-K4Q9M2.
 * Server-only: uses node:crypto.
 */
import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O, 1/I, L

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function newApplicationId(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = pad2(date.getUTCMonth() + 1);
  const d = pad2(date.getUTCDate());
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    suffix += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `GL-${y}${m}${d}-${suffix}`;
}
