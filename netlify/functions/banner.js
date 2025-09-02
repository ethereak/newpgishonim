const { readJSONBody, ok, badRequest, serverError, requireAdmin } = require("./_utils.js");

async function loadBanner() {
  const { get } = await import("@netlify/blobs");
  const raw = await get("banner.json");
  if (!raw) return { enabled: false, text: "", severity: "info" };
  try { return JSON.parse(raw); } catch { return { enabled: false, text: "", severity: "info" }; }
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "GET") return ok(await loadBanner());
    if (!requireAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

    if (event.httpMethod === "POST") {
      const { set } = await import("@netlify/blobs");
      const body = readJSONBody(event) || {};
      const banner = { enabled: !!body.enabled, text: String(body.text || "").slice(0, 500), severity: body.severity || "info" };
      await set("banner.json", JSON.stringify(banner, null, 2));
      return ok({ ok: true });
    }
    return badRequest("Unsupported method");
  } catch (e) {
    // TEMP: expose the real error to the response + logs
    console.error("[banner] failed:", e);
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: String(e && e.message ? e.message : e), stack: e && e.stack ? e.stack : null }),
    };
  }
};
