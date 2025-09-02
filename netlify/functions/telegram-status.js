import { ok, serverError } from "./_utils.mjs";
import { get } from "@netlify/blobs";

export const handler = async () => {
  try {
    const chatId = await get("telegram_chat_id.txt");
    return ok({ connected: !!chatId, chatId: chatId || null });
  } catch (e) {
    return serverError(e);
  }
};
