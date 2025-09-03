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

    if (!email || !student_name || !klass || !date || !release_time) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "missing required fields" })
      };
    }

    const token = crypto.randomUUID();

    const storeId   = Number(process.env.LEMON_SQUEEZY_STORE_ID);
    const variantId = Number(process.env.LEMON_SQUEEZY_VARIANT_ID);
    const siteUrl   = process.env.SITE_URL;

    const redirectUrl = `${siteUrl}/paid.html?token=${encodeURIComponent(token)}`;

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
            store:   { data: { type: "stores",   id: String(storeId) } },
            variant: { data: { type: "variants", id: String(variantId) } }
          }
        }
      })
    });

    if (!res.ok) {
      const t = await res.text();
      return { statusCode: 502, body: JSON.stringify({ error: "ls_api_error", detail: t }) };
    }

    const json = await res.json();
    const url = json?.data?.attributes?.url;
    if (!url) {
      return { statusCode: 500, body: JSON.stringify({ error: "no_checkout_url" }) };
    }

    return { statusCode: 200, body: JSON.stringify({ url }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

