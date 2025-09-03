// lemon-webhook.js
const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");
const { ok, badRequest, serverError } = require("./_utils");

const store = getStore({ name: "pgishonim" });

// Validate LS signature (HMAC SHA256 of raw body, hex)
function verifySignature(secret, rawBody, signature) {
  try {
    const h = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(h, "hex");
    const b = Buffer.from(signature || "", "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

module.exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return badRequest({ error: "POST only" });

    const secret = process.env.LS_WEBHOOK_SECRET;
    if (!secret) return serverError({ error: "Missing LS_WEBHOOK_SECRET" });

    const raw = event.body || "";
    const sig = event.headers["x-signature"] || event.headers["X-Signature"];
    if (!verifySignature(secret, raw, sig)) {
      return { statusCode: 401, body: "invalid signature" };
    }

    const payload = JSON.parse(raw);
    // Lemon Squeezy sends meta.event_name like "order_created"
    const eventName = payload?.meta?.event_name;
    const passToken = payload?.meta?.custom?.pass_token;

    // We only care about successful purchases
    if (eventName === "order_created" && passToken) {
      // move pending -> passes
      const pendingKey = `pending/${passToken}.json`;
      const paidKey = `passes/${passToken}.json`;
      const pending = await store.get(pendingKey, { type: "json" }).catch(() => null);

      if (pending && pending.form) {
        const orderId = payload?.data?.id;
        const buyerEmail = payload?.data?.attributes?.user_email || pending.form.email;

        await store.set(paidKey, JSON.stringify({
          status: "paid",
          orderId,
          buyerEmail,
          form: pending.form,
          paidAt: new Date().toISOString()
        }), { consistency: "strong" });

        await store.delete(pendingKey).catch(() => {});
      }
    }

    // you may also handle refunds etc. here, e.g. eventName === "order_refunded"
    return ok({ handled: true });
  } catch (err) {
    return serverError({ error: String(err && err.message || err) });
  }
};
