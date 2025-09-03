
// CJS
const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }
    const token = (event.queryStringParameters || {}).token || "";
    if (!token) {
      return { statusCode: 400, body: JSON.stringify({ error: "missing token" }) };
    }

    const store = getStore("slips");
    const str = await store.get(token, { type: "text" });

    if (!str) {
      // Not yet stored by the webhook → still processing
      return {
        statusCode: 202,
        body: JSON.stringify({ status: "pending" })
      };
    }

    let data = {};
    try { data = JSON.parse(str); } catch { /* ignore */ }

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "ready", data })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
