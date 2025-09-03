// /.netlify/functions/db-columns.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async () => {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      return resp(500, { ok:false, reason:'missing env', SUPABASE_URL: url || null });
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    // Ask the DB what columns exist in public.slips
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('table_schema,table_name,column_name,udt_name')
      .eq('table_schema','public')
      .eq('table_name','slips')
      .order('column_name', { ascending: true });

    return resp(200, {
      ok: !error,
      error: error?.message || null,
      SUPABASE_URL: url,
      columns: data
    });
  } catch (e) {
    return resp(500, { ok:false, error:e.message });
  }
};

function resp(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body)
  };
}
