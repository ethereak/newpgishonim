const { readJSONBody, ok, badRequest, serverError, requireAdmin } = require("./_utils.js");
const { get, set } = require("@netlify/blobs");

async function loadBans() {
  const raw = await get("bans.json");
  if (!raw) return { entries: [] };
  try { return JSON.parse(raw); } catch { return { entries: [] }; }
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "GET") return ok(await loadBans()); // public for Edge
    if (!requireAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

    if (event.httpMethod === "POST") {
      const body = readJSONBody(event) || {};
      const pattern = (body.pattern || "").trim();
      const note = (body.note || "").trim();
      if (!pattern) return badRequest("pattern required");
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
  } catch (e) { return serverError(e); }
};
