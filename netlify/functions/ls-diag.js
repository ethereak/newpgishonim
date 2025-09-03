export const handler = async () => {
  const present = (k) => (process.env[k] ? 'set' : 'missing');
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ts: new Date().toISOString(),
      env: {
        SITE_URL: present('SITE_URL'),
        LEMON_SQUEEZY_STORE_ID: present('LEMON_SQUEEZY_STORE_ID'),
        LEMON_SQUEEZY_VARIANT_ID: present('LEMON_SQUEEZY_VARIANT_ID'),
        LEMON_SQUEEZY_API_KEY: present('LEMON_SQUEEZY_API_KEY')
      }
    })
  };
};
