// CommonJS utilities for Netlify Functions

const crypto = require("crypto");

function json(status, obj) {
  return {
    statusCode: status,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(obj),
  };
}

function ok(obj) { return json(200, obj); }
function badRequest(msg) { return json(400, { error: msg || "Bad request" }); }
function serverError(err) {
  console.error(err);
  return json(500, { error: "Server error" });
}

function readJSONBody(event) {
  try { return event.body ? JSON.parse(event.body) : null; } catch { return null; }
}

function parseCookie(header, name) {
  if (!header) return null;
  const parts = header.split(/;\s*/);
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (k === name) return decodeURIComponent(v || "");
  }
  return null;
}

function signSession(email, secret, ttlMs = 1000 * 60 * 60 * 8) {
  const exp = Date.now() + ttlMs;
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${email}|${exp}`)
    .digest("base64url");
  return `${email}|${exp}|${sig}`;
}

function requireAdmin(event) {
  const secret = (process.env.ADMIN_SESSION_SECRET || "").trim();
  if (!secret) return false;
  const cookie = parseCookie(event.headers?.cookie || event.headers?.Cookie || "", "admin_session");
  if (!cookie) return false;
  const [email, expStr, sig] = cookie.split("|");
  const exp = parseInt(expStr, 10);
  if (!email || !sig || !exp || Date.now() > exp) return false;
  const expect = crypto
    .createHmac("sha256", secret)
    .update(`${email}|${exp}`)
    .digest("base64url");
  return sig === expect;
}

function setSessionCookie(value) {
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 8).toUTCString();
  return `admin_session=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires}`;
}
function clearSessionCookie() {
  return `admin_session=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function siteUrlFromEvent(event) {
  const envUrl = (process.env.SITE_URL || "").trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const proto = (event.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = (event.headers["x-forwarded-host"] || event.headers.host || "").split(",")[0].trim();
  return `${proto}://${host}`;
}

function getIp(event) {
  const h = event.headers || {};
  const fwd = (h["x-forwarded-for"] || h["X-Forwarded-For"] || "").split(",")[0].trim();
  return h["x-nf-client-connection-ip"] || fwd || h["cf-connecting-ip"] || "";
}

module.exports = {
  ok, badRequest, serverError, readJSONBody,
  signSession, setSessionCookie, clearSessionCookie,
  requireAdmin, siteUrlFromEvent, getIp
};
