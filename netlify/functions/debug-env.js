// netlify/functions/debug-env.js
exports.handler = async () => {
  const keys = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE',
    'SUPABASE_ANON_KEY',
    'SITE_URL',
    'LEMON_SQUEEZY_API_KEY'
  ];

  const out = {};
  for (const k of keys) {
    const v = process.env[k];
    out[k] = v
      ? { present: true, length: String(v).length, preview: String(v).slice(0, 6) + '…' }
      : { present: false };
  }

  // Helpful Netlify context flags
  out._context = {
    CONTEXT: process.env.CONTEXT || null,              // production | deploy-preview | branch-deploy
    BRANCH: process.env.BRANCH || null
  };

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(out, null, 2)
  };
};
