// netlify/functions/_blobs.js
// Unified helper that returns a working Blobs "store" no matter the env.

module.exports.blobsStore = async function blobsStore() {
  const mod = await import("@netlify/blobs");

  // 1) Try the deploy-bound store (works when Netlify auto-wires env)
  if (typeof mod.getDeployStore === "function") {
    try {
      const s = mod.getDeployStore();
      // probe a trivial call to ensure wiring exists
      await s.list({ prefix: "__probe__", limit: 1 }).catch(() => {});
      return s;
    } catch {
      // fall through to manual credentials
    }
  }

  // 2) Manual credentials for v5: require SITE_ID + TOKEN
  const siteID =
    process.env.NETLIFY_SITE_ID || process.env.SITE_ID || process.env.siteID;
  const token =
    process.env.BLOBS_TOKEN ||
    process.env.NETLIFY_BLOBS_TOKEN ||
    process.env.blobs_token;

  if (!siteID || !token) {
    throw new Error(
      "Blobs not configured: set env vars NETLIFY_SITE_ID and BLOBS_TOKEN (site-scoped Blobs token)."
    );
  }

  if (typeof mod.getStore !== "function") {
    throw new Error(
      "@netlify/blobs in this runtime misses getStore(); upgrade or reinstall."
    );
  }

  // name can be any logical namespace; we'll keep a single default
  return mod.getStore({ name: "default", siteID, token });
};
