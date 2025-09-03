// /.netlify/functions/db-columns.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return json(500, {
      ok: false,
      reason: 'missing env',
      SUPABASE_URL: url || null,
      have_service_role: !!process.env.SUPABASE_SERVICE_ROLE,
      have_anon_key: !!process.env.SUPABASE_ANON_KEY
    });
  }

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });

    // 1) Is the table reachable?
    const probe = await supabase.from('slips').select('*').limit(1);
    if (probe.error) {
      return json(200, {
        ok: false,
        SUPABASE_URL: url,
        table_reachable: false,
        error: probe.error.message
      });
    }

    const sample = probe.data?.[0] ?? null;
    const cols = sample ? Object.keys(sample) : null;

    // 2) Try selecting paid/paid_at explicitly to see if the column exists in this DB
    const probePaid = await supabase.from('slips').select('paid,paid_at').limit(1);
    const paidOk = !probePaid.error;

    return json(200, {
      ok: true,
      SUPABASE_URL: url,
      table_reachable: true,
      columns_from_sample_row: cols,      // e.g. ["id","data","token","paid","paid_at","created_at", ...]
      sample_row: sample,
      paid_select_ok: paidOk,
      paid_select_error: probePaid.error?.message || null
    });
  } catch (e) {
    return json(500, { ok: false, error: e.message });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body, null, 2)
  };
}
