const { readJSONBody, ok, badRequest, serverError, getIp } = require("./_utils.js");
const { blobsStore } = require("./_blobs.js");

// Utility: pick first non-empty value from many possible keys (case-insensitive).
function pick(fields, variants, fallback = "") {
  if (!fields || typeof fields !== "object") return fallback;
  // exact keys
  for (const k of variants) {
    if (fields[k] != null && String(fields[k]).trim() !== "") return String(fields[k]).trim();
  }
  // case-insensitive match + tolerate spaces/underscores/hyphens
  const norm = (s) => String(s).toLowerCase().replace(/[\s\-_]+/g, "");
  const map = new Map();
  for (const [k, v] of Object.entries(fields)) map.set(norm(k), v);
  for (const k of variants) {
    const v = map.get(norm(k));
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  // last resort: heuristic — any key containing "name" but not "approved"
  for (const [k, v] of Object.entries(fields)) {
    const nk = norm(k);
    if (nk.includes("name") && !nk.includes("approved") && String(v).trim() !== "") {
      return String(v).trim();
    }
    // Hebrew heuristic: any key containing "שם" but not "מאשר"
    if (k.includes("שם") && !k.includes("מאשר") && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return fallback;
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

    // Normalize fields: support payloads where fields are nested in `data` or at top-level
    const fields = (body && typeof body === "object" && body.data && typeof body.data === "object")
      ? body.data
      : body;

    // Extract with robust key matching (English/Hebrew + variants)
    const studentName = pick(fields, [
      "student_name", "studentName", "name", "student",
      "שם התלמיד", "שם_התלמיד", "שם-התלמיד", "שם"
    ], "Unknown");

    const className = pick(fields, [
      "class", "grade", "כיתה", "כִּתָּה"
    ], "?");

    const date = pick(fields, [
      "date", "תאריך"
    ], "?");

    const releaseTime = pick(fields, [
      "release_time", "release-time", "releaseTime",
      "time", "שעת השחרור", "שעת_השחרור", "שעת-השחרור"
    ], "?");

    const reason = pick(fields, [
      "reason", "סיבה"
    ], "?");

    const approvedBy = pick(fields, [
      "approved_by", "approvedBy", "approver", "מאשר", "אושר על ידי", "אושר_על_ידי", "אושר-על-ידי"
    ], "?");

    // Persist a tidy log (fields + meta) for the admin UI
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
        // help debug quickly if needed
        _keys: Object.keys(fields || {})
      }
    };

    const key = `logs/${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    await store.set(key, JSON.stringify(payload, null, 2));

    // Only notify Telegram for actual submissions (not page views)
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
