export const handler = async () => {
  const cookie = [
    "admin_session=deleted",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ].join("; ");
  return {
    statusCode: 200,
    headers: { "set-cookie": cookie, "content-type": "application/json" },
    body: JSON.stringify({ ok: true }),
  };
};