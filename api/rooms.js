// Vercel Serverless Function (/api/rooms) — v0.08
// Varsayılan Supabase: https://kypzuqnksnlinkfuxvnl.supabase.co
// Özellikler (v0.08):
// 1. 409 Conflict korumalı (Optimistic Retry) Bulut JSON Okuma/Yazma
// 2. Çift Yönlü Arkadaşlık Bağı İstekleri (send_friend_request, respond_friend_request)
// 3. Gerçek Zamanlı Bildirim Merkezi & Hatırlatma (send_nudge, clear_notifications)
// 4. Canlı Oda Lobi Tam Senkronizasyonu:
//    - join_live_lobby (Eski odadan otomatik çıkarma + Tek Kurucu garantisi)
//    - leave_live_lobby (Kurucu çıkarsa odadaki rastgele birine veya kalan son kişiye otomatik kuruculuk devri!)
//    - update_live_lobby (Sadece Kurucu)
//    - switch_live_team (Mavi / Kırmızı / Ortak Lobi geçişi)
//    - manage_live_participant (Kuruculuğu Devret — asla 2 kurucu olmaz, Odadan At, İlk Başlayan Ata)
//    - start_live_match & submit_live_step (Gerçek zamanlı 3 aşamalı: Answering -> Guessing -> Reveal + 1.5sn Balon + Sıra Değişimi)
// 5. Aktif Düello Silme / Terk Etme (forfeit_or_delete_room) -> Rakibe %10 eşit olasılıklı 10 kaçış mesajı!
// 6. Misafir Üyeliğini Şifreyle Koruma & İsim Kilidi (set_guest_password, login_guest_password, check_username_lock)

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

    if (finalPayload === undefined) {
      return existing ? existing.data : null;
    }

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
    passwordProtected: false,
    passwordHash: "",
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
  if (!Array.isArray(record.deletedRoomCodes)) record.deletedRoomCodes = [];
  if (record.deletedRoomCodes.includes(roomObj.code)) {
    return;
  }

  const summary = {
    code: roomObj.code,
    p1: roomObj.p1 || "Oyuncu 1",
    p2: roomObj.p2 || "",
    p1FriendCode: roomObj.p1FriendCode || "",
    p2FriendCode: roomObj.p2FriendCode || "",
    roomType: roomObj.roomType || "classic",
    arenaFormat: roomObj.arenaFormat || "1v1",
    status: roomObj.status || "waiting_p2",
    abandonedByCode: roomObj.abandonedByCode || "",
    abandonedByName: roomObj.abandonedByName || "",
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

// Canlı odada tek bir kurucu olmasını garanti altına alan yardımcı fonksiyon
function normalizeSingleHostInRoom(room) {
  if (!room || !Array.isArray(room.participants) || room.participants.length === 0) return;
  let desiredHostCode = String(room.hostCode || "").trim().toUpperCase();
  let hostFound = room.participants.find(
    (p) => desiredHostCode && String(p.code || "").trim().toUpperCase() === desiredHostCode
  );
  if (!hostFound) {
    hostFound = room.participants.find((p) => p.isHost || p.role === "host") || room.participants[0];
  }
  const finalHostCode = String(hostFound.code || "").trim().toUpperCase();
  const finalHostName = hostFound.name || "Kurucu";
  room.hostCode = finalHostCode;
  room.p1FriendCode = finalHostCode || room.p1FriendCode;
  room.p1 = finalHostName || room.p1;

  room.participants.forEach((p) => {
    const isThisHost = finalHostCode
      ? String(p.code || "").trim().toUpperCase() === finalHostCode
      : p === hostFound;
    p.isHost = isThisHost;
    p.role = isThisHost ? "host" : "member";
  });
}

// Bir oyuncuyu belirtilen canlı odadan çıkarır ve kurucuysa kuruculuğu rastgele/son kişiye devreder
async function removePlayerFromLiveRoom(roomCode, leavingCode, leavingName = "") {
  const cleanCode = String(roomCode || "").trim().toUpperCase();
  if (!cleanCode) return null;
  const cleanLeavingCode = String(leavingCode || "").trim().toUpperCase();
  const cleanLeavingName = String(leavingName || "").trim().toLowerCase();

  return await putJsonToCloudPath(
    `rooms/${cleanCode}.json`,
    (existing) => {
      if (!existing || !Array.isArray(existing.participants)) return existing;
      const prevLen = existing.participants.length;
      const wasHost =
        (cleanLeavingCode && String(existing.hostCode || "").toUpperCase() === cleanLeavingCode) ||
        existing.participants.some(
          (p) =>
            ((cleanLeavingCode && String(p.code || "").toUpperCase() === cleanLeavingCode) ||
              (cleanLeavingName && String(p.name || "").toLowerCase() === cleanLeavingName)) &&
            (p.isHost || p.role === "host")
        );

      existing.participants = existing.participants.filter((p) => {
        if (cleanLeavingCode && String(p.code || "").toUpperCase() === cleanLeavingCode) return false;
        if (!cleanLeavingCode && cleanLeavingName && String(p.name || "").toLowerCase() === cleanLeavingName) {
          return false;
        }
        return true;
      });

      if (existing.participants.length === 0) {
        existing.status = "abandoned";
        existing.hostCode = "";
        existing.updatedAt = new Date().toISOString();
        return existing;
      }

      if (wasHost || existing.participants.length !== prevLen) {
        if (wasHost) {
          // Kurucu çıktıysa: kalan son kişiye veya birden fazla kişi varsa rastgele birine devret!
          const randIdx =
            existing.participants.length === 1
              ? 0
              : Math.floor(Math.random() * existing.participants.length);
          const chosenHost = existing.participants[randIdx];
          existing.hostCode = String(chosenHost.code || "").toUpperCase();
          existing.p1FriendCode = existing.hostCode || existing.p1FriendCode;
          existing.p1 = chosenHost.name || existing.p1;
        }
        normalizeSingleHostInRoom(existing);
      }

      existing.updatedAt = new Date().toISOString();
      return existing;
    },
    `Player ${cleanLeavingCode || cleanLeavingName} left live room ${cleanCode}`
  );
}

// Global Liderlik Tablosunu Güncelle + 7 Gün Puanı Artmayan Misafirleri Otomatik Sil + Şifreli İsim Koruması
async function upsertGlobalLeaderboardEntry(profileObj) {
  if (!profileObj || !profileObj.friendCode || !/^SNC-\d{4}$/i.test(profileObj.friendCode)) return;
  const cleanCode = profileObj.friendCode.toUpperCase();
  const isMember =
    Boolean(profileObj.isPermanentMember) ||
    Boolean(profileObj.passwordProtected) ||
    (profileObj.provider && !["guest", "Misafir"].includes(profileObj.provider) && Boolean(profileObj.email));

  try {
    await putJsonToCloudPath(
      "leaderboard/global.json",
      (existing) => {
        const now = Date.now();
        let list = Array.isArray(existing?.players) ? existing.players : [];

        // 7 gün boyunca hiç XP kazanmamış ve şifresiz/üyeliksiz misafir hesapları temizle
        list = list.filter((item) => {
          if (!item || !item.friendCode) return false;
          if (item.isPermanentMember || item.passwordProtected) return true;
          const lastAct = Number(item.lastXpActivityAt) || new Date(item.updatedAt || now).getTime();
          return now - lastAct <= SEVEN_DAYS_MS;
        });

        const idx = list.findIndex((p) => p.friendCode === cleanCode);
        const prev = idx >= 0 ? list[idx] : null;
        const newXp = Math.max(Number(profileObj.xp) || 0, Number(prev?.xp) || 0);
        const xpIncreased = !prev || newXp > (Number(prev.xp) || 0);

        const desiredName =
          profileObj.username && profileObj.username !== "Misafir Oyuncu"
            ? profileObj.username.trim()
            : prev?.username || "Misafir Oyuncu";

        // Eğer başka bir oyuncu bu ismi şifreyle korumuşsa, ismin üzerine yazılmasını engelle!
        const lockedByOther = list.find(
          (p) =>
            p.friendCode !== cleanCode &&
            p.passwordProtected &&
            String(p.username || "").trim().toLowerCase() === desiredName.toLowerCase()
        );
        const safeUsername = lockedByOther ? `${desiredName}_${cleanCode.slice(-4)}` : desiredName;

        const entry = {
          friendCode: cleanCode,
          username: safeUsername,
          avatar: profileObj.avatar || prev?.avatar || "😎",
          level: Math.max(1, Math.floor(newXp / 100) + 1),
          xp: newXp,
          gamesPlayed: Math.max(Number(profileObj.gamesPlayed) || 0, Number(prev?.gamesPlayed) || 0),
          questionsCorrect: Math.max(Number(profileObj.questionsCorrect) || 0, Number(prev?.questionsCorrect) || 0),
          provider: profileObj.provider || prev?.provider || "guest",
          isPermanentMember: isMember || Boolean(prev?.isPermanentMember),
          passwordProtected: Boolean(profileObj.passwordProtected || prev?.passwordProtected),
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

  if (roomObj.roomType === "live_arena" && Array.isArray(roomObj.participants)) {
    normalizeSingleHostInRoom(roomObj);
  }

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
              if (item.isPermanentMember || item.passwordProtected) return true;
              const lastAct = Number(item.lastXpActivityAt) || new Date(item.updatedAt || now).getTime();
              return now - lastAct <= SEVEN_DAYS_MS;
            })
          : [];
        return res.status(200).json({ ok: true, players, leaderboard: players });
      }

      const friendCode = req.query.friendCode;
      if (friendCode) {
        const cleanFCode = String(friendCode).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
        const fIndex = await getJsonFromCloudPath(`friends/${cleanFCode}.json`);
        if (fIndex && fIndex.data) {
          const rec = fIndex.data;
          const now = Date.now();
          const lastAct = Number(rec.lastXpActivityAt) || new Date(rec.updatedAt || now).getTime();
          if (
            !rec.isPermanentMember &&
            !rec.passwordProtected &&
            ["guest", "Misafir"].includes(rec.provider || "guest") &&
            now - lastAct > SEVEN_DAYS_MS
          ) {
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
          const safeFriend = { ...rec };
          delete safeFriend.passwordHash;
          return res.status(200).json({
            source: "friend-index",
            friend: safeFriend,
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
        const friendCode = String(body.friendCode || body.playerCode || "").trim().toUpperCase();
        const previousRoomCode = String(body.previousRoomCode || "").trim().toUpperCase();

        // Eğer oyuncu başka bir canlı odadan çıkıp buraya girdiyse eski odadan sil ve gerekirse kuruculuğu devret!
        if (previousRoomCode && previousRoomCode !== code) {
          try {
            await removePlayerFromLiveRoom(previousRoomCode, friendCode, playerName);
          } catch (e) {}
        }

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
                  isHost: true,
                  team: "common",
                  score: 0,
                  correct: 0
                }
              ];
            }
            const existingIdx = existing.participants.findIndex(
              (p) => (friendCode && String(p.code || "").toUpperCase() === friendCode) || p.name.toLowerCase() === playerName.toLowerCase()
            );
            if (existingIdx >= 0) {
              existing.participants[existingIdx].name = playerName;
              if (friendCode) existing.participants[existingIdx].code = friendCode;
            } else {
              existing.participants.push({
                name: playerName,
                code: friendCode,
                role: "member",
                isHost: false,
                team: "common",
                score: 0,
                correct: 0,
                joinedAt: new Date().toISOString()
              });
            }
            normalizeSingleHostInRoom(existing);
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

      // 5B. AKSİYON: Canlı Odadan Çıkma ve Otomatik Kurucu Devri (leave_live_lobby)
      if (body.action === "leave_live_lobby") {
        const code = String(body.code || "").trim().toUpperCase();
        const friendCode = String(body.friendCode || body.playerCode || "").trim().toUpperCase();
        const playerName = String(body.playerName || "").trim();
        const updatedRoom = await removePlayerFromLiveRoom(code, friendCode, playerName);
        return res.status(200).json({ ok: true, room: updatedRoom });
      }

      // 6. AKSİYON: Canlı Oda Ayarlarını Güncelleme (SADECE ODA KURUCUSU — update_live_lobby)
      if (body.action === "update_live_lobby") {
        const code = String(body.code || "").trim().toUpperCase();
        const callerCode = String(body.callerCode || body.requesterCode || "").trim().toUpperCase();
        const settings = body.settings || {};

        let unauthorized = false;
        const updatedRoom = await putJsonToCloudPath(
          `rooms/${code}.json`,
          (existing) => {
            if (!existing) return null;
            normalizeSingleHostInRoom(existing);
            const hostCode = String(existing.hostCode || existing.p1FriendCode || "").toUpperCase();
            if (hostCode && callerCode && hostCode !== callerCode) {
              unauthorized = true;
              return existing;
            }
            if (settings.arenaFormat) existing.arenaFormat = settings.arenaFormat;
            if (settings.cat) existing.cat = settings.cat;
            if (settings.liveSettings && typeof settings.liveSettings === "object") {
              existing.liveSettings = {
                ...(existing.liveSettings || {}),
                ...settings.liveSettings
              };
            }
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

      // 7. AKSİYON: Canlı Odada Takım Değiştirme (Mavi / Kırmızı / Ortak Lobi — switch_live_team)
      if (body.action === "switch_live_team") {
        const code = String(body.code || "").trim().toUpperCase();
        const playerCode = String(body.friendCode || body.playerCode || "").trim().toUpperCase();
        const playerName = String(body.playerName || "").trim();
        const rawTeam = String(body.team || "common").toLowerCase();
        const team = rawTeam === "blue" ? "blue" : rawTeam === "red" ? "red" : "common";

        const updatedRoom = await putJsonToCloudPath(
          `rooms/${code}.json`,
          (existing) => {
            if (!existing || !Array.isArray(existing.participants)) return existing;
            const p = existing.participants.find(
              (item) => (playerCode && String(item.code || "").toUpperCase() === playerCode) || item.name === playerName
            );
            if (p) {
              p.team = team;
            }
            normalizeSingleHostInRoom(existing);
            existing.updatedAt = new Date().toISOString();
            return existing;
          },
          `Player ${playerName || playerCode} switched team to ${team} in ${code}`
        );
        return res.status(200).json({ ok: true, room: updatedRoom });
      }

      // 8. AKSİYON: Kurucunun Katılımcı Yönetimi (Kuruculuğu Devret, Odadan At, İlk Başlayan Ata — manage_live_participant)
      if (body.action === "manage_live_participant") {
        const code = String(body.code || "").trim().toUpperCase();
        const callerCode = String(body.callerCode || body.requesterCode || "").trim().toUpperCase();
        const targetCode = String(body.targetCode || "").trim().toUpperCase();
        const targetName = String(body.targetName || "").trim();
        const subAction = body.subAction; // 'transfer_host' | 'kick' | 'set_ebe' | 'set_team'

        let unauthorized = false;
        const updatedRoom = await putJsonToCloudPath(
          `rooms/${code}.json`,
          (existing) => {
            if (!existing) return null;
            normalizeSingleHostInRoom(existing);
            const currentHostCode = String(existing.hostCode || existing.p1FriendCode || "").toUpperCase();
            if (currentHostCode && callerCode && currentHostCode !== callerCode) {
              unauthorized = true;
              return existing;
            }
            if (!Array.isArray(existing.participants)) existing.participants = [];

            const targetIdx = existing.participants.findIndex(
              (p) => (targetCode && String(p.code || "").toUpperCase() === targetCode) || p.name === targetName
            );
            if (targetIdx < 0) return existing;
            const targetObj = existing.participants[targetIdx];

            if (subAction === "kick") {
              existing.participants.splice(targetIdx, 1);
              if (!Array.isArray(existing.kickedCodes)) existing.kickedCodes = [];
              if (targetObj.code && !existing.kickedCodes.includes(targetObj.code)) {
                existing.kickedCodes.push(targetObj.code);
              }
              normalizeSingleHostInRoom(existing);
            } else if (subAction === "transfer_host") {
              const newHostCode = String(targetObj.code || "").toUpperCase();
              existing.hostCode = newHostCode;
              existing.p1FriendCode = newHostCode || existing.p1FriendCode;
              existing.p1 = targetObj.name || existing.p1;
              existing.participants.forEach((p, idx) => {
                const isTarget = newHostCode
                  ? String(p.code || "").toUpperCase() === newHostCode
                  : idx === targetIdx;
                p.isHost = isTarget;
                p.role = isTarget ? "host" : "member";
              });
            } else if (subAction === "set_ebe") {
              if (!existing.liveSettings) existing.liveSettings = {};
              existing.liveSettings.starterMode = "manual";
              existing.liveSettings.selectedStarterCode = targetObj.code || targetObj.name;
            } else if (subAction === "set_team") {
              const rawTeam = String(body.targetTeam || body.team || "common").toLowerCase();
              targetObj.team = rawTeam === "blue" ? "blue" : rawTeam === "red" ? "red" : "common";
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

      // 9. AKSİYON: Canlı Odayı Eşzamanlı Başlatma (start_live_match)
      if (body.action === "start_live_match") {
        const code = String(body.code || "").trim().toUpperCase();
        const callerCode = String(body.callerCode || body.requesterCode || "").trim().toUpperCase();
        const qIds = Array.isArray(body.qIds) ? body.qIds : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const liveSettings = body.liveSettings || {};

        const updatedRoom = await putJsonToCloudPath(
          `rooms/${code}.json`,
          (existing) => {
            if (!existing) return null;
            normalizeSingleHostInRoom(existing);
            const currentHostCode = String(existing.hostCode || existing.p1FriendCode || "").toUpperCase();
            if (currentHostCode && callerCode && currentHostCode !== callerCode) {
              return existing;
            }

            if (body.arenaFormat) existing.arenaFormat = body.arenaFormat;
            if (body.cat) existing.cat = body.cat;
            existing.liveSettings = { ...(existing.liveSettings || {}), ...liveSettings };

            const participants =
              Array.isArray(existing.participants) && existing.participants.length > 0
                ? existing.participants
                : [{ name: existing.p1 || "Oyuncu 1", code: existing.p1FriendCode || callerCode, team: "common" }];

            let starterIdx = 0;
            const wantedStarter = String(existing.liveSettings.selectedStarterCode || "").trim().toUpperCase();
            if (existing.liveSettings.starterMode === "manual" && wantedStarter) {
              const foundIdx = participants.findIndex(
                (p) => String(p.code || "").toUpperCase() === wantedStarter || p.name === wantedStarter
              );
              if (foundIdx >= 0) starterIdx = foundIdx;
            } else {
              starterIdx = Math.floor(Math.random() * participants.length);
            }

            const turnOrder = [];
            for (let i = 0; i < participants.length; i++) {
              const p = participants[(starterIdx + i) % participants.length];
              turnOrder.push({
                code: String(p.code || "").toUpperCase(),
                name: p.name || `Oyuncu ${i + 1}`,
                team: p.team || "common"
              });
            }

            const turnStep = Math.max(1, Number(existing.liveSettings.turnStep) || 1);
            const firstPlayer = turnOrder[0];

            const scoresByPlayer = {};
            turnOrder.forEach((p) => {
              const key = p.code || p.name;
              scoresByPlayer[key] = {
                code: p.code,
                name: p.name,
                team: p.team || "common",
                correct: 0,
                total: 0,
                points: 0
              };
            });

            existing.qIds = qIds;
            existing.status = "live_in_progress";
            existing.liveMatchState = {
              qIds,
              currentQIndex: 0,
              turnStep,
              stepProgressInTurn: 0,
              turnOrder,
              activeTurnOrderIdx: 0,
              activeAnswererCode: firstPlayer.code,
              activeAnswererName: firstPlayer.name,
              subPhase: "answering", // 'answering' -> 'guessing' -> 'reveal'
              currentAnswer: null,
              currentAnswerComment: "",
              currentCustomOption: "",
              guessesByPlayer: {},
              history: [],
              scoresByPlayer,
              phaseStartedAt: Date.now(),
              updatedAt: Date.now()
            };

            existing.updatedAt = new Date().toISOString();
            return existing;
          },
          `Start synchronized live match ${code}`
        );

        return res.status(200).json({ ok: true, room: updatedRoom });
      }

      // 9B. AKSİYON: Canlı Maç Adımı Gönderme (submit_live_step: lock_answer | lock_guess | next_question)
      if (body.action === "submit_live_step") {
        const code = String(body.code || "").trim().toUpperCase();
        const playerCode = String(body.playerCode || body.friendCode || "").trim().toUpperCase();
        const playerName = String(body.playerName || "Oyuncu").trim();
        const stepAction = body.stepAction || body.subPhase;

        const updatedRoom = await putJsonToCloudPath(
          `rooms/${code}.json`,
          (existing) => {
            if (!existing || !existing.liveMatchState) return existing;
            const lms = existing.liveMatchState;
            const turnOrder = Array.isArray(lms.turnOrder) && lms.turnOrder.length > 0
              ? lms.turnOrder
              : (existing.participants || []).map((p) => ({ code: p.code, name: p.name, team: p.team || "common" }));

            if (stepAction === "lock_answer") {
              // Sadece aktif cevaplayıcı şıkkını kilitleyebilir
              if (
                lms.activeAnswererCode &&
                playerCode &&
                String(lms.activeAnswererCode).toUpperCase() !== playerCode
              ) {
                return existing;
              }
              lms.currentAnswer = Number(body.answerIndex);
              lms.currentAnswerComment = String(body.comment || "").trim();
              lms.currentCustomOption = String(body.customOption || "").trim();
              lms.guessesByPlayer = {};
              // Eğer odada tek kişi varsa direkt reveal aşamasına geç, 2+ kişi varsa guessing aşamasına geç!
              lms.subPhase = turnOrder.length <= 1 ? "reveal" : "guessing";
              lms.phaseStartedAt = Date.now();
              lms.updatedAt = Date.now();
            } else if (stepAction === "lock_guess") {
              if (!lms.guessesByPlayer) lms.guessesByPlayer = {};
              const pKey = playerCode || playerName;
              const guessIdx = Number(body.guessIndex);
              const isCorrect =
                lms.currentAnswer === -1 || guessIdx === Number(lms.currentAnswer);

              if (!lms.guessesByPlayer[pKey]) {
                lms.guessesByPlayer[pKey] = {
                  code: playerCode,
                  name: playerName,
                  guessIndex: guessIdx,
                  comment: String(body.comment || "").trim(),
                  isCorrect,
                  submittedAt: Date.now()
                };

                if (!lms.scoresByPlayer) lms.scoresByPlayer = {};
                const scoreEntry = lms.scoresByPlayer[pKey] || {
                  code: playerCode,
                  name: playerName,
                  team: "common",
                  correct: 0,
                  total: 0,
                  points: 0
                };
                scoreEntry.total += 1;
                if (isCorrect) {
                  scoreEntry.correct += 1;
                  scoreEntry.points += 100;
                }
                lms.scoresByPlayer[pKey] = scoreEntry;
              }

              // Beklenen tüm tahminciler tahminini kilitlediyse 'reveal' (sonuç + 1.5sn balon) aşamasına geç!
              const expectedGuessers = turnOrder.filter(
                (p) => String(p.code || p.name).toUpperCase() !== String(lms.activeAnswererCode || lms.activeAnswererName).toUpperCase()
              );
              const submittedKeys = Object.keys(lms.guessesByPlayer).map((k) => k.toUpperCase());
              const allGuessed =
                expectedGuessers.length === 0 ||
                expectedGuessers.every((g) =>
                  submittedKeys.includes(String(g.code || "").toUpperCase()) ||
                  submittedKeys.includes(String(g.name || "").toUpperCase())
                );

              if (allGuessed) {
                lms.subPhase = "reveal";
                lms.phaseStartedAt = Date.now();
              }
              lms.updatedAt = Date.now();
            } else if (stepAction === "next_question") {
              if (lms.subPhase !== "reveal") return existing;

              if (!Array.isArray(lms.history)) lms.history = [];
              const qId = Array.isArray(lms.qIds) ? lms.qIds[lms.currentQIndex] : lms.currentQIndex + 1;
              lms.history.push({
                qIndex: lms.currentQIndex,
                qId,
                answererCode: lms.activeAnswererCode,
                answererName: lms.activeAnswererName,
                answerIndex: lms.currentAnswer,
                answerComment: lms.currentAnswerComment,
                customOption: lms.currentCustomOption,
                guessesByPlayer: { ...(lms.guessesByPlayer || {}) }
              });

              const nextQIndex = (Number(lms.currentQIndex) || 0) + 1;
              const totalQs = Array.isArray(lms.qIds) ? lms.qIds.length : 10;

              if (nextQIndex >= totalQs) {
                existing.status = "completed";
                lms.subPhase = "completed";
                const scoreArr = Object.values(lms.scoresByPlayer || {});
                scoreArr.sort((a, b) => (b.points || 0) - (a.points || 0));
                existing.liveLeaderboard = scoreArr;
                const totalC = scoreArr.reduce((acc, s) => acc + (s.correct || 0), 0);
                const totalT = scoreArr.reduce((acc, s) => acc + (s.total || 0), 0);
                existing.lastMatchPercentage = totalT > 0 ? Math.round((totalC / totalT) * 100) : 85;
                existing.lastCorrectCount = totalC;
                existing.lastTotalQuestions = totalT;
              } else {
                lms.currentQIndex = nextQIndex;
                const turnStep = Math.max(1, Number(lms.turnStep) || 1);
                let nextStepInTurn = (Number(lms.stepProgressInTurn) || 0) + 1;
                let nextOrderIdx = Number(lms.activeTurnOrderIdx) || 0;

                // turnStep kadar soru çözüldüğünde sıra diğer oyuncuya geçer! (1'er 1'er modunda her soruda sıra değişir!)
                if (nextStepInTurn >= turnStep) {
                  nextStepInTurn = 0;
                  nextOrderIdx = (nextOrderIdx + 1) % Math.max(1, turnOrder.length);
                }

                const nextAnswerer = turnOrder[nextOrderIdx] || turnOrder[0];
                lms.stepProgressInTurn = nextStepInTurn;
                lms.activeTurnOrderIdx = nextOrderIdx;
                lms.activeAnswererCode = nextAnswerer.code;
                lms.activeAnswererName = nextAnswerer.name;
                lms.subPhase = "answering";
                lms.currentAnswer = null;
                lms.currentAnswerComment = "";
                lms.currentCustomOption = "";
                lms.guessesByPlayer = {};
                lms.phaseStartedAt = Date.now();
              }
              lms.updatedAt = Date.now();
            }

            existing.updatedAt = new Date().toISOString();
            return existing;
          },
          `Live step (${stepAction}) in ${code}`
        );

        return res.status(200).json({ ok: true, room: updatedRoom });
      }

      // 9C. AKSİYON: Aktif Düelloyu Bitir / Sil / Terk Et (forfeit_or_delete_room)
      if (body.action === "forfeit_or_delete_room") {
        const codes = Array.isArray(body.codes)
          ? body.codes
          : body.code
          ? [body.code]
          : [];
        const byCode = String(body.byCode || "").trim().toUpperCase();
        const byName = String(body.byName || "Rakibin").trim();
        const purgeCompletely = Boolean(body.purgeCompletely);

        for (const rawCode of codes) {
          const cleanCode = String(rawCode || "").trim().toUpperCase();
          if (!cleanCode) continue;

          await putJsonToCloudPath(
            `rooms/${cleanCode}.json`,
            (existing) => {
              if (!existing) return null;
              if (purgeCompletely) {
                existing.status = "purged";
                existing.purgedAt = Date.now();
              } else if (existing.status !== "completed") {
                existing.status = "opponent_fled";
                existing.abandonedByCode = byCode;
                existing.abandonedByName = byName;
                existing.abandonedAt = Date.now();
              }
              existing.updatedAt = new Date().toISOString();
              return existing;
            },
            `Forfeit/delete room ${cleanCode} by ${byCode}`
          );
        }

        // Silen kişinin kendi bulut activeRooms listesinden bu odaları kalıcı olarak çıkar (tekrar geri gelmesin!)
        if (/^SNC-\d{4}$/.test(byCode)) {
          const cleanCodesUpper = codes.map((c) => String(c || "").trim().toUpperCase());
          await putJsonToCloudPath(
            `friends/${byCode}.json`,
            (existing) => {
              if (!existing) return existing;
              if (!Array.isArray(existing.deletedRoomCodes)) existing.deletedRoomCodes = [];
              cleanCodesUpper.forEach((c) => {
                if (c && !existing.deletedRoomCodes.includes(c)) existing.deletedRoomCodes.push(c);
              });
              if (Array.isArray(existing.activeRooms)) {
                existing.activeRooms = existing.activeRooms.filter(
                  (r) => !cleanCodesUpper.includes(String(r.code || "").toUpperCase())
                );
              }
              if (cleanCodesUpper.includes(String(existing.latestRoomCode || "").toUpperCase())) {
                existing.latestRoomCode = existing.activeRooms?.[0]?.code || "";
              }
              existing.updatedAt = new Date().toISOString();
              return existing;
            },
            `Remove deleted rooms from ${byCode}`
          );
        }

        return res.status(200).json({ ok: true, deletedCodes: codes });
      }

      // 9D. AKSİYON: Misafir Üyeliğini Şifreyle Koru & Şifreli Misafir Girişi (set_guest_password | login_guest_password | check_username_lock)
      if (body.action === "set_guest_password") {
        const friendCode = String(body.friendCode || "").trim().toUpperCase();
        const username = String(body.username || "").trim();
        const password = String(body.password || "").trim();

        if (!/^SNC-\d{4}$/.test(friendCode) || !username || password.length < 3) {
          return res.status(400).json({ error: "Geçerli bir isim ve en az 3 karakterli şifre girin." });
        }

        // Başka bir SNC kodu bu ismi zaten şifreyle korumuş mu kontrol et
        const lb = await getJsonFromCloudPath("leaderboard/global.json");
        const existingOwner = (lb?.data?.players || []).find(
          (p) =>
            p.friendCode !== friendCode &&
            p.passwordProtected &&
            String(p.username || "").trim().toLowerCase() === username.toLowerCase()
        );
        if (existingOwner) {
          return res.status(409).json({
            error: `"${username}" ismi başka bir oyuncu (${existingOwner.friendCode}) tarafından şifreyle korunmaktadır!`
          });
        }

        const encodedPass = Buffer.from(password, "utf-8").toString("base64");
        const updatedFriend = await putJsonToCloudPath(
          `friends/${friendCode}.json`,
          (existing) => {
            const rec = Object.assign(createDefaultFriendRecord(friendCode, username), existing || {});
            rec.username = username;
            rec.passwordProtected = true;
            rec.passwordHash = encodedPass;
            rec.updatedAt = new Date().toISOString();
            return rec;
          },
          `Set guest password for ${friendCode}`
        );

        await upsertGlobalLeaderboardEntry({
          ...updatedFriend,
          passwordProtected: true
        });

        const safeFriend = { ...updatedFriend };
        delete safeFriend.passwordHash;
        return res.status(200).json({ ok: true, friend: safeFriend });
      }

      if (body.action === "login_guest_password") {
        const identifier = String(body.identifier || "").trim();
        const password = String(body.password || "").trim();
        const encodedPass = Buffer.from(password, "utf-8").toString("base64");

        let targetCode = "";
        if (/^SNC-\d{4}$/i.test(identifier)) {
          targetCode = identifier.toUpperCase();
        } else {
          const lb = await getJsonFromCloudPath("leaderboard/global.json");
          const match = (lb?.data?.players || []).find(
            (p) => String(p.username || "").trim().toLowerCase() === identifier.toLowerCase()
          );
          if (match) targetCode = match.friendCode;
        }

        if (!targetCode) {
          return res.status(404).json({ error: "Bu isim veya arkadaş koduna ait şifreli hesap bulunamadı." });
        }

        const fFound = await getJsonFromCloudPath(`friends/${targetCode}.json`);
        if (!fFound || !fFound.data || !fFound.data.passwordProtected) {
          return res.status(404).json({ error: "Bu hesapta şifre koruması bulunmuyor." });
        }

        if (fFound.data.passwordHash !== encodedPass) {
          return res.status(401).json({ error: "Girdiğiniz şifre hatalı!" });
        }

        const safeFriend = { ...fFound.data };
        delete safeFriend.passwordHash;
        return res.status(200).json({ ok: true, friend: safeFriend });
      }

      if (body.action === "check_username_lock") {
        const username = String(body.username || "").trim();
        const myCode = String(body.myCode || "").trim().toUpperCase();
        const lb = await getJsonFromCloudPath("leaderboard/global.json");
        const lockedOwner = (lb?.data?.players || []).find(
          (p) =>
            p.friendCode !== myCode &&
            p.passwordProtected &&
            String(p.username || "").trim().toLowerCase() === username.toLowerCase()
        );
        return res.status(200).json({
          ok: true,
          locked: Boolean(lockedOwner),
          ownerCode: lockedOwner ? lockedOwner.friendCode : null
        });
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
                if (p.passwordProtected !== undefined) {
                  rec.passwordProtected = Boolean(p.passwordProtected || rec.passwordProtected);
                }
                rec.updatedAt = new Date().toISOString();
                return rec;
              },
              `Update friend profile ${cleanFCode}`
            );
          } catch (e) {}

          await upsertGlobalLeaderboardEntry({
            ...p,
            passwordProtected: Boolean(p.passwordProtected || syncedFriendRecord?.passwordProtected)
          });
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

      // Eğer oyuncu yeni bir canlı oda kurduysa ve önceki bir canlı odada bulunuyorsa eski odadan otomatik çıkar!
      if (room.roomType === "live_arena" && body.previousLiveRoomCode && body.previousLiveRoomCode !== room.code) {
        try {
          await removePlayerFromLiveRoom(body.previousLiveRoomCode, room.p1FriendCode, room.p1);
        } catch (e) {}
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
