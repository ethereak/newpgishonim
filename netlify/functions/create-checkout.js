// netlify/functions/create-checkout.js
// CommonJS on Netlify Node 22
const crypto = require("node:crypto");
const fetch = require("node-fetch");

const API_BASE = "https://api.lemonsqueezy.com/v1";

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const {
      email,
      student_name,
      class: klass,
      date,
      release_time,
      reason,
      approved_by
    } = JSON.parse(event.body || "{}");

    // very light validation
    if (!email || !student_name || !klass || !date || !release_time) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "missing required fields" })
      };
    }

    // --- NEW: env sanity check (prevents generic popup) ---
    const storeId = Number(process.env.LEMON_SQUEEZY_STORE_ID);
    const variantId = Number(process.env.LEMON_SQUEEZY_VARIANT_ID);
    const siteUrl = process.env.SITE_URL;
    const apiKeySet = !!process.env.LEMON_SQUEEZY_API_KEY;

    if (!apiKeySet || !storeId || !variantId || !siteUrl) {
      console.error("Env missing", {
        apiKey: apiKeySet ? "set" : "missing",
        storeId,
        variantId,
        siteUrl
      });
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "missing_env" })
      };
    }
    // ------------------------------------------------------

    const token = crypto.randomUUID(); // one-use token we’ll carry through

    // build the URL you ultimately want to land on AFTER payment (paid page with token)
    const redirectUrl = `${siteUrl}/paid.html?token=${encodeURIComponent(token)}`;

    // Create checkout (docs: Create a Checkout)
    // https://docs.lemonsqueezy.com/api/checkouts/create-checkout
    const res = await fetch(`${API_BASE}/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}`,
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json"
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            checkout_data: {
              email,
              // custom data shows up in webhook meta.custom_data
              custom: {
                token,
                email,
                student_name,
                class: klass,
                date,
                release_time,
                reason,
                approved_by
              }
            },
            product_options: {
              redirect_url: redirectUrl
            }
          },
          relationships: {
            store: { data: { type: "stores", id: String(storeId) } },
            variant: { data: { type: "variants", id: String(variantId) } }
          }
        }
      })
    });

    // --- NEW: surface Lemon Squeezy error in logs & response ---
    const txt = await res.text();
    if (!res.ok) {
      console.error("Lemon error", res.status, txt); // <— you’ll see this in Functions logs
      return { statusCode: res.status, body: txt };
    }
    const json = JSON.parse(txt);
    // -----------------------------------------------------------

    const url = json?.data?.attributes?.url;
    if (!url) {
      console.error("No checkout URL in response", json);
      return { statusCode: 500, body: JSON.stringify({ error: "no_checkout_url" }) };
    }

    // respond with URL so the client can redirect
    return {
      statusCode: 200,
      body: JSON.stringify({ url })
    };
  } catch (e) {
    console.error("create-checkout crashed:", e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
