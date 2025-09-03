// pass.js
const { getStore } = require("@netlify/blobs");
const { ok, badRequest, serverError } = require("./_utils");

const store = getStore({ name: "pgishonim" });

module.exports.handler = async (event) => {
  try {
    const token = (event.queryStringParameters && event.queryStringParameters.token) || "";
    if (!token) return badRequest({ error: "Missing token" });

    const data = await store.get(`passes/${token}.json`, { type: "json" });
    if (!data || data.status !== "paid") {
      return { statusCode: 404, body: JSON.stringify({ error: "Not found or not paid" }) };
    }

    // Return the original form fields so the client can build the slip URL
    return ok({ paid: true, form: data.form, orderId: data.orderId });
  } catch (err) {
    return serverError({ error: String(err && err.message || err) });
  }
};
