/// <reference lib="dom" />
// Netlify Edge Function (Deno)
// - Blocks banned IPs (fetched from a Function so we don't import netlify:blobs)
// - Guards /admin routes by validating a signed session cookie

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

export default async (request: Request, context: any) => {
  const url = new URL(request.url);
  const ip = ipFromHeaders(request.headers);

  // Load bans via function (public GET)
  let bans: { entries: Array<{ pattern: string }> } = { entries: [] };
  try {
    const bansUrl = new URL("/.netlify/functions/bans", url.origin);
    const res = await fetch(bansUrl.toString(), { headers: { "x-edge": "1" } });
    if (res.ok) bans = await res.json();
  } catch {}

  if (isIpBanned(ip, bans.entries)) {
    return new Response("אכלתם באן", {
      status: 403,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  // Admin guard
  if (url.pathname.startsWith("/admin")) {
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
