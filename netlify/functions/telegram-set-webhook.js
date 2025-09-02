import { ok, badRequest, serverError, requireAdmin, siteUrlFromEvent } from "../_utils.mjs";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return badRequest("POST only");
  const admin = requireAdmin(event);
  if (!admin) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  try {
    const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
    if (!token) return badRequest("Missing TELEGRAM_BOT_TOKEN env var");
    const baseUrl = siteUrlFromEvent(event);
    const webhookUrl = `${baseUrl}/.netlify/functions/telegram-webhook`;
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const data = await res.json();
    return ok({ ok: true, telegram: data });
  } catch (e) {
    return serverError(e);
  }
};