// Vercel Serverless Function (/api/rooms) — v0.06
// Varsayılan Supabase: https://kypzuqnksnlinkfuxvnl.supabase.co
// Özellikler:
// 1. 409 Conflict korumalı (Optimistic Retry) Bulut JSON Okuma/Yazma
// 2. Çift Yönlü Arkadaşlık Bağı İstekleri (send_friend_request, accept_friend_request, reject_friend_request)
// 3. Gerçek Zamanlı Bildirim Merkezi (Arkadaşlık isteği, yeni düello daveti, sıra sende, hatırlatma/nudge)
// 4. Hem p1FriendCode hem p2FriendCode için çoklu aktif düello indeksleme (activeRooms[])
// 5. Canlı Oda Lobi katılımcı senkronizasyonu (join_live_lobby) ve Liderlik Tablosu (leaderboard)

const DEFAULT_SUPABASE_URL = "https://kypzuqnksnlinkfuxvnl.supabase.co";
const GH_TOKEN = process.env.GH_TOKEN || "";
const GH_REPO = process.env.GH_REPO || "emo29/senceo";
const GH_BRANCH = "rooms-db";

let branchVerified = false;

async function ensureRoomsBranch() {
  if (!GH_TOKEN || branchVerified) return true;
  const refUrl = `https://api.github.com/repos/${GH_REPO}/git/ref/heads/${GH_BRANCH}`;
  const res = await fetch(refUrl, {
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "senceo-cloud-db"
    }
  });
  if (res.status === 200) {
    branchVerified = true;
    return true;
  }

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
  branchVerified = true;
  return true;
}

async function getJsonFromCloudPath(relPath) {
  if (!GH_TOKEN) return null;
  const fileUrl = `https://api.github.com/repos/${GH_REPO}/contents/${relPath}?ref=${GH_BRANCH}&t=${Date.now()}`;
  const res = await fetch(fileUrl, {
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "senceo-cloud-db",
      "Cache-Control": "no-cache"
    }
  });
  if (!res.ok) return null;
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return { data: JSON.parse(content), sha: data.sha };
}

// STATE_ISSUE #1 Çözümü: 409 Conflict durumunda güncel SHA ile 3 kez otomatik yeniden deneme
async function putJsonToCloudPath(relPath, payloadOrUpdater, commitMessage, maxRetries = 3) {
  if (!GH_TOKEN) {
    return typeof payloadOrUpdater === "function" ? payloadOrUpdater(null) : payloadOrUpdater;
  }
  await ensureRoomsBranch();
  const fileUrl = `https://api.github.com/repos/${GH_REPO}/contents/${relPath}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const existing = await getJsonFromCloudPath(relPath);
    const finalPayload =
      typeof payloadOrUpdater === "function"
        ? payloadOrUpdater(existing ? existing.data : null)
        : payloadOrUpdater;

    const body = {
      message: commitMessage || `Sync ${relPath}`,
      content: Buffer.from(JSON.stringify(finalPayload, null, 2), "utf-8").toString("base64"),
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

    if (res.ok) {
      return finalPayload;
    }

    if (res.status === 409 || res.status === 422) {
      await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
      continue;
    }

    const errText = await res.text();
    throw new Error(`Cloud DB write error (${res.status}): ${errText}`);
  }

  throw new Error(`Cloud DB write conflict after ${maxRetries} retries: ${relPath}`);
}

function createDefaultFriendRecord(friendCode, username = "Oyuncu") {
  return {
    friendCode,
    username: username || "Oyuncu",
    level: 1,
    xp: 0,
    latestRoomCode: "",
    activeRooms: [],
    incomingRequests: [],
    acceptedFriends: [],
    notifications: [],
    updatedAt: new Date().toISOString()
  };
}

function pushNotification(record, notif) {
  if (!Array.isArray(record.notifications)) record.notifications = [];
  const exists = record.notifications.some((n) => n.id === notif.id);
  if (!exists) {
    record.notifications.unshift({
      id: notif.id || `NTF_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: notif.type || "info",
      title: notif.title || "Bildirim",
      message: notif.message || "",
      fromCode: notif.fromCode || "",
      fromName: notif.fromName || "",
      roomCode: notif.roomCode || "",
      read: false,
      createdAt: new Date().toISOString()
    });
    record.notifications = record.notifications.slice(0, 30);
  }
}

