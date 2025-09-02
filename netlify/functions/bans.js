import { readJSONBody, ok, badRequest, serverError, requireAdmin } from "./_utils.mjs";
import { get, set } from "@netlify/blobs";

async function loadBans() {
  const raw = await get("bans.json");
  if (!raw) return { entries: [] };
  try { return JSON.parse(raw); } catch { return { entries: [] }; }
}

export const handler = async (event) => {
  const admin = requireAdmin(event);
  if (!admin) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  try {
    if (event.httpMethod === "GET") {
      const bans = await loadBans();
      return ok(bans);
    }

    if (event.httpMethod === "POST") {
      const body = readJSONBody(event) || {};
      const pattern = (body.pattern || "").trim();
      const note = (body.note || "").trim();
      if (!pattern) return badRequest("pattern required (IP or CIDR like 1.2.3.0/24)");
      const bans = await loadBans();
      if (!bans.entries.find(e => e.pattern === pattern)) {
        bans.entries.push({ pattern, note, addedAt: new Date().toISOString() });
      }
      await set("bans.json", JSON.stringify(bans, null, 2));
      return ok({ ok: true });
    }

    if (event.httpMethod === "DELETE") {
      const body = readJSONBody(event) || {};
      const pattern = (body.pattern || "").trim();
      const bans = await loadBans();
      bans.entries = bans.entries.filter(e => e.pattern !== pattern);
      await set("bans.json", JSON.stringify(bans, null, 2));
      return ok({ ok: true });
    }

    return badRequest("Unsupported method");
  } catch (e) {
    return serverError(e);
  }
};