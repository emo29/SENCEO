// senceo — Stitch Çok Sayfalı Arayüz (Yeni Oyun / Aktif Oyunlar / Bağlarım / Liderlik) + Canlı Oda & Klasik Oyun Motoru
// 4 Tam Kapsamlı Tema (1. Luminous Beyaz Varsayılan, 2. Obsidian Koyu, 3. Cosmic Neon Eski Varsayılan, 4. Neo-Brutal Acid)
// v0.07: Kalıcı/7-Günlük Misafir Kimlik Koruma, Tek Seferlik İsim, 3sn Kum Saati + 4sn Bekleme Modalı, 1.5sn Balon Gecikmesi, Tam Senkronize Canlı Oda & Takım/Ebe Sistemi

const APP_VERSION = 'v0.07';
const DEFAULT_SUPABASE_URL = 'https://kypzuqnksnlinkfuxvnl.supabase.co';
const TOTAL_QUESTIONS = 5;
const CIRCLE_CIRCUMFERENCE = 414.69;
const PASS_ANSWER_VALUE = -1;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// 4 Tam Kapsamlı Tema Tanımları
const THEMES = {
  luminous: {
    id: 'luminous',
    confettiColors: ['#4648d4', '#6063ee', '#006c49', '#b90538']
  },
  obsidian: {
    id: 'obsidian',
    confettiColors: ['#8083ff', '#4edea3', '#ffb2b7', '#ffffff']
  },
  cosmic: {
    id: 'cosmic',
    confettiColors: ['#ff007f', '#00f2fe', '#ff7b00', '#10b981']
  },
  brutal26: {
    id: 'brutal26',
    confettiColors: ['#ccff00', '#ff4d00', '#b892ff', '#ffffff']
  }
};

// Kullanıcı Profil & Çift Level Durumu ("senceo Seviyen" + "İkili Bağ Seviyesi")
const userProfile = {
  id: '',
  friendCode: '', // Benzersiz Arkadaş Kodu: Örn. SNC-2112 (Sayfa açıldığı anda kilitlenir ve asla kendiliğinden değişmez!)
  username: '',
  email: '',
  provider: 'guest',
  isLoggedIn: false,
  isPermanentMember: false, // Google / Facebook / iCloud / Mail ile bağlandığında true olur (Kalıcı)
  lastXpActivityAt: 0, // Misafirler için 7 gün puan artmazsa sıfırlama takibi
  createdAt: '',
  avatar: '😎',
  xp: 0,
  level: 1,
  gamesPlayed: 0,
  questionsCorrect: 0,
  friends: [],
  bonds: {},
  incomingRequests: [],
  notifications: []
};

// Uygulama Oyun Durumu (State)
const gameState = {
  theme: 'luminous',
  mode: 'link', // 'link' (Klasik Oyun) | 'pass' (Yan Yana) | 'arena' (Canlı Oda Kur)
  arenaFormat: '1v1',
  ffaSubMode: 'ebe', // 'ebe' (Kahoot tarzı 1 kişi çözer herkes bilir) | 'packet' (Paket tarzı)
  teamSubMode: 'coop_pair', // 'coop_pair' (Eşli Takım İçi Uyum) | 'cross_team' (Karşı Takımı Tahmin)
  turnStepMode: 1, // Canlı Odada kaçar soru çözüleceği: 1, 2, 3, 4, 5, 10
  questionTimerSec: 0, // Canlı Odada soru süresi: 0 (Süresiz), 10, 30, 90
  starterSelectionMode: 'random', // 'random' | 'manual' (Kurucu Ebe/Başlayan atar)
  designatedStarterCode: '',
  category: 'genel',
  activeLobbyFilter: 'all', // 'all' | 'turn' | 'waiting'
  urgentRoomCode: '',
  pendingOAuthProvider: null,
  isSandboxTest: false, // "Bu Cihazda Test Et" simülasyon modu bayrağı (Gerçek düelloya etkisi 0, karşı saldırı kapalı)
  currentRound: 1,
  half: 1,
  phase: 'p1_answer',
  player1Name: '',
  player2Name: '',
  player2FriendCode: '',
  selectedQuestions: [],
  usedQuestionIds: [],
  shufflesLeft: 2,
  passUsedThisTurn: false,
  customAnswerUsedThisTurn: false,
  customOptionsMap: {},
  p1Answers: [],
  p2Guesses: [],
  p1Comments: [],
  p2Comments: [],
  half1Score: { correct: 0, total: 5 },
  p2Half2Questions: [],
  p2Half2Answers: [],
  p1Half2Guesses: [],
  p2Half2Comments: [],
  p1Half2Comments: [],
  p2Half2CustomMap: {},
  currentQuestionIndex: 0,
  progressDots: [],
  isLocked: false,
  pendingChoiceIndex: null,
  pendingEmoji: '',
  roomCode: '',
  generatedChallengeUrl: '',
  pollingIntervalId: null,
  liveLobbyPollingId: null,
  liveTurnWaitPollingId: null,
  cloudSyncIntervalId: null,
  questionTimerIntervalId: null,
  secretBubbleTimeoutId: null,
  completedRoomDataFromCloud: null,
  readyModalRoomData: null,
  liveRoomData: null,
  hostManageTarget: null
};

// Yüzdelik Uyum Yorumları
const SCORE_VERDICTS = {
  100: {
    title: "🧠 Siz tek beyinli iki insan mısınız?! (%100)",
    desc: "İnanılmaz! Telepati kurduğunuz kesinleşti. Birbirinizin ne düşündüğünü ve ne yorum yazacağını kelimesi kelimesine biliyorsunuz!"
  },
  80: {
    title: "🔥 Efsane İkili! Neredeyse Kusursuz! (%80)",
    desc: "Sadece ufak bir fire verdiniz! Birbirinizi ciğerinize kadar tanıyorsunuz, aranızdaki bağ gerçekten çok güçlü."
  },
  60: {
    title: "😎 Fena Değil, Sağlam Dostluk! (%60)",
    desc: "Genel hatlarıyla birbirinizi gayet iyi tanıyorsunuz ama hâlâ keşfedilmeyi bekleyen gizli köşeler ve sürprizler var!"
  },
  40: {
    title: "🤔 Biraz Daha Sohbet Etmeniz Lazım... (%40)",
    desc: "Yarı yarıya bile değil! Galiba buluştuğunuzda sadece havadan sudan konuşuyorsunuz. Bir kahve içip derin konulara girme vakti gelmiş."
  },
  20: {
    title: "🥶 Sokaktan geçen birine sorsak daha çok bilirdi... (%20)",
    desc: "Sanırım birbirinizi tanıdığınızı sadece zannediyormuşsunuz. Acilen tanışma faslını baştan alın!"
  },
  0: {
    title: "💀 Tam Bir Felaket! Sıfır Çektiniz! (%0)",
    desc: "Gözlerinizi kapatıp rastgele bassaydınız bile en azından 1 tanesi tutardı. Siz tanıştığınıza emin misiniz?!"
  }
};

// ---------------- WEB AUDIO API SES EFEKTLERİ ----------------
function playSoundEffect(type) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'pop') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.11);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.17);
    } else if (type === 'correct') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.09);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.29);
    } else if (type === 'wrong') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(150, now + 0.22);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.26);
    }
  } catch (e) {}
}

// ---------------- ÇEREZ (COOKIE), 7 GÜNLÜK MİSAFİR TAKİBİ & KALICI KİMLİK YÖNETİMİ ----------------
function setCookie(name, value, days = 365) {
  try {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
  } catch (e) {}
}

function getCookie(name) {
  try {
    const cname = name + "=";
    const rawCookie = document.cookie || '';
    const ca = rawCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i].trim();
      if (c.indexOf(cname) === 0) {
        return decodeURIComponent(c.substring(cname.length, c.length));
      }
    }
  } catch (e) {}
  return "";
}

function deleteCookie(name) {
  try {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
  } catch (e) {}
}

function generatePersonalFriendCode() {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `SNC-${digits}`;
}

function persistIdentityToStorage() {
  userProfile.level = Math.max(1, Math.floor((userProfile.xp || 0) / 100) + 1);
  if (!userProfile.lastXpActivityAt) {
    userProfile.lastXpActivityAt = Date.now();
  }
  const isMember =
    Boolean(userProfile.isPermanentMember) ||
    (userProfile.provider && !['guest', 'Misafir'].includes(userProfile.provider) && Boolean(userProfile.email));
  userProfile.isPermanentMember = isMember;

  // 1. Tam profili localStorage içine kaydet
  try {
    localStorage.setItem('senceo_user_profile', JSON.stringify(userProfile));
  } catch (e) {}

  // 2. Hafif (<260 byte) çekirdek kimlik çerezini kaydet (4KB tarayıcı çerez sınırına ASLA takılmaz!)
  // Misafirler için 7 gün, Kalıcı Üyeler için 365 gün saklanır!
  const compactIdentity = {
    id: userProfile.id,
    friendCode: userProfile.friendCode,
    username: userProfile.username,
    email: userProfile.email,
    provider: userProfile.provider,
    isLoggedIn: userProfile.isLoggedIn,
    isPermanentMember: userProfile.isPermanentMember,
    avatar: userProfile.avatar,
    xp: userProfile.xp,
    level: userProfile.level,
    gamesPlayed: userProfile.gamesPlayed,
    questionsCorrect: userProfile.questionsCorrect,
    lastXpActivityAt: userProfile.lastXpActivityAt
  };
  const cookieDays = userProfile.isPermanentMember ? 365 : 7;
  setCookie('senceo_identity_v7', JSON.stringify(compactIdentity), cookieDays);
  setCookie('senceo_user_session', JSON.stringify(compactIdentity), cookieDays);

  // 3. Sekme içi yedek (window.name) — çerez/localStorage kısıtlı gömülü tarayıcılarda bile davet linkine tıklayınca SNC-XXXX kodunu korur!
  try {
    window.name = `SENCEO_ID:${JSON.stringify(compactIdentity)}`;
  } catch (e) {}
}

function loadUserProfile() {
  let loadedObj = null;

  // 1. Önce tam localStorage verisini oku
  try {
    const localData = localStorage.getItem('senceo_user_profile');
    if (localData) {
      loadedObj = JSON.parse(localData);
    }
  } catch (e) {}

  // 2. Çekirdek kimlik çerezini oku ve eksik alanları tamamla
  try {
    const idCookie = getCookie('senceo_identity_v7') || getCookie('senceo_user_session');
    if (idCookie) {
      const parsedCookie = JSON.parse(idCookie);
      loadedObj = Object.assign({}, parsedCookie, loadedObj || {});
      // Eğer çerezde geçerli friendCode veya username varsa onu koru
      if (parsedCookie.friendCode && !loadedObj.friendCode) loadedObj.friendCode = parsedCookie.friendCode;
      if (parsedCookie.username && (!loadedObj.username || loadedObj.username === 'Misafir Oyuncu')) {
        loadedObj.username = parsedCookie.username;
      }
    }
  } catch (e) {}

  // 3. Sekme içi window.name yedeğini kontrol et
  if (!loadedObj || !loadedObj.friendCode) {
    try {
      if (window.name && window.name.startsWith('SENCEO_ID:')) {
        const parsedWin = JSON.parse(window.name.slice('SENCEO_ID:'.length));
        loadedObj = Object.assign({}, parsedWin, loadedObj || {});
      }
    } catch (e) {}
  }

  // 4. 7 GÜNLÜK MİSAFİR TAKİBİ: Eğer kullanıcı kalıcı üye değilse (Misafir) ve 7 gün boyunca hiç puanı artmadıysa verilerini sıfırla!
  if (loadedObj) {
    const isMember =
      Boolean(loadedObj.isPermanentMember) ||
      (loadedObj.provider && !['guest', 'Misafir'].includes(loadedObj.provider) && Boolean(loadedObj.email));
    const lastAct = Number(loadedObj.lastXpActivityAt) || Date.now();
    if (!isMember && Date.now() - lastAct > SEVEN_DAYS_MS) {
      loadedObj = null;
      deleteCookie('senceo_identity_v7');
      deleteCookie('senceo_user_session');
      try {
        localStorage.removeItem('senceo_user_profile');
        localStorage.removeItem('senceo_my_rooms_index');
      } catch (e) {}
    }
  }

  if (loadedObj) {
    Object.assign(userProfile, loadedObj);
  }

  if (!userProfile.id) {
    userProfile.id = 'USR_' + Math.random().toString(36).substring(2, 9).toUpperCase();
  }
  if (!userProfile.friendCode || !userProfile.friendCode.startsWith('SNC-')) {
    userProfile.friendCode = generatePersonalFriendCode();
  }
  if (!userProfile.createdAt) {
    userProfile.createdAt = new Date().toISOString();
  }
  if (!userProfile.lastXpActivityAt) {
    userProfile.lastXpActivityAt = Date.now();
  }
  if (!Array.isArray(userProfile.incomingRequests)) {
    userProfile.incomingRequests = [];
  }
  if (!Array.isArray(userProfile.notifications)) {
    userProfile.notifications = [];
  }

  if (userProfile.bonds && typeof userProfile.bonds === 'object') {
    Object.keys(userProfile.bonds).forEach((k) => {
      const b = userProfile.bonds[k];
      if (!b || ((b.matches || 0) === 0 && !b.code)) {
        delete userProfile.bonds[k];
      }
    });
  } else {
    userProfile.bonds = {};
  }

  // KRİTİK DÜZELTME: Sayfa ilk açıldığında üretilen SNC-XXXX kodu ANINDA localStorage ve Çereze kaydedilir!
  // Böylece SNC-2112 olan bir misafir başka bir davet linkine tıkladığında ASLA SNC-3394'e dönüşmez!
  persistIdentityToStorage();
  renderProfileUI();
}

function saveUserProfile(skipCloudSync = false) {
  persistIdentityToStorage();
  renderProfileUI();

  if (!skipCloudSync) {
    fetch('/api/rooms', {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({ type: 'profile', profile: userProfile })
    }).catch(() => {});
  }
}

// ---------------- BULUT ARKADAŞLIK İSTEKLERİ, BİLDİRİMLER & AKTİF ODA SENKRONİZASYONU ----------------
async function syncCloudFriendState(showFeedbackToast = false) {
  if (!userProfile.friendCode || !/^SNC-\d{4}$/i.test(userProfile.friendCode)) return;
  try {
    const res = await fetch(`/api/rooms?friendCode=${encodeURIComponent(userProfile.friendCode)}`, {
      method: 'GET',
      headers: getSupabaseHeaders()
    });
    if (!res.ok) return;
    const data = await res.json();
    const f = data && data.friend ? data.friend : null;
    if (!f) return;

    let changed = false;

    // 1. Gelen arkadaşlık bağı isteklerini senkronize et
    if (Array.isArray(f.incomingRequests)) {
      userProfile.incomingRequests = f.incomingRequests.filter((r) => r.status === 'pending');
      changed = true;
    }

    // 2. Kabul edilen arkadaşları Bağ Ağı (userProfile.bonds) içine işle
    if (Array.isArray(f.acceptedFriends)) {
      f.acceptedFriends.forEach((acc) => {
        if (!acc || !acc.code) return;
        const codeUpper = acc.code.toUpperCase();
        // Mevcut bond kaydını bul veya yeni oluştur
        let targetKey = Object.keys(userProfile.bonds).find(
          (k) => userProfile.bonds[k] && userProfile.bonds[k].code === codeUpper
        );
        const cleanName = acc.name && acc.name !== 'Oyuncu' ? acc.name : codeUpper;
        if (!targetKey) {
          targetKey = `${cleanName} (${codeUpper})`;
        }
        const existing = userProfile.bonds[targetKey] || {
          code: codeUpper,
          realName: cleanName,
          activeRoomCode: '',
          xp: 0,
          level: 1,
          matches: 0,
          commonAnswers: 0,
          lastPct: 0,
          status: 'accepted',
          verified: true
        };
        existing.status = 'accepted';
        if (acc.name && acc.name !== 'Oyuncu') {
          existing.realName = acc.name;
        }
        userProfile.bonds[targetKey] = existing;
        changed = true;
      });
    }

    // 3. Bulutta benim için açılmış aktif odaları (activeRooms) yerel listeme ve bağlarıma ekle!
    if (Array.isArray(f.activeRooms)) {
      for (const summary of f.activeRooms) {
        if (!summary || !summary.code) continue;
        // Eğer yerel listede yoksa veya güncellenmişse buluttan tam odayı çek
        const localRaw = localStorage.getItem(`senceo_room_${summary.code}`);
        const localRoom = localRaw ? JSON.parse(localRaw) : null;
        if (!localRoom || localRoom.status !== summary.status || localRoom.currentRound !== summary.currentRound) {
          const fullRoom = await fetchRoomFromDatabase(summary.code);
          if (fullRoom) {
            changed = true;
          }
        } else {
          saveRoomToLocalLobbyList(localRoom);
        }

        // Eğer karşı tarafın arkadaş kodu bağlarımızda varsa activeRoomCode güncelle
        const partnerCode =
          summary.p1FriendCode && summary.p1FriendCode.toUpperCase() !== userProfile.friendCode.toUpperCase()
            ? summary.p1FriendCode.toUpperCase()
            : summary.p2FriendCode && summary.p2FriendCode.toUpperCase() !== userProfile.friendCode.toUpperCase()
            ? summary.p2FriendCode.toUpperCase()
            : '';

        if (partnerCode) {
          const bondKey = Object.keys(userProfile.bonds).find(
            (k) => userProfile.bonds[k] && userProfile.bonds[k].code === partnerCode
          );
          if (bondKey && userProfile.bonds[bondKey]) {
            userProfile.bonds[bondKey].activeRoomCode = summary.code;
            if (summary.p1 && summary.p1FriendCode === partnerCode && summary.p1 !== 'Arkadaşın') {
              userProfile.bonds[bondKey].realName = summary.p1;
            }
          }
        }
      }
    }

    // 4. Bildirimleri senkronize et
    if (Array.isArray(f.notifications)) {
      const prevUnreadCount = (userProfile.notifications || []).filter((n) => !n.read).length;
      userProfile.notifications = f.notifications;
      const newUnreadCount = userProfile.notifications.filter((n) => !n.read).length;
      if (newUnreadCount > prevUnreadCount) {
        playSoundEffect('pop');
      }
      changed = true;
    }

    if (changed) {
      saveUserProfile(true);
      refreshActiveGamesLobby();
      renderNotificationsModalList();
    }
    if (showFeedbackToast) {
      spawnFloatingEmojiBurst('🔄');
    }
  } catch (e) {}
}

function startBackgroundCloudSync() {
  if (gameState.cloudSyncIntervalId) clearInterval(gameState.cloudSyncIntervalId);
  syncCloudFriendState(false);
  gameState.cloudSyncIntervalId = setInterval(() => {
    syncCloudFriendState(false);
  }, 6000);
}

// ---------------- BİLDİRİM MERKEZİ ("🔔 Bildirimler") ----------------
function toggleNotificationsModal(show) {
  const modal = document.getElementById('notifications-modal');
  if (!modal) return;
  if (show) {
    renderNotificationsModalList();
    modal.classList.remove('hidden');
    // Bildirimleri okundu olarak işaretle
    markNotificationsReadOnCloud(false);
  } else {
    modal.classList.add('hidden');
  }
}

async function markNotificationsReadOnCloud(clearAll = false) {
  if (!userProfile.friendCode) return;
  if (clearAll) {
    userProfile.notifications = [];
  } else if (Array.isArray(userProfile.notifications)) {
    userProfile.notifications.forEach((n) => (n.read = true));
  }
  saveUserProfile(true);
  renderNotificationsModalList();

  try {
    await fetch('/api/rooms', {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        action: 'clear_notifications',
        myCode: userProfile.friendCode,
        clearAll
      })
    });
  } catch (e) {}
}

function clearAllUserNotifications() {
  markNotificationsReadOnCloud(true);
}

function updateHeaderNotificationBadges() {
  const notifs = userProfile.notifications || [];
  const incomingReqs = userProfile.incomingRequests || [];
  const unreadCount = notifs.filter((n) => !n.read).length + incomingReqs.length;

  const dotEl = document.getElementById('nav-notif-dot');
  const countEl = document.getElementById('nav-notif-count');
  if (dotEl && countEl) {
    if (unreadCount > 0) {
      dotEl.classList.remove('hidden');
      countEl.classList.remove('hidden');
      countEl.textContent = String(unreadCount > 9 ? '9+' : unreadCount);
    } else {
      dotEl.classList.add('hidden');
      countEl.classList.add('hidden');
    }
  }

  const bondsReqBadge = document.getElementById('nav-bonds-req-count');
  if (bondsReqBadge) {
    if (incomingReqs.length > 0) {
      bondsReqBadge.textContent = String(incomingReqs.length);
      bondsReqBadge.classList.remove('hidden');
    } else {
      bondsReqBadge.classList.add('hidden');
    }
  }
}

function renderNotificationsModalList() {
  updateHeaderNotificationBadges();
  const listEl = document.getElementById('notifications-modal-list');
  if (!listEl) return;

  const reqs = userProfile.incomingRequests || [];
  const notifs = userProfile.notifications || [];

  if (reqs.length === 0 && notifs.length === 0) {
    listEl.innerHTML = `
      <div class="py-10 text-center space-y-2">
        <div class="w-12 h-12 mx-auto rounded-full stitch-subcard flex items-center justify-center text-muted-theme">
          <span class="material-symbols-outlined text-[24px]">notifications_off</span>
        </div>
        <div class="font-bold text-sm">Henüz yeni bir bildirimin yok</div>
        <p class="text-xs text-muted-theme max-w-xs mx-auto">
          Birisi seni arkadaş koduyla (<strong>${escapeHtml(userProfile.friendCode)}</strong>) eklediğinde veya düello başlattığında anında burada görünür.
        </p>
      </div>
    `;
    return;
  }

  let html = '';

  // 1. Bekleyen Arkadaşlık Bağı İstekleri en üstte
  reqs.forEach((r) => {
    const fCode = r.fromCode || '';
    const fName = r.fromName || 'Oyuncu';
    html += `
      <div class="p-3.5 rounded-xl stitch-subcard border-2 border-[var(--primary)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-start gap-2.5">
          <div class="w-9 h-9 rounded-full bg-primary-theme flex items-center justify-center font-bold text-xs shrink-0">
            🤝
          </div>
          <div>
            <div class="font-bold text-xs sm:text-sm">Yeni Arkadaşlık Bağı İsteği!</div>
            <p class="text-xs text-muted-theme">
              <strong>${escapeHtml(fName)}</strong> (<span class="font-mono-theme text-primary-theme">${escapeHtml(fCode)}</span>) seni Bağ Ağına eklemek istiyor.
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onclick="respondToFriendRequest('${escapeHtml(fCode)}', '${escapeHtml(fName)}', 'accept')"
            class="px-3 py-1.5 rounded-lg bg-emerald-500 text-white font-bold text-xs hover:opacity-90 transition"
          >
            ✓ Kabul Et
          </button>
          <button
            type="button"
            onclick="respondToFriendRequest('${escapeHtml(fCode)}', '${escapeHtml(fName)}', 'reject')"
            class="px-2.5 py-1.5 rounded-lg bg-red-500/15 text-red-500 font-bold text-xs hover:bg-red-500/25 transition"
          >
            ✕ Reddet
          </button>
        </div>
      </div>
    `;
  });

  // 2. Diğer tüm bildirimler (Düello daveti, sıra sende, hatırlatma, kabul onayı)
  notifs.forEach((n) => {
    if (n.type === 'friend_request' && reqs.some((r) => r.fromCode === n.fromCode)) {
      return; // Yukarıda zaten aktif kart olarak gösterildi
    }
    const icon =
      n.type === 'challenge'
        ? '⚔️'
        : n.type === 'turn'
        ? '🔥'
        : n.type === 'completed'
        ? '🏆'
        : n.type === 'nudge'
        ? '⏰'
        : n.type === 'friend_accepted'
        ? '🎉'
        : '🔔';

    const actionBtn = n.roomCode
      ? `<button
           type="button"
           onclick="toggleNotificationsModal(false); openRoomFromLobbyCard('${escapeHtml(n.roomCode)}')"
           class="theme-btn-primary px-3 py-1.5 text-xs shrink-0 flex items-center gap-1"
         >
           <span>Odayı Aç (#${escapeHtml(n.roomCode)})</span>
           <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
         </button>`
      : n.fromCode && n.type === 'friend_accepted'
      ? `<button
           type="button"
           onclick="toggleNotificationsModal(false); switchTopNavPage('bonds')"
           class="theme-btn-secondary px-3 py-1.5 text-xs shrink-0"
         >
           Bağlarıma Git
         </button>`
      : '';

    html += `
      <div class="p-3.5 rounded-xl stitch-subcard flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-start gap-2.5">
          <div class="w-9 h-9 rounded-full stitch-card flex items-center justify-center text-base shrink-0">
            ${icon}
          </div>
          <div>
            <div class="font-bold text-xs sm:text-sm">${escapeHtml(n.title || 'Bildirim')}</div>
            <p class="text-xs text-muted-theme">${escapeHtml(n.message || '')}</p>
          </div>
        </div>
        ${actionBtn}
      </div>
    `;
  });

  listEl.innerHTML = html;
}

