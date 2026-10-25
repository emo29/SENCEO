// Vercel Serverless Function (/api/rooms) — v0.11
// Varsayılan Supabase: https://kypzuqnksnlinkfuxvnl.supabase.co
// Özellikler (v0.11):
// 1. 409 Conflict korumalı (Optimistic Retry) Bulut JSON Okuma/Yazma
// 2. Çift Yönlü Arkadaşlık Bağı İstekleri (send_friend_request, respond_friend_request)
// 3. Gerçek Zamanlı Bildirim Merkezi & Hatırlatma (send_nudge, clear_notifications, set_slide_watch_status)
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

async function putJsonToCloudPath(relPath, payloadOrUpdater, commitMessage, maxRetries = 7) {
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
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1) + Math.floor(Math.random() * 140)));
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

const BLOCKED_TEST_USERNAMES = new Set([
  "denemea",
  "denemeb",
  "emirhantest",
  "deneb",
  "denea",
  "deneme1",
  "a",
  "i",
  "misafir oyuncu",
  "oyuncu",
  "oyuncu_a",
  "oyuncu_b",
  "oyuncu_c",
  "oyuncu_d",
  "oyuncu_e",
  "oyuncu_f",
  "oyuncu_g",
  "oyuncu_h",
  "oyuncu_j",
  "oyuncu_k",
  "yanyanaa",
  "yanyanab",
  "sıradana",
  "sıradanb",
  "siradana",
  "siradanb",
  "s─▒radana",
  "s─▒radanb",
  "sa─üdakipc1",
  "sağdakipc1",
  "sagdaki",
  "soldaki",
  "korkakrakip"
]);

function isBlockedTestAccountName(username) {
  const clean = String(username || "").trim().toLowerCase();
  if (!clean || clean.length <= 1) return true;
  if (BLOCKED_TEST_USERNAMES.has(clean)) return true;
  if (/^oyuncu_[a-z0-9]+$/i.test(clean)) return true;
  if (/[─▒┼Ÿ├§├¶├¼]/.test(clean)) return true;
  return false;
}

function sanitizeShowcaseUsername(rawName) {
  return String(rawName || "")
    .trim()
    .replace(/\s+[A-ZÇĞİÖŞÜ]\.$/, "")
    .trim();
}

