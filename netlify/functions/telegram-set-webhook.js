const { ok, badRequest, serverError, requireAdmin, siteUrlFromEvent } = require("./_utils.js");

exports.handler = async (event) => {
  try {
    if (!requireAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
    if (!token) return badRequest("No bot token");
    const base = siteUrlFromEvent(event);
    const url = `${base}/.netlify/functions/telegram-webhook`;
    const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url })
    });
    const j = await r.json();
    return ok(j);
  } catch (e) { return serverError(e); }
};
