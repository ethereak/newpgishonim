const { ok, serverError } = require("./_utils.js");
const { blobsStore } = require("./_blobs.js");

exports.handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : null;

    // Telegram will POST updates here
    if (body && body.message && body.message.chat) {
      const chatId = body.message.chat.id;

      const store = await blobsStore();
      await store.set("telegram_chat_id.txt", String(chatId));

      const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
      if (token) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: "Bot connected. You'll receive notifications from the app." })
        });
      }
    }

    return ok({ ok: true });
  } catch (e) {
    console.error("[telegram-webhook] failed:", e);
    return serverError(e);
  }
};
