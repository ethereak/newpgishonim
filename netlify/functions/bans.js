import { readJSONBody, ok, badRequest, serverError, requireAdmin } from "./_utils.mjs";
import { getStore } from "@netlify/blobs";
const store = getStore();

async function loadBans() {
  const raw = await store.get("bans.json");
  if (!raw) return { entries: [] };
  try { return JSON.parse(raw); } catch { return { entries: [] }; }
}

export const handler = async (event) => {
  try {
    if (event.httpMethod === "GET") {
      // PUBLIC read so Edge can fetch it
      return ok(await loadBans());
    }

    const admin = requireAdmin(event);
    if (!admin) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

    if (event.httpMethod === "POST") {
      const body = readJSONBody(event) || {};
      const pattern = (body.pattern || "").trim();
      const note = (body.note || "").trim();
      if (!pattern) return badRequest("pattern required (IP or CIDR like 1.2.3.0/24)");
      const bans = await loadBans();
      if (!bans.entries.find(e => e.pattern === pattern)) {
        bans.entries.push({ pattern, note, addedAt: new Date().toISOString() });
      }
      await store.set("bans.json", JSON.stringify(bans, null, 2));
      return ok({ ok: true });
    }

    if (event.httpMethod === "DELETE") {
      const body = readJSONBody(event) || {};
      const pattern = (body.pattern || "").trim();
      const bans = await loadBans();
      bans.entries = bans.entries.filter(e => e.pattern !== pattern);
      await store.set("bans.json", JSON.stringify(bans, null, 2));
      return ok({ ok: true });
    }

    return badRequest("Unsupported method");
  } catch (e) {
    return serverError(e);
  }
};
