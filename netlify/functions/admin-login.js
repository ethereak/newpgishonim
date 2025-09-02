import { readJSONBody, ok, badRequest, serverError, signSession } from "./_utils.mjs";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return badRequest("POST only");
  }
  try {
    const body = readJSONBody(event) || {};
    const { email, password } = body;
    const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim();
    const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || "").trim();
    const ADMIN_SESSION_SECRET = (process.env.ADMIN_SESSION_SECRET || "").trim();
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_SESSION_SECRET) {
      return badRequest("Missing admin env vars");
    }
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return { statusCode: 403, body: JSON.stringify({ error: "Invalid credentials" }) };
    }
    const cookieVal = signSession(email, ADMIN_SESSION_SECRET, 7);
    const isProd = (process.env.NODE_ENV || "production") === "production";
    const cookie = [
      `admin_session=${encodeURIComponent(cookieVal)}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      isProd ? "Secure" : "",
      "Max-Age=" + (7 * 24 * 60 * 60),
    ].filter(Boolean).join("; ");
    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "set-cookie": cookie,
      },
      body: JSON.stringify({ ok: true }),
    };
  } catch (e) {
    return serverError(e);
  }
};