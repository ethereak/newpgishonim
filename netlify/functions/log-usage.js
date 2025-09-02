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

function safe(v, fallback = "?") {
  const s = (v ?? "").toString().trim();
  return s || fallback;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return badRequest("POST only");

  try {
    const store = await blobsStore();

    const ip = getIp(event);
    const ua = event.headers["user-agent"] || "";
    const body = readJSONBody(event) || {};

    // Normalize: support payloads where fields are nested in `data` OR at top-level
    const fields = (body && typeof body === "object" && body.data && typeof body.data === "object")
      ? body.data
      : body;

    // Persist a tidy log (fields + meta)
    const payload = {
      ...fields,
      _meta: {
        type: body.type || "submit",
        ip,
        userAgent: ua,
        path: body.path || event.path,
        ref: body.ref || "",
        lang: body.lang || "",
        tz: body.tz || "",
        screen: body.screen || "",
        timestamp: new Date().toISOString(),
      }
    };

    const key = `logs/${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    await store.set(key, JSON.stringify(payload, null, 2));

    // Telegram message (now reads from normalized `fields`)
    const text =
      `Exit pass used\n` +
      `Name: ${safe(fields.student_name, "Unknown")}\n` +
      `Class: ${safe(fields.class)}\n` +
      `Date: ${safe(fields.date)} | Release: ${safe(fields.release_time)}\n` +
      `Reason: ${safe(fields.reason)}\n` +
      `Approved by: ${safe(fields.approved_by)}\n` +
      `IP: ${ip}`;

    await sendTelegram(text, store);

    return ok({ ok: true });
  } catch (e) {
    console.error("[log-usage] failed:", e);
    return serverError(e);
  }
};
