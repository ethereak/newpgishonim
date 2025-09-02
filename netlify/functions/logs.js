import { ok, badRequest, serverError, requireAdmin } from "./_utils.mjs";
import { getStore } from "@netlify/blobs";
const store = getStore({ name: "pgishonim" });


export const handler = async (event) => {
  if (event.httpMethod !== "GET") return badRequest("GET only");
  try {
    const admin = requireAdmin(event);
    if (!admin) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

    const limit = Math.max(1, Math.min(50, parseInt(event.queryStringParameters?.limit || "20", 10)));
    const cursor = event.queryStringParameters?.cursor || undefined;
    const { blobs, cursor: nextCursor } = await store.list({ prefix: "logs/", cursor, limit });

    const items = [];
    for (const b of blobs) {
      const val = await store.get(b.key);
      try {
        items.push({ key: b.key, uploadedAt: b.uploadedAt, ...(JSON.parse(val)) });
      } catch {
        items.push({ key: b.key, uploadedAt: b.uploadedAt, raw: val });
      }
    }
    items.sort((a, b) => b.key.localeCompare(a.key)); // newest first
    return ok({ items, cursor: nextCursor || null });
  } catch (e) {
    return serverError(e);
  }
};
