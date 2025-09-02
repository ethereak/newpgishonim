// assets/log-client.js
export function logUsage(payload) {
  try {
    const url = "/.netlify/functions/log-usage";
    const json = JSON.stringify(payload);

    // Best effort: sendBeacon if available (non-blocking, survives navigation)
    if (navigator.sendBeacon) {
      const blob = new Blob([json], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }

    // Fallback: keepalive fetch, so the browser tries to finish during unload
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: json,
      keepalive: true,
    }).catch(() => {});
  } catch {}
}
