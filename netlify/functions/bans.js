import { readJSONBody, ok, badRequest, serverError, requireAdmin } from "./_utils.mjs";
import { get, set } from "@netlify/blobs";

async function loadBans() {
  const raw = await get("bans.json");
  if (!raw) return { entries: [] };
  try { return JSON.parse(raw); } catch { return { entries: [] }; }
}

export const handler = async (event) => {
  try {
    if (event.httpMethod === "GET") {
      return ok(await loadBans()); // public read
    }

    const admin = requireAdmin(event);
    if (!admin) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

    if (event.httpMethod === "POST") {
      const body = readJSONBody(event) || {};
      const bans = { entries: body.entries || [] };
      await set("bans.json", JSON.stringify(bans, null, 2));
      return ok({ ok: true });
    }

    return badRequest("Unsupported method");
  } catch (e) {
    return serverError(e);
  }
};
