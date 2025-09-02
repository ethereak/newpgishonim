const { ok, serverError, clearSessionCookie } = require("./_utils.js");
exports.handler = async () => {
  try {
    return { statusCode: 200, headers: { "set-cookie": clearSessionCookie(), "content-type": "application/json" }, body: JSON.stringify({ ok: true }) };
  } catch (e) { return serverError(e); }
};
