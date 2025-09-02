// netlify/functions/diag.js  (CommonJS)
exports.handler = async (event) => {
  const result = {
    node: process.versions.node,
    runtime: process.env.AWS_EXECUTION_ENV || null,
    ts: new Date().toISOString(),
    blobs: {},
  };

  try {
    // dynamic import so ESM-only packages work in CJS
    const mod = await import("@netlify/blobs");
    result.blobs.moduleKeys = Object.keys(mod);

    // simple read, then write, then read again
    const key = "diag-test.txt";
    const before = await mod.get(key);
    await mod.set(key, `diag ok at ${new Date().toISOString()}`);
    const after = await mod.get(key);

    result.blobs.readBefore = before ?? null;
    result.blobs.readAfter = after ?? null;
    result.ok = true;

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(result, null, 2),
    };
  } catch (e) {
    // return full details so we can see the real failure
    result.ok = false;
    result.error = String(e && e.message ? e.message : e);
    result.stack = e && e.stack ? e.stack : null;

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(result, null, 2),
    };
  }
};
