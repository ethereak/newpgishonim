// CJS
const crypto = require("node:crypto");
const { getStore } = require("@netlify/blobs");

/**
 * Verify Lemon Squeezy signature if a signing secret is set.
 */
function verifySignature(rawBody, signature, secret) {
  if (!secret) return true; // skip if not configured
  try {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(rawBody, "utf8");
    const expected = hmac.digest("hex");
    return crypto.timingSafeEqual(Buffer.from(signature || "", "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

exports.handler = async (event) => {
  try {
    // Lemon sends POST with a raw JSON body
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const raw = event.body || "";
    const sig = event.headers["x-signature"] || event.headers["x-signature-hmac-sha256"];
    const okSig = verifySignature(raw, sig, process.env.LEMON_SQUEEZY_SIGNING_SECRET);
    if (!okSig) {
      return { statusCode: 401, body: "invalid signature" };
    }

    const payload = JSON.parse(raw);
    // Custom data we sent when creating the checkout
    const custom =
      payload?.meta?.custom_data ||
      payload?.data?.attributes?.custom ||
      {};

    const token = custom.token;
    if (!token) {
      // Nothing we can save without the token
      return { statusCode: 202, body: "no token; ignoring" };
    }

    // Persist in Netlify Blobs
    const store = getStore("slips"); // namespace "slips"
    const value = {
      token,
      email: custom.email,
      student_name: custom.student_name,
      class: custom.class,
      date: custom.date,
      release_time: custom.release_time,
      reason: custom.reason,
      approved_by: custom.approved_by,
      paid: true,
      order_id: payload?.data?.id || null,
      when: new Date().toISOString()
    };

    await store.set(token, JSON.stringify(value), {
      metadata: { paid: "true" }, // optional
      // ttl: 172800, // optional 2 days
      contentType: "application/json"
    });

    // 200 tells Lemon Squeezy we accepted it
    return { statusCode: 200, body: "ok" };
  } catch (e) {
    return { statusCode: 500, body: e.message || "error" };
  }
};

