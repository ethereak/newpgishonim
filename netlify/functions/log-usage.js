const { readJSONBody, ok, badRequest, serverError, getIp } = require("./_utils.js");
const { blobsStore } = require("./_blobs.js");

async function sendTelegram(msg, store) {
  try {
    const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
    if (!token) return;
    const chatId = await store.get("telegram_chat_id.txt");
    if (!chatId) return;

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: msg })
    });
  } catch (e) {
    console.warn("[log-usage] telegram send failed:", e?.message || e);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return badRequest("POST only");

  try {
    const store = await blobsStore();

    const ip = getIp(event);
    const ua = event.headers["user-agent"] || "";
    const data = readJSONBody(event) || {};

    const payload = {
      ...data,
      ip,
      userAgent: ua,
      timestamp: new Date().toISOString(),
      path: event.path
    };

    const key = `logs/${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    await store.set(key, JSON.stringify(payload));

    const text = `Exit pass used: ${data.student_name || "Unknown"} | class ${data.class || "?"} | date ${data.date || "?"} | release ${data.release_time || "?"} | IP ${ip}`;
    await sendTelegram(text, store);

    return ok({ ok: true });
  } catch (e) {
    console.error("[log-usage] failed:", e);
    return serverError(e);
  }
};
