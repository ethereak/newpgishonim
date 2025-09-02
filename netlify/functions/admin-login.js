const { readJSONBody, ok, badRequest, serverError, signSession, setSessionCookie } = require("./_utils.js");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return badRequest("POST only");
    const body = readJSONBody(event) || {};
    const email = (body.email || "").trim();
    const password = (body.password || "").trim();
    if (email !== (process.env.ADMIN_EMAIL || "").trim() || password !== (process.env.ADMIN_PASSWORD || "").trim()) {
      return badRequest("Invalid credentials");
    }
    const token = signSession(email, (process.env.ADMIN_SESSION_SECRET || "").trim());
    return {
      statusCode: 200,
      headers: { "set-cookie": setSessionCookie(token), "content-type": "application/json" },
      body: JSON.stringify({ ok: true })
    };
  } catch (e) { return serverError(e); }
};
