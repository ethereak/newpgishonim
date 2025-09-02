const { readJSONBody, ok, badRequest, serverError, requireAdmin } = require("./_utils.js");

async function loadBanner() {
  const { getDeployStore } = await import("@netlify/blobs");
  const store = getDeployStore();
  const raw = await store.get("banner.json");
  if (!raw) return { enabled: false, text: "", severity: "info" };
  try { return JSON.parse(raw); } catch { return { enabled: false, text: "", severity: "info" }; }
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "GET") return ok(await loadBanner());
    if (!requireAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

    if (event.httpMethod === "POST") {
      const { getDeployStore } = await import("@netlify/blobs");
      const store = getDeployStore();
      const body = readJSONBody(event) || {};
      const banner = { enabled: !!body.enabled, text: String(body.text || "").slice(0, 500), severity: body.severity || "info" };
      await store.set("banner.json", JSON.stringify(banner, null, 2));
      return ok({ ok: true });
    }
    return badRequest("Unsupported method");
  } catch (e) {
    console.error("[banner] failed:", e);
    return { statusCode: 500, headers: { "content-type": "application/json" }, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
