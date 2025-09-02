const { readJSONBody, ok, badRequest, serverError, requireAdmin } = require("./_utils.js");
const { blobsStore } = require("./_blobs.js");

async function loadBanner() {
  const store = await blobsStore();
  const raw = await store.get("banner.json");
  if (!raw) return { enabled: false, text: "", severity: "info" };
  try { return JSON.parse(raw); } catch { return { enabled: false, text: "", severity: "info" }; }
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "GET") {
      return ok(await loadBanner()); // public read for homepage
    }

    if (!requireAdmin(event)) {
      return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    }

    if (event.httpMethod === "POST") {
      const body = readJSONBody(event) || {};
      const banner = {
        enabled: !!body.enabled,
        text: String(body.text || "").slice(0, 500),
        severity: ["info", "warning", "error"].includes(body.severity) ? body.severity : "info"
      };
      const store = await blobsStore();
      await store.set("banner.json", JSON.stringify(banner, null, 2));
      return ok({ ok: true });
    }

    return badRequest("Unsupported method");
  } catch (e) {
    console.error("[banner] failed:", e);
    return serverError(e);
  }
};
