import { getStore } from "@netlify/blobs";

export default async (event, context) => {
  try {
    const store = getStore({ name: "logs" });
    const ip = event.headers.get("x-forwarded-for")?.split(",")[0].trim()
             || event.headers.get("client-ip")
             || event.headers.get("x-real-ip")
             || "unknown";
    const ua = event.headers.get("user-agent") || "";
    const now = new Date().toISOString();

    const body = event.httpMethod === "POST"
      ? JSON.parse(event.body || "{}")
      : (event.queryStringParameters || {});

    const entry = {
      ts: now,
      ip,
      ua,
      meta: {
        path: body.path || "",
        ref: body.ref || "",
        lang: body.lang || "",
        tz: body.tz || "",
        screen: body.screen || "",
        type: body.type || "view"
      },
      data: body.data || null
    };

    const existing = await store.get("events.json");
    const arr = existing ? JSON.parse(existing) : [];
    arr.unshift(entry);
    if (arr.length > 10000) arr.length = 10000;
    await store.set("events.json", JSON.stringify(arr));

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
};
