import { ok, serverError, requireAdmin } from "../_utils.mjs";
import { get } from "@netlify/blobs";

export const handler = async (event) => {
  const admin = requireAdmin(event);
  if (!admin) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  try {
    const chatId = await get("telegram_chat_id.txt");
    return ok({ connected: !!chatId, chatId: chatId || null });
  } catch (e) {
    return serverError(e);
  }
};