// Gelen Arkadaşlık Bağı İsteğini Kabul / Reddetme
async function respondToFriendRequest(requesterCode, requesterName, decision) {
  const cleanCode = String(requesterCode || '').trim().toUpperCase();
  const cleanName = String(requesterName || 'Arkadaşın').trim();
  if (!cleanCode) return;

  userProfile.incomingRequests = (userProfile.incomingRequests || []).filter((r) => r.fromCode !== cleanCode);

  if (decision === 'accept') {
    const bondKey = `${cleanName} (${cleanCode})`;
    const existing = userProfile.bonds[bondKey] || {
      code: cleanCode,
      realName: cleanName,
      activeRoomCode: '',
      xp: 0,
      level: 1,
      matches: 0,
      commonAnswers: 0,
      lastPct: 0,
      status: 'accepted',
      verified: true
    };
    existing.status = 'accepted';
    existing.realName = cleanName;
    userProfile.bonds[bondKey] = existing;
    spawnFloatingEmojiBurst('🤝');
    playSoundEffect('correct');
  }

  saveUserProfile(true);
  renderProfileUI();
  renderNotificationsModalList();

  try {
    await fetch('/api/rooms', {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        action: 'respond_friend_request',
        myCode: userProfile.friendCode,
        myName: userProfile.username || gameState.player1Name || 'Oyuncu',
        requesterCode: cleanCode,
        requesterName: cleanName,
        decision
      })
    });
    // Karşı tarafın aktif bir düellosu varsa hemen çek!
    if (decision === 'accept') {
      const lookup = await fetchActiveRoomByFriendCode(cleanCode);
      if (lookup && lookup.room) {
        const bondKey = `${cleanName} (${cleanCode})`;
        if (userProfile.bonds[bondKey]) {
          userProfile.bonds[bondKey].activeRoomCode = lookup.room.code;
          saveUserProfile(true);
        }
        refreshActiveGamesLobby();
      }
    }
  } catch (e) {}
}

// ---------------- FOOTER REHBER MODALI (Nasıl Oynanır / Topluluk / Gizlilik) ----------------
function openInfoGuideModal(section) {
  const modal = document.getElementById('info-guide-modal');
  const titleEl = document.getElementById('info-guide-title');
  const bodyEl = document.getElementById('info-guide-body');
  if (!modal || !titleEl || !bodyEl) return;

  if (section === 'community') {
    titleEl.textContent = '🤝 senceo Topluluk İlkeleri';
    bodyEl.innerHTML = `
      <p><strong>1. Samimiyet ve Eğlence:</strong> senceo, arkadaşların birbirini ne kadar tanıdığını ölçen sosyal bir uyum arenasıdır. Özel şık ve sohbet balonlarında esprili ve saygılı olun.</p>
      <p><strong>2. Doğrulanmış Bağlar:</strong> Arkadaşlık bağı seviyeleri yalnızca gerçek arkadaş kodu (<code>SNC-XXXX</code>) veya ortak tamamlanan düellolarla yükselir.</p>
      <p><strong>3. Adil Oyun:</strong> Simülasyon test modu yalnızca kendi sorularınızı kontrol etmeniz içindir ve gerçek uyum puanlarını etkilemez.</p>
    `;
  } else if (section === 'privacy') {
    titleEl.textContent = '🔒 Gizlilik & Veri Güvenliği';
    bodyEl.innerHTML = `
      <p><strong>1. Çerez ve Oturum Koruma:</strong> senceo Seviyeniz, TP ilerlemeniz ve Arkadaş Kodunuz tarayıcı çerezleri ve bulut oda indeksleriyle korunur.</p>
      <p><strong>2. Oda ve Diyalog Verileri:</strong> Düellolarda verdiğiniz cevaplar ve bıraktığınız gizli sohbet balonları yalnızca ilgili oda koduna sahip arkadaşınızla paylaşılır.</p>
    `;
  } else {
    titleEl.textContent = '🎮 senceo Nasıl Oynanır?';
    bodyEl.innerHTML = `
      <p><strong>1. Klasik Oyun (2 Yarı Karşılıklı Düello):</strong> Sen kendinle ilgili 5 soruyu cevaplarsın (istersen 2 kez soru değiştirebilir, 1 kez pas geçebilir, 1 kez kendi özel şıkkını yazabilir ve gizli sohbet balonu bırakabilirsin). Arkadaşın senin 5 cevabını tahmin eder ve hemen ardından <strong>Karşı Saldırı (2. Yarı)</strong> başlar: O kendi 5 sorusunu cevaplar, sen tahmin edersin!</p>
      <p><strong>2. Yan Yana (Pass &amp; Play):</strong> Tek bir telefon veya bilgisayarı elden ele devrederek internet/link paylaşımına gerek kalmadan yüz yüze oynanan moddur.</p>
      <p><strong>3. Canlı Oda Kur:</strong> Sorular başlamadan önce 6 haneli bir <strong>Canlı Oda Kodu</strong> üretilir. Arkadaşların bu kodu girerek lobiye katılır ve gerçek zamanlı yarışır.</p>
      <p><strong>4. Arkadaş Kodu (SNC-XXXX):</strong> <em>Bağlarım</em> sekmesinden arkadaşının kodunu eklediğinde karşı tarafa bildirim ve bağ isteği gider; aktif düellolarınıza tek tıkla katılabilirsiniz.</p>
    `;
  }
  modal.classList.remove('hidden');
}

function closeInfoGuideModal() {
  const modal = document.getElementById('info-guide-modal');
  if (modal) modal.classList.add('hidden');
}

// ---------------- GERÇEK SOSYAL GİRİŞ / OAUTH MODALI ----------------
function openSocialLoginModal(providerName) {
  gameState.pendingOAuthProvider = providerName;

  const modal = document.getElementById('oauth-login-modal');
  const badge = document.getElementById('oauth-modal-badge');
  const title = document.getElementById('oauth-modal-title');
  const submitText = document.getElementById('oauth-submit-btn-text');
  const emailInput = document.getElementById('input-oauth-email');
  const nameInput = document.getElementById('input-oauth-username');
  const errEl = document.getElementById('oauth-modal-error');
  const quickList = document.getElementById('oauth-quick-accounts-list');

  if (!modal) return;
  if (errEl) errEl.classList.add('hidden');

  if (providerName === 'Google') {
    badge.textContent = 'G';
    badge.className = 'w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center font-extrabold text-lg shadow';
    title.textContent = 'Google ile Giriş Yap';
    submitText.textContent = 'Google Hesabıyla Bağlan';
    if (emailInput) emailInput.placeholder = 'adiniz@gmail.com';
  } else if (providerName === 'Facebook') {
    badge.textContent = 'f';
    badge.className = 'w-10 h-10 rounded-xl bg-[#1877F2] text-white flex items-center justify-center font-extrabold text-lg shadow';
    title.textContent = 'Facebook ile Giriş Yap';
    submitText.textContent = 'Facebook ile Devam Et';
    if (emailInput) emailInput.placeholder = 'adiniz@facebook.com';
  } else {
    badge.textContent = '☁️';
    badge.className = 'w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center font-extrabold text-lg shadow';
    title.textContent = 'iCloud / Apple ID ile Giriş Yap';
    submitText.textContent = 'Apple ID ile Bağlan';
    if (emailInput) emailInput.placeholder = 'adiniz@icloud.com';
  }

  const p1Input = document.getElementById('input-p1-name');
  const currentDraftName = (p1Input && p1Input.value.trim()) || (userProfile.isLoggedIn ? userProfile.username : '');
  if (nameInput) nameInput.value = currentDraftName;
  if (emailInput) emailInput.value = userProfile.email || '';

  if (quickList) {
    quickList.innerHTML = '';
    let savedAccounts = [];
    try {
      savedAccounts = JSON.parse(localStorage.getItem('senceo_saved_oauth_accounts') || '[]');
    } catch (e) {}

    if (savedAccounts.length === 0 && currentDraftName) {
      const domain = providerName === 'Google' ? 'gmail.com' : providerName === 'Facebook' ? 'facebook.com' : 'icloud.com';
      const slug = currentDraftName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'oyuncu';
      savedAccounts = [{ name: currentDraftName, email: `${slug}@${domain}`, provider: providerName }];
    }

    savedAccounts.slice(0, 2).forEach((acc) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'w-full p-2.5 rounded-xl stitch-subcard hover:border-[var(--primary)] flex items-center justify-between text-left transition';
      btn.innerHTML = `
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-full bg-primary-theme flex items-center justify-center font-bold text-xs">
            ${escapeHtml(acc.name.slice(0, 2).toUpperCase())}
          </div>
          <div>
            <div class="font-bold text-xs">${escapeHtml(acc.name)}</div>
            <div class="text-[11px] text-muted-theme">${escapeHtml(acc.email)}</div>
          </div>
        </div>
        <span class="text-xs font-bold text-primary-theme">Seç ➔</span>
      `;
      btn.addEventListener('click', () => {
        completeSocialLogin(providerName, acc.name, acc.email);
      });
      quickList.appendChild(btn);
    });
  }

  modal.classList.remove('hidden');
  if (emailInput && !emailInput.value) {
    emailInput.focus();
  } else if (nameInput) {
    nameInput.focus();
  }
}

function closeSocialLoginModal() {
  gameState.pendingOAuthProvider = null;
  const modal = document.getElementById('oauth-login-modal');
  if (modal) modal.classList.add('hidden');
}

function confirmSocialLoginSubmit(event) {
  if (event) event.preventDefault();
  const provider = gameState.pendingOAuthProvider || 'Google';
  const emailInput = document.getElementById('input-oauth-email');
  const nameInput = document.getElementById('input-oauth-username');
  const errEl = document.getElementById('oauth-modal-error');

  const email = emailInput ? emailInput.value.trim() : '';
  const name = nameInput ? nameInput.value.trim() : '';

  if (!email || !email.includes('@')) {
    if (errEl) {
      errEl.textContent = '⚠️ Lütfen geçerli bir e-posta adresi girin.';
      errEl.classList.remove('hidden');
    }
    return;
  }

  if (!name || name.length < 2) {
    if (errEl) {
      errEl.textContent = '⚠️ Lütfen en az 2 karakterli bir oyuncu adı girin.';
      errEl.classList.remove('hidden');
    }
    return;
  }

  completeSocialLogin(provider, name, email);
}

function completeSocialLogin(providerName, chosenName, chosenEmail) {
  userProfile.username = chosenName;
  userProfile.email = chosenEmail;
  userProfile.provider = providerName;
  userProfile.isLoggedIn = true;
  userProfile.isPermanentMember = true;
  userProfile.lastXpActivityAt = Date.now();
  userProfile.avatar = providerName === 'Google' ? '🔥' : providerName === 'Facebook' ? '⚡' : '☁️';

  try {
    const raw = localStorage.getItem('senceo_saved_oauth_accounts') || '[]';
    const list = JSON.parse(raw).filter((a) => a.email !== chosenEmail);
    list.unshift({ name: chosenName, email: chosenEmail, provider: providerName });
    localStorage.setItem('senceo_saved_oauth_accounts', JSON.stringify(list.slice(0, 3)));
  } catch (e) {}

  const p1Input = document.getElementById('input-p1-name');
  if (p1Input) p1Input.value = chosenName;
  gameState.player1Name = chosenName;

  closeSocialLoginModal();
  saveUserProfile();
  spawnFloatingEmojiBurst('✅');
}

function continueWithoutRegistration() {
  const p1Input = document.getElementById('input-p1-name');
  const chosenName = p1Input && p1Input.value.trim() ? p1Input.value.trim() : (userProfile.username || 'Misafir Oyuncu');
  userProfile.username = chosenName;
  userProfile.provider = 'Misafir';
  userProfile.isLoggedIn = true;
  userProfile.isPermanentMember = false;
  userProfile.lastXpActivityAt = userProfile.lastXpActivityAt || Date.now();
  if (p1Input && !p1Input.value.trim() && chosenName !== 'Misafir Oyuncu') {
    p1Input.value = chosenName;
  }
  saveUserProfile();
}

function logoutUserAccount() {
  deleteCookie('senceo_user_session');
  try {
    localStorage.removeItem('senceo_user_profile');
  } catch (e) {}

  userProfile.username = '';
  userProfile.email = '';
  userProfile.provider = 'guest';
  userProfile.isLoggedIn = false;
  userProfile.isPermanentMember = false;
  userProfile.xp = 0;
  userProfile.level = 1;
  userProfile.lastXpActivityAt = Date.now();
  persistIdentityToStorage();
  renderProfileUI();
  toggleProfileModal(false);
}

// ---------------- ÇİFT YÖNLÜ ARKADAŞ KODU İLE BAĞ EKLEME & AKTİF DÜELLO BULMA ----------------
function getBondTitle(level, matches, status) {
  if (status === 'accepted' && (!matches || matches <= 0)) return '✓ Bağ Kuruldu';
  if (!matches || matches <= 0) return '⏳ İstek Gönderildi';
  if (level >= 4) return 'Ruh İkizi';
  if (level >= 2) return 'Kanka';
  return 'Tanışık';
}

function addPersonalAndBondXP(partnerName, correctAnswersCount, matchPercentage = 80, roomCode = '') {
  const gainedXp = Math.max(25, correctAnswersCount * 30);
  userProfile.xp = (userProfile.xp || 0) + gainedXp;
  userProfile.gamesPlayed = (userProfile.gamesPlayed || 0) + 1;
  userProfile.questionsCorrect = (userProfile.questionsCorrect || 0) + correctAnswersCount;
  userProfile.lastXpActivityAt = Date.now();

  let bondInfo = { xp: gainedXp, level: 1, matches: 1, lastPct: matchPercentage };
  const cleanPartner = (partnerName || '').trim();
  if (cleanPartner && cleanPartner !== 'Oyuncu 2') {
    if (!userProfile.friends.includes(cleanPartner)) {
      userProfile.friends.push(cleanPartner);
    }

    // Eğer partnerin arkadaş koduyla açılmış bir bond kaydı varsa onu bul
    let targetBondKey = cleanPartner;
    if (gameState.player2FriendCode) {
      const foundKey = Object.keys(userProfile.bonds).find(
        (k) => userProfile.bonds[k] && userProfile.bonds[k].code === gameState.player2FriendCode
      );
      if (foundKey) targetBondKey = foundKey;
    }

    const existing = userProfile.bonds[targetBondKey] || {
      code: gameState.player2FriendCode || (roomCode ? `ODA:${roomCode}` : 'DOĞRULANDI'),
      realName: cleanPartner,
      activeRoomCode: roomCode || '',
      xp: 0,
      level: 1,
      matches: 0,
      commonAnswers: 0,
      lastPct: matchPercentage,
      status: 'accepted',
      verified: true
    };
    existing.xp = (existing.xp || 0) + gainedXp;
    existing.matches = (existing.matches || 0) + 1;
    existing.commonAnswers = (existing.commonAnswers || 0) + correctAnswersCount;
    existing.lastPct = matchPercentage;
    existing.status = 'accepted';
    if (roomCode) existing.activeRoomCode = roomCode;
    existing.verified = true;
    existing.level = Math.max(1, Math.floor(existing.xp / 100) + 1);
    userProfile.bonds[targetBondKey] = existing;
    bondInfo = existing;
  }

  saveUserProfile();
  return { gainedXp, personalLevel: userProfile.level, bondLevel: bondInfo.level, bondMatches: bondInfo.matches };
}

// Arkadaş Kodu (Örn: SNC-2281) üzerinden buluttaki veya yereldeki aktif düelloyu sorgula
async function fetchActiveRoomByFriendCode(friendCode) {
  const cleanFCode = String(friendCode || '').trim().toUpperCase();
  if (!/^SNC-\d{4}$/.test(cleanFCode)) return null;

  try {
    const res = await fetch(`/api/rooms?friendCode=${encodeURIComponent(cleanFCode)}`, {
      method: 'GET',
      headers: getSupabaseHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.room) {
        saveRoomToLocalLobbyList(data.room);
        return { room: data.room, friend: data.friend };
      }
      if (data && data.friend) {
        return { room: null, friend: data.friend };
      }
    }
  } catch (e) {}

  try {
    const codes = JSON.parse(localStorage.getItem('senceo_my_rooms_index') || '[]');
    for (const c of codes) {
      const rRaw = localStorage.getItem(`senceo_room_${c}`);
      if (!rRaw) continue;
      const r = JSON.parse(rRaw);
      if (
        r &&
        ((r.p1FriendCode && r.p1FriendCode.toUpperCase() === cleanFCode) ||
          (r.p2FriendCode && r.p2FriendCode.toUpperCase() === cleanFCode))
      ) {
        return { room: r, friend: { friendCode: cleanFCode, username: r.p1 } };
      }
    }
  } catch (e) {}

  return null;
}

// Arkadaş Kodu (SNC-XXXX) veya Oda Kodu (SNCXXX) ile Bağ Ekleme (Karşı tarafa da anında istek ve bildirim gönderir!)
async function addVerifiedFriendByCode(inputId, feedbackId) {
  const inp = document.getElementById(inputId);
  const feedbackEl = document.getElementById(feedbackId);
  if (!inp) return;

  const rawVal = inp.value.trim().toUpperCase();
  const showFeedback = (msg, isError) => {
    if (!feedbackEl) return;
    feedbackEl.textContent = msg;
    feedbackEl.className = `text-xs font-bold ${isError ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`;
    feedbackEl.classList.remove('hidden');
  };

  if (!rawVal) {
    showFeedback('⚠️ Lütfen bir Arkadaş Kodu (Örn: SNC-2281) veya Oda Kodu (Örn: SNC123) girin.', true);
    return;
  }

  if (rawVal === userProfile.friendCode) {
    showFeedback('⚠️ Bu senin kendi Arkadaş Kodun! Arkadaşının kodunu girmelisin.', true);
    return;
  }

  // 1. Durum: SNC-XXXX formatında Arkadaş Kodu girildiyse -> Karşı tarafa da Bağ İsteği Gönder + Aktif Düellosunu Bul!
  const friendCodeRegex = /^SNC-\d{4}$/;
  if (friendCodeRegex.test(rawVal)) {
    showFeedback('⏳ Arkadaşlık bağı isteği gönderiliyor ve aktif düellolar taranıyor...', false);

    const myDisplayName =
      (userProfile.username && userProfile.username !== 'Misafir Oyuncu' ? userProfile.username : '') ||
      gameState.player1Name.trim() ||
      `Oyuncu (${userProfile.friendCode})`;

    let targetFriend = null;
    let activeRoom = null;

    try {
      const reqRes = await fetch('/api/rooms', {
        method: 'POST',
        headers: getSupabaseHeaders(),
        body: JSON.stringify({
          action: 'send_friend_request',
          fromCode: userProfile.friendCode,
          fromName: myDisplayName,
          toCode: rawVal
        })
      });
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        targetFriend = reqData.targetFriend || null;
        activeRoom = reqData.room || null;
        if (activeRoom) {
          saveRoomToLocalLobbyList(activeRoom);
        }
      }
    } catch (e) {}

    if (!activeRoom) {
      const lookup = await fetchActiveRoomByFriendCode(rawVal);
      if (lookup) {
        if (lookup.room) activeRoom = lookup.room;
        if (lookup.friend && !targetFriend) targetFriend = lookup.friend;
      }
    }

    const discoveredName =
      (activeRoom && activeRoom.p1 && activeRoom.p1FriendCode === rawVal ? activeRoom.p1 : '') ||
      (targetFriend && targetFriend.username && targetFriend.username !== 'Oyuncu' ? targetFriend.username : '') ||
      rawVal;

    const bondKey = discoveredName !== rawVal ? `${discoveredName} (${rawVal})` : `Oyuncu (${rawVal})`;
    const existing = userProfile.bonds[bondKey] || {
      code: rawVal,
      realName: discoveredName,
      activeRoomCode: activeRoom ? activeRoom.code : '',
      xp: 0,
      level: 0,
      matches: 0,
      commonAnswers: 0,
      lastPct: 0,
      status: 'pending',
      verified: true
    };

    if (activeRoom && activeRoom.code) {
      existing.activeRoomCode = activeRoom.code;
      if (activeRoom.p1 && activeRoom.p1FriendCode === rawVal) {
        existing.realName = activeRoom.p1;
      }
    }

    userProfile.bonds[bondKey] = existing;
    inp.value = '';
    saveUserProfile();
    refreshActiveGamesLobby();

    if (activeRoom && activeRoom.code) {
      showFeedback(
        `✅ ${bondKey} için arkadaşlık isteği gönderildi ve aktif düellosu (#${activeRoom.code}) bulundu! "Düelloya Katıl ⚡" butonuna basarak hemen 5 sorusunu tahmin edebilirsin!`,
        false
      );
    } else {
      showFeedback(
        `✅ ${bondKey} hesabına Arkadaşlık Bağı İsteği ve bildirim gönderildi! Yanındaki "Düello Başlat ⚡" butonuna basarak onun için hemen 5 soruluk düello başlatabilirsin.`,
        false
      );
    }
    return;
  }

  // 2. Durum: 6 Haneli Oda Kodu (Örn: SNC84K) girildiyse
  if (rawVal.startsWith('SNC') && rawVal.length >= 5) {
    showFeedback('⏳ Oda kodu veritabanından doğrulanıyor...', false);
    const room = await fetchRoomFromDatabase(rawVal);
    if (!room) {
      showFeedback(`❌ "${rawVal}" kodlu aktif bir oda bulunamadı!`, true);
      return;
    }

    const isP1 = isUserPlayer1OfRoom(room);
    const partnerName = !isP1 ? room.p1 : (room.p2 || room.p1 || `Oda #${rawVal}`);
    const pct = typeof room.lastMatchPercentage === 'number' ? room.lastMatchPercentage : 80;
    const corr = typeof room.lastCorrectCount === 'number' ? room.lastCorrectCount : 3;

    const existing = userProfile.bonds[partnerName] || {
      code: (!isP1 ? room.p1FriendCode : room.p2FriendCode) || `ODA:${rawVal}`,
      realName: partnerName,
      activeRoomCode: rawVal,
      xp: 0,
      level: 1,
      matches: 0,
      commonAnswers: 0,
      lastPct: pct,
      status: 'accepted',
      verified: true
    };
    existing.activeRoomCode = rawVal;

    if (room.status === 'completed') {
      existing.matches = Math.max(1, existing.matches + 1);
      existing.commonAnswers = (existing.commonAnswers || 0) + corr;
      existing.xp = Math.max(40, (existing.xp || 0) + corr * 25);
      existing.level = Math.max(1, Math.floor(existing.xp / 100) + 1);
      existing.lastPct = pct;
    }

    userProfile.bonds[partnerName] = existing;
    inp.value = '';
    saveUserProfile();
    showFeedback(`✅ Oda #${rawVal} doğrulandı! "${partnerName}" ile bağınız eklendi.`, false);
    return;
  }

  showFeedback(
    '⚠️ Rastgele isimle sahte seviye eklenemez! Lütfen arkadaşının "SNC-XXXX" Arkadaş Kodunu veya "SNC123" Oda Kodunu girin.',
    true
  );
}

