// Load and render the announcement banner at the top of the homepage
(async () => {
  try {
    const res = await fetch("/.netlify/functions/banner", { credentials: "include" });
    if (!res.ok) return;
    const b = await res.json();
    if (!b.enabled || !b.text) return;
    const bar = document.createElement("div");
    bar.style.cssText = "position:sticky;top:0;left:0;right:0;z-index:9999;padding:10px 14px;font:14px/1.3 system-ui;border-bottom:1px dashed #444;background:#111;color:#eee";
    bar.textContent = b.text;
    document.body.prepend(bar);
  } catch {}
})();