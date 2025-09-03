// lemonsqueezy-webhook.js (CommonJS, Node 22)

const { getStore } = require("@netlify/blobs");

// ---- Blobs helper (TOP OF FILE) ----
function getReceiptsStore() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID;
  const token  = process.env.NETLIFY_BLOBS_TOKEN;
  return (siteID && token)
    ? getStore({ name: "receipts", siteID, token }) // manual credentials
    : getStore({ name: "receipts" });               // auto (when Blobs is enabled for the site)
}
// ------------------------------------

// Optional: verify Lemon Squeezy webhook signature here if you’ve set one
// (omitted for brevity—your earlier version may already do this)

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    // Lemon Squeezy webhook payload
    const payload = JSON.parse(event.body || "{}");

    // We stored all the original form fields under meta.custom from the checkout
    const custom = payload?.meta?.custom || {};
    const token  = custom.token;
    if (!token) {
      return { statusCode: 400, body: JSON.stringify({ error: "missing token in webhook" }) };
    }

    // Write the receipt record to Netlify Blobs (key = <token>.json)
    const store = getReceiptsStore();
    await store.set(`${token}.json`, JSON.stringify(custom), {
      contentType: "application/json"
    });

    return { statusCode: 200, body: "ok" };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