function upsertActiveRoomInFriendRecord(record, roomObj) {
  if (!Array.isArray(record.activeRooms)) record.activeRooms = [];
  const summary = {
    code: roomObj.code,
    p1: roomObj.p1 || "Oyuncu 1",
    p2: roomObj.p2 || "",
    p1FriendCode: roomObj.p1FriendCode || "",
    p2FriendCode: roomObj.p2FriendCode || "",
    status: roomObj.status || "waiting_p2",
    currentRound: roomObj.currentRound || 1,
    cat: roomObj.cat || "genel",
    lastMatchPercentage: roomObj.lastMatchPercentage,
    updatedAt: new Date().toISOString()
  };
  const idx = record.activeRooms.findIndex((r) => r.code === roomObj.code);
  if (idx >= 0) {
    record.activeRooms[idx] = summary;
  } else {
    record.activeRooms.unshift(summary);
  }
  record.activeRooms = record.activeRooms.slice(0, 20);
  record.latestRoomCode = roomObj.code;
}

async function getRoomFromCloud(roomCode) {
  const cleanCode = String(roomCode).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const found = await getJsonFromCloudPath(`rooms/${cleanCode}.json`);
  return found ? { room: found.data, sha: found.sha } : null;
}

async function saveRoomToCloud(roomCode, roomObj) {
  const cleanCode = String(roomCode).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  await putJsonToCloudPath(
    `rooms/${cleanCode}.json`,
    roomObj,
    `Sync room ${cleanCode} (${roomObj.status || "active"})`
  );

  // 1. P1'in (Odayı kuranın) arkadaş kodu indeksini güncelle
  if (roomObj.p1FriendCode && /^SNC-\d{4}$/i.test(roomObj.p1FriendCode)) {
    const p1Code = roomObj.p1FriendCode.toUpperCase();
    try {
      await putJsonToCloudPath(
        `friends/${p1Code}.json`,
        (existing) => {
          const rec = Object.assign(createDefaultFriendRecord(p1Code, roomObj.p1), existing || {});
          if (roomObj.p1 && roomObj.p1 !== "Misafir Oyuncu") rec.username = roomObj.p1;
          upsertActiveRoomInFriendRecord(rec, roomObj);

          // Eğer P2 hamlesini yaptıysa (waiting_p1_half2) veya oyun bittiyse (completed) P1'e bildirim ekle!
          if (roomObj.status === "waiting_p1_half2") {
            pushNotification(rec, {
              id: `TURN_P1_${cleanCode}_R${roomObj.currentRound || 1}`,
              type: "turn",
              title: "🔥 Sıra Sende! Karşı Saldırı Geldi",
              message: `${roomObj.p2 || "Arkadaşın"} 5 sorunu tahmin etti ve sana 5 yeni soru gönderdi! (#${cleanCode})`,
              fromCode: roomObj.p2FriendCode || "",
              fromName: roomObj.p2 || "Arkadaşın",
              roomCode: cleanCode
            });
          } else if (roomObj.status === "completed") {
            pushNotification(rec, {
              id: `DONE_P1_${cleanCode}_R${roomObj.currentRound || 1}`,
              type: "completed",
              title: `🏆 Düello Tamamlandı! (%${roomObj.lastMatchPercentage ?? 80} Uyum)`,
              message: `${roomObj.p2 || "Arkadaşın"} ile #${cleanCode} düellosunun sonuç karnesi hazır!`,
              fromCode: roomObj.p2FriendCode || "",
              fromName: roomObj.p2 || "Arkadaşın",
              roomCode: cleanCode
            });
          }
          rec.updatedAt = new Date().toISOString();
          return rec;
        },
        `Index room ${cleanCode} for P1 ${p1Code}`
      );
    } catch (e) {}
  }

  // 2. P2'nin (Rakip arkadaşın) arkadaş kodu varsa, onun indeksine de bu odayı ve bildirimi ekle!
  if (roomObj.p2FriendCode && /^SNC-\d{4}$/i.test(roomObj.p2FriendCode)) {
    const p2Code = roomObj.p2FriendCode.toUpperCase();
    if (p2Code !== (roomObj.p1FriendCode || "").toUpperCase()) {
      try {
        await putJsonToCloudPath(
          `friends/${p2Code}.json`,
          (existing) => {
            const rec = Object.assign(createDefaultFriendRecord(p2Code, roomObj.p2 || "Oyuncu"), existing || {});
            upsertActiveRoomInFriendRecord(rec, roomObj);

            if (roomObj.status === "waiting_p2") {
              pushNotification(rec, {
                id: `CHALLENGE_${cleanCode}_R${roomObj.currentRound || 1}`,
                type: "challenge",
                title: "⚔️ Yeni Düello Meydan Okuması!",
                message: `${roomObj.p1 || "Arkadaşın"} (${roomObj.p1FriendCode || ""}) senin için 5 soru çözdü! Tahmin etmek için tıkla (#${cleanCode}).`,
                fromCode: roomObj.p1FriendCode || "",
                fromName: roomObj.p1 || "Arkadaşın",
                roomCode: cleanCode
              });
            } else if (roomObj.status === "completed") {
              pushNotification(rec, {
                id: `DONE_P2_${cleanCode}_R${roomObj.currentRound || 1}`,
                type: "completed",
                title: `🏆 ${roomObj.p1 || "Arkadaşın"} Tahminlerini Tamamladı!`,
                message: `#${cleanCode} düellosu bitti! Uyum skorunuz: %${roomObj.lastMatchPercentage ?? 80}`,
                fromCode: roomObj.p1FriendCode || "",
                fromName: roomObj.p1 || "Arkadaşın",
                roomCode: cleanCode
              });
            }
            rec.updatedAt = new Date().toISOString();
            return rec;
          },
          `Index room ${cleanCode} for P2 ${p2Code}`
        );
      } catch (e) {}
    }
  }

  return roomObj;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Supabase-Url, X-Supabase-Key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const sbUrl = (req.headers["x-supabase-url"] || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  const sbKey = req.headers["x-supabase-key"] || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || "";

  try {
    if (req.method === "GET") {
      const friendCode = req.query.friendCode;
      if (friendCode) {
        const cleanFCode = String(friendCode).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
        const fIndex = await getJsonFromCloudPath(`friends/${cleanFCode}.json`);
        if (fIndex && fIndex.data) {
          let linkedRoom = null;
          if (fIndex.data.latestRoomCode) {
            const rFound = await getRoomFromCloud(fIndex.data.latestRoomCode);
            if (rFound) linkedRoom = rFound.room;
          }
          return res.status(200).json({
            source: "friend-index",
            friend: fIndex.data,
            room: linkedRoom
          });
        }
        return res.status(404).json({ error: "Bu arkadaş koduna ait kayıt bulunamadı." });
      }

      const code = req.query.code;
      if (!code) {
        return res.status(400).json({ error: "Oda kodu (code) gerekli." });
      }
      const cleanCode = String(code).trim().toUpperCase();

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
        } catch (sbReadErr) {}
      }

      const found = await getRoomFromCloud(cleanCode);
      if (!found) {
        return res.status(404).json({ error: "Oda bulunamadı. Kodun doğru olduğundan emin olun." });
      }
      return res.status(200).json({ source: "cloud-db", room: found.room });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

      // 1. AKSİYON: Çift Yönlü Arkadaşlık Bağı İsteği Gönderme (send_friend_request)
      if (body.action === "send_friend_request") {
        const fromCode = String(body.fromCode || "").trim().toUpperCase();
        const fromName = String(body.fromName || "Oyuncu").trim();
        const toCode = String(body.toCode || "").trim().toUpperCase();

        if (!/^SNC-\d{4}$/.test(fromCode) || !/^SNC-\d{4}$/.test(toCode)) {
          return res.status(400).json({ error: "Geçersiz arkadaş kodu formatı." });
        }

        // Hedef kullanıcının (toCode) dosyasına gelen isteği ve bildirimi yaz
        const targetRecord = await putJsonToCloudPath(
          `friends/${toCode}.json`,
          (existing) => {
            const rec = Object.assign(createDefaultFriendRecord(toCode, "Oyuncu"), existing || {});
            if (!Array.isArray(rec.incomingRequests)) rec.incomingRequests = [];
            if (!Array.isArray(rec.acceptedFriends)) rec.acceptedFriends = [];

            const alreadyAccepted = rec.acceptedFriends.some((f) => f.code === fromCode);
            const existingReqIdx = rec.incomingRequests.findIndex((r) => r.fromCode === fromCode);
            if (!alreadyAccepted) {
              const reqObj = {
                fromCode,
                fromName,
                status: "pending",
                createdAt: new Date().toISOString()
              };
              if (existingReqIdx >= 0) {
                rec.incomingRequests[existingReqIdx] = reqObj;
              } else {
                rec.incomingRequests.unshift(reqObj);
              }
            }

            pushNotification(rec, {
              id: `FREQ_${fromCode}_TO_${toCode}`,
              type: "friend_request",
              title: "🤝 Yeni Arkadaşlık Bağı İsteği!",
              message: `${fromName} (${fromCode}) seni arkadaş bağlarına eklemek istiyor!`,
              fromCode,
              fromName
            });

            rec.updatedAt = new Date().toISOString();
            return rec;
          },
          `Friend request ${fromCode} -> ${toCode}`
        );

        let activeRoom = null;
        if (targetRecord && targetRecord.latestRoomCode) {
          const rFound = await getRoomFromCloud(targetRecord.latestRoomCode);
          if (rFound) activeRoom = rFound.room;
        }

        return res.status(200).json({
          ok: true,
          targetFriend: targetRecord,
          room: activeRoom
        });
      }

      // 2. AKSİYON: Arkadaşlık Bağı İsteğini Kabul Etme veya Reddetme (respond_friend_request)
      if (body.action === "respond_friend_request") {
        const myCode = String(body.myCode || "").trim().toUpperCase();
        const myName = String(body.myName || "Oyuncu").trim();
        const requesterCode = String(body.requesterCode || "").trim().toUpperCase();
        const requesterName = String(body.requesterName || "Oyuncu").trim();
        const decision = body.decision === "reject" ? "reject" : "accept";

        if (!/^SNC-\d{4}$/.test(myCode) || !/^SNC-\d{4}$/.test(requesterCode)) {
          return res.status(400).json({ error: "Geçersiz arkadaş kodu." });
        }

        // Kendi kaydımı güncelle
        const updatedMe = await putJsonToCloudPath(
          `friends/${myCode}.json`,
          (existing) => {
            const rec = Object.assign(createDefaultFriendRecord(myCode, myName), existing || {});
            if (myName && myName !== "Misafir Oyuncu") rec.username = myName;
            rec.incomingRequests = (rec.incomingRequests || []).filter((r) => r.fromCode !== requesterCode);
            if (!Array.isArray(rec.acceptedFriends)) rec.acceptedFriends = [];

            if (decision === "accept") {
              if (!rec.acceptedFriends.some((f) => f.code === requesterCode)) {
                rec.acceptedFriends.push({
                  code: requesterCode,
                  name: requesterName,
                  acceptedAt: new Date().toISOString()
                });
              }
            }
            if (Array.isArray(rec.notifications)) {
              rec.notifications.forEach((n) => {
                if (n.fromCode === requesterCode && n.type === "friend_request") {
                  n.read = true;
                  n.handled = decision;
                }
              });
            }
            rec.updatedAt = new Date().toISOString();
            return rec;
          },
          `Respond (${decision}) friend request ${requesterCode} by ${myCode}`
        );

        // Karşı tarafın (requesterCode) kaydını da güncelle ve kabul edildiyse bildirim gönder!
        if (decision === "accept") {
          await putJsonToCloudPath(
            `friends/${requesterCode}.json`,
            (existing) => {
              const rec = Object.assign(createDefaultFriendRecord(requesterCode, requesterName), existing || {});
              if (!Array.isArray(rec.acceptedFriends)) rec.acceptedFriends = [];
              if (!rec.acceptedFriends.some((f) => f.code === myCode)) {
                rec.acceptedFriends.push({
                  code: myCode,
                  name: myName,
                  acceptedAt: new Date().toISOString()
                });
              }
              pushNotification(rec, {
                id: `FACC_${myCode}_TO_${requesterCode}`,
                type: "friend_accepted",
                title: "🎉 Arkadaşlık Bağın Kabul Edildi!",
                message: `${myName} (${myCode}) arkadaşlık bağı isteğini kabul etti! Artık doğrudan düello yapabilirsiniz.`,
                fromCode: myCode,
                fromName: myName
              });
              rec.updatedAt = new Date().toISOString();
              return rec;
            },
            `Friend request accepted ${myCode} -> ${requesterCode}`
          );
        }

        return res.status(200).json({ ok: true, decision, friend: updatedMe });
      }

      // 3. AKSİYON: Hatırlatma (Nudge) Gönderme (send_nudge)
      if (body.action === "send_nudge") {
        const fromCode = String(body.fromCode || "").trim().toUpperCase();
        const fromName = String(body.fromName || "Arkadaşın").trim();
        const toCode = String(body.toCode || "").trim().toUpperCase();
        const roomCode = String(body.roomCode || "").trim().toUpperCase();

        if (/^SNC-\d{4}$/.test(toCode)) {
          await putJsonToCloudPath(
            `friends/${toCode}.json`,
            (existing) => {
              const rec = Object.assign(createDefaultFriendRecord(toCode, "Oyuncu"), existing || {});
              pushNotification(rec, {
                id: `NUDGE_${roomCode}_${Date.now()}`,
                type: "nudge",
                title: "⏰ Düello Hatırlatması!",
                message: `${fromName} seni #${roomCode} kodlu düelloda bekliyor! Hadi 5 soruyu tahmin et!`,
                fromCode,
                fromName,
                roomCode
              });
              rec.updatedAt = new Date().toISOString();
              return rec;
            },
            `Nudge ${fromCode} -> ${toCode} for ${roomCode}`
          );
        }
        return res.status(200).json({ ok: true });
      }

      // 4. AKSİYON: Bildirimleri Okundu İşaretleme / Temizleme (clear_notifications)
      if (body.action === "clear_notifications") {
        const myCode = String(body.myCode || "").trim().toUpperCase();
        if (/^SNC-\d{4}$/.test(myCode)) {
          const updated = await putJsonToCloudPath(
            `friends/${myCode}.json`,
            (existing) => {
              const rec = Object.assign(createDefaultFriendRecord(myCode, "Oyuncu"), existing || {});
              if (body.clearAll) {
                rec.notifications = [];
              } else if (Array.isArray(rec.notifications)) {
                rec.notifications.forEach((n) => (n.read = true));
              }
              rec.updatedAt = new Date().toISOString();
              return rec;
            },
            `Mark notifications read for ${myCode}`
          );
          return res.status(200).json({ ok: true, friend: updated });
        }
        return res.status(200).json({ ok: true });
      }

      // 5. AKSİYON: Canlı Odaya Katılımcı Ekleme (join_live_lobby)
      if (body.action === "join_live_lobby") {
        const code = String(body.code || "").trim().toUpperCase();
        const playerName = String(body.playerName || "Oyuncu").trim();
        const friendCode = String(body.friendCode || "").trim().toUpperCase();

        const updatedRoom = await putJsonToCloudPath(
          `rooms/${code}.json`,
          (existing) => {
            if (!existing) return null;
            if (!Array.isArray(existing.participants)) {
              existing.participants = [{ name: existing.p1 || "Kurucu", code: existing.p1FriendCode || "", role: "host" }];
            }
            const exists = existing.participants.some(
              (p) => (friendCode && p.code === friendCode) || p.name.toLowerCase() === playerName.toLowerCase()
            );
            if (!exists) {
              existing.participants.push({
                name: playerName,
                code: friendCode,
                role: "member",
                joinedAt: new Date().toISOString()
              });
            }
            if (!existing.p2) existing.p2 = playerName;
            if (!existing.p2FriendCode && friendCode) existing.p2FriendCode = friendCode;
            existing.updatedAt = new Date().toISOString();
            return existing;
          },
          `Player ${playerName} joined live lobby ${code}`
        );
        return res.status(200).json({ ok: true, room: updatedRoom });
      }

      // 6. AKSİYON: Profil ve Arkadaş Kodu Kaydı (type === 'profile')
      if (body.type === "profile" && body.profile) {
        const p = body.profile;
        let syncedFriendRecord = null;
        if (p.friendCode && /^SNC-\d{4}$/i.test(p.friendCode)) {
          const cleanFCode = p.friendCode.toUpperCase();
          try {
            syncedFriendRecord = await putJsonToCloudPath(
              `friends/${cleanFCode}.json`,
              (existing) => {
                const rec = Object.assign(createDefaultFriendRecord(cleanFCode, p.username), existing || {});
                if (p.username && p.username !== "Misafir Oyuncu") {
                  rec.username = p.username;
                }
                rec.level = p.level || rec.level || 1;
                rec.xp = p.xp || rec.xp || 0;
                rec.updatedAt = new Date().toISOString();
                return rec;
              },
              `Update friend profile ${cleanFCode}`
            );
          } catch (e) {}
        }

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
        return res.status(200).json({ ok: true, profile: p, friendCloud: syncedFriendRecord });
      }

      // 7. AKSİYON: Oda / Oyun Oturumu Kaydı
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
              theme: room.thm || "luminous",
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
        } catch (sbErr) {}
      }

      const saved = await saveRoomToCloud(room.code, room);
      return res.status(200).json({ ok: true, room: saved });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Sunucu hatası" });
  }
}
