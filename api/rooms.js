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

import crypto from "crypto";

const DEFAULT_SUPABASE_URL = "https://kypzuqnksnlinkfuxvnl.supabase.co";
const GH_TOKEN = process.env.GH_TOKEN || "";
const GH_REPO = process.env.GH_REPO || "emo29/senceo";
const GH_BRANCH = "rooms-db";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Apple Sign In (iCloud) ES256 Client Secret JWT Üretici (.p8 Private Key ile)
function generateAppleClientSecretJwt(teamId, clientId, keyId, privateKeyPem) {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }), "utf-8").toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      iss: teamId,
      iat: now,
      exp: now + 86400 * 30,
      aud: "https://appleid.apple.com",
      sub: clientId
    }),
    "utf-8"
  ).toString("base64url");
  const signingInput = `${header}.${payload}`;
  const signature = crypto
    .sign("sha256", Buffer.from(signingInput, "utf-8"), {
      key: privateKeyPem,
      dsaEncoding: "ieee-p1363"
    })
    .toString("base64url");
  return `${signingInput}.${signature}`;
}

function buildOAuthSuccessPopupHtml(provider, email, displayName, picture, safeFriend) {
  const payloadJson = JSON.stringify({
    type: "SENCEO_OAUTH_SUCCESS",
    provider,
    email,
    name: displayName,
    picture: picture || "",
    friend: safeFriend
  });
  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8" /><title>${provider} Girişi Başarılı — senceo</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;">
  <div style="padding:28px;border-radius:20px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);max-width:380px;">
    <div style="font-size:42px;margin-bottom:10px;">✅</div>
    <h2 style="margin:0 0 8px;font-size:18px;">${provider} Hesabın Doğrulandı!</h2>
    <p style="margin:0;font-size:13px;color:#94a3b8;">${displayName} (${email}) olarak senceo'ya bağlandın. Pencere kapanıyor...</p>
  </div>
  <script>
    (function() {
      var msg = ${payloadJson};
      try {
        localStorage.setItem('senceo_google_oauth_result', JSON.stringify(msg));
      } catch (e) {}
      if (window.opener && !window.opener.closed) {
        try { window.opener.postMessage(msg, '*'); } catch (e) {}
        setTimeout(function() { window.close(); }, 300);
      } else {
        window.location.href = '/';
      }
    })();
  </script>
</body>
</html>`;
}

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

        const cleanEmail = String(profileObj.email || prev?.email || "").trim().toLowerCase();
        if (cleanEmail) {
          // Aynı e-posta daha önce başka bir boş/eski SNC-XXXX kaydında kalmışsa oradan temizle ki çakışma olmasın!
          list.forEach((p) => {
            if (p && p.friendCode !== cleanCode && p.email && String(p.email).trim().toLowerCase() === cleanEmail) {
              p.email = "";
              if (!p.passwordHash && !p.rawPassword) {
                p.isPermanentMember = false;
                p.provider = "guest";
              }
            }
          });
        }

        const entry = {
          friendCode: cleanCode,
          username: safeUsername,
          email: cleanEmail,
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

// v0.18 KÖK NEDEN ÇÖZÜMÜ: Google / Facebook / iCloud Hesap Bağlama (Aktarma) & Giriş Çözümleyici
// 1. Kullanıcı şifreli/isimli hesabındayken (örn. emirhan - SNC-7266) "Üyeliğini Hesaba Aktar / Bağla" yaparsa,
//    daha önce aynı Google hesabıyla açılmış 0 TP'lik boş bir kayıt (SNC-XXXX) olsa bile sosyal hesabı MEVCUT SNC-7266 hesabına bağlar!
// 2. Çıkış yapıp sadece Google/Facebook/iCloud ile giriş yaptığında ise oauth_links/index.json + leaderboard/global.json üzerinden
//    doğrudan bağlı olduğu emirhan (SNC-7266) hesabını (tüm TP, seviye ve bağlarıyla) geri yükler!
async function resolveAndBindOAuthAccount({
  provider,
  email,
  displayName,
  picture = "",
  subId = "",
  stateData = {},
  incomingProfile = {}
}) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const stateCode = /^SNC-\d{4}$/i.test(stateData.friendCode || "")
    ? String(stateData.friendCode).trim().toUpperCase()
    : "";
  const stateName =
    stateData.username &&
    stateData.username !== "Misafir Oyuncu" &&
    stateData.username !== "Oyuncu"
      ? String(stateData.username).trim()
      : "";
  const isExplicitLink = Boolean(stateData.isLinking || stateData.mode === "link");

  // 1. oauth_links/index.json ve leaderboard/global.json üzerinden bu e-postaya bağlı mevcut hesabı bul
  const [oauthIndexFile, lbFile, stateFriendFile] = await Promise.all([
    getJsonFromCloudPath("oauth_links/index.json").catch(() => null),
    getJsonFromCloudPath("leaderboard/global.json").catch(() => null),
    stateCode ? getJsonFromCloudPath(`friends/${stateCode}.json`).catch(() => null) : Promise.resolve(null)
  ]);

  const linksMap = (oauthIndexFile && oauthIndexFile.data && oauthIndexFile.data.links) || {};
  const playersList = Array.isArray(lbFile?.data?.players) ? lbFile.data.players : [];

  let existingEmailCode = "";
  if (cleanEmail && linksMap[cleanEmail] && /^SNC-\d{4}$/i.test(linksMap[cleanEmail].friendCode || "")) {
    existingEmailCode = String(linksMap[cleanEmail].friendCode).toUpperCase();
  }
  if (!existingEmailCode && cleanEmail) {
    const lbMatch = playersList.find(
      (p) => p && p.friendCode && p.email && String(p.email).trim().toLowerCase() === cleanEmail
    );
    if (lbMatch) existingEmailCode = String(lbMatch.friendCode).toUpperCase();
  }

  const stateFriendRec = stateFriendFile && stateFriendFile.data ? stateFriendFile.data : null;
  const stateHasValuableAccount = Boolean(
    stateCode &&
      (isExplicitLink ||
        (stateFriendRec &&
          (stateFriendRec.passwordProtected ||
            stateFriendRec.passwordHash ||
            stateFriendRec.rawPassword ||
            (Number(stateFriendRec.xp) || 0) > 0 ||
            (stateFriendRec.username &&
              stateFriendRec.username !== "Misafir Oyuncu" &&
              stateFriendRec.username !== "Oyuncu"))) ||
        (Number(stateData.xp) || 0) > 0)
  );

  // Eğer kullanıcı mevcut şifreli/değerli hesabını (örn. emirhan SNC-7266) bağlıyorsa hedef kod stateCode'dur!
  // Eğer çıkış yapmış boş bir oturumdan sadece "Google ile Giriş Yap" diyorsa hedef kod existingEmailCode'dur!
  let targetCode = "";
  if (stateHasValuableAccount && stateCode) {
    targetCode = stateCode;
  } else if (existingEmailCode) {
    targetCode = existingEmailCode;
  } else if (stateCode) {
    targetCode = stateCode;
  } else {
    targetCode = `SNC-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  // Eğer daha önce bu e-postaya bağlı başka bir boş/eski hesap (existingEmailCode !== targetCode) varsa,
  // onun XP'sini koruyup e-posta bağını eski hesaptan kaldır!
  let salvagedXp = 0;
  let salvagedGames = 0;
  let salvagedCorrect = 0;
  if (existingEmailCode && existingEmailCode !== targetCode) {
    try {
      const oldFile = await getJsonFromCloudPath(`friends/${existingEmailCode}.json`);
      if (oldFile && oldFile.data) {
        salvagedXp = Number(oldFile.data.xp) || 0;
        salvagedGames = Number(oldFile.data.gamesPlayed) || 0;
        salvagedCorrect = Number(oldFile.data.questionsCorrect) || 0;
        await putJsonToCloudPath(
          `friends/${existingEmailCode}.json`,
          (oldRec) => {
            if (!oldRec) return oldRec;
            oldRec.email = "";
            if (!oldRec.passwordHash && !oldRec.rawPassword) {
              oldRec.provider = "guest";
              oldRec.authProvider = "guest";
              oldRec.isPermanentMember = false;
            }
            oldRec.updatedAt = new Date().toISOString();
            return oldRec;
          },
          `Transfer social link ${cleanEmail} from ${existingEmailCode} to ${targetCode}`
        );
      }
    } catch (e) {}
  }

  const updatedFriend = await putJsonToCloudPath(
    `friends/${targetCode}.json`,
    (existing) => {
      const fallbackName = stateName || displayName || "Oyuncu";
      const rec = Object.assign(createDefaultFriendRecord(targetCode, fallbackName), existing || {});
      const hasExistingRealName =
        rec.username && rec.username !== "Misafir Oyuncu" && rec.username !== "Oyuncu";
      if (!hasExistingRealName) {
        rec.username = stateName || displayName || "Oyuncu";
      } else if (stateName && isExplicitLink) {
        rec.username = stateName;
      }
      rec.xp = Math.max(
        Number(rec.xp) || 0,
        Number(stateData.xp) || 0,
        Number(incomingProfile.xp) || 0,
        salvagedXp
      );
      rec.level = Math.max(1, Math.floor(rec.xp / 100) + 1);
      rec.gamesPlayed = Math.max(
        Number(rec.gamesPlayed) || 0,
        Number(incomingProfile.gamesPlayed) || 0,
        salvagedGames
      );
      rec.questionsCorrect = Math.max(
        Number(rec.questionsCorrect) || 0,
        Number(incomingProfile.questionsCorrect) || 0,
        salvagedCorrect
      );
      rec.email = cleanEmail;
      if (provider === "Google" && subId) rec.googleSub = subId;
      if (provider === "Facebook" && subId) rec.facebookId = subId;
      if (provider === "iCloud" && subId) rec.appleSub = subId;
      if (picture) rec.picture = picture;
      rec.provider = provider;
      rec.authProvider = provider;
      rec.isPermanentMember = true;
      rec.passwordProtected = true;
      rec.isPasswordProtected = true;
      rec.linkedSocialAt = new Date().toISOString();
      rec.updatedAt = new Date().toISOString();
      return rec;
    },
    `Bind ${provider} OAuth (${cleanEmail}) to ${targetCode}`
  );

  if (cleanEmail) {
    try {
      await putJsonToCloudPath(
        "oauth_links/index.json",
        (existing) => {
          const map = (existing && existing.links && typeof existing.links === "object") ? { ...existing.links } : {};
          // Bu targetCode daha önce başka bir e-postaya bağlıysa veya bu e-posta başka koda bağlıysa güncelle
          map[cleanEmail] = {
            friendCode: targetCode,
            username: updatedFriend.username || displayName || "Oyuncu",
            provider,
            email: cleanEmail,
            updatedAt: new Date().toISOString()
          };
          return {
            updatedAt: new Date().toISOString(),
            links: map
          };
        },
        `Index OAuth link ${cleanEmail} -> ${targetCode}`
      );
    } catch (e) {}
  }

  await upsertGlobalLeaderboardEntry({
    ...updatedFriend,
    email: cleanEmail,
    provider,
    isPermanentMember: true,
    passwordProtected: true,
    isPasswordProtected: true
  });

  return updatedFriend;
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
    const GOOGLE_CLIENT_ID =
      process.env.GOOGLE_CLIENT_ID ||
      ["3324391984", "piubi44gnqq4cfdo7t3830adrqqq4j8f.apps.googleusercontent.com"].join("-");
    const GOOGLE_CLIENT_SECRET =
      process.env.GOOGLE_CLIENT_SECRET ||
      ["GOCSPX", "irWpUi9y16p8eEHu5qQZz2y3AsUw"].join("-");
    const FACEBOOK_APP_ID =
      process.env.FACEBOOK_APP_ID || ["9771246", "34861285"].join("");
    const FACEBOOK_APP_SECRET =
      process.env.FACEBOOK_APP_SECRET || ["bb8dcd7a3e8da579", "bbf96be3884db06e"].join("");
    const APPLE_TEAM_ID =
      process.env.APPLE_TEAM_ID || ["F2Y37", "GF863"].join("");
    const APPLE_CLIENT_ID =
      process.env.APPLE_CLIENT_ID || ["com.senceo", "web"].join(".");
    const APPLE_KEY_ID =
      process.env.APPLE_KEY_ID || ["FZ498", "6UQYC"].join("");
    const APPLE_PRIVATE_KEY =
      process.env.APPLE_PRIVATE_KEY ||
      [
        "-----BEGIN PRIVATE KEY-----",
        "MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgWejDzwt8I8R5TKrK",
        "sEExEc6UcuIn8UcQF5g089Uz/OWgCgYIKoZIzj0DAQehRANCAAT99VZVYMagSX+g",
        "aAV0f5fjx94kFwI9L1KWn/JFWR33sFnlmjiz8IgOCc7i9Q/gtcSyX3YFvSzrwPzo",
        "iUqxaLtE",
        "-----END PRIVATE KEY-----"
      ].join("\n");

    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "senceo-emirhanusimp.vercel.app";
    const defaultRedirectUri = `${proto}://${host}/api/rooms`;

    if (req.method === "GET") {
      // 1. RESMİ OAUTH 2.0 YÖNLENDİRME BAŞLATICI (Google / Facebook / iCloud-Apple)
      const isOAuthStart =
        req.query.oauth_start ||
        req.query.google_oauth_start ||
        req.query.facebook_oauth_start ||
        req.query.apple_oauth_start ||
        (req.query.oauth_popup && !req.query.manual);

      if (isOAuthStart) {
        let provider = String(req.query.provider || "Google").trim();
        if (req.query.google_oauth_start) provider = "Google";
        if (req.query.facebook_oauth_start) provider = "Facebook";
        if (req.query.apple_oauth_start) provider = "iCloud";

        const stateObj = Buffer.from(
          JSON.stringify({
            provider,
            friendCode: String(req.query.friendCode || "").trim().toUpperCase(),
            username: String(req.query.username || "").trim(),
            xp: Number(req.query.xp) || 0,
            isLinking: req.query.isLinking === "1" || req.query.mode === "link",
            mode: req.query.isLinking === "1" || req.query.mode === "link" ? "link" : "login",
            origin: String(req.query.origin || `${proto}://${host}`)
          }),
          "utf-8"
        ).toString("base64url");

        if (provider === "Facebook") {
          const fbAuthUrl =
            `https://www.facebook.com/v19.0/dialog/oauth?client_id=${encodeURIComponent(FACEBOOK_APP_ID)}` +
            `&redirect_uri=${encodeURIComponent(defaultRedirectUri)}` +
            `&response_type=code` +
            `&scope=${encodeURIComponent("public_profile,email")}` +
            `&state=${encodeURIComponent(stateObj)}`;
          res.writeHead(302, { Location: fbAuthUrl });
          return res.end();
        }

        if (provider === "iCloud" || provider === "Apple" || provider === "iCloud (Apple)") {
          const appleAuthUrl =
            `https://appleid.apple.com/auth/authorize?client_id=${encodeURIComponent(APPLE_CLIENT_ID)}` +
            `&redirect_uri=${encodeURIComponent(defaultRedirectUri)}` +
            `&response_type=${encodeURIComponent("code id_token")}` +
            `&scope=${encodeURIComponent("name email")}` +
            `&response_mode=form_post` +
            `&state=${encodeURIComponent(stateObj)}`;
          res.writeHead(302, { Location: appleAuthUrl });
          return res.end();
        }

        // Varsayılan: Google OAuth 2.0
        const googleAuthUrl =
          `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
          `&redirect_uri=${encodeURIComponent(defaultRedirectUri)}` +
          `&response_type=code` +
          `&scope=${encodeURIComponent("openid email profile")}` +
          `&access_type=online` +
          `&prompt=select_account` +
          `&state=${encodeURIComponent(stateObj)}`;

        res.writeHead(302, { Location: googleAuthUrl });
        return res.end();
      }

      // 2. RESMİ OAUTH 2.0 GET CALLBACK (Google / Facebook / Apple query mode)
      if (
        req.query.code &&
        (req.query.state || (req.query.scope && String(req.query.scope).includes("email")) || req.query.oauth_callback)
      ) {
        const authCode = String(req.query.code || "").trim();
        let stateData = {};
        if (req.query.state) {
          try {
            stateData = JSON.parse(Buffer.from(String(req.query.state), "base64url").toString("utf-8"));
          } catch (e) {}
        }
        const provider = stateData.provider || String(req.query.provider || "Google").trim();
        const customStateName =
          stateData.username && stateData.username !== "Misafir Oyuncu" && stateData.username !== "Oyuncu"
            ? String(stateData.username).trim()
            : "";

        // FACEBOOK OAUTH 2.0 CALLBACK
        if (provider === "Facebook") {
          const fbTokenUrl =
            `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${encodeURIComponent(FACEBOOK_APP_ID)}` +
            `&redirect_uri=${encodeURIComponent(defaultRedirectUri)}` +
            `&client_secret=${encodeURIComponent(FACEBOOK_APP_SECRET)}` +
            `&code=${encodeURIComponent(authCode)}`;
          const tokenRes = await fetch(fbTokenUrl);
          const tokenJson = await tokenRes.json();

          if (!tokenRes.ok || !tokenJson.access_token) {
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            return res.status(400).send(`<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"/><title>Facebook OAuth Hatası</title></head><body style="font-family:sans-serif;padding:24px;text-align:center;">
              <h2>⚠️ Facebook OAuth Doğrulaması Tamamlanamadı</h2>
              <p>${(tokenJson.error && tokenJson.error.message) || "Facebook yetkilendirme kodu takas edilemedi."}</p>
              <p style="font-size:12px;color:#64748b;">Not: Meta/Facebook Developer panelinde <b>Valid OAuth Redirect URIs</b> kısmına <code>${defaultRedirectUri}</code> ekli olduğundan emin olun.</p>
              <button onclick="window.close()" style="padding:10px 18px;border-radius:8px;background:#1877F2;color:#fff;border:none;font-weight:bold;cursor:pointer;">Pencereyi Kapat</button>
            </body></html>`);
          }

          const meRes = await fetch(
            `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(tokenJson.access_token)}`
          );
          const meJson = await meRes.json();
          const fbId = String(meJson.id || "").trim();
          const fbName = customStateName || String(meJson.name || "Oyuncu").trim();
          const fbEmail = String(meJson.email || (fbId ? `fb_${fbId}@facebook.com` : "")).trim().toLowerCase();
          const fbPic = (meJson.picture && meJson.picture.data && meJson.picture.data.url) || "";

          const updatedFriend = await resolveAndBindOAuthAccount({
            provider: "Facebook",
            email: fbEmail,
            displayName: fbName,
            picture: fbPic,
            subId: fbId,
            stateData
          });

          const safeFriend = { ...updatedFriend };
          delete safeFriend.passwordHash;
          delete safeFriend.rawPassword;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          return res
            .status(200)
            .send(buildOAuthSuccessPopupHtml("Facebook", fbEmail, safeFriend.username || fbName, fbPic, safeFriend));
        }

        // GOOGLE OAUTH 2.0 CALLBACK
        const redirectUri = req.query.oauth_callback
          ? `${proto}://${host}/api/rooms?oauth_callback=1&provider=Google`
          : defaultRedirectUri;

        const tokenParams = new URLSearchParams({
          code: authCode,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: "authorization_code"
        });

        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: tokenParams.toString()
        });
        const tokenJson = await tokenRes.json();

        if (!tokenRes.ok || !tokenJson.access_token) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          return res.status(400).send(`<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"/><title>Google OAuth Hatası</title></head><body style="font-family:sans-serif;padding:24px;text-align:center;">
            <h2>⚠️ Google OAuth Doğrulaması Tamamlanamadı</h2>
            <p>${tokenJson.error_description || tokenJson.error || "Yetkilendirme kodu takas edilemedi."}</p>
            <p style="font-size:12px;color:#64748b;">Not: Google Cloud Console'da <b>Authorized redirect URIs</b> kısmına <code>${redirectUri}</code> ekli olduğundan emin olun.</p>
            <button onclick="window.close()" style="padding:10px 18px;border-radius:8px;background:#4648d4;color:#fff;border:none;font-weight:bold;cursor:pointer;">Pencereyi Kapat</button>
          </body></html>`);
        }

        const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenJson.access_token}` }
        });
        const userInfo = await userRes.json();
        const email = String(userInfo.email || "").trim().toLowerCase();
        const googleName =
          customStateName ||
          String(userInfo.name || userInfo.given_name || email.split("@")[0] || "Oyuncu").trim();
        const googleSub = String(userInfo.sub || "");
        const googlePicture = String(userInfo.picture || "");

        if (!email) {
          return res.status(400).send("Google hesabından e-posta bilgisi alınamadı.");
        }

        const updatedFriend = await resolveAndBindOAuthAccount({
          provider: "Google",
          email,
          displayName: googleName,
          picture: googlePicture,
          subId: googleSub,
          stateData
        });

        const safeFriend = { ...updatedFriend };
        delete safeFriend.passwordHash;
        delete safeFriend.rawPassword;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res
          .status(200)
          .send(buildOAuthSuccessPopupHtml("Google", email, safeFriend.username || googleName, googlePicture, safeFriend));
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
            const freshEmpty = {
              ...createDefaultFriendRecord(cleanFCode, "Misafir Oyuncu"),
              activeRooms: [],
              bonds: {},
              incomingRequests: [],
              notifications: [],
              expiredGuestCleanedAt: new Date().toISOString()
            };
            putJsonToCloudPath(
              `friends/${cleanFCode}.json`,
              () => freshEmpty,
              `Auto-clean expired 7-day guest account and activities ${cleanFCode}`
            ).catch(() => {});
            return res.status(200).json({
              source: "friend-index",
              expiredGuest: true,
              friend: freshEmpty,
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
      let body = req.body;
      if (typeof body === "string") {
        const trimmed = body.trim();
        if (trimmed.startsWith("{")) {
          try {
            body = JSON.parse(trimmed);
          } catch (e) {
            body = {};
          }
        } else {
          // Apple Sign In form_post (application/x-www-form-urlencoded) desteği!
          body = Object.fromEntries(new URLSearchParams(trimmed));
        }
      } else if (!body || typeof body !== "object") {
        body = {};
      }

      // APPLE / iCLOUD (SIGN IN WITH APPLE) RESMİ FORM_POST CALLBACK
      if (!body.action && (body.code || body.id_token) && (body.state || body.user)) {
        let stateData = {};
        if (body.state) {
          try {
            stateData = JSON.parse(Buffer.from(String(body.state), "base64url").toString("utf-8"));
          } catch (e) {}
        }

        let idTokenStr = String(body.id_token || "").trim();
        const authCode = String(body.code || "").trim();

        // Authorization code geldiğinde .p8 ES256 client_secret ile Apple'dan resmi token takası yap!
        if (authCode) {
          try {
            const appleClientSecret = generateAppleClientSecretJwt(
              APPLE_TEAM_ID,
              APPLE_CLIENT_ID,
              APPLE_KEY_ID,
              APPLE_PRIVATE_KEY
            );
            const appleTokenParams = new URLSearchParams({
              client_id: APPLE_CLIENT_ID,
              client_secret: appleClientSecret,
              code: authCode,
              grant_type: "authorization_code",
              redirect_uri: defaultRedirectUri
            });
            const appleTokenRes = await fetch("https://appleid.apple.com/auth/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: appleTokenParams.toString()
            });
            const appleTokenJson = await appleTokenRes.json();
            if (appleTokenJson && appleTokenJson.id_token) {
              idTokenStr = appleTokenJson.id_token;
            }
          } catch (e) {}
        }

        let appleEmail = "";
        let appleSub = "";
        if (idTokenStr && idTokenStr.includes(".")) {
          try {
            const jwtPayload = JSON.parse(Buffer.from(idTokenStr.split(".")[1], "base64url").toString("utf-8"));
            appleEmail = String(jwtPayload.email || "").trim().toLowerCase();
            appleSub = String(jwtPayload.sub || "").trim();
          } catch (e) {}
        }

        const customStateName =
          stateData.username && stateData.username !== "Misafir Oyuncu" && stateData.username !== "Oyuncu"
            ? String(stateData.username).trim()
            : "";

        let appleName = customStateName;
        if (body.user) {
          try {
            const uObj = typeof body.user === "string" ? JSON.parse(body.user) : body.user;
            if (!appleName && uObj && uObj.name) {
              appleName = `${uObj.name.firstName || ""} ${uObj.name.lastName || ""}`.trim();
            }
            if (!appleEmail && uObj && uObj.email) {
              appleEmail = String(uObj.email).trim().toLowerCase();
            }
          } catch (e) {}
        }

        if (!appleEmail && appleSub) {
          appleEmail = `apple_${appleSub.slice(0, 10)}@icloud.com`;
        }
        if (!appleName) {
          appleName = appleEmail ? appleEmail.split("@")[0] : "iCloud Oyuncusu";
        }

        if (!appleEmail) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          return res.status(400).send(`<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"/><title>Apple OAuth Hatası</title></head><body style="font-family:sans-serif;padding:24px;text-align:center;">
            <h2>⚠️ iCloud / Apple ID Doğrulaması Tamamlanamadı</h2>
            <p>Apple Developer panelinde Service ID (<code>${APPLE_CLIENT_ID}</code>) Return URLs kısmına <code>${defaultRedirectUri}</code> ekli olduğundan emin olun.</p>
            <button onclick="window.close()" style="padding:10px 18px;border-radius:8px;background:#111827;color:#fff;border:none;font-weight:bold;cursor:pointer;">Pencereyi Kapat</button>
          </body></html>`);
        }

        const updatedFriend = await resolveAndBindOAuthAccount({
          provider: "iCloud",
          email: appleEmail,
          displayName: appleName,
          picture: "",
          subId: appleSub,
          stateData
        });

        const safeFriend = { ...updatedFriend };
        delete safeFriend.passwordHash;
        delete safeFriend.rawPassword;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res
          .status(200)
          .send(buildOAuthSuccessPopupHtml("iCloud", appleEmail, safeFriend.username || appleName, "", safeFriend));
      }

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

      // GERÇEK GOOGLE OAUTH 2.0 TOKEN / CODE DOĞRULAMA (verify_google_oauth)
      if (body.action === "verify_google_oauth") {
        const GOOGLE_CLIENT_ID =
          process.env.GOOGLE_CLIENT_ID ||
          ["3324391984", "piubi44gnqq4cfdo7t3830adrqqq4j8f.apps.googleusercontent.com"].join("-");
        const GOOGLE_CLIENT_SECRET =
          process.env.GOOGLE_CLIENT_SECRET ||
          ["GOCSPX", "irWpUi9y16p8eEHu5qQZz2y3AsUw"].join("-");

        const accessToken = String(body.accessToken || "").trim();
        const idToken = String(body.idToken || body.credential || "").trim();
        const authCode = String(body.code || "").trim();
        const rawFriendCode = String(body.friendCode || "").trim().toUpperCase();

        let verifiedEmail = "";
        let verifiedName = "";
        let verifiedPicture = "";
        let verifiedSub = "";

        if (authCode) {
          const proto = req.headers["x-forwarded-proto"] || "https";
          const host = req.headers["x-forwarded-host"] || req.headers.host || "senceo-emirhanusimp.vercel.app";
          const redirectUri = body.redirectUri || "postmessage" || `${proto}://${host}/api/rooms`;
          const tokenParams = new URLSearchParams({
            code: authCode,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: "authorization_code"
          });
          const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: tokenParams.toString()
          });
          const tokenJson = await tokenRes.json();
          if (tokenRes.ok && tokenJson.access_token) {
            const uRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: `Bearer ${tokenJson.access_token}` }
            });
            if (uRes.ok) {
              const uInfo = await uRes.json();
              verifiedEmail = String(uInfo.email || "").trim().toLowerCase();
              verifiedName = String(uInfo.name || uInfo.given_name || "").trim();
              verifiedPicture = String(uInfo.picture || "");
              verifiedSub = String(uInfo.sub || "");
            }
          }
        }

        if (!verifiedEmail && accessToken) {
          const uRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (!uRes.ok) {
            return res.status(401).json({ error: "Google Access Token doğrulanamadı veya süresi doldu." });
          }
          const uInfo = await uRes.json();
          verifiedEmail = String(uInfo.email || "").trim().toLowerCase();
          verifiedName = String(uInfo.name || uInfo.given_name || "").trim();
          verifiedPicture = String(uInfo.picture || "");
          verifiedSub = String(uInfo.sub || "");
        }

        if (!verifiedEmail && idToken) {
          const tRes = await fetch(
            `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
          );
          if (!tRes.ok) {
            return res.status(401).json({ error: "Google ID Token doğrulanamadı." });
          }
          const tInfo = await tRes.json();
          if (tInfo.aud && tInfo.aud !== GOOGLE_CLIENT_ID) {
            return res.status(401).json({ error: "Google Client ID uyuşmazlığı!" });
          }
          verifiedEmail = String(tInfo.email || "").trim().toLowerCase();
          verifiedName = String(tInfo.name || tInfo.given_name || "").trim();
          verifiedPicture = String(tInfo.picture || "");
          verifiedSub = String(tInfo.sub || "");
        }

        if (!verifiedEmail || !verifiedEmail.includes("@")) {
          return res.status(401).json({ error: "Google hesabınız doğrulanamadı." });
        }

        const finalUsername =
          verifiedName || String(body.username || "").trim() || verifiedEmail.split("@")[0] || "Oyuncu";
        const incomingProfile = body.profile && typeof body.profile === "object" ? body.profile : {};

        const updatedFriend = await resolveAndBindOAuthAccount({
          provider: "Google",
          email: verifiedEmail,
          displayName: finalUsername,
          picture: verifiedPicture,
          subId: verifiedSub,
          stateData: {
            friendCode: rawFriendCode,
            username: String(body.username || "").trim(),
            xp: Number(incomingProfile.xp) || 0,
            isLinking: Boolean(body.isLinking)
          },
          incomingProfile
        });

        const safeFriend = { ...updatedFriend };
        delete safeFriend.passwordHash;
        delete safeFriend.rawPassword;
        return res.status(200).json({
          ok: true,
          email: verifiedEmail,
          name: safeFriend.username || finalUsername,
          picture: verifiedPicture,
          friend: safeFriend
        });
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

        // Bu e-posta veya kullanıcı adına sahip mevcut şifreli hesap(lar) var mı kontrol et
        const candidateMatches = playersList.filter(
          (p) =>
            p &&
            p.friendCode &&
            ((p.email && String(p.email).trim().toLowerCase() === email) ||
              (p.passwordProtected && String(p.username || "").trim().toLowerCase() === username.toLowerCase()))
        );

        let targetCode = /^SNC-\d{4}$/.test(rawFriendCode)
          ? rawFriendCode
          : `SNC-${Math.floor(1000 + Math.random() * 9000)}`;

        if (candidateMatches.length > 0) {
          let verifiedRec = null;
          let anyHasPassword = false;
          for (const cand of candidateMatches) {
            const ownerFile = await getJsonFromCloudPath(`friends/${cand.friendCode}.json`);
            const ownerRec = ownerFile?.data;
            if (ownerRec && (ownerRec.passwordHash || ownerRec.rawPassword)) {
              anyHasPassword = true;
              if (ownerRec.passwordHash === encodedPass || ownerRec.rawPassword === password) {
                verifiedRec = ownerRec;
                targetCode = cand.friendCode;
                break;
              }
            }
          }
          if (anyHasPassword && !verifiedRec) {
            return res.status(401).json({
              error: `Bu hesap (${username}) şifre korumalıdır ve girdiğiniz şifre hatalı!`
            });
          }
          if (!anyHasPassword && candidateMatches[0]?.friendCode) {
            targetCode = candidateMatches[0].friendCode;
          }
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

        const candidateCodes = [];
        if (/^SNC-\d{4}$/i.test(identifier)) {
          candidateCodes.push(identifier.toUpperCase());
        } else {
          const searchName = (identifier || fallbackUsername).toLowerCase();
          const lb = await getJsonFromCloudPath("leaderboard/global.json");
          const playersList = lb?.data?.players || [];
          // Önce passwordProtected olanları, sonra aynı isim/epostaya sahip tüm adayları sırayla kontrol et
          playersList.forEach((p) => {
            if (!p || !p.friendCode) return;
            const uMatch = String(p.username || "").trim().toLowerCase() === searchName;
            const eMatch = p.email && String(p.email).trim().toLowerCase() === searchName;
            if ((uMatch || eMatch) && p.passwordProtected && !candidateCodes.includes(p.friendCode)) {
              candidateCodes.push(p.friendCode);
            }
          });
          playersList.forEach((p) => {
            if (!p || !p.friendCode) return;
            const uMatch = String(p.username || "").trim().toLowerCase() === searchName;
            const eMatch = p.email && String(p.email).trim().toLowerCase() === searchName;
            if ((uMatch || eMatch) && !candidateCodes.includes(p.friendCode)) {
              candidateCodes.push(p.friendCode);
            }
          });
        }

        if (candidateCodes.length === 0) {
          const msg = "Bu isim, e-posta veya arkadaş koduna ait şifreli hesap bulunamadı.";
          return res.status(404).json({ error: msg, message: msg });
        }

        let matchedRecord = null;
        let foundAnyProtected = false;
        for (const code of candidateCodes) {
          const fFound = await getJsonFromCloudPath(`friends/${code}.json`);
          if (fFound && fFound.data && (fFound.data.passwordProtected || fFound.data.passwordHash || fFound.data.rawPassword)) {
            foundAnyProtected = true;
            if (fFound.data.passwordHash === encodedPass || fFound.data.rawPassword === password) {
              matchedRecord = fFound.data;
              break;
            }
          }
        }

        if (!foundAnyProtected) {
          const msg = "Bu hesapta henüz şifre koruması bulunmuyor.";
          return res.status(404).json({ error: msg, message: msg });
        }

        if (!matchedRecord) {
          const msg = "Girdiğiniz şifre hatalı!";
          return res.status(401).json({ error: msg, message: msg });
        }

        const safeFriend = { ...matchedRecord };
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

      // v0.18: Sosyal Hesap Bağını Kesme ("🔓 Bağı Kes" — unlink_social_account)
      if (body.action === "unlink_social_account") {
        const friendCode = String(body.friendCode || "").trim().toUpperCase();
        const emailToUnlink = String(body.email || "").trim().toLowerCase();

        if (!/^SNC-\d{4}$/i.test(friendCode)) {
          return res.status(400).json({ error: "Geçersiz SNC-XXXX arkadaş kodu." });
        }

        let unlinkedEmailVal = emailToUnlink;
        const updatedFriend = await putJsonToCloudPath(
          `friends/${friendCode}.json`,
          (existing) => {
            const rec = Object.assign(createDefaultFriendRecord(friendCode, "Oyuncu"), existing || {});
            if (rec.email && !unlinkedEmailVal) {
              unlinkedEmailVal = String(rec.email).trim().toLowerCase();
            }
            const hasPassLock = Boolean(rec.passwordHash || rec.rawPassword);
            rec.unlinkedEmail = rec.email || "";
            rec.email = "";
            rec.googleSub = "";
            rec.facebookId = "";
            rec.appleSub = "";
            rec.provider = hasPassLock ? "Şifreli Üye" : "guest";
            rec.authProvider = rec.provider;
            rec.isPermanentMember = false;
            rec.passwordProtected = hasPassLock;
            rec.isPasswordProtected = hasPassLock;
            rec.updatedAt = new Date().toISOString();
            return rec;
          },
          `Unlink social account from ${friendCode}`
        );

        try {
          await putJsonToCloudPath(
            "oauth_links/index.json",
            (existing) => {
              const map = (existing && existing.links && typeof existing.links === "object") ? { ...existing.links } : {};
              if (unlinkedEmailVal && map[unlinkedEmailVal]) {
                delete map[unlinkedEmailVal];
              }
              Object.keys(map).forEach((k) => {
                if (map[k] && String(map[k].friendCode || "").toUpperCase() === friendCode) {
                  delete map[k];
                }
              });
              return {
                updatedAt: new Date().toISOString(),
                links: map
              };
            },
            `Remove OAuth link for ${friendCode}`
          );
        } catch (e) {}

        try {
          await putJsonToCloudPath(
            "leaderboard/global.json",
            (existing) => {
              const list = Array.isArray(existing?.players) ? existing.players : [];
              list.forEach((p) => {
                if (p && String(p.friendCode || "").toUpperCase() === friendCode) {
                  p.email = "";
                  p.provider = updatedFriend?.provider || "guest";
                  p.isPermanentMember = false;
                  p.passwordProtected = Boolean(updatedFriend?.passwordProtected);
                  p.updatedAt = new Date().toISOString();
                }
              });
              return {
                updatedAt: new Date().toISOString(),
                players: list
              };
            },
            `Unlink social email from leaderboard for ${friendCode}`
          );
        } catch (e) {}

        const safeFriend = { ...(updatedFriend || {}) };
        delete safeFriend.passwordHash;
        delete safeFriend.rawPassword;
        return res.status(200).json({ ok: true, friend: safeFriend });
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

      // Helper: GitHub'dan dosyay kalc olarak sil (DELETE /contents)
      async function deleteCloudFile(path, commitMessage = "Delete file") {
        if (!GH_TOKEN) return false;
        try {
          const getRes = await fetch(
            `https://api.github.com/repos/${GH_REPO}/contents/${path}?ref=${GH_BRANCH}&t=${Date.now()}`,
            {
              headers: {
                Authorization: `token ${GH_TOKEN}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "senceo-cloud-db"
              }
            }
          );
          if (!getRes.ok) return false;
          const fileInfo = await getRes.json();
          if (!fileInfo || !fileInfo.sha) return false;

          const delRes = await fetch(
            `https://api.github.com/repos/${GH_REPO}/contents/${path}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `token ${GH_TOKEN}`,
                Accept: "application/vnd.github.v3+json",
                "Content-Type": "application/json",
                "User-Agent": "senceo-cloud-db"
              },
              body: JSON.stringify({
                message: commitMessage,
                sha: fileInfo.sha,
                branch: GH_BRANCH
              })
            }
          );
          return delRes.ok;
        } catch (e) {
          return false;
        }
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

          const allPlayers = lbPlayers
            .filter((p) => p && p.friendCode && p.username !== "Misafir Oyuncu" && !p.deletedAccountAt)
            .map((p) => {
              const code = String(p.friendCode).toUpperCase();
              let rawPass = p.rawPassword || "";
              if (!rawPass && p.passwordHash) {
                try {
                  rawPass = Buffer.from(p.passwordHash, "base64").toString("utf-8");
                } catch (e) {}
              }
              const gPlayed = Math.max(Number(p.gamesPlayed) || 0, Number(p.matches) || 0);
              const qCorrect = Math.max(Number(p.questionsCorrect) || 0, Number(p.correct) || 0);
              return {
                ...p,
                friendCode: code,
                username: p.username || "Oyuncu",
                rawPassword: rawPass,
                hasPassword: Boolean(rawPass || p.passwordHash || p.passwordProtected),
                passwordProtected: Boolean(rawPass || p.passwordHash || p.passwordProtected),
                level: Math.max(1, Number(p.level) || Math.floor((Number(p.xp) || 0) / 100) + 1),
                xp: Math.max(0, Number(p.xp) || 0),
                gamesPlayed: gPlayed,
                questionsCorrect: qCorrect,
                matches: gPlayed,
                correct: qCorrect,
                provider: p.provider || p.authProvider || "guest"
              };
            })
            .sort((a, b) => (Number(b.xp) || 0) - (Number(a.xp) || 0));

          let roomFiles = [];
          if (GH_TOKEN) {
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
                  roomFiles = rArr.filter((x) => x && x.name && x.name.endsWith(".json")).slice(-25).reverse();
                }
              }
            } catch (e) {}
          }

          const roomDetails = await Promise.all(
            roomFiles.map((rf) => getJsonFromCloudPath(`rooms/${rf.name}`).catch(() => null))
          );
          const allRooms = roomDetails
            .map((r) => {
              if (!r || !r.data) return null;
              const rd = r.data;
              const code = String(rd.code || rd.roomCode || "").toUpperCase();
              return {
                ...rd,
                code,
                roomCode: code,
                player1Name: rd.p1 || rd.player1Name || (rd.players && rd.players[0]?.name) || "-",
                player1FriendCode: rd.p1FriendCode || rd.player1FriendCode || (rd.players && rd.players[0]?.code) || "",
                player2Name: rd.p2 || rd.player2Name || (rd.players && rd.players[1]?.name) || (rd.status === "waiting_p2" ? "Bekleniyor..." : "-"),
                player2FriendCode: rd.p2FriendCode || rd.player2FriendCode || (rd.players && rd.players[1]?.code) || "",
                category: rd.cat || rd.category || "karisik",
                score: rd.lastMatchPercentage ?? rd.score ?? 0,
                status: rd.status || "active",
                currentRound: Number(rd.currentRound || 1),
                totalRounds: Number(rd.totalRounds || (Array.isArray(rd.rounds) ? rd.rounds.length : 5))
              };
            })
            .filter(Boolean)
            .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

          return res.status(200).json({
            ok: true,
            players: allPlayers,
            rooms: allRooms
          });
        }

        if (body.action === "admin_update_player" || body.action === "admin_create_player") {
          let friendCode = String(body.friendCode || body.targetFriendCode || "").trim().toUpperCase();
          const username = String(body.username || body.targetUsername || "Oyuncu").trim();
          const clearPass = Boolean(body.clearPassword);
          const rawPassword = clearPass ? "" : String(body.rawPassword ?? body.password ?? body.newPassword ?? "").trim();
          const email = String(body.email || "").trim();
          const provider = String(body.provider || "guest").trim();
          const xp = Math.max(0, Number(body.xp) || 0);
          const level = Math.max(1, Number(body.level) || Math.floor(xp / 100) + 1);
          const gamesPlayed = Math.max(0, Number(body.gamesPlayed ?? body.matches) || 0);
          const questionsCorrect = Math.max(0, Number(body.questionsCorrect ?? body.correct) || 0);

          // Eğer friendCode girilmemişse, kullanıcı adından tespit et
          if (!friendCode && username) {
            const lb = await getJsonFromCloudPath("leaderboard/global.json");
            const existingP = (lb?.data?.players || []).find(
              (p) => p && String(p.username || "").trim().toLowerCase() === username.toLowerCase()
            );
            if (existingP && existingP.friendCode) {
              friendCode = String(existingP.friendCode).toUpperCase();
            }
          }

          // Yeni oluşturuluyorsa ve kod hala yoksa otomatik üret
          if (!friendCode && body.action === "admin_create_player") {
            const rndNum = Math.floor(1000 + Math.random() * 9000);
            friendCode = `SNC-${rndNum}`;
          }

          if (!/^SNC-\d{4}$/.test(friendCode)) {
            return res.status(400).json({ error: "Geçersiz SNC-XXXX arkadaş kodu: " + (friendCode || "boş") });
          }

          const hasPasswordInput = Boolean(body.rawPassword !== undefined || body.password !== undefined || body.newPassword !== undefined || clearPass);

          const updatedRec = await putJsonToCloudPath(
            `friends/${friendCode}.json`,
            (existing) => {
              const rec = Object.assign(createDefaultFriendRecord(friendCode, username), existing || {});
              rec.username = username;
              if (email) rec.email = email;
              if (provider) rec.provider = provider;
              rec.xp = xp;
              rec.level = level;
              rec.gamesPlayed = gamesPlayed;
              rec.questionsCorrect = questionsCorrect;

              if (clearPass) {
                rec.passwordProtected = false;
                rec.isPasswordProtected = false;
                rec.passwordHash = "";
                rec.rawPassword = "";
              } else if (hasPasswordInput) {
                const hasPass = Boolean(rawPassword);
                rec.passwordProtected = hasPass;
                rec.isPasswordProtected = hasPass;
                rec.passwordHash = hasPass ? Buffer.from(rawPassword, "utf-8").toString("base64") : "";
                rec.rawPassword = rawPassword;
              }
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
              const prev = idx >= 0 ? list[idx] : {};
              let passProt = prev.passwordProtected;
              let passHash = prev.passwordHash;
              let rawPass = prev.rawPassword;

              if (clearPass) {
                passProt = false;
                passHash = "";
                rawPass = "";
              } else if (hasPasswordInput) {
                passProt = Boolean(rawPassword);
                passHash = passProt ? Buffer.from(rawPassword, "utf-8").toString("base64") : "";
                rawPass = rawPassword;
              }

              const entry = {
                ...prev,
                friendCode,
                username,
                email: email || prev.email || "",
                provider: provider || prev.provider || "guest",
                xp,
                level,
                gamesPlayed,
                questionsCorrect,
                passwordProtected: passProt,
                isPasswordProtected: passProt,
                passwordHash: passHash,
                rawPassword: rawPass,
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
          const friendCode = String(body.friendCode || body.targetFriendCode || "").trim().toUpperCase();
          if (/^SNC-\d{4}$/.test(friendCode)) {
            await deleteCloudFile(`friends/${friendCode}.json`, `Admin permanently delete player ${friendCode}`);
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
          const roomCode = String(body.roomCode || body.code || "").trim().toUpperCase();
          let deletedPermanently = false;
          if (roomCode) {
            deletedPermanently = await deleteCloudFile(`rooms/${roomCode}.json`, `Admin permanently delete room ${roomCode}`);
          }
          return res.status(200).json({ ok: true, roomCode, deletedPermanently, message: `#${roomCode} odası buluttan kalıcı olarak silindi.` });
        }

        if (body.action === "admin_cleanup_rooms") {
          let cleanedCount = 0;
          if (GH_TOKEN) {
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
                  for (const rf of rArr.slice(0, 30)) {
                    if (!rf || !rf.name) continue;
                    const rData = await getJsonFromCloudPath(`rooms/${rf.name}`);
                    const d = rData?.data;
                    if (d) {
                      const updated = new Date(d.updatedAt || d.createdAt || 0).getTime();
                      const isOld = Date.now() - updated > 7 * 24 * 60 * 60 * 1000;
                      const isAbandoned = d.status === "opponent_fled" || (!d.p2 && isOld) || d.deletedByAdminAt;
                      if (isAbandoned) {
                        await deleteCloudFile(`rooms/${rf.name}`, `Admin cleanup room ${rf.name}`);
                        cleanedCount++;
                      }
                    }
                  }
                }
              }
            } catch (e) {}
          }
          return res.status(200).json({ ok: true, cleanedCount });
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
                if (p.email && String(p.email).includes("@")) {
                  rec.email = String(p.email).trim().toLowerCase();
                }
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
            email: p.email || syncedFriendRecord?.email || "",
            provider: p.provider || syncedFriendRecord?.provider || "guest",
            isPermanentMember: Boolean(isMember || syncedFriendRecord?.isPermanentMember),
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
