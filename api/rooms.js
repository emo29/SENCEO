// Vercel Serverless Function (/api/rooms) — Gerçek Zamanlı Bulut Oda & Supabase Bağlantı Köprüsü
// Hem Supabase (SUPABASE_URL + SUPABASE_ANON_KEY tanımlıysa) hem de GitHub/Vercel Cloud DB üzerinde çalışır.

const GH_TOKEN = process.env.GH_TOKEN || "";
const GH_REPO = process.env.GH_REPO || "emo29/senceo";
const GH_BRANCH = "rooms-db";

async function ensureRoomsBranch() {
  const refUrl = `https://api.github.com/repos/${GH_REPO}/git/ref/heads/${GH_BRANCH}`;
  const res = await fetch(refUrl, {
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "senceo-cloud-db"
    }
  });
  if (res.status === 200) return true;

  // Ana daldan (main) SHA al ve rooms-db dalını oluştur
  const mainRes = await fetch(`https://api.github.com/repos/${GH_REPO}/git/ref/heads/main`, {
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "senceo-cloud-db"
    }
  });
  if (!mainRes.ok) return false;
  const mainData = await mainRes.json();
  const sha = mainData.object.sha;

  await fetch(`https://api.github.com/repos/${GH_REPO}/git/refs`, {
    method: "POST",
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "senceo-cloud-db"
    },
    body: JSON.stringify({
      ref: `refs/heads/${GH_BRANCH}`,
      sha
    })
  });
  return true;
}

async function getRoomFromCloud(roomCode) {
  const cleanCode = String(roomCode).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const fileUrl = `https://api.github.com/repos/${GH_REPO}/contents/rooms/${cleanCode}.json?ref=${GH_BRANCH}`;
  const res = await fetch(fileUrl, {
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "senceo-cloud-db"
    }
  });
  if (!res.ok) return null;
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return { room: JSON.parse(content), sha: data.sha };
}

async function saveRoomToCloud(roomCode, roomObj) {
  await ensureRoomsBranch();
  const cleanCode = String(roomCode).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const existing = await getRoomFromCloud(cleanCode);
  const fileUrl = `https://api.github.com/repos/${GH_REPO}/contents/rooms/${cleanCode}.json`;

  const body = {
    message: `Sync room ${cleanCode} (${roomObj.status || "active"})`,
    content: Buffer.from(JSON.stringify(roomObj, null, 2), "utf-8").toString("base64"),
    branch: GH_BRANCH
  };
  if (existing && existing.sha) {
    body.sha = existing.sha;
  }

  const res = await fetch(fileUrl, {
    method: "PUT",
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "senceo-cloud-db"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Cloud DB write error: ${errText}`);
  }
  return roomObj;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Supabase-Url, X-Supabase-Key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // İstemciden veya ortam değişkeninden Supabase bilgisi geldiyse öncelikli olarak Supabase REST API kullan
  const sbUrl = req.headers["x-supabase-url"] || process.env.SUPABASE_URL;
  const sbKey = req.headers["x-supabase-key"] || process.env.SUPABASE_ANON_KEY;

  try {
    if (req.method === "GET") {
      const code = req.query.code;
      if (!code) {
        return res.status(400).json({ error: "Oda kodu (code) gerekli." });
      }

      if (sbUrl && sbKey) {
        const sbRes = await fetch(`${sbUrl}/rest/v1/senceo_rooms?code=eq.${encodeURIComponent(code.toUpperCase())}&select=*`, {
          headers: {
            apikey: sbKey,
            Authorization: `Bearer ${sbKey}`
          }
        });
        if (sbRes.ok) {
          const rows = await sbRes.json();
          if (rows && rows.length > 0) {
            return res.status(200).json({ source: "supabase", room: rows[0].payload || rows[0] });
          }
        }
      }

      const found = await getRoomFromCloud(code);
      if (!found) {
        return res.status(404).json({ error: "Oda bulunamadı. Kodun doğru olduğundan emin olun." });
      }
      return res.status(200).json({ source: "cloud-db", room: found.room });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const room = body.room;
      if (!room || !room.code) {
        return res.status(400).json({ error: "Geçersiz oda verisi." });
      }

      room.updatedAt = new Date().toISOString();

      // Supabase varsa oraya da yaz
      if (sbUrl && sbKey) {
        try {
          await fetch(`${sbUrl}/rest/v1/senceo_rooms`, {
            method: "POST",
            headers: {
              apikey: sbKey,
              Authorization: `Bearer ${sbKey}`,
              "Content-Type": "application/json",
              Prefer: "resolution=merge-duplicates"
            },
            body: JSON.stringify({
              code: room.code.toUpperCase(),
              status: room.status,
              payload: room,
              updated_at: room.updatedAt
            })
          });
        } catch (sbErr) {
          console.warn("Supabase write fallback to cloud:", sbErr);
        }
      }

      const saved = await saveRoomToCloud(room.code, room);
      return res.status(200).json({ ok: true, room: saved });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Sunucu hatası" });
  }
}
