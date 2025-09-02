// Shared utilities for Netlify Functions (Node runtime)
import crypto from "crypto";

export function readJSONBody(event) {
  try {
    if (!event.body) return null;
    return JSON.parse(event.body);
  } catch (e) {
    return null;
  }
}

export function ok(body, headers = {}) {
  return {
    statusCode: 200,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
    body: JSON.stringify(body),
  };
}

export function badRequest(msg = "Bad Request") {
  return {
    statusCode: 400,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ error: msg }),
  };
}

export function unauthorized(msg = "Unauthorized") {
  return {
    statusCode: 401,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ error: msg }),
  };
}

export function serverError(e) {
  const msg = (e && e.message) ? e.message : "Internal Error";
  return {
    statusCode: 500,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ error: msg }),
  };
}

export function getIp(event) {
  const h = event.headers || {};
  return (
    h["x-nf-client-connection-ip"] ||
    h["x-forwarded-for"]?.split(",")[0]?.trim() ||
    h["client-ip"] ||
    ""
  );
}

export function signSession(email, secret, days = 7) {
  const exp = Date.now() + days * 24 * 60 * 60 * 1000;
  const data = `${email}|${exp}`;
  const sig = crypto
    .createHmac("sha256", secret)
    .update(data, "utf8")
    .digest()
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/,"");
  return `${email}|${exp}|${sig}`;
}

export function verifySession(cookie, secret) {
  try {
    const [email, expStr, sig] = (cookie || "").split("|");
    const exp = parseInt(expStr, 10);
    if (!email || !sig || !exp || Date.now() > exp) return null;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${email}|${exp}`, "utf8")
      .digest()
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/,"");
    if (expected !== sig) return null;
    return { email, exp };
  } catch (_e) {
    return null;
  }
}

export function requireAdmin(event) {
  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || "";
  const match = /(?:^|;\s*)admin_session=([^;]+)/.exec(cookieHeader);
  const cookieVal = match ? decodeURIComponent(match[1]) : null;
  const secret = (process.env.ADMIN_SESSION_SECRET || "").trim();
  if (!secret || !cookieVal) return null;
  return verifySession(cookieVal, secret);
}

// Helper to build absolute site URL for webhooks
export function siteUrlFromEvent(event) {
  const envUrl = process.env.SITE_URL;
  if (envUrl) return envUrl.replace(/\/+$/,"");
  const proto = (event.headers["x-forwarded-proto"] || "https").split(",")[0];
  const host = (event.headers["x-forwarded-host"] || event.headers.host || "").split(",")[0];
  return `${proto}://${host}`;
}