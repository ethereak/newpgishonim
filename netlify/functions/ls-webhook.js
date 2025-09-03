// Lemon Squeezy webhook → store slip in Supabase
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid json' }) };
  }

  // The token + form fields were sent in checkout_data.custom during create-checkout
  const custom =
    payload?.meta?.custom_data ||
    payload?.data?.attributes?.custom_data ||
    payload?.data?.attributes?.checkout_data?.custom ||
    {};

  const token = custom.token;
  if (!token) {
    // Nothing to store; acknowledge to stop LS retries.
    return { statusCode: 200, body: JSON.stringify({ ok: true, ignored: true }) };
  }

  // Build the slip (what your confirmation page needs)
  const slip = {
    ...custom,
    paid_at: new Date().toISOString(),
    webhook_id: payload?.data?.id,
    event: payload?.meta?.event_name || payload?.data?.type || 'unknown'
  };

  // Upsert by token
  const { error } = await supabase
    .from('slips')
    .upsert({ token, data: slip })
    .select('token')
    .single();

  if (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
