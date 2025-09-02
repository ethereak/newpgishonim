// netlify/functions/_blobs.js
// Always return a working Netlify Blobs "store" in Functions, with clear errors.

module.exports.blobsStore = async function blobsStore() {
  const mod = await import("@netlify/blobs"); // ESM package
  const exportsList = Object.keys(mod);

  // 1) Try deploy-wired store first (fast path when the env is auto-wired)
  if (typeof mod.getDeployStore === "function") {
    try {
      const s = mod.getDeployStore();
      // Probe to ensure it's actually wired (no-op list)
      await s.list({ prefix: "__probe__", limit: 1 }).catch(() => {});
      return s;
    } catch (e) {
      // Fall through
    }
  }

  // 2) Try manual deployID path (this is what your error message requested)
  const deployID =
    process.env.DEPLOY_ID || process.env.NETLIFY_DEPLOY_ID || process.env.DEPLOY_ID_PROD;
  if (deployID && typeof mod.getStore === "function") {
    try {
      const s = mod.getStore({ deployID });
      // Light probe
      await s.list({ prefix: "__probe__", limit: 1 }).catch(() => {});
      return s;
    } catch (e) {
      // Fall through to siteID/token if present
    }
  }

  // 3) Optional site-scoped token fallback (use only if you later add BLOBS_TOKEN)
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID || process.env.siteID;
  const token =
    process.env.BLOBS_TOKEN || process.env.NETLIFY_BLOBS_TOKEN || process.env.blobs_token;
  if (siteID && token && typeof mod.getStore === "function") {
    const s = mod.getStore({ name: "default", siteID, token });
    await s.list({ prefix: "__probe__", limit: 1 }).catch(() => {});
    return s;
  }

  // Nothing worked: throw a very explicit error so you can see it in the response/logs
  const envDump = {
    has_getDeployStore: typeof mod.getDeployStore === "function",
    has_getStore: typeof mod.getStore === "function",
    DEPLOY_ID: process.env.DEPLOY_ID || null,
    NETLIFY_DEPLOY_ID: process.env.NETLIFY_DEPLOY_ID || null,
    NETLIFY_SITE_ID: process.env.NETLIFY_SITE_ID || null,
    BLOBS_TOKEN: token ? "set" : "missing",
    exportsList,
  };

  throw new Error(
    "Blobs unavailable. env=" + JSON.stringify(envDump)
  );
};
