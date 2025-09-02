import { readJSONBody, ok, badRequest, serverError, requireAdmin } from "./_utils.mjs";
import { get, set } from "@netlify/blobs";

async function loadBanner() {
  const raw = await get("banner.json");
  if (!raw) return { enabled: false, text: "", severity: "info" };
  try { return JSON.parse(raw); } catch { return { enabled: false, text: "", severity: "info" }; }
}

export const handler = async (event) => {
  try {
    if (event.httpMethod === "GET") {
      const banner = await loadBanner();
      return ok(banner); // public read
    }
    const admin = requireAdmin(event);
    if (!admin) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

    if (event.httpMethod === "POST") {
      const body = readJSONBody(event) || {};
      const banner = {
        enabled: !!body.enabled,
        text: (body.text || "").toString().slice(0, 500),
        severity: (body.severity || "info")
      };
      await set("banner.json", JSON.stringify(banner, null, 2));
      return ok({ ok: true });
    }
    return badRequest("Unsupported method");
  } catch (e) {
    return serverError(e);
  }
};
