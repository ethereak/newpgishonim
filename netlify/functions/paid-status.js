const { createClient } = require("@netlify/blobs");

function blobs() {
  return createClient({
    name: process.env.NETLIFY_BLOBS_STORE || "paid-tokens",
    siteID: process.env.NETLIFY_BLOBS_SITE_ID,
    token: process.env.NETLIFY_BLOBS_TOKEN,
  });
}

exports.handler = async (event) => {
  try {
    const token = (event.queryStringParameters || {}).token;
    if (!token) return { statusCode: 400, body: "missing token" };

    const store = blobs();
    const item = await store.get(`paid/${token}.json`, { type: "json" });

    if (!item) {
      // Not yet processed by the webhook
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      };
    }

    // Return all fields for building the slip URL
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "paid", data: item }),
    };
  } catch (e) {
    return { statusCode: 500, body: e.message || "paid error" };
  }
};
