// Verify Lemon Squeezy webhook and store payment data keyed by our token
const crypto = require("node:crypto");
const { getStore } = require("@netlify/blobs");

function verifySignature(secret, rawBody, signature) {
  // Lemon Squeezy sends SHA256 HMAC in X-Signature
  const hmac = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature || "", "utf8"));
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

    const raw = event.body || "";
    const okSig = verifySignature(process.env.LEMON_SQUEEZY_SIGNING_SECRET, raw, event.headers["x-signature"]);
    if (!okSig) return { statusCode: 401, body: "bad signature" };

    const payload = JSON.parse(raw);
    const type = payload?.meta?.event_name; // e.g., "order_created"
    const custom = payload?.meta?.custom_data || {};
    const token = custom.token;

    // We only care about completed one-time purchases -> order_created
    if (!token || type !== "order_created") return { statusCode: 200, body: "ignored" };

    const store = getStore({
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.BLOBS_TOKEN
    });

    const key = `payments/${token}.json`;
    await store.set(key, JSON.stringify({
      ok: true,
      at: new Date().toISOString(),
      fields: {
        email: custom.email,
        student_name: custom.student_name,
        class: custom.class,
        date: custom.date,
        release_time: custom.release_time,
        reason: custom.reason,
        approved_by: custom.approved_by
      }
    }), { contentType: "application/json" });

    return { statusCode: 200, body: "stored" };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
};
