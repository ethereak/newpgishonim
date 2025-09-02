const { readJSONBody, ok, badRequest, serverError, requireAdmin } = require("./_utils.js");
const { get, set } = require("@netlify/blobs");

async function loadBanner() {
  const raw = await get("banner.json");
  if (!raw) return { enabled: false, text: "", severity: "info" };
  try { return JSON.parse(raw); } catch { return { enabled: false, text: "", severity: "info" }; }
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "GET") return ok(await loadBanner()); // public
    if (!requireAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    if (event.httpMethod === "POST") {
      const body = readJSONBody(event) || {};
      const banner = { enabled: !!body.enabled, text: (body.text || "").toString().slice(0, 500), severity: body.severity || "info" };
      await set("banner.json", JSON.stringify(banner, null, 2));
      return ok({ ok: true });
    }
    return badRequest("Unsupported method");
  } catch (e) { return serverError(e); }
};
