import { ok, badRequest, serverError } from "./_utils.js";
import { set } from "@netlify/blobs";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return badRequest("POST only");
    const body = JSON.parse(event.body || "{}");

    const key = `logs/${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    await set(key, JSON.stringify(body, null, 2));

    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
};
