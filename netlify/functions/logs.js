import { ok, badRequest, serverError, requireAdmin } from "./_utils.mjs";
import { list, get } from "@netlify/blobs";

export const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return badRequest("GET only");
  }
  try {
    const admin = requireAdmin(event);
    if (!admin) {
      return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    }
    const limit = Math.max(1, Math.min(50, parseInt(event.queryStringParameters?.limit || "20", 10)));
    const cursor = event.queryStringParameters?.cursor || undefined;
    const { blobs, cursor: nextCursor } = await list({ prefix: "logs/", cursor, limit });
    // fetch last N blobs content
    const items = [];
    for (const b of blobs) {
      const val = await get(b.key);
      try {
        items.push({ key: b.key, uploadedAt: b.uploadedAt, ...(JSON.parse(val)) });
      } catch {
        items.push({ key: b.key, uploadedAt: b.uploadedAt, raw: val });
      }
    }
    // Sort newest first by uploadedAt or by key (timestamp prefix)
    items.sort((a, b) => (b.key.localeCompare(a.key)));
    return ok({ items, cursor: nextCursor || null });
  } catch (e) {
    return serverError(e);
  }
};