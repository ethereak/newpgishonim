// /.netlify/functions/get-slip.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return J(500, { error: 'supabase_env_missing' });

    const token = event.queryStringParameters?.token;
    if (!token) return J(400, { error: 'bad_request', detail: 'missing token' });

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    // Select * so schema changes never break us
    const { data, error } = await supabase
      .from('slips')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (error) return J(500, { error: 'db_error', detail: error.message });
    if (!data) return J(404, { error: 'not_found' });

    const isPaid = data?.paid === true || data?.status === 'ready';

    return J(200, {
      found: true,
      pending: !isPaid,
      status: data?.status ?? (isPaid ? 'ready' : 'pending'),
      paid: !!data?.paid,
      data: data?.data ?? {}
    });
  } catch (e) {
    return J(500, { error: 'server_error', detail: e.message });
  }
};

function J(code, body) {
  return {
    statusCode: code,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body)
  };
}
