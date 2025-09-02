import { getStore } from "@netlify/blobs";
const store = getStore({ name: "pgishonim" });


export const handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : null;
    const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
    if (!token) return { statusCode: 200, body: "No bot token" };

    if (body && body.message && body.message.chat) {
      const chatId = body.message.chat.id;
      await store.set("telegram_chat_id.txt", String(chatId));
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: "Bot connected. You'll now receive notifications." }),
      });
    }
    return { statusCode: 200, body: "OK" };
  } catch (e) {
    return { statusCode: 500, headers: { "content-type": "application/json" }, body: JSON.stringify({ error: e.message || "error" }) };
  }
};