// "Düello Başlat / Aktif Düelloya Katıl ⚡" Butonu Mantığı
async function startDuelWithFriend(bondKey) {
  toggleProfileModal(false);
  const bond = (userProfile.bonds && userProfile.bonds[bondKey]) || {};
  const fCode = bond.code && /^SNC-\d{4}$/i.test(bond.code) ? bond.code.toUpperCase() : '';

  // 1. Önce bu arkadaşın bulutta bekleyen ve bizim tahmin etmemiz gereken aktif bir düellosu var mı kontrol et!
  if (fCode) {
    const lookup = await fetchActiveRoomByFriendCode(fCode);
    if (lookup && lookup.room && !isUserPlayer1OfRoom(lookup.room)) {
      bond.activeRoomCode = lookup.room.code;
      if (lookup.room.p1) bond.realName = lookup.room.p1;
      saveUserProfile();
      loadRoomIntoGameState(lookup.room, false);
      return;
    }
  }

  // 2. Eğer bond üzerinde kayıtlı bir activeRoomCode varsa onu veritabanından çekip kontrol et!
  if (bond.activeRoomCode) {
    const room = await fetchRoomFromDatabase(bond.activeRoomCode);
    if (room) {
      // Eğer bu odayı karşı taraf kurduysa veya sıra bizdeyse doğrudan odaya gir!
      if (!isUserPlayer1OfRoom(room) || room.status === 'waiting_p1_half2' || room.status === 'completed') {
        loadRoomIntoGameState(room, false);
        return;
      }
    }
  }

  // 3. Arkadaş için yeni 5 soruluk düello başlat:
  // p2FriendCode olarak arkadaşın SNC-XXXX kodunu kaydet ki 5 soru bittiğinde karşı tarafın Aktif Oyunlar & Bildirimler ekranına otomatik düşsün!
  const cleanFriendName =
    bond.realName && bond.realName !== 'Arkadaşın' && bond.realName !== 'Oyuncu'
      ? bond.realName
      : fCode || bondKey.replace(/^Oyuncu\s*/i, '').trim() || 'Arkadaşın';

  const myName =
    userProfile.username && userProfile.username !== 'Misafir Oyuncu'
      ? userProfile.username
      : gameState.player1Name.trim() || `Oyuncu (${userProfile.friendCode})`;

  gameState.player1Name = myName;
  gameState.player2Name = cleanFriendName;
  gameState.player2FriendCode = fCode;
  gameState.mode = 'link';
  gameState.roomCode = '';
  gameState.isSandboxTest = false;

  const p1Input = document.getElementById('input-p1-name');
  const p2Input = document.getElementById('input-p2-name');
  if (p1Input) p1Input.value = myName;
  if (p2Input) p2Input.value = cleanFriendName;

  startClassicFirstHalf();
}

async function syncAllFriendActiveRooms() {
  await syncCloudFriendState(true);
  const keys = Object.keys(userProfile.bonds || {});
  for (const k of keys) {
    const b = userProfile.bonds[k];
    if (b && b.code && /^SNC-\d{4}$/i.test(b.code)) {
      const lookup = await fetchActiveRoomByFriendCode(b.code);
      if (lookup && lookup.room) {
        b.activeRoomCode = lookup.room.code;
        if (lookup.room.p1 && lookup.room.p1FriendCode === b.code) {
          b.realName = lookup.room.p1;
        }
      }
    }
  }
  saveUserProfile();
  refreshActiveGamesLobby();
}

function copyMyFriendInviteLink() {
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const myName = userProfile.username || gameState.player1Name || 'Arkadaşın';
  const inviteUrl = `${baseUrl}?friend=${encodeURIComponent(userProfile.friendCode)}&fname=${encodeURIComponent(myName)}`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      const toast = document.getElementById('friend-invite-copy-toast');
      if (toast) {
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3500);
      }
    });
  }
}

function checkIncomingFriendInvite() {
  const params = new URLSearchParams(window.location.search);
  const fCode = params.get('friend');
  const fName = params.get('fname');
  if (fCode && /^SNC-\d{4}$/i.test(fCode.trim())) {
    const codeUpper = fCode.trim().toUpperCase();
    if (codeUpper !== userProfile.friendCode) {
      const cleanName = fName && fName.trim() ? fName.trim() : codeUpper;
      const displayFriend = cleanName !== codeUpper ? `${cleanName} (${codeUpper})` : `Oyuncu (${codeUpper})`;
      if (!userProfile.bonds[displayFriend]) {
        userProfile.bonds[displayFriend] = {
          code: codeUpper,
          realName: cleanName,
          activeRoomCode: '',
          xp: 0,
          level: 0,
          matches: 0,
          commonAnswers: 0,
          lastPct: 0,
          status: 'accepted',
          verified: true
        };
        saveUserProfile();
      }
    }
  }
}

function renderProfileUI() {
  const displayName = userProfile.username || 'Misafir Oyuncu';
  const lvl = userProfile.level || 1;
  const xpTotal = userProfile.xp || 0;
  const xpInLevel = xpTotal % 100;

  // Üst bar kompakt profil rozeti
  const navName = document.getElementById('nav-profile-name');
  const navLvl = document.getElementById('nav-profile-level-badge');
  const navXp = document.getElementById('nav-profile-xp-label');
  if (navName) navName.textContent = displayName;
  if (navLvl) navLvl.textContent = `Seviye ${lvl}`;
  if (navXp) navXp.textContent = `${xpTotal} TP`;

  // Aktif Oyunlar sağ kolon profil kartı ("senceo Seviyen")
  const dName = document.getElementById('dash-card-profile-name');
  const dSub = document.getElementById('dash-card-profile-sub');
  const dLvl = document.getElementById('dash-card-level-pill');
  const dXpText = document.getElementById('dash-card-xp-text');
  const dXpBar = document.getElementById('dash-card-xp-bar');
  if (dName) dName.textContent = displayName;
  if (dSub) {
    dSub.textContent = `senceo Seviyen • LVL ${lvl} (${
      userProfile.isPermanentMember ? `Kalıcı Üye: ${userProfile.provider}` : 'Misafir • 7 Gün Korumalı'
    })`;
  }
  if (dLvl) dLvl.textContent = `LVL ${lvl}`;
  if (dXpText) dXpText.textContent = `${xpInLevel} / 100 XP`;
  if (dXpBar) dXpBar.style.width = `${Math.max(12, xpInLevel)}%`;

  // Arkadaş Kodu etiketleri
  const dashCode = document.getElementById('dashboard-my-friend-code');
  const modalCode = document.getElementById('modal-my-friend-code');
  if (dashCode) dashCode.textContent = userProfile.friendCode || 'SNC-0000';
  if (modalCode) modalCode.textContent = userProfile.friendCode || 'SNC-0000';

  // Ana sayfa üyelik kartı görünürlüğü
  const authCard = document.getElementById('home-auth-card');
  const loggedStrip = document.getElementById('home-logged-strip');
  if (authCard && loggedStrip) {
    if (userProfile.isLoggedIn) {
      authCard.classList.add('hidden');
      loggedStrip.classList.remove('hidden');
      const sName = document.getElementById('strip-user-name');
      const sProv = document.getElementById('strip-user-provider');
      if (sName) sName.textContent = displayName;
      if (sProv) sProv.textContent = userProfile.isPermanentMember ? `${userProfile.provider} (Kalıcı)` : 'Misafir (7 Gün)';
    } else {
      authCard.classList.remove('hidden');
      loggedStrip.classList.add('hidden');
    }
  }

  // Profil Modalı İçeriği + Misafir Puanını Kalıcı Üyeliğe Aktar Kartı
  const mName = document.getElementById('modal-profile-name');
  const mProv = document.getElementById('modal-profile-provider');
  const mLvl = document.getElementById('modal-personal-level');
  const mBar = document.getElementById('modal-personal-xp-bar');
  const mXpText = document.getElementById('modal-personal-xp-text');
  const mStats = document.getElementById('modal-personal-stats');
  const guestTransferCard = document.getElementById('guest-transfer-membership-card');
  const retentionBadge = document.getElementById('guest-retention-badge');

  const elapsedMs = Date.now() - Number(userProfile.lastXpActivityAt || Date.now());
  const daysLeft = Math.max(1, Math.ceil((GUEST_INACTIVITY_LIMIT_MS - elapsedMs) / (24 * 60 * 60 * 1000)));
  if (retentionBadge) retentionBadge.textContent = `${daysLeft} Gün Koruma`;

  if (guestTransferCard) {
    guestTransferCard.classList.toggle('hidden', Boolean(userProfile.isPermanentMember));
  }

  if (mName) mName.textContent = displayName;
  if (mProv) {
    mProv.textContent = userProfile.isPermanentMember
      ? `${userProfile.provider}${userProfile.email ? ` (${userProfile.email})` : ''} • Kalıcı Üye`
      : `Misafir Oturumu (${daysLeft} gün XP hareketsizlik süresi)`;
  }
  if (mLvl) mLvl.textContent = `LVL ${lvl}`;
  if (mBar) mBar.style.width = `${Math.max(10, xpInLevel)}%`;
  if (mXpText) mXpText.textContent = `${xpInLevel} / 100 XP (Toplam: ${xpTotal} XP)`;
  if (mStats) mStats.textContent = `${userProfile.questionsCorrect || 0} Doğru Tahmin • ${userProfile.gamesPlayed || 0} Oyun`;

  updateHeaderNotificationBadges();
  renderIncomingFriendRequestsUI();
  renderBondsLists();
}

