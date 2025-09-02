const { ok, badRequest, serverError, requireAdmin } = require("./_utils.js");
const { list, get } = require("@netlify/blobs");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return badRequest("GET only");
  try {
    if (!requireAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

    const limit = Math.max(1, Math.min(50, parseInt(event.queryStringParameters?.limit || "20", 10)));
    const cursor = event.queryStringParameters?.cursor || undefined;
    const { blobs, cursor: nextCursor } = await list({ prefix: "logs/", cursor, limit });

    const items = [];
    for (const b of blobs) {
      const raw = await get(b.key);
      try { items.push({ key: b.key, ...(JSON.parse(raw || "{}")) }); }
      catch { items.push({ key: b.key, raw }); }
    }
    items.sort((a, b) => b.key.localeCompare(a.key));
    return ok({ items, cursor: nextCursor || null });
  } catch (e) { return serverError(e); }
};
