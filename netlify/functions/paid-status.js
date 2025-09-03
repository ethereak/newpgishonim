const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  try {
    const token = (event.queryStringParameters || {}).token;
    if (!token) return { statusCode: 400, body: JSON.stringify({ ok:false, error:"no token" }) };

    const store = getStore({
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.BLOBS_TOKEN
    });

    const key = `payments/${token}.json`;
    const res = await store.get(key);
    if (!res) return { statusCode: 200, body: JSON.stringify({ ok:false, pending:true }) };

    return { statusCode: 200, body: res, headers: { "content-type":"application/json" } };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:e.message }) };
  }
};
