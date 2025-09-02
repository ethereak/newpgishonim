// netlify/functions/_blobs.js
// Returns a Blobs store that works in Netlify Functions.
// Tries deploy-wired first, then falls back to siteID + token (PAT).

module.exports.blobsStore = async function blobsStore() {
  const mod = await import("@netlify/blobs");

  // 1) Fast path: deploy-wired (if Netlify injected context)
  if (typeof mod.getDeployStore === "function") {
    try {
      const s = mod.getDeployStore();
      await s.list({ prefix: "__probe__", limit: 1 }).catch(() => {});
      return s;
    } catch {}
  }

  // 2) Explicit siteID + token (PAT). Works everywhere.
  const siteID =
    process.env.NETLIFY_SITE_ID ||
    process.env.SITE_ID ||
    process.env.siteID;

  // Accept multiple var names for the PAT:
  const token =
    process.env.BLOBS_TOKEN ||
    process.env.NETLIFY_BLOBS_TOKEN ||
    process.env.NETLIFY_AUTH_TOKEN || // PAT often stored here
    process.env.blobs_token;

  if (siteID && token && typeof mod.getStore === "function") {
    const s = mod.getStore({ name: "default", siteID, token });
    await s.list({ prefix: "__probe__", limit: 1 }).catch(() => {});
    return s;
  }

  // 3) DeployID path (rarely present on your runtime, but keep as a last try)
  const deployID =
    process.env.DEPLOY_ID || process.env.NETLIFY_DEPLOY_ID || null;
  if (deployID && typeof mod.getStore === "function") {
    const s = mod.getStore({ deployID });
    await s.list({ prefix: "__probe__", limit: 1 }).catch(() => {});
    return s;
  }

  throw new Error("Blobs not configured: provide NETLIFY_SITE_ID + BLOBS_TOKEN (PAT).");
};