function renderIncomingFriendRequestsUI() {
  const reqs = userProfile.incomingRequests || [];
  const pageCard = document.getElementById('incoming-friend-requests-card');
  const pageList = document.getElementById('incoming-friend-requests-list');
  const pageBadge = document.getElementById('incoming-req-badge');

  const modalBox = document.getElementById('modal-incoming-requests-box');
  const modalList = document.getElementById('modal-incoming-requests-list');

  if (reqs.length === 0) {
    if (pageCard) pageCard.classList.add('hidden');
    if (modalBox) modalBox.classList.add('hidden');
    return;
  }

  if (pageCard) pageCard.classList.remove('hidden');
  if (modalBox) modalBox.classList.remove('hidden');
  if (pageBadge) pageBadge.textContent = `${reqs.length} Yeni İstek`;

  const rowHtml = reqs
    .map((r) => {
      const fCode = r.fromCode || '';
      const fName = r.fromName || 'Oyuncu';
      return `
        <div class="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-full bg-primary-theme font-bold text-xs flex items-center justify-center shrink-0">
              ${escapeHtml(fName.slice(0, 2).toUpperCase())}
            </div>
            <div>
              <div class="font-bold text-xs sm:text-sm">${escapeHtml(fName)} <span class="font-mono-theme text-primary-theme">(${escapeHtml(fCode)})</span></div>
              <div class="text-[11px] text-muted-theme">Seni arkadaş bağlarına eklemek istiyor</div>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onclick="respondToFriendRequest('${escapeHtml(fCode)}', '${escapeHtml(fName)}', 'accept')"
              class="px-3 py-1.5 rounded-lg bg-emerald-500 text-white font-bold text-xs hover:opacity-90 transition shadow-sm"
            >
              ✓ Kabul Et
            </button>
            <button
              type="button"
              onclick="respondToFriendRequest('${escapeHtml(fCode)}', '${escapeHtml(fName)}', 'reject')"
              class="px-2.5 py-1.5 rounded-lg bg-red-500/15 text-red-500 font-bold text-xs hover:bg-red-500/25 transition"
            >
              ✕ Reddet
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  if (pageList) pageList.innerHTML = rowHtml;
  if (modalList) modalList.innerHTML = rowHtml;
}

function renderBondsLists() {
  const modalListEl = document.getElementById('profile-friends-bond-list');
  const dashListEl = document.getElementById('dashboard-bonds-list');
  const bondsPageListEl = document.getElementById('bonds-page-full-list');
  const allFriends = Object.keys(userProfile.bonds || {});

  const buildBondRowHTML = (fName, b, isCompact) => {
    const displayLabel =
      b.realName && b.realName !== 'Arkadaşın' && b.realName !== 'Oyuncu' && b.code && /^SNC-\d{4}$/.test(b.code)
        ? `${b.realName} (${b.code})`
        : fName;
    const initials = displayLabel.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ0-9]/g, '').slice(0, 2).toUpperCase() || 'OY';
    const isPending = (b.matches || 0) === 0;
    const hasActiveRoom = Boolean(b.activeRoomCode);
    const bondTitle = getBondTitle(b.level || 0, b.matches || 0, b.status);
    const btnText = hasActiveRoom ? `Düelloya Katıl (#${b.activeRoomCode}) ⚡` : 'Düello Başlat ⚡';

    return `
      <div class="py-2.5 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-10 h-10 rounded-full bg-[var(--primary-fixed)] text-primary-theme font-bold text-xs flex items-center justify-center shrink-0">
            ${escapeHtml(initials)}
          </div>
          <div class="min-w-0">
            <h5 class="font-bold text-xs sm:text-sm truncate">${escapeHtml(displayLabel)}</h5>
            <span class="text-[11px] text-muted-theme">
              ${
                hasActiveRoom
                  ? `🟢 Aktif Oda: #${escapeHtml(b.activeRoomCode)}`
                  : isPending
                  ? b.status === 'accepted'
                    ? 'Bağ onaylandı • İlk düelloyu başlat!'
                    : 'Arkadaşlık isteği gönderildi'
                  : `${b.commonAnswers || b.matches * 3} Ortak Yanıt • ${b.matches} Oyun`
              }
            </span>
          </div>
        </div>
        <div class="flex flex-col items-end gap-1 shrink-0">
          <span class="px-2 py-0.5 rounded-full stitch-subcard text-[10px] font-bold text-primary-theme">
            ${isPending ? bondTitle : `${bondTitle} (LVL ${b.level || 1})`}
          </span>
          <div class="flex items-center gap-2">
            ${!isPending && !isCompact ? `<span class="text-xs font-extrabold">%${b.lastPct || 80} Uyum</span>` : ''}
            <button
              type="button"
              onclick="startDuelWithFriend('${escapeHtml(fName)}')"
              class="px-2.5 py-1 rounded-lg bg-emerald-500 text-white font-bold text-[11px] hover:opacity-90 transition shadow-sm"
            >
              ${btnText}
            </button>
          </div>
        </div>
      </div>
    `;
  };

  if (modalListEl) {
    modalListEl.innerHTML = allFriends.length === 0
      ? `<div class="text-xs text-muted-theme italic py-2">Henüz doğrulanmış bir arkadaş bağın yok.</div>`
      : allFriends.map((fName) => buildBondRowHTML(fName, userProfile.bonds[fName] || {}, true)).join('');
  }

  if (dashListEl) {
    dashListEl.innerHTML = allFriends.length === 0
      ? `<div class="py-3 text-xs text-muted-theme text-center">Henüz arkadaş bağın yok. "Bağlarım" sekmesinden arkadaş kodu ekleyebilirsin.</div>`
      : allFriends.slice(0, 4).map((fName) => buildBondRowHTML(fName, userProfile.bonds[fName] || {}, false)).join('');
  }

  if (bondsPageListEl) {
    bondsPageListEl.innerHTML = allFriends.length === 0
      ? `<div class="py-8 text-sm text-muted-theme text-center">Henüz kayıtlı arkadaş bağın yok. Soldaki kutudan arkadaşının <strong>SNC-XXXX</strong> kodunu veya <strong>SNC123</strong> oda kodunu girerek hemen ekle!</div>`
      : allFriends.map((fName) => buildBondRowHTML(fName, userProfile.bonds[fName] || {}, false)).join('');
  }
}

async function renderLeaderboardPage() {
  const playersEl = document.getElementById('leaderboard-players-list');
  const bondsEl = document.getElementById('leaderboard-bonds-list');
  if (!playersEl || !bondsEl) return;

  const myName = userProfile.username || gameState.player1Name || 'Sen';
  const myXp = userProfile.xp || 0;
  const myLvl = userProfile.level || 1;
  const myCorrect = userProfile.questionsCorrect || 0;

  let cloudPlayers = [];
  try {
    const res = await fetch('/api/rooms?leaderboard=1', {
      method: 'GET',
      headers: getSupabaseHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.leaderboard)) {
        cloudPlayers = data.leaderboard;
      }
    }
  } catch (e) {}

  const mergedMap = new Map();
  mergedMap.set(userProfile.friendCode, {
    code: userProfile.friendCode,
    name: `${myName} (${userProfile.friendCode})`,
    lvl: myLvl,
    xp: myXp,
    correct: myCorrect,
    isPermanent: Boolean(userProfile.isPermanentMember),
    isMe: true
  });

  cloudPlayers.forEach((cp) => {
    if (!cp || !cp.friendCode) return;
    const isMe = cp.friendCode === userProfile.friendCode;
    mergedMap.set(cp.friendCode, {
      code: cp.friendCode,
      name: `${cp.username || 'Oyuncu'} (${cp.friendCode})`,
      lvl: isMe ? Math.max(myLvl, cp.level || 1) : (cp.level || 1),
      xp: isMe ? Math.max(myXp, cp.xp || 0) : (cp.xp || 0),
      correct: isMe ? Math.max(myCorrect, cp.questionsCorrect || 0) : (cp.questionsCorrect || 0),
      isPermanent: isMe ? Boolean(userProfile.isPermanentMember) : Boolean(cp.isPermanentMember),
      isMe
    });
  });

  const fallbackPresets = [
    { code: 'SNC-4812', name: 'Selin Y. (SNC-4812)', lvl: 6, xp: 540, correct: 18, isPermanent: true, isMe: false },
    { code: 'SNC-7390', name: 'Burak K. (SNC-7390)', lvl: 5, xp: 420, correct: 14, isPermanent: true, isMe: false },
    { code: 'SNC-1944', name: 'Deniz A. (SNC-1944)', lvl: 4, xp: 315, correct: 11, isPermanent: false, isMe: false },
    { code: 'SNC-8821', name: 'Mert R. (SNC-8821)', lvl: 3, xp: 240, correct: 8, isPermanent: false, isMe: false }
  ];
  fallbackPresets.forEach((fp) => {
    if (!mergedMap.has(fp.code)) mergedMap.set(fp.code, fp);
  });

  const players = Array.from(mergedMap.values()).sort(
    (a, b) => (b.xp - a.xp) || (b.lvl - a.lvl) || (b.correct - a.correct)
  );

  playersEl.innerHTML = players
    .slice(0, 15)
    .map(
      (p, idx) => `
      <div class="py-3 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full ${
            idx === 0 ? 'bg-amber-500 text-white' : p.isMe ? 'bg-primary-theme' : 'stitch-subcard'
          } font-mono-theme font-extrabold text-xs flex items-center justify-center">
            #${idx + 1}
          </div>
          <div>
            <div class="font-bold text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
              <span>${escapeHtml(p.name)}</span>
              ${p.isMe ? '<span class="text-primary-theme font-extrabold">(Sen)</span>' : ''}
              ${p.isPermanent ? '<span class="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 text-[10px] font-bold">✓ Üye</span>' : ''}
            </div>
            <div class="text-[11px] text-muted-theme">senceo Seviyesi • LVL ${p.lvl} • ${p.correct || 0} Doğru Yanıt</div>
          </div>
        </div>
        <span class="px-2.5 py-1 rounded-full stitch-subcard font-mono-theme font-extrabold text-xs text-primary-theme">
          ${p.xp} TP
        </span>
      </div>
    `
    )
    .join('');

  const myBonds = Object.keys(userProfile.bonds || {}).map((k) => {
    const b = userProfile.bonds[k];
    return {
      pair: `${myName} ⚡ ${b.realName || k}`,
      pct: b.lastPct || 85,
      lvl: b.level || 1,
      title: getBondTitle(b.level || 1, b.matches || 1, b.status)
    };
  });

  const allBondPairs = [
    ...myBonds,
    { pair: 'Selin Y. ⚡ Deniz A.', pct: 94, lvl: 5, title: 'Ruh İkizi' },
    { pair: 'Burak K. ⚡ Mert R.', pct: 88, lvl: 4, title: 'Ruh İkizi' },
    { pair: 'Ece T. ⚡ Can B.', pct: 82, lvl: 3, title: 'Kanka' }
  ].sort((a, b) => b.pct - a.pct);

  bondsEl.innerHTML = allBondPairs
    .slice(0, 8)
    .map(
      (bp, idx) => `
      <div class="py-3 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full stitch-subcard font-mono-theme font-extrabold text-xs flex items-center justify-center text-rose-500">
            #${idx + 1}
          </div>
          <div>
            <div class="font-bold text-xs sm:text-sm">${escapeHtml(bp.pair)}</div>
            <div class="text-[11px] text-muted-theme">${escapeHtml(bp.title)} • Bağ LVL ${bp.lvl}</div>
          </div>
        </div>
        <span class="px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300 font-extrabold text-xs">
          %${bp.pct} Uyum
        </span>
      </div>
    `
    )
    .join('');
}

function toggleProfileModal(show) {
  const modal = document.getElementById('profile-modal');
  if (!modal) return;
  if (show) {
    renderProfileUI();
    modal.classList.remove('hidden');
  } else {
    modal.classList.add('hidden');
  }
}

// ---------------- 4 TEMA MOTORU ----------------
function normalizeThemeKey(key) {
  if (key === 'crimson') return 'obsidian';
  return THEMES[key] ? key : 'luminous';
}

function applyTheme(themeKey) {
  const validTheme = normalizeThemeKey(themeKey);
  gameState.theme = validTheme;
  document.documentElement.setAttribute('data-theme', validTheme);

  try {
    localStorage.setItem('senceo_theme_v5', validTheme);
  } catch (e) {}

  ['luminous', 'obsidian', 'cosmic', 'brutal26'].forEach((key) => {
    const card = document.getElementById(`theme-card-${key}`);
    if (!card) return;
    if (key === validTheme) {
      card.style.borderColor = 'var(--primary)';
      card.style.boxShadow = '0 0 0 3px var(--primary-fixed)';
    } else {
      card.style.borderColor = 'rgba(150, 150, 170, 0.35)';
      card.style.boxShadow = 'none';
    }
  });
}

function initSavedTheme() {
  let initialTheme = 'luminous';
  try {
    const saved = localStorage.getItem('senceo_theme_v5') || localStorage.getItem('senceo_theme_v4');
    if (saved && THEMES[saved]) {
      initialTheme = saved;
    }
  } catch (e) {}
  applyTheme(initialTheme);
}

function toggleSettingsModal(show) {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  modal.classList.toggle('hidden', !show);
}

function saveSettingsAndClose() {
  toggleSettingsModal(false);
}

function toggleCloudJoinModal(show) {
  const modal = document.getElementById('cloud-join-modal');
  if (!modal) return;
  const errEl = document.getElementById('join-room-error');
  if (errEl) errEl.classList.add('hidden');
  modal.classList.toggle('hidden', !show);
  if (show) {
    const inp = document.getElementById('input-join-room-code');
    if (inp) inp.focus();
  }
}

// ---------------- ÇOK SAYFALI ÜST NAVİGASYON GEÇİŞİ ----------------
function switchTopNavPage(pageKey) {
  const navIds = {
    setup: 'nav-tab-setup',
    duels: 'nav-tab-duels',
    bonds: 'nav-tab-bonds',
    leaderboard: 'nav-tab-leaderboard'
  };

  Object.keys(navIds).forEach((k) => {
    const btn = document.getElementById(navIds[k]);
    if (!btn) return;
    const extraResponsive = k === 'leaderboard' ? 'hidden md:flex ' : 'flex ';
    if (k === pageKey) {
      btn.className = `${extraResponsive}px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors bg-[var(--surface-high)] text-primary-theme items-center gap-1.5`;
    } else {
      btn.className = `${extraResponsive}px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-muted-theme hover:bg-[var(--surface-container)] transition-colors items-center gap-1.5`;
    }
  });

  if (pageKey === 'duels') {
    showView('view-active-games');
  } else if (pageKey === 'bonds') {
    showView('view-bonds');
  } else if (pageKey === 'leaderboard') {
    showView('view-leaderboard');
  } else {
    showView('view-home');
  }
}

// ---------------- UÇUŞAN EMOJİ PATLAMASI ----------------
function spawnFloatingEmojiBurst(emojiChar, originEvent) {
  const count = 6;
  const startX = originEvent && originEvent.clientX ? originEvent.clientX : window.innerWidth / 2;
  const startY = originEvent && originEvent.clientY ? originEvent.clientY : window.innerHeight * 0.6;

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'floating-emoji-particle';
    el.textContent = emojiChar;
    const offsetX = (Math.random() - 0.5) * 140;
    const offsetY = (Math.random() - 0.5) * 40;
    el.style.left = `${startX + offsetX}px`;
    el.style.top = `${startY + offsetY}px`;
    el.style.animationDuration = `${1.0 + Math.random() * 0.5}s`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }
}

// ---------------- VERİTABANI, KİMLİK DOĞRULAMA & AKTİF DÜELLOLAR LOBİSİ ----------------
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "SNC";
  for (let i = 0; i < 3; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getSupabaseHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Supabase-Url": DEFAULT_SUPABASE_URL
  };
}

// ISSUE #2 Çözümü: Kullanıcının odadaki 1. Oyuncu (Kurucu) olup olmadığını değiştirilemez ID ve Arkadaş Kodu üzerinden kesin tespit et!
function isUserPlayer1OfRoom(room) {
  if (!room) return false;
  if (room.p1FriendCode && userProfile.friendCode) {
    if (room.p1FriendCode.toUpperCase() === userProfile.friendCode.toUpperCase()) {
      return true;
    }
    if (room.p2FriendCode && room.p2FriendCode.toUpperCase() === userProfile.friendCode.toUpperCase()) {
      return false;
    }
  }
  if (room.p1Id && userProfile.id) {
    return room.p1Id === userProfile.id;
  }
  const myName = (userProfile.username || gameState.player1Name || '').trim().toLowerCase();
  if (myName && myName !== 'misafir oyuncu' && room.p1) {
    return room.p1.trim().toLowerCase() === myName;
  }
  return false;
}

function saveRoomToLocalLobbyList(roomPayload) {
  if (!roomPayload || !roomPayload.code) return;
  try {
    localStorage.setItem(`senceo_room_${roomPayload.code}`, JSON.stringify(roomPayload));
    const listRaw = localStorage.getItem('senceo_my_rooms_index') || '[]';
    const codes = JSON.parse(listRaw);
    if (!codes.includes(roomPayload.code)) {
      codes.unshift(roomPayload.code);
      localStorage.setItem('senceo_my_rooms_index', JSON.stringify(codes.slice(0, 20)));
    }
  } catch (e) {}
  updateNavActiveDuelsCount();
}

function deleteDuelFromLobby(roomCode, ev) {
  if (ev) ev.stopPropagation();
  const cleanCode = String(roomCode || '').trim().toUpperCase();
  if (!cleanCode) return;

  try {
    localStorage.removeItem(`senceo_room_${cleanCode}`);
    const listRaw = localStorage.getItem('senceo_my_rooms_index') || '[]';
    const codes = JSON.parse(listRaw).filter((c) => c !== cleanCode);
    localStorage.setItem('senceo_my_rooms_index', JSON.stringify(codes));
  } catch (e) {}

  if (userProfile.bonds) {
    Object.keys(userProfile.bonds).forEach((k) => {
      if (userProfile.bonds[k] && userProfile.bonds[k].activeRoomCode === cleanCode) {
        userProfile.bonds[k].activeRoomCode = '';
      }
    });
  }

  updateNavActiveDuelsCount();
  refreshActiveGamesLobby();
}

function clearAllActiveDuels() {
  try {
    const listRaw = localStorage.getItem('senceo_my_rooms_index') || '[]';
    const codes = JSON.parse(listRaw);
    codes.forEach((c) => localStorage.removeItem(`senceo_room_${c}`));
    localStorage.setItem('senceo_my_rooms_index', '[]');
  } catch (e) {}
  updateNavActiveDuelsCount();
  refreshActiveGamesLobby();
}

function updateNavActiveDuelsCount() {
  const badge = document.getElementById('nav-active-duels-count');
  if (!badge) return;
  try {
    const codes = JSON.parse(localStorage.getItem('senceo_my_rooms_index') || '[]');
    if (codes.length > 0) {
      badge.textContent = String(codes.length);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch (e) {}
}

async function saveRoomToDatabase(roomPayload) {
  if (!roomPayload.p1FriendCode && userProfile.friendCode) {
    roomPayload.p1FriendCode = userProfile.friendCode;
  }
  if (!roomPayload.p1Id && userProfile.id) {
    roomPayload.p1Id = userProfile.id;
  }
  if (!roomPayload.p2FriendCode && gameState.player2FriendCode) {
    roomPayload.p2FriendCode = gameState.player2FriendCode;
  }

  saveRoomToLocalLobbyList(roomPayload);
  try {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({ room: roomPayload })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { ok: true, room: data.room || roomPayload };
  } catch (err) {
    return { ok: false, room: roomPayload };
  }
}

async function fetchRoomFromDatabase(roomCode) {
  const cleanCode = String(roomCode).trim().toUpperCase();
  try {
    const res = await fetch(`/api/rooms?code=${encodeURIComponent(cleanCode)}`, {
      method: 'GET',
      headers: getSupabaseHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.room) {
        saveRoomToLocalLobbyList(data.room);
        return data.room;
      }
    }
  } catch (err) {}

  try {
    const localRaw = localStorage.getItem(`senceo_room_${cleanCode}`);
    if (localRaw) return JSON.parse(localRaw);
  } catch (e) {}
  return null;
}

function setActiveLobbyFilter(filterType) {
  gameState.activeLobbyFilter = filterType;
  const btns = document.querySelectorAll('#lobby-filter-tabs .lobby-filter-btn');
  btns.forEach((b) => {
    if (b.getAttribute('data-filter') === filterType) {
      b.className = "lobby-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--surface-lowest)] shadow-sm";
    } else {
      b.className = "lobby-filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-theme";
    }
  });
  refreshActiveGamesLobby();
}

function handleUrgentBannerAction() {
  if (gameState.urgentRoomCode) {
    openRoomFromLobbyCard(gameState.urgentRoomCode);
  } else {
    switchTopNavPage('setup');
  }
}

// Stitch Card 2'deki "🔔 Hatırlatma Gönder" (sendNudge) Özelliği
async function sendNudgeToOpponent(roomCode, toFriendCode, btnEl, ev) {
  if (ev) ev.stopPropagation();
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = `<span class="material-symbols-outlined text-[15px]">check</span><span>Hatırlatma Gönderildi!</span>`;
  }
  spawnFloatingEmojiBurst('🔔');
  playSoundEffect('pop');

  if (toFriendCode && /^SNC-\d{4}$/i.test(toFriendCode)) {
    try {
      await fetch('/api/rooms', {
        method: 'POST',
        headers: getSupabaseHeaders(),
        body: JSON.stringify({
          action: 'send_nudge',
          fromCode: userProfile.friendCode,
          fromName: userProfile.username || gameState.player1Name || 'Arkadaşın',
          toCode: toFriendCode.toUpperCase(),
          roomCode
        })
      });
    } catch (e) {}
  }
}

async function refreshActiveGamesLobby() {
  const container = document.getElementById('active-games-lobby-list');
  if (!container) return;

  let codes = [];
  try {
    codes = JSON.parse(localStorage.getItem('senceo_my_rooms_index') || '[]');
  } catch (e) {}

  updateNavActiveDuelsCount();

  const urgentTitle = document.getElementById('urgent-banner-title');
  const urgentDesc = document.getElementById('urgent-banner-desc');
  const urgentBtnText = document.getElementById('urgent-banner-btn-text');
  const urgentTimeText = document.getElementById('urgent-banner-time-text');
  gameState.urgentRoomCode = '';

  const allRooms = [];
  let turnCount = 0;
  let waitingCount = 0;

  for (const code of codes.slice(0, 15)) {
    let room = null;
    try {
      const raw = localStorage.getItem(`senceo_room_${code}`);
      if (raw) room = JSON.parse(raw);
    } catch (e) {}
    if (!room) continue;

    const isP1 = isUserPlayer1OfRoom(room);
    const isMyTurn =
      (room.status === 'waiting_p1_half2' && isP1) ||
      (room.status === 'waiting_p2' && !isP1);

    if (isMyTurn) turnCount++;
    else waitingCount++;

    allRooms.push({ room, isP1, isMyTurn });
  }

  // Filtre Sayaçlarını Güncelle (Tümü (X), Sıra Sende (Y), Bekleyenler (Z))
  const cAll = document.getElementById('filter-count-all');
  const cTurn = document.getElementById('filter-count-turn');
  const cWait = document.getElementById('filter-count-waiting');
  if (cAll) cAll.textContent = String(allRooms.length);
  if (cTurn) cTurn.textContent = String(turnCount);
  if (cWait) cWait.textContent = String(waitingCount);

  if (allRooms.length === 0) {
    if (urgentTitle) urgentTitle.textContent = 'Henüz aktif bir düellon bulunmuyor';
    if (urgentDesc) urgentDesc.textContent = 'Yeni bir Klasik Oyun veya Canlı Oda başlatarak arkadaşlarını davet edebilirsin.';
    if (urgentBtnText) urgentBtnText.textContent = 'Yeni Oyun Başlat';
    if (urgentTimeText) urgentTimeText.textContent = 'Canlı Düello Arenası';

    container.innerHTML = `
      <div class="stitch-card p-6 text-center space-y-3">
        <div class="w-12 h-12 mx-auto rounded-full stitch-subcard flex items-center justify-center text-primary-theme">
          <span class="material-symbols-outlined text-[24px]">sports_esports</span>
        </div>
        <h3 class="font-display-theme font-bold text-base">Aktif Düello Listesi Boş</h3>
        <p class="text-xs text-muted-theme max-w-md mx-auto">
          Hemen yeni bir <strong>Klasik Oyun</strong> veya <strong>Canlı Oda</strong> başlatarak arkadaşlarına meydan oku!
        </p>
        <button type="button" onclick="switchTopNavPage('setup')" class="theme-btn-primary px-5 py-2.5 text-xs inline-flex items-center gap-1.5">
          <span>Yeni Oyun Kur</span>
          <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  let renderedCount = 0;

  for (const item of allRooms) {
    const { room, isP1, isMyTurn } = item;

    if (!gameState.urgentRoomCode && isMyTurn) {
      gameState.urgentRoomCode = room.code;
      const opp = isP1 ? (room.p2 || room.p2FriendCode || 'Arkadaşın') : (room.p1 || 'Oyuncu 1');
      if (urgentTitle) urgentTitle.textContent = `${opp} senin 5 tahminini bekliyor!`;
      if (urgentDesc) urgentDesc.textContent = `${(room.cat || 'Genel').toUpperCase()} serisinde (#${room.code}) son hamle sende. Uyum oranını yükseltme şansını kaçırma.`;
      if (urgentBtnText) urgentBtnText.textContent = 'Hamleni Yap';
      if (urgentTimeText) urgentTimeText.textContent = `Oda #${room.code} • Aktif Sıra`;
    }

    if (gameState.activeLobbyFilter === 'turn' && !isMyTurn) continue;
    if (gameState.activeLobbyFilter === 'waiting' && isMyTurn) continue;

    renderedCount++;

    // Canlı Parti Odası Kartı (Stitch Card 3 Tasarımı)
    if (room.roomType === 'live_arena' && room.status === 'lobby_open') {
      const pCount = Array.isArray(room.participants) ? room.participants.length : 1;
      const card = document.createElement('div');
      card.className = "stitch-card p-5 space-y-3.5 hover:border-[var(--primary)] transition";
      card.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl stitch-subcard text-primary-theme flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-[24px]">groups</span>
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-display-theme font-bold text-sm sm:text-base">Canlı Parti (${escapeHtml(room.code)})</h3>
                <span class="px-2.5 py-0.5 rounded-full stitch-subcard text-xs font-bold">${escapeHtml((room.arenaFormat || '1v1').toUpperCase())} Lobi</span>
              </div>
              <p class="text-xs text-muted-theme">
                ${escapeHtml((room.cat || 'genel').toUpperCase())} • ${pCount} Oyuncu Bağlı
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1 mr-2">
              <span class="w-2.5 h-2.5 rounded-full bg-primary-theme"></span>
              <span class="w-2.5 h-2.5 rounded-full ${pCount >= 2 ? 'bg-primary-theme' : 'bg-slate-300 dark:bg-slate-700'}"></span>
              <span class="w-2.5 h-2.5 rounded-full ${pCount >= 3 ? 'bg-primary-theme' : 'bg-slate-300 dark:bg-slate-700'}"></span>
              <span class="w-2.5 h-2.5 rounded-full ${pCount >= 4 ? 'bg-primary-theme' : 'bg-slate-300 dark:bg-slate-700'}"></span>
            </div>
            <button
              type="button"
              onclick="deleteDuelFromLobby('${escapeHtml(room.code)}', event)"
              class="px-2.5 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-600 dark:text-red-300 font-bold text-xs flex items-center gap-1 transition"
            >
              <span class="material-symbols-outlined text-[15px]">delete</span>
              <span>Bitir / Sil</span>
            </button>
          </div>
        </div>
        <div class="flex items-center justify-between pt-1">
          <span class="text-xs text-muted-theme flex items-center gap-1">
            <span class="material-symbols-outlined text-[15px]">lock_open</span>
            <span>Oda Kodu: <strong class="font-mono-theme text-primary-theme">${escapeHtml(room.code)}</strong></span>
          </span>
          <button
            type="button"
            onclick="openRoomFromLobbyCard('${escapeHtml(room.code)}')"
            class="theme-btn-secondary px-4 py-2 text-xs font-bold flex items-center gap-1.5"
          >
            <span class="material-symbols-outlined text-[15px]">share</span>
            <span>Odaya Dön &amp; Davet Et</span>
          </button>
        </div>
      `;
      container.appendChild(card);
      continue;
    }

    let statusPill = '';
    let progressPct = 50;
    let actionLabel = 'Odayı Aç';

    if (room.status === 'completed') {
      const pct = typeof room.lastMatchPercentage === 'number' ? `%${room.lastMatchPercentage}` : 'Bitti';
      statusPill = `<span class="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-bold text-[11px]">🏆 ${room.currentRound || 1}. Raunt Tamamlandı (${pct})</span>`;
      progressPct = 100;
      actionLabel = 'Sonuç & Yeni Tur';
    } else if (isMyTurn) {
      statusPill = `<span class="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white font-bold text-[11px] animate-pulse">🟢 Sıra Sende</span>`;
      progressPct = 60;
      actionLabel = 'Hamleye Devam Et';
    } else {
      statusPill = `<span class="px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300 font-bold text-[11px]">⏳ Rakip Bekleniyor</span>`;
      progressPct = 50;
      actionLabel = 'Link & Oda Durumu';
    }

    const rawOpponent = isP1
      ? room.p2 && room.p2 !== 'Arkadaşın'
        ? room.p2
        : room.p2FriendCode || room.p2 || 'Rakip Bekleniyor'
      : room.p1 || room.p1FriendCode || 'Oyuncu 1';
    const initials = rawOpponent.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ0-9]/g, '').slice(0, 2).toUpperCase() || 'OY';

    // Stitch Card 2 "Senin yanıtların kilitlendi" bilgi kutusu + "🔔 Hatırlatma Gönder" butonu
    const lockedTimelineHtml =
      !isMyTurn && room.status !== 'completed'
        ? `
          <div class="p-2.5 rounded-xl stitch-subcard flex items-center justify-between text-xs text-muted-theme">
            <div class="flex items-center gap-1.5 font-semibold">
              <span class="material-symbols-outlined text-[17px] text-emerald-500">check_circle</span>
              <span>Senin 5 yanıtın kilitlendi • Rakibin tahmini bekleniyor</span>
            </div>
            <span class="font-mono-theme text-[11px]">#${escapeHtml(room.code)}</span>
          </div>
        `
        : '';

    const nudgeButtonHtml =
      !isMyTurn && room.status !== 'completed'
        ? `
          <button
            type="button"
            onclick="sendNudgeToOpponent('${escapeHtml(room.code)}', '${escapeHtml(room.p2FriendCode || '')}', this, event)"
            class="theme-btn-secondary px-3 py-2 text-xs font-bold flex items-center gap-1"
            title="Rakibine Bildirim Gönder"
          >
            <span class="material-symbols-outlined text-[15px]">notifications_active</span>
            <span>Hatırlatma Gönder</span>
          </button>
        `
        : '';

    const card = document.createElement('div');
    card.className = "stitch-card p-5 space-y-3.5 hover:border-[var(--primary)] transition";
    card.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div class="flex items-center gap-3">
          <div class="relative">
            <div class="w-12 h-12 rounded-full bg-[var(--primary-fixed)] text-primary-theme font-bold text-sm flex items-center justify-center shrink-0">
              ${escapeHtml(initials)}
            </div>
            <span class="absolute bottom-0 right-0 w-3 h-3 rounded-full ${isMyTurn ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="font-display-theme font-bold text-sm sm:text-base">vs ${escapeHtml(rawOpponent)}</h3>
              ${statusPill}
            </div>
            <p class="text-xs text-muted-theme">
              ${escapeHtml((room.cat || 'genel').toUpperCase())} • Raunt ${room.currentRound || 1} • 5/5 Soru • Oda: <strong class="font-mono-theme text-primary-theme">#${escapeHtml(room.code)}</strong>
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 self-start sm:self-auto">
          ${
            typeof room.lastMatchPercentage === 'number'
              ? `<div class="px-3 py-1 rounded-full stitch-subcard text-xs font-extrabold text-primary-theme">❤️ %${room.lastMatchPercentage} Uyum</div>`
              : ''
          }
          <button
            type="button"
            onclick="deleteDuelFromLobby('${escapeHtml(room.code)}', event)"
            class="px-2.5 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-600 dark:text-red-300 font-bold text-xs flex items-center gap-1 transition"
            title="Bu Düelloyu Bitir ve Listeden Sil"
          >
            <span class="material-symbols-outlined text-[15px]">delete</span>
            <span>Bitir / Sil</span>
          </button>
        </div>
      </div>

      ${lockedTimelineHtml}

      <div>
        <div class="flex justify-between items-center mb-1 text-[11px] font-bold text-muted-theme">
          <span>Düello İlerlemesi</span>
          <span>%${progressPct}</span>
        </div>
        <div class="w-full h-2 rounded-full bg-[var(--surface-high)] overflow-hidden">
          <div class="h-full bg-primary-theme rounded-full transition-all duration-500" style="width: ${progressPct}%"></div>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
        <span class="text-xs text-muted-theme flex items-center gap-1">
          <span class="material-symbols-outlined text-[15px]">lock_open</span>
          <span>Oda Kodu: <strong class="font-mono-theme">${escapeHtml(room.code)}</strong></span>
        </span>
        <div class="flex items-center gap-2">
          ${nudgeButtonHtml}
          <button
            type="button"
            onclick="openRoomFromLobbyCard('${escapeHtml(room.code)}')"
            class="theme-btn-primary px-4 py-2 text-xs flex items-center gap-1"
          >
            <span>${actionLabel}</span>
            <span class="material-symbols-outlined text-[15px]">play_arrow</span>
          </button>
        </div>
      </div>
    `;
    container.appendChild(card);
  }

  if (!gameState.urgentRoomCode && allRooms.length > 0) {
    gameState.urgentRoomCode = allRooms[0].room.code;
    if (urgentTitle) urgentTitle.textContent = `${allRooms.length} aktif düello masan bulunuyor`;
    if (urgentDesc) urgentDesc.textContent = 'Son düellonun davet linkini paylaşabilir veya biten oyunları listeden silebilirsin.';
    if (urgentBtnText) urgentBtnText.textContent = 'Son Düelloyu Aç';
  }

  if (renderedCount === 0) {
    container.innerHTML = `
      <div class="stitch-card p-5 text-xs text-muted-theme text-center">
        Bu filtrede gösterilecek aktif düello bulunamadı.
      </div>
    `;
  }
}

async function openRoomFromLobbyCard(code) {
  const latest = await fetchRoomFromDatabase(code);
  if (latest) {
    loadRoomIntoGameState(latest, false);
  }
}

async function handleDashboardQuickJoin(event) {
  if (event) event.preventDefault();
  const inp = document.getElementById('dashboard-quick-room-input');
  const errEl = document.getElementById('dashboard-quick-room-error');
  const code = inp ? inp.value.trim().toUpperCase() : '';
  if (!code || code.length < 3) {
    if (errEl) {
      errEl.textContent = '⚠️ Lütfen geçerli bir oda kodu girin.';
      errEl.classList.remove('hidden');
    }
    return;
  }
  if (errEl) errEl.classList.add('hidden');
  const room = await fetchRoomFromDatabase(code);
  if (!room) {
    if (errEl) {
      errEl.textContent = `❌ "${code}" kodlu oda bulunamadı!`;
      errEl.classList.remove('hidden');
    }
    return;
  }
  inp.value = '';
  loadRoomIntoGameState(room, false);
}

// Canlı Bildirim & 4 Saniyede Bir Oda Kontrol Dinleyici
function startPollingForPartnerCompletion(roomCode) {
  stopPollingForPartnerCompletion();
  if (!roomCode) return;

  gameState.pollingIntervalId = setInterval(async () => {
    const room = await fetchRoomFromDatabase(roomCode);
    if (!room) return;
    const isP1 = isUserPlayer1OfRoom(room);

    // 1. Клаsik oyunda karşı oyuncu kendi sırasını tamamladıysa:
    if (
      (isP1 && (room.status === 'waiting_p1_half2' || room.status === 'completed')) ||
      (!isP1 && room.status === 'completed')
    ) {
      stopPollingForPartnerCompletion();
      triggerPartnerCompletedNotification(room);
      openOpponentTurnReadyModal(room);
      refreshActiveGamesLobby();
      return;
    }

    // 2. 2. Raund için sıra bekleyen oyuncunun rakibi ilk 5 soruyu çözdüyse (waiting_p2):
    if (room.status === 'waiting_p2' && !isP1 && Array.isArray(room.p1Answers) && room.p1Answers.length >= TOTAL_QUESTIONS) {
      stopPollingForPartnerCompletion();
      stopLiveTurnWaitPolling();
      triggerPartnerCompletedNotification(room);
      openOpponentTurnReadyModal(room);
      refreshActiveGamesLobby();
    }
  }, 4000);
}

function stopPollingForPartnerCompletion() {
  if (gameState.pollingIntervalId) {
    clearInterval(gameState.pollingIntervalId);
    gameState.pollingIntervalId = null;
  }
}

function openOpponentTurnReadyModal(room) {
  if (!room) return;
  gameState.completedRoomDataFromCloud = room;
  const modal = document.getElementById('opponent-turn-ready-modal');
  const titleEl = document.getElementById('turn-ready-modal-title');
  const descEl = document.getElementById('turn-ready-modal-desc');
  if (!modal) return;

  const isP1 = isUserPlayer1OfRoom(room);
  const partner = isP1 ? (room.p2 || 'Arkadaşın') : (room.p1 || 'Arkadaşın');

  if (room.status === 'waiting_p1_half2') {
    if (titleEl) titleEl.textContent = `🎉 ${partner} Sorularını Cevaplandırdı! Sıra Sende!`;
    if (descEl) {
      descEl.textContent = `${partner} senin 5 sorunu tahmin etti ve karşı saldırı için kendi 5 sorusunu hazırladı. Hemen devam etmek ister misin?`;
    }
  } else if (room.status === 'waiting_p2' && !isP1) {
    if (titleEl) titleEl.textContent = `🎉 ${partner} ${room.currentRound || 2}. Raund Sorularını Hazırladı!`;
    if (descEl) {
      descEl.textContent = `${partner} yeni raundun 5 sorusunu cevapladı. Şimdi tahmin sırası sende!`;
    }
  } else {
    if (titleEl) titleEl.textContent = `🏆 ${partner} Testi Tamamladı! Sonuçlar Hazır!`;
    if (descEl) {
      descEl.textContent = `Düello tamamlandı! Uyum yüzdesini, kazanılan XP'leri ve sohbet balonlarını görmek için devam et.`;
    }
  }

  modal.classList.remove('hidden');
  playSoundEffect('correct');
  spawnFloatingEmojiBurst('🎉');
}

function continueFromTurnReadyModal() {
  const modal = document.getElementById('opponent-turn-ready-modal');
  if (modal) modal.classList.add('hidden');
  const room = gameState.completedRoomDataFromCloud;
  if (room) {
    loadRoomIntoGameState(room, false);
  }
}

function returnHomeFromTurnReadyModal() {
  const modal = document.getElementById('opponent-turn-ready-modal');
  if (modal) modal.classList.add('hidden');
  resetToHome();
}

// ---------------- CANLI ODA LOBİSİ & EŞZAMANLI TURN ENGINE ----------------
function isCurrentUserHostOfLiveRoom(room) {
  if (!room) return true;
  const hostCode = (room.hostCode || room.p1FriendCode || '').toUpperCase();
  if (hostCode && userProfile.friendCode && hostCode === userProfile.friendCode.toUpperCase()) {
    return true;
  }
  return isUserPlayer1OfRoom(room);
}

function pushLiveLobbySettingsToCloud() {
  if (!gameState.roomCode) return;
  const catSelect = document.getElementById('live-lobby-cat-select');
  if (catSelect) gameState.category = catSelect.value;

  fetch('/api/rooms', {
    method: 'POST',
    headers: getSupabaseHeaders(),
    body: JSON.stringify({
      action: 'update_live_lobby',
      code: gameState.roomCode,
      requesterCode: userProfile.friendCode,
      settings: {
        arenaFormat: gameState.arenaFormat,
        cat: gameState.category,
        liveSettings: { ...gameState.liveSettings }
      }
    })
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data && data.room) renderLiveLobbyState(data.room);
    })
    .catch(() => {});
}

function selectLiveFfaSubMode(sub) {
  gameState.liveSettings.ffaSubMode = sub;
  document.querySelectorAll('.ffa-sub-btn').forEach((b) => {
    b.classList.toggle('is-active', b.getAttribute('data-ffasub') === sub);
  });
  pushLiveLobbySettingsToCloud();
}

function selectLiveTeamSubMode(sub) {
  gameState.liveSettings.teamSubMode = sub;
  document.querySelectorAll('.team-sub-btn').forEach((b) => {
    b.classList.toggle('is-active', b.getAttribute('data-teamsub') === sub);
  });
  pushLiveLobbySettingsToCloud();
}

function selectLiveTurnStep(step) {
  gameState.liveSettings.turnStep = Number(step) || 1;
  document.querySelectorAll('.step-mode-btn').forEach((b) => {
    b.classList.toggle('is-active', Number(b.getAttribute('data-step')) === gameState.liveSettings.turnStep);
  });
  const stepDesc = document.getElementById('live-turn-step-desc');
  if (stepDesc) {
    stepDesc.textContent = `${gameState.liveSettings.turnStep}'er ${gameState.liveSettings.turnStep}'er: Sıradaki oyuncu ${gameState.liveSettings.turnStep} soru çözer, diğerleri hemen tahmin eder!`;
  }
  pushLiveLobbySettingsToCloud();
}

function selectLiveTimer(sec) {
  gameState.liveSettings.timerSeconds = Number(sec) || 0;
  document.querySelectorAll('.timer-mode-btn').forEach((b) => {
    b.classList.toggle('is-active', Number(b.getAttribute('data-timer')) === gameState.liveSettings.timerSeconds);
  });
  pushLiveLobbySettingsToCloud();
}

function selectLiveStarterMode(val) {
  if (val === 'random') {
    gameState.liveSettings.starterMode = 'random';
    gameState.liveSettings.selectedStarterCode = '';
  } else {
    gameState.liveSettings.starterMode = 'manual';
    gameState.liveSettings.selectedStarterCode = val;
  }
  pushLiveLobbySettingsToCloud();
}

async function switchMyLiveTeam(team) {
  if (!gameState.roomCode) return;
  try {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        action: 'switch_live_team',
        code: gameState.roomCode,
        friendCode: userProfile.friendCode,
        playerName: userProfile.username || gameState.player1Name || 'Oyuncu',
        team
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.room) renderLiveLobbyState(data.room);
    }
  } catch (e) {}
}

