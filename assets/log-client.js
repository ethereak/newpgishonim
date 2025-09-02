// Call this after a successful "generate pass" action to log usage + trigger Telegram
// Example: logUsage({ name, class, date, release_time })
export async function logUsage(payload) {
  try {
    await fetch("/.netlify/functions/log-usage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    // ignore logging errors silently
  }
}