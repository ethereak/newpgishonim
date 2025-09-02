const { readJSONBody, ok, badRequest, serverError, getIp } = require("./_utils.js");
const { blobsStore } = require("./_blobs.js");

// get the first non-empty STRING among candidate keys
function firstString(fields, keys) {
  if (!fields || typeof fields !== "object") return "";
  for (const k of keys) {
    if (!(k in fields)) continue;
    const v = fields[k];
    if (typeof v === "string") {
      const s = v.trim();
      if (s) return s;
    }
  }
  return "";
}

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

function safe(s, fallback = "?") {
  const v = (s ?? "").toString().trim();
  return v || fallback;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return badRequest("POST only");

  try {
    const store = await blobsStore();

    const ip = getIp(event);
    const ua = event.headers["user-agent"] || "";
    const body = readJSONBody(event) || {};

    // Your frontend posts { type, data: { ...fields... }, meta... }
    const fields = (body && typeof body === "object" && body.data && typeof body.data === "object")
      ? body.data
      : body;

    // STRICT mapping: only accept plain strings from the known inputs
    const studentName = firstString(fields, ["student_name", "שם התלמיד", "שם", "name"]);
    const className   = firstString(fields, ["class", "כיתה"]);
    const date        = firstString(fields, ["date", "תאריך"]);
    const releaseTime = firstString(fields, ["release_time", "שעת השחרור", "time"]);
    const reason      = firstString(fields, ["reason", "סיבה"]);
    const approvedBy  = firstString(fields, ["approved_by", "מאשר", "אושר על ידי"]);

    // Persist a tidy log (and store keys we saw for quick debugging)
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
        _keys: Object.keys(fields || {})
      }
    };

    const key = `logs/${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    await store.set(key, JSON.stringify(payload, null, 2));

    // Only notify for submissions
    if ((body.type || "submit") === "submit") {
      const text =
        `Exit pass used\n` +
        `Name: ${safe(studentName, "Unknown")}\n` +
        `Class: ${safe(className)}\n` +
        `Date: ${safe(date)} | Release: ${safe(releaseTime)}\n` +
        `Reason: ${safe(reason)}\n` +
        `Approved by: ${safe(approvedBy)}\n` +
        `IP: ${ip}`;
      await sendTelegram(text, store);
    }

    return ok({ ok: true });
  } catch (e) {
    console.error("[log-usage] failed:", e);
    return serverError(e);
  }
};