function openHostParticipantModal(participant) {
  if (!participant || !participant.code) return;
  gameState.selectedParticipantForHostAction = participant;
  const modal = document.getElementById('host-participant-modal');
  const nameEl = document.getElementById('host-manage-target-name');
  if (nameEl) nameEl.textContent = `${participant.name || 'Oyuncu'} (${participant.code})`;
  if (modal) modal.classList.remove('hidden');
}

function closeHostParticipantModal() {
  gameState.selectedParticipantForHostAction = null;
  const modal = document.getElementById('host-participant-modal');
  if (modal) modal.classList.add('hidden');
}

async function executeHostParticipantAction(subAction, targetTeam = '') {
  const target = gameState.selectedParticipantForHostAction;
  if (!target || !gameState.roomCode) return;
  closeHostParticipantModal();

  if (subAction === 'set_ebe') {
    gameState.liveSettings.starterMode = 'manual';
    gameState.liveSettings.selectedStarterCode = target.code;
  }

  try {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        action: 'manage_live_participant',
        code: gameState.roomCode,
        requesterCode: userProfile.friendCode,
        subAction,
        targetCode: target.code,
        targetTeam
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.room) {
        renderLiveLobbyState(data.room);
        spawnFloatingEmojiBurst('👑');
      }
    }
  } catch (e) {}
}

function renderLiveLobbyState(room) {
  if (!room) return;
  const isHost = isCurrentUserHostOfLiveRoom(room);
  const participants = Array.isArray(room.participants) && room.participants.length > 0
    ? room.participants
    : [{ name: room.p1 || 'Kurucu', code: room.p1FriendCode || userProfile.friendCode, role: 'host', team: 'common', isHost: true }];

  // Eğer bu kullanıcı odadan atıldıysa (kickedCodes içinde varsa) ana sayfaya döndür
  if (
    Array.isArray(room.kickedCodes) &&
    userProfile.friendCode &&
    room.kickedCodes.includes(userProfile.friendCode.toUpperCase())
  ) {
    stopLiveLobbyParticipantPolling();
    resetToHome();
    return;
  }

  // Ayarları room'dan senkronize et
  if (room.arenaFormat) {
    gameState.arenaFormat = room.arenaFormat;
    document.querySelectorAll('.fmt-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-fmt') === room.arenaFormat);
    });
  }
  if (room.cat) {
    gameState.category = room.cat;
    const catSelect = document.getElementById('live-lobby-cat-select');
    if (catSelect) catSelect.value = room.cat;
  }
  if (room.liveSettings) {
    gameState.liveSettings = { ...gameState.liveSettings, ...room.liveSettings };
  }

  const ls = gameState.liveSettings;
  document.querySelectorAll('.ffa-sub-btn').forEach((b) => {
    b.classList.toggle('is-active', b.getAttribute('data-ffasub') === ls.ffaSubMode);
  });
  document.querySelectorAll('.team-sub-btn').forEach((b) => {
    b.classList.toggle('is-active', b.getAttribute('data-teamsub') === ls.teamSubMode);
  });
  document.querySelectorAll('.step-mode-btn').forEach((b) => {
    b.classList.toggle('is-active', Number(b.getAttribute('data-step')) === Number(ls.turnStep || 1));
  });
  document.querySelectorAll('.timer-mode-btn').forEach((b) => {
    b.classList.toggle('is-active', Number(b.getAttribute('data-timer')) === Number(ls.timerSeconds || 0));
  });

  // İlk başlayan / Ebe açılır menüsünü katılımcılarla doldur
  const starterSel = document.getElementById('live-lobby-starter-select');
  if (starterSel) {
    const currentVal = ls.starterMode === 'manual' && ls.selectedStarterCode ? ls.selectedStarterCode : 'random';
    starterSel.innerHTML =
      `<option value="random">🎲 Sistem Rastgele Seçsin</option>` +
      participants
        .map((p) => `<option value="${escapeHtml(p.code)}">🎯 İlk Ebe: ${escapeHtml(p.name)} (${escapeHtml(p.code)})</option>`)
        .join('');
    starterSel.value = currentVal;
  }

  // Takımlı mod (2v2, 3v3, 4v4, 5v5) vs Tekli/FFA görünümü
  const isTeamFormat = ['2v2', '3v3', '4v4', '5v5'].includes(gameState.arenaFormat);
  const teamZones = document.getElementById('live-lobby-teams-section');
  const ffaSubBox = document.getElementById('live-ffa-submode-box');
  const teamSubBox = document.getElementById('live-team-submode-box');
  if (teamZones) teamZones.classList.toggle('hidden', !isTeamFormat);
  if (ffaSubBox) ffaSubBox.classList.toggle('hidden', isTeamFormat);
  if (teamSubBox) teamSubBox.classList.toggle('hidden', !isTeamFormat);

  // Üst rol etiketi & Kurucu Kilit Kontrolü (Diğer kullanıcılarda ayarlar soluk ve kilitli!)
  const roleText = document.getElementById('live-lobby-role-text');
  const settingsPanel = document.getElementById('live-lobby-settings-container');
  const lockBadge = document.getElementById('live-settings-lock-badge');
  const startBtn = document.getElementById('btn-host-start-live-match');
  const waitBanner = document.getElementById('member-waiting-host-banner');

  if (roleText) {
    roleText.textContent = isHost
      ? 'Oda Kurucususun (Ayarları Yönetebilirsin)'
      : 'Katılımcısın (Ayarları Sadece Kurucu Değiştirebilir)';
  }
  if (settingsPanel) {
    settingsPanel.classList.toggle('settings-locked-member', !isHost);
  }
  if (lockBadge) {
    lockBadge.classList.toggle('hidden', isHost);
  }
  if (startBtn && waitBanner) {
    startBtn.classList.toggle('hidden', !isHost);
    waitBanner.classList.toggle('hidden', isHost);
  }

  // Katılımcı sayacı
  const countBadge = document.getElementById('live-lobby-player-count');
  if (countBadge) countBadge.textContent = String(participants.length);

  // Oyuncu Kartları (Kurucu ALTIN SARISI ve KALIN BOLD!)
  const cardsGrid = document.getElementById('live-lobby-participants-grid');
  if (cardsGrid) {
    cardsGrid.innerHTML = '';
    const hostCodeUpper = (room.hostCode || room.p1FriendCode || '').toUpperCase();

    participants.forEach((p, idx) => {
      const pCodeUpper = (p.code || '').toUpperCase();
      const isThisHost = Boolean(p.isHost || p.role === 'host' || (hostCodeUpper && pCodeUpper === hostCodeUpper) || idx === 0);
      const isSelectedEbe = ls.selectedStarterCode && ls.selectedStarterCode.toUpperCase() === pCodeUpper;
      const teamBadge =
        p.team === 'blue'
          ? '<span class="px-2 py-0.5 rounded bg-blue-500/20 text-blue-500 text-[10px] font-extrabold">🔵 Mavi</span>'
          : p.team === 'red'
          ? '<span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-500 text-[10px] font-extrabold">🔴 Kırmızı</span>'
          : '';

      const card = document.createElement('div');
      card.className = `p-3 rounded-xl flex items-center justify-between gap-2 transition ${
        isThisHost ? 'host-gold-card' : 'stitch-card'
      } ${isHost && !isThisHost ? 'cursor-pointer hover:border-amber-400' : ''}`;

      card.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-full ${
            isThisHost ? 'bg-amber-400 text-slate-950 font-black' : 'bg-primary-theme font-bold'
          } text-xs flex items-center justify-center shrink-0">
            ${isThisHost ? '👑' : escapeHtml((p.name || 'OY').slice(0, 2).toUpperCase())}
          </div>
          <div class="min-w-0">
            <div class="text-xs sm:text-sm truncate ${isThisHost ? 'host-gold-name' : 'font-bold'}">
              ${escapeHtml(p.name || 'Oyuncu')}
            </div>
            <div class="text-[10px] text-muted-theme flex items-center gap-1.5 flex-wrap">
              <span class="font-mono-theme">${escapeHtml(p.code || '')}</span>
              ${isThisHost ? '<span class="text-amber-500 font-extrabold">• ODA KURUCUSU</span>' : ''}
              ${isSelectedEbe ? '<span class="text-emerald-500 font-extrabold">• 🎯 EBE / İLK BAŞLAYAN</span>' : ''}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          ${teamBadge}
          ${
            isHost && !isThisHost
              ? '<span class="px-2 py-1 rounded-lg stitch-subcard text-[10px] font-bold text-primary-theme">Yönet ⚙️</span>'
              : ''
          }
        </div>
      `;

      if (isHost && !isThisHost) {
        card.addEventListener('click', () => openHostParticipantModal(p));
      }
      cardsGrid.appendChild(card);
    });
  }

  // Mavi Takım / Kırmızı Takım kutularını güncelle
  const blueEl = document.getElementById('live-team-blue-list');
  const redEl = document.getElementById('live-team-red-list');
  if (blueEl && redEl) {
    const renderTeamPills = (teamKey) => {
      const list = participants.filter((p) => p.team === teamKey);
      if (list.length === 0) return '<div class="text-[11px] text-muted-theme italic">Henüz bu takımda oyuncu yok</div>';
      return list
        .map((p) => {
          const isH = (p.code || '').toUpperCase() === (room.hostCode || room.p1FriendCode || '').toUpperCase();
          return `<div class="px-2.5 py-1 rounded-lg ${
            isH ? 'bg-amber-400/25 text-amber-500 font-black border border-amber-400' : 'stitch-card font-bold'
          }">${isH ? '👑 ' : '⚡ '}${escapeHtml(p.name)} <span class="text-[10px] font-mono-theme opacity-75">(${escapeHtml(p.code)})</span></div>`;
        })
        .join('');
    };
    blueEl.innerHTML = renderTeamPills('blue');
    redEl.innerHTML = renderTeamPills('red');
  }

  const listEl = document.getElementById('live-lobby-players-list');
  if (listEl) {
    listEl.textContent = participants.map((p, i) => `${i === 0 ? '👑' : '⚡'} ${p.name}`).join(' • ');
  }
}

// Canlı Oda Lobisinde katılımcıları ve kurucu ayarlarını gerçek zamanlı (1.5 sn) dinleme
function startLiveLobbyParticipantPolling(roomCode) {
  stopLiveLobbyParticipantPolling();
  if (!roomCode) return;

  gameState.liveLobbyPollingId = setInterval(async () => {
    const room = await fetchRoomFromDatabase(roomCode);
    if (!room) return;
    renderLiveLobbyState(room);

    // Eğer kurucu maçı başlattıysa tüm oyuncuları aynı anda maça sok!
    if (room.status === 'live_in_progress' || (room.status === 'waiting_p2' && Array.isArray(room.qIds) && room.qIds.length > 0)) {
      stopLiveLobbyParticipantPolling();
      loadRoomIntoGameState(room, false);
    }
  }, 1500);
}

function stopLiveLobbyParticipantPolling() {
  if (gameState.liveLobbyPollingId) {
    clearInterval(gameState.liveLobbyPollingId);
    gameState.liveLobbyPollingId = null;
  }
}

function triggerPartnerCompletedNotification(room) {
  gameState.completedRoomDataFromCloud = room;
  const banner = document.getElementById('top-notification-banner');
  const textEl = document.getElementById('top-notification-text');
  if (!banner || !textEl) return;

  const p2 = room.p2 || 'Arkadaşın';
  if (room.status === 'waiting_p1_half2') {
    textEl.textContent = `"${p2}" tahmin etti ve 5 soru sordu! Sıra sende →`;
  } else {
    textEl.textContent = `"${p2}" testi tamamladı! Sonucu kontrol et →`;
  }
  banner.classList.remove('hidden');
  banner.classList.add('flex');
  playSoundEffect('pop');
  spawnFloatingEmojiBurst('🔔');
}

function openCompletedRoomFromNotification() {
  const room = gameState.completedRoomDataFromCloud;
  if (!room) return;
  const banner = document.getElementById('top-notification-banner');
  if (banner) {
    banner.classList.add('hidden');
    banner.classList.remove('flex');
  }
  loadRoomIntoGameState(room, false);
}

// ---------------- EKRAN GEÇİŞ YÖNETİCİSİ ----------------
const ALL_VIEWS = [
  'view-home',
  'view-active-games',
  'view-bonds',
  'view-leaderboard',
  'view-live-room-lobby',
  'view-live-turn-wait',
  'view-challenge-welcome',
  'view-question',
  'view-halftime-reversal',
  'view-interstitial',
  'view-result'
];

function showView(viewId) {
  if (viewId !== 'view-live-room-lobby') {
    stopLiveLobbyParticipantPolling();
  }
  if (viewId !== 'view-question') {
    stopQuestionCountdownTimer();
  }

  ALL_VIEWS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === viewId) {
      el.classList.remove('hidden');
      el.classList.remove('animate-view');
      void el.offsetWidth;
      el.classList.add('animate-view');
    } else {
      el.classList.add('hidden');
    }
  });

  const duelHeader = document.getElementById('duel-vs-header');
  if (duelHeader) {
    if (viewId === 'view-question' || viewId === 'view-halftime-reversal' || viewId === 'view-result') {
      duelHeader.classList.remove('hidden');
    } else {
      duelHeader.classList.add('hidden');
    }
  }

  if (viewId === 'view-active-games') {
    syncCloudFriendState(false);
    refreshActiveGamesLobby();
    renderBondsLists();
  } else if (viewId === 'view-bonds') {
    syncCloudFriendState(false);
    renderIncomingFriendRequestsUI();
    renderBondsLists();
  } else if (viewId === 'view-leaderboard') {
    renderLeaderboardPage();
  } else if (viewId === 'view-home') {
    updateNavActiveDuelsCount();
  }

  updateDuelHeaderUI();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------------- ÜST DÜELLO BARI ----------------
function updateDuelHeaderUI() {
  const p1Display = gameState.player1Name.trim() || 'Oyuncu 1';
  const p2Display = gameState.player2Name.trim() || 'Oyuncu 2';

  const p1El = document.getElementById('vs-p1-name');
  const p2El = document.getElementById('vs-p2-name');
  if (p1El) p1El.textContent = p1Display;
  if (p2El) p2El.textContent = p2Display;

  const bondObj = userProfile.bonds[p2Display];
  const p2Sub = document.getElementById('vs-p2-sub');
  if (p2Sub) {
    if (gameState.isSandboxTest) {
      p2Sub.textContent = '🧪 Cihaz İçi Simülasyon';
    } else {
      p2Sub.textContent = bondObj && bondObj.level > 0
        ? `Bağ: LVL ${bondObj.level}`
        : `Mod: ${gameState.mode === 'arena' ? gameState.arenaFormat.toUpperCase() : 'Klasik Oyun'}`;
    }
  }

  const roundBadge = document.getElementById('duel-round-badge');
  if (roundBadge) {
    roundBadge.textContent = gameState.isSandboxTest
      ? 'SİMÜLASYON TESTİ • ETKİ: 0'
      : `RAUND ${gameState.currentRound} • YARI ${gameState.half}/2`;
  }

  const dotsContainer = document.getElementById('duel-progress-dots');
  if (dotsContainer) {
    dotsContainer.innerHTML = '';
    for (let i = 0; i < TOTAL_QUESTIONS; i++) {
      const dot = document.createElement('span');
      const state = gameState.progressDots[i];
      if (state === 'correct') {
        dot.className = "w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-sm inline-block";
      } else if (state === 'wrong') {
        dot.className = "w-3.5 h-3.5 rounded-full bg-red-500 shadow-sm inline-block";
      } else if (state === 'answered') {
        dot.className = "w-3.5 h-3.5 rounded-full bg-primary-theme inline-block";
      } else if (i === gameState.currentQuestionIndex) {
        dot.className = "w-3.5 h-3.5 rounded-full border-2 border-[var(--primary)] bg-transparent inline-block animate-pulse";
      } else {
        dot.className = "w-3.5 h-3.5 rounded-full bg-slate-300 dark:bg-slate-700 inline-block";
      }
      dotsContainer.appendChild(dot);
    }
  }

  const pctEl = document.getElementById('duel-live-match-pct');
  if (pctEl) {
    const judged = gameState.progressDots.filter((d) => d === 'correct' || d === 'wrong');
    if (judged.length === 0) {
      pctEl.textContent = '%100';
    } else {
      const corr = judged.filter((d) => d === 'correct').length;
      pctEl.textContent = `%${Math.round((corr / judged.length) * 100)}`;
    }
  }
}

// KULLANICI İSMİNİ GİRDİĞİ SANİYE ÇEREZ VE LOCALSTORAGE'A KAYDET (Böylece bir daha asla "Adın Nedir?" sorulmaz!)
function syncHeaderNames() {
  const p1Input = document.getElementById('input-p1-name');
  const p2Input = document.getElementById('input-p2-name');
  gameState.player1Name = p1Input ? p1Input.value : '';
  gameState.player2Name = p2Input ? p2Input.value : '';
  if (gameState.player1Name.trim()) {
    userProfile.username = gameState.player1Name.trim();
    persistIdentityToStorage();
    const navName = document.getElementById('nav-profile-name');
    if (navName) navName.textContent = userProfile.username;
  }
  updateDuelHeaderUI();
}

function syncHeaderNamesFromPass() {
  const passInput = document.getElementById('input-pass-p2-name');
  if (passInput) {
    gameState.player2Name = passInput.value;
    updateDuelHeaderUI();
  }
}

// ---------------- MOD VE KATEGORİ SEÇİMLERİ ----------------
function selectGameMode(mode) {
  gameState.mode = mode;
  ['link', 'pass', 'arena'].forEach((m) => {
    const btn = document.getElementById(`mode-btn-${m}`);
    if (btn) btn.classList.toggle('is-active', m === mode);
  });

  const startLabel = document.getElementById('btn-start-game-label');
  if (startLabel) {
    if (mode === 'arena') {
      startLabel.textContent = "Canlı Oda Kur & Kod Al";
    } else if (mode === 'pass') {
      startLabel.textContent = "Yan Yana Düelloyu Başlat";
    } else {
      startLabel.textContent = "Klasik Düelloyu Başlat";
    }
  }
}

function selectCategory(category) {
  gameState.category = category;
  const buttons = document.querySelectorAll('.cat-btn');
  buttons.forEach((btn) => {
    btn.classList.toggle('is-active', btn.getAttribute('data-cat') === category);
  });
}

function selectArenaFormat(fmt) {
  gameState.arenaFormat = fmt;
  const buttons = document.querySelectorAll('.fmt-btn');
  buttons.forEach((btn) => {
    btn.classList.toggle('is-active', btn.getAttribute('data-fmt') === fmt);
  });

  const descMap = {
    '1v1': '1v1 Düello: İki oyuncu birbirini ne kadar tanıdığını canlı test eder.',
    '2v2': '2v2 Takım Düellosu: İkişer kişilik takımlar eşlerinin cevaplarını tahmin ederek yarışır!',
    '3v3': '3v3 Ekip Savaşı: 3 kişilik iki takım en yüksek uyum puanı için kapışır!',
    '4v4': '4v4 Grup Arenası: 4v4 arkadaş grubu uyumu!',
    '5v5': '5v5 Dev Klan Maçı: 10 kişilik parti modu!',
    'ffa': '🌪️ Herkes Tek (Free-For-All): Ebeli veya paket modunda herkes birbirini tahmin eder!'
  };
  const descEl = document.getElementById('arena-format-desc');
  if (descEl) descEl.textContent = descMap[fmt] || '';
  pushLiveLobbySettingsToCloud();
}

