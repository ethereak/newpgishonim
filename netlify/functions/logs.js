const { ok, badRequest, serverError, requireAdmin } = require("./_utils.js");
const { blobsStore } = require("./_blobs.js");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") return badRequest("GET only");
    if (!requireAdmin(event)) {
      return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    }

    const limit = Math.max(1, Math.min(50, parseInt(event.queryStringParameters?.limit || "20", 10)));
    const cursor = event.queryStringParameters?.cursor || undefined;

    const store = await blobsStore();
    const { blobs, cursor: nextCursor } = await store.list({ prefix: "logs/", cursor, limit });

    const items = [];
    for (const b of blobs) {
      const raw = await store.get(b.key);
      try { items.push({ key: b.key, ...(JSON.parse(raw || "{}")) }); }
      catch { items.push({ key: b.key, raw }); }
    }
    items.sort((a, b) => b.key.localeCompare(a.key));

    return ok({ items, cursor: nextCursor || null });
  } catch (e) {
    console.error("[logs] failed:", e);
    return serverError(e);
  }
};
