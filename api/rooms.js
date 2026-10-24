// Vercel Serverless Function (/api/rooms) — v0.07
// Varsayılan Supabase: https://kypzuqnksnlinkfuxvnl.supabase.co
// Özellikler (v0.07):
// 1. 409 Conflict korumalı (Optimistic Retry) Bulut JSON Okuma/Yazma
// 2. Çift Yönlü Arkadaşlık Bağı İstekleri (send_friend_request, respond_friend_request)
// 3. Gerçek Zamanlı Bildirim Merkezi & Hatırlatma (send_nudge, clear_notifications)
// 4. Canlı Oda Lobi Tam Senkronizasyonu:
//    - join_live_lobby, update_live_lobby (Sadece Kurucu), switch_live_team (Mavi/Kırmızı/Lobi uçuşu),
//    - manage_live_participant (Kuruculuğu Devret, Odadan At, Ebe Ata),
//    - start_live_match & submit_live_step (Eşzamanlı sıra tabanlı 1'er, 2'şer, 3'er, 4'er, 5'er, 10'ar & Ebeli/Paket modları)
// 5. Global Liderlik Tablosu (leaderboard/global.json) + 7 Günlük İnaktif Misafir Temizliği

const DEFAULT_SUPABASE_URL = "https://kypzuqnksnlinkfuxvnl.supabase.co";
const GH_TOKEN = process.env.GH_TOKEN || "";
const GH_REPO = process.env.GH_REPO || "emo29/senceo";
const GH_BRANCH = "rooms-db";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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