// ---------------- SORU SEÇİMİ VE TEKRAR ENGELLEME ----------------
function pickQuestionsForCategory(category, count = TOTAL_QUESTIONS) {
  const unusedPool = QUESTIONS_DB.filter((q) => !gameState.usedQuestionIds.includes(q.id));
  const sourcePool = unusedPool.length >= count ? unusedPool : QUESTIONS_DB;

  const primary = sourcePool.filter((q) => q.category === category);
  const others = sourcePool.filter((q) => q.category !== category);
  const combined = [...shuffleArray(primary), ...shuffleArray(others)];
  const picked = combined.slice(0, count);

  picked.forEach((q) => {
    if (!gameState.usedQuestionIds.includes(q.id)) {
      gameState.usedQuestionIds.push(q.id);
    }
  });
  return picked;
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ---------------- BAŞLATMA AKSİYONU ----------------
async function handlePrimaryStartAction() {
  const p1Input = document.getElementById('input-p1-name');
  const p2Input = document.getElementById('input-p2-name');
  const errorBox = document.getElementById('home-error');
  const errorText = document.getElementById('home-error-text');

  const p1Name = p1Input ? p1Input.value.trim() : '';
  const p2Raw = p2Input ? p2Input.value.trim() : '';

  if (!p1Name) {
    errorText.textContent = "Lütfen başlamadan önce kendi adını yaz!";
    errorBox.classList.remove('hidden');
    if (p1Input) p1Input.focus();
    return;
  }
  errorBox.classList.add('hidden');

  gameState.player1Name = p1Name;
  gameState.isSandboxTest = false;

  if (/^SNC-\d{4}$/i.test(p2Raw)) {
    gameState.player2FriendCode = p2Raw.toUpperCase();
    gameState.player2Name = p2Raw.toUpperCase();
  } else {
    gameState.player2Name = p2Raw;
    gameState.player2FriendCode = '';
  }

  userProfile.username = p1Name;
  saveUserProfile();

  if (gameState.mode === 'arena') {
    gameState.roomCode = generateRoomCode();
    document.getElementById('live-lobby-room-code').textContent = gameState.roomCode;
    const catSelect = document.getElementById('live-lobby-cat-select');
    if (catSelect) catSelect.value = gameState.category;

    const initialRoom = {
      code: gameState.roomCode,
      p1Id: userProfile.id,
      hostCode: userProfile.friendCode,
      p1FriendCode: userProfile.friendCode,
      p2FriendCode: gameState.player2FriendCode || '',
      roomType: 'live_arena',
      arenaFormat: gameState.arenaFormat,
      liveSettings: { ...gameState.liveSettings },
      status: 'lobby_open',
      currentRound: 1,
      p1: p1Name,
      p2: gameState.player2Name,
      participants: [{ name: p1Name, code: userProfile.friendCode, role: 'host', team: 'common', isHost: true }],
      cat: gameState.category,
      thm: gameState.theme,
      qIds: [],
      createdAt: new Date().toISOString()
    };

    await saveRoomToDatabase(initialRoom);
    renderLiveLobbyState(initialRoom);
    showView('view-live-room-lobby');
    startLiveLobbyParticipantPolling(gameState.roomCode);
    return;
  }

  gameState.roomCode = '';
  startClassicFirstHalf();
}

// Kişi Sayısı Uyuşmazlığı Kontrolü (Örn: 3v3 seçili ama odada 3 kişi varsa uyarı pop-up'ı çıkar)
function closeLiveMismatchModal() {
  const modal = document.getElementById('live-mismatch-modal');
  if (modal) modal.classList.add('hidden');
}

function selectMismatchFfaMode(sub) {
  const normalized = sub === 'ebe' ? 'ebeli' : sub === 'packet' ? 'paket' : sub;
  gameState.liveSettings.ffaSubMode = normalized;
  const bEbe = document.getElementById('mismatch-opt-ebe');
  const bPacket = document.getElementById('mismatch-opt-packet');
  if (bEbe) bEbe.classList.toggle('is-active', normalized === 'ebeli');
  if (bPacket) bPacket.classList.toggle('is-active', normalized === 'paket');
}

async function confirmSwitchToFfaAndStart() {
  const starterSel = document.getElementById('mismatch-ebe-select');
  if (starterSel) {
    const val = starterSel.value;
    if (val === 'random') {
      gameState.liveSettings.starterMode = 'random';
      gameState.liveSettings.selectedStarterCode = '';
    } else {
      gameState.liveSettings.starterMode = 'manual';
      gameState.liveSettings.selectedStarterCode = val;
    }
  }
  closeLiveMismatchModal();
  selectArenaFormat('ffa');
  await launchSynchronizedLiveArenaMatch(true);
}

async function startMatchFromLiveLobby() {
  const room = await fetchRoomFromDatabase(gameState.roomCode);
  if (room && !isCurrentUserHostOfLiveRoom(room)) {
    return;
  }

  const participants = room && Array.isArray(room.participants) ? room.participants : [{ name: gameState.player1Name, code: userProfile.friendCode }];
  const pCount = participants.length;
  const requiredMap = { '1v1': 2, '2v2': 4, '3v3': 6, '4v4': 8, '5v5': 10 };
  const requiredCount = requiredMap[gameState.arenaFormat] || 0;

  // Eğer 2v2, 3v3, 4v4, 5v5 seçiliyse ve odadaki kişi sayısı yetmiyorsa uyarı modalı aç!
  if (requiredCount > 2 && pCount < requiredCount) {
    const modal = document.getElementById('live-mismatch-modal');
    const titleEl = document.getElementById('mismatch-modal-title');
    const descEl = document.getElementById('mismatch-modal-desc');
    const starterSel = document.getElementById('mismatch-ebe-select');
    if (titleEl) {
      titleEl.textContent = `${gameState.arenaFormat.toUpperCase()} İçin ${requiredCount} Oyuncu Gerekli (Odada ${pCount} Kişi Var)`;
    }
    if (descEl) {
      descEl.textContent = `Şu an odada sadece ${pCount} kişisiniz! "${gameState.arenaFormat.toUpperCase()}" yerine mevcut ${pCount} kişiyle "🌪️ Herkes Tek (Free-For-All)" modunu başlatayım mı?`;
    }
    if (starterSel) {
      starterSel.innerHTML = `<option value="random">🎲 Rastgele Ebe Seçilsin</option>` +
        participants.map((p) => `<option value="${escapeHtml(p.code)}">👑 İlk Ebe: ${escapeHtml(p.name)} (${escapeHtml(p.code)})</option>`).join('');
    }
    if (modal) {
      modal.classList.remove('hidden');
      return;
    }
  }

  await launchSynchronizedLiveArenaMatch(false);
}

async function launchSynchronizedLiveArenaMatch(forceFfa = false) {
  stopLiveLobbyParticipantPolling();
  const catSelect = document.getElementById('live-lobby-cat-select');
  if (catSelect) gameState.category = catSelect.value;
  if (forceFfa) gameState.arenaFormat = 'ffa';

  const pickedQs = pickQuestionsForCategory(gameState.category, TOTAL_QUESTIONS);
  gameState.selectedQuestions = pickedQs;

  try {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        action: 'start_live_match',
        code: gameState.roomCode,
        requesterCode: userProfile.friendCode,
        qIds: pickedQs.map((q) => q.id),
        arenaFormat: gameState.arenaFormat,
        cat: gameState.category,
        liveSettings: { ...gameState.liveSettings }
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.room) {
        loadRoomIntoGameState(data.room, false);
        return;
      }
    }
  } catch (e) {}

  startClassicFirstHalf();
}

// ISSUE #1 Çözümü: Yeni raund veya 1. Yarı başlarken 2. Yarı (p2Half2*) dizileri de eksiksiz sıfırlanır!
function startClassicFirstHalf() {
  if (!gameState.roomCode) {
    gameState.roomCode = generateRoomCode();
  }
  gameState.isSandboxTest = false;
  gameState.half = 1;
  gameState.phase = 'p1_answer';
  gameState.selectedQuestions = pickQuestionsForCategory(gameState.category, TOTAL_QUESTIONS);
  gameState.shufflesLeft = 2;
  gameState.passUsedThisTurn = false;
  gameState.customAnswerUsedThisTurn = false;
  gameState.customOptionsMap = {};
  gameState.p1Answers = [];
  gameState.p2Guesses = [];
  gameState.p1Comments = [];
  gameState.p2Comments = [];
  gameState.p2Half2Questions = [];
  gameState.p2Half2Answers = [];
  gameState.p1Half2Guesses = [];
  gameState.p2Half2Comments = [];
  gameState.p1Half2Comments = [];
  gameState.p2Half2CustomMap = {};
  gameState.currentQuestionIndex = 0;
  gameState.progressDots = [];
  gameState.isLocked = false;

  updateDuelHeaderUI();
  showView('view-question');
  renderCurrentQuestion();
}

// ---------------- SORU EKRANI RENDER, SÜRE SAYACI & 1.5SN BALONCUK GECİKMESİ ----------------
function isCurrentPhaseAnswering() {
  return gameState.phase === 'p1_answer' || gameState.phase === 'p2_answer';
}

function getActiveQuestionList() {
  return gameState.half === 1 ? gameState.selectedQuestions : gameState.p2Half2Questions;
}

function stopQuestionCountdownTimer() {
  if (gameState.questionTimerIntervalId) {
    clearInterval(gameState.questionTimerIntervalId);
    gameState.questionTimerIntervalId = null;
  }
}

function startQuestionCountdownTimer() {
  stopQuestionCountdownTimer();
  const pill = document.getElementById('question-live-timer-pill');
  const textEl = document.getElementById('question-live-timer-text');
  const secLimit =
    gameState.mode === 'arena' && gameState.liveSettings && Number(gameState.liveSettings.timerSeconds) > 0
      ? Number(gameState.liveSettings.timerSeconds)
      : 0;

  if (!secLimit || secLimit <= 0) {
    if (pill) pill.classList.add('hidden');
    return;
  }

  gameState.questionTimerRemaining = secLimit;
  if (pill && textEl) {
    textEl.textContent = `${gameState.questionTimerRemaining} sn`;
    pill.classList.remove('hidden');
    pill.classList.add('flex');
  }

  gameState.questionTimerIntervalId = setInterval(() => {
    if (gameState.isLocked) {
      stopQuestionCountdownTimer();
      return;
    }
    gameState.questionTimerRemaining--;
    if (textEl) textEl.textContent = `${Math.max(0, gameState.questionTimerRemaining)} sn`;
    if (gameState.questionTimerRemaining <= 0) {
      stopQuestionCountdownTimer();
      const firstBtn = document.querySelector('#options-container .option-btn');
      if (firstBtn && !gameState.isLocked) {
        handleOptionSelect(0, firstBtn, null);
      }
    }
  }, 1000);
}

function renderCurrentQuestion() {
  const qIndex = gameState.currentQuestionIndex;
  const qList = getActiveQuestionList();
  const questionObj = qList[qIndex];
  if (!questionObj) return;

  if (gameState.secretBubbleTimeoutId) {
    clearTimeout(gameState.secretBubbleTimeoutId);
    gameState.secretBubbleTimeoutId = null;
  }

  const isAnswering = isCurrentPhaseAnswering();
  const answererName = gameState.half === 1 ? gameState.player1Name : (gameState.player2Name || '2. Oyuncu');
  const guesserName = gameState.isSandboxTest
    ? `${gameState.player1Name} (Test Simülasyonu)`
    : gameState.half === 1
    ? (gameState.player2Name || '2. Oyuncu')
    : gameState.player1Name;

  document.getElementById('header-question-counter').textContent = `SORU ${qIndex + 1} / ${TOTAL_QUESTIONS}`;

  const typingInd = document.getElementById('messenger-typing-indicator');
  if (typingInd) typingInd.classList.add('hidden');
  document.getElementById('messenger-secret-bubble').classList.add('hidden');
  document.getElementById('guess-feedback-banner').classList.add('hidden');
  document.getElementById('post-answer-comment-box').classList.add('hidden');
  toggleCustomAnswerBox(false);

  const commentInput = document.getElementById('input-question-comment');
  if (commentInput) commentInput.value = '';
  gameState.pendingChoiceIndex = null;
  gameState.pendingEmoji = '';
  resetEmojiPickButtons();

  const shuffleBtn = document.getElementById('btn-shuffle-question');
  const shuffleLabel = document.getElementById('btn-shuffle-label');
  if (shuffleBtn && shuffleLabel) {
    if (isAnswering) {
      shuffleBtn.classList.remove('hidden');
      shuffleBtn.disabled = gameState.shufflesLeft <= 0;
      shuffleLabel.textContent = `Değiştir (${gameState.shufflesLeft}/2)`;
      shuffleBtn.className = gameState.shufflesLeft > 0
        ? "px-3 py-1.5 rounded-full stitch-subcard text-primary-theme font-bold text-xs hover:border-[var(--primary)] transition flex items-center gap-1"
        : "px-3 py-1.5 rounded-full stitch-subcard opacity-40 font-bold text-xs cursor-not-allowed flex items-center gap-1";
    } else {
      shuffleBtn.classList.add('hidden');
    }
  }

  const passBtn = document.getElementById('btn-use-pass');
  const passLabel = document.getElementById('btn-pass-label');
  if (passBtn && passLabel) {
    if (isAnswering) {
      passBtn.classList.remove('hidden');
      passBtn.disabled = gameState.passUsedThisTurn;
      passLabel.textContent = gameState.passUsedThisTurn ? "Pas Bitti (0/1)" : "Pas (1/1)";
      passBtn.className = gameState.passUsedThisTurn
        ? "px-3 py-1.5 rounded-full stitch-subcard opacity-40 font-bold text-xs cursor-not-allowed flex items-center gap-1"
        : "px-3 py-1.5 rounded-full bg-amber-500 text-white font-bold text-xs shadow-sm hover:opacity-95 transition flex items-center gap-1";
    } else {
      passBtn.classList.add('hidden');
    }
  }

  const customWrapper = document.getElementById('custom-answer-wrapper');
  const customBtn = document.getElementById('btn-open-custom-answer');
  const customLabel = document.getElementById('btn-custom-answer-label');
  if (customWrapper && customBtn && customLabel) {
    if (isAnswering) {
      customWrapper.classList.remove('hidden');
      customBtn.disabled = gameState.customAnswerUsedThisTurn;
      customLabel.textContent = gameState.customAnswerUsedThisTurn
        ? "Özel Şık Hakkı Kullanıldı (0/1)"
        : "Kendi Cevabını Yaz (Özel Şık Ekle • 1/1 Hak)";
      customBtn.className = gameState.customAnswerUsedThisTurn
        ? "w-full py-2 px-3 rounded-xl stitch-subcard opacity-40 text-xs font-bold cursor-not-allowed flex items-center justify-center gap-2"
        : "w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-[var(--primary)] stitch-subcard text-xs sm:text-sm font-bold text-primary-theme flex items-center justify-center gap-2 transition";
    } else {
      customWrapper.classList.add('hidden');
    }
  }

  const turnBadge = document.getElementById('question-turn-badge');
  const stepLabel = document.getElementById('question-step-label');
  const questionTextEl = document.getElementById('question-text');

  if (isAnswering) {
    turnBadge.innerHTML = `<span>😎</span> <span>${escapeHtml(answererName)} Cevaplıyor</span>`;
    stepLabel.textContent = "KENDİ ADINA CEVAPLA";
    questionTextEl.textContent = questionObj.q1;
  } else {
    turnBadge.innerHTML = `<span>🕵️</span> <span>${escapeHtml(guesserName)} Tahmin Ediyor</span>`;
    stepLabel.textContent = `SENCE ${answererName.toUpperCase()} NE SEÇMİŞTİR?`;
    questionTextEl.textContent = questionObj.q2.replace('{p1}', answererName);
  }

  const optionsContainer = document.getElementById('options-container');
  optionsContainer.innerHTML = '';

  const activeCustomMap = gameState.half === 1 ? gameState.customOptionsMap : gameState.p2Half2CustomMap;
  const customTextForThisQ = activeCustomMap && activeCustomMap[qIndex];

  const displayOptions = questionObj.options.map((o) => ({ ...o }));
  if (customTextForThisQ) {
    if (displayOptions.length >= 4) {
      displayOptions[3] = { icon: "✏️", text: customTextForThisQ };
    } else {
      displayOptions.push({ icon: "✏️", text: customTextForThisQ });
    }
  }

  displayOptions.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = "option-btn w-full p-3.5 sm:p-4 text-left flex items-center gap-3.5 focus:outline-none";
    btn.innerHTML = `
      <div class="w-11 h-11 rounded-xl stitch-subcard flex items-center justify-center text-2xl shrink-0">
        ${opt.icon}
      </div>
      <div class="flex-1 text-sm sm:text-base font-bold leading-snug">
        ${escapeHtml(opt.text)}
      </div>
      <div class="option-status-icon w-6 h-6 rounded-full border border-[var(--outline-variant)] flex items-center justify-center text-xs shrink-0">
      </div>
    `;
    btn.addEventListener('click', (ev) => handleOptionSelect(idx, btn, ev));
    optionsContainer.appendChild(btn);
  });

  gameState.isLocked = false;
  startQuestionCountdownTimer();
  updateDuelHeaderUI();
}

// ISSUE #3 Çözümü: Soru değiştirildiğinde o soruya yazılmış özel şık varsa temizlenir ve özel şık hakkı iade edilir!
function handleShuffleQuestion() {
  if (!isCurrentPhaseAnswering() || gameState.shufflesLeft <= 0) return;

  const replacement = pickQuestionsForCategory(gameState.category, 1)[0];
  if (!replacement) return;

  const qIndex = gameState.currentQuestionIndex;
  const activeCustomMap = gameState.half === 1 ? gameState.customOptionsMap : gameState.p2Half2CustomMap;
  if (activeCustomMap && activeCustomMap[qIndex]) {
    delete activeCustomMap[qIndex];
    gameState.customAnswerUsedThisTurn = false;
  }

  gameState.isLocked = false;
  gameState.shufflesLeft--;
  const qList = getActiveQuestionList();
  qList[qIndex] = replacement;

  const cardBox = document.getElementById('question-card-box');
  if (cardBox) {
    cardBox.classList.remove('animate-flip');
    void cardBox.offsetWidth;
    cardBox.classList.add('animate-flip');
  }

  playSoundEffect('pop');
  renderCurrentQuestion();
}

function toggleCustomAnswerBox(show) {
  const box = document.getElementById('custom-answer-input-box');
  if (!box) return;
  box.classList.toggle('hidden', !show);
  if (show) {
    const inp = document.getElementById('input-custom-option-text');
    if (inp) {
      inp.value = '';
      inp.focus();
    }
  }
}

function submitCustomAnswerOption() {
  if (gameState.isLocked || !isCurrentPhaseAnswering() || gameState.customAnswerUsedThisTurn) return;
  const inp = document.getElementById('input-custom-option-text');
  const text = inp ? inp.value.trim() : '';
  if (!text) return;

  const qIndex = gameState.currentQuestionIndex;
  const qList = getActiveQuestionList();
  const questionObj = qList[qIndex];
  const customIdx = questionObj.options.length >= 4 ? 3 : questionObj.options.length;

  if (gameState.half === 1) {
    gameState.customOptionsMap[qIndex] = text;
  } else {
    gameState.p2Half2CustomMap[qIndex] = text;
  }
  gameState.customAnswerUsedThisTurn = true;
  toggleCustomAnswerBox(false);
  renderCurrentQuestion();

  const allButtons = document.querySelectorAll('#options-container .option-btn');
  const targetBtn = allButtons[customIdx];
  if (targetBtn) {
    handleOptionSelect(customIdx, targetBtn, null);
  }
}

function handlePassQuestion() {
  if (gameState.isLocked || !isCurrentPhaseAnswering() || gameState.passUsedThisTurn) return;

  gameState.isLocked = true;
  gameState.passUsedThisTurn = true;
  stopQuestionCountdownTimer();

  const allButtons = document.querySelectorAll('#options-container .option-btn');
  allButtons.forEach((b) => {
    b.disabled = true;
    b.classList.add('opacity-50');
  });

  spawnFloatingEmojiBurst('⏭️');
  const feedbackBanner = document.getElementById('guess-feedback-banner');
  feedbackBanner.classList.remove('hidden');
  feedbackBanner.className = "rounded-xl px-4 py-3 text-center font-bold text-xs sm:text-sm bg-amber-500/20 border border-amber-500/50 text-amber-700 dark:text-amber-200";
  feedbackBanner.textContent = "⏭️ Pas hakkını kullandın! Sonraki soruya geçmeden önce yorumunu ve emojini aşağıya bırakabilirsin.";

  openPostAnswerCommentDrawer(PASS_ANSWER_VALUE);
}

// KULLANICI İSTEĞİ: Cevap seçildiğinde doğru/yanlış ANINDA açılır, karşı tarafın bıraktığı yorum baloncuğu ise 1.5 SANİYE (1500ms) SONRA fırlar!
function handleOptionSelect(selectedIndex, clickedBtn, clickEvent) {
  if (gameState.isLocked) return;
  gameState.isLocked = true;
  stopQuestionCountdownTimer();

  const allButtons = document.querySelectorAll('#options-container .option-btn');
  allButtons.forEach((b) => (b.disabled = true));

  const qIndex = gameState.currentQuestionIndex;
  const qList = getActiveQuestionList();
  const chosenEmoji = qList[qIndex]?.options[selectedIndex]?.icon || '✨';
  spawnFloatingEmojiBurst(chosenEmoji, clickEvent);

  const isAnswering = isCurrentPhaseAnswering();
  const answererName = gameState.half === 1 ? gameState.player1Name : (gameState.player2Name || '2. Oyuncu');

  if (isAnswering) {
    clickedBtn.classList.add('option-selected-p1');
    const statusIcon = clickedBtn.querySelector('.option-status-icon');
    if (statusIcon) {
      statusIcon.innerHTML = '✓';
      statusIcon.className = 'option-status-icon w-6 h-6 rounded-full bg-primary-theme font-extrabold flex items-center justify-center text-xs shrink-0';
    }
    gameState.progressDots[qIndex] = 'answered';
    playSoundEffect('pop');
  } else {
    const targetAnswers = gameState.half === 1 ? gameState.p1Answers : gameState.p2Half2Answers;
    const targetComments = gameState.half === 1 ? gameState.p1Comments : gameState.p2Half2Comments;
    const correctIndex = targetAnswers[qIndex];

    const feedbackBanner = document.getElementById('guess-feedback-banner');
    feedbackBanner.classList.remove('hidden');

    if (correctIndex === PASS_ANSWER_VALUE) {
      clickedBtn.classList.add('option-correct');
      gameState.progressDots[qIndex] = 'correct';
      playSoundEffect('correct');
      feedbackBanner.className = "rounded-xl px-4 py-3 text-center font-bold text-xs sm:text-sm bg-emerald-500/20 border border-emerald-500/50 text-emerald-700 dark:text-emerald-200";
      feedbackBanner.textContent = `⏭️ ${answererName} bu soruyu Pas geçmişti!`;
    } else if (selectedIndex === correctIndex) {
      clickedBtn.classList.add('option-correct');
      gameState.progressDots[qIndex] = 'correct';
      playSoundEffect('correct');
      const statusIcon = clickedBtn.querySelector('.option-status-icon');
      if (statusIcon) {
        statusIcon.innerHTML = '✓';
        statusIcon.className = 'option-status-icon w-6 h-6 rounded-full bg-emerald-500 text-white font-extrabold flex items-center justify-center text-xs shrink-0';
      }
      feedbackBanner.className = "rounded-xl px-4 py-3 text-center font-bold text-xs sm:text-sm bg-emerald-500/20 border border-emerald-500/50 text-emerald-700 dark:text-emerald-200";
      feedbackBanner.textContent = `🎯 +1 Puan! Tam İsabet! ${answererName} tam olarak bunu seçmişti!`;
    } else {
      clickedBtn.classList.add('option-wrong');
      gameState.progressDots[qIndex] = 'wrong';
      playSoundEffect('wrong');
      const wrongIcon = clickedBtn.querySelector('.option-status-icon');
      if (wrongIcon) {
        wrongIcon.innerHTML = '✕';
        wrongIcon.className = 'option-status-icon w-6 h-6 rounded-full bg-red-500 text-white font-extrabold flex items-center justify-center text-xs shrink-0';
      }
      const correctBtn = allButtons[correctIndex];
      if (correctBtn) {
        correctBtn.classList.add('option-correct');
        const rightIcon = correctBtn.querySelector('.option-status-icon');
        if (rightIcon) {
          rightIcon.innerHTML = '✓';
          rightIcon.className = 'option-status-icon w-6 h-6 rounded-full bg-emerald-500 text-white font-extrabold flex items-center justify-center text-xs shrink-0';
        }
      }
      feedbackBanner.className = "rounded-xl px-4 py-3 text-center font-bold text-xs sm:text-sm bg-red-500/20 border border-red-500/50 text-red-700 dark:text-red-200";
      feedbackBanner.textContent = `❌ Yanlış Tahmin! ${answererName} yeşil işaretli şıkkı seçmişti.`;
    }

    // 1.5 Saniye (1500ms) Gecikmeli Gizli Not Baloncuğu!
    const secretEntry = targetComments[qIndex];
    if (secretEntry && (secretEntry.emoji || secretEntry.text)) {
      const typingInd = document.getElementById('messenger-typing-indicator');
      const bubbleEl = document.getElementById('messenger-secret-bubble');
      const senderEl = document.getElementById('messenger-bubble-sender');
      const textEl = document.getElementById('messenger-bubble-text');

      if (typingInd) {
        typingInd.classList.remove('hidden');
        typingInd.classList.add('flex');
      }

      if (gameState.secretBubbleTimeoutId) clearTimeout(gameState.secretBubbleTimeoutId);
      gameState.secretBubbleTimeoutId = setTimeout(() => {
        if (typingInd) {
          typingInd.classList.add('hidden');
          typingInd.classList.remove('flex');
        }
        if (bubbleEl && senderEl && textEl) {
          senderEl.textContent = `💬 ${answererName} Diyor Ki:`;
          textEl.textContent = `${secretEntry.emoji || ''} ${secretEntry.text || ''}`.trim();
          bubbleEl.classList.remove('hidden');
          playSoundEffect('pop');
        }
      }, 1500);
    }
  }

  updateDuelHeaderUI();
  openPostAnswerCommentDrawer(selectedIndex);
}

function openPostAnswerCommentDrawer(choiceIdx) {
  gameState.pendingChoiceIndex = choiceIdx;
  const drawer = document.getElementById('post-answer-comment-box');
  const confirmBtnText = document.getElementById('btn-confirm-step-text');
  const isLastQuestion = gameState.currentQuestionIndex >= TOTAL_QUESTIONS - 1;

  if (confirmBtnText) {
    confirmBtnText.textContent = isLastQuestion ? 'TURU BİTİR' : 'İLERLE';
  }
  drawer.classList.remove('hidden');
}

function selectReactionEmoji(emojiChar, ev) {
  gameState.pendingEmoji = emojiChar;
  spawnFloatingEmojiBurst(emojiChar, ev);
  const buttons = document.querySelectorAll('#emoji-reaction-bar .emoji-pick-btn');
  buttons.forEach((btn) => {
    if (btn.getAttribute('data-emoji') === emojiChar) {
      btn.className = "emoji-pick-btn w-8 h-8 rounded-lg bg-primary-theme scale-110 font-bold text-base flex items-center justify-center transition shadow";
    } else {
      btn.className = "emoji-pick-btn w-8 h-8 rounded-lg stitch-subcard hover:scale-110 text-base flex items-center justify-center transition";
    }
  });
}

