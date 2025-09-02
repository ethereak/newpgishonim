const { ok, serverError, requireAdmin } = require("./_utils.js");
const { get } = require("@netlify/blobs");

exports.handler = async (event) => {
  try {
    if (!requireAdmin(event)) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    const chatId = await get("telegram_chat_id.txt");
    return ok({ connected: !!chatId, chatId: chatId || null });
  } catch (e) { return serverError(e); }
};
