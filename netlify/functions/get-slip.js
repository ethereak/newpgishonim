// netlify/functions/get-slip.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const qs = event.queryStringParameters || {};
    const token = qs.token;
    const debug = qs.debug === '1';

    if (!token) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'missing_token' })
      };
    }

    const url = process.env.SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'supabase_env_missing',
          detail: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE/ANON_KEY must be set'
        })
      };
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const meta = { ts: new Date().toISOString() };

    const { data: row, error } = await supabase
      .from('slips')
      .select('token, data, paid, created_at, paid_at')
      .eq('token', token)
      .single();

    if (debug) meta.row = row || null;
    if (error) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'not_found', detail: error.message, meta })
      };
    }

    if (!row) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'not_found', detail: 'No slip with that token', meta })
      };
    }

    if (!row.paid) {
      return { statusCode: 202, body: JSON.stringify({ status: 'pending', token: row.token, meta }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'paid', token: row.token, data: row.data, meta })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'server_error', detail: e.message }) };
  }
};
