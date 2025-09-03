// create-checkout.js
const crypto = require("crypto");
const fetch = (...args) => import("node-fetch").then(({default: f}) => f(...args));
const { getStore } = require("@netlify/blobs");
const { readJSONBody, ok, badRequest, serverError } = require("./_utils");

// Blobs store (same name you already use elsewhere)
const store = getStore({ name: "pgishonim" });

/**
 * Body we expect from the client:
 * {
 *   date, release_time, student_name, class, reason, approved_by, email
 * }
 */
module.exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return badRequest({ error: "POST only" });
    }

    const body = await readJSONBody(event) || {};
    const required = ["date","release_time","student_name","class","reason","approved_by","email"];
    for (const k of required) {
      if (!body[k] || String(body[k]).trim() === "") {
        return badRequest({ error: `Missing field: ${k}` });
      }
    }

    // one-time token for this slip
    const passToken = crypto.randomBytes(16).toString("hex");

    // Keep data temporarily until webhook confirms payment
    await store.set(`pending/${passToken}.json`, JSON.stringify({
      createdAt: new Date().toISOString(),
      form: body,
      ip: event.headers["x-nf-client-connection-ip"] || "",
      userAgent: event.headers["user-agent"] || ""
    }), { consistency: "strong" });

    // Lemon Squeezy create checkout
    const { LS_API_KEY, LS_STORE_ID, LS_VARIANT_ID, SITE_URL } = process.env;
    if (!LS_API_KEY || !LS_STORE_ID || !LS_VARIANT_ID || !SITE_URL) {
      return serverError({ error: "Server not configured (missing LS_* or SITE_URL)" });
    }

    const payload = {
      data: {
        type: "checkouts",
        attributes: {
          // Send the pass token + email so we can match it later in the webhook
          checkout_data: {
            email: body.email,
            // this ends up in webhook payload (meta.custom)
            custom: { pass_token: passToken }
          },
          // 15 min to complete payment
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          // where to send the buyer after successful payment
          redirect_url: `${SITE_URL}/paid.html?token=${passToken}`
        },
        relationships: {
          store: { data: { type: "stores", id: String(LS_STORE_ID) } },
          variant: { data: { type: "variants", id: String(LS_VARIANT_ID) } }
        }
      }
    };

    const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LS_API_KEY}`,
        "Accept": "application/vnd.api+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!res.ok) {
      // cleanup pending if LS failed
      await store.delete(`pending/${passToken}.json`).catch(() => {});
      return serverError({ error: "Lemon Squeezy error", details: json });
    }

    const url = json?.data?.attributes?.url;
    if (!url) {
      await store.delete(`pending/${passToken}.json`).catch(() => {});
      return serverError({ error: "No checkout url from Lemon Squeezy." });
    }

    return ok({ url }); // client should window.location = url
  } catch (err) {
    return serverError({ error: String(err && err.message || err) });
  }
};
