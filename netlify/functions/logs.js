import { ok, serverError } from "./_utils.mjs";
import { list, get } from "@netlify/blobs";

export const handler = async (event) => {
  try {
    const { blobs } = await list({ prefix: "logs/", limit: 50 });
    const items = [];

    for (const b of blobs) {
      const raw = await get(b.key);
      if (raw) {
        try { items.push(JSON.parse(raw)); } catch {}
      }
    }

    return ok(items);
  } catch (e) {
    return serverError(e);
  }
};
