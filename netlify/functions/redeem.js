// redeem.js (CommonJS, Node 22)

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

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const qs = event.queryStringParameters || {};
    const token = (qs.token || "").trim();
    if (!token) {
      return { statusCode: 400, body: JSON.stringify({ error: "missing token" }) };
    }

    const store = getReceiptsStore();
    const data = await store.get(`${token}.json`, { type: "json" });

    if (!data) {
      return { statusCode: 404, body: JSON.stringify({ error: "not_found" }) };
    }

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data)
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
