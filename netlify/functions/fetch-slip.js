// Paid page polls this to check if the slip is ready
const { getStore } = require('@netlify/blobs');

function getSlipsStore() {
  try { return getStore('slips'); } catch (_) {
    const siteID =
      process.env.NETLIFY_SITE_ID;
    const token =
      process.env.NETLIFY_BLOBS_TOKEN ||
      process.env.NETLIFY_AUTH_TOKEN   ||
      process.env.NETLIFY_API_TOKEN;

    if (!siteID || !token) {
      throw new Error(
        'Netlify Blobs not configured. Set NETLIFY_SITE_ID and a token in ' +
        'NETLIFY_BLOBS_TOKEN (preferred) or NETLIFY_AUTH_TOKEN / NETLIFY_API_TOKEN.'
      );
    }
    return getStore('slips', { siteID, token });
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const token = event.queryStringParameters?.token;
  if (!token) {
    return { statusCode: 400, body: JSON.stringify({ error: 'missing token' }) };
  }

  try {
    const store = getSlipsStore();
    const data = await store.get(`slips/${token}.json`, { type: 'json' });

    if (!data) {
      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ok: true, found: false })
      };
    }

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, found: true, slip: data })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: e.message })
    };
  }
};
