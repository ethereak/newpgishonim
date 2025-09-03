// netlify/functions/lemonsqueezy-webhook.js
const crypto = require("node:crypto");
const { getStore } = require("@netlify/blobs");

function json(b, s=200){ return { statusCode:s, headers:{'content-type':'application/json'}, body:JSON.stringify(b) }; }

function verifySignature(rawBody, signature, secret){
  // Lemon Squeezy sends hex-encoded HMAC SHA256 of the raw request body
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody, 'utf8');
  const expected = hmac.digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || '', 'hex'));
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode:405, body:"Method Not Allowed" };

    const secret = process.env.LEMON_SQUEEZY_SIGNING_SECRET || "";
    if (!secret) return json({ error: "missing_signing_secret" }, 500);

    const raw = event.body || "";
    const sig = event.headers["x-signature"] || event.headers["X-Signature"];

    if (!verifySignature(raw, sig, secret)) {
      return json({ error: "invalid_signature" }, 401);
    }

    const payload = JSON.parse(raw);
    const type = payload?.meta?.event_name;
    if (type !== "order_created") {
      return json({ ok:true, ignored:true });
    }

    // The custom fields we set in create-checkout
    const custom = payload?.meta?.custom_data || payload?.data?.attributes?.checkout_data?.custom || {};
    const token  = custom.token;
    if (!token) return json({ error: "no_token_in_custom" }, 200);

    // Save for paid.html → redeem
    const store = getStore({ name: "receipts" });
    await store.set(`${token}.json`, JSON.stringify(custom), { contentType: "application/json" });

    return json({ ok:true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
};
