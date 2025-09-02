// netlify/functions/diag.js
exports.handler = async () => {
  const out = {
    node: process.versions.node,
    runtime: process.env.AWS_EXECUTION_ENV || null,
    ts: new Date().toISOString(),
    env: {
      DEPLOY_ID: process.env.DEPLOY_ID || null,
      NETLIFY_DEPLOY_ID: process.env.NETLIFY_DEPLOY_ID || null,
      NETLIFY_SITE_ID: process.env.NETLIFY_SITE_ID || null,
      BLOBS_TOKEN: process.env.BLOBS_TOKEN ? "set" : "missing",
    },
    steps: {},
  };

  try {
    const mod = await import("@netlify/blobs");
    out.moduleKeys = Object.keys(mod);

    // A) getDeployStore
    try {
      const s = typeof mod.getDeployStore === "function" ? mod.getDeployStore() : null;
      if (s) {
        await s.set("diag-a.txt", "ok - getDeployStore");
        out.steps.getDeployStore = {
          ok: true,
          after: await s.get("diag-a.txt"),
        };
      } else {
        out.steps.getDeployStore = { ok: false, reason: "not exported" };
      }
    } catch (e) {
      out.steps.getDeployStore = { ok: false, error: String(e.message || e) };
    }

    // B) getStore({ deployID })
    try {
      const deployID = process.env.DEPLOY_ID || process.env.NETLIFY_DEPLOY_ID || null;
      if (!deployID) {
        out.steps.getStore_deployID = { ok: false, reason: "no DEPLOY_ID" };
      } else if (typeof mod.getStore !== "function") {
        out.steps.getStore_deployID = { ok: false, reason: "getStore not exported" };
      } else {
        const s = mod.getStore({ deployID });
        await s.set("diag-b.txt", "ok - getStore deployID");
        out.steps.getStore_deployID = {
          ok: true,
          after: await s.get("diag-b.txt"),
          deployID,
        };
      }
    } catch (e) {
      out.steps.getStore_deployID = { ok: false, error: String(e.message || e) };
    }

    // C) getStore({ siteID, token }) – only if you later add a token
    try {
      const siteID = process.env.NETLIFY_SITE_ID || null;
      const token = process.env.BLOBS_TOKEN || null;
      if (siteID && token && typeof mod.getStore === "function") {
        const s = mod.getStore({ name: "default", siteID, token });
        await s.set("diag-c.txt", "ok - site token");
        out.steps.getStore_siteToken = {
          ok: true,
          after: await s.get("diag-c.txt"),
        };
      } else {
        out.steps.getStore_siteToken = { ok: false, reason: "missing siteID or token" };
      }
    } catch (e) {
      out.steps.getStore_siteToken = { ok: false, error: String(e.message || e) };
    }

    out.ok = true;
    return { statusCode: 200, headers: { "content-type": "application/json" }, body: JSON.stringify(out, null, 2) };
  } catch (e) {
    out.ok = false;
    out.error = String(e.message || e);
    out.stack = e.stack || null;
    return { statusCode: 200, headers: { "content-type": "application/json" }, body: JSON.stringify(out, null, 2) };
  }
};
