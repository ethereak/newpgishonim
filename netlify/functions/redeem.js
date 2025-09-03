// netlify/functions/redeem.js
const { getStore } = require("@netlify/blobs");

function json(b, s=200){ return { statusCode:s, headers:{'content-type':'application/json'}, body:JSON.stringify(b) }; }

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") return { statusCode:405, body:"Method Not Allowed" };
    const token = (event.queryStringParameters && event.queryStringParameters.token) || "";
    if (!token) return json({ error:"missing token" }, 400);

    const store = getStore({ name: "receipts" });
    const rec = await store.get(`${token}.json`, { type: "json" });

    if (!rec) {
      // Not arrived yet
      return json({ error:"not_ready" }, 404);
    }

    // Map your stored fields into the confirmation.html querystring
    const params = new URLSearchParams({
      date: rec.date || "",
      release_time: rec.release_time || "",
      student_name: rec.student_name || "",
      class: rec.class || "",
      reason: rec.reason || "",
      email: rec.email || "",
      status: "אושר",
      frequency: "חד פעמי",
      exit_time: "00:00",
      return_time: "00:00",
      approved_by: rec.approved_by || ""
    });

    // (Optional) single-use: delete after redemption
    await store.delete(`${token}.json`).catch(()=>{});

    return json({ queryString: params.toString() });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
};
