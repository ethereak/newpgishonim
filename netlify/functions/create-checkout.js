// netlify/functions/create-checkout.js
const crypto = require("node:crypto");

const API_BASE = "https://api.lemonsqueezy.com/v1";

function json(body, status = 200) {
  return {
    statusCode: status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: { Allow: "POST" }, body: "Method Not Allowed" };
    }

    const {
      email,
      student_name,
      class: klass,
      date,
      release_time,
      reason,
      approved_by,
    } = JSON.parse(event.body || "{}");

    // Required fields so Lemon Squeezy gets good data
    if (!email || !student_name || !klass || !date || !release_time) {
      return json({ error: "missing required fields" }, 400);
    }

    // One-use token to carry through redirect → paid.html
    const token =
      (crypto.randomUUID && crypto.randomUUID()) ||
      Math.random().toString(36).slice(2);

    // Env vars (make sure these are set in Netlify)
    const apiKey = process.env.LEMON_SQUEEZY_API_KEY || "";
    const storeId = String(process.env.LEMON_SQUEEZY_STORE_ID || "").trim();
    const variantId = String(process.env.LEMON_SQUEEZY_VARIANT_ID || "").trim();
    const siteUrl = String(process.env.SITE_URL || "").replace(/\/+$/, "");

    if (!apiKey || !storeId || !variantId || !siteUrl) {
      return json(
        {
          error: "missing_env",
          detail:
            "LEMON_SQUEEZY_API_KEY, LEMON_SQUEEZY_STORE_ID, LEMON_SQUEEZY_VARIANT_ID, SITE_URL must be set",
        },
        500
      );
    }

    const redirectUrl = `${siteUrl}/paid.html?token=${encodeURIComponent(token)}`;

    // Build Lemon Squeezy checkout payload
    const payload = {
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email,
            // Will be returned in webhook (meta.custom)
            custom: {
              token,
              email,
              student_name,
              class: klass,
              date,
              release_time,
              reason,
              approved_by,
            },
          },
          product_options: {
            redirect_url: redirectUrl,
          },
        },
        relationships: {
          store: { data: { type: "stores", id: storeId } },
          variant: { data: { type: "variants", id: variantId } },
        },
      },
    };

    // Node 22 has global fetch
    const res = await fetch(`${API_BASE}/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch {}

    if (!res.ok) {
      return json({ error: "ls_api_error", detail: text }, 502);
    }

    const url = data?.data?.attributes?.url;
    if (!url) {
      return json({ error: "no_checkout_url", detail: text }, 500);
    }

    return json({ url });
  } catch (e) {
    return json({ error: "server_error", detail: String(e.message) }, 500);
  }
};
