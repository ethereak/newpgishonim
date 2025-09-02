const { ok, serverError, requireAdmin } = require("./_utils.js");
const { blobsStore } = require("./_blobs.js");

exports.handler = async (event) => {
  try {
    if (!requireAdmin(event)) {
      return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    }
    const store = await blobsStore();
    const chatId = await store.get("telegram_chat_id.txt");
    return ok({ connected: !!chatId, chatId: chatId || null });
  } catch (e) {
    console.error("[telegram-status] failed:", e);
    return serverError(e);
  }
};
