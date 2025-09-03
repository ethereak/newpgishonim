const crypto = require("node:crypto");
const { getStore } = require("@netlify/blobs");

// simple helpers
const ok = (obj) => ({ statusCode: 200, body: JSON.stringify(obj || { ok: true }) });
const bad = (code, msg) => ({ statusCode: code, body: JSON.stringify({ error: msg }) });

function verifySignature(secret, body, signature) {
  if (!signature) return false;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body, "utf8");
  const digest = hmac.digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(digest, "hex"));
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return bad(405, "method");
    const raw = event.body || "";
    const sig =
      event.headers["x-signature"] ||
      event.headers["X-Signature"] ||
      event.headers["x-signature".toLowerCase()];

    const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
    if (!verifySignature(secret, raw, sig)) return bad(401, "invalid_signature");

    const payload = JSON.parse(raw);

    const eventName =
      payload?.meta?.event_name || event.headers["x-event-name"] || "unknown";

    // we only care about completed orders (one-time purchase)
    if (eventName !== "order_created" && eventName !== "order_refunded") {
      return ok({ ignored: true, event: eventName });
    }

    // read custom data you sent during checkout
    const cd = payload?.meta?.custom_data || {};
    const {
      token,
      email,
      student_name,
      class: klass,
      date,
      release_time,
      reason,
      approved_by
    } = cd;

    if (!token) return ok({ no_token: true });

    // construct your confirmation.html URL with query parameters
    const qs = new URLSearchParams({
      date: date || "",
      release_time: release_time || "",
      student_name: student_name || "",
      class: klass || "",
      reason: reason || "",
      status: "אושר",
      frequency: "חד פעמי",
      exit_time: "00:00",
      return_time: "00:00",
      approved_by: approved_by || "",
      email: email || ""
    }).toString();

    const siteUrl = process.env.SITE_URL;
    const finalUrl = `${siteUrl}/confirmation.html?${qs}`;

    // store one-time token -> finalUrl so the paid page can redeem it
    const tickets = getStore({ name: "tickets" });
    await tickets.set(token, JSON.stringify({ url: finalUrl, used: false, ts: Date.now() }), {
      metadata: { contentType: "application/json" }
    });

    return ok({ stored: true, token });
  } catch (e) {
    return bad(500, e.message);
  }
};
