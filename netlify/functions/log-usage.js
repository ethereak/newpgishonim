const { readJSONBody, ok, badRequest, serverError, getIp } = require("./_utils.js");

async function sendTelegram(msg) {
  try {
    const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
    if (!token) return;
    const { get } = await import("@netlify/blobs");
    const chatId = await get("telegram_chat_id.txt");
    if (!chatId) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: msg })
    });
  } catch {}
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return badRequest("POST only");
  try {
    const { set } = await import("@netlify/blobs");
    const ip = getIp(event);
    const ua = event.headers["user-agent"] || "";
    const data = readJSONBody(event) || {};
    const payload = { ...data, ip, userAgent: ua, timestamp: new Date().toISOString() };
    const key = `logs/${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    await set(key, JSON.stringify(payload));
    const text = `New pass: ${data.student_name || "Unknown"} • class ${data.class || "?"} • date ${data.date || "?"} • release ${data.release_time || "?"} • IP ${ip}`;
    await sendTelegram(text);
    return ok({ ok: true });
  } catch (e) { return serverError(e); }
};