function resetEmojiPickButtons() {
  const buttons = document.querySelectorAll('#emoji-reaction-bar .emoji-pick-btn');
  buttons.forEach((btn) => {
    btn.className = "emoji-pick-btn w-8 h-8 rounded-lg stitch-subcard hover:scale-110 text-base flex items-center justify-center transition";
  });
}

async function confirmStepAndAdvance() {
  if (gameState.pendingChoiceIndex === null) return;

  const commentInput = document.getElementById('input-question-comment');
  const commentText = commentInput ? commentInput.value.trim() : '';
  const emoji = gameState.pendingEmoji || '';
  const choice = gameState.pendingChoiceIndex;

  if (gameState.phase === 'p1_answer') {
    gameState.p1Answers.push(choice);
    gameState.p1Comments.push({ emoji, text: commentText });
  } else if (gameState.phase === 'p2_guess') {
    gameState.p2Guesses.push(choice);
    gameState.p2Comments.push({ emoji, text: commentText });
  } else if (gameState.phase === 'p2_answer') {
    gameState.p2Half2Answers.push(choice);
    gameState.p2Half2Comments.push({ emoji, text: commentText });
  } else if (gameState.phase === 'p1_guess') {
    gameState.p1Half2Guesses.push(choice);
    gameState.p1Half2Comments.push({ emoji, text: commentText });
  }

  gameState.pendingChoiceIndex = null;
  gameState.pendingEmoji = '';

  // Eğer Canlı Oda Eşzamanlı Moddaysa (1'er 1'er, 2'şer 2'şer vb. adım kontrolü):
  if (gameState.mode === 'arena' && gameState.liveMatchState && gameState.roomCode && !gameState.isSandboxTest) {
    const stepSize = Number((gameState.liveSettings && gameState.liveSettings.turnStep) || 1);
    const currentStepAnswers = gameState.phase === 'p1_answer' ? gameState.p1Answers : gameState.p2Guesses;

    if (currentStepAnswers.length % stepSize === 0 || gameState.currentQuestionIndex >= TOTAL_QUESTIONS - 1) {
      try {
        const res = await fetch('/api/rooms', {
          method: 'POST',
          headers: getSupabaseHeaders(),
          body: JSON.stringify({
            action: 'submit_live_step',
            code: gameState.roomCode,
            friendCode: userProfile.friendCode,
            playerName: userProfile.username || gameState.player1Name || 'Oyuncu',
            answers: gameState.phase === 'p1_answer' ? gameState.p1Answers.slice(-stepSize) : [],
            guesses: gameState.phase === 'p2_guess' ? gameState.p2Guesses.slice(-stepSize) : [],
            comments: (gameState.phase === 'p1_answer' ? gameState.p1Comments : gameState.p2Comments).slice(-stepSize),
            customOptionsMap: gameState.customOptionsMap
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.room) {
            loadRoomIntoGameState(data.room, false);
            return;
          }
        }
      } catch (e) {}
    }
  }

  if (gameState.currentQuestionIndex < TOTAL_QUESTIONS - 1) {
    gameState.currentQuestionIndex++;
    renderCurrentQuestion();
  } else {
    handleEndOfFiveQuestionBlock();
  }
}

// ---------------- 5 SORULUK BLOK SONU, SİMÜLASYON TEST KORUMASI VE ROLLERİN DEĞİŞMESİ ----------------
async function handleEndOfFiveQuestionBlock() {
  if (gameState.phase === 'p1_answer') {
    await showInterstitialScreen('after_p1_answer');
  } else if (gameState.phase === 'p2_guess') {
    // KRİTİK KURAL: Eğer kullanıcı "Bu Cihazda Test Et (Simülasyon)" modundaysa:
    // 1. Asla karşı saldırı (5 yeni soru sorma) yapamaz!
    // 2. Gerçek düello veritabanına veya odaya etkisi 0'dır!
    if (gameState.isSandboxTest) {
      showSandboxSimulationResult();
      return;
    }

    let c1 = 0;
    for (let i = 0; i < TOTAL_QUESTIONS; i++) {
      if (isQuestionMatch(gameState.p1Answers[i], gameState.p2Guesses[i])) c1++;
    }
    const pct1 = Math.round((c1 / TOTAL_QUESTIONS) * 100);
    gameState.half1Score = { correct: c1, total: TOTAL_QUESTIONS };

    document.getElementById('halftime-title').textContent = `1. Yarı Bitti! ${gameState.player1Name}'i %${pct1} Tanıdın! 🔥`;
    document.getElementById('halftime-desc').innerHTML = `Klasik Oyun kuralı: Roller değişiyor! Şimdi sıra sende (<strong>${escapeHtml(gameState.player2Name || '2. Oyuncu')}</strong>)! Kendinle ilgili 5 yeni soruyu cevapla, bakalım <strong>${escapeHtml(gameState.player1Name)}</strong> seni ne kadar tanıyor?`;
    showView('view-halftime-reversal');
  } else if (gameState.phase === 'p2_answer') {
    await showInterstitialScreen('after_p2_answer');
  } else if (gameState.phase === 'p1_guess') {
    await finalizeGameAndShowResults();
  }
}

// Simülasyon Testi Bittiğinde Gösterilen Sıfır-Etkili Ekran (Karşı Saldırı Yok, DB Kaydı Yok, XP Yok!)
function showSandboxSimulationResult() {
  showView('view-result');
  const { correctCount, totalCount, percentage } = calculateOverallRoundScore();

  document.getElementById('result-round-pill').textContent = '🧪 CİHAZ İÇİ TEST SİMÜLASYONU (GERÇEK DÜELLOYA ETKİSİ: 0)';
  document.getElementById('result-p1-name').textContent = gameState.player1Name || 'Oyuncu 1';
  document.getElementById('result-p2-name').textContent = 'Cihaz İçi Test';
  document.getElementById('result-correct-ratio').textContent = `${correctCount} / ${totalCount} Test Tahmini`;

  document.getElementById('result-personal-xp-pill').textContent = '🧪 Simülasyon Modu (+0 XP)';
  document.getElementById('result-bond-xp-pill').textContent = '🔒 Gerçek Oda Korundu';

  const nextRoundBtn = document.getElementById('btn-next-round-action');
  const nextRoundLabel = document.getElementById('btn-next-round-label');
  if (nextRoundBtn && nextRoundLabel) {
    nextRoundLabel.textContent = 'DAVET LİNKİ & BEKLEME EKRANINA DÖN';
    nextRoundBtn.onclick = () => {
      gameState.isSandboxTest = false;
      gameState.p2Guesses = [];
      gameState.p2Comments = [];
      showWaitingShareScreenForExistingRoom();
    };
  }

  document.getElementById('result-verdict-title').textContent = `Test Simülasyonu Tamamlandı (%${percentage})`;
  document.getElementById('result-verdict-desc').textContent =
    'Bu test yalnızca kendi cihazında sorularının ve sohbet balonlarının nasıl göründüğünü denemen için yapıldı. Gerçek düello odası (# ' +
    (gameState.roomCode || '') +
    ') etkilenmedi ve arkadaşını beklemeye devam ediyor.';

  const circleEl = document.getElementById('score-circle-progress');
  const percentTextEl = document.getElementById('score-percentage-text');
  const targetOffset = CIRCLE_CIRCUMFERENCE - (percentage / 100) * CIRCLE_CIRCUMFERENCE;
  circleEl.style.strokeDashoffset = `${targetOffset}`;
  percentTextEl.textContent = `%${percentage}`;

  renderBreakdownList();
}

function startHalftimeCounterAttack() {
  if (gameState.isSandboxTest) return;
  gameState.half = 2;
  gameState.phase = 'p2_answer';
  gameState.p2Half2Questions = pickQuestionsForCategory(gameState.category, TOTAL_QUESTIONS);
  gameState.p2Half2Answers = [];
  gameState.p2Half2Comments = [];
  gameState.p2Half2CustomMap = {};
  gameState.shufflesLeft = 2;
  gameState.passUsedThisTurn = false;
  gameState.customAnswerUsedThisTurn = false;
  gameState.currentQuestionIndex = 0;
  gameState.progressDots = [];
  gameState.isLocked = false;

  updateDuelHeaderUI();
  showView('view-question');
  renderCurrentQuestion();
}

// ---------------- ARA EKRAN VE ULTRA KISA LİNK SİSTEMİ (?r=SNC84K) ----------------
async function showInterstitialScreen(stage) {
  showView('view-interstitial');

  const passBox = document.getElementById('interstitial-pass-box');
  const linkBox = document.getElementById('interstitial-link-box');

  if (gameState.mode === 'pass') {
    passBox.classList.remove('hidden');
    linkBox.classList.add('hidden');

    const passP2Box = document.getElementById('pass-p2-name-box');
    const descEl = document.getElementById('pass-description-text');
    const titleEl = document.getElementById('pass-stage-title');

    if (stage === 'after_p1_answer') {
      titleEl.textContent = "Cihazı 2. Oyuncuya (Arkadaşına) Devret! 🤝";
      descEl.innerHTML = `<strong class="text-primary-theme">${escapeHtml(gameState.player1Name)}</strong> 5 soruyu cevapladı. Şimdi cihazı arkadaşına ver, bakalım ne kadar tahmin edebilecek!`;
      passP2Box.classList.remove('hidden');
      document.getElementById('input-pass-p2-name').value = gameState.player2Name || '';
    } else {
      titleEl.textContent = `Şimdi Cihazı Tekrar ${gameState.player1Name}'e Ver! 🔄`;
      descEl.innerHTML = `<strong class="text-primary-theme">${escapeHtml(gameState.player2Name)}</strong> kendi 5 sorusunu cevapladı! Şimdi tahmin sırası <strong>${escapeHtml(gameState.player1Name)}</strong>'de!`;
      passP2Box.classList.add('hidden');
    }
    return;
  }

  passBox.classList.add('hidden');
  linkBox.classList.remove('hidden');

  if (!gameState.roomCode) {
    gameState.roomCode = generateRoomCode();
  }

  const nextStatus = stage === 'after_p1_answer' ? 'waiting_p2' : 'waiting_p1_half2';
  const roomRecord = {
    code: gameState.roomCode,
    p1Id: userProfile.id || '',
    p1FriendCode: userProfile.friendCode || '',
    p2FriendCode: gameState.player2FriendCode || '',
    roomType: gameState.mode === 'arena' ? 'live_arena' : 'classic',
    arenaFormat: gameState.arenaFormat,
    status: nextStatus,
    currentRound: gameState.currentRound,
    whoseTurn: stage === 'after_p1_answer' ? 'p2' : 'p1',
    p1: gameState.player1Name,
    p2: gameState.player2Name || '',
    cat: gameState.category,
    thm: gameState.theme,
    qIds: gameState.selectedQuestions.map((q) => q.id),
    usedQuestionIds: gameState.usedQuestionIds,
    customOptionsMap: gameState.customOptionsMap,
    p1Answers: gameState.p1Answers,
    p1Comments: gameState.p1Comments,
    p2Guesses: gameState.p2Guesses,
    p2Comments: gameState.p2Comments,
    p2Half2QIds: gameState.p2Half2Questions.map((q) => q.id),
    p2Half2CustomMap: gameState.p2Half2CustomMap,
    p2Half2Answers: gameState.p2Half2Answers,
    p2Half2Comments: gameState.p2Half2Comments,
    p1Half2Guesses: gameState.p1Half2Guesses,
    p1Half2Comments: gameState.p1Half2Comments
  };

  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const shortUrl = `${baseUrl}?r=${gameState.roomCode}`;
  gameState.generatedChallengeUrl = shortUrl;

  document.getElementById('generated-challenge-url').value = shortUrl;
  document.getElementById('copy-toast').classList.add('hidden');

  const headingEl = document.getElementById('link-share-heading');
  const subEl = document.getElementById('link-share-subtext');
  if (stage === 'after_p2_answer') {
    headingEl.textContent = `Karşı Saldırı Hazır! Kısa Linki ${gameState.player1Name}'e Gönder 🔥`;
    subEl.innerHTML = `Sen onun sorularını tahmin ettin ve kendi 5 sorunu hazırladın. Şimdi aynı kısa linkten sıra <strong>${escapeHtml(gameState.player1Name)}</strong>'de!`;
  } else {
    headingEl.textContent = "Kısa Davet Linkin Hazır! Arkadaşına Gönder 🚀";
    subEl.innerHTML = `Cevapların bulut veritabanına kaydedildi (Oda: <strong>#${gameState.roomCode}</strong> • Arkadaş Kodun: <strong>${userProfile.friendCode}</strong>). Kısa linki gönder veya arkadaşın doğrudan senin arkadaş kodunla katılsın!`;
  }

  // STATE_ISSUE #3 Çözümü: Bulut kayıt sonucunu doğrula ve kullanıcıya net durum göster
  const statusPill = document.getElementById('cloud-save-status-pill');
  if (statusPill) statusPill.textContent = "⚡ Veritabanına Kaydediliyor...";
  const saveRes = await saveRoomToDatabase(roomRecord);
  if (statusPill) {
    statusPill.textContent = saveRes.ok
      ? `✅ Bulut Veritabanına Kaydedildi (#${gameState.roomCode})`
      : `⚠️ Yerel Olarak Kaydedildi (#${gameState.roomCode})`;
  }

  startPollingForPartnerCompletion(gameState.roomCode);
}

// Kurucu (P1) kendi bekleyen odasına "Link & Oda Durumu" ile tıkladığında açılan ekran (Asla "Senin Adın Nedir?" sormaz!)
function showWaitingShareScreenForExistingRoom() {
  showView('view-interstitial');
  const passBox = document.getElementById('interstitial-pass-box');
  const linkBox = document.getElementById('interstitial-link-box');
  if (passBox) passBox.classList.add('hidden');
  if (linkBox) linkBox.classList.remove('hidden');

  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const shortUrl = `${baseUrl}?r=${gameState.roomCode}`;
  gameState.generatedChallengeUrl = shortUrl;

  const urlInp = document.getElementById('generated-challenge-url');
  if (urlInp) urlInp.value = shortUrl;

  const statusPill = document.getElementById('cloud-save-status-pill');
  if (statusPill) statusPill.textContent = `⏳ Rakip Bekleniyor • Oda #${gameState.roomCode}`;

  const oppDisplay = gameState.player2Name || gameState.player2FriendCode || 'Arkadaşın';
  const headingEl = document.getElementById('link-share-heading');
  const subEl = document.getElementById('link-share-subtext');
  if (headingEl) {
    headingEl.textContent = `Senin 5 Yanıtın Kilitlendi! Sıra ${oppDisplay}'de ⏳`;
  }
  if (subEl) {
    subEl.innerHTML = `Bu düelloyu sen başlattın. <strong>${escapeHtml(oppDisplay)}</strong> aşağıdaki kısa linkten, <strong>#${escapeHtml(gameState.roomCode)}</strong> oda kodundan veya kendi <em>Aktif Oyunlar / Bildirimler</em> ekranından sorularını tahmin ettiğinde sıra tekrar sana geçecek!`;
  }

  startPollingForPartnerCompletion(gameState.roomCode);
}

function continueFromPassInterstitial() {
  if (gameState.phase === 'p1_answer') {
    const passInput = document.getElementById('input-pass-p2-name');
    const errEl = document.getElementById('pass-name-error');
    const p2Name = passInput ? passInput.value.trim() : '';
    if (!p2Name) {
      errEl.classList.remove('hidden');
      if (passInput) passInput.focus();
      return;
    }
    errEl.classList.add('hidden');
    gameState.player2Name = p2Name;
    gameState.half = 1;
    gameState.phase = 'p2_guess';
    gameState.currentQuestionIndex = 0;
    gameState.progressDots = [];
    updateDuelHeaderUI();
    showView('view-question');
    renderCurrentQuestion();
  } else {
    gameState.half = 2;
    gameState.phase = 'p1_guess';
    gameState.currentQuestionIndex = 0;
    gameState.progressDots = [];
    updateDuelHeaderUI();
    showView('view-question');
    renderCurrentQuestion();
  }
}

// ---------------- PAYLAŞIM VE KISA LİNK KOPYALAMA ----------------
function copyChallengeLink() {
  const url = gameState.generatedChallengeUrl;
  if (!url) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => showCopyToast());
  }
}

function showCopyToast() {
  const toast = document.getElementById('copy-toast');
  if (!toast) return;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

function copyShortRoomInviteLink() {
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const shortUrl = `${baseUrl}?r=${gameState.roomCode}`;
  gameState.generatedChallengeUrl = shortUrl;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shortUrl).then(() => {
      const t = document.getElementById('live-lobby-copy-toast');
      if (t) {
        t.classList.remove('hidden');
        setTimeout(() => t.classList.add('hidden'), 3000);
      }
    });
  }
}

function shareShortRoomViaWhatsApp() {
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const shortUrl = `${baseUrl}?r=${gameState.roomCode}`;
  const text = `🏟️ Canlı senceo odası kurdum! (${gameState.arenaFormat.toUpperCase()} Modu • Oda Kodu: ${gameState.roomCode}) Hemen katıl: ${shortUrl}`;
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}

function shareViaWhatsApp() {
  const url = gameState.generatedChallengeUrl;
  const text = `🔥 senceo'da 5 soruyu cevapladım! Bakalım beni ne kadar tanıyorsun? Tıkla ve tahmin et: ${url}`;
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}

// "Şimdi Karşı Oyuncu Gözüyle Bu Cihazda Test Et" -> Gerçek Düelloyu ASLA Bozmaz (isSandboxTest = true)!
function openChallengeLinkDirectly() {
  stopPollingForPartnerCompletion();
  gameState.isSandboxTest = true;
  gameState.half = 1;
  gameState.phase = 'p2_guess';
  gameState.p2Guesses = [];
  gameState.p2Comments = [];
  gameState.currentQuestionIndex = 0;
  gameState.progressDots = [];
  gameState.isLocked = false;

  updateDuelHeaderUI();
  showView('view-question');
  renderCurrentQuestion();
}

// ---------------- ODA KODU VEYA ARKADAŞ KODU İLE ODAYI YÜKLEME ----------------
async function joinRoomByCode() {
  const codeInput = document.getElementById('input-join-room-code');
  const errEl = document.getElementById('join-room-error');
  const btn = document.getElementById('btn-fetch-cloud-room');

  const code = codeInput ? codeInput.value.trim().toUpperCase() : '';
  if (!code || code.length < 3) {
    errEl.textContent = "⚠️ Lütfen geçerli bir Oda Kodu veya Arkadaş Kodu girin!";
    errEl.classList.remove('hidden');
    return;
  }

  errEl.classList.add('hidden');
  if (btn) btn.textContent = "ARANIYOR...";

  if (/^SNC-\d{4}$/.test(code)) {
    const lookup = await fetchActiveRoomByFriendCode(code);
    if (btn) btn.innerHTML = '<span>ODAYI BUL VE BAĞLAN</span><span class="material-symbols-outlined text-[18px]">bolt</span>';
    if (lookup && lookup.room) {
      toggleCloudJoinModal(false);
      loadRoomIntoGameState(lookup.room, false);
      return;
    } else {
      errEl.textContent = `❌ "${code}" arkadaş koduna ait bekleyen aktif bir düello bulunamadı!`;
      errEl.classList.remove('hidden');
      return;
    }
  }

  const room = await fetchRoomFromDatabase(code);
  if (btn) btn.innerHTML = '<span>ODAYI BUL VE BAĞLAN</span><span class="material-symbols-outlined text-[18px]">bolt</span>';

  if (!room) {
    errEl.textContent = `❌ "${code}" kodlu oda bulunamadı!`;
    errEl.classList.remove('hidden');
    return;
  }

  toggleCloudJoinModal(false);
  loadRoomIntoGameState(room, false);
}

function startLiveTurnWaitPolling(roomCode) {
  stopLiveTurnWaitPolling();
  if (!roomCode) return;

  gameState.liveTurnPollingId = setInterval(async () => {
    const room = await fetchRoomFromDatabase(roomCode);
    if (!room) return;

    if (room.status === 'completed') {
      stopLiveTurnWaitPolling();
      openOpponentTurnReadyModal(room);
      return;
    }

    if (room.status === 'live_in_progress' && room.liveMatchState) {
      const ms = room.liveMatchState;
      const myCode = (userProfile.friendCode || '').toUpperCase();
      const activeCode = (ms.activeTurnCode || '').toUpperCase();
      const isMyTurnNow =
        (ms.phase === 'ebe_answering' && activeCode === myCode) ||
        (ms.phase === 'others_guessing' && activeCode !== myCode);

      if (isMyTurnNow) {
        stopLiveTurnWaitPolling();
        loadRoomIntoGameState(room, false);
      }
    }
  }, 2500);
}

function stopLiveTurnWaitPolling() {
  if (gameState.liveTurnPollingId) {
    clearInterval(gameState.liveTurnPollingId);
    gameState.liveTurnPollingId = null;
  }
}

function showLiveTurnWaitScreen(activePlayerName, customSubtitle = '', roundNum = 1, stepNum = 1) {
  const titleEl = document.getElementById('live-wait-heading');
  const subEl = document.getElementById('live-wait-subtext');
  const badgeEl = document.getElementById('live-wait-badge');

  if (titleEl) {
    titleEl.innerHTML = `Sıra <span class="text-amber-500 font-black">${escapeHtml(activePlayerName || 'Rakip')}</span> Oyuncusunda!`;
  }
  if (subEl) {
    subEl.innerHTML =
      customSubtitle ||
      `Lütfen <strong>${escapeHtml(activePlayerName || 'Rakip')}</strong> soruları çözene kadar sıranı bekle. Tamamlandığında ekranın otomatik güncellenecek (4 sn'de bir kontrol ediliyor).`;
  }
  if (badgeEl) {
    badgeEl.textContent = `⏳ Raund: ${roundNum} • Soru Adımı: ${stepNum}/${TOTAL_QUESTIONS}`;
  }

  showView('view-live-turn-wait');
}

