// CommonJS (Node 22 on Netlify)
const crypto = require("node:crypto");
const { createClient } = require("@netlify/blobs");

// Verify LS signature (needed for security)
function isValidSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody, "utf8");
  const digest = hmac.digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// create a blobs client using manual creds (bypasses the auto-env issue)
function blobs() {
  return createClient({
    name: process.env.NETLIFY_BLOBS_STORE || "paid-tokens",
    siteID: process.env.NETLIFY_BLOBS_SITE_ID,
    token: process.env.NETLIFY_BLOBS_TOKEN,
  });
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const signature = event.headers["x-signature"] || event.headers["X-Signature"];
    const secret = process.env.LEMON_SQUEEZY_SIGNING_SECRET;
    const rawBody = event.body || "";

    if (!isValidSignature(rawBody, signature, secret)) {
      return { statusCode: 401, body: "Invalid signature" };
    }

    const payload = JSON.parse(rawBody);

    // Lemon Squeezy sends different events. We care when an order is created/paid.
    const type = payload?.meta?.event_name || "";
    if (!/order_(created|paid|refunded|updated)/.test(type)) {
      return { statusCode: 200, body: "Ignored event" };
    }

    // We stored the user’s fields in checkout_data.custom when creating the checkout
    const custom = payload?.data?.attributes?.checkout_data?.custom || payload?.meta?.custom || {};
    const token  = custom.token;

    if (!token) {
      return { statusCode: 400, body: "No token on event" };
    }

    // Save the “paid record” that the paid page will read.
    const record = {
      token,
      paid: true,
      student_name: custom.student_name || "",
      class: custom.class || "",
      date: custom.date || "",
      release_time: custom.release_time || "",
      reason: custom.reason || "",
      approved_by: custom.approved_by || "",
      at: new Date().toISOString(),
    };

    const store = blobs();
    await store.set(`paid/${token}.json`, JSON.stringify(record), {
      contentType: "application/json",
    });

    return { statusCode: 200, body: "ok" };
  } catch (e) {
    return { statusCode: 500, body: e.message || "webhook error" };
  }
};
