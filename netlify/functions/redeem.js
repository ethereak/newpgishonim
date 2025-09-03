const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  try {
    const token = (event.queryStringParameters || {}).token;
    if (!token) return { statusCode: 400, body: JSON.stringify({ error: "missing token" }) };

    const tickets = getStore({ name: "tickets" });
    const raw = await tickets.get(token, { type: "json" });
    if (!raw) return { statusCode: 404, body: JSON.stringify({ error: "not found" }) };

    if (raw.used) {
      return { statusCode: 410, body: JSON.stringify({ error: "already used" }) };
    }

    // mark used
    await tickets.set(token, JSON.stringify({ ...raw, used: true, usedAt: Date.now() }), {
      metadata: { contentType: "application/json" }
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true, url: raw.url }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