function loadRoomIntoGameState(room, forceResultView = false) {
  gameState.isSandboxTest = false;
  gameState.roomCode = room.code || '';
  gameState.mode = room.roomType === 'live_arena' ? 'arena' : 'link';
  gameState.arenaFormat = room.arenaFormat || '1v1';
  gameState.currentRound = room.currentRound || 1;
  gameState.category = room.cat || 'genel';
  gameState.player1Name = room.p1 || 'Oyuncu 1';
  gameState.player2Name = room.p2 || '';
  gameState.player2FriendCode = room.p2FriendCode || '';
  gameState.usedQuestionIds = room.usedQuestionIds || [];
  gameState.customOptionsMap = room.customOptionsMap || {};
  gameState.p1Answers = room.p1Answers || room.ans || [];
  gameState.p1Comments = room.p1Comments || room.c1 || [];
  gameState.p2Guesses = room.p2Guesses || [];
  gameState.p2Comments = room.p2Comments || [];
  gameState.p2Half2CustomMap = room.p2Half2CustomMap || {};
  gameState.p2Half2Answers = room.p2Half2Answers || [];
  gameState.p2Half2Comments = room.p2Half2Comments || [];
  gameState.p1Half2Guesses = room.p1Half2Guesses || [];
  gameState.p1Half2Comments = room.p1Half2Comments || [];
  gameState.liveMatchState = room.liveMatchState || null;
  if (room.liveSettings) {
    gameState.liveSettings = { ...gameState.liveSettings, ...room.liveSettings };
  }

  const q1List = (room.qIds || []).map((id) => QUESTIONS_DB.find((q) => q.id === id)).filter(Boolean);
  gameState.selectedQuestions = q1List.length > 0 ? q1List : pickQuestionsForCategory(gameState.category, TOTAL_QUESTIONS);

  const q2List = (room.p2Half2QIds || []).map((id) => QUESTIONS_DB.find((q) => q.id === id)).filter(Boolean);
  gameState.p2Half2Questions = q2List;

  const isP1 = isUserPlayer1OfRoom(room);

  // Canlı Oda Lobisi henüz başlamamışsa:
  if (room.status === 'lobby_open' && (!room.qIds || room.qIds.length === 0)) {
    document.getElementById('live-lobby-room-code').textContent = gameState.roomCode;
    renderLiveLobbyState(room);
    if (!isCurrentUserHostOfLiveRoom(room)) {
      const myJoinName =
        userProfile.username && userProfile.username !== 'Misafir Oyuncu'
          ? userProfile.username
          : `Oyuncu (${userProfile.friendCode})`;
      fetch('/api/rooms', {
        method: 'POST',
        headers: getSupabaseHeaders(),
        body: JSON.stringify({
          action: 'join_live_lobby',
          code: gameState.roomCode,
          playerName: myJoinName,
          friendCode: userProfile.friendCode
        })
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d && d.room) renderLiveLobbyState(d.room);
        })
        .catch(() => {});
    }
    showView('view-live-room-lobby');
    startLiveLobbyParticipantPolling(gameState.roomCode);
    return true;
  }

  // Oyun tamamlandıysa sonuç ekranını aç
  if (forceResultView || room.status === 'completed') {
    showResultScreen(false);
    return true;
  }

  // Canlı Oda Eşzamanlı Maç Devam Ediyorsa (live_in_progress):
  if (room.status === 'live_in_progress' && room.liveMatchState) {
    const ms = room.liveMatchState;
    const myCode = (userProfile.friendCode || '').toUpperCase();
    const activeCode = (ms.activeTurnCode || '').toUpperCase();
    gameState.player1Name = ms.activeTurnName || room.p1 || 'Ebe Oyuncu';

    if (ms.phase === 'ebe_answering') {
      if (activeCode === myCode) {
        gameState.half = 1;
        gameState.phase = 'p1_answer';
        gameState.currentQuestionIndex = Number(ms.stepStartIndex) || 0;
        updateDuelHeaderUI();
        showView('view-question');
        renderCurrentQuestion();
        return true;
      } else {
        showLiveTurnWaitScreen(
          ms.activeTurnName || 'Ebe Oyuncu',
          `Lütfen <strong>${escapeHtml(ms.activeTurnName || 'Ebe Oyuncu')}</strong> kendi sırasındaki soruları çözene kadar sıranı bekle.`,
          gameState.currentRound,
          (Number(ms.stepStartIndex) || 0) + 1
        );
        startLiveTurnWaitPolling(gameState.roomCode);
        return true;
      }
    } else if (ms.phase === 'others_guessing') {
      if (activeCode !== myCode) {
        gameState.half = 1;
        gameState.phase = 'p2_guess';
        gameState.player2Name = userProfile.username || 'Tahminci';
        gameState.currentQuestionIndex = Number(ms.stepStartIndex) || 0;
        updateDuelHeaderUI();
        showView('view-question');
        renderCurrentQuestion();
        return true;
      } else {
        showLiveTurnWaitScreen(
          'Diğer Oyuncular',
          `Sen soruları cevapladın! Şimdi odadaki diğer oyuncular senin cevaplarını tahmin ediyor, lütfen bekle...`,
          gameState.currentRound,
          (Number(ms.stepStartIndex) || 0) + 1
        );
        startLiveTurnWaitPolling(gameState.roomCode);
        return true;
      }
    }
  }

  // 2. Yarıda sıra P1'de ise:
  if (room.status === 'waiting_p1_half2') {
    if (isP1) {
      gameState.half = 2;
      gameState.phase = 'p1_guess';
      gameState.currentQuestionIndex = 0;
      gameState.progressDots = [];
      updateDuelHeaderUI();
      showView('view-question');
      renderCurrentQuestion();
      return true;
    } else {
      showWaitingShareScreenForExistingRoom();
      return true;
    }
  }

  // room.status === 'waiting_p2' iken odayı açan kişi P1'in KENDİSİ ise:
  if (isP1) {
    showWaitingShareScreenForExistingRoom();
    return true;
  }

  // Odayı açan kişi 2. Oyuncu (Rakip) ise:
  gameState.half = 1;
  gameState.phase = 'p2_guess';
  gameState.currentQuestionIndex = 0;
  gameState.progressDots = [];

  // KULLANICI İSTEĞİ: İsim 1 kere girildiyse bir daha ASLA "Senin Adın Nedir?" ekranı sorma, doğrudan 1. Soruya sok!
  const savedUserName =
    userProfile.username && userProfile.username.trim() && userProfile.username !== 'Misafir Oyuncu'
      ? userProfile.username.trim()
      : '';

  if (savedUserName) {
    gameState.player2Name = savedUserName;
    gameState.player2FriendCode = userProfile.friendCode || gameState.player2FriendCode;
    updateDuelHeaderUI();
    showView('view-question');
    renderCurrentQuestion();
    return true;
  }

  // Sadece daha önce hiç isim girmemiş sıfır bir kullanıcıysa 1 defaya mahsus adını sor:
  const titleEl = document.getElementById('challenge-welcome-title');
  titleEl.innerHTML = `<span class="text-primary-theme">${escapeHtml(gameState.player1Name)}</span> sana meydan okudu! Bakalım onu ne kadar tanıyorsun?`;
  const nameInput = document.getElementById('input-challenger-p2-name');
  if (nameInput) {
    const candidateName =
      gameState.player2Name && !/^SNC-\d{4}$/i.test(gameState.player2Name) && gameState.player2Name !== 'Arkadaşın'
        ? gameState.player2Name
        : '';
    nameInput.value = candidateName;
  }

  updateDuelHeaderUI();
  showView('view-challenge-welcome');
  return true;
}

async function checkIncomingUrlChallenge() {
  const params = new URLSearchParams(window.location.search);
  const shortRoomParam = params.get('r') || params.get('room');
  const viewParam = params.get('view');

  if (shortRoomParam) {
    const cloudRoom = await fetchRoomFromDatabase(shortRoomParam);
    if (cloudRoom) {
      return loadRoomIntoGameState(cloudRoom, viewParam === 'result');
    }
  }
  return false;
}

function acceptUrlChallenge() {
  const nameInput = document.getElementById('input-challenger-p2-name');
  const errEl = document.getElementById('challenge-name-error');
  const p2Name = nameInput ? nameInput.value.trim() : '';

  if (!p2Name) {
    errEl.classList.remove('hidden');
    if (nameInput) nameInput.focus();
    return;
  }

  errEl.classList.add('hidden');
  gameState.player2Name = p2Name;
  gameState.player2FriendCode = userProfile.friendCode || gameState.player2FriendCode;
  userProfile.username = p2Name;
  saveUserProfile();

  const p1Input = document.getElementById('input-p1-name');
  if (p1Input) p1Input.value = p2Name;

  gameState.half = 1;
  gameState.phase = 'p2_guess';
  gameState.currentQuestionIndex = 0;
  gameState.progressDots = [];

  updateDuelHeaderUI();
  showView('view-question');
  renderCurrentQuestion();
}

// ---------------- SONUÇ HESAPLAMA, senceo SEVİYESİ / BAĞ LEVELİ VE 2. RAUND SIRA KİLİDİ ----------------
function isQuestionMatch(ans, guess) {
  if (ans === PASS_ANSWER_VALUE) return true;
  return ans === guess;
}

async function finalizeGameAndShowResults() {
  if (gameState.isSandboxTest) {
    showSandboxSimulationResult();
    return;
  }

  const { correctCount, totalCount, percentage } = calculateOverallRoundScore();

  if (!gameState.roomCode) {
    gameState.roomCode = generateRoomCode();
  }

  // KULLANICI İSTEĞİ: 1. Raundda 2. başlayan oyuncu (p2), 2. Raundda ZORUNLU OLARAK 1. başlar!
  const completedRoom = {
    code: gameState.roomCode,
    p1Id: userProfile.id || '',
    p1FriendCode: gameState.player2FriendCode && !isUserPlayer1OfRoom({ p1FriendCode: userProfile.friendCode }) ? '' : (userProfile.friendCode || ''),
    p2FriendCode: gameState.player2FriendCode || '',
    nextRoundStarterCode: gameState.player2FriendCode || '',
    nextRoundStarterName: gameState.player2Name || '2. Oyuncu',
    roomType: gameState.mode === 'arena' ? 'live_arena' : 'classic',
    arenaFormat: gameState.arenaFormat,
    status: 'completed',
    currentRound: gameState.currentRound,
    p1: gameState.player1Name,
    p2: gameState.player2Name || '2. Oyuncu',
    cat: gameState.category,
    thm: gameState.theme,
    qIds: gameState.selectedQuestions.map((q) => q.id),
    usedQuestionIds: gameState.usedQuestionIds,
    customOptionsMap: gameState.customOptionsMap,
    p1Answers: gameState.p1Answers,
    p1Comments: gameState.p1Comments,
    p2Guesses: gameState.p2Guesses,
    p2Comments: gameState.p2Comments,
    p2Half2QIds: gameState.p2Half2Questions.map((q) => q.id),
    p2Half2CustomMap: gameState.p2Half2CustomMap,
    p2Half2Answers: gameState.p2Half2Answers,
    p2Half2Comments: gameState.p2Half2Comments,
    p1Half2Guesses: gameState.p1Half2Guesses,
    p1Half2Comments: gameState.p1Half2Comments,
    lastMatchPercentage: percentage,
    lastCorrectCount: correctCount,
    lastTotalQuestions: totalCount,
    completedAt: new Date().toISOString()
  };

  await saveRoomToDatabase(completedRoom);
  showResultScreen(true);
}

function calculateOverallRoundScore() {
  let correctCount = 0;
  let totalCount = gameState.selectedQuestions.length;

  gameState.selectedQuestions.forEach((q, idx) => {
    if (isQuestionMatch(gameState.p1Answers[idx], gameState.p2Guesses[idx])) {
      correctCount++;
    }
  });

  if (gameState.p2Half2Questions.length > 0 && gameState.p1Half2Guesses.length > 0) {
    totalCount += gameState.p2Half2Questions.length;
    gameState.p2Half2Questions.forEach((q, idx) => {
      if (isQuestionMatch(gameState.p2Half2Answers[idx], gameState.p1Half2Guesses[idx])) {
        correctCount++;
      }
    });
  }

  const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  return { correctCount, totalCount, percentage };
}

function showResultScreen(awardXpNow = false) {
  showView('view-result');

  const { correctCount, totalCount, percentage } = calculateOverallRoundScore();

  document.getElementById('result-round-pill').textContent = `⚡ ${gameState.currentRound}. Raund Uyum & Diyalog Raporu`;
  document.getElementById('result-p1-name').textContent = gameState.player1Name || 'Oyuncu 1';
  document.getElementById('result-p2-name').textContent = gameState.player2Name || 'Oyuncu 2';
  document.getElementById('result-correct-ratio').textContent = `${correctCount} / ${totalCount} Doğru`;

  const nextRoundStarter = gameState.player2Name || '2. Oyuncu';
  const nextRoundBtn = document.getElementById('btn-next-round-action');
  const nextRoundLabel = document.getElementById('btn-next-round-label');
  if (nextRoundLabel) {
    nextRoundLabel.textContent = `${gameState.currentRound + 1}. RAUNDA GEÇ (İLK SIRA: ${nextRoundStarter.toUpperCase()})`;
  }
  if (nextRoundBtn) {
    nextRoundBtn.onclick = startNextRoundInSameRoom;
  }

  // Canlı Lobi Skor Tablosu (Eğer çok oyunculu veya canlı maçsa tüm oyuncuların puanını ve 1.yi göster!)
  const lobbyBoard = document.getElementById('result-live-lobby-scoreboard');
  const lobbyScoresList = document.getElementById('result-live-lobby-scores-list');
  if (lobbyBoard && lobbyScoresList) {
    const scoresObj = gameState.liveMatchState && gameState.liveMatchState.scores;
    if (scoresObj && Object.keys(scoresObj).length > 0) {
      lobbyBoard.classList.remove('hidden');
      const sorted = Object.keys(scoresObj)
        .map((code) => ({ code, ...scoresObj[code] }))
        .sort((a, b) => (b.points || 0) - (a.points || 0));

      lobbyScoresList.innerHTML = sorted
        .map(
          (s, idx) => `
          <div class="p-2.5 rounded-xl stitch-card flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-full ${
                idx === 0 ? 'bg-amber-400 text-slate-950 font-black' : 'stitch-subcard font-bold'
              } flex items-center justify-center text-[11px]">
                ${idx === 0 ? '👑' : `#${idx + 1}`}
              </span>
              <span class="font-bold">${escapeHtml(s.name || s.code)}</span>
              ${idx === 0 ? '<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-500 text-[10px] font-extrabold">🏆 ODA BİRİNCİSİ</span>' : ''}
            </div>
            <span class="font-mono-theme font-extrabold text-primary-theme">${s.points || 0} Puan (${s.correct || 0} Doğru)</span>
          </div>
        `
        )
        .join('');
    } else {
      lobbyBoard.classList.add('hidden');
    }
  }

  if (awardXpNow && !gameState.isSandboxTest) {
    const partner = gameState.player2Name || 'Arkadaşın';
    const gain = addPersonalAndBondXP(partner, correctCount, percentage, gameState.roomCode);
    document.getElementById('result-personal-xp-pill').textContent = `⭐ senceo Seviyen: LVL ${gain.personalLevel} (+${gain.gainedXp} XP)`;
    document.getElementById('result-bond-xp-pill').textContent = `🤝 ${partner} ile Bağ: LVL ${gain.bondLevel}`;
  }

  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const directResultUrl = `${baseUrl}?r=${gameState.roomCode || 'SNC'}&view=result`;
  const directUrlTextEl = document.getElementById('result-direct-url-text');
  if (directUrlTextEl) directUrlTextEl.textContent = directResultUrl;

  if (gameState.roomCode && !gameState.isSandboxTest) {
    window.history.replaceState({}, document.title, `?r=${gameState.roomCode}&view=result`);
  }

  const bucket = Math.round(percentage / 20) * 20;
  const verdict = SCORE_VERDICTS[bucket] || SCORE_VERDICTS[60];
  document.getElementById('result-verdict-title').textContent = verdict.title;
  document.getElementById('result-verdict-desc').textContent = verdict.desc;

  const circleEl = document.getElementById('score-circle-progress');
  const percentTextEl = document.getElementById('score-percentage-text');
  circleEl.style.strokeDashoffset = `${CIRCLE_CIRCUMFERENCE}`;
  percentTextEl.textContent = `%0`;

  setTimeout(() => {
    const targetOffset = CIRCLE_CIRCUMFERENCE - (percentage / 100) * CIRCLE_CIRCUMFERENCE;
    circleEl.style.strokeDashoffset = `${targetOffset}`;
    animateCounterValue(percentTextEl, 0, percentage, 1000);
  }, 120);

  if (percentage >= 60 && typeof confetti === 'function') {
    setTimeout(() => triggerCelebrationConfetti(percentage === 100), 300);
  }

  renderBreakdownList();
}

// KULLANICI İSTEĞİ: 1. Raundda kim 2. başladıysa, 2. Raundda O KİŞİ 1. başlar!
// İki oyuncunun aynı anda 2. raundu başlatıp birbirini ezmesi engellenir!
async function startNextRoundInSameRoom() {
  const nextRoundNum = (gameState.currentRound || 1) + 1;
  let latestRoom = null;
  if (gameState.roomCode) {
    latestRoom = await fetchRoomFromDatabase(gameState.roomCode);
  }

  // Eğer diğer oyuncu çoktan yeni raundun sorularını hazırlayıp kaydettiyse doğrudan onun sorularını tahmin etmeye gir!
  if (latestRoom && latestRoom.status === 'waiting_p2' && (latestRoom.currentRound || 1) >= nextRoundNum) {
    loadRoomIntoGameState(latestRoom, false);
    return;
  }

  const myCode = (userProfile.friendCode || '').toUpperCase();
  const prevP1Code = ((latestRoom && latestRoom.p1FriendCode) || '').toUpperCase();
  const prevP2Code = ((latestRoom && latestRoom.p2FriendCode) || gameState.player2FriendCode || '').toUpperCase();
  const myNameLower = (userProfile.username || '').trim().toLowerCase();
  const prevP1NameLower = (gameState.player1Name || '').trim().toLowerCase();
  const prevP2Name = (latestRoom && latestRoom.p2) || gameState.player2Name || '2. Oyuncu';

  // Bu kullanıcı biten raundda 1. Oyuncu (p1) muydu?
  const wasIPlayer1InFinishedRound =
    (prevP1Code && myCode && prevP1Code === myCode && prevP2Code !== myCode) ||
    (!prevP1Code && myNameLower && myNameLower === prevP1NameLower);

  if (wasIPlayer1InFinishedRound && gameState.mode !== 'pass') {
    // 1. Raundda 1. başlayan kişi, 2. Raundda 2. başlamak zorundadır! Kum saati bekleme ekranına al ve 4 sn'de bir kontrol et:
    showLiveTurnWaitScreen(
      prevP2Name,
      `1. Raundda ilk sen başlamıştın! Kural gereği <strong>${nextRoundNum}. Raundda</strong> ilk söz hakkı <strong>${escapeHtml(prevP2Name)}</strong> oyuncusunda. O 5 soruyu çözdüğünde sana bildirim gelecek (4 sn'de bir kontrol ediliyor).`,
      nextRoundNum,
      1
    );
    startPollingForPartnerCompletion(gameState.roomCode);
    return;
  }

  // Bu kullanıcı biten raundda 2. Oyuncu (p2) ise -> Yeni raundun 1. Oyuncusu (Kurucusu) olur ve hemen 5 soruyu çözer!
  const oldP1Name = gameState.player1Name;
  const oldP1Code = (latestRoom && latestRoom.p1FriendCode) || '';
  const myCurrentName = userProfile.username || gameState.player2Name || 'Oyuncu 1';

  gameState.currentRound = nextRoundNum;
  gameState.player1Name = myCurrentName;
  gameState.player2Name = oldP1Name;
  gameState.player2FriendCode = oldP1Code;

  startClassicFirstHalf();
}

function animateCounterValue(element, start, end, duration) {
  if (start === end) {
    element.textContent = `%${end}`;
    return;
  }
  const startTime = performance.now();
  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    element.textContent = `%${Math.round(start + (end - start) * progress)}`;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function renderBreakdownList() {
  const container = document.getElementById('result-breakdown-list');
  container.innerHTML = '';

  const p1Name = gameState.player1Name || '1. Oyuncu';
  const p2Name = gameState.isSandboxTest ? 'Test Simülasyonu' : (gameState.player2Name || '2. Oyuncu');

  appendHalfBreakdownCards(
    container,
    `1. Yarı: ${p1Name} Cevapladı ⚡ ${p2Name} Tahmin Etti`,
    gameState.selectedQuestions,
    gameState.p1Answers,
    gameState.p2Guesses,
    gameState.p1Comments,
    gameState.p2Comments,
    gameState.customOptionsMap,
    p1Name,
    p2Name
  );

  if (!gameState.isSandboxTest && gameState.p2Half2Questions.length > 0 && gameState.p1Half2Guesses.length > 0) {
    appendHalfBreakdownCards(
      container,
      `2. Yarı (Karşı Saldırı): ${p2Name} Cevapladı ⚡ ${p1Name} Tahmin Etti`,
      gameState.p2Half2Questions,
      gameState.p2Half2Answers,
      gameState.p1Half2Guesses,
      gameState.p2Half2Comments,
      gameState.p1Half2Comments,
      gameState.p2Half2CustomMap,
      p2Name,
      p1Name
    );
  }
}

function appendHalfBreakdownCards(container, headerTitle, questions, answers, guesses, ansComments, guessComments, customMap, answererName, guesserName) {
  const header = document.createElement('div');
  header.className = "text-xs font-extrabold uppercase tracking-wider text-primary-theme pt-2 pb-1 border-b border-[var(--outline-variant)]";
  header.textContent = headerTitle;
  container.appendChild(header);

  questions.forEach((q, idx) => {
    const ansIdx = answers[idx];
    const guessIdx = guesses[idx];
    const isCorrect = isQuestionMatch(ansIdx, guessIdx);

    const customText = customMap && customMap[idx];
    const getOptDisplay = (choiceIdx) => {
      if (choiceIdx === PASS_ANSWER_VALUE) return { icon: '⏭️', text: 'Pas Geçti' };
      if (customText && (choiceIdx === 3 || choiceIdx === q.options.length)) {
        return { icon: '✏️', text: customText };
      }
      return q.options[choiceIdx] || { icon: '❓', text: '-' };
    };

    const ansOpt = getOptDisplay(ansIdx);
    const guessOpt = getOptDisplay(guessIdx);

    const c1 = (ansComments && ansComments[idx]) || { emoji: '', text: '' };
    const c2 = (guessComments && guessComments[idx]) || { emoji: '', text: '' };

    const c1Html = (c1.emoji || c1.text)
      ? `<div class="mt-1 text-xs stitch-subcard px-2.5 py-1 border-l-2 border-[var(--primary)]">
           <span class="font-bold text-primary-theme">💬 ${escapeHtml(answererName)}:</span> ${c1.emoji || ''} ${escapeHtml(c1.text || '')}
         </div>`
      : '';

    const c2Html = (c2.emoji || c2.text)
      ? `<div class="mt-1 text-xs stitch-subcard px-2.5 py-1 border-l-2 border-rose-500">
           <span class="font-bold text-rose-500">💬 ${escapeHtml(guesserName)}:</span> ${c2.emoji || ''} ${escapeHtml(c2.text || '')}
         </div>`
      : '';

    const card = document.createElement('div');
    card.className = isCorrect
      ? "rounded-xl p-3.5 bg-emerald-500/10 border border-emerald-500/40 space-y-1.5"
      : "rounded-xl p-3.5 bg-red-500/10 border border-red-500/40 space-y-1.5";

    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <span class="text-xs font-bold leading-snug">
          ${idx + 1}. ${escapeHtml(q.q1)}
        </span>
        <span class="shrink-0 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
          isCorrect ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }">
          ${isCorrect ? '✓ Doğru' : '✕ Yanlış'}
        </span>
      </div>

      <div class="grid grid-cols-1 gap-1.5 text-xs pt-1">
        <div class="stitch-card px-3 py-2">
          <span class="font-bold text-primary-theme">${escapeHtml(answererName)} (Cevap):</span>
          <span class="font-semibold ml-1">${ansOpt.icon} ${escapeHtml(ansOpt.text)}</span>
          ${c1Html}
        </div>
        <div class="stitch-card px-3 py-2">
          <span class="font-bold">${escapeHtml(guesserName)} (Tahmin):</span>
          <span class="font-semibold ml-1">${guessOpt.icon} ${escapeHtml(guessOpt.text)}</span>
          ${c2Html}
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function triggerCelebrationConfetti(isPerfect) {
  const themeConfetti = THEMES[gameState.theme]?.confettiColors || ['#4648d4', '#006c49'];
  try {
    confetti({
      particleCount: isPerfect ? 110 : 65,
      spread: 80,
      origin: { y: 0.6 },
      colors: themeConfetti
    });
  } catch (e) {}
}

function shareScoreResult() {
  const { correctCount, totalCount, percentage } = calculateOverallRoundScore();
  const p1 = gameState.player1Name || 'Oyuncu 1';
  const p2 = gameState.player2Name || 'Oyuncu 2';
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const directResultUrl = `${baseUrl}?r=${gameState.roomCode || 'SNC'}&view=result`;

  const shareText = `⚡ senceo Uyum Karnemiz: ${p1} & ${p2} — %${percentage} Uyum (${correctCount}/${totalCount})! Sonuç karnesini incele: ${directResultUrl}`;

  if (navigator.share) {
    navigator.share({
      title: 'senceo Uyum Karnesi',
      text: shareText,
      url: directResultUrl
    }).catch(() => {});
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(directResultUrl).then(() => {
      const toast = document.getElementById('result-share-toast');
      if (toast) {
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3500);
      }
    });
  }
}

function resetToHome() {
  stopPollingForPartnerCompletion();
  stopLiveLobbyParticipantPolling();
  stopLiveTurnWaitPolling();
  stopQuestionCountdownTimer();
  if (window.location.search) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  gameState.isSandboxTest = false;
  gameState.half = 1;
  gameState.phase = 'p1_answer';
  gameState.currentQuestionIndex = 0;
  gameState.progressDots = [];

  selectGameMode('link');
  selectCategory('genel');
  switchTopNavPage('setup');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------------- BAŞLANGIÇ (INIT) ----------------
window.addEventListener('DOMContentLoaded', async () => {
  initSavedTheme();
  loadUserProfile();
  checkIncomingFriendInvite();

  const fv = document.getElementById('footer-version-label');
  if (fv) fv.textContent = APP_VERSION;

  const p1Input = document.getElementById('input-p1-name');
  if (p1Input && userProfile.username && userProfile.username !== 'Misafir Oyuncu') {
    p1Input.value = userProfile.username;
    gameState.player1Name = userProfile.username;
  }

  selectGameMode('link');
  selectCategory('genel');
  updateNavActiveDuelsCount();
  startBackgroundCloudSync();

  const joinedChallenge = await checkIncomingUrlChallenge();
  if (!joinedChallenge) {
    switchTopNavPage('setup');
  }
});
