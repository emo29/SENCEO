// Vercel Serverless Function (/api/rooms) — v0.03
// Varsayılan Supabase: https://kypzuqnksnlinkfuxvnl.supabase.co
// Hem Supabase tabloları (senceo_rooms, profiles, match_history) hem de GitHub Cloud DB ile tam senkronize çalışır.

const DEFAULT_SUPABASE_URL = "https://kypzuqnksnlinkfuxvnl.supabase.co";
const GH_TOKEN = process.env.GH_TOKEN || "";
const GH_REPO = process.env.GH_REPO || "emo29/senceo";
const GH_BRANCH = "rooms-db";

async function ensureRoomsBranch() {
  if (!GH_TOKEN) return false;
  const refUrl = `https://api.github.com/repos/${GH_REPO}/git/ref/heads/${GH_BRANCH}`;
  const res = await fetch(refUrl, {
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "senceo-cloud-db"
    }
  });
  if (res.status === 200) return true;

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
  if (!GH_TOKEN) return null;
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
  if (!GH_TOKEN) return roomObj;
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

  const sbUrl = (req.headers["x-supabase-url"] || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  const sbKey = req.headers["x-supabase-key"] || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || "";

  try {
    if (req.method === "GET") {
      const code = req.query.code;
      if (!code) {
        return res.status(400).json({ error: "Oda kodu (code) gerekli." });
      }
      const cleanCode = String(code).trim().toUpperCase();

      // 1. Supabase Key varsa önce doğrudan Supabase'den (senceo_rooms) oku
      if (sbUrl && sbKey) {
        try {
          const sbRes = await fetch(`${sbUrl}/rest/v1/senceo_rooms?code=eq.${encodeURIComponent(cleanCode)}&select=*`, {
            headers: {
              apikey: sbKey,
              Authorization: `Bearer ${sbKey}`
            }
          });
          if (sbRes.ok) {
            const rows = await sbRes.json();
            if (rows && rows.length > 0) {
              const row = rows[0];
              const roomData = row.payload && Object.keys(row.payload).length > 0 ? row.payload : row;
              return res.status(200).json({ source: "supabase", room: roomData });
            }
          }
        } catch (sbReadErr) {
          console.warn("Supabase GET fallback:", sbReadErr);
        }
      }

      // 2. Cloud DB'den oku
      const found = await getRoomFromCloud(cleanCode);
      if (!found) {
        return res.status(404).json({ error: "Oda bulunamadı. Kodun doğru olduğundan emin olun." });
      }
      return res.status(200).json({ source: "cloud-db", room: found.room });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

      // A) Profil Kaydı / Güncelleme İsteği (type === 'profile')
      if (body.type === "profile" && body.profile) {
        const p = body.profile;
        if (sbUrl && sbKey) {
          try {
            await fetch(`${sbUrl}/rest/v1/profiles`, {
              method: "POST",
              headers: {
                apikey: sbKey,
                Authorization: `Bearer ${sbKey}`,
                "Content-Type": "application/json",
                Prefer: "resolution=merge-duplicates"
              },
              body: JSON.stringify({
                id: p.id,
                username: p.username,
                auth_provider: p.provider || "guest",
                email: p.email || "",
                avatar: p.avatar || "😎",
                xp: p.xp || 0,
                level: p.level || 1,
                games_played: p.gamesPlayed || 0,
                questions_correct: p.questionsCorrect || 0,
                friends: p.friends || [],
                bonds: p.bonds || {},
                updated_at: new Date().toISOString()
              })
            });
          } catch (e) {}
        }
        return res.status(200).json({ ok: true, profile: p });
      }

      // B) Oda / Oyun Oturumu Kaydı (senceo_rooms & match_history)
      const room = body.room;
      if (!room || !room.code) {
        return res.status(400).json({ error: "Geçersiz oda verisi." });
      }

      room.code = String(room.code).trim().toUpperCase();
      room.updatedAt = new Date().toISOString();

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
              code: room.code,
              room_type: room.roomType || "classic",
              arena_format: room.arenaFormat || "1v1",
              status: room.status || "waiting_p2",
              current_round: room.currentRound || 1,
              whose_turn: room.whoseTurn || "p2",
              category: room.cat || "genel",
              theme: room.thm || "cosmic",
              p1_name: room.p1 || "",
              p2_name: room.p2 || "",
              question_ids: room.qIds || [],
              used_question_ids: room.usedQuestionIds || [],
              p1_answers: room.p1Answers || [],
              p2_guesses: room.p2Guesses || [],
              p1_comments: room.p1Comments || [],
              p2_comments: room.p2Comments || [],
              payload: room,
              updated_at: room.updatedAt
            })
          });

          // Eğer raund tamamlandıysa match_history tablosuna da kayıt düş
          if (room.status === "completed" && typeof room.lastMatchPercentage === "number") {
            await fetch(`${sbUrl}/rest/v1/match_history`, {
              method: "POST",
              headers: {
                apikey: sbKey,
                Authorization: `Bearer ${sbKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                room_code: room.code,
                round_number: room.currentRound || 1,
                p1_name: room.p1 || "Oyuncu 1",
                p2_name: room.p2 || "Oyuncu 2",
                match_percentage: room.lastMatchPercentage,
                correct_count: room.lastCorrectCount || 0,
                total_questions: room.lastTotalQuestions || 10,
                summary: { mode: room.roomType, format: room.arenaFormat }
              })
            });
          }
        } catch (sbErr) {
          console.warn("Supabase room write fallback:", sbErr);
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
