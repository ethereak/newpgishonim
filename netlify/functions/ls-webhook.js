// Lemon Squeezy webhook → store slip in Netlify Blobs
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
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Lemon Squeezy posts JSON (application/vnd.api+json)
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid json' }) };
  }

  // Find the custom data with our token and fields
  const custom =
    payload?.meta?.custom_data ||
    payload?.data?.attributes?.custom_data ||
    payload?.data?.attributes?.checkout_data?.custom ||
    {};

  const token = custom.token;
  if (!token) {
    // nothing to do, but acknowledge so LS stops retrying
    return { statusCode: 200, body: JSON.stringify({ ok: true, ignored: true }) };
  }

  const slip = {
    ...custom,
    paid_at: new Date().toISOString(),
    webhook_id: payload?.data?.id,
  };

  try {
    const store = getSlipsStore();
    await store.set(`slips/${token}.json`, JSON.stringify(slip), {
      contentType: 'application/json'
    });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
