const { ok, serverError } = require("./_utils.js");
const { set } = require("@netlify/blobs");

exports.handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : null;
    if (body && body.message && body.message.chat) {
      const chatId = body.message.chat.id;
      await set("telegram_chat_id.txt", String(chatId));
      // Optional: reply confirmation
      const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
      if (token) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: "Bot connected. You will receive notifications." })
        });
      }
    }
    return ok({ ok: true });
  } catch (e) { return serverError(e); }
};
