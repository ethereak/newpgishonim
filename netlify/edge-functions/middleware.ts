/// <reference lib="dom" />
// Netlify Edge Function: Middleware
// - Blocks banned IPs
// - Guards /admin routes by validating a signed session cookie

import { get } from "netlify:blobs";

function b64url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  const b64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/,"");
  return b64;
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
  return b64url(sig);
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const parts = header.split(/;\s*/);
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (k === name) return decodeURIComponent(v || "");
  }
  return null;
}

function ipFromHeaders(headers: Headers): string {
  const xnf = headers.get("x-nf-client-connection-ip");
  if (xnf) return xnf.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return "";
}

function ipToInt(ip: string): number | null {
  const parts = ip.split(".").map(x => parseInt(x, 10));
  if (parts.length !== 4 || parts.some(n => isNaN(n) || n < 0 || n > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function inCIDR(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const bits = parseInt(bitsStr, 10);
  const ipInt = ipToInt(ip);
  const rangeInt = ipToInt(range || "");
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

export default async (request: Request, context: any) => {
  const url = new URL(request.url);
  const ip = ipFromHeaders(request.headers);

  // 1) Edge IP ban check
  let bans: { entries: Array<{ pattern: string }> } = { entries: [] };
  try {
    const raw = await get("bans.json");
    if (raw) bans = JSON.parse(raw as string);
  } catch (_e) {
    // ignore if not found / parse error
  }
  if (isIpBanned(ip, bans.entries)) {
    return new Response("אכלתם באן", {
      status: 403,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  // 2) Admin route guard
  if (url.pathname.startsWith("/admin")) {
    const cookie = parseCookie(request.headers.get("cookie"), "admin_session");
    const secret = (Deno.env.get("ADMIN_SESSION_SECRET") || "").trim();
    if (!cookie || !secret) {
      return Response.redirect("/admin-login", 302);
    }
    try {
      const [email, expStr, sig] = cookie.split("|");
      const exp = parseInt(expStr, 10);
      if (!email || !sig || !exp || Date.now() > exp) {
        return Response.redirect("/admin-login", 302);
      }
      const toSign = `${email}|${exp}`;
      const expected = await hmacSHA256(toSign, secret);
      if (expected !== sig) {
        return Response.redirect("/admin-login", 302);
      }
    } catch (_e) {
      return Response.redirect("/admin-login", 302);
    }
  }

  return context.next();
};