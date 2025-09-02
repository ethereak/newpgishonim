let cursor = null;

function qs(sel){ return document.querySelector(sel); }
function el(tag, attrs={}, ...children) {
  const e = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of children) e.append(c);
  return e;
}

async function api(path, opts={}) {
  const res = await fetch(path, { credentials: "include", ...opts });
  if (res.status === 401) { location.href = "/admin-login"; return; }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function renderLogsHeader(container) {
  container.append(
    el("div", { class:"row header" },
      el("div", {}, "Name"),
      el("div", {}, "Class"),
      el("div", {}, "Date"),
      el("div", {}, "Release"),
      el("div", {}, "IP"),
      el("div", {}, "Actions"),
    )
  );
}

function renderLogRow(container, item) {
  const btn = el("button", { onclick: async () => {
    const ok = confirm(`Ban IP ${item.ip}?`);
    if (!ok) return;
    await api("/.netlify/functions/bans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pattern: item.ip, note: `Banned via log ${item.key}` })
    });
    await refreshBans();
    alert("IP banned.");
  }}, "Ban IP");

  container.append(
    el("div", { class:"row" },
      el("div", {}, item.name || "—"),
      el("div", {}, item.class || "—"),
      el("div", {}, item.date || "—"),
      el("div", {}, item.release_time || "—"),
      el("div", { class:"ip" }, item.ip || "—"),
      el("div", {}, btn),
    )
  );
}

async function loadLogs() {
  const table = qs("#logsTable");
  if (!table.dataset.header) { renderLogsHeader(table); table.dataset.header = "1"; }
  const data = await api("/.netlify/functions/logs?limit=20" + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""));
  cursor = data.cursor;
  for (const item of data.items) renderLogRow(table, item);
  qs("#loadMoreBtn").disabled = !cursor;
}

async function refreshBans() {
  const data = await api("/.netlify/functions/bans");
  const ul = qs("#banList");
  ul.innerHTML = "";
  for (const e of data.entries) {
    const li = el("li", {},
      el("span", {}, e.pattern + (e.note ? ` – ${e.note}` : "")),
      el("button", { onclick: async () => {
        await api("/.netlify/functions/bans", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pattern: e.pattern })
        });
        await refreshBans();
      }}, "Unban")
    );
    ul.append(li);
  }
}

async function loadBanner() {
  const b = await api("/.netlify/functions/banner");
  qs("#bannerEnabled").checked = !!b.enabled;
  qs("#bannerText").value = b.text || "";
  qs("#bannerSeverity").value = b.severity || "info";
}

async function saveBanner(ev) {
  ev.preventDefault();
  const body = {
    enabled: qs("#bannerEnabled").checked,
    text: qs("#bannerText").value,
    severity: qs("#bannerSeverity").value
  };
  await api("/.netlify/functions/banner", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  alert("Banner saved.");
}

async function loadTgStatus() {
  const s = await api("/.netlify/functions/telegram-status");
  qs("#tgStatus").textContent = s.connected ? `Connected (chat ${s.chatId})` : "Not connected";
}

async function connectTelegram() {
  await api("/.netlify/functions/telegram-set-webhook", { method: "POST" });
  alert("Webhook set. Now open Telegram, send /start to your bot.");
  await loadTgStatus();
}

async function logout() {
  await api("/.netlify/functions/admin-logout", { method: "POST" });
  location.href = "/admin-login";
}

document.addEventListener("DOMContentLoaded", async () => {
  qs("#loadMoreBtn").addEventListener("click", loadLogs);
  qs("#banForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const pattern = qs("#banPattern").value.trim();
    const note = qs("#banNote").value.trim();
    if (!pattern) return;
    await api("/.netlify/functions/bans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pattern, note })
    });
    qs("#banPattern").value = "";
    qs("#banNote").value = "";
    await refreshBans();
  });
  qs("#bannerForm").addEventListener("submit", saveBanner);
  qs("#tgConnectBtn").addEventListener("click", connectTelegram);
  qs("#logoutBtn").addEventListener("click", logout);

  await Promise.all([loadBanner(), refreshBans(), loadTgStatus()]);
  await loadLogs();
});