async function putJsonToCloudPath(relPath, payloadOrUpdater, commitMessage, maxRetries = 4) {
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
    gamesPlayed: 0,
    questionsCorrect: 0,
    provider: "guest",
    isPermanentMember: false,
    lastXpActivityAt: Date.now(),
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
    roomType: roomObj.roomType || "classic",
    arenaFormat: roomObj.arenaFormat || "1v1",
    status: roomObj.status || "waiting_p2",
    currentRound: roomObj.currentRound || 1,
    nextRoundStarterCode: roomObj.nextRoundStarterCode || "",
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

// Global Liderlik Tablosunu Güncelle + 7 Gün Puanı Artmayan Misafirleri Otomatik Sil
async function upsertGlobalLeaderboardEntry(profileObj) {
  if (!profileObj || !profileObj.friendCode || !/^SNC-\d{4}$/i.test(profileObj.friendCode)) return;
  const cleanCode = profileObj.friendCode.toUpperCase();
  const isMember =
    Boolean(profileObj.isPermanentMember) ||
    (profileObj.provider && !["guest", "Misafir"].includes(profileObj.provider) && Boolean(profileObj.email));

  try {
    await putJsonToCloudPath(
      "leaderboard/global.json",
      (existing) => {
        const now = Date.now();
        let list = Array.isArray(existing?.players) ? existing.players : [];

        // 7 gün boyunca hiç XP kazanmamış misafir hesapları temizle
        list = list.filter((item) => {
          if (!item || !item.friendCode) return false;
          if (item.isPermanentMember) return true;
          const lastAct = Number(item.lastXpActivityAt) || new Date(item.updatedAt || now).getTime();
          return now - lastAct <= SEVEN_DAYS_MS;
        });

        const idx = list.findIndex((p) => p.friendCode === cleanCode);
        const prev = idx >= 0 ? list[idx] : null;
        const newXp = Math.max(Number(profileObj.xp) || 0, Number(prev?.xp) || 0);
        const xpIncreased = !prev || newXp > (Number(prev.xp) || 0);

        const entry = {
          friendCode: cleanCode,
          username:
            profileObj.username && profileObj.username !== "Misafir Oyuncu"
              ? profileObj.username
              : prev?.username || "Misafir Oyuncu",
          avatar: profileObj.avatar || prev?.avatar || "😎",
          level: Math.max(1, Math.floor(newXp / 100) + 1),
          xp: newXp,
          gamesPlayed: Math.max(Number(profileObj.gamesPlayed) || 0, Number(prev?.gamesPlayed) || 0),
          questionsCorrect: Math.max(Number(profileObj.questionsCorrect) || 0, Number(prev?.questionsCorrect) || 0),
          provider: profileObj.provider || prev?.provider || "guest",
          isPermanentMember: isMember || Boolean(prev?.isPermanentMember),
          lastXpActivityAt: xpIncreased
            ? now
            : Number(profileObj.lastXpActivityAt) || Number(prev?.lastXpActivityAt) || now,
          updatedAt: new Date().toISOString()
        };

        if (idx >= 0) {
          list[idx] = entry;
        } else {
          list.push(entry);
        }

        list.sort((a, b) => {
          if ((b.xp || 0) !== (a.xp || 0)) return (b.xp || 0) - (a.xp || 0);
          if ((b.questionsCorrect || 0) !== (a.questionsCorrect || 0)) {
            return (b.questionsCorrect || 0) - (a.questionsCorrect || 0);
          }
          return (b.gamesPlayed || 0) - (a.gamesPlayed || 0);
        });

        return {
          updatedAt: new Date().toISOString(),
          players: list.slice(0, 100)
        };
      },
      `Update global leaderboard for ${cleanCode}`
    );
  } catch (e) {}
}

async function getRoomFromCloud(roomCode) {
  const cleanCode = String(roomCode).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const found = await getJsonFromCloudPath(`rooms/${cleanCode}.json`);
  return found ? { room: found.data, sha: found.sha } : null;
}

async function saveRoomToCloud(roomCode, roomObj) {
  const cleanCode = String(roomCode).toUpperCase().replace(/[^A-Z0-9_-]/g, "");

  // Raund tamamlandığında (completed), bir sonraki raundda (Raund N+1) İLK BAŞLAYACAK KİŞİYİ (2. başlayan = p2) kilitle!
  if (roomObj.status === "completed") {
    roomObj.nextRoundStarterCode = roomObj.p2FriendCode || "";
    roomObj.nextRoundStarterName = roomObj.p2 || "2. Oyuncu";
    roomObj.nextRoundSecondCode = roomObj.p1FriendCode || "";
    roomObj.nextRoundSecondName = roomObj.p1 || "1. Oyuncu";
  }

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
      // Global Liderlik Tablosu Sorgusu
      if (req.query.leaderboard) {
        const lb = await getJsonFromCloudPath("leaderboard/global.json");
        const now = Date.now();
        const players = Array.isArray(lb?.data?.players)
          ? lb.data.players.filter((item) => {
              if (!item || !item.friendCode) return false;
              if (item.isPermanentMember) return true;
              const lastAct = Number(item.lastXpActivityAt) || new Date(item.updatedAt || now).getTime();
              return now - lastAct <= SEVEN_DAYS_MS;
            })
          : [];
        return res.status(200).json({ ok: true, players });
      }

      const friendCode = req.query.friendCode;
      if (friendCode) {
        const cleanFCode = String(friendCode).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
        const fIndex = await getJsonFromCloudPath(`friends/${cleanFCode}.json`);
        if (fIndex && fIndex.data) {
          // 7 gün boyunca puanı artmayan misafir kontrolü
          const rec = fIndex.data;
          const now = Date.now();
          const lastAct = Number(rec.lastXpActivityAt) || new Date(rec.updatedAt || now).getTime();
          if (!rec.isPermanentMember && ["guest", "Misafir"].includes(rec.provider || "guest") && now - lastAct > SEVEN_DAYS_MS) {
            return res.status(200).json({
              source: "friend-index",
              expiredGuest: true,
              friend: createDefaultFriendRecord(cleanFCode, "Misafir Oyuncu"),
              room: null
            });
          }

          let linkedRoom = null;
          if (rec.latestRoomCode) {
            const rFound = await getRoomFromCloud(rec.latestRoomCode);
            if (rFound) linkedRoom = rFound.room;
          }
          return res.status(200).json({
            source: "friend-index",
            friend: rec,
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

      const found = await getRoomFromCloud(cleanCode);
      if (found) {
        return res.status(200).json({ source: "cloud-db", room: found.room });
      }

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

      return res.status(404).json({ error: "Oda bulunamadı. Kodun doğru olduğundan emin olun." });
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

        let wasKicked = false;
        const updatedRoom = await putJsonToCloudPath(
          `rooms/${code}.json`,
          (existing) => {
            if (!existing) return null;
            if (Array.isArray(existing.kickedCodes) && friendCode && existing.kickedCodes.includes(friendCode)) {
              wasKicked = true;
              return existing;
            }
            if (!Array.isArray(existing.participants)) {
              existing.participants = [
                {
                  name: existing.p1 || "Kurucu",
                  code: existing.p1FriendCode || "",
                  role: "host",
                  team: "none",
                  score: 0,
                  correct: 0
                }
              ];
            }
            const existingIdx = existing.participants.findIndex(
              (p) => (friendCode && p.code === friendCode) || p.name.toLowerCase() === playerName.toLowerCase()
            );
            if (existingIdx >= 0) {
              existing.participants[existingIdx].name = playerName;
              if (friendCode) existing.participants[existingIdx].code = friendCode;
            } else {
              existing.participants.push({
                name: playerName,
                code: friendCode,
                role: "member",
                team: "none",
                score: 0,
                correct: 0,
                joinedAt: new Date().toISOString()
              });
            }
            if (!existing.p2 && friendCode !== existing.p1FriendCode) existing.p2 = playerName;
            if (!existing.p2FriendCode && friendCode && friendCode !== existing.p1FriendCode) {
              existing.p2FriendCode = friendCode;
            }
            existing.updatedAt = new Date().toISOString();
            return existing;
          },
          `Player ${playerName} joined live lobby ${code}`
        );

        if (wasKicked) {
          return res.status(403).json({ error: "Oda kurucusu tarafından bu odadan çıkarıldınız.", kicked: true });
        }
        return res.status(200).json({ ok: true, room: updatedRoom });
      }

      // 6. AKSİYON: Canlı Oda Ayarlarını Güncelleme (SADECE ODA KURUCUSU — update_live_lobby)
      if (body.action === "update_live_lobby") {
        const code = String(body.code || "").trim().toUpperCase();
        const callerCode = String(body.callerCode || "").trim().toUpperCase();
        const settings = body.settings || {};

        let unauthorized = false;
        const updatedRoom = await putJsonToCloudPath(
          `rooms/${code}.json`,
          (existing) => {
            if (!existing) return null;
            const hostCode = String(existing.hostCode || existing.p1FriendCode || "").toUpperCase();
            if (hostCode && callerCode && hostCode !== callerCode) {
              unauthorized = true;
              return existing;
            }
            if (settings.arenaFormat) existing.arenaFormat = settings.arenaFormat;
            if (settings.cat) existing.cat = settings.cat;
            if (settings.turnStepMode !== undefined) existing.turnStepMode = Number(settings.turnStepMode) || 1;
            if (settings.totalQuestionsCount !== undefined) {
              existing.totalQuestionsCount = Number(settings.totalQuestionsCount) || 5;
            }
            if (settings.questionTimerSec !== undefined) {
              existing.questionTimerSec = Number(settings.questionTimerSec) || 0;
            }
            if (settings.starterSelectionMode) existing.starterSelectionMode = settings.starterSelectionMode;
            if (settings.designatedStarterCode !== undefined) {
              existing.designatedStarterCode = settings.designatedStarterCode;
            }
            if (settings.ffaSubMode) existing.ffaSubMode = settings.ffaSubMode;
            if (settings.teamSubMode) existing.teamSubMode = settings.teamSubMode;
            existing.updatedAt = new Date().toISOString();
            return existing;
          },
          `Host updated live lobby settings ${code}`
        );

        if (unauthorized) {
          return res.status(403).json({ error: "Sadece oda kurucusu ayarları değiştirebilir!" });
        }
        return res.status(200).json({ ok: true, room: updatedRoom });
      }

      // 7. AKSİYON: Canlı Odada Takım Değiştirme (Mavi / Kırmızı / Lobi — switch_live_team)
      if (body.action === "switch_live_team") {
        const code = String(body.code || "").trim().toUpperCase();
        const playerCode = String(body.playerCode || "").trim().toUpperCase();
        const playerName = String(body.playerName || "").trim();
        const team = ["blue", "red", "none"].includes(body.team) ? body.team : "none";

        const updatedRoom = await putJsonToCloudPath(
          `rooms/${code}.json`,
          (existing) => {
            if (!existing || !Array.isArray(existing.participants)) return existing;
            const p = existing.participants.find(
              (item) => (playerCode && item.code === playerCode) || item.name === playerName
            );
            if (p) {
              p.team = team;
            }
            existing.updatedAt = new Date().toISOString();
            return existing;
          },
          `Player ${playerName || playerCode} switched team to ${team} in ${code}`
        );
        return res.status(200).json({ ok: true, room: updatedRoom });
      }

      // 8. AKSİYON: Kurucunun Katılımcı Yönetimi (Kuruculuğu Devret, Odadan At, Ebe Ata — manage_live_participant)
      if (body.action === "manage_live_participant") {
        const code = String(body.code || "").trim().toUpperCase();
        const callerCode = String(body.callerCode || "").trim().toUpperCase();
        const targetCode = String(body.targetCode || "").trim().toUpperCase();
        const targetName = String(body.targetName || "").trim();
        const subAction = body.subAction; // 'transfer_host' | 'kick' | 'set_ebe' | 'set_team'

        let unauthorized = false;
        const updatedRoom = await putJsonToCloudPath(
          `rooms/${code}.json`,
          (existing) => {
            if (!existing) return null;
            const currentHostCode = String(existing.hostCode || existing.p1FriendCode || "").toUpperCase();
            if (currentHostCode && callerCode && currentHostCode !== callerCode) {
              unauthorized = true;
              return existing;
            }
            if (!Array.isArray(existing.participants)) existing.participants = [];

            const targetIdx = existing.participants.findIndex(
              (p) => (targetCode && p.code === targetCode) || p.name === targetName
            );
            if (targetIdx < 0) return existing;
            const targetObj = existing.participants[targetIdx];

            if (subAction === "kick") {
              existing.participants.splice(targetIdx, 1);
              if (!Array.isArray(existing.kickedCodes)) existing.kickedCodes = [];
              if (targetObj.code && !existing.kickedCodes.includes(targetObj.code)) {
                existing.kickedCodes.push(targetObj.code);
              }
            } else if (subAction === "transfer_host") {
              existing.participants.forEach((p) => {
                p.role = "member";
              });
              targetObj.role = "host";
              existing.hostCode = targetObj.code || "";
              existing.p1FriendCode = targetObj.code || existing.p1FriendCode;
              existing.p1 = targetObj.name || existing.p1;
            } else if (subAction === "set_ebe") {
              existing.starterSelectionMode = "manual";
              existing.designatedStarterCode = targetObj.code || targetObj.name;
              existing.designatedStarterName = targetObj.name;
            } else if (subAction === "set_team") {
              targetObj.team = ["blue", "red", "none"].includes(body.team) ? body.team : "none";
            }

            existing.updatedAt = new Date().toISOString();
            return existing;
          },
          `Host managed participant (${subAction}) in ${code}`
        );

        if (unauthorized) {
          return res.status(403).json({ error: "Sadece oda kurucusu bu işlemi yapabilir!" });
        }
        return res.status(200).json({ ok: true, room: updatedRoom });
      }

      // 9. AKSİYON: Canlı Odayı Eşzamanlı Başlatma (start_live_match) ve Canlı Adım Gönderme (submit_live_step)
      if (body.action === "start_live_match") {
        const code = String(body.code || "").trim().toUpperCase();
        const callerCode = String(body.callerCode || "").trim().toUpperCase();
        const liveInit = body.liveInit || {};

        const updatedRoom = await putJsonToCloudPath(
          `rooms/${code}.json`,
          (existing) => {
            if (!existing) return null;
            const currentHostCode = String(existing.hostCode || existing.p1FriendCode || "").toUpperCase();
            if (currentHostCode && callerCode && currentHostCode !== callerCode) {
              return existing;
            }
            if (liveInit.arenaFormat) existing.arenaFormat = liveInit.arenaFormat;
            if (liveInit.ffaSubMode) existing.ffaSubMode = liveInit.ffaSubMode;
            if (liveInit.teamSubMode) existing.teamSubMode = liveInit.teamSubMode;
            if (liveInit.turnStepMode) existing.turnStepMode = Number(liveInit.turnStepMode) || 1;
            if (liveInit.questionTimerSec !== undefined) {
              existing.questionTimerSec = Number(liveInit.questionTimerSec) || 0;
            }
            existing.status = "live_in_progress";
            existing.liveState = liveInit.liveState;
            existing.updatedAt = new Date().toISOString();
            return existing;
          },
          `Start live match ${code}`
        );

        return res.status(200).json({ ok: true, room: updatedRoom });
      }

      if (body.action === "submit_live_step") {
        const code = String(body.code || "").trim().toUpperCase();
        const playerCode = String(body.playerCode || "").trim().toUpperCase();
        const playerName = String(body.playerName || "Oyuncu").trim();
        const subPhase = body.subPhase; // 'answer_progress' | 'submit_answers' | 'submit_guesses'
        const stepData = body.stepData || {};

        const updatedRoom = await putJsonToCloudPath(
          `rooms/${code}.json`,
          (existing) => {
            if (!existing || !existing.liveState) return existing;
            const ls = existing.liveState;

            if (subPhase === "answer_progress") {
              ls.answeredCountSoFar = Number(stepData.answeredCountSoFar) || 0;
            } else if (subPhase === "submit_answers") {
              ls.currentBatchAnswers = stepData.answers || [];
              ls.currentBatchComments = stepData.comments || [];
              ls.currentBatchCustomMap = stepData.customMap || {};
              ls.guessesByPlayer = {};
              ls.phase = "guessing";
              ls.phaseStartedAt = Date.now();
            } else if (subPhase === "submit_guesses") {
              if (!ls.guessesByPlayer) ls.guessesByPlayer = {};
              const pKey = playerCode || playerName;
              ls.guessesByPlayer[pKey] = {
                playerCode,
                playerName,
                guesses: stepData.guesses || [],
                comments: stepData.comments || [],
                correctCount: Number(stepData.correctCount) || 0,
                totalCount: Number(stepData.totalCount) || 1,
                submittedAt: new Date().toISOString()
              };

              if (!ls.scoresByPlayer) ls.scoresByPlayer = {};
              const participantObj = (existing.participants || []).find(
                (p) => (playerCode && p.code === playerCode) || p.name === playerName
              );
              const prevScore = ls.scoresByPlayer[pKey] || {
                code: playerCode,
                name: playerName,
                team: participantObj?.team || "none",
                correct: 0,
                total: 0,
                points: 0
              };
              prevScore.correct += Number(stepData.correctCount) || 0;
              prevScore.total += Number(stepData.totalCount) || 1;
              prevScore.points = prevScore.correct * 100;
              ls.scoresByPlayer[pKey] = prevScore;

              // Tüm tahminciler bitirdiyse sıradaki oyuncuya (veya oyun sonuna) geç!
              const allParticipants = Array.isArray(existing.participants) ? existing.participants : [];
              const expectedGuessers = allParticipants.filter(
                (p) => (p.code || p.name) !== (ls.activeAnswererCode || ls.activeAnswererName)
              );
              const submittedKeys = Object.keys(ls.guessesByPlayer);
              const everyoneGuessed =
                expectedGuessers.length <= 1 ||
                expectedGuessers.every(
                  (g) => submittedKeys.includes(g.code) || submittedKeys.includes(g.name)
                );

              if (everyoneGuessed) {
                if (!Array.isArray(ls.historyBatches)) ls.historyBatches = [];
                ls.historyBatches.push({
                  turnIndex: ls.turnIndex,
                  answererCode: ls.activeAnswererCode,
                  answererName: ls.activeAnswererName,
                  qIds: ls.currentBatchQIds,
                  answers: ls.currentBatchAnswers,
                  comments: ls.currentBatchComments,
                  customMap: ls.currentBatchCustomMap,
                  guessesByPlayer: ls.guessesByPlayer
                });

                const nextTurnIdx = (Number(ls.turnIndex) || 0) + 1;
                if (nextTurnIdx >= (Number(ls.totalTurns) || 2) || !stepData.nextBatchQIds?.length) {
                  existing.status = "completed";
                  ls.phase = "completed";
                  // Kazananı ve toplam uyumu hesapla
                  const scoreArr = Object.values(ls.scoresByPlayer);
                  scoreArr.sort((a, b) => (b.points || 0) - (a.points || 0));
                  existing.liveLeaderboard = scoreArr;
                  const totalC = scoreArr.reduce((acc, s) => acc + (s.correct || 0), 0);
                  const totalQ = scoreArr.reduce((acc, s) => acc + (s.total || 0), 0);
                  existing.lastMatchPercentage = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 80;
                  existing.lastCorrectCount = totalC;
                  existing.lastTotalQuestions = totalQ;
                } else {
                  ls.turnIndex = nextTurnIdx;
                  const orderList = Array.isArray(ls.turnOrder) && ls.turnOrder.length > 0
                    ? ls.turnOrder
                    : allParticipants;
                  const nextAnswerer = orderList[nextTurnIdx % orderList.length] || allParticipants[0];
                  ls.activeAnswererCode = nextAnswerer.code || "";
                  ls.activeAnswererName = nextAnswerer.name || "Oyuncu";
                  ls.currentBatchQIds = stepData.nextBatchQIds;
                  ls.currentBatchAnswers = [];
                  ls.currentBatchComments = [];
                  ls.currentBatchCustomMap = {};
                  ls.guessesByPlayer = {};
                  ls.answeredCountSoFar = 0;
                  ls.phase = "answering";
                  ls.phaseStartedAt = Date.now();
                }
              }
            }

            existing.updatedAt = new Date().toISOString();
            return existing;
          },
          `Live step (${subPhase}) in ${code}`
        );

        return res.status(200).json({ ok: true, room: updatedRoom });
      }

      // 10. AKSİYON: Profil ve Arkadaş Kodu Kaydı (type === 'profile')
      if (body.type === "profile" && body.profile) {
        const p = body.profile;
        let syncedFriendRecord = null;
        if (p.friendCode && /^SNC-\d{4}$/i.test(p.friendCode)) {
          const cleanFCode = p.friendCode.toUpperCase();
          const isMember =
            Boolean(p.isPermanentMember) ||
            (p.provider && !["guest", "Misafir"].includes(p.provider) && Boolean(p.email));

          try {
            syncedFriendRecord = await putJsonToCloudPath(
              `friends/${cleanFCode}.json`,
              (existing) => {
                const rec = Object.assign(createDefaultFriendRecord(cleanFCode, p.username), existing || {});
                if (p.username && p.username !== "Misafir Oyuncu") {
                  rec.username = p.username;
                }
                const prevXp = Number(rec.xp) || 0;
                const nextXp = Math.max(Number(p.xp) || 0, prevXp);
                if (nextXp > prevXp || !rec.lastXpActivityAt) {
                  rec.lastXpActivityAt = Date.now();
                }
                rec.level = Math.max(1, Math.floor(nextXp / 100) + 1);
                rec.xp = nextXp;
                rec.gamesPlayed = Math.max(Number(p.gamesPlayed) || 0, Number(rec.gamesPlayed) || 0);
                rec.questionsCorrect = Math.max(Number(p.questionsCorrect) || 0, Number(rec.questionsCorrect) || 0);
                rec.provider = p.provider || rec.provider || "guest";
                rec.isPermanentMember = isMember || Boolean(rec.isPermanentMember);
                rec.updatedAt = new Date().toISOString();
                return rec;
              },
              `Update friend profile ${cleanFCode}`
            );
          } catch (e) {}

          await upsertGlobalLeaderboardEntry(p);
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

      // 11. AKSİYON: Oda / Oyun Oturumu Kaydı
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
