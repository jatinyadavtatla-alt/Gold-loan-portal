import { randomInt } from "node:crypto";

/** Build a JSON POST Request object suitable for calling a route handler directly. */
export function postJson(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Indian mobiles that are valid but unique per call, so tests never collide. */
export function uniqueMobile(): string {
  return `98${randomInt(0, 99_999_999).toString().padStart(8, "0")}`;
}

export const API_BASE = "http://localhost/api/v1";
