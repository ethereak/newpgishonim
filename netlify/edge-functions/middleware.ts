/// <reference lib="dom" />
// Edge middleware: fast, loop-safe, and cached
// - Skips internal/function/static requests
// - Fetches bans via a Function (no netlify:blobs import) and caches for 60s
// - Protects /admin and /admin/* ONLY (allows /admin-login)

function b64urlFromBytes(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSHA256(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64urlFromBytes(sig);
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const [k, v] = part.split("=");
    if (k === name) return decodeURIComponent(v || "");
  }
  return null;
}

function ipFromHeaders(headers: Headers): string {
  return (
    headers.get("x-nf-client-connection-ip") ||
    (headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    headers.get("cf-connecting-ip") ||
    ""
  );
}

function ipToInt(ip: string): number | null {
  const p = ip.split(".").map((x) => parseInt(x, 10));
  if (p.length !== 4 || p.some((n) => isNaN(n) || n < 0 || n > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

function inCIDR(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const ipInt = ipToInt(ip);
  const rangeInt = ipToInt(range || "");
  const bits = parseInt(bitsStr || "", 10);
  if (ipInt == null || rangeInt == null || isNaN(bits)) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

function isIpBanned(ip: string, entries: Array<{ pattern: string }>): boolean {
  if (!ip) return false;
  for (const e of entries || []) {
    const p = e.pattern;
    if (!p) continue;
    if (p.includes("/")) {
      if (inCIDR(ip, p)) return true;
    } else {
      if (ip === p) return true;
    }
  }
  return false;
}

// Simple in-memory cache (per Edge isolate)
const BAN_CACHE_KEY = "__bans_cache";
const BAN_CACHE_TS_KEY = "__bans_cache_ts";
const BAN_TTL_MS = 60_000; // 60s

async function loadBansCached(origin: string) {
  // @ts-ignore
  const cached = (globalThis as any)[BAN_CACHE_KEY];
  // @ts-ignore
  const ts = (globalThis as any)[BAN_CACHE_TS_KEY] as number | undefined;
  if (cached && ts && Date.now() - ts < BAN_TTL_MS) return cached;

  const url = new URL("/.netlify/functions/bans", origin);
  const res = await fetch(url.toString(), { headers: { "x-edge": "1" } });
  let bans = { entries: [] as Array<{ pattern: string }> };
  if (res.ok) bans = await res.json();

  // @ts-ignore
  (globalThis as any)[BAN_CACHE_KEY] = bans;
  // @ts-ignore
  (globalThis as any)[BAN_CACHE_TS_KEY] = Date.now();
  return bans;
}

export default async (request: Request, context: any) => {
  const url = new URL(request.url);

  // 1) Hard SKIPS to keep things fast and avoid loops
  // a) Requests coming from our own Edge fetch
  if (request.headers.get("x-edge") === "1") return context.next();
  // b) Function calls and Netlify internals
  if (url.pathname.startsWith("/.netlify/")) return context.next();
  // c) Static assets (don’t waste Edge time on CSS/JS/images/fonts/maps)
  if (/\.(css|js|mjs|json|png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|map)$/i.test(url.pathname)) {
    return context.next();
  }

  // 2) IP ban check (cached)
  const ip = ipFromHeaders(request.headers);
  try {
    const bans = await loadBansCached(url.origin);
    if (isIpBanned(ip, bans.entries)) {
      return new Response("אכלתם באן", {
        status: 403,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  } catch {
    // fail-open if bans fetch fails
  }

  // 3) Admin guard:
  //    Allow login page through
  if (url.pathname === "/admin-login" || url.pathname === "/admin-login.html") {
    return context.next();
  }
  //    Protect /admin and /admin/*
  if (/^\/admin(\/|$)/.test(url.pathname)) {
    const cookie = parseCookie(request.headers.get("cookie"), "admin_session");
    const secret = (Deno.env.get("ADMIN_SESSION_SECRET") || "").trim();
    if (!cookie || !secret) return Response.redirect("/admin-login", 302);
    try {
      const [email, expStr, sig] = cookie.split("|");
      const exp = parseInt(expStr, 10);
      if (!email || !sig || !exp || Date.now() > exp) return Response.redirect("/admin-login", 302);
      const expected = await hmacSHA256(`${email}|${exp}`, secret);
      if (expected !== sig) return Response.redirect("/admin-login", 302);
    } catch {
      return Response.redirect("/admin-login", 302);
    }
  }

  return context.next();
};