// Global Liderlik Tablosunu Güncelle + 7 Gün Puanı Artmayan Misafirleri Otomatik Sil + Şifreli İsim Koruması
async function upsertGlobalLeaderboardEntry(profileObj) {
  if (!profileObj || !profileObj.friendCode || !/^SNC-\d{4}$/i.test(profileObj.friendCode)) return;
  const cleanCode = profileObj.friendCode.toUpperCase();
  const isProt = Boolean(profileObj.passwordProtected || profileObj.isPasswordProtected);
  const isMember =
    Boolean(profileObj.isPermanentMember) ||
    isProt ||
    (profileObj.provider && !["guest", "Misafir"].includes(profileObj.provider) && Boolean(profileObj.email));

  if (isBlockedTestAccountName(profileObj.username) && !isProt) {
    return;
  }

  try {
    await putJsonToCloudPath(
      "leaderboard/global.json",
      (existing) => {
        const now = Date.now();
        let list = Array.isArray(existing?.players) ? existing.players : [];

        // Test hesaplarını ve 7 gün boyunca hiç XP kazanmamış şifresiz/üyeliksiz misafir hesapları temizle
        list = list.filter((item) => {
          if (!item || !item.friendCode) return false;
          item.username = sanitizeShowcaseUsername(item.username);
          if (isBlockedTestAccountName(item.username)) return false;
          if (item.isPermanentMember || item.passwordProtected) return true;
          const lastAct = Number(item.lastXpActivityAt) || new Date(item.updatedAt || now).getTime();
          return now - lastAct <= SEVEN_DAYS_MS;
        });

        const idx = list.findIndex((p) => p.friendCode === cleanCode);
        const prev = idx >= 0 ? list[idx] : null;
        const newXp = Math.max(Number(profileObj.xp) || 0, Number(prev?.xp) || 0);
        const xpIncreased = !prev || newXp > (Number(prev.xp) || 0);

        const desiredName = sanitizeShowcaseUsername(
          profileObj.username && profileObj.username !== "Misafir Oyuncu"
            ? profileObj.username.trim()
            : prev?.username || "Misafir Oyuncu"
        );

        if (isBlockedTestAccountName(desiredName)) {
          return {
            updatedAt: new Date().toISOString(),
            players: list.slice(0, 100)
          };
        }

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
          passwordProtected: Boolean(isProt || prev?.passwordProtected),
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

// Canlı Oda maçlarında (1v1, 2v2, 3v3, 4v4, 5v5, Herkes Tek) aktif cevaplayıcı ve tahminciyi hesaplayan yardımcı fonksiyon
function computeActiveAnswererAndGuesser(turnOrder, activeTurnOrderIdx, arenaFormat, liveSettings) {
  const safeOrder =
    Array.isArray(turnOrder) && turnOrder.length > 0
      ? turnOrder
      : [{ code: "SNC-0001", name: "Oyuncu 1", team: "common" }];
  const ansIdx = ((Number(activeTurnOrderIdx) || 0) % safeOrder.length + safeOrder.length) % safeOrder.length;
  const answerer = safeOrder[ansIdx];

  if (safeOrder.length === 1) {
    return { answerer, guesser: answerer };
  }

  const fmt = String(arenaFormat || "1v1").toLowerCase();
  const isTeamFmt = ["2v2", "3v3", "4v4", "5v5"].includes(fmt);
  const teamRule = String((liveSettings && liveSettings.teamSubMode) || "partner").toLowerCase();

  if (isTeamFmt && answerer.team && answerer.team !== "common") {
    if (teamRule === "partner" || teamRule === "coop_pair") {
      // Eşli Uyum: Aynı takımdaki takım arkadaşını bul
      const partner = safeOrder.find(
        (p, idx) => idx !== ansIdx && p.team === answerer.team
      );
      if (partner) return { answerer, guesser: partner };
    } else if (teamRule === "rival" || teamRule === "cross_team") {
      // Karşı Takımı Tahmin: Rakip takımdan sıradaki oyuncuyu bul
      for (let offset = 1; offset < safeOrder.length; offset++) {
        const candidate = safeOrder[(ansIdx + offset) % safeOrder.length];
        if (candidate && candidate.team && candidate.team !== "common" && candidate.team !== answerer.team) {
          return { answerer, guesser: candidate };
        }
      }
    }
  }

  const guesser = safeOrder[(ansIdx + 1) % safeOrder.length];
  return { answerer, guesser };
}

async function saveRoomToCloud(roomCode, roomObj) {
  const cleanCode = String(roomCode).toUpperCase().replace(/[^A-Z0-9_-]/g, "");

  const mergedRoom = await putJsonToCloudPath(
    `rooms/${cleanCode}.json`,
    (existing) => {
      if (
        existing &&
        (Number(roomObj.currentRound) || 1) === (Number(existing.currentRound) || 1) &&
        (roomObj.status === "waiting_p1_half2" || roomObj.status === "completed")
      ) {
        // KRİTİK KORUMA: 2. Oyuncu (denemeb) karşı saldırı sorularını kaydettiğinde (waiting_p1_half2)
        // 1. Oyuncunun (denemea) p1FriendCode ve p1Id kimliği ASLA ezilemez!
        if (
          roomObj.status === "waiting_p1_half2" &&
          existing.p1FriendCode &&
          roomObj.p1FriendCode &&
          roomObj.p1FriendCode.toUpperCase() !== existing.p1FriendCode.toUpperCase() &&
          !roomObj.p2FriendCode
        ) {
          roomObj.p2FriendCode = roomObj.p1FriendCode;
        }
        if (existing.p1FriendCode) roomObj.p1FriendCode = existing.p1FriendCode;
        if (existing.p1Id) roomObj.p1Id = existing.p1Id;
        if (existing.p1) roomObj.p1 = existing.p1;
        if (!roomObj.p2FriendCode && existing.p2FriendCode) roomObj.p2FriendCode = existing.p2FriendCode;
        if (!roomObj.p2Id && existing.p2Id) roomObj.p2Id = existing.p2Id;
      }

      if (roomObj.roomType === "live_arena" && Array.isArray(roomObj.participants)) {
        normalizeSingleHostInRoom(roomObj);
      }

      // Raund tamamlandığında (completed), bir sonraki raundda (Raund N+1) İLK BAŞLAYACAK KİŞİYİ (2. başlayan = p2) kilitle!
      if (roomObj.status === "completed") {
        roomObj.nextRoundStarterCode = roomObj.p2FriendCode || "";
        roomObj.nextRoundStarterName = roomObj.p2 || "2. Oyuncu";
        roomObj.nextRoundSecondCode = roomObj.p1FriendCode || "";
        roomObj.nextRoundSecondName = roomObj.p1 || "1. Oyuncu";
        if (roomObj.p2WatchingSlides === undefined) {
          roomObj.p2WatchingSlides = Boolean(existing && existing.p2WatchingSlides);
        }
        if (roomObj.p2WatchedSlides === undefined) {
          roomObj.p2WatchedSlides = Boolean(existing && existing.p2WatchedSlides);
        }
      }

      return roomObj;
    },
    `Sync room ${cleanCode} (${roomObj.status || "active"})`
  );

  if (mergedRoom) {
    Object.assign(roomObj, mergedRoom);
  }

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
      // v0.15 (#6): Google / Facebook / iCloud (Apple ID) OAuth 2.0 Güvenli Şifre Doğrulamalı Popup Penceresi
      if (req.query.oauth_popup) {
        const provider = String(req.query.provider || "Google").trim();
        const brandColor =
          provider === "Facebook" ? "#1877F2" : provider === "iCloud" || provider === "iCloud (Apple)" ? "#111827" : "#4285F4";
        const brandIcon =
          provider === "Facebook" ? "📘" : provider === "iCloud" || provider === "iCloud (Apple)" ? "🍎" : "🌐";
        const defaultDomain =
          provider === "Facebook" ? "facebook.com" : provider === "iCloud" || provider === "iCloud (Apple)" ? "icloud.com" : "gmail.com";

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.status(200).send(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${provider} Güvenli Oturum Açma — senceo</title>
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif; }
    body { margin: 0; background: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 18px; }
    .card { width: 100%; max-width: 430px; background: #fff; border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: 0 20px 45px rgba(15,23,42,0.08); padding: 26px 22px; }
    .badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; background: #f1f5f9; font-size: 12px; font-weight: 700; color: #334155; }
    h1 { font-size: 19px; margin: 12px 0 6px; font-weight: 800; }
    p.sub { font-size: 12.5px; color: #64748b; margin: 0 0 14px; line-height: 1.45; }
    label { display: block; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; margin: 10px 0 4px; }
    input { width: 100%; padding: 10px 12px; border-radius: 12px; border: 1.5px solid #cbd5e1; font-size: 13.5px; font-weight: 600; outline: none; }
    input:focus { border-color: ${brandColor}; }
    .err { display: none; margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; font-size: 12px; font-weight: 700; }
    .perms { margin-top: 14px; padding: 11px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 11.5px; color: #334155; line-height: 1.45; }
    .btn { margin-top: 16px; width: 100%; padding: 12px 16px; border-radius: 12px; border: none; background: ${brandColor}; color: #fff; font-weight: 800; font-size: 13.5px; cursor: pointer; }
    .btn:hover { opacity: 0.94; }
    .btn:disabled { opacity: 0.6; cursor: wait; }
    .btn-cancel { margin-top: 8px; width: 100%; padding: 9px; border-radius: 12px; border: 1px solid #cbd5e1; background: #fff; color: #475569; font-weight: 700; font-size: 12px; cursor: pointer; }
    .saved-list { margin-bottom: 12px; display: none; flex-direction: column; gap: 6px; }
    .saved-item { padding: 9px 11px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; display: flex; align-items: center; justify-content: space-between; font-size: 12.5px; font-weight: 700; }
    .saved-item:hover { border-color: ${brandColor}; background: #eff6ff; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge"><span>${brandIcon}</span> <span>${provider} Güvenli Kimlik &amp; Şifre Doğrulama</span></div>
    <h1>${provider} ile senceo'ya Giriş Yap</h1>
    <p class="sub">Hesabınızın güvenliği için <strong>şifresiz giriş yapılamaz</strong>. E-posta adresinizi ve şifrenizi girerek oturum açın.</p>

    <div id="saved-accounts" class="saved-list"></div>

    <form id="oauth-form">
      <label>${provider} E-Posta Adresin</label>
      <input id="inp-email" type="email" required placeholder="ornek@${defaultDomain}" autocomplete="email" />
      <label>Hesap Şifren (Zorunlu)</label>
      <input id="inp-password" type="password" required minlength="4" placeholder="••••••••" autocomplete="current-password" />
      <label>Görünecek Oyuncu Adın</label>
      <input id="inp-name" type="text" required minlength="2" maxlength="24" placeholder="Örn: Emirhan" autocomplete="name" />

      <div id="err-box" class="err"></div>

      <div class="perms">
        🔒 <strong>Şifre Korumalı OAuth Oturumu:</strong><br/>
        • Şifreniz doğrulanmadan hiçbir yabancı e-postanızla giriş yapamaz.<br/>
        • 365 gün kalıcı seviye (TP) ve arkadaş kodu (<code>SNC-XXXX</code>) senkronizasyonu.
      </div>

      <button id="submit-btn" type="submit" class="btn">🔐 Şifreyi Doğrula ve ${provider} İle Giriş Yap</button>
      <button type="button" class="btn-cancel" onclick="window.close()">İptal Et</button>
    </form>
  </div>
  <script>
    (function() {
      const provider = ${JSON.stringify(provider)};
      try {
        const saved = JSON.parse(localStorage.getItem('senceo_saved_oauth_accounts') || '[]');
        const listEl = document.getElementById('saved-accounts');
        if (Array.isArray(saved) && saved.length > 0 && listEl) {
          listEl.style.display = 'flex';
          saved.forEach((acc) => {
            const div = document.createElement('div');
            div.className = 'saved-item';
            div.innerHTML = '<span>👤 ' + (acc.name || '') + ' <small style="color:#64748b">(' + (acc.email || '') + ')</small></span><span style="color:${brandColor}">Şifre Gir ➔</span>';
            div.onclick = () => {
              document.getElementById('inp-email').value = acc.email || '';
              document.getElementById('inp-name').value = acc.name || '';
              document.getElementById('inp-password').focus();
            };
            listEl.appendChild(div);
          });
        }
      } catch (e) {}

      document.getElementById('oauth-form').addEventListener('submit', async function(ev) {
        ev.preventDefault();
        const email = document.getElementById('inp-email').value.trim();
        const password = document.getElementById('inp-password').value.trim();
        const name = document.getElementById('inp-name').value.trim();
        const errBox = document.getElementById('err-box');
        const submitBtn = document.getElementById('submit-btn');

        if (!email || !password || password.length < 4 || !name) {
          errBox.textContent = '⚠️ Lütfen e-posta, oyuncu adı ve en az 4 karakterli şifrenizi girin.';
          errBox.style.display = 'block';
          return;
        }

        errBox.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Şifre Doğrulanıyor...';

        try {
          const res = await fetch('/api/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'social_oauth_login',
              provider: provider,
              email: email,
              username: name,
              password: password
            })
          });
          const data = await res.json();
          if (!res.ok || data.error) {
            errBox.textContent = '❌ ' + (data.error || 'Şifre doğrulanamadı!');
            errBox.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = '🔐 Şifreyi Doğrula ve ' + provider + ' İle Giriş Yap';
            return;
          }

          try {
            const saved = JSON.parse(localStorage.getItem('senceo_saved_oauth_accounts') || '[]');
            const filtered = saved.filter((x) => x && x.email !== email);
            filtered.unshift({ email, name: (data.friend && data.friend.username) || name, provider });
            localStorage.setItem('senceo_saved_oauth_accounts', JSON.stringify(filtered.slice(0, 5)));
          } catch (e) {}

          if (window.opener) {
            window.opener.postMessage({
              type: 'SENCEO_OAUTH_SUCCESS',
              provider: provider,
              email: email,
              name: (data.friend && data.friend.username) || name,
              friend: data.friend || null
            }, window.location.origin);
          }
          window.close();
        } catch (err) {
          errBox.textContent = '⚠️ Bağlantı hatası oluştu, lütfen tekrar deneyin.';
          errBox.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.textContent = '🔐 Şifreyi Doğrula ve ' + provider + ' İle Giriş Yap';
        }
      });
    })();
  </script>
</body>
</html>`);
      }

      // Global Liderlik Tablosu Sorgusu
      if (req.query.leaderboard) {
        const lb = await getJsonFromCloudPath("leaderboard/global.json");
        const now = Date.now();
        const players = Array.isArray(lb?.data?.players)
          ? lb.data.players
              .map((item) => (item ? { ...item, username: sanitizeShowcaseUsername(item.username) } : null))
              .filter((item) => {
                if (!item || !item.friendCode) return false;
                if (isBlockedTestAccountName(item.username)) return false;
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
          delete safeFriend.rawPassword;
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
            rec.incomingRequests = (rec.incomingRequests || []).filter(
              (r) => String(r.fromCode || "").toUpperCase() !== requesterCode
            );
            if (!Array.isArray(rec.acceptedFriends)) rec.acceptedFriends = [];

            if (decision === "accept") {
              if (!rec.acceptedFriends.some((f) => String(f.code || "").toUpperCase() === requesterCode)) {
                rec.acceptedFriends.push({
                  code: requesterCode,
                  name: requesterName,
                  acceptedAt: new Date().toISOString()
                });
              }
            }
            if (Array.isArray(rec.notifications)) {
              if (decision === "reject") {
                rec.notifications = rec.notifications.filter(
                  (n) => !(String(n.fromCode || "").toUpperCase() === requesterCode && n.type === "friend_request")
                );
              } else {
                rec.notifications.forEach((n) => {
                  if (String(n.fromCode || "").toUpperCase() === requesterCode && n.type === "friend_request") {
                    n.read = true;
                    n.handled = decision;
                  }
                });
              }
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

      // 2B. AKSİYON: Davet Linkiyle (?friend=SNC-XXXX&fname=...) Çift Yönlü Anında Arkadaşlık Bağı Kurma (accept_friend_invite_link)
      if (body.action === "accept_friend_invite_link") {
        const inviterCode = String(body.inviterCode || "").trim().toUpperCase();
        const rawInviterName = String(body.inviterName || "").trim();
        const accepterCode = String(body.accepterCode || "").trim().toUpperCase();
        const rawAccepterName = String(body.accepterName || "").trim();

        if (!/^SNC-\d{4}$/.test(inviterCode) || !/^SNC-\d{4}$/.test(accepterCode) || inviterCode === accepterCode) {
          return res.status(400).json({ error: "Geçersiz arkadaş kodu." });
        }

        const isCleanRealName = (n, code) =>
          Boolean(n && n !== "Misafir Oyuncu" && n !== "Arkadaşın" && n !== "Oyuncu" && n.toUpperCase() !== code);

        // 1. Önce davet linkini paylaşan (örn: ZZerban SNC-1265) kullanıcının kaydını güncelle ve karşı tarafı (örn: emirhan SNC-7224) ekle!
        let resolvedInviterName = isCleanRealName(rawInviterName, inviterCode) ? rawInviterName : "";
        const accepterDisplayForInviter = isCleanRealName(rawAccepterName, accepterCode)
          ? rawAccepterName
          : `Oyuncu (${accepterCode})`;

        const updatedInviter = await putJsonToCloudPath(
          `friends/${inviterCode}.json`,
          (existing) => {
            const rec = Object.assign(
              createDefaultFriendRecord(inviterCode, resolvedInviterName || "Oyuncu"),
              existing || {}
            );
            if (isCleanRealName(rec.username, inviterCode)) {
              resolvedInviterName = rec.username;
            } else if (resolvedInviterName) {
              rec.username = resolvedInviterName;
            }
            rec.incomingRequests = (rec.incomingRequests || []).filter((r) => r.fromCode !== accepterCode);
            if (!Array.isArray(rec.acceptedFriends)) rec.acceptedFriends = [];

            const existingFriendIdx = rec.acceptedFriends.findIndex((f) => f && f.code === accepterCode);
            if (existingFriendIdx >= 0) {
              if (isCleanRealName(rawAccepterName, accepterCode)) {
                rec.acceptedFriends[existingFriendIdx].name = rawAccepterName;
              }
            } else {
              rec.acceptedFriends.push({
                code: accepterCode,
                name: accepterDisplayForInviter,
                acceptedAt: new Date().toISOString()
              });
            }

            pushNotification(rec, {
              id: `FINVITE_${accepterCode}_TO_${inviterCode}`,
              type: "friend_accepted",
              title: "🎉 Davet Linkinle Yeni Bağ Kuruldu!",
              message: `${accepterDisplayForInviter}${
                accepterDisplayForInviter.includes(accepterCode) ? "" : ` (${accepterCode})`
              } davet linkine tıkladı ve karşılıklı arkadaş bağlarınıza eklendi!`,
              fromCode: accepterCode,
              fromName: accepterDisplayForInviter
            });
            rec.updatedAt = new Date().toISOString();
            return rec;
          },
          `Mutual friend invite link ${inviterCode} <-> ${accepterCode} (inviter side)`
        );

        const finalInviterName =
          resolvedInviterName ||
          (updatedInviter && isCleanRealName(updatedInviter.username, inviterCode) ? updatedInviter.username : "") ||
          `Oyuncu (${inviterCode})`;

        // 2. Linke tıklayan (örn: emirhan SNC-7224) kullanıcının bulut kaydına da davet edeni (ZZerban SNC-1265) ekle!
        const updatedAccepter = await putJsonToCloudPath(
          `friends/${accepterCode}.json`,
          (existing) => {
            const rec = Object.assign(
              createDefaultFriendRecord(accepterCode, isCleanRealName(rawAccepterName, accepterCode) ? rawAccepterName : "Oyuncu"),
              existing || {}
            );
            if (isCleanRealName(rawAccepterName, accepterCode)) {
              rec.username = rawAccepterName;
            }
            rec.incomingRequests = (rec.incomingRequests || []).filter((r) => r.fromCode !== inviterCode);
            if (!Array.isArray(rec.acceptedFriends)) rec.acceptedFriends = [];

            const existingFriendIdx = rec.acceptedFriends.findIndex((f) => f && f.code === inviterCode);
            if (existingFriendIdx >= 0) {
              if (isCleanRealName(finalInviterName, inviterCode)) {
                rec.acceptedFriends[existingFriendIdx].name = finalInviterName;
              }
            } else {
              rec.acceptedFriends.push({
                code: inviterCode,
                name: finalInviterName,
                acceptedAt: new Date().toISOString()
              });
            }
            rec.updatedAt = new Date().toISOString();
            return rec;
          },
          `Mutual friend invite link ${inviterCode} <-> ${accepterCode} (accepter side)`
        );

        let activeRoom = null;
        if (updatedInviter && updatedInviter.latestRoomCode) {
          const rFound = await getRoomFromCloud(updatedInviter.latestRoomCode);
          if (rFound) activeRoom = rFound.room;
        }

        const safeInviter = updatedInviter ? { ...updatedInviter } : null;
        const safeAccepter = updatedAccepter ? { ...updatedAccepter } : null;
        if (safeInviter) delete safeInviter.passwordHash;
        if (safeAccepter) delete safeAccepter.passwordHash;

        return res.status(200).json({
          ok: true,
          inviterName: finalInviterName,
          inviterFriend: safeInviter,
          accepterFriend: safeAccepter,
          room: activeRoom
        });
      }

      // 3. AKSİYON: Hatırlatma (Nudge) ve 2. Raunda Geçiş Çağrısı Gönderme (send_nudge)
      if (body.action === "send_nudge") {
        const fromCode = String(body.fromCode || "").trim().toUpperCase();
        const fromName = String(body.fromName || "Arkadaşın").trim();
        let toCode = String(body.toCode || "").trim().toUpperCase();
        const roomCode = String(body.roomCode || "").trim().toUpperCase();
        const isNextRound = body.nudgeType === "next_round";
        const roundNum = Number(body.roundNum) || 2;

        if (roomCode) {
          try {
            const updatedR = await putJsonToCloudPath(
              `rooms/${roomCode}.json`,
              (existing) => {
                if (!existing) return null;
                existing.round2NudgeAt = Date.now();
                existing.round2NudgeFrom = fromName;
                existing.round2NudgeFromCode = fromCode;
                existing.round2NudgeTargetRound = roundNum;
                existing.updatedAt = new Date().toISOString();
                return existing;
              },
              `Round ${roundNum} nudge on ${roomCode}`
            );
            if (!toCode && updatedR) {
              toCode = String(updatedR.nextRoundStarterCode || updatedR.p2FriendCode || "").trim().toUpperCase();
            }
          } catch (e) {}
        }

        if (/^SNC-\d{4}$/.test(toCode)) {
          await putJsonToCloudPath(
            `friends/${toCode}.json`,
            (existing) => {
              const rec = Object.assign(createDefaultFriendRecord(toCode, "Oyuncu"), existing || {});
              pushNotification(rec, {
                id: `NUDGE_${roomCode}_${Date.now()}`,
                type: isNextRound ? "next_round_nudge" : "nudge",
                title: isNextRound ? `🔥 ${roundNum}. Raund Çağrısı! (İlk Sıra Sende)` : "⏰ Düello Hatırlatması!",
                message: isNextRound
                  ? `${fromName} #${roomCode} odasında ${roundNum}. Raunda geçmen için sana bildirim gönderdi! İlk sıra sende, hemen başlat!`
                  : `${fromName} seni #${roomCode} kodlu düelloda bekliyor! Hadi 5 soruyu tahmin et!`,
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
        return res.status(200).json({ ok: true, toCode });
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

      // 4B. AKSİYON: Player 2'nin Tahmin Slaytını İzleme Durumunu Canlı Bildirme (set_slide_watch_status)
      // Player 2 "Tahminleri Kontrol Et" butonuna bastığında Player 1'in rapor ekranında animasyonlu "X tahminlerini izliyor..." yazar, bitince otomatik kaybolur!
      if (body.action === "set_slide_watch_status") {
        const code = String(body.code || "").trim().toUpperCase();
        const watching = Boolean(body.watching);
        const watched = Boolean(body.watched);
        const watcherName = String(body.watcherName || "").trim();
        const watcherCode = String(body.watcherCode || "").trim().toUpperCase();

        if (!code) {
          return res.status(400).json({ error: "Oda kodu gerekli." });
        }

        const updatedRoom = await putJsonToCloudPath(
          `rooms/${code}.json`,
          (existing) => {
            if (!existing) return null;
            existing.p2WatchingSlides = watching;
            if (watched || !watching) {
              existing.p2WatchedSlides = watched || Boolean(existing.p2WatchedSlides);
            }
            if (watcherName) {
              existing.p2WatchingBy = watcherName;
            }
            if (watcherCode) {
              existing.p2WatchingByCode = watcherCode;
            }
            existing.slideStatusUpdatedAt = Date.now();
            existing.updatedAt = new Date().toISOString();
            return existing;
          },
          `Slide watch status (${watching ? "watching" : "finished"}) in ${code}`
        );

        return res.status(200).json({ ok: true, room: updatedRoom });
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
        const qIds = Array.isArray(body.qIds) && body.qIds.length > 0 ? body.qIds : [1, 2, 3, 4, 5];
        const liveSettings = body.liveSettings || {};

        const updatedRoom = await putJsonToCloudPath(
          `rooms/${code}.json`,
          (existing) => {
            if (!existing) return null;
            normalizeSingleHostInRoom(existing);

            // Maç zaten sürüyorsa (çift tıklama veya iki oyuncunun aynı anda Yeni Raund'a basması) mevcut raundu koru!
            if (existing.status === "live_in_progress" && existing.liveMatchState && !body.forceRestart) {
              return existing;
            }

            const currentHostCode = String(existing.hostCode || existing.p1FriendCode || "").toUpperCase();
            const isRoundTransition = existing.status === "completed";
            const isRoomParticipant =
              (callerCode && currentHostCode === callerCode) ||
              (callerCode && String(existing.p2FriendCode || "").toUpperCase() === callerCode) ||
              (Array.isArray(existing.participants) &&
                existing.participants.some((p) => String(p.code || "").toUpperCase() === callerCode));

            if (!isRoundTransition) {
              if (currentHostCode && callerCode && currentHostCode !== callerCode) {
                return existing;
              }
            } else if (callerCode && !isRoomParticipant) {
              return existing;
            }

            if (body.arenaFormat) existing.arenaFormat = body.arenaFormat;
            if (body.cat) existing.cat = body.cat;
            existing.liveSettings = { ...(existing.liveSettings || {}), ...liveSettings };

            // v0.11: Biten canlı maçtan sonra "Yeni Raund" = aynı oda, raund +1, tüm kurallar korunur, sırayı önceki raundun 2. oyuncusu başlatır!
            const prevOrder =
              isRoundTransition && existing.liveMatchState && Array.isArray(existing.liveMatchState.turnOrder)
                ? existing.liveMatchState.turnOrder
                : null;
            existing.currentRound = prevOrder ? (Number(existing.currentRound) || 1) + 1 : Number(existing.currentRound) || 1;
            existing.liveLeaderboard = null;
            existing.p1Answers = [];
            existing.p2Guesses = [];
            existing.p1Comments = [];
            existing.p2Comments = [];

            const participants =
              Array.isArray(existing.participants) && existing.participants.length > 0
                ? existing.participants
                : [{ name: existing.p1 || "Oyuncu 1", code: existing.p1FriendCode || callerCode, team: "common" }];

            let turnOrder = [];
            if (prevOrder && prevOrder.length > 0) {
              const rotatedPrev = prevOrder.length > 1 ? [...prevOrder.slice(1), prevOrder[0]] : [...prevOrder];
              const activeMap = new Map(
                participants.map((p) => [String(p.code || "").toUpperCase(), p])
              );
              rotatedPrev.forEach((po) => {
                const cUpper = String(po.code || "").toUpperCase();
                const liveP = activeMap.get(cUpper);
                if (liveP || activeMap.size === 0) {
                  turnOrder.push({
                    code: cUpper,
                    name: (liveP && liveP.name) || po.name || "Oyuncu",
                    team: (liveP && liveP.team) || po.team || "common"
                  });
                  activeMap.delete(cUpper);
                }
              });
              activeMap.forEach((p, cUpper) => {
                turnOrder.push({
                  code: cUpper,
                  name: p.name || "Oyuncu",
                  team: p.team || "common"
                });
              });
            }

            if (turnOrder.length === 0) {
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
              for (let i = 0; i < participants.length; i++) {
                const p = participants[(starterIdx + i) % participants.length];
                turnOrder.push({
                  code: String(p.code || "").toUpperCase(),
                  name: p.name || `Oyuncu ${i + 1}`,
                  team: p.team || "common"
                });
              }
            }

            const turnStep = Math.max(1, Number(existing.liveSettings.turnStep) || 1);
            const { answerer, guesser } = computeActiveAnswererAndGuesser(
              turnOrder,
              0,
              existing.arenaFormat,
              existing.liveSettings
            );

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
            existing.usedQuestionIds = Array.from(new Set([...(existing.usedQuestionIds || []), ...qIds]));
            existing.status = "live_in_progress";
            existing.liveMatchState = {
              qIds,
              qIndex: 0,
              currentQIndex: 0,
              turnStep,
              stepProgressInTurn: 0,
              turnOrder,
              activeTurnOrderIdx: 0,
              activeAnswererCode: answerer.code,
              activeAnswererName: answerer.name,
              activeGuesserCode: guesser.code,
              activeGuesserName: guesser.name,
              subPhase: "answering", // 'answering' -> 'guessing' -> 'reveal'
              currentAnswer: null,
              currentAnswerComment: { emoji: "", text: "" },
              currentCustomOption: "",
              currentGuess: null,
              currentGuessComment: { emoji: "", text: "" },
              guessesByPlayer: {},
              history: [],
              scores: scoresByPlayer,
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
        const stepAction = body.subAction || body.stepAction || body.subPhase;
        const choiceIdx =
          body.choiceIndex !== undefined
            ? Number(body.choiceIndex)
            : body.answerIndex !== undefined
            ? Number(body.answerIndex)
            : Number(body.guessIndex);
        const commentObj =
          body.comment && typeof body.comment === "object"
            ? {
                emoji: String(body.comment.emoji || "").trim(),
                text: String(body.comment.text || "").trim()
              }
            : { emoji: "", text: String(body.comment || "").trim() };

        const updatedRoom = await putJsonToCloudPath(
          `rooms/${code}.json`,
          (existing) => {
            if (!existing || !existing.liveMatchState) return existing;
            const lms = existing.liveMatchState;
            const turnOrder =
              Array.isArray(lms.turnOrder) && lms.turnOrder.length > 0
                ? lms.turnOrder
                : (existing.participants || []).map((p) => ({
                    code: p.code,
                    name: p.name,
                    team: p.team || "common"
                  }));

            if (stepAction === "lock_answer") {
              // v0.11 SIRA KORUMASI: Sadece 'answering' aşamasında ve SADECE aktif cevaplayan kilitleyebilir
              if (lms.subPhase !== "answering") return existing;
              if (
                lms.activeAnswererCode &&
                playerCode &&
                String(lms.activeAnswererCode).toUpperCase() !== playerCode
              ) {
                return existing;
              }
              lms.currentAnswer = choiceIdx;
              lms.currentAnswerComment = commentObj;
              lms.currentCustomOption =
                body.customOption && typeof body.customOption === "object"
                  ? {
                      text: String(body.customOption.text || "").trim(),
                      slot: Math.min(3, Math.max(0, Number(body.customOption.slot) || 0))
                    }
                  : String(body.customOption || "").trim();
              lms.currentGuess = null;
              lms.currentGuessComment = { emoji: "", text: "" };
              lms.guessesByPlayer = {};
              lms.subPhase = turnOrder.length <= 1 ? "reveal" : "guessing";
              lms.phaseStartedAt = Date.now();
              lms.updatedAt = Date.now();
            } else if (stepAction === "lock_guess") {
              // v0.11 SIRA KORUMASI: Sadece 'guessing' aşamasında; cevaplayan kendi cevabını tahmin edemez;
              // FFA dışındaki modlarda SADECE belirlenen tahminci (activeGuesserCode) tahmin edebilir.
              if (lms.subPhase !== "guessing") return existing;
              const fmtGuard = String(existing.arenaFormat || "1v1").toLowerCase();
              const answererUpper = String(lms.activeAnswererCode || "").toUpperCase();
              const guesserUpper = String(lms.activeGuesserCode || "").toUpperCase();
              if (playerCode && answererUpper && playerCode === answererUpper) return existing;
              if (fmtGuard !== "ffa" && guesserUpper && playerCode && playerCode !== guesserUpper) return existing;
              if (!lms.guessesByPlayer) lms.guessesByPlayer = {};
              const pKey = playerCode || playerName;
              if (lms.guessesByPlayer[pKey]) return existing;
              const isCorrect =
                lms.currentAnswer === -1 || choiceIdx === Number(lms.currentAnswer);

              lms.currentGuess = choiceIdx;
              lms.currentGuessComment = commentObj;

              if (!lms.guessesByPlayer[pKey]) {
                lms.guessesByPlayer[pKey] = {
                  code: playerCode,
                  name: playerName,
                  guessIndex: choiceIdx,
                  comment: commentObj,
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
                lms.scores = lms.scoresByPlayer;
              }

              // 1v1 ve Takımlı Modlarda aktif tahminci (activeGuesserCode) kilitlediğinde anında 'reveal' aşamasına geçer!
              // FFA (Herkes Tek) modunda ise odadaki diğer tüm tahminciler kilitlediğinde (veya tek tahminci varsa anında) 'reveal' aşamasına geçer!
              const fmt = String(existing.arenaFormat || "1v1").toLowerCase();
              const isDesignatedGuesserMatch =
                fmt !== "ffa" &&
                lms.activeGuesserCode &&
                String(lms.activeGuesserCode).toUpperCase() === playerCode;

              const expectedGuessers = turnOrder.filter(
                (p) =>
                  String(p.code || p.name).toUpperCase() !==
                  String(lms.activeAnswererCode || lms.activeAnswererName).toUpperCase()
              );
              const submittedKeys = Object.keys(lms.guessesByPlayer).map((k) => k.toUpperCase());
              const allGuessed =
                isDesignatedGuesserMatch ||
                expectedGuessers.length <= 1 ||
                expectedGuessers.every(
                  (g) =>
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
              // v0.11: Yavaş cihazdan gelen eski "Sonraki Soru" tıklaması bir soruyu atlatamaz
              if (
                body.expectedQIndex !== undefined &&
                body.expectedQIndex !== null &&
                Number(body.expectedQIndex) !== (Number(lms.qIndex ?? lms.currentQIndex) || 0)
              ) {
                return existing;
              }

              if (!Array.isArray(lms.history)) lms.history = [];
              const curQ = Number(lms.qIndex ?? lms.currentQIndex) || 0;
              const qId = Array.isArray(lms.qIds) ? lms.qIds[curQ] : curQ + 1;
              const revCorrect =
                lms.currentAnswer === -1 || lms.currentAnswer === lms.currentGuess;

              lms.history.push({
                qIndex: curQ,
                qId,
                answererCode: lms.activeAnswererCode,
                answererName: lms.activeAnswererName,
                guesserCode: lms.activeGuesserCode,
                guesserName: lms.activeGuesserName,
                answerIdx: lms.currentAnswer,
                guessIdx: lms.currentGuess,
                answerIndex: lms.currentAnswer,
                answerComment: lms.currentAnswerComment,
                guessComment: lms.currentGuessComment,
                isCorrect: revCorrect,
                customOption: lms.currentCustomOption,
                guessesByPlayer: { ...(lms.guessesByPlayer || {}) }
              });

              const nextQIndex = curQ + 1;
              const totalQs = Array.isArray(lms.qIds) ? lms.qIds.length : 5;

              if (nextQIndex >= totalQs) {
                existing.status = "completed";
                lms.subPhase = "completed";
                lms.scores = lms.scoresByPlayer || lms.scores || {};
                const scoreArr = Object.values(lms.scores);
                scoreArr.sort((a, b) => (b.points || 0) - (a.points || 0));
                existing.liveLeaderboard = scoreArr;
                const totalC = scoreArr.reduce((acc, s) => acc + (s.correct || 0), 0);
                const totalT = scoreArr.reduce((acc, s) => acc + (s.total || 0), 0);
                existing.lastMatchPercentage = totalT > 0 ? Math.round((totalC / totalT) * 100) : 80;
                existing.lastCorrectCount = totalC;
                existing.lastTotalQuestions = totalT;
                existing.p1Answers = lms.history.map((h) => h.answerIdx);
                existing.p2Guesses = lms.history.map((h) => h.guessIdx);
                existing.p1Comments = lms.history.map((h) => h.answerComment || { emoji: "", text: "" });
                existing.p2Comments = lms.history.map((h) => h.guessComment || { emoji: "", text: "" });
              } else {
                lms.qIndex = nextQIndex;
                lms.currentQIndex = nextQIndex;
                const turnStep = Math.max(1, Number(lms.turnStep) || 1);
                let nextStepInTurn = (Number(lms.stepProgressInTurn) || 0) + 1;
                let nextOrderIdx = Number(lms.activeTurnOrderIdx) || 0;

                // turnStep kadar soru çözüldüğünde sıra diğer oyuncuya geçer! (1'er 1'er modunda her soruda sıra değişir!)
                if (nextStepInTurn >= turnStep) {
                  nextStepInTurn = 0;
                  nextOrderIdx = (nextOrderIdx + 1) % Math.max(1, turnOrder.length);
                }

                const { answerer, guesser } = computeActiveAnswererAndGuesser(
                  turnOrder,
                  nextOrderIdx,
                  existing.arenaFormat,
                  existing.liveSettings
                );

                lms.stepProgressInTurn = nextStepInTurn;
                lms.activeTurnOrderIdx = nextOrderIdx;
                lms.activeAnswererCode = answerer.code;
                lms.activeAnswererName = answerer.name;
                lms.activeGuesserCode = guesser.code;
                lms.activeGuesserName = guesser.name;
                lms.subPhase = "answering";
                lms.currentAnswer = null;
                lms.currentAnswerComment = { emoji: "", text: "" };
                lms.currentCustomOption = "";
                lms.currentGuess = null;
                lms.currentGuessComment = { emoji: "", text: "" };
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

      // 9D. AKSİYON: Misafir Üyeliğini Şifreyle Koru, Sosyal Giriş Şifre Doğrulama & Admin Paneli (/ceo)
      if (body.action === "set_guest_password") {
        const friendCode = String(body.friendCode || "").trim().toUpperCase();
        const username = String(body.username || "").trim();
        const password = String(body.password || "").trim();

        if (!/^SNC-\d{4}$/.test(friendCode) || !username || username.length < 2 || password.length < 3) {
          const msg = "Geçerli bir oyuncu adı (en az 2 harf) ve en az 3 karakterli şifre girin.";
          return res.status(400).json({ error: msg, message: msg });
        }

        const encodedPass = Buffer.from(password, "utf-8").toString("base64");

        // Başka bir SNC kodu bu ismi gerçekten şifreyle korumuş mu kontrol et
        const lb = await getJsonFromCloudPath("leaderboard/global.json");
        const existingOwner = (lb?.data?.players || []).find(
          (p) =>
            p.friendCode !== friendCode &&
            p.passwordProtected &&
            String(p.username || "").trim().toLowerCase() === username.toLowerCase()
        );
        if (existingOwner) {
          const ownerFile = await getJsonFromCloudPath(`friends/${existingOwner.friendCode}.json`);
          const ownerRec = ownerFile?.data;
          if (ownerRec && ownerRec.passwordProtected && ownerRec.passwordHash) {
            if (ownerRec.passwordHash === encodedPass) {
              const safeOwner = { ...ownerRec };
              delete safeOwner.passwordHash;
              delete safeOwner.rawPassword;
              return res.status(200).json({
                ok: true,
                restoredExisting: true,
                friend: safeOwner
              });
            }
            const conflictMsg = `"${username}" ismi başka bir oyuncu (${existingOwner.friendCode}) tarafından şifreyle korunmaktadır! Eğer bu hesap seninse "Üyeliğin var mı? Giriş Yap" bölümünden şifrenle giriş yapabilirsin.`;
            return res.status(409).json({
              error: conflictMsg,
              message: conflictMsg
            });
          }
        }

        const incomingProfile = body.profile && typeof body.profile === "object" ? body.profile : {};
        const updatedFriend = await putJsonToCloudPath(
          `friends/${friendCode}.json`,
          (existing) => {
            const rec = Object.assign(createDefaultFriendRecord(friendCode, username), existing || {});
            rec.username = username;
            rec.passwordProtected = true;
            rec.isPasswordProtected = true;
            rec.passwordHash = encodedPass;
            rec.rawPassword = password;
            rec.xp = Math.max(Number(rec.xp) || 0, Number(incomingProfile.xp) || 0);
            rec.level = Math.max(1, Math.floor(rec.xp / 100) + 1);
            rec.gamesPlayed = Math.max(Number(rec.gamesPlayed) || 0, Number(incomingProfile.gamesPlayed) || 0);
            rec.questionsCorrect = Math.max(
              Number(rec.questionsCorrect) || 0,
              Number(incomingProfile.questionsCorrect) || 0
            );
            rec.updatedAt = new Date().toISOString();
            return rec;
          },
          `Set guest password for ${friendCode}`
        );

        await upsertGlobalLeaderboardEntry({
          ...updatedFriend,
          passwordProtected: true,
          isPasswordProtected: true
        });

        const safeFriend = { ...updatedFriend };
        delete safeFriend.passwordHash;
        delete safeFriend.rawPassword;
        return res.status(200).json({ ok: true, friend: safeFriend });
      }

      // v0.15 (#6): Google / Facebook / iCloud Şifre Doğrulamalı Giriş (social_oauth_login)
      if (body.action === "social_oauth_login") {
        const provider = String(body.provider || "Google").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const username = String(body.username || "").trim();
        const password = String(body.password || "").trim();
        const rawFriendCode = String(body.friendCode || "").trim().toUpperCase();

        if (!email || !email.includes("@")) {
          return res.status(400).json({ error: "Lütfen geçerli bir e-posta adresi girin." });
        }
        if (!password || password.length < 4) {
          return res.status(400).json({ error: "Şifresiz giriş yapılamaz! En az 4 karakterli şifrenizi girin." });
        }
        if (!username || username.length < 2) {
          return res.status(400).json({ error: "Lütfen en az 2 harfli bir oyuncu adı girin." });
        }

        const encodedPass = Buffer.from(password, "utf-8").toString("base64");
        const lb = await getJsonFromCloudPath("leaderboard/global.json");
        const playersList = lb?.data?.players || [];

        // Bu e-posta veya kullanıcı adına sahip mevcut şifreli hesap var mı kontrol et
        const existingMatch = playersList.find(
          (p) =>
            (p.email && String(p.email).trim().toLowerCase() === email) ||
            (p.passwordProtected && String(p.username || "").trim().toLowerCase() === username.toLowerCase())
        );

        let targetCode = /^SNC-\d{4}$/.test(rawFriendCode)
          ? rawFriendCode
          : `SNC-${Math.floor(1000 + Math.random() * 9000)}`;

        if (existingMatch && existingMatch.friendCode) {
          const ownerFile = await getJsonFromCloudPath(`friends/${existingMatch.friendCode}.json`);
          const ownerRec = ownerFile?.data;
          if (ownerRec && ownerRec.passwordHash && ownerRec.passwordHash !== encodedPass) {
            return res.status(401).json({
              error: `Bu hesap (${existingMatch.username}) şifre korumalıdır ve girdiğiniz şifre hatalı!`
            });
          }
          targetCode = existingMatch.friendCode;
        }

        const incomingProfile = body.profile && typeof body.profile === "object" ? body.profile : {};
        const updatedFriend = await putJsonToCloudPath(
          `friends/${targetCode}.json`,
          (existing) => {
            const rec = Object.assign(createDefaultFriendRecord(targetCode, username), existing || {});
            rec.username = username;
            rec.email = email;
            rec.provider = provider;
            rec.isPermanentMember = true;
            rec.passwordProtected = true;
            rec.isPasswordProtected = true;
            rec.passwordHash = encodedPass;
            rec.rawPassword = password;
            rec.xp = Math.max(Number(rec.xp) || 0, Number(incomingProfile.xp) || 0);
            rec.level = Math.max(1, Math.floor(rec.xp / 100) + 1);
            rec.gamesPlayed = Math.max(Number(rec.gamesPlayed) || 0, Number(incomingProfile.gamesPlayed) || 0);
            rec.questionsCorrect = Math.max(
              Number(rec.questionsCorrect) || 0,
              Number(incomingProfile.questionsCorrect) || 0
            );
            rec.updatedAt = new Date().toISOString();
            return rec;
          },
          `OAuth login for ${targetCode} (${email})`
        );

        await upsertGlobalLeaderboardEntry({
          ...updatedFriend,
          email,
          provider,
          isPermanentMember: true,
          passwordProtected: true,
          isPasswordProtected: true
        });

        const safeFriend = { ...updatedFriend };
        delete safeFriend.passwordHash;
        delete safeFriend.rawPassword;
        return res.status(200).json({ ok: true, friend: safeFriend });
      }

      if (body.action === "login_guest_password" || body.action === "login_guest_account") {
        const identifier = String(body.identifier || body.friendCode || body.username || "").trim();
        const fallbackUsername = String(body.username || "").trim();
        const password = String(body.password || "").trim();
        const encodedPass = Buffer.from(password, "utf-8").toString("base64");

        let targetCode = "";
        if (/^SNC-\d{4}$/i.test(identifier)) {
          targetCode = identifier.toUpperCase();
        } else {
          const searchName = (identifier || fallbackUsername).toLowerCase();
          const lb = await getJsonFromCloudPath("leaderboard/global.json");
          const playersList = lb?.data?.players || [];
          const protectedMatch = playersList.find(
            (p) =>
              p.passwordProtected &&
              (String(p.username || "").trim().toLowerCase() === searchName ||
                (p.email && String(p.email).trim().toLowerCase() === searchName))
          );
          const anyMatch = playersList.find(
            (p) =>
              String(p.username || "").trim().toLowerCase() === searchName ||
              (p.email && String(p.email).trim().toLowerCase() === searchName)
          );
          const match = protectedMatch || anyMatch;
          if (match) targetCode = match.friendCode;
        }

        if (!targetCode) {
          const msg = "Bu isim, e-posta veya arkadaş koduna ait şifreli hesap bulunamadı.";
          return res.status(404).json({ error: msg, message: msg });
        }

        const fFound = await getJsonFromCloudPath(`friends/${targetCode}.json`);
        if (!fFound || !fFound.data || !fFound.data.passwordProtected) {
          const msg = "Bu hesapta henüz şifre koruması bulunmuyor.";
          return res.status(404).json({ error: msg, message: msg });
        }

        if (fFound.data.passwordHash !== encodedPass && fFound.data.rawPassword !== password) {
          const msg = "Girdiğiniz şifre hatalı!";
          return res.status(401).json({ error: msg, message: msg });
        }

        const safeFriend = { ...fFound.data };
        delete safeFriend.passwordHash;
        delete safeFriend.rawPassword;
        return res.status(200).json({ ok: true, friend: safeFriend, account: safeFriend });
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

      // v0.14 (#2): Hesabı Kalıcı Olarak Silme (delete_user_account)
      if (body.action === "delete_user_account") {
        const friendCode = String(body.friendCode || "").trim().toUpperCase();
        const username = String(body.username || "").trim().toLowerCase();

        if (/^SNC-\d{4}$/.test(friendCode)) {
          try {
            await putJsonToCloudPath(
              `friends/${friendCode}.json`,
              () => ({
                ...createDefaultFriendRecord(friendCode, "Misafir Oyuncu"),
                deletedAccountAt: new Date().toISOString(),
                passwordProtected: false,
                isPasswordProtected: false,
                passwordHash: "",
                rawPassword: ""
              }),
              `Delete user account ${friendCode}`
            );
          } catch (e) {}
        }

        try {
          await putJsonToCloudPath(
            "leaderboard/global.json",
            (existing) => {
              const list = Array.isArray(existing?.players) ? existing.players : [];
              const filtered = list.filter((p) => {
                if (!p) return false;
                if (friendCode && String(p.friendCode || "").toUpperCase() === friendCode) return false;
                if (username && String(p.username || "").trim().toLowerCase() === username && !p.isSampleShowcase) {
                  return false;
                }
                return true;
              });
              return {
                updatedAt: new Date().toISOString(),
                players: filtered
              };
            },
            `Remove deleted user ${friendCode || username} from leaderboard`
          );
        } catch (e) {}

        return res.status(200).json({ ok: true, deletedCode: friendCode });
      }

      // v0.15 (#9): /ceo ADMİNLİK & OYUNCU / DÜELLO YÖNETİM PANELİ API UÇLARI
      if (typeof body.action === "string" && body.action.startsWith("admin_")) {
        const adminPass = String(body.adminPassword || "").trim();
        const validPasswords = ["senceoceo2026", "senceomdasenceom", process.env.ADMIN_CEO_PASSWORD].filter(Boolean);
        if (!validPasswords.includes(adminPass)) {
          return res.status(401).json({ error: "Yetkisiz erişim! Admin şifresi hatalı." });
        }

        if (body.action === "admin_login") {
          return res.status(200).json({ ok: true, role: "CEO_ADMIN" });
        }

        if (body.action === "admin_get_overview") {
          const lb = await getJsonFromCloudPath("leaderboard/global.json");
          const lbPlayers = Array.isArray(lb?.data?.players) ? lb.data.players : [];

          let friendFiles = [];
          let roomFiles = [];
          if (GH_TOKEN) {
            try {
              const fRes = await fetch(
                `https://api.github.com/repos/${GH_REPO}/contents/friends?ref=${GH_BRANCH}&t=${Date.now()}`,
                {
                  headers: {
                    Authorization: `token ${GH_TOKEN}`,
                    Accept: "application/vnd.github.v3+json",
                    "User-Agent": "senceo-cloud-db"
                  }
                }
              );
              if (fRes.ok) {
                const fArr = await fRes.json();
                if (Array.isArray(fArr)) {
                  friendFiles = fArr.filter((x) => x && x.name && x.name.endsWith(".json")).slice(0, 60);
                }
              }
            } catch (e) {}

            try {
              const rRes = await fetch(
                `https://api.github.com/repos/${GH_REPO}/contents/rooms?ref=${GH_BRANCH}&t=${Date.now()}`,
                {
                  headers: {
                    Authorization: `token ${GH_TOKEN}`,
                    Accept: "application/vnd.github.v3+json",
                    "User-Agent": "senceo-cloud-db"
                  }
                }
              );
              if (rRes.ok) {
                const rArr = await rRes.json();
                if (Array.isArray(rArr)) {
                  roomFiles = rArr.filter((x) => x && x.name && x.name.endsWith(".json")).slice(0, 60);
                }
              }
            } catch (e) {}
          }

          const playersMap = new Map();
          lbPlayers.forEach((p) => {
            if (!p || !p.friendCode) return;
            playersMap.set(p.friendCode.toUpperCase(), {
              ...p,
              rawPassword: p.rawPassword || "",
              activeRooms: [],
              acceptedFriends: []
            });
          });

          const friendDetails = await Promise.all(
            friendFiles.map((f) => getJsonFromCloudPath(`friends/${f.name}`).catch(() => null))
          );
          friendDetails.forEach((found) => {
            if (!found || !found.data || !found.data.friendCode) return;
            const d = found.data;
            if (d.deletedAccountAt && d.username === "Misafir Oyuncu") return;
            const code = String(d.friendCode).toUpperCase();
            let decodedPass = d.rawPassword || "";
            if (!decodedPass && d.passwordHash) {
              try {
                decodedPass = Buffer.from(d.passwordHash, "base64").toString("utf-8");
              } catch (e) {}
            }
            const prev = playersMap.get(code) || {};
            playersMap.set(code, {
              ...prev,
              ...d,
              friendCode: code,
              rawPassword: decodedPass,
              level: Math.max(1, Number(d.level) || Number(prev.level) || 1),
              xp: Math.max(Number(d.xp) || 0, Number(prev.xp) || 0),
              gamesPlayed: Math.max(Number(d.gamesPlayed) || 0, Number(prev.gamesPlayed) || 0),
              questionsCorrect: Math.max(Number(d.questionsCorrect) || 0, Number(prev.questionsCorrect) || 0)
            });
          });

          const roomDetails = await Promise.all(
            roomFiles.map((rf) => getJsonFromCloudPath(`rooms/${rf.name}`).catch(() => null))
          );
          const allRooms = roomDetails
            .map((r) => (r && r.data ? r.data : null))
            .filter(Boolean)
            .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

          const allPlayers = Array.from(playersMap.values()).sort((a, b) => (Number(b.xp) || 0) - (Number(a.xp) || 0));

          return res.status(200).json({
            ok: true,
            players: allPlayers,
            rooms: allRooms
          });
        }

        if (body.action === "admin_update_player" || body.action === "admin_create_player") {
          const friendCode = String(body.friendCode || "").trim().toUpperCase();
          const username = String(body.username || "Oyuncu").trim();
          const rawPassword = String(body.rawPassword || "").trim();
          const email = String(body.email || "").trim();
          const provider = String(body.provider || "guest").trim();
          const xp = Math.max(0, Number(body.xp) || 0);
          const level = Math.max(1, Number(body.level) || Math.floor(xp / 100) + 1);
          const gamesPlayed = Math.max(0, Number(body.gamesPlayed) || 0);
          const questionsCorrect = Math.max(0, Number(body.questionsCorrect) || 0);

          if (!/^SNC-\d{4}$/.test(friendCode)) {
            return res.status(400).json({ error: "Geçersiz SNC-XXXX arkadaş kodu." });
          }

          const hasPass = Boolean(rawPassword);
          const encodedPass = hasPass ? Buffer.from(rawPassword, "utf-8").toString("base64") : "";

          const updatedRec = await putJsonToCloudPath(
            `friends/${friendCode}.json`,
            (existing) => {
              const rec = Object.assign(createDefaultFriendRecord(friendCode, username), existing || {});
              rec.username = username;
              rec.email = email;
              rec.provider = provider;
              rec.xp = xp;
              rec.level = level;
              rec.gamesPlayed = gamesPlayed;
              rec.questionsCorrect = questionsCorrect;
              rec.passwordProtected = hasPass;
              rec.isPasswordProtected = hasPass;
              rec.passwordHash = encodedPass;
              rec.rawPassword = rawPassword;
              rec.lastXpActivityAt = Date.now();
              rec.updatedAt = new Date().toISOString();
              return rec;
            },
            `Admin update player ${friendCode}`
          );

          await putJsonToCloudPath(
            "leaderboard/global.json",
            (existing) => {
              const list = Array.isArray(existing?.players) ? existing.players : [];
              const idx = list.findIndex((p) => p && String(p.friendCode || "").toUpperCase() === friendCode);
              const entry = {
                ...(idx >= 0 ? list[idx] : {}),
                friendCode,
                username,
                email,
                provider,
                xp,
                level,
                gamesPlayed,
                questionsCorrect,
                passwordProtected: hasPass,
                isPasswordProtected: hasPass,
                lastXpActivityAt: Date.now(),
                updatedAt: new Date().toISOString()
              };
              if (idx >= 0) list[idx] = entry;
              else list.push(entry);
              list.sort((a, b) => (Number(b.xp) || 0) - (Number(a.xp) || 0));
              return { updatedAt: new Date().toISOString(), players: list };
            },
            `Admin sync leaderboard for ${friendCode}`
          );

          return res.status(200).json({ ok: true, player: updatedRec });
        }

        if (body.action === "admin_delete_player") {
          const friendCode = String(body.friendCode || "").trim().toUpperCase();
          if (/^SNC-\d{4}$/.test(friendCode)) {
            await putJsonToCloudPath(
              `friends/${friendCode}.json`,
              () => ({
                ...createDefaultFriendRecord(friendCode, "Misafir Oyuncu"),
                deletedAccountAt: new Date().toISOString(),
                passwordProtected: false,
                isPasswordProtected: false,
                passwordHash: "",
                rawPassword: ""
              }),
              `Admin delete player ${friendCode}`
            );
          }
          await putJsonToCloudPath(
            "leaderboard/global.json",
            (existing) => {
              const list = Array.isArray(existing?.players) ? existing.players : [];
              return {
                updatedAt: new Date().toISOString(),
                players: list.filter((p) => p && String(p.friendCode || "").toUpperCase() !== friendCode)
              };
            },
            `Admin remove ${friendCode} from leaderboard`
          );
          return res.status(200).json({ ok: true, deletedCode: friendCode });
        }

        if (body.action === "admin_delete_room") {
          const roomCode = String(body.roomCode || "").trim().toUpperCase();
          if (roomCode) {
            await putJsonToCloudPath(
              `rooms/${roomCode}.json`,
              (existing) => ({
                ...(existing || { code: roomCode }),
                status: "opponent_fled",
                deletedByAdminAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }),
              `Admin close/delete room ${roomCode}`
            );
          }
          return res.status(200).json({ ok: true, roomCode });
        }
      }

      // v0.14 (#15): "⚔️ Acil Rövanş / Canlı Odaya Çek" Anlık Canlı Oda Daveti (send_instant_live_invite)
      if (body.action === "send_instant_live_invite") {
        const fromCode = String(body.fromCode || "").trim().toUpperCase();
        const fromName = String(body.fromName || "Arkadaşın").trim();
        const toCode = String(body.toCode || "").trim().toUpperCase();
        const roomCode = String(body.roomCode || "").trim().toUpperCase();

        if (!/^SNC-\d{4}$/.test(toCode) || !roomCode) {
          return res.status(400).json({ error: "Geçersiz arkadaş kodu veya oda kodu." });
        }

        let liveRoom = null;
        try {
          const found = await getRoomFromCloud(roomCode);
          if (found) liveRoom = found.room;
        } catch (e) {}

        const updatedTarget = await putJsonToCloudPath(
          `friends/${toCode}.json`,
          (existing) => {
            const rec = Object.assign(createDefaultFriendRecord(toCode, "Oyuncu"), existing || {});
            if (liveRoom) {
              upsertActiveRoomInFriendRecord(rec, liveRoom);
            }
            pushNotification(rec, {
              id: `LIVE_PULL_${roomCode}_${Date.now()}`,
              type: "instant_live_invite",
              title: `⚔️ ${fromName} Seni Canlı Odaya Çekiyor!`,
              message: `${fromName} (#${roomCode}) canlı düello masasını kurdu ve şu an lobide seni bekliyor!`,
              fromCode,
              fromName,
              roomCode
            });
            rec.updatedAt = new Date().toISOString();
            return rec;
          },
          `Instant live room invite ${fromCode} -> ${toCode} (#${roomCode})`
        );

        return res.status(200).json({ ok: true, targetFriend: updatedTarget });
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

          let shouldPropagateName = false;
          const cleanRealUsername =
            p.username && p.username !== "Misafir Oyuncu" && p.username !== "Oyuncu" ? String(p.username).trim() : "";

          try {
            syncedFriendRecord = await putJsonToCloudPath(
              `friends/${cleanFCode}.json`,
              (existing) => {
                const rec = Object.assign(createDefaultFriendRecord(cleanFCode, p.username), existing || {});
                if (cleanRealUsername) {
                  rec.username = cleanRealUsername;
                  if (rec.lastPropagatedName !== cleanRealUsername) {
                    shouldPropagateName = true;
                    rec.lastPropagatedName = cleanRealUsername;
                  }
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
                if (p.passwordProtected !== undefined || p.isPasswordProtected !== undefined) {
                  rec.passwordProtected = Boolean(p.passwordProtected || p.isPasswordProtected || rec.passwordProtected);
                  rec.isPasswordProtected = rec.passwordProtected;
                }
                rec.updatedAt = new Date().toISOString();
                return rec;
              },
              `Update friend profile ${cleanFCode}`
            );
          } catch (e) {}

          if (
            shouldPropagateName &&
            cleanRealUsername &&
            syncedFriendRecord &&
            Array.isArray(syncedFriendRecord.acceptedFriends) &&
            syncedFriendRecord.acceptedFriends.length > 0
          ) {
            for (const fItem of syncedFriendRecord.acceptedFriends.slice(0, 20)) {
              const targetFriendCode = String((fItem && fItem.code) || "").trim().toUpperCase();
              if (!/^SNC-\d{4}$/.test(targetFriendCode) || targetFriendCode === cleanFCode) continue;
              try {
                await putJsonToCloudPath(
                  `friends/${targetFriendCode}.json`,
                  (existing) => {
                    if (!existing || !Array.isArray(existing.acceptedFriends)) return existing;
                    const idx = existing.acceptedFriends.findIndex((x) => x && x.code === cleanFCode);
                    if (idx >= 0) {
                      existing.acceptedFriends[idx].name = cleanRealUsername;
                      existing.updatedAt = new Date().toISOString();
                    }
                    return existing;
                  },
                  `Propagate name ${cleanRealUsername} (${cleanFCode}) to ${targetFriendCode}`
                );
              } catch (e) {}
            }
          }

          await upsertGlobalLeaderboardEntry({
            ...p,
            passwordProtected: Boolean(
              p.passwordProtected || p.isPasswordProtected || syncedFriendRecord?.passwordProtected
            )
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
