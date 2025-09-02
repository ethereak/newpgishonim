const { readJSONBody, ok, badRequest, serverError, requireAdmin } = require("./_utils.js");
const { blobsStore } = require("./_blobs.js");

async function loadBans() {
  const store = await blobsStore();
  const raw = await store.get("bans.json");
  if (!raw) return { entries: [] };
  try { return JSON.parse(raw); } catch { return { entries: [] }; }
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "GET") {
      // Public read so the Edge middleware can check bans
      return ok(await loadBans());
    }

    if (!requireAdmin(event)) {
      return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    }

    const store = await blobsStore();

    if (event.httpMethod === "POST") {
      const body = readJSONBody(event) || {};
      const pattern = (body.pattern || "").trim();
      const note = (body.note || "").trim();
      if (!pattern) return badRequest("pattern required");

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
    console.error("[bans] failed:", e);
    return serverError(e);
  }
};
