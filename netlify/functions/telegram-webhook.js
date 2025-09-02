import { ok, serverError } from "./_utils.js";
import { set } from "@netlify/blobs";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    if (body.message && body.message.chat) {
      const chatId = body.message.chat.id;
      await set("telegram_chat_id.txt", String(chatId));
      // optional: reply to user
    }
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
};
