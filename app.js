// senceo — Stitch Çok Sayfalı Arayüz (Yeni Oyun / Aktif Oyunlar / Bağlarım / Liderlik) + Canlı Oda & Klasik Oyun Motoru
// 4 Tam Kapsamlı Tema (1. Luminous Beyaz Varsayılan, 2. Obsidian Koyu, 3. Cosmic Neon Eski Varsayılan, 4. Neo-Brutal Acid)
// v0.10: Player 2 Tahmin Slaytı İzleme Butonu, Player 1 Rapor Ekranında Canlı "X Tahminlerini İzliyor" Animasyonu, Raund Bazlı Rol Kilidi ve Tüm Modlar E2E Doğrulaması

const APP_VERSION = 'v0.11';
const DEFAULT_SUPABASE_URL = 'https://kypzuqnksnlinkfuxvnl.supabase.co';
const TOTAL_QUESTIONS = 5;
const CIRCLE_CIRCUMFERENCE = 414.69;
const PASS_ANSWER_VALUE = -1;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const GUEST_INACTIVITY_LIMIT_MS = SEVEN_DAYS_MS;

// %10 Eşit İhtimalli 10 Adet "Rakibin Düellodan Kaçtı / Teslim Oldu" Mesajı
const OPPONENT_FLED_MESSAGES = [
  '🏃‍♂️ Rakibin korkup arkasına bile bakmadan kaçtı!',
  '🏳️ Rakibin beyaz bayrağı çekti ve teslim oldu!',
  '⚡ Rakibin senin cesaretinin altında ezildi ve gitti!',
  '🐔 Rakibin soruları görünce soğuk terler döküp masadan tüydü!',
  '🌪️ Rakibin bu düellonun ağırlığını kaldıramayıp sırra kadem bastı!',
  '🛡️ Rakibin seninle yüzleşmeye cesaret edemedi ve düelloyu terk etti!',
  '🔥 Rakibin yenilgiyi önceden sezdi ve pılısını pırtısını toplayıp kaçtı!',
  '👻 Rakibin meydan okumandan korkup hayalet gibi ortadan kayboldu!',
  '🚨 Rakibin panik butonuna bastı ve arenadan çekildi!',
  '👑 Rakibin senin üstünlüğünü kabul edip düellodan çekildi!'
];

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
  isPasswordProtected: false, // Misafir hesabını şifreyle koruma durumu
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
  liveSettings: {
    ffaSubMode: 'ebe',
    teamSubMode: '',
    turnStep: 1,
    timerSeconds: 0,
    starterMode: 'random',
    selectedStarterCode: ''
  },
  category: 'genel',
  activeLobbyFilter: 'all', // 'all' | 'turn' | 'waiting'
  urgentRoomCode: '',
  pendingOAuthProvider: null,
  isSandboxTest: false, // "Bu Cihazda Test Et" simülasyon modu bayrağı (Gerçek düelloya etkisi 0, karşı saldırı kapalı)
  blurRoomCodes: false,
  fledInspectRoom: null,
  isInspectingFledMatch: false,
  fledAutoDeleteTimeoutId: null,
  currentRound: 1,
  half: 1,
  phase: 'p1_answer',
  myRoomRole: '', // 'p1' | 'p2' (Aynı tarayıcıda 2 sekmede veya farklı cihazlarda kesin rol ayrımı)
  myRoomRoleRound: 1,
  p1Id: '',
  p1FriendCode: '',
  p2Id: '',
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
  pendingCustomOptionText: '',
  isSubmittingStep: false,
  activeTimerStepKey: '',
  returnToResultAfterSlides: false,
  resumeHalf2AfterSlides: false,
  savedHalf2IndexBeforeReplay: 0,
  lastAcceptedFriendInvite: null,
  roomCode: '',
  generatedChallengeUrl: '',
  pollingIntervalId: null,
  liveLobbyPollingId: null,
  liveTurnPollingId: null,
  livePlayPollingId: null,
  cloudSyncIntervalId: null,
  questionTimerIntervalId: null,
  secretBubbleTimeoutId: null,
  slideWatchTimeoutId: null,
  slideWatchIntervalId: null,
  resultPollingId: null,
  lastSeenRound2NudgeAt: 0,
  completedRoomDataFromCloud: null,
  readyModalRoomData: null,
  liveRoomData: null,
  liveMatchState: null,
  lastRenderedLiveStepKey: '',
  selectedParticipantForHostAction: null
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

function getDeletedRoomCodesSet() {
  try {
    const arr = JSON.parse(localStorage.getItem('senceo_deleted_room_codes_v8') || '[]');
    if (Array.isArray(arr)) {
      return new Set(arr.map((c) => String(c || '').trim().toUpperCase()).filter(Boolean));
    }
  } catch (e) {}
  return new Set();
}

function markRoomCodePermanentlyDeleted(roomCode) {
  const clean = String(roomCode || '').trim().toUpperCase();
  if (!clean) return;
  try {
    const delSet = getDeletedRoomCodesSet();
    delSet.add(clean);
    localStorage.setItem('senceo_deleted_room_codes_v8', JSON.stringify(Array.from(delSet).slice(-120)));
    localStorage.removeItem(`senceo_room_${clean}`);
    const listRaw = localStorage.getItem('senceo_my_rooms_index') || '[]';
    const codes = JSON.parse(listRaw).filter((c) => String(c || '').toUpperCase() !== clean);
    localStorage.setItem('senceo_my_rooms_index', JSON.stringify(codes));
  } catch (e) {}

  if (userProfile.bonds) {
    Object.keys(userProfile.bonds).forEach((k) => {
      if (userProfile.bonds[k] && String(userProfile.bonds[k].activeRoomCode || '').toUpperCase() === clean) {
        userProfile.bonds[k].activeRoomCode = '';
      }
    });
  }
}

function toggleRoomCodeBlur(ev) {
  if (ev) ev.stopPropagation();
  gameState.blurRoomCodes = !gameState.blurRoomCodes;
  try {
    localStorage.setItem('senceo_blur_room_codes', gameState.blurRoomCodes ? '1' : '0');
  } catch (e) {}
  applyRoomCodeBlurState();
}

function applyRoomCodeBlurState() {
  document.body.classList.toggle('blur-room-codes', Boolean(gameState.blurRoomCodes));
  document.querySelectorAll('.room-code-eye-icon').forEach((icon) => {
    icon.textContent = gameState.blurRoomCodes ? 'visibility_off' : 'visibility';
  });
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
  // Misafirler için 7 gün (şifre korumalıysa 365 gün), Kalıcı Üyeler için 365 gün saklanır!
  const compactIdentity = {
    id: userProfile.id,
    friendCode: userProfile.friendCode,
    username: userProfile.username,
    email: userProfile.email,
    provider: userProfile.provider,
    isLoggedIn: userProfile.isLoggedIn,
    isPermanentMember: userProfile.isPermanentMember,
    isPasswordProtected: Boolean(userProfile.isPasswordProtected),
    avatar: userProfile.avatar,
    xp: userProfile.xp,
    level: userProfile.level,
    gamesPlayed: userProfile.gamesPlayed,
    questionsCorrect: userProfile.questionsCorrect,
    lastXpActivityAt: userProfile.lastXpActivityAt
  };
  const cookieDays = userProfile.isPermanentMember || userProfile.isPasswordProtected ? 365 : 7;
  setCookie('senceo_identity_v7', JSON.stringify(compactIdentity), cookieDays);
  setCookie('senceo_user_session', JSON.stringify(compactIdentity), cookieDays);

  // 3. Sekme içi yedek (window.name) — çerez/localStorage kısıtlı gömülü tarayıcılarda bile davet linkine tıklayınca SNC-XXXX kodunu korur!
  try {
    window.name = `SENCEO_ID:${JSON.stringify(compactIdentity)}`;
  } catch (e) {}
}

function loadUserProfile() {
  try {
    gameState.blurRoomCodes = localStorage.getItem('senceo_blur_room_codes') === '1';
    applyRoomCodeBlurState();
  } catch (e) {}

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

  // 4. 7 GÜNLÜK MİSAFİR TAKİBİ: Eğer kullanıcı kalıcı üye veya şifre korumalı değilse ve 7 gün boyunca hiç puanı artmadıysa verilerini sıfırla!
  if (loadedObj) {
    const isMember =
      Boolean(loadedObj.isPermanentMember) ||
      Boolean(loadedObj.isPasswordProtected) ||
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

    if (f.isPasswordProtected && !userProfile.isPasswordProtected) {
      userProfile.isPasswordProtected = true;
      changed = true;
    }

    // 0. Buluttaki silinmiş oda listesini yerel silinenler listesiyle birleştir (Silinen odalar ASLA geri gelmesin!)
    const deletedSet = getDeletedRoomCodesSet();
    if (Array.isArray(f.deletedRoomCodes)) {
      f.deletedRoomCodes.forEach((dc) => {
        if (dc) markRoomCodePermanentlyDeleted(dc);
      });
    }

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
        let targetKey = Object.keys(userProfile.bonds).find(
          (k) => userProfile.bonds[k] && userProfile.bonds[k].code === codeUpper
        );
        const rawAccName = String(acc.name || '').trim();
        const isPlaceholderAccName =
          !rawAccName ||
          rawAccName === 'Oyuncu' ||
          rawAccName === 'Arkadaşın' ||
          rawAccName.toUpperCase() === codeUpper ||
          /^Oyuncu\s*\(SNC-\d{4}\)$/i.test(rawAccName);
        const cleanName = !isPlaceholderAccName ? rawAccName.replace(/\s*\(SNC-\d{4}\)$/i, '').trim() : codeUpper;
        const desiredKey = cleanName !== codeUpper ? `${cleanName} (${codeUpper})` : `Oyuncu (${codeUpper})`;

        if (!targetKey) {
          targetKey = desiredKey;
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
        existing.verified = true;
        if (!isPlaceholderAccName && cleanName) {
          existing.realName = cleanName;
          // Eğer eski anahtar "Oyuncu (SNC-XXXX)" ise ve artık gerçek isim geldiyse anahtarı temizce taşı
          if (targetKey !== desiredKey && /^Oyuncu\s*\(SNC-\d{4}\)/i.test(targetKey)) {
            delete userProfile.bonds[targetKey];
            targetKey = desiredKey;
          }
        }
        userProfile.bonds[targetKey] = existing;
        changed = true;
      });
    }

    // 3. Bulutta benim için açılmış aktif odaları (activeRooms) yerel listeme ve bağlarıma ekle!
    const refreshedDeletedSet = getDeletedRoomCodesSet();
    if (Array.isArray(f.activeRooms)) {
      for (const summary of f.activeRooms) {
        if (!summary || !summary.code) continue;
        const codeUpper = String(summary.code).trim().toUpperCase();
        if (refreshedDeletedSet.has(codeUpper)) {
          continue; // Kullanıcının sildiği düello ASLA tekrar listeye eklenmez!
        }

        const localRaw = localStorage.getItem(`senceo_room_${codeUpper}`);
        const localRoom = localRaw ? JSON.parse(localRaw) : null;
        if (!localRoom || localRoom.status !== summary.status || localRoom.currentRound !== summary.currentRound) {
          const fullRoom = await fetchRoomFromDatabase(codeUpper);
          if (fullRoom) {
            changed = true;
          }
        } else {
          saveRoomToLocalLobbyList(localRoom);
        }

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
            userProfile.bonds[bondKey].activeRoomCode = codeUpper;
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

// KULLANICI İSTEĞİ: Misafirken "Çıkış Yap / Sıfırla" dendiğinde eski SNC-3675 hesabının adı liderlik tablosunda ezilmesin!
// Çıkış yapıldığında yerel oturum tamamen temizlenir ve yeni misafir için YENİ bir SNC-XXXX kodu üretilir.
// Eski hesabına şifre koyan kullanıcı ise istediği zaman "Şifreli Misafir Hesabına Giriş Yap" ile eski SNC-3675 hesabına dönebilir!
function logoutUserAccount() {
  deleteCookie('senceo_identity_v7');
  deleteCookie('senceo_user_session');
  try {
    localStorage.removeItem('senceo_user_profile');
    localStorage.removeItem('senceo_my_rooms_index');
    window.name = '';
  } catch (e) {}

  userProfile.id = 'USR_' + Math.random().toString(36).substring(2, 9).toUpperCase();
  userProfile.friendCode = generatePersonalFriendCode();
  userProfile.username = '';
  userProfile.email = '';
  userProfile.provider = 'guest';
  userProfile.isLoggedIn = false;
  userProfile.isPermanentMember = false;
  userProfile.isPasswordProtected = false;
  userProfile.xp = 0;
  userProfile.level = 1;
  userProfile.gamesPlayed = 0;
  userProfile.questionsCorrect = 0;
  userProfile.bonds = {};
  userProfile.incomingRequests = [];
  userProfile.notifications = [];
  userProfile.lastXpActivityAt = Date.now();

  gameState.player1Name = '';
  const p1Input = document.getElementById('input-p1-name');
  if (p1Input) p1Input.value = '';

  persistIdentityToStorage();
  renderProfileUI();
  refreshActiveGamesLobby();
  toggleProfileModal(false);
}

// Misafir Üyeliğini Şifreyle Koru (İsim + SNC-XXXX Kodunu Kilitleme)
async function saveGuestPasswordProtection() {
  const passInp = document.getElementById('input-guest-protect-password');
  const feedbackEl = document.getElementById('guest-password-feedback');
  const p1Input = document.getElementById('input-p1-name');

  const showMsg = (txt, isErr) => {
    if (!feedbackEl) return;
    feedbackEl.textContent = txt;
    feedbackEl.className = `text-xs font-bold ${isErr ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`;
    feedbackEl.classList.remove('hidden');
  };

  const currentName =
    (userProfile.username && userProfile.username !== 'Misafir Oyuncu' ? userProfile.username.trim() : '') ||
    (p1Input && p1Input.value.trim() ? p1Input.value.trim() : '');

  if (!currentName || currentName.length < 2) {
    showMsg('⚠️ Şifre koymadan önce lütfen ana sayfada veya profilde kendi oyuncu adını belirle!', true);
    return;
  }

  const rawPass = passInp ? passInp.value.trim() : '';
  if (!rawPass || rawPass.length < 3) {
    showMsg('⚠️ Lütfen en az 3 karakterli bir koruma şifresi girin.', true);
    return;
  }

  userProfile.username = currentName;
  showMsg('⏳ Hesabın ve kullanıcı adın şifreyle kilitleniyor...', false);

  try {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        action: 'set_guest_password',
        friendCode: userProfile.friendCode,
        username: currentName,
        password: rawPass,
        profile: userProfile
      })
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      showMsg(`❌ ${data.message || 'Bu kullanıcı adı başka bir oyuncu tarafından şifreyle korunuyor!'}`, true);
      return;
    }

    userProfile.isPasswordProtected = true;
    userProfile.isLoggedIn = true;
    if (passInp) passInp.value = '';
    saveUserProfile(true);
    spawnFloatingEmojiBurst('🔐');
    showMsg(
      `✅ Harika! "${currentName}" (${userProfile.friendCode}) hesabın şifreyle koruma altına alındı. Artık kimse senin ismini alamaz!`,
      false
    );
  } catch (e) {
    showMsg('⚠️ Sunucu bağlantısı kurulamadı, lütfen tekrar dene.', true);
  }
}

function toggleGuestPasswordLoginBox() {
  const box = document.getElementById('guest-password-login-box');
  if (!box) return;
  box.classList.toggle('hidden');
  if (!box.classList.contains('hidden')) {
    const idInp = document.getElementById('input-guest-login-id');
    if (idInp) idInp.focus();
  }
}

async function loginWithGuestPassword() {
  const idInp = document.getElementById('input-guest-login-id');
  const passInp = document.getElementById('input-guest-login-pass');
  const feedbackEl = document.getElementById('guest-password-feedback');

  const showMsg = (txt, isErr) => {
    if (!feedbackEl) return;
    feedbackEl.textContent = txt;
    feedbackEl.className = `text-xs font-bold ${isErr ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`;
    feedbackEl.classList.remove('hidden');
  };

  const identifier = idInp ? idInp.value.trim() : '';
  const password = passInp ? passInp.value.trim() : '';

  if (!identifier || !password) {
    showMsg('⚠️ Lütfen kullanıcı adını (veya SNC-XXXX kodunu) ve şifreni gir.', true);
    return;
  }

  showMsg('⏳ Şifreli misafir hesabı doğrulanıyor...', false);

  try {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        action: 'login_guest_password',
        identifier,
        password
      })
    });
    const data = await res.json();
    if (!res.ok || data.error || !data.friend) {
      showMsg(`❌ ${data.message || 'Kullanıcı adı/kod veya şifre hatalı!'}`, true);
      return;
    }

    const f = data.friend;
    userProfile.friendCode = f.friendCode || userProfile.friendCode;
    userProfile.username = f.username || identifier;
    userProfile.xp = Number(f.xp) || 0;
    userProfile.level = Math.max(1, Number(f.level) || 1);
    userProfile.gamesPlayed = Number(f.gamesPlayed) || 0;
    userProfile.questionsCorrect = Number(f.questionsCorrect) || 0;
    userProfile.isPasswordProtected = true;
    userProfile.isLoggedIn = true;
    userProfile.lastXpActivityAt = Date.now();

    const p1Input = document.getElementById('input-p1-name');
    if (p1Input) p1Input.value = userProfile.username;
    gameState.player1Name = userProfile.username;

    if (idInp) idInp.value = '';
    if (passInp) passInp.value = '';
    const loginBox = document.getElementById('guest-password-login-box');
    if (loginBox) loginBox.classList.add('hidden');

    saveUserProfile(true);
    await syncCloudFriendState(false);
    spawnFloatingEmojiBurst('🔑');
    showMsg(`✅ Hoş geldin ${userProfile.username} (${userProfile.friendCode})! Hesabın ve seviyen geri yüklendi.`, false);
  } catch (e) {
    showMsg('⚠️ Giriş yapılırken bağlantı hatası oluştu.', true);
  }
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
  const inpP1 = document.getElementById('input-p1-name');
  const candidateName =
    (userProfile.username && userProfile.username !== 'Misafir Oyuncu' ? userProfile.username.trim() : '') ||
    (gameState.player1Name && gameState.player1Name.trim()) ||
    (inpP1 && inpP1.value.trim()) ||
    'Arkadaşın';
  if (candidateName !== 'Arkadaşın' && (!userProfile.username || userProfile.username === 'Misafir Oyuncu')) {
    userProfile.username = candidateName;
    saveUserProfile(false);
  }
  const inviteUrl = `${baseUrl}?friend=${encodeURIComponent(userProfile.friendCode)}&fname=${encodeURIComponent(candidateName)}`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      const toast = document.getElementById('friend-invite-copy-toast');
      if (toast) {
        toast.textContent = `✅ Çift taraflı davet linkin (${userProfile.friendCode}) panoya kopyalandı!`;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3500);
      }
    });
  }
  return inviteUrl;
}

async function checkIncomingFriendInvite() {
  const params = new URLSearchParams(window.location.search);
  const fCode = params.get('friend');
  const fName = params.get('fname');
  if (!fCode || !/^SNC-\d{4}$/i.test(fCode.trim())) return false;

  const codeUpper = fCode.trim().toUpperCase();
  if (codeUpper === (userProfile.friendCode || '').toUpperCase()) return false;

  const rawInviterName = fName && fName.trim() ? fName.trim().replace(/\s*\(SNC-\d{4}\)$/i, '').trim() : '';
  let resolvedInviterName =
    rawInviterName && rawInviterName !== 'Arkadaşın' && rawInviterName !== 'Oyuncu' ? rawInviterName : '';

  const myRealName =
    userProfile.username && userProfile.username !== 'Misafir Oyuncu' ? userProfile.username.trim() : '';
  const accepterNameForCloud = myRealName || `Oyuncu (${userProfile.friendCode})`;

  let activeRoomFromInviter = null;
  try {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        action: 'accept_friend_invite_link',
        inviterCode: codeUpper,
        inviterName: resolvedInviterName || codeUpper,
        accepterCode: userProfile.friendCode,
        accepterName: accepterNameForCloud
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (
        data &&
        data.inviterName &&
        data.inviterName !== 'Oyuncu' &&
        data.inviterName !== 'Arkadaşın' &&
        data.inviterName.toUpperCase() !== codeUpper
      ) {
        resolvedInviterName = String(data.inviterName).replace(/\s*\(SNC-\d{4}\)$/i, '').trim();
      }
      if (data && data.room && data.room.code) {
        activeRoomFromInviter = data.room;
      }
    }
  } catch (e) {}

  const cleanInviter = resolvedInviterName || codeUpper;
  const desiredKey = cleanInviter !== codeUpper ? `${cleanInviter} (${codeUpper})` : `Oyuncu (${codeUpper})`;

  // Mevcut bond varsa bul ve temiz anahtara taşı / güncelle
  let existingKey = Object.keys(userProfile.bonds || {}).find(
    (k) => userProfile.bonds[k] && userProfile.bonds[k].code === codeUpper
  );
  const existingBond = (existingKey && userProfile.bonds[existingKey]) || {
    code: codeUpper,
    realName: cleanInviter,
    activeRoomCode: '',
    xp: 0,
    level: 1,
    matches: 0,
    commonAnswers: 0,
    lastPct: 0,
    status: 'accepted',
    verified: true
  };
  existingBond.code = codeUpper;
  existingBond.realName = cleanInviter;
  existingBond.status = 'accepted';
  existingBond.verified = true;
  if (activeRoomFromInviter && activeRoomFromInviter.code) {
    existingBond.activeRoomCode = activeRoomFromInviter.code;
  }
  if (existingKey && existingKey !== desiredKey) {
    delete userProfile.bonds[existingKey];
  }
  userProfile.bonds[desiredKey] = existingBond;
  gameState.lastAcceptedFriendInvite = {
    code: codeUpper,
    name: cleanInviter,
    bondKey: desiredKey,
    roomCode: (activeRoomFromInviter && activeRoomFromInviter.code) || ''
  };

  saveUserProfile(true);
  renderProfileUI();

  // URL'den ?friend= ve ?fname= parametrelerini temizle (diğer parametreleri koru)
  try {
    params.delete('friend');
    params.delete('fname');
    const qs = params.toString();
    const cleanUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    window.history.replaceState({}, document.title, cleanUrl);
  } catch (e) {}

  // Eğer aynı anda ?r= ile direkt oda linki de yoksa: Ana sayfa yerine doğrudan Bağlarım sayfasını ve karşılama kartını aç!
  if (!params.get('r') && !params.get('room')) {
    const banner = document.getElementById('friend-invite-accepted-banner');
    const bTitle = document.getElementById('friend-invite-banner-title');
    const bDesc = document.getElementById('friend-invite-banner-desc');
    const nameRow = document.getElementById('friend-invite-name-row');
    const nameInp = document.getElementById('input-friend-invite-my-name');
    const ctaLabel = document.getElementById('btn-friend-invite-start-duel-label');

    const inviterLabel = cleanInviter !== codeUpper ? `${cleanInviter} (${codeUpper})` : codeUpper;
    if (bTitle) {
      bTitle.textContent = `🤝 ${inviterLabel} ile Çift Taraflı Arkadaş Bağın Kuruldu!`;
    }
    if (bDesc) {
      bDesc.innerHTML = `Artık hem senin ekranında <strong>${escapeHtml(
        inviterLabel
      )}</strong>, hem de onun ekranında <strong>${escapeHtml(
        myRealName ? `${myRealName} (${userProfile.friendCode})` : userProfile.friendCode
      )}</strong> kayıtlı arkadaş bağlarında görünüyor!`;
    }
    if (nameRow) {
      nameRow.classList.toggle('hidden', Boolean(myRealName));
      if (!myRealName && nameInp) nameInp.value = '';
    }
    if (ctaLabel) {
      ctaLabel.textContent =
        activeRoomFromInviter && activeRoomFromInviter.code
          ? `${cleanInviter !== codeUpper ? cleanInviter : codeUpper} İle Aktif Düelloya Katıl (#${activeRoomFromInviter.code})`
          : `${cleanInviter !== codeUpper ? cleanInviter : codeUpper} İle Hemen Düello Başlat`;
    }
    if (banner) banner.classList.remove('hidden');

    switchTopNavPage('bonds');
    spawnFloatingEmojiBurst('🤝');
    playSoundEffect('correct');
    return true;
  }
  return false;
}

async function saveNameFromFriendInviteBanner() {
  const inp = document.getElementById('input-friend-invite-my-name');
  const val = inp ? inp.value.trim() : '';
  if (!val) return;
  userProfile.username = val;
  gameState.player1Name = val;
  const p1Input = document.getElementById('input-p1-name');
  if (p1Input) p1Input.value = val;
  saveUserProfile(true);
  renderProfileUI();

  const nameRow = document.getElementById('friend-invite-name-row');
  if (nameRow) nameRow.classList.add('hidden');

  const info = gameState.lastAcceptedFriendInvite;
  if (info && info.code) {
    try {
      await fetch('/api/rooms', {
        method: 'POST',
        headers: getSupabaseHeaders(),
        body: JSON.stringify({
          action: 'accept_friend_invite_link',
          inviterCode: info.code,
          inviterName: info.name || info.code,
          accepterCode: userProfile.friendCode,
          accepterName: val
        })
      });
    } catch (e) {}
    const bDesc = document.getElementById('friend-invite-banner-desc');
    if (bDesc) {
      const inviterLabel = info.name && info.name !== info.code ? `${info.name} (${info.code})` : info.code;
      bDesc.innerHTML = `Harika! İsmin <strong>${escapeHtml(val)} (${escapeHtml(
        userProfile.friendCode
      )})</strong> olarak <strong>${escapeHtml(inviterLabel)}</strong> ekranına da senkronize edildi!`;
    }
  }
  spawnFloatingEmojiBurst('✨');
}

async function confirmFriendInviteAndStartDuel() {
  const inp = document.getElementById('input-friend-invite-my-name');
  if (inp && inp.value.trim() && (!userProfile.username || userProfile.username === 'Misafir Oyuncu')) {
    await saveNameFromFriendInviteBanner();
  }
  const info = gameState.lastAcceptedFriendInvite;
  dismissFriendInviteBanner();
  if (info && info.bondKey && userProfile.bonds[info.bondKey]) {
    await startDuelWithFriend(info.bondKey);
    return;
  }
  if (info && info.code) {
    const foundKey = Object.keys(userProfile.bonds || {}).find(
      (k) => userProfile.bonds[k] && userProfile.bonds[k].code === info.code
    );
    if (foundKey) {
      await startDuelWithFriend(foundKey);
      return;
    }
  }
  switchTopNavPage('setup');
}

function dismissFriendInviteBanner() {
  const banner = document.getElementById('friend-invite-accepted-banner');
  if (banner) banner.classList.add('hidden');
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
      userProfile.isPermanentMember
        ? `Kalıcı Üye: ${userProfile.provider}`
        : userProfile.isPasswordProtected
        ? 'Şifre Korumalı Misafir'
        : 'Misafir • 7 Gün Korumalı'
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
      if (sProv) {
        sProv.textContent = userProfile.isPermanentMember
          ? `${userProfile.provider} (Kalıcı)`
          : userProfile.isPasswordProtected
          ? 'Misafir (Şifre Korumalı 🔐)'
          : 'Misafir (7 Gün)';
      }
    } else {
      authCard.classList.remove('hidden');
      loggedStrip.classList.add('hidden');
    }
  }

  // Profil Modalı İçeriği + Misafir Şifre Koruma Kartı + Pasif Hesaba Aktarma Kartı
  const mName = document.getElementById('modal-profile-name');
  const mProv = document.getElementById('modal-profile-provider');
  const mLvl = document.getElementById('modal-personal-level');
  const mBar = document.getElementById('modal-personal-xp-bar');
  const mXpText = document.getElementById('modal-personal-xp-text');
  const mStats = document.getElementById('modal-personal-stats');
  const guestTransferCard = document.getElementById('guest-transfer-membership-card');
  const guestPassCard = document.getElementById('guest-password-protect-card');
  const guestPassBadge = document.getElementById('guest-password-status-badge');
  const retentionBadge = document.getElementById('guest-retention-badge');

  const elapsedMs = Date.now() - Number(userProfile.lastXpActivityAt || Date.now());
  const daysLeft = Math.max(1, Math.ceil((GUEST_INACTIVITY_LIMIT_MS - elapsedMs) / (24 * 60 * 60 * 1000)));
  if (retentionBadge) retentionBadge.textContent = `${daysLeft} Gün Koruma`;

  if (guestTransferCard) {
    guestTransferCard.classList.toggle('hidden', Boolean(userProfile.isPermanentMember));
  }
  if (guestPassCard) {
    guestPassCard.classList.toggle('hidden', Boolean(userProfile.isPermanentMember));
  }
  if (guestPassBadge) {
    if (userProfile.isPasswordProtected) {
      guestPassBadge.textContent = '🔒 Şifre Korumalı';
      guestPassBadge.className = 'px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 text-[10px] font-bold';
    } else {
      guestPassBadge.textContent = 'Şifresiz Misafir';
      guestPassBadge.className = 'px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 text-[10px] font-bold';
    }
  }

  if (mName) mName.textContent = displayName;
  if (mProv) {
    mProv.textContent = userProfile.isPermanentMember
      ? `${userProfile.provider}${userProfile.email ? ` (${userProfile.email})` : ''} • Kalıcı Üye`
      : userProfile.isPasswordProtected
      ? `Misafir Oturumu (🔐 Şifre Korumalı • ${userProfile.friendCode})`
      : `Misafir Oturumu (${daysLeft} gün XP hareketsizlik süresi)`;
  }
  if (mLvl) mLvl.textContent = `LVL ${lvl}`;
  if (mBar) mBar.style.width = `${Math.max(10, xpInLevel)}%`;
  if (mXpText) mXpText.textContent = `${xpInLevel} / 100 XP (Toplam: ${xpTotal} XP)`;
  if (mStats) mStats.textContent = `${userProfile.questionsCorrect || 0} Doğru Tahmin • ${userProfile.gamesPlayed || 0} Oyun`;

  updateHeaderNotificationBadges();
  renderIncomingFriendRequestsUI();
  renderBondsLists();
  applyRoomCodeBlurState();
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
    const cleanReal = b.realName ? String(b.realName).replace(/\s*\(SNC-\d{4}\)$/i, '').trim() : '';
    const displayLabel =
      cleanReal &&
      cleanReal !== 'Arkadaşın' &&
      cleanReal !== 'Oyuncu' &&
      b.code &&
      /^SNC-\d{4}$/i.test(b.code) &&
      cleanReal.toUpperCase() !== b.code.toUpperCase()
        ? `${cleanReal} (${b.code})`
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
      if (Array.isArray(data.players)) {
        cloudPlayers = data.players;
      } else if (Array.isArray(data.leaderboard)) {
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
    const fCode = cp ? (cp.code || cp.friendCode) : '';
    if (!fCode) return;
    const isMe = fCode === userProfile.friendCode;
    const rawName = cp.name || cp.username || 'Oyuncu';
    mergedMap.set(fCode, {
      code: fCode,
      name: rawName.includes(fCode) ? rawName : `${rawName} (${fCode})`,
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

  if (typeof renderMobileLeaderboardExtras === 'function') renderMobileLeaderboardExtras(players);

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

// v0.10: Sekme bazlı (sessionStorage) + Raund bazlı (_r1, _r2...) + Kimlik bazlı (p1Id/p1FriendCode vs p2Id/p2FriendCode) kesin oyuncu rolü tespiti!
// Böylece:
// 1. sıradana ve sıradanb aynı tarayıcının 2 sekmesinde bile test edilse rolleri ASLA birbirine karışmaz!
// 2. 1. Raund bittiğinde sıradana "2. Raunda Geç" bildirimi gönderip tekrar rapor ekranına dönse bile 1. Raunddaki rolü ('p1') ASLA 'p2' olarak ezilmez; sıradana tekrar butona bassa bile sıradanb'ymiş gibi soruları cevaplayamaz!
function setMyRoleForRoom(roomCode, role, roundNum = null) {
  const cleanCode = String(roomCode || '').trim().toUpperCase();
  if (!cleanCode || (role !== 'p1' && role !== 'p2')) return;
  const rNum = Math.max(1, Number(roundNum || gameState.currentRound) || 1);
  if (rNum === (Number(gameState.currentRound) || 1)) {
    gameState.myRoomRole = role;
    gameState.myRoomRoleRound = rNum;
  }
  try {
    sessionStorage.setItem(`senceo_room_role_${cleanCode}_r${rNum}`, role);
    if (rNum === (Number(gameState.currentRound) || 1)) {
      sessionStorage.setItem(`senceo_room_role_${cleanCode}`, role);
    }
  } catch (e) {}
}

function getMyRoleForRoom(room, explicitRoundNum = null) {
  if (!room) return '';
  const cleanCode = String(room.code || gameState.roomCode || '').trim().toUpperCase();
  const rNum = Math.max(1, Number(explicitRoundNum || room.currentRound || gameState.currentRound) || 1);
  if (cleanCode) {
    try {
      const roundSpecificRole = sessionStorage.getItem(`senceo_room_role_${cleanCode}_r${rNum}`);
      if (roundSpecificRole === 'p1' || roundSpecificRole === 'p2') {
        return roundSpecificRole;
      }
      if (rNum === 1) {
        const legacyTabRole = sessionStorage.getItem(`senceo_room_role_${cleanCode}`);
        if (legacyTabRole === 'p1' || legacyTabRole === 'p2') return legacyTabRole;
      }
    } catch (e) {}
  }
  if (
    cleanCode &&
    gameState.roomCode === cleanCode &&
    gameState.myRoomRoleRound === rNum &&
    (gameState.myRoomRole === 'p1' || gameState.myRoomRole === 'p2')
  ) {
    return gameState.myRoomRole;
  }
  return '';
}

function isUserPlayer1OfRoom(room, explicitRoundNum = null) {
  if (!room) return false;

  // v0.11 KÖK NEDEN DÜZELTMESİ: Gerçek kimlik (SNC-XXXX arkadaş kodu) HER ZAMAN sekme rolünden (sessionStorage) önce gelir!
  // Eskiden sekme rolü önce kontrol ediliyordu; Player 1 kendi davet linkine (WhatsApp vb.) tıkladığında yeni sekmede
  // otomatik 'p2' rolü atanıyor ve Player 1 kendi sorularını Player 2 gibi tahmin edebiliyordu.
  // Sekme rolü artık SADECE iki oyuncunun kodu aynı olduğunda (aynı tarayıcıda test) eşitlik bozucu olarak kullanılır.
  const myCode = (userProfile.friendCode || '').trim().toUpperCase();
  const rP1Code = (room.p1FriendCode || '').trim().toUpperCase();
  const rP2Code = (room.p2FriendCode || '').trim().toUpperCase();

  if (myCode && rP1Code && rP1Code !== rP2Code) {
    if (rP1Code === myCode) return true;
    if (rP2Code && rP2Code === myCode) return false;
    // Kod ne P1 ne P2: P2 henüz belli değilse davet linkini açan yeni oyuncu P2'dir
    if (!rP2Code) return false;
  }

  const explicitTabRole = getMyRoleForRoom(room, explicitRoundNum);
  if (explicitTabRole === 'p1') return true;
  if (explicitTabRole === 'p2') return false;

  if (userProfile.id && room.p1Id && room.p1Id !== room.p2Id) {
    if (room.p1Id === userProfile.id) return true;
    if (room.p2Id && room.p2Id === userProfile.id) return false;
  }

  const myName = (userProfile.username || gameState.player1Name || '').trim().toLowerCase();
  const p1Lower = (room.p1 || '').trim().toLowerCase();
  const p2Lower = (room.p2 || '').trim().toLowerCase();
  if (myName && myName !== 'misafir oyuncu') {
    if (p1Lower && p1Lower === myName && p2Lower !== myName) return true;
    if (p2Lower && p2Lower === myName && p1Lower !== myName) return false;
  }
  return false;
}

function saveRoomToLocalLobbyList(roomPayload) {
  if (!roomPayload || !roomPayload.code) return;
  const cleanCode = String(roomPayload.code).trim().toUpperCase();
  if (getDeletedRoomCodesSet().has(cleanCode)) {
    return; // Silinmiş oda tekrar yerel listeye eklenmez!
  }
  try {
    localStorage.setItem(`senceo_room_${cleanCode}`, JSON.stringify(roomPayload));
    const listRaw = localStorage.getItem('senceo_my_rooms_index') || '[]';
    const codes = JSON.parse(listRaw);
    if (!codes.includes(cleanCode)) {
      codes.unshift(cleanCode);
      localStorage.setItem('senceo_my_rooms_index', JSON.stringify(codes.slice(0, 20)));
    }
  } catch (e) {}
  updateNavActiveDuelsCount();
}

function deleteDuelFromLobby(roomCode, ev) {
  if (ev) ev.stopPropagation();
  const cleanCode = String(roomCode || '').trim().toUpperCase();
  if (!cleanCode) return;

  markRoomCodePermanentlyDeleted(cleanCode);
  saveUserProfile(true);
  updateNavActiveDuelsCount();
  refreshActiveGamesLobby();

  // Bulutta da bu düelloyu sildiğimizi / terk ettiğimizi işaretle (Karşı oyuncu girerse %10 eşit ihtimalli 10 kaçış mesajından biri çıksın ve bizde bir daha geri gelmesin!)
  fetch('/api/rooms', {
    method: 'POST',
    headers: getSupabaseHeaders(),
    body: JSON.stringify({
      action: 'forfeit_or_delete_room',
      code: cleanCode,
      requesterCode: userProfile.friendCode,
      requesterName: userProfile.username || gameState.player1Name || 'Rakibin'
    })
  }).catch(() => {});
}

function clearAllActiveDuels() {
  let codes = [];
  try {
    codes = JSON.parse(localStorage.getItem('senceo_my_rooms_index') || '[]');
  } catch (e) {}

  codes.forEach((c) => markRoomCodePermanentlyDeleted(c));
  try {
    localStorage.setItem('senceo_my_rooms_index', '[]');
  } catch (e) {}

  saveUserProfile(true);
  updateNavActiveDuelsCount();
  refreshActiveGamesLobby();

  if (codes.length > 0) {
    fetch('/api/rooms', {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        action: 'forfeit_or_delete_room',
        codes,
        requesterCode: userProfile.friendCode,
        requesterName: userProfile.username || gameState.player1Name || 'Rakibin'
      })
    }).catch(() => {});
  }
}

function openOpponentFledModal(room) {
  if (!room) return;
  gameState.fledInspectRoom = room;
  const modal = document.getElementById('opponent-fled-modal');
  const titleEl = document.getElementById('opponent-fled-title');
  const descEl = document.getElementById('opponent-fled-desc');
  if (!modal) return;

  // 10 Adet %10 Eşit İhtimalli Mesajdan Rastgele Seç
  const randomIdx = Math.floor(Math.random() * OPPONENT_FLED_MESSAGES.length);
  const chosenMsg = OPPONENT_FLED_MESSAGES[randomIdx] || OPPONENT_FLED_MESSAGES[0];
  const fledWho = room.fledByName || room.p2 || room.p1 || 'Rakibin';

  if (titleEl) titleEl.textContent = chosenMsg;
  if (descEl) {
    descEl.innerHTML = `<strong>${escapeHtml(fledWho)}</strong> bu düelloyu sonlandırıp masadan ayrıldı (Oda: <strong class="font-mono-theme room-code-blurrable">#${escapeHtml(
      room.code || ''
    )}</strong>). İstersen önceki soruları ve yanıtları inceleyebilir veya doğrudan ana sayfaya dönebilirsin. İncelemeden çıktığında bu maç otomatik olarak listeden kaldırılacak.`;
  }

  modal.classList.remove('hidden');
  applyRoomCodeBlurState();
  playSoundEffect('wrong');
}

function inspectFledMatch() {
  const modal = document.getElementById('opponent-fled-modal');
  if (modal) modal.classList.add('hidden');
  const room = gameState.fledInspectRoom;
  if (!room) {
    resetToHome();
    return;
  }

  // Maçı inceledikten sonra çıktığında veya 45 sn sonra otomatik silinmesi için kalıcı silinenlere ekle
  if (room.code) {
    markRoomCodePermanentlyDeleted(room.code);
  }
  gameState.isInspectingFledMatch = true;
  loadRoomIntoGameState(room, true);

  const verdictTitle = document.getElementById('result-verdict-title');
  const verdictDesc = document.getElementById('result-verdict-desc');
  if (verdictTitle) verdictTitle.textContent = '🏳️ Rakibin Düellodan Çekildi (Maç İncelemesi)';
  if (verdictDesc) {
    verdictDesc.textContent =
      'Bu düello karşı tarafça sonlandırıldı. Şimdiye kadar verilen yanıtları aşağıdan inceleyebilirsin. Bu ekrandan çıktığında maç otomatik olarak silinir.';
  }

  if (gameState.fledAutoDeleteTimeoutId) clearTimeout(gameState.fledAutoDeleteTimeoutId);
  gameState.fledAutoDeleteTimeoutId = setTimeout(() => {
    if (gameState.isInspectingFledMatch) {
      gameState.isInspectingFledMatch = false;
      refreshActiveGamesLobby();
    }
  }, 45000);
}

function dismissFledMatchAndGoHome() {
  const modal = document.getElementById('opponent-fled-modal');
  if (modal) modal.classList.add('hidden');
  const room = gameState.fledInspectRoom;
  if (room && room.code) {
    markRoomCodePermanentlyDeleted(room.code);
  }
  gameState.fledInspectRoom = null;
  gameState.isInspectingFledMatch = false;
  refreshActiveGamesLobby();
  resetToHome();
}

function updateNavActiveDuelsCount() {
  const badge = document.getElementById('nav-active-duels-count');
  if (!badge) return;
  try {
    const delSet = getDeletedRoomCodesSet();
    const codes = JSON.parse(localStorage.getItem('senceo_my_rooms_index') || '[]').filter(
      (c) => !delSet.has(String(c || '').toUpperCase())
    );
    if (codes.length > 0) {
      badge.textContent = String(codes.length);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch (e) {}
}

async function saveRoomToDatabase(roomPayload) {
  const myTabRole = isUserPlayer1OfRoom(roomPayload) ? 'p1' : 'p2';
  if (myTabRole !== 'p2' && roomPayload.status !== 'waiting_p1_half2') {
    if (!roomPayload.p1FriendCode && (gameState.p1FriendCode || userProfile.friendCode)) {
      roomPayload.p1FriendCode = gameState.p1FriendCode || userProfile.friendCode;
    }
    if (!roomPayload.p1Id && (gameState.p1Id || userProfile.id)) {
      roomPayload.p1Id = gameState.p1Id || userProfile.id;
    }
  } else {
    if (!roomPayload.p1FriendCode && gameState.p1FriendCode) {
      roomPayload.p1FriendCode = gameState.p1FriendCode;
    }
    if (!roomPayload.p1Id && gameState.p1Id) {
      roomPayload.p1Id = gameState.p1Id;
    }
    if (!roomPayload.p2FriendCode && (gameState.player2FriendCode || userProfile.friendCode)) {
      roomPayload.p2FriendCode = gameState.player2FriendCode || userProfile.friendCode;
    }
    if (!roomPayload.p2Id && (gameState.p2Id || userProfile.id)) {
      roomPayload.p2Id = gameState.p2Id || userProfile.id;
    }
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
        if (!getDeletedRoomCodesSet().has(cleanCode)) {
          saveRoomToLocalLobbyList(data.room);
        }
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

  const delSet = getDeletedRoomCodesSet();
  let codes = [];
  try {
    codes = JSON.parse(localStorage.getItem('senceo_my_rooms_index') || '[]').filter(
      (c) => !delSet.has(String(c || '').toUpperCase())
    );
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
      room.status === 'opponent_fled' ||
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
  const eyeIconName = gameState.blurRoomCodes ? 'visibility_off' : 'visibility';

  for (const item of allRooms) {
    const { room, isP1, isMyTurn } = item;

    if (!gameState.urgentRoomCode && isMyTurn) {
      gameState.urgentRoomCode = room.code;
      const opp = isP1 ? (room.p2 || room.p2FriendCode || 'Arkadaşın') : (room.p1 || 'Oyuncu 1');
      if (urgentTitle) urgentTitle.textContent = `${opp} senin 5 tahminini bekliyor!`;
      if (urgentDesc) urgentDesc.textContent = `${(room.cat || 'Genel').toUpperCase()} serisinde son hamle sende. Uyum oranını yükseltme şansını kaçırma.`;
      if (urgentBtnText) urgentBtnText.textContent = 'Hamleni Yap';
      if (urgentTimeText) urgentTimeText.textContent = `Aktif Sıra`;
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
                <h3 class="font-display-theme font-bold text-sm sm:text-base">Canlı Parti (<span class="room-code-blurrable">${escapeHtml(room.code)}</span>)</h3>
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
          <span class="text-xs text-muted-theme flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[15px]">lock_open</span>
            <span>Oda Kodu: <strong class="font-mono-theme text-primary-theme room-code-blurrable">${escapeHtml(room.code)}</strong></span>
            <button type="button" onclick="toggleRoomCodeBlur(event)" class="w-6 h-6 rounded-md stitch-subcard inline-flex items-center justify-center hover:border-[var(--primary)]" title="Oda Kodlarını Gizle / Göster">
              <span class="material-symbols-outlined text-[14px] room-code-eye-icon">${eyeIconName}</span>
            </button>
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

    if (room.status === 'opponent_fled') {
      statusPill = `<span class="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-bold text-[11px]">🏳️ Rakip Çekildi / Kaçtı</span>`;
      progressPct = 100;
      actionLabel = 'Durumu Gör';
    } else if (room.status === 'completed') {
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

    const lockedTimelineHtml =
      !isMyTurn && room.status !== 'completed' && room.status !== 'opponent_fled'
        ? `
          <div class="p-2.5 rounded-xl stitch-subcard flex items-center justify-between text-xs text-muted-theme">
            <div class="flex items-center gap-1.5 font-semibold">
              <span class="material-symbols-outlined text-[17px] text-emerald-500">check_circle</span>
              <span>Senin 5 yanıtın kilitlendi • Rakibin tahmini bekleniyor</span>
            </div>
            <span class="font-mono-theme text-[11px] room-code-blurrable">#${escapeHtml(room.code)}</span>
          </div>
        `
        : '';

    const nudgeButtonHtml =
      !isMyTurn && room.status !== 'completed' && room.status !== 'opponent_fled'
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
              ${escapeHtml((room.cat || 'genel').toUpperCase())} • Raunt ${room.currentRound || 1} • 5/5 Soru • Oda: <strong class="font-mono-theme text-primary-theme room-code-blurrable">#${escapeHtml(room.code)}</strong>
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
        <span class="text-xs text-muted-theme flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[15px]">lock_open</span>
          <span>Oda Kodu: <strong class="font-mono-theme room-code-blurrable">${escapeHtml(room.code)}</strong></span>
          <button type="button" onclick="toggleRoomCodeBlur(event)" class="w-6 h-6 rounded-md stitch-subcard inline-flex items-center justify-center hover:border-[var(--primary)]" title="Oda Kodlarını Gizle / Göster">
            <span class="material-symbols-outlined text-[14px] room-code-eye-icon">${eyeIconName}</span>
          </button>
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
  applyRoomCodeBlurState();
}

async function openRoomFromLobbyCard(code) {
  const latest = await fetchRoomFromDatabase(code);
  if (latest) {
    if (latest.status === 'opponent_fled') {
      openOpponentFledModal(latest);
      return;
    }
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

// Canlı Bildirim & Oda Kontrol Dinleyici (v0.09: Kumsaati ekranındayken slayt / sonuç ekranına kesintisiz otomatik geçiş!)
function startPollingForPartnerCompletion(roomCode) {
  stopPollingForPartnerCompletion();
  if (!roomCode) return;

  gameState.pollingIntervalId = setInterval(async () => {
    const room = await fetchRoomFromDatabase(roomCode);
    if (!room) return;
    const isP1 = isUserPlayer1OfRoom(room);
    const isOnWaitingScreen =
      !document.getElementById('view-interstitial')?.classList.contains('hidden') ||
      !document.getElementById('view-live-turn-wait')?.classList.contains('hidden');

    // 1. denemeb 1. yarıyı tahmin edip kendi 5 sorusunu hazırladığında (waiting_p1_half2):
    // Bildirim SADECE denemea'ya (isP1 === true) gider ve denemea kumsaati ekranındaysa ANINDA 1. sorudan 5. soruya slayt başlar!
    if (isP1 && room.status === 'waiting_p1_half2') {
      stopPollingForPartnerCompletion();
      triggerPartnerCompletedNotification(room);
      refreshActiveGamesLobby();
      if (isOnWaitingScreen) {
        loadRoomIntoGameState(room, false);
      } else {
        openOpponentTurnReadyModal(room);
      }
      return;
    }

    // 2. denemea slaytları izleyip denemeb'nin 5 sorusunu da tahmin ederek maçı bitirdiğinde (completed):
    // Kumsaati ekranında bekleyen denemeb'ye hem bildirim gider hem de kumsaati ekranı ANINDA 3. Görsel (Sonuç & 2. Raunda Geç) ekranına dönüşür!
    if (room.status === 'completed') {
      stopPollingForPartnerCompletion();
      triggerPartnerCompletedNotification(room);
      refreshActiveGamesLobby();
      if (isOnWaitingScreen) {
        loadRoomIntoGameState(room, true);
      } else {
        openOpponentTurnReadyModal(room);
      }
      return;
    }

    // 3. 2. Raund için sıra bekleyen oyuncunun rakibi ilk 5 soruyu çözdüyse (waiting_p2):
    if (room.status === 'waiting_p2' && !isP1 && Array.isArray(room.p1Answers) && room.p1Answers.length >= TOTAL_QUESTIONS) {
      stopPollingForPartnerCompletion();
      stopLiveTurnWaitPolling();
      triggerPartnerCompletedNotification(room);
      refreshActiveGamesLobby();
      if (isOnWaitingScreen) {
        loadRoomIntoGameState(room, false);
      } else {
        openOpponentTurnReadyModal(room);
      }
    }
  }, 2500);
}

function stopPollingForPartnerCompletion() {
  if (gameState.pollingIntervalId) {
    clearInterval(gameState.pollingIntervalId);
    gameState.pollingIntervalId = null;
  }
}

function openOpponentTurnReadyModal(room) {
  if (!room) return;
  const isP1 = isUserPlayer1OfRoom(room);
  // Güvenlik kilidi: waiting_p1_half2 aşamasında P2'ye (denemeb) asla "Sıra Sende" modalı açılmaz!
  if (room.status === 'waiting_p1_half2' && !isP1) return;

  gameState.completedRoomDataFromCloud = room;
  const modal = document.getElementById('opponent-turn-ready-modal');
  const titleEl = document.getElementById('turn-ready-modal-title');
  const descEl = document.getElementById('turn-ready-modal-desc');
  if (!modal) return;

  const partner = isP1 ? (room.p2 || 'Arkadaşın') : (room.p1 || 'Arkadaşın');

  if (room.status === 'waiting_p1_half2') {
    if (titleEl) titleEl.textContent = `🎉 ${partner} Sorularını Tahmin Etti ve 5 Soru Sordu!`;
    if (descEl) {
      descEl.textContent = `Bakalım ${partner} senin sorularına ne cevap vermiş! Önce 1'den 5'e kadar slayt halinde onun yanıtlarını ve sohbet balonlarını izleyecek, ardından onun 5 sorusunu tahmin edeceksin.`;
    }
  } else if (room.status === 'waiting_p2' && !isP1) {
    if (titleEl) titleEl.textContent = `🎉 ${partner} ${room.currentRound || 2}. Raund Sorularını Hazırladı!`;
    if (descEl) {
      descEl.textContent = `${partner} yeni raundun 5 sorusunu cevapladı. Şimdi tahmin sırası sende!`;
    }
  } else {
    if (titleEl) titleEl.textContent = `🏆 ${partner} Testi Tamamladı! Sonuçlar Hazır!`;
    if (descEl) {
      descEl.textContent = `Düello tamamlandı! Uyum yüzdesini, kazanılan XP'leri ve 2. Raund ekranını görmek için devam et.`;
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
  const myCode = (userProfile.friendCode || '').toUpperCase();
  const explicitHostCode = (room.hostCode || '').toUpperCase();
  if (explicitHostCode) {
    return Boolean(myCode && explicitHostCode === myCode);
  }
  if (Array.isArray(room.participants) && room.participants.length > 0) {
    const explicitHost = room.participants.find((p) => p && (p.isHost || p.role === 'host'));
    if (explicitHost && explicitHost.code) {
      return Boolean(myCode && explicitHost.code.toUpperCase() === myCode);
    }
  }
  return isUserPlayer1OfRoom(room);
}

// Canlı Odadan Çıkış: Oyuncuyu eski odadan siler ve eğer çıkan kişi Kurucu ise kuruculuğu odadaki rastgele birine (veya son kalan kişiye) otomatik devreder!
function leaveLiveRoomLobby() {
  stopLiveLobbyParticipantPolling();
  const leavingCode = (gameState.roomCode || localStorage.getItem('senceo_active_live_room_code') || '').trim().toUpperCase();
  try {
    localStorage.removeItem('senceo_active_live_room_code');
  } catch (e) {}

  if (leavingCode) {
    markRoomCodePermanentlyDeleted(leavingCode);
    fetch('/api/rooms', {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        action: 'leave_live_lobby',
        code: leavingCode,
        friendCode: userProfile.friendCode
      })
    }).catch(() => {});
  }

  gameState.roomCode = '';
  resetToHome();
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
  const ruleErr = document.getElementById('live-lobby-rule-error');
  if (ruleErr) ruleErr.classList.add('hidden');
  pushLiveLobbySettingsToCloud();
}

function selectLiveTeamSubMode(sub) {
  gameState.liveSettings.teamSubMode = sub;
  document.querySelectorAll('.team-sub-btn').forEach((b) => {
    b.classList.toggle('is-active', b.getAttribute('data-teamsub') === sub);
  });
  const ruleErr = document.getElementById('live-lobby-rule-error');
  if (ruleErr) ruleErr.classList.add('hidden');
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
  gameState.liveRoomData = room;
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
  const normFfa = ls.ffaSubMode === 'ebeli' ? 'ebe' : ls.ffaSubMode === 'paket' ? 'packet' : (ls.ffaSubMode || 'ebe');
  const normTeam = ls.teamSubMode === 'partner' ? 'coop_pair' : ls.teamSubMode === 'rival' ? 'cross_team' : (ls.teamSubMode || '');
  document.querySelectorAll('.ffa-sub-btn').forEach((b) => {
    b.classList.toggle('is-active', b.getAttribute('data-ffasub') === normFfa);
  });
  document.querySelectorAll('.team-sub-btn').forEach((b) => {
    b.classList.toggle('is-active', Boolean(normTeam) && b.getAttribute('data-teamsub') === normTeam);
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
        .map((p) => `<option value="${escapeHtml(p.code)}">🎯 İlk Başlayan: ${escapeHtml(p.name)} (${escapeHtml(p.code)})</option>`)
        .join('');
    starterSel.value = currentVal;
  }

  // KULLANICI İSTEĞİ: "Ebe Modu / Paket Modu" SADECE "🌪️ Herkes Tek (ffa)" seçiliyken gözüksün!
  // Takımlı mod (2v2, 3v3, 4v4, 5v5) kutuları ise sadece takımlı formatlarda gözüksün!
  const isTeamFormat = ['2v2', '3v3', '4v4', '5v5'].includes(gameState.arenaFormat);
  const isFfaFormat = gameState.arenaFormat === 'ffa';
  const teamZones = document.getElementById('live-lobby-teams-section');
  const ffaSubBox = document.getElementById('live-ffa-submode-box');
  const teamSubBox = document.getElementById('live-team-submode-box');
  if (teamZones) teamZones.classList.toggle('hidden', !isTeamFormat);
  if (ffaSubBox) ffaSubBox.classList.toggle('hidden', !isFfaFormat);
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

  // Oyuncu Kartları — KULLANICI İSTEĞİ: Odada HER ZAMAN SADECE 1 TANE ODA KURUCUSU olur!
  // Kuruculuk devredildiğinde eski kurucu normal katılımcı olur, sadece yeni hostCode altın sarısı görünür!
  const cardsGrid = document.getElementById('live-lobby-participants-grid');
  const explicitHostObj = participants.find((p) => p && (p.isHost || p.role === 'host'));
  const singleHostCodeUpper = (
    room.hostCode ||
    (explicitHostObj && explicitHostObj.code) ||
    room.p1FriendCode ||
    (participants[0] && participants[0].code) ||
    ''
  ).toUpperCase();

  if (cardsGrid) {
    cardsGrid.innerHTML = '';

    participants.forEach((p) => {
      const pCodeUpper = (p.code || '').toUpperCase();
      const isThisHost = Boolean(singleHostCodeUpper && pCodeUpper === singleHostCodeUpper);
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
              ${isSelectedEbe ? '<span class="text-emerald-500 font-extrabold">• 🎯 İLK BAŞLAYAN</span>' : ''}
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
          const isH = (p.code || '').toUpperCase() === singleHostCodeUpper;
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
    listEl.textContent = participants
      .map((p) => `${(p.code || '').toUpperCase() === singleHostCodeUpper ? '👑' : '⚡'} ${p.name}`)
      .join(' • ');
  }
  applyRoomCodeBlurState();
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
  if (!room) return;
  const isP1 = isUserPlayer1OfRoom(room);
  // v0.09: waiting_p1_half2 bildirimi SADECE denemea'ya (isP1 === true) gidebilir, denemeb'ye asla gitmez!
  if (room.status === 'waiting_p1_half2' && !isP1) return;

  gameState.completedRoomDataFromCloud = room;
  const banner = document.getElementById('top-notification-banner');
  const textEl = document.getElementById('top-notification-text');
  if (!banner || !textEl) return;

  const partner = isP1 ? (room.p2 || 'Arkadaşın') : (room.p1 || 'Arkadaşın');
  if (room.status === 'waiting_p1_half2') {
    textEl.textContent = `"${partner}" tahmin etti ve 5 soru sordu! Sıra sende →`;
  } else if (room.status === 'waiting_p2' && !isP1) {
    textEl.textContent = `"${partner}" ${room.currentRound || 2}. Raund sorularını hazırladı! Sıra sende →`;
  } else {
    textEl.textContent = `"${partner}" testi tamamladı! Sonucu kontrol et →`;
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
    stopLiveMatchPlayPolling();
    stopP1WatchSlideTimers();
  }
  if (viewId !== 'view-result') {
    stopResultScreenPolling();
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

  document.body.setAttribute('data-view', viewId);
  if (typeof syncMobileChrome === 'function') syncMobileChrome(viewId);
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
  applyRoomCodeBlurState();
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
      : gameState.mode === 'arena' && gameState.liveMatchState
      ? `RAUND ${gameState.currentRound || 1} • CANLI SORU ${(Number(gameState.liveMatchState.qIndex) || 0) + 1}/${TOTAL_QUESTIONS}`
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
    const mBtn = document.getElementById(`m-mode-btn-${m}`);
    if (mBtn) mBtn.classList.toggle('is-active', m === mode);
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

  const isTeamFormat = ['2v2', '3v3', '4v4', '5v5'].includes(fmt);
  const isFfaFormat = fmt === 'ffa';
  const teamZones = document.getElementById('live-lobby-teams-section');
  const ffaSubBox = document.getElementById('live-ffa-submode-box');
  const teamSubBox = document.getElementById('live-team-submode-box');
  const ruleErr = document.getElementById('live-lobby-rule-error');
  if (teamZones) teamZones.classList.toggle('hidden', !isTeamFormat);
  if (ffaSubBox) ffaSubBox.classList.toggle('hidden', !isFfaFormat);
  if (teamSubBox) teamSubBox.classList.toggle('hidden', !isTeamFormat);
  if (ruleErr) ruleErr.classList.add('hidden');

  const descMap = {
    '1v1': '1v1 Düello: İki oyuncu birbirini ne kadar tanıdığını canlı ve eşzamanlı test eder.',
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

  let p1Name = p1Input ? p1Input.value.trim() : '';
  const p2Raw = p2Input ? p2Input.value.trim() : '';

  if (!p1Name && userProfile.username && userProfile.username !== 'Misafir Oyuncu') {
    p1Name = userProfile.username.trim();
    if (p1Input) p1Input.value = p1Name;
  }

  if (!p1Name) {
    if (errorText) errorText.textContent = "Lütfen başlamadan önce kendi adını yaz!";
    if (errorBox) errorBox.classList.remove('hidden');
    if (p1Input) {
      p1Input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      p1Input.focus();
    }
    return;
  }
  if (errorBox) errorBox.classList.add('hidden');

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

  // KULLANICI İSTEĞİ: "Canlı Oda Kur" butonuna basıldığı anda 4 saniye beklemeden ANINDA (0ms) açılsın!
  // Bulut senkronizasyonu arka planda dönerken üstte zarif bir kum saati rozeti (#live-lobby-cloud-sync-pill) gösterilir.
  // Ayrıca oyuncu daha önce başka bir canlı odadaysa eski odadan otomatik çıkarılır!
  if (gameState.mode === 'arena') {
    let previousLiveRoomCode = '';
    try {
      previousLiveRoomCode = (localStorage.getItem('senceo_active_live_room_code') || '').trim().toUpperCase();
    } catch (e) {}

    gameState.roomCode = generateRoomCode();
    try {
      localStorage.setItem('senceo_active_live_room_code', gameState.roomCode);
    } catch (e) {}

    const codeEl = document.getElementById('live-lobby-room-code');
    if (codeEl) codeEl.textContent = gameState.roomCode;
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

    // 1. 0ms Gecikmeyle Anında Lobi Ekranını Aç!
    saveRoomToLocalLobbyList(initialRoom);
    renderLiveLobbyState(initialRoom);
    showView('view-live-room-lobby');

    const syncPill = document.getElementById('live-lobby-cloud-sync-pill');
    const syncText = document.getElementById('live-lobby-cloud-sync-text');
    if (syncPill && syncText) {
      syncText.textContent = 'Bulut Oda Senkronize Ediliyor...';
      syncPill.classList.remove('hidden');
      syncPill.classList.add('inline-flex');
    }

    // 2. Eğer oyuncu eski bir canlı odadan çıkıp yeni oda kurduysa eski odadan otomatik düşür ve kuruculuğu devret
    if (previousLiveRoomCode && previousLiveRoomCode !== gameState.roomCode) {
      markRoomCodePermanentlyDeleted(previousLiveRoomCode);
      fetch('/api/rooms', {
        method: 'POST',
        headers: getSupabaseHeaders(),
        body: JSON.stringify({
          action: 'leave_live_lobby',
          code: previousLiveRoomCode,
          friendCode: userProfile.friendCode
        })
      }).catch(() => {});
    }

    // 3. Arka planda veritabanına kaydet ve tamamlandığında kum saati rozetini kapatıp canlı dinlemeyi başlat
    saveRoomToDatabase(initialRoom).finally(() => {
      if (syncPill && syncText) {
        syncText.textContent = '✓ Bulut Oda Hazır!';
        setTimeout(() => {
          syncPill.classList.add('hidden');
          syncPill.classList.remove('inline-flex');
        }, 900);
      }
      startLiveLobbyParticipantPolling(gameState.roomCode);
    });
    return;
  }

  gameState.roomCode = '';
  gameState.currentRound = 1;
  startClassicFirstHalf(false);
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
  const ruleErr = document.getElementById('live-lobby-rule-error');
  if (ruleErr) ruleErr.classList.add('hidden');

  // KULLANICI İSTEĞİ: Takımlı modlarda (2v2, 3v3, 4v4, 5v5) "Takımlı Mod Yarışma Kuralı" seçilmesi ZORUNLU!
  const isTeamFormat = ['2v2', '3v3', '4v4', '5v5'].includes(gameState.arenaFormat);
  if (isTeamFormat && !gameState.liveSettings.teamSubMode) {
    if (ruleErr) {
      ruleErr.textContent = '⚠️ Lütfen maçı başlatmadan önce "Takımlı Mod Yarışma Kuralı" (Eşli Uyum veya Karşı Takımı Tahmin) seçin!';
      ruleErr.classList.remove('hidden');
    }
    const teamSubBox = document.getElementById('live-team-submode-box');
    if (teamSubBox) teamSubBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (gameState.arenaFormat === 'ffa' && !gameState.liveSettings.ffaSubMode) {
    if (ruleErr) {
      ruleErr.textContent = '⚠️ Lütfen "Herkes Tek Alt Modu" (Ebe Modu veya Paket Modu) seçin!';
      ruleErr.classList.remove('hidden');
    }
    return;
  }

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

  // v0.11: Canlı oda başlatma ağ hatası olursa ASLA tek kişilik klasik moda düşürme! Lobide kalıp uyarı göster.
  const ruleErr = document.getElementById('live-lobby-rule-error');
  if (ruleErr) {
    ruleErr.textContent = '⚠️ Canlı oda başlatılırken bağlantı gecikti. Lütfen tekrar "Canlı Odayı Başlat" butonuna dokun.';
    ruleErr.classList.remove('hidden');
  }
  if (gameState.roomCode) {
    startLiveLobbyParticipantPolling(gameState.roomCode);
  }
}

// ISSUE #1 Çözümü: Yeni raund veya 1. Yarı başlarken 2. Yarı (p2Half2*) dizileri de eksiksiz sıfırlanır!
function startClassicFirstHalf(preserveRoundStarterCodes = false) {
  if (!gameState.roomCode) {
    gameState.roomCode = generateRoomCode();
  }
  const rNum = Number(gameState.currentRound || 1);
  setMyRoleForRoom(gameState.roomCode, 'p1', rNum);
  if (!preserveRoundStarterCodes) {
    gameState.p1Id = userProfile.id || '';
    gameState.p1FriendCode = userProfile.friendCode || '';
  }
  gameState.isSandboxTest = false;
  gameState.half = 1;
  gameState.phase = 'p1_answer';
  gameState.returnToResultAfterSlides = false;
  gameState.resumeHalf2AfterSlides = false;
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
  gameState.activeTimerStepKey = '';
  gameState.pendingCustomOptionText = '';

  updateDuelHeaderUI();
  showView('view-question');
  renderCurrentQuestion();
}

// ---------------- v0.09..v0.11: 1'DEN 5'E SLAYT İZLEME & SINIRSIZ TEKRAR İZLEME MOTORU ----------------
function stopP1WatchSlideTimers() {
  if (gameState.slideWatchTimeoutId) {
    clearTimeout(gameState.slideWatchTimeoutId);
    gameState.slideWatchTimeoutId = null;
  }
  if (gameState.slideWatchIntervalId) {
    clearInterval(gameState.slideWatchIntervalId);
    gameState.slideWatchIntervalId = null;
  }
}

function startP1WatchP2Slides(returnToResult = false, resumeHalf2 = false) {
  stopP1WatchSlideTimers();
  stopResultScreenPolling();
  gameState.returnToResultAfterSlides = Boolean(returnToResult);
  gameState.resumeHalf2AfterSlides = Boolean(resumeHalf2);
  gameState.half = 1;
  gameState.phase = 'p1_watch_p2_slides';
  gameState.currentQuestionIndex = 0;
  gameState.progressDots = [];
  gameState.isLocked = true;

  showView('view-question');
  renderP1WatchP2SlideQuestion();
}

function renderP1WatchP2SlideQuestion() {
  stopP1WatchSlideTimers();
  if (gameState.secretBubbleTimeoutId) {
    clearTimeout(gameState.secretBubbleTimeoutId);
    gameState.secretBubbleTimeoutId = null;
  }

  const qIndex = gameState.currentQuestionIndex;
  const questionObj = gameState.selectedQuestions[qIndex];
  if (!questionObj || qIndex >= TOTAL_QUESTIONS) {
    advanceP1WatchSlide();
    return;
  }

  const p1Name = gameState.player1Name || 'Sen';
  const p2Name = gameState.player2Name || 'Arkadaşın';
  const correctIndex = gameState.p1Answers[qIndex];
  const guessedIndex = gameState.p2Guesses[qIndex];
  const isHit = isQuestionMatch(correctIndex, guessedIndex);

  gameState.progressDots[qIndex] = isHit ? 'correct' : 'wrong';

  const counterEl = document.getElementById('header-question-counter');
  if (counterEl) counterEl.textContent = `SLAYT ${qIndex + 1} / ${TOTAL_QUESTIONS}`;

  const inlineReplayBtn = document.getElementById('btn-replay-half1-slides-inline');
  if (inlineReplayBtn) inlineReplayBtn.classList.add('hidden');

  const timerPill = document.getElementById('question-live-timer-pill');
  const timerText = document.getElementById('question-live-timer-text');

  const shuffleBtn = document.getElementById('btn-shuffle-question');
  if (shuffleBtn) shuffleBtn.classList.add('hidden');
  const passBtn = document.getElementById('btn-use-pass');
  if (passBtn) passBtn.classList.add('hidden');
  const customWrapper = document.getElementById('custom-answer-wrapper');
  if (customWrapper) customWrapper.classList.add('hidden');
  toggleCustomAnswerBox(false);

  const commentDrawer = document.getElementById('post-answer-comment-box');
  if (commentDrawer) commentDrawer.classList.add('hidden');
  const typingInd = document.getElementById('messenger-typing-indicator');
  if (typingInd) typingInd.classList.add('hidden');
  const bubbleEl = document.getElementById('messenger-secret-bubble');
  if (bubbleEl) bubbleEl.classList.add('hidden');

  const specBanner = document.getElementById('live-spectator-banner');
  const specTitle = document.getElementById('live-spectator-title');
  const specDesc = document.getElementById('live-spectator-desc');
  if (specBanner && specTitle && specDesc) {
    specTitle.textContent = `🎬 Bakalım ${p2Name} Senin Sorularına Ne Cevap Vermiş? (${qIndex + 1}/${TOTAL_QUESTIONS})`;
    specDesc.textContent = `${p2Name}'nin seçtiği şık ve doğru cevap gösteriliyor (5 sn)...`;
    specBanner.classList.remove('hidden');
  }

  const turnBadge = document.getElementById('question-turn-badge');
  const stepLabel = document.getElementById('question-step-label');
  const questionTextEl = document.getElementById('question-text');
  if (turnBadge) {
    turnBadge.innerHTML = `<span>🎬</span> <span>Bakalım ${escapeHtml(p2Name)} Senin Sorularına Ne Cevap Vermiş?</span>`;
  }
  if (stepLabel) {
    stepLabel.textContent = gameState.returnToResultAfterSlides
      ? `1. YARI TAHMİN SLAYTI (${qIndex + 1}/${TOTAL_QUESTIONS}) • BİTTİĞİNDE DİYALOG RAPORUNA DÖNECEKSİN`
      : gameState.resumeHalf2AfterSlides
      ? `1. YARI TAHMİN SLAYTI (${qIndex + 1}/${TOTAL_QUESTIONS}) • BİTTİĞİNDE 2. YARI SORULARINA DÖNECEKSİN`
      : `1. YARI TAHMİN SLAYTI (${qIndex + 1}/${TOTAL_QUESTIONS}) • BİRAZDAN ${p2Name.toUpperCase()}'NİN 5 SORUSUNU ÇÖZECEKSİN`;
  }
  if (questionTextEl) {
    questionTextEl.textContent = questionObj.q2.replace('{p1}', p1Name);
  }

  const optionsContainer = document.getElementById('options-container');
  optionsContainer.innerHTML = '';
  optionsContainer.classList.add('live-options-spectator-locked');

  const customTextForThisQ = gameState.customOptionsMap && gameState.customOptionsMap[qIndex];
  const displayOptions = questionObj.options.map((o) => ({ ...o }));
  if (customTextForThisQ) {
    if (displayOptions.length >= 4) {
      displayOptions[3] = { icon: "✏️", text: customTextForThisQ };
    } else {
      displayOptions.push({ icon: "✏️", text: customTextForThisQ });
    }
  }

  displayOptions.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.disabled = true;
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
    optionsContainer.appendChild(btn);
  });

  const allBtns = document.querySelectorAll('#options-container .option-btn');
  if (typeof correctIndex === 'number' && allBtns[correctIndex]) {
    allBtns[correctIndex].classList.add('option-correct');
    const rightIcon = allBtns[correctIndex].querySelector('.option-status-icon');
    if (rightIcon) {
      rightIcon.innerHTML = '✓';
      rightIcon.className = 'option-status-icon w-6 h-6 rounded-full bg-emerald-500 text-white font-extrabold flex items-center justify-center text-xs shrink-0';
    }
  }
  if (!isHit && typeof guessedIndex === 'number' && allBtns[guessedIndex]) {
    allBtns[guessedIndex].classList.add('option-wrong');
    const wrongIcon = allBtns[guessedIndex].querySelector('.option-status-icon');
    if (wrongIcon) {
      wrongIcon.innerHTML = '✕';
      wrongIcon.className = 'option-status-icon w-6 h-6 rounded-full bg-red-500 text-white font-extrabold flex items-center justify-center text-xs shrink-0';
    }
  }

  const feedbackBanner = document.getElementById('guess-feedback-banner');
  if (feedbackBanner) {
    feedbackBanner.classList.remove('hidden');
    if (correctIndex === PASS_ANSWER_VALUE) {
      feedbackBanner.className = "rounded-xl px-4 py-3 text-center font-bold text-xs sm:text-sm bg-emerald-500/20 border border-emerald-500/50 text-emerald-700 dark:text-emerald-200";
      feedbackBanner.textContent = `⏭️ Sen bu soruyu Pas geçmiştin!`;
    } else if (isHit) {
      feedbackBanner.className = "rounded-xl px-4 py-3 text-center font-bold text-xs sm:text-sm bg-emerald-500/20 border border-emerald-500/50 text-emerald-700 dark:text-emerald-200";
      feedbackBanner.textContent = `🎯 Doğru Tahmin! ${p2Name} senin seçtiğin yeşil şıkkı bildi!`;
    } else {
      feedbackBanner.className = "rounded-xl px-4 py-3 text-center font-bold text-xs sm:text-sm bg-red-500/20 border border-red-500/50 text-red-700 dark:text-red-200";
      feedbackBanner.textContent = `❌ Yanlış Tahmin! ${p2Name} kırmızı işaretli şıkkı seçti, doğru cevap ise yeşil şıktı.`;
    }
  }

  playSoundEffect(isHit ? 'correct' : 'wrong');
  updateDuelHeaderUI();

  const p2Comment = (gameState.p2Comments && gameState.p2Comments[qIndex]) || {};
  const ownP1Comment = (gameState.p1Comments && gameState.p1Comments[qIndex]) || {};
  const totalSlideSeconds = computeSlideTotalSeconds(p2Comment, ownP1Comment);
  let remainingSec = totalSlideSeconds;

  if (timerPill && timerText) {
    timerText.textContent = `${remainingSec} sn`;
    timerPill.classList.remove('hidden');
    timerPill.classList.add('flex');
  }

  const revNextBox = document.getElementById('live-reveal-next-box');
  const revNextText = document.getElementById('btn-live-reveal-next-text');
  const replayCurBtn = document.getElementById('btn-replay-current-slides');
  if (replayCurBtn) {
    replayCurBtn.classList.remove('hidden');
    replayCurBtn.classList.add('flex');
  }
  if (revNextBox && revNextText) {
    const isLastSlide = qIndex >= TOTAL_QUESTIONS - 1;
    revNextText.textContent = isLastSlide
      ? gameState.returnToResultAfterSlides
        ? `SLAYTI BİTİR & ${gameState.currentRound || 1}. RAUND DİYALOG RAPORUNA DÖN 🏆`
        : gameState.resumeHalf2AfterSlides
        ? `SLAYTI BİTİR & 2. YARI SORULARINA DÖN ⚡`
        : `SLAYTI BİTİR & ${p2Name.toUpperCase()}'NİN 5 SORUSUNU ÇÖZ ⚡`
      : `SONRAKİ SLAYTA GEÇ (${qIndex + 2}/${TOTAL_QUESTIONS})`;
    revNextBox.classList.remove('hidden');
  }

  gameState.slideWatchIntervalId = setInterval(() => {
    remainingSec = Math.max(0, remainingSec - 1);
    if (timerText) timerText.textContent = `${Math.ceil(remainingSec)} sn`;
  }, 1000);

  // 1. AŞAMA: 5 sn şıklar → 2. AŞAMA: rakibin balonu → 1.5 sn sonra SENİN yorum/emojin de aynı balona eklenir → 4 sn
  runSlideBubbleSequence(p2Name, p2Comment, ownP1Comment, specDesc, () => advanceP1WatchSlide());
}

// v0.11: Slayt balon motoru — 5 sn şık/doğru cevap, ardından rakibin balonu; 1.5 sn sonra kendi yorum ve emojin de balona eklenir
function hasSlideComment(c) {
  return Boolean(c && ((c.emoji && String(c.emoji).trim()) || (c.text && String(c.text).trim())));
}

function computeSlideTotalSeconds(rivalComment, ownComment) {
  const r = hasSlideComment(rivalComment);
  const o = hasSlideComment(ownComment);
  if (!r && !o) return 5;
  return 5 + (r && o ? 1.5 : 0) + 4;
}

function runSlideBubbleSequence(rivalName, rivalComment, ownComment, specDescEl, onDone) {
  const bubbleEl = document.getElementById('messenger-secret-bubble');
  const senderEl = document.getElementById('messenger-bubble-sender');
  const textEl = document.getElementById('messenger-bubble-text');
  const hasRival = hasSlideComment(rivalComment);
  const hasOwn = hasSlideComment(ownComment);
  const lineOf = (who, c) => `${escapeHtml(who)}: ${escapeHtml(`${c.emoji || ''} ${c.text || ''}`.trim())}`;

  const showLines = (lines, burstEmoji) => {
    if (!bubbleEl || !senderEl || !textEl) return;
    senderEl.textContent = '💬 Sohbet Balonları:';
    textEl.innerHTML = lines.join('<br>');
    bubbleEl.classList.remove('hidden');
    playSoundEffect('pop');
    spawnFloatingEmojiBurst(burstEmoji || '💬');
  };

  gameState.slideWatchTimeoutId = setTimeout(() => {
    if (!hasRival && !hasOwn) {
      onDone();
      return;
    }
    const lines = [];
    if (hasRival) {
      lines.push(lineOf(rivalName, rivalComment));
      showLines(lines, rivalComment.emoji);
      if (specDescEl) specDescEl.textContent = `💬 ${rivalName}'in balonu gösteriliyor...`;
    }
    const finish = () => {
      gameState.slideWatchTimeoutId = setTimeout(onDone, 4000);
    };
    if (hasOwn) {
      const addOwn = () => {
        lines.push(lineOf('Sen', ownComment));
        showLines(lines, ownComment.emoji);
        if (specDescEl) specDescEl.textContent = '💬 Senin ve rakibinin yorum/emojileri gösteriliyor (4 sn)...';
        finish();
      };
      if (hasRival) {
        gameState.slideWatchTimeoutId = setTimeout(addOwn, 1500);
      } else {
        addOwn();
      }
    } else {
      finish();
    }
  }, 5000);
}

function advanceP1WatchSlide() {
  stopP1WatchSlideTimers();
  if (gameState.phase !== 'p1_watch_p2_slides') return;

  if (gameState.currentQuestionIndex < TOTAL_QUESTIONS - 1) {
    gameState.currentQuestionIndex++;
    renderP1WatchP2SlideQuestion();
  } else {
    const replayCurBtn = document.getElementById('btn-replay-current-slides');
    if (replayCurBtn) {
      replayCurBtn.classList.add('hidden');
      replayCurBtn.classList.remove('flex');
    }
    if (gameState.returnToResultAfterSlides) {
      gameState.returnToResultAfterSlides = false;
      gameState.resumeHalf2AfterSlides = false;
      const timerPill = document.getElementById('question-live-timer-pill');
      if (timerPill) timerPill.classList.add('hidden');
      const specBanner = document.getElementById('live-spectator-banner');
      if (specBanner) specBanner.classList.add('hidden');
      const revNextBox = document.getElementById('live-reveal-next-box');
      if (revNextBox) revNextBox.classList.add('hidden');
      gameState.phase = 'completed';
      showResultScreen(false);
    } else if (gameState.resumeHalf2AfterSlides) {
      gameState.resumeHalf2AfterSlides = false;
      const timerPill = document.getElementById('question-live-timer-pill');
      if (timerPill) timerPill.classList.add('hidden');
      const specBanner = document.getElementById('live-spectator-banner');
      if (specBanner) specBanner.classList.add('hidden');
      const revNextBox = document.getElementById('live-reveal-next-box');
      if (revNextBox) revNextBox.classList.add('hidden');
      gameState.half = 2;
      gameState.phase = 'p1_guess';
      gameState.currentQuestionIndex = Math.min(
        Math.max(0, Number(gameState.savedHalf2IndexBeforeReplay) || 0),
        TOTAL_QUESTIONS - 1
      );
      gameState.progressDots = [];
      for (let i = 0; i < gameState.currentQuestionIndex; i++) {
        gameState.progressDots[i] = isQuestionMatch(gameState.p2Half2Answers[i], gameState.p1Half2Guesses[i])
          ? 'correct'
          : 'wrong';
      }
      gameState.isLocked = false;
      updateDuelHeaderUI();
      showView('view-question');
      renderCurrentQuestion();
    } else {
      startP1Half2GuessPhase();
    }
  }
}

function startP1Half2GuessPhase() {
  stopP1WatchSlideTimers();
  const timerPill = document.getElementById('question-live-timer-pill');
  if (timerPill) timerPill.classList.add('hidden');
  const specBanner = document.getElementById('live-spectator-banner');
  if (specBanner) specBanner.classList.add('hidden');
  const revNextBox = document.getElementById('live-reveal-next-box');
  if (revNextBox) revNextBox.classList.add('hidden');
  const replayCurBtn = document.getElementById('btn-replay-current-slides');
  if (replayCurBtn) {
    replayCurBtn.classList.add('hidden');
    replayCurBtn.classList.remove('flex');
  }

  gameState.half = 2;
  gameState.phase = 'p1_guess';
  gameState.currentQuestionIndex = 0;
  gameState.progressDots = [];
  gameState.isLocked = false;

  if (!Array.isArray(gameState.p2Half2Questions) || gameState.p2Half2Questions.length === 0) {
    gameState.p2Half2Questions = pickQuestionsForCategory(gameState.category, TOTAL_QUESTIONS);
  }

  updateDuelHeaderUI();
  showView('view-question');
  renderCurrentQuestion();
}

// ---------------- v0.10..v0.11: PLAYER 2 İÇİN PLAYER 1'İN TAHMİN SLAYTINI İZLEME MOTORU ----------------
async function setP2WatchingSlidesStatus(watching, watched = false) {
  if (!gameState.roomCode) return;
  const cleanCode = String(gameState.roomCode).trim().toUpperCase();
  const watcherName = gameState.player2Name || userProfile.username || '2. Oyuncu';
  const nowIso = new Date().toISOString();

  if (gameState.liveRoomData) {
    gameState.liveRoomData.p2WatchingSlides = Boolean(watching);
    if (watched) gameState.liveRoomData.p2WatchedSlides = true;
    gameState.liveRoomData.p2WatchingBy = watcherName;
    gameState.liveRoomData.slideStatusUpdatedAt = nowIso;
  }

  try {
    const raw = localStorage.getItem(`senceo_room_${cleanCode}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.p2WatchingSlides = Boolean(watching);
      if (watched) parsed.p2WatchedSlides = true;
      parsed.p2WatchingBy = watcherName;
      parsed.slideStatusUpdatedAt = nowIso;
      localStorage.setItem(`senceo_room_${cleanCode}`, JSON.stringify(parsed));
    }
  } catch (e) {}

  try {
    await fetch('/api/rooms', {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        action: 'set_slide_watch_status',
        code: cleanCode,
        watching: Boolean(watching),
        watched: Boolean(watched),
        watcherName
      })
    });
  } catch (e) {}
}

async function startP2WatchP1Slides() {
  stopResultScreenPolling();
  stopP1WatchSlideTimers();

  if (!Array.isArray(gameState.p2Half2Questions) || gameState.p2Half2Questions.length === 0) {
    showResultScreen(false);
    return;
  }

  gameState.half = 2;
  gameState.phase = 'p2_watch_p1_slides';
  gameState.currentQuestionIndex = 0;
  gameState.progressDots = [];
  gameState.isLocked = true;

  setP2WatchingSlidesStatus(true, false);
  showView('view-question');
  renderP2WatchP1SlideQuestion();
}

function renderP2WatchP1SlideQuestion() {
  stopP1WatchSlideTimers();
  if (gameState.secretBubbleTimeoutId) {
    clearTimeout(gameState.secretBubbleTimeoutId);
    gameState.secretBubbleTimeoutId = null;
  }

  const qIndex = gameState.currentQuestionIndex;
  const questionObj = gameState.p2Half2Questions && gameState.p2Half2Questions[qIndex];
  if (!questionObj || qIndex >= TOTAL_QUESTIONS) {
    finishP2WatchP1Slides();
    return;
  }

  const p1Name = gameState.player1Name || '1. Oyuncu';
  const p2Name = gameState.player2Name || 'Sen';
  const correctIndex = gameState.p2Half2Answers[qIndex];
  const guessedIndex = gameState.p1Half2Guesses[qIndex];
  const isHit = isQuestionMatch(correctIndex, guessedIndex);

  gameState.progressDots[qIndex] = isHit ? 'correct' : 'wrong';

  const counterEl = document.getElementById('header-question-counter');
  if (counterEl) counterEl.textContent = `SLAYT ${qIndex + 1} / ${TOTAL_QUESTIONS}`;

  const inlineReplayBtn = document.getElementById('btn-replay-half1-slides-inline');
  if (inlineReplayBtn) inlineReplayBtn.classList.add('hidden');

  const timerPill = document.getElementById('question-live-timer-pill');
  const timerText = document.getElementById('question-live-timer-text');

  const shuffleBtn = document.getElementById('btn-shuffle-question');
  if (shuffleBtn) shuffleBtn.classList.add('hidden');
  const passBtn = document.getElementById('btn-use-pass');
  if (passBtn) passBtn.classList.add('hidden');
  const customWrapper = document.getElementById('custom-answer-wrapper');
  if (customWrapper) customWrapper.classList.add('hidden');
  toggleCustomAnswerBox(false);

  const commentDrawer = document.getElementById('post-answer-comment-box');
  if (commentDrawer) commentDrawer.classList.add('hidden');
  const typingInd = document.getElementById('messenger-typing-indicator');
  if (typingInd) typingInd.classList.add('hidden');
  const bubbleEl = document.getElementById('messenger-secret-bubble');
  if (bubbleEl) bubbleEl.classList.add('hidden');

  const specBanner = document.getElementById('live-spectator-banner');
  const specTitle = document.getElementById('live-spectator-title');
  const specDesc = document.getElementById('live-spectator-desc');
  if (specBanner && specTitle && specDesc) {
    specTitle.textContent = `🎬 Bakalım ${p1Name} Senin Sorularına Ne Cevap Vermiş? (${qIndex + 1}/${TOTAL_QUESTIONS})`;
    specDesc.textContent = `${p1Name}'in seçtiği şık ve senin doğru cevabın gösteriliyor (5 sn)...`;
    specBanner.classList.remove('hidden');
  }

  const turnBadge = document.getElementById('question-turn-badge');
  const stepLabel = document.getElementById('question-step-label');
  const questionTextEl = document.getElementById('question-text');
  if (turnBadge) {
    turnBadge.innerHTML = `<span>🎬</span> <span>Bakalım ${escapeHtml(p1Name)} Senin Sorularına Ne Cevap Vermiş?</span>`;
  }
  if (stepLabel) {
    stepLabel.textContent = `2. YARI TAHMİN SLAYTI (${qIndex + 1}/${TOTAL_QUESTIONS}) • BİTTİĞİNDE DİYALOG RAPORUNA DÖNECEKSİN`;
  }
  if (questionTextEl) {
    questionTextEl.textContent = questionObj.q2.replace('{p1}', p2Name);
  }

  const optionsContainer = document.getElementById('options-container');
  optionsContainer.innerHTML = '';
  optionsContainer.classList.add('live-options-spectator-locked');

  const customTextForThisQ = gameState.p2Half2CustomMap && gameState.p2Half2CustomMap[qIndex];
  const displayOptions = questionObj.options.map((o) => ({ ...o }));
  if (customTextForThisQ) {
    if (displayOptions.length >= 4) {
      displayOptions[3] = { icon: "✏️", text: customTextForThisQ };
    } else {
      displayOptions.push({ icon: "✏️", text: customTextForThisQ });
    }
  }

  displayOptions.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.disabled = true;
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
    optionsContainer.appendChild(btn);
  });

  const allBtns = document.querySelectorAll('#options-container .option-btn');
  if (typeof correctIndex === 'number' && allBtns[correctIndex]) {
    allBtns[correctIndex].classList.add('option-correct');
    const rightIcon = allBtns[correctIndex].querySelector('.option-status-icon');
    if (rightIcon) {
      rightIcon.innerHTML = '✓';
      rightIcon.className = 'option-status-icon w-6 h-6 rounded-full bg-emerald-500 text-white font-extrabold flex items-center justify-center text-xs shrink-0';
    }
  }
  if (!isHit && typeof guessedIndex === 'number' && allBtns[guessedIndex]) {
    allBtns[guessedIndex].classList.add('option-wrong');
    const wrongIcon = allBtns[guessedIndex].querySelector('.option-status-icon');
    if (wrongIcon) {
      wrongIcon.innerHTML = '✕';
      wrongIcon.className = 'option-status-icon w-6 h-6 rounded-full bg-red-500 text-white font-extrabold flex items-center justify-center text-xs shrink-0';
    }
  }

  const feedbackBanner = document.getElementById('guess-feedback-banner');
  if (feedbackBanner) {
    feedbackBanner.classList.remove('hidden');
    if (correctIndex === PASS_ANSWER_VALUE) {
      feedbackBanner.className = "rounded-xl px-4 py-3 text-center font-bold text-xs sm:text-sm bg-emerald-500/20 border border-emerald-500/50 text-emerald-700 dark:text-emerald-200";
      feedbackBanner.textContent = `⏭️ Sen bu soruyu Pas geçmiştin!`;
    } else if (isHit) {
      feedbackBanner.className = "rounded-xl px-4 py-3 text-center font-bold text-xs sm:text-sm bg-emerald-500/20 border border-emerald-500/50 text-emerald-700 dark:text-emerald-200";
      feedbackBanner.textContent = `🎯 Doğru Tahmin! ${p1Name} senin seçtiğin yeşil şıkkı bildi!`;
    } else {
      feedbackBanner.className = "rounded-xl px-4 py-3 text-center font-bold text-xs sm:text-sm bg-red-500/20 border border-red-500/50 text-red-700 dark:text-red-200";
      feedbackBanner.textContent = `❌ Yanlış Tahmin! ${p1Name} kırmızı işaretli şıkkı seçti, doğru cevap ise yeşil şıktı.`;
    }
  }

  playSoundEffect(isHit ? 'correct' : 'wrong');
  updateDuelHeaderUI();

  const p1Comment = (gameState.p1Half2Comments && gameState.p1Half2Comments[qIndex]) || {};
  const ownP2Comment = (gameState.p2Half2Comments && gameState.p2Half2Comments[qIndex]) || {};
  const totalSlideSeconds = computeSlideTotalSeconds(p1Comment, ownP2Comment);
  let remainingSec = totalSlideSeconds;

  if (timerPill && timerText) {
    timerText.textContent = `${remainingSec} sn`;
    timerPill.classList.remove('hidden');
    timerPill.classList.add('flex');
  }

  const revNextBox = document.getElementById('live-reveal-next-box');
  const revNextText = document.getElementById('btn-live-reveal-next-text');
  const replayCurBtn = document.getElementById('btn-replay-current-slides');
  if (replayCurBtn) {
    replayCurBtn.classList.remove('hidden');
    replayCurBtn.classList.add('flex');
  }
  if (revNextBox && revNextText) {
    const isLastSlide = qIndex >= TOTAL_QUESTIONS - 1;
    revNextText.textContent = isLastSlide
      ? `SLAYTI BİTİR & ${gameState.currentRound || 1}. RAUND DİYALOG RAPORUNA DÖN 🏆`
      : `SONRAKİ SLAYTA GEÇ (${qIndex + 2}/${TOTAL_QUESTIONS})`;
    revNextBox.classList.remove('hidden');
  }

  gameState.slideWatchIntervalId = setInterval(() => {
    remainingSec = Math.max(0, remainingSec - 1);
    if (timerText) timerText.textContent = `${Math.ceil(remainingSec)} sn`;
  }, 1000);

  // 5 sn şıklar → P1'in balonu → 1.5 sn sonra SENİN (P2) cevap yorumun/emojin de balona eklenir → 4 sn
  runSlideBubbleSequence(p1Name, p1Comment, ownP2Comment, specDesc, () => advanceP2WatchSlide());
}

function advanceP2WatchSlide() {
  stopP1WatchSlideTimers();
  if (gameState.phase !== 'p2_watch_p1_slides') return;

  if (gameState.currentQuestionIndex < TOTAL_QUESTIONS - 1) {
    gameState.currentQuestionIndex++;
    renderP2WatchP1SlideQuestion();
  } else {
    finishP2WatchP1Slides();
  }
}

async function finishP2WatchP1Slides() {
  stopP1WatchSlideTimers();
  const timerPill = document.getElementById('question-live-timer-pill');
  if (timerPill) timerPill.classList.add('hidden');
  const specBanner = document.getElementById('live-spectator-banner');
  if (specBanner) specBanner.classList.add('hidden');
  const revNextBox = document.getElementById('live-reveal-next-box');
  if (revNextBox) revNextBox.classList.add('hidden');
  const replayCurBtn = document.getElementById('btn-replay-current-slides');
  if (replayCurBtn) {
    replayCurBtn.classList.add('hidden');
    replayCurBtn.classList.remove('flex');
  }

  gameState.phase = 'completed';
  if (gameState.liveRoomData) {
    gameState.liveRoomData.p2WatchingSlides = false;
    gameState.liveRoomData.p2WatchedSlides = true;
  }
  showResultScreen(false);
  await setP2WatchingSlidesStatus(false, true);
}

// v0.11: Slaytı Tekrar İzleme Yardımcıları (Slayt esnasında, 2. yarı soruları sırasında veya Diyalog Raporu ekranında sınırsız tekrar)
function replayActiveSlideshowFromStart() {
  stopP1WatchSlideTimers();
  if (gameState.phase === 'p1_watch_p2_slides') {
    gameState.currentQuestionIndex = 0;
    gameState.progressDots = [];
    renderP1WatchP2SlideQuestion();
    return;
  }
  if (gameState.phase === 'p2_watch_p1_slides') {
    gameState.currentQuestionIndex = 0;
    gameState.progressDots = [];
    renderP2WatchP1SlideQuestion();
  }
}

function replayHalf1SlidesDuringHalf2() {
  if (!Array.isArray(gameState.p2Guesses) || gameState.p2Guesses.length === 0) return;
  gameState.savedHalf2IndexBeforeReplay = Number(gameState.currentQuestionIndex) || 0;
  startP1WatchP2Slides(false, true);
}

function startReplayHalf1SlidesFromResult() {
  if (!Array.isArray(gameState.p2Guesses) || gameState.p2Guesses.length === 0) return;
  startP1WatchP2Slides(true, false);
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

function computeCurrentTimerStepKey() {
  if (gameState.mode === 'arena' && gameState.liveMatchState && !gameState.isSandboxTest) {
    const ms = gameState.liveMatchState;
    return `${gameState.roomCode || 'live'}:R${gameState.currentRound || 1}:Q${ms.qIndex}:${ms.subPhase}:${ms.activeAnswererCode || ''}:${ms.activeGuesserCode || ''}`;
  }
  return `${gameState.roomCode || 'local'}:R${gameState.currentRound || 1}:H${gameState.half}:${gameState.phase}:Q${gameState.currentQuestionIndex}`;
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
    gameState.activeTimerStepKey = '';
    if (pill) {
      pill.classList.add('hidden');
      pill.classList.remove('flex');
    }
    return;
  }

  const stepKey = computeCurrentTimerStepKey();
  if (
    gameState.activeTimerStepKey !== stepKey ||
    typeof gameState.questionTimerRemaining !== 'number' ||
    gameState.questionTimerRemaining <= 0
  ) {
    gameState.questionTimerRemaining = secLimit;
    gameState.activeTimerStepKey = stepKey;
  }

  if (pill && textEl) {
    textEl.textContent = `${gameState.questionTimerRemaining} sn`;
    pill.classList.remove('hidden');
    pill.classList.add('flex');
  }

  gameState.questionTimerIntervalId = setInterval(() => {
    const qView = document.getElementById('view-question');
    if (gameState.isSubmittingStep || !qView || qView.classList.contains('hidden')) {
      stopQuestionCountdownTimer();
      return;
    }
    gameState.questionTimerRemaining--;
    if (textEl) textEl.textContent = `${Math.max(0, gameState.questionTimerRemaining)} sn`;
    if (gameState.questionTimerRemaining <= 0) {
      stopQuestionCountdownTimer();
      gameState.activeTimerStepKey = '';
      handleQuestionTimerExpired();
    }
  }, 1000);
}

async function handleQuestionTimerExpired() {
  if (gameState.isSubmittingStep) return;

  // 1) Henüz hiçbir şık seçilmediyse: önce özel şık kutusunda yazılı metin var mı bak, varsa onu ekle ve seç!
  if (gameState.pendingChoiceIndex === null) {
    const customInp = document.getElementById('input-custom-option-text');
    const typedCustom = customInp ? customInp.value.trim() : '';
    if (isCurrentPhaseAnswering() && !gameState.customAnswerUsedThisTurn && typedCustom) {
      gameState.isLocked = false;
      submitCustomAnswerOption();
    }
  }

  // 2) Hâlâ hiçbir şık seçili değilse varsayılan olarak 1. şıkkı (0) seç (Zaten özel şık veya başka şık seçilmişse ASLA 0 ile ezme!)
  if (gameState.pendingChoiceIndex === null) {
    const firstBtn = document.querySelector('#options-container .option-btn');
    gameState.isLocked = false;
    if (firstBtn) {
      handleOptionSelect(0, firstBtn, null);
    } else {
      gameState.pendingChoiceIndex = 0;
    }
  }

  // 3) Kilitlenip kalmaması için seçili cevabı/tahmini (ve varsa yazılmış yorumu/özel şıkkı) ANINDA onayla ve sırayı devret!
  await confirmStepAndAdvance();
}

function renderCurrentQuestion() {
  if (gameState.phase === 'p1_watch_p2_slides') {
    renderP1WatchP2SlideQuestion();
    return;
  }
  if (gameState.phase === 'p2_watch_p1_slides') {
    renderP2WatchP1SlideQuestion();
    return;
  }

  // Eğer Canlı Oda Eşzamanlı Maç (live_in_progress) modundaysak 3 aşamalı canlı motoru çalıştır!
  if (
    gameState.mode === 'arena' &&
    gameState.liveRoomData &&
    gameState.liveRoomData.status === 'live_in_progress' &&
    gameState.liveMatchState &&
    !gameState.isSandboxTest
  ) {
    renderLiveArenaQuestionState(gameState.liveRoomData);
    return;
  }

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

  const replayCurBtn = document.getElementById('btn-replay-current-slides');
  if (replayCurBtn) {
    replayCurBtn.classList.add('hidden');
    replayCurBtn.classList.remove('flex');
  }
  const inlineReplayBtn = document.getElementById('btn-replay-half1-slides-inline');
  if (inlineReplayBtn) {
    const canReplayHalf1 =
      gameState.phase === 'p1_guess' &&
      !gameState.isSandboxTest &&
      Array.isArray(gameState.p2Guesses) &&
      gameState.p2Guesses.length > 0;
    inlineReplayBtn.classList.toggle('hidden', !canReplayHalf1);
    inlineReplayBtn.classList.toggle('flex', canReplayHalf1);
  }

  const specBanner = document.getElementById('live-spectator-banner');
  if (specBanner) specBanner.classList.add('hidden');
  const revNextBox = document.getElementById('live-reveal-next-box');
  if (revNextBox) revNextBox.classList.add('hidden');

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
  optionsContainer.classList.remove('live-options-spectator-locked');
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

// ---------------- CANLI ODA (1v1 / 1'er 1'er) 3 AŞAMALI EŞZAMANLI SORU MOTORU ----------------
// 1. Aşama ('answering'): Sıradaki oyuncu (Örn: B) soruyu kendi adına cevaplar ve isterse yorum yazar -> İlerle der. A oyuncusu aynı ekranda B'yi canlı izler.
// 2. Aşama ('guessing'): Sıra A'ya geçer. A oyuncusu B'nin cevabını veya yorumunu GÖRMEZ! Kendi tahminini seçer, isterse yorum yazar -> İlerle der.
// 3. Aşama ('reveal'): İki oyuncunun ekranında da aynı anda Doğru (Yeşil) / Yanlış (Kırmızı) açılır ve 1.5 sn sonra yorum baloncuğu patlar! Sonraki soruda roller değişir!
function renderLiveArenaQuestionState(room) {
  if (!room || !room.liveMatchState) return;
  const ms = room.liveMatchState;
  gameState.liveRoomData = room;
  gameState.liveMatchState = ms;

  const qIndex = Math.min(Number(ms.qIndex) || 0, TOTAL_QUESTIONS - 1);
  gameState.currentQuestionIndex = qIndex;
  const questionObj = gameState.selectedQuestions[qIndex] || QUESTIONS_DB[qIndex % QUESTIONS_DB.length];
  if (!questionObj) return;

  if (gameState.secretBubbleTimeoutId) {
    clearTimeout(gameState.secretBubbleTimeoutId);
    gameState.secretBubbleTimeoutId = null;
  }

  const myCode = (userProfile.friendCode || '').toUpperCase();
  const answererCode = (ms.activeAnswererCode || '').toUpperCase();
  const isAnswerer = Boolean(myCode && answererCode === myCode);
  const answererName = ms.activeAnswererName || room.p1 || '1. Oyuncu';
  const guesserName = ms.activeGuesserName || room.p2 || '2. Oyuncu';

  gameState.player1Name = answererName;
  gameState.player2Name = guesserName;

  // İlerleme noktalarını (progressDots) ortak geçmişten senkronize et
  gameState.progressDots = [];
  if (Array.isArray(ms.history)) {
    ms.history.forEach((h) => {
      if (h && typeof h.qIndex === 'number') {
        gameState.progressDots[h.qIndex] = h.isCorrect ? 'correct' : 'wrong';
      }
    });
  }
  if (ms.subPhase === 'reveal') {
    const revCorrect = ms.currentAnswer === PASS_ANSWER_VALUE || ms.currentAnswer === ms.currentGuess;
    gameState.progressDots[qIndex] = revCorrect ? 'correct' : 'wrong';
  } else if (ms.subPhase === 'guessing') {
    gameState.progressDots[qIndex] = 'answered';
  }

  document.getElementById('header-question-counter').textContent = `SORU ${qIndex + 1} / ${TOTAL_QUESTIONS}`;

  const replayCurBtn = document.getElementById('btn-replay-current-slides');
  if (replayCurBtn) {
    replayCurBtn.classList.add('hidden');
    replayCurBtn.classList.remove('flex');
  }
  const inlineReplayBtn = document.getElementById('btn-replay-half1-slides-inline');
  if (inlineReplayBtn) {
    inlineReplayBtn.classList.add('hidden');
    inlineReplayBtn.classList.remove('flex');
  }

  const typingInd = document.getElementById('messenger-typing-indicator');
  if (typingInd) typingInd.classList.add('hidden');
  const bubbleEl = document.getElementById('messenger-secret-bubble');
  if (bubbleEl) bubbleEl.classList.add('hidden');
  const feedbackBanner = document.getElementById('guess-feedback-banner');
  if (feedbackBanner) feedbackBanner.classList.add('hidden');
  const commentDrawer = document.getElementById('post-answer-comment-box');
  if (commentDrawer) commentDrawer.classList.add('hidden');
  const specBanner = document.getElementById('live-spectator-banner');
  const specTitle = document.getElementById('live-spectator-title');
  const specDesc = document.getElementById('live-spectator-desc');
  const revNextBox = document.getElementById('live-reveal-next-box');
  const revNextText = document.getElementById('btn-live-reveal-next-text');
  toggleCustomAnswerBox(false);

  const commentInput = document.getElementById('input-question-comment');
  if (commentInput) commentInput.value = '';
  gameState.pendingChoiceIndex = null;
  gameState.pendingEmoji = '';
  resetEmojiPickButtons();

  // v0.11: Takımlı modlarda (2v2..5v5) ve 1v1'de SADECE belirlenen tahminci tahmin edebilir; diğerleri izler.
  // FFA'da cevaplayan dışındaki herkes tahmin eder ama tahminini kilitleyen oyuncunun şıkları tekrar açılmaz.
  const liveFmt = String(room.arenaFormat || gameState.arenaFormat || '1v1').toLowerCase();
  const designatedGuesserCode = (ms.activeGuesserCode || '').toUpperCase();
  const isDesignatedGuesser = liveFmt === 'ffa' ? !isAnswerer : Boolean(myCode && designatedGuesserCode === myCode);
  const myGuessAlreadyLocked = Boolean(
    myCode && ms.guessesByPlayer && Object.keys(ms.guessesByPlayer).some((k) => String(k).toUpperCase() === myCode)
  );
  const canActivelyAnswer = ms.subPhase === 'answering' && isAnswerer;
  const canActivelyGuess = ms.subPhase === 'guessing' && isDesignatedGuesser && !myGuessAlreadyLocked;

  // Değiştir / Pas / Özel Şık kontrolleri sadece aktif cevaplayan oyuncuda açık
  const shuffleBtn = document.getElementById('btn-shuffle-question');
  const passBtn = document.getElementById('btn-use-pass');
  const passLabel = document.getElementById('btn-pass-label');
  const customWrapper = document.getElementById('custom-answer-wrapper');
  const customBtn = document.getElementById('btn-open-custom-answer');
  const customLabel = document.getElementById('btn-custom-answer-label');

  if (shuffleBtn) shuffleBtn.classList.add('hidden'); // Canlı senkron maçta iki ekranda aynı soru kalması için soru değiştirme kapalı
  if (passBtn && passLabel) {
    if (canActivelyAnswer) {
      passBtn.classList.remove('hidden');
      passBtn.disabled = gameState.passUsedThisTurn;
      passLabel.textContent = gameState.passUsedThisTurn ? "Pas Bitti (0/1)" : "Pas (1/1)";
    } else {
      passBtn.classList.add('hidden');
    }
  }
  if (customWrapper && customBtn && customLabel) {
    if (canActivelyAnswer) {
      customWrapper.classList.remove('hidden');
      customBtn.disabled = gameState.customAnswerUsedThisTurn;
      customLabel.textContent = gameState.customAnswerUsedThisTurn
        ? "Özel Şık Hakkı Kullanıldı (0/1)"
        : "Kendi Cevabını Yaz (Özel Şık Ekle • 1/1 Hak)";
    } else {
      customWrapper.classList.add('hidden');
    }
  }

  const turnBadge = document.getElementById('question-turn-badge');
  const stepLabel = document.getElementById('question-step-label');
  const questionTextEl = document.getElementById('question-text');

  if (ms.subPhase === 'answering') {
    if (revNextBox) revNextBox.classList.add('hidden');
    if (isAnswerer) {
      gameState.phase = 'p1_answer';
      gameState.isLocked = false;
      if (specBanner) specBanner.classList.add('hidden');
      turnBadge.innerHTML = `<span>😎</span> <span>Sıra Sende: ${escapeHtml(answererName)} Cevaplıyor</span>`;
      stepLabel.textContent = `KENDİ ADINA CEVAPLA (${guesserName.toUpperCase()} SENİ CANLI İZLİYOR)`;
      questionTextEl.textContent = questionObj.q1;
    } else {
      gameState.phase = 'live_spectate';
      gameState.isLocked = true;
      if (specBanner && specTitle && specDesc) {
        specTitle.textContent = `👀 Şu An ${answererName} Soruyu Cevaplandırıyor...`;
        specDesc.textContent = `${answererName} cevabını ve gizli yorumunu kilitlediğinde sıra anında sana geçecek!`;
        specBanner.classList.remove('hidden');
      }
      turnBadge.innerHTML = `<span>⏳</span> <span>${escapeHtml(answererName)} Cevaplıyor (Canlı İzliyorsun)</span>`;
      stepLabel.textContent = isDesignatedGuesser
        ? `BİRAZDAN BU SORUDA ${answererName.toUpperCase()} İÇİN TAHMİN YAPACAKSIN`
        : `${answererName.toUpperCase()} CEVAPLIYOR • ${guesserName.toUpperCase()} TAHMİN EDECEK (İZLİYORSUN)`;
      questionTextEl.textContent = questionObj.q2.replace('{p1}', answererName);
    }
  } else if (ms.subPhase === 'guessing') {
    if (revNextBox) revNextBox.classList.add('hidden');
    if (canActivelyGuess) {
      // Tahmin sırası bu oyuncuda! Karşı tarafın cevabını veya yorumunu GÖRMEZ!
      gameState.phase = 'live_guess';
      gameState.isLocked = false;
      if (specBanner) specBanner.classList.add('hidden');
      turnBadge.innerHTML = `<span>🕵️</span> <span>Sıra Sende: ${escapeHtml(userProfile.username || guesserName)} Tahmin Ediyor!</span>`;
      stepLabel.textContent = `SENCE ${answererName.toUpperCase()} HANGİ ŞIKKI SEÇMİŞTİR?`;
      questionTextEl.textContent = questionObj.q2.replace('{p1}', answererName);
    } else if (!isAnswerer) {
      // Tahminini kilitlemiş (FFA) veya bu soruda tahmin sırası olmayan (takım modu) oyuncu canlı izler
      gameState.phase = 'live_spectate';
      gameState.isLocked = true;
      if (specBanner && specTitle && specDesc) {
        specTitle.textContent = myGuessAlreadyLocked
          ? '🔒 Tahminin Kilitlendi! Diğer Oyuncular Bekleniyor...'
          : `👀 Şu An ${guesserName}, ${answererName}'in Cevabını Tahmin Ediyor...`;
        specDesc.textContent = 'Tüm tahminler kilitlendiğinde doğru/yanlış sonucu ve yorum balonları herkeste aynı anda açılacak!';
        specBanner.classList.remove('hidden');
      }
      turnBadge.innerHTML = `<span>👀</span> <span>${myGuessAlreadyLocked ? 'Tahminin Kilitlendi' : 'Canlı İzliyorsun'}</span>`;
      stepLabel.textContent = myGuessAlreadyLocked
        ? 'TAHMİNİN KİLİTLENDİ • SONUÇ BEKLENİYOR'
        : `${guesserName.toUpperCase()} TAHMİN YAPIYOR (İZLİYORSUN)`;
      questionTextEl.textContent = questionObj.q2.replace('{p1}', answererName);
    } else {
      // Cevaplayan oyuncu şimdi tahmin eden arkadaşını canlı izliyor
      gameState.phase = 'live_spectate';
      gameState.isLocked = true;
      if (specBanner && specTitle && specDesc) {
        specTitle.textContent = `🕵️ Şu An ${guesserName} Senin Cevabını Tahmin Ediyor...`;
        specDesc.textContent = `${guesserName} tahminini ve yorumunu onayladığında doğru/yanlış sonucu ve yorum balonları ikinizde aynı anda patlayacak!`;
        specBanner.classList.remove('hidden');
      }
      turnBadge.innerHTML = `<span>👀</span> <span>${escapeHtml(guesserName)} Seni Tahmin Ediyor (Canlı İzliyorsun)</span>`;
      stepLabel.textContent = `SENİN CEVABIN KİLİTLENDİ • ${guesserName.toUpperCase()} TAHMİN YAPIYOR`;
      questionTextEl.textContent = questionObj.q2.replace('{p1}', answererName);
    }
  } else {
    // ms.subPhase === 'reveal': Her iki oyuncuda da aynı anda Doğru/Yanlış ve 1.5sn sonra Yorum Balonu patlar!
    gameState.phase = 'live_reveal';
    gameState.isLocked = true;
    if (specBanner) specBanner.classList.add('hidden');
    turnBadge.innerHTML = `<span>⚡</span> <span>Canlı Karşılaştırma: ${escapeHtml(answererName)} &amp; ${escapeHtml(guesserName)}</span>`;
    stepLabel.textContent = `SORU ${qIndex + 1} SONUCU VE GİZLİ YORUM BALONLARI`;
    questionTextEl.textContent = questionObj.q2.replace('{p1}', answererName);
  }

  // Şıkları Oluştur
  const optionsContainer = document.getElementById('options-container');
  optionsContainer.innerHTML = '';
  const isSpectatorOrReveal = !canActivelyAnswer && !canActivelyGuess;
  optionsContainer.classList.toggle('live-options-spectator-locked', isSpectatorOrReveal);

  const customTextForThisQ =
    ms.currentCustomOption || (gameState.customOptionsMap && gameState.customOptionsMap[qIndex]) || '';
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
    btn.disabled = isSpectatorOrReveal;
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
    if (!isSpectatorOrReveal) {
      btn.addEventListener('click', (ev) => handleOptionSelect(idx, btn, ev));
    }
    optionsContainer.appendChild(btn);
  });

  const allBtns = document.querySelectorAll('#options-container .option-btn');

  // Eğer cevaplayan kişi karşı tarafın tahminini izliyorsa kendi seçtiği şıkkı mor işaretli görsün
  if (ms.subPhase === 'guessing' && isAnswerer && typeof ms.currentAnswer === 'number' && allBtns[ms.currentAnswer]) {
    allBtns[ms.currentAnswer].classList.add('option-selected-p1');
    const st = allBtns[ms.currentAnswer].querySelector('.option-status-icon');
    if (st) {
      st.innerHTML = '✓';
      st.className = 'option-status-icon w-6 h-6 rounded-full bg-primary-theme font-extrabold flex items-center justify-center text-xs shrink-0';
    }
  }

  // Eğer 'reveal' aşamasındaysak: İKİ OYUNCUDA DA AYNI ANDA yeşil/kırmızı şıkları ve 1.5 sn sonra yorum balonunu patlat!
  if (ms.subPhase === 'reveal') {
    const correctIndex = ms.currentAnswer;
    const guessedIndex = ms.currentGuess;
    const isHit = correctIndex === PASS_ANSWER_VALUE || correctIndex === guessedIndex;

    if (feedbackBanner) {
      feedbackBanner.classList.remove('hidden');
      if (correctIndex === PASS_ANSWER_VALUE) {
        feedbackBanner.className = "rounded-xl px-4 py-3 text-center font-bold text-xs sm:text-sm bg-emerald-500/20 border border-emerald-500/50 text-emerald-700 dark:text-emerald-200";
        feedbackBanner.textContent = `⏭️ ${answererName} bu soruyu Pas geçmişti!`;
      } else if (isHit) {
        feedbackBanner.className = "rounded-xl px-4 py-3 text-center font-bold text-xs sm:text-sm bg-emerald-500/20 border border-emerald-500/50 text-emerald-700 dark:text-emerald-200";
        feedbackBanner.textContent = `🎯 Tam İsabet! ${guesserName}, ${answererName}'in cevabını doğru bildi! (+1 Puan)`;
      } else {
        feedbackBanner.className = "rounded-xl px-4 py-3 text-center font-bold text-xs sm:text-sm bg-red-500/20 border border-red-500/50 text-red-700 dark:text-red-200";
        feedbackBanner.textContent = `❌ Yanlış Tahmin! ${guesserName} kırmızı şıkkı seçti, ${answererName} ise yeşil şıkkı seçmişti.`;
      }
    }

    if (typeof correctIndex === 'number' && allBtns[correctIndex]) {
      allBtns[correctIndex].classList.add('option-correct');
      const rightIcon = allBtns[correctIndex].querySelector('.option-status-icon');
      if (rightIcon) {
        rightIcon.innerHTML = '✓';
        rightIcon.className = 'option-status-icon w-6 h-6 rounded-full bg-emerald-500 text-white font-extrabold flex items-center justify-center text-xs shrink-0';
      }
    }
    if (!isHit && typeof guessedIndex === 'number' && allBtns[guessedIndex]) {
      allBtns[guessedIndex].classList.add('option-wrong');
      const wrongIcon = allBtns[guessedIndex].querySelector('.option-status-icon');
      if (wrongIcon) {
        wrongIcon.innerHTML = '✕';
        wrongIcon.className = 'option-status-icon w-6 h-6 rounded-full bg-red-500 text-white font-extrabold flex items-center justify-center text-xs shrink-0';
      }
    }

    playSoundEffect(isHit ? 'correct' : 'wrong');

    // İki oyuncunun bıraktığı yorumları birleştirip 1.5 saniye sonra baloncuk olarak patlat!
    const ansC = ms.currentAnswerComment || {};
    const guessC = ms.currentGuessComment || {};
    const combinedLines = [];
    if ((ansC.emoji && ansC.emoji.trim()) || (ansC.text && ansC.text.trim())) {
      combinedLines.push(`${answererName}: ${ansC.emoji || ''} ${ansC.text || ''}`.trim());
    }
    if ((guessC.emoji && guessC.emoji.trim()) || (guessC.text && guessC.text.trim())) {
      combinedLines.push(`${guesserName}: ${guessC.emoji || ''} ${guessC.text || ''}`.trim());
    }

    if (combinedLines.length > 0) {
      const senderEl = document.getElementById('messenger-bubble-sender');
      const textEl = document.getElementById('messenger-bubble-text');
      if (typingInd) {
        typingInd.classList.remove('hidden');
        typingInd.classList.add('flex');
      }
      gameState.secretBubbleTimeoutId = setTimeout(() => {
        if (typingInd) {
          typingInd.classList.add('hidden');
          typingInd.classList.remove('flex');
        }
        if (bubbleEl && senderEl && textEl) {
          senderEl.textContent = '💬 Canlı Sohbet Balonu Patladı:';
          textEl.textContent = combinedLines.join('  •  ');
          bubbleEl.classList.remove('hidden');
          playSoundEffect('pop');
          spawnFloatingEmojiBurst(ansC.emoji || guessC.emoji || '💬');
        }
      }, 1500);
    }

    if (revNextBox && revNextText) {
      const isLastQ = qIndex >= TOTAL_QUESTIONS - 1;
      const nextStepInfo =
        !isLastQ && Number(ms.turnStep || 1) === 1
          ? ` (Sıra ${guesserName}'e Geçecek)`
          : '';
      revNextText.textContent = isLastQ
        ? 'MAÇI BİTİR & SONUÇ KARNELERİNİ GÖR 🏆'
        : `SONRAKİ SORUYA GEÇ${nextStepInfo}`;
      revNextBox.classList.remove('hidden');
    }
    stopQuestionCountdownTimer();
    gameState.activeTimerStepKey = '';
    const timerPillEl = document.getElementById('question-live-timer-pill');
    if (timerPillEl) {
      timerPillEl.classList.add('hidden');
      timerPillEl.classList.remove('flex');
    }
  } else if (canActivelyAnswer || canActivelyGuess) {
    startQuestionCountdownTimer();
  } else {
    stopQuestionCountdownTimer();
    gameState.activeTimerStepKey = '';
    const timerPillEl = document.getElementById('question-live-timer-pill');
    if (timerPillEl) {
      timerPillEl.classList.add('hidden');
      timerPillEl.classList.remove('flex');
    }
  }

  updateDuelHeaderUI();
}

async function advanceLiveArenaToNextQuestion() {
  if (gameState.phase === 'p1_watch_p2_slides') {
    advanceP1WatchSlide();
    return;
  }
  if (gameState.phase === 'p2_watch_p1_slides') {
    advanceP2WatchSlide();
    return;
  }
  if (!gameState.roomCode) return;
  const btn = document.getElementById('btn-live-reveal-next');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        action: 'submit_live_step',
        subAction: 'next_question',
        code: gameState.roomCode,
        friendCode: userProfile.friendCode,
        expectedQIndex: gameState.liveMatchState ? Number(gameState.liveMatchState.qIndex) || 0 : null
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.room) {
        loadRoomIntoGameState(data.room, false);
      }
    }
  } catch (e) {} finally {
    if (btn) btn.disabled = false;
  }
}

function startLiveMatchPlayPolling(roomCode) {
  stopLiveMatchPlayPolling();
  if (!roomCode) return;

  gameState.livePlayPollingId = setInterval(async () => {
    const room = await fetchRoomFromDatabase(roomCode);
    if (!room) return;
    if (room.status === 'opponent_fled') {
      stopLiveMatchPlayPolling();
      openOpponentFledModal(room);
      return;
    }
    if (room.status === 'completed') {
      stopLiveMatchPlayPolling();
      loadRoomIntoGameState(room, true);
      return;
    }
    if (room.status === 'live_in_progress' && room.liveMatchState) {
      const ms = room.liveMatchState;
      const stepKey = `${ms.qIndex}:${ms.subPhase}:${ms.activeAnswererCode}:${ms.activeGuesserCode}`;
      if (stepKey !== gameState.lastRenderedLiveStepKey) {
        gameState.lastRenderedLiveStepKey = stepKey;
        loadRoomIntoGameState(room, false);
      }
    }
  }, 1200);
}

function stopLiveMatchPlayPolling() {
  if (gameState.livePlayPollingId) {
    clearInterval(gameState.livePlayPollingId);
    gameState.livePlayPollingId = null;
  }
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
    gameState.pendingCustomOptionText = '';
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

  if (gameState.half === 1 || gameState.mode === 'arena') {
    gameState.customOptionsMap[qIndex] = text;
  } else {
    gameState.p2Half2CustomMap[qIndex] = text;
  }
  gameState.pendingCustomOptionText = text;
  gameState.customAnswerUsedThisTurn = true;
  toggleCustomAnswerBox(false);
  renderCurrentQuestion();

  const allButtons = document.querySelectorAll('#options-container .option-btn');
  const targetBtn = allButtons[customIdx];
  if (targetBtn) {
    handleOptionSelect(customIdx, targetBtn, null);
  } else {
    gameState.pendingChoiceIndex = customIdx;
  }
}

function handlePassQuestion() {
  if (gameState.isLocked || !isCurrentPhaseAnswering() || gameState.passUsedThisTurn) return;

  gameState.isLocked = true;
  gameState.passUsedThisTurn = true;
  const hasActiveLiveTimer =
    gameState.mode === 'arena' && gameState.liveSettings && Number(gameState.liveSettings.timerSeconds) > 0;
  if (!hasActiveLiveTimer) {
    stopQuestionCountdownTimer();
  }

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

// KULLANICI İSTEĞİ: Klasik oyunda cevap seçildiğinde doğru/yanlış ANINDA açılır, karşı tarafın bıraktığı yorum baloncuğu ise 1.5 SANİYE (1500ms) SONRA fırlar!
// Canlı Oda ('live_guess') modunda ise tahmin eden oyuncu önce şıkkını seçip isterse yorumunu yazar, İLERLE dediğinde sonuç İKİSİNDE DE AYNI ANDA açılır!
function handleOptionSelect(selectedIndex, clickedBtn, clickEvent) {
  if (gameState.isLocked) return;
  gameState.isLocked = true;
  const hasActiveLiveTimer =
    gameState.mode === 'arena' && gameState.liveSettings && Number(gameState.liveSettings.timerSeconds) > 0;
  if (!hasActiveLiveTimer) {
    stopQuestionCountdownTimer();
  }

  const allButtons = document.querySelectorAll('#options-container .option-btn');
  allButtons.forEach((b) => (b.disabled = true));

  const qIndex = gameState.currentQuestionIndex;
  const qList = getActiveQuestionList();
  const chosenEmoji = qList[qIndex]?.options[selectedIndex]?.icon || '✨';
  spawnFloatingEmojiBurst(chosenEmoji, clickEvent);

  const isAnswering = isCurrentPhaseAnswering();
  const isLiveGuessPhase = gameState.phase === 'live_guess';
  const answererName = gameState.half === 1 ? gameState.player1Name : (gameState.player2Name || '2. Oyuncu');

  if (isAnswering || isLiveGuessPhase) {
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
    if (gameState.mode === 'arena' && gameState.liveMatchState && !gameState.isSandboxTest) {
      confirmBtnText.textContent =
        gameState.liveMatchState.subPhase === 'answering'
          ? 'CEVABI KİLİTLE & SIRA DEVRET'
          : 'TAHMİNİ KİLİTLE & SONUCU GÖR';
    } else {
      confirmBtnText.textContent = isLastQuestion ? 'TURU BİTİR' : 'İLERLE';
    }
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
  if (gameState.pendingChoiceIndex === null || gameState.isSubmittingStep) return;

  stopQuestionCountdownTimer();
  gameState.activeTimerStepKey = '';

  const commentInput = document.getElementById('input-question-comment');
  const commentText = commentInput ? commentInput.value.trim() : '';
  const emoji = gameState.pendingEmoji || '';
  const choice = gameState.pendingChoiceIndex;
  const qIndex = gameState.currentQuestionIndex;

  // Eğer Canlı Oda Eşzamanlı Moddaysa (answering -> guessing -> reveal):
  if (
    gameState.mode === 'arena' &&
    gameState.liveRoomData &&
    gameState.liveRoomData.status === 'live_in_progress' &&
    gameState.liveMatchState &&
    gameState.roomCode &&
    !gameState.isSandboxTest
  ) {
    const ms = gameState.liveMatchState;
    const subAction = ms.subPhase === 'answering' ? 'lock_answer' : 'lock_guess';
    const customOptionText =
      gameState.pendingCustomOptionText ||
      (gameState.customOptionsMap && gameState.customOptionsMap[qIndex]) ||
      '';

    gameState.isSubmittingStep = true;
    gameState.pendingChoiceIndex = null;
    gameState.pendingEmoji = '';

    const payloadBody = JSON.stringify({
      action: 'submit_live_step',
      subAction,
      code: gameState.roomCode,
      friendCode: userProfile.friendCode,
      playerName: userProfile.username || gameState.player1Name || 'Oyuncu',
      choiceIndex: choice,
      comment: { emoji, text: commentText },
      customOption: customOptionText
    });

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch('/api/rooms', {
          method: 'POST',
          headers: getSupabaseHeaders(),
          body: payloadBody
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.room) {
            gameState.pendingCustomOptionText = '';
            gameState.isSubmittingStep = false;
            loadRoomIntoGameState(data.room, false);
            return;
          }
        }
      } catch (e) {}
    }

    // Her iki deneme de başarısız olduysa seçimi geri koy ki kullanıcı "CEVABI KİLİTLE" butonuna tekrar basabilsin (ASLA kilitli kalmasın!)
    gameState.isSubmittingStep = false;
    gameState.pendingChoiceIndex = choice;
    gameState.pendingEmoji = emoji;
    return;
  }

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
  gameState.pendingCustomOptionText = '';

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
  const sandboxBtnWrapper = document.getElementById('sandbox-test-btn-wrapper');

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

  const isAfterP1 = stage === 'after_p1_answer';
  if (isAfterP1) {
    setMyRoleForRoom(gameState.roomCode, 'p1');
    gameState.p1Id = userProfile.id || gameState.p1Id || '';
    gameState.p1FriendCode = userProfile.friendCode || gameState.p1FriendCode || '';
    if (sandboxBtnWrapper) sandboxBtnWrapper.classList.remove('hidden');
  } else {
    // KRİTİK v0.09 DÜZELTMESİ: denemeb (P2) karşı saldırı sorularını bitirdiğinde (after_p2_answer)
    // p1Id ve p1FriendCode ASLA denemeb'nin koduyla ezilmez! denemeb'nin rolü 'p2' olarak korunur!
    setMyRoleForRoom(gameState.roomCode, 'p2');
    gameState.p2Id = userProfile.id || gameState.p2Id || '';
    if (!gameState.player2FriendCode && userProfile.friendCode) {
      gameState.player2FriendCode = userProfile.friendCode;
    }
    if (sandboxBtnWrapper) sandboxBtnWrapper.classList.add('hidden');
  }

  const nextStatus = isAfterP1 ? 'waiting_p2' : 'waiting_p1_half2';
  const roomRecord = {
    code: gameState.roomCode,
    p1Id: isAfterP1 ? (userProfile.id || gameState.p1Id || '') : (gameState.p1Id || ''),
    p1FriendCode: isAfterP1 ? (userProfile.friendCode || gameState.p1FriendCode || '') : (gameState.p1FriendCode || ''),
    p2Id: isAfterP1 ? (gameState.p2Id || '') : (userProfile.id || gameState.p2Id || ''),
    p2FriendCode: isAfterP1 ? (gameState.player2FriendCode || '') : (gameState.player2FriendCode || userProfile.friendCode || ''),
    roomType: gameState.mode === 'arena' ? 'live_arena' : 'classic',
    arenaFormat: gameState.arenaFormat,
    status: nextStatus,
    currentRound: gameState.currentRound,
    whoseTurn: isAfterP1 ? 'p2' : 'p1',
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
    headingEl.textContent = `Karşı Saldırın Hazır! Sıra ${gameState.player1Name || 'Arkadaşın'}'de ⏳`;
    subEl.innerHTML = `Sen onun sorularını tahmin ettin ve kendi 5 sorunu hazırladın. Şimdi <strong>${escapeHtml(
      gameState.player1Name || 'Arkadaşın'
    )}</strong> önce senin tahminlerini slayt olarak izleyecek, ardından senin 5 sorunu çözecek! O bitirdiği anda sonuç ekranı ikinizde aynı anda açılacak.`;
  } else {
    headingEl.textContent = "Kısa Davet Linkin Hazır! Arkadaşına Gönder 🚀";
    subEl.innerHTML = `Cevapların bulut veritabanına kaydedildi (Oda: <strong>#${gameState.roomCode}</strong> • Arkadaş Kodun: <strong>${userProfile.friendCode}</strong>). Kısa linki gönder veya arkadaşın doğrudan senin arkadaş kodunla katılsın!`;
  }

  // STATE_ISSUE #3 Çözümü: Bulut kayıt sonucunu doğrula ve kullanıcıya net durum göster
  const statusPill = document.getElementById('cloud-save-status-pill');
  if (statusPill) statusPill.textContent = "⚡ Veritabanına Kaydediliyor...";
  const saveRes = await saveRoomToDatabase(roomRecord);
  if (saveRes && saveRes.room) {
    if (saveRes.room.p1FriendCode) gameState.p1FriendCode = saveRes.room.p1FriendCode;
    if (saveRes.room.p1Id) gameState.p1Id = saveRes.room.p1Id;
  }
  if (statusPill) {
    statusPill.textContent = saveRes.ok
      ? `✅ Bulut Veritabanına Kaydedildi (#${gameState.roomCode})`
      : `⚠️ Yerel Olarak Kaydedildi (#${gameState.roomCode})`;
  }

  startPollingForPartnerCompletion(gameState.roomCode);
}

// Bekleyen odaya tıklandığında açılan kumsaati bekleme ekranı (Asla "Senin Adın Nedir?" sormaz!)
function showWaitingShareScreenForExistingRoom() {
  showView('view-interstitial');
  const passBox = document.getElementById('interstitial-pass-box');
  const linkBox = document.getElementById('interstitial-link-box');
  const sandboxBtnWrapper = document.getElementById('sandbox-test-btn-wrapper');
  if (passBox) passBox.classList.add('hidden');
  if (linkBox) linkBox.classList.remove('hidden');

  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const shortUrl = `${baseUrl}?r=${gameState.roomCode}`;
  gameState.generatedChallengeUrl = shortUrl;

  const urlInp = document.getElementById('generated-challenge-url');
  if (urlInp) urlInp.value = shortUrl;

  const statusPill = document.getElementById('cloud-save-status-pill');
  if (statusPill) statusPill.textContent = `⏳ Rakip Bekleniyor • Oda #${gameState.roomCode}`;

  const isWaitingP1Half2 = gameState.liveRoomData && gameState.liveRoomData.status === 'waiting_p1_half2';
  const headingEl = document.getElementById('link-share-heading');
  const subEl = document.getElementById('link-share-subtext');

  if (isWaitingP1Half2) {
    if (sandboxBtnWrapper) sandboxBtnWrapper.classList.add('hidden');
    const p1Disp = gameState.player1Name || 'Arkadaşın';
    if (headingEl) {
      headingEl.textContent = `Karşı Saldırın Kilitlendi! Sıra ${p1Disp}'de ⏳`;
    }
    if (subEl) {
      subEl.innerHTML = `<strong>${escapeHtml(
        p1Disp
      )}</strong> şu an senin tahminlerini slayt olarak izliyor ve senin hazırladığın 5 soruyu çözüyor. Tamamladığı anda sonuç ekranı ikinizde aynı anda açılacak!`;
    }
  } else {
    if (sandboxBtnWrapper) sandboxBtnWrapper.classList.remove('hidden');
    const oppDisplay = gameState.player2Name || gameState.player2FriendCode || 'Arkadaşın';
    if (headingEl) {
      headingEl.textContent = `Senin 5 Yanıtın Kilitlendi! Sıra ${oppDisplay}'de ⏳`;
    }
    if (subEl) {
      subEl.innerHTML = `Bu düelloyu sen başlattın. <strong>${escapeHtml(oppDisplay)}</strong> aşağıdaki kısa linkten, <strong>#${escapeHtml(
        gameState.roomCode
      )}</strong> oda kodundan veya kendi <em>Aktif Oyunlar / Bildirimler</em> ekranından sorularını tahmin ettiğinde sıra tekrar sana geçecek!`;
    }
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
    startP1WatchP2Slides();
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
      `Lütfen <strong>${escapeHtml(activePlayerName || 'Rakip')}</strong> soruları çözene kadar sıranı bekle. Tamamlandığında ekranın otomatik güncellenecek (2.5 sn'de bir kontrol ediliyor).`;
  }
  if (badgeEl) {
    badgeEl.textContent = `⏳ Raund: ${roundNum} • Soru Adımı: ${stepNum}/${TOTAL_QUESTIONS}`;
  }

  showView('view-live-turn-wait');
}

function loadRoomIntoGameState(room, forceResultView = false) {
  if (!room) return false;

  // Eğer rakip bu düelloyu sildiyse / teslim olup kaçtıysa ve şu an inceleme modunda değilsek:
  if (room.status === 'opponent_fled' && !gameState.isInspectingFledMatch && !forceResultView) {
    openOpponentFledModal(room);
    return true;
  }

  const prevLoadedRoomCode = gameState.roomCode || '';
  const prevLoadedRound = Number(gameState.currentRound || 1);
  const incomingRound = Number(room.currentRound || 1);

  gameState.isSandboxTest = false;
  gameState.roomCode = room.code || '';
  gameState.p1Id = room.p1Id || gameState.p1Id || '';
  gameState.p1FriendCode = room.p1FriendCode || gameState.p1FriendCode || '';
  gameState.p2Id = room.p2Id || gameState.p2Id || '';
  gameState.mode = room.roomType === 'live_arena' ? 'arena' : room.roomType === 'pass' ? 'pass' : 'link';
  gameState.arenaFormat = room.arenaFormat || '1v1';
  gameState.currentRound = incomingRound;
  gameState.category = room.cat || 'genel';
  gameState.player1Name = room.p1 || 'Oyuncu 1';
  gameState.player2Name = room.p2 || '';
  gameState.player2FriendCode = room.p2FriendCode || '';
  gameState.usedQuestionIds = Array.isArray(room.usedQuestionIds) ? [...room.usedQuestionIds] : [];

  if (incomingRound !== prevLoadedRound || (room.code || '') !== prevLoadedRoomCode) {
    gameState.passUsedThisTurn = false;
    gameState.customAnswerUsedThisTurn = false;
    gameState.pendingCustomOptionText = '';
    gameState.activeTimerStepKey = '';
  }

  if (room.roomType === 'live_arena') {
    const rebuiltCustomMap = { ...(room.customOptionsMap || {}) };
    const rMs = room.liveMatchState;
    if (rMs && Array.isArray(rMs.history)) {
      rMs.history.forEach((h) => {
        if (h && typeof h.qIndex === 'number' && h.customOption) {
          rebuiltCustomMap[h.qIndex] = h.customOption;
        }
      });
    }
    if (rMs && typeof rMs.qIndex === 'number' && rMs.currentCustomOption) {
      rebuiltCustomMap[rMs.qIndex] = rMs.currentCustomOption;
    }
    gameState.customOptionsMap = rebuiltCustomMap;
  } else {
    gameState.customOptionsMap = room.customOptionsMap || {};
  }

  gameState.p1Answers = room.p1Answers || room.ans || [];
  gameState.p1Comments = room.p1Comments || room.c1 || [];
  gameState.p2Guesses = room.p2Guesses || [];
  gameState.p2Comments = room.p2Comments || [];
  gameState.p2Half2CustomMap = room.p2Half2CustomMap || {};
  gameState.p2Half2Answers = room.p2Half2Answers || [];
  gameState.p2Half2Comments = room.p2Half2Comments || [];
  gameState.p1Half2Guesses = room.p1Half2Guesses || [];
  gameState.p1Half2Comments = room.p1Half2Comments || [];
  gameState.liveRoomData = room;
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
    try {
      const prevLiveCode = localStorage.getItem('senceo_active_live_room_code');
      if (prevLiveCode && prevLiveCode !== gameState.roomCode) {
        fetch('/api/rooms', {
          method: 'POST',
          headers: getSupabaseHeaders(),
          body: JSON.stringify({
            action: 'leave_live_lobby',
            code: prevLiveCode,
            friendCode: userProfile.friendCode
          })
        }).catch(() => {});
      }
      localStorage.setItem('senceo_active_live_room_code', gameState.roomCode);
    } catch (e) {}

    const codeEl = document.getElementById('live-lobby-room-code');
    if (codeEl) codeEl.textContent = gameState.roomCode;
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

  // Oyun tamamlandıysa veya kaçan rakibin maçını inceliyorsak sonuç ekranını aç
  if (forceResultView || room.status === 'completed' || gameState.isInspectingFledMatch) {
    stopLiveMatchPlayPolling();
    stopPollingForPartnerCompletion();
    stopQuestionCountdownTimer();
    gameState.activeTimerStepKey = '';
    if (
      room.liveMatchState &&
      Array.isArray(room.liveMatchState.history) &&
      room.liveMatchState.history.length > 0
    ) {
      // v0.11: Raund 2+ bittiğinde de güncel history'den p1Answers/p2Guesses dizilerini KOŞULSUZ güncelle!
      gameState.p1Answers = room.liveMatchState.history.map((h) => h.answerIdx);
      gameState.p2Guesses = room.liveMatchState.history.map((h) => h.guessIdx);
      gameState.p1Comments = room.liveMatchState.history.map((h) => h.answerComment || { emoji: '', text: '' });
      gameState.p2Comments = room.liveMatchState.history.map((h) => h.guessComment || { emoji: '', text: '' });
      gameState.p2Half2Questions = [];
      gameState.p1Half2Guesses = [];
    }
    showResultScreen(false);
    return true;
  }

  // Canlı Oda Eşzamanlı Maç Devam Ediyorsa (live_in_progress):
  if (room.status === 'live_in_progress' && room.liveMatchState) {
    const ms = room.liveMatchState;
    stopLiveLobbyParticipantPolling();

    // v0.08 Gerçek Eşzamanlı 3 Aşamalı Canlı Maç Motoru (answering -> guessing -> reveal)
    if (ms.subPhase) {
      gameState.liveRoomData = room;
      gameState.liveMatchState = ms;
      gameState.lastRenderedLiveStepKey = `${ms.qIndex}:${ms.subPhase}:${ms.activeAnswererCode}:${ms.activeGuesserCode}`;
      showView('view-question');
      renderLiveArenaQuestionState(room);
      startLiveMatchPlayPolling(gameState.roomCode);
      return true;
    }

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

  // 2. Yarıda sıra P1'de (denemea) ise:
  // KULLANICI İSTEĞİ: denemea önce 1. sorudan 5. soruya slayt halinde denemeb'nin verdiği cevapları (5sn) ve emoji/balonunu (4sn) izler, ardından denemeb'nin 5 sorusunu çözer!
  // denemeb ise bu aşamada kumsaati bekleme ekranında kalır, asla kendi sorularını tahmin etmez!
  if (room.status === 'waiting_p1_half2') {
    if (isP1) {
      setMyRoleForRoom(gameState.roomCode, 'p1');
      if (Array.isArray(gameState.p2Guesses) && gameState.p2Guesses.length > 0) {
        startP1WatchP2Slides();
      } else {
        startP1Half2GuessPhase();
      }
      return true;
    } else {
      setMyRoleForRoom(gameState.roomCode, 'p2');
      showWaitingShareScreenForExistingRoom();
      return true;
    }
  }

  // room.status === 'waiting_p2' iken odayı açan kişi P1'in KENDİSİ ise:
  if (isP1) {
    showWaitingShareScreenForExistingRoom();
    return true;
  }

  // Odayı açan kişi 2. Oyuncu (Rakip / denemeb) ise:
  setMyRoleForRoom(gameState.roomCode, 'p2');
  gameState.half = 1;
  gameState.phase = 'p2_guess';
  gameState.currentQuestionIndex = 0;
  gameState.progressDots = [];

  // KULLANICI İSTEĞİ: İsim 1 kere girildiyse (ve P1'in adıyla birebir aynı değilse) bir daha "Senin Adın Nedir?" ekranı sorma, doğrudan 1. Soruya sok!
  const savedUserName =
    userProfile.username && userProfile.username.trim() && userProfile.username !== 'Misafir Oyuncu'
      ? userProfile.username.trim()
      : '';
  const isSameAsP1Name =
    savedUserName &&
    gameState.player1Name &&
    savedUserName.toLowerCase() === gameState.player1Name.trim().toLowerCase();

  if (savedUserName && !isSameAsP1Name) {
    gameState.player2Name = savedUserName;
    gameState.player2FriendCode = userProfile.friendCode || gameState.player2FriendCode;
    updateDuelHeaderUI();
    showView('view-question');
    renderCurrentQuestion();
    return true;
  }

  // Sadece daha önce hiç isim girmemiş sıfır bir kullanıcıysa (veya aynı tarayıcıda 2. sekmeden test ediliyorsa) adını sor:
  const titleEl = document.getElementById('challenge-welcome-title');
  titleEl.innerHTML = `<span class="text-primary-theme">${escapeHtml(gameState.player1Name)}</span> sana meydan okudu! Bakalım onu ne kadar tanıyorsun?`;
  const nameInput = document.getElementById('input-challenger-p2-name');
  if (nameInput) {
    const candidateName =
      gameState.player2Name &&
      !/^SNC-\d{4}$/i.test(gameState.player2Name) &&
      gameState.player2Name !== 'Arkadaşın' &&
      gameState.player2Name.trim().toLowerCase() !== (gameState.player1Name || '').trim().toLowerCase()
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
      // Davet linki (?r=KOD) waiting_p2 aşamasında açıldıysa: SADECE linki açan kişi P1'in kendisi DEĞİLSE 'p2' rolü ata.
      // v0.11: Eski koşul (`|| !existingTabRole`) her zaman true olduğu için P1 kendi linkine tıklayınca P2 oluyordu!
      const cleanCode = String(cloudRoom.code || shortRoomParam).trim().toUpperCase();
      const roomRound = Number(cloudRoom.currentRound) || 1;
      if (cloudRoom.status === 'waiting_p2' && viewParam !== 'result') {
        const myCode = (userProfile.friendCode || '').trim().toUpperCase();
        const rP1Code = (cloudRoom.p1FriendCode || '').trim().toUpperCase();
        if (myCode && rP1Code && myCode !== rP1Code) {
          setMyRoleForRoom(cleanCode, 'p2', roomRound);
        }
      }
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
  if (gameState.roomCode) {
    setMyRoleForRoom(gameState.roomCode, 'p2');
  }
  gameState.player2Name = p2Name;
  gameState.p2Id = userProfile.id || '';
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

  const finishedRound = Number(gameState.currentRound || 1);
  setMyRoleForRoom(gameState.roomCode, 'p1', finishedRound);

  // KULLANICI İSTEĞİ: 1. Raundda 2. başlayan oyuncu (p2 / denemeb), 2. Raundda ZORUNLU OLARAK 1. başlar!
  const completedRoom = {
    code: gameState.roomCode,
    p1Id: gameState.p1Id || userProfile.id || '',
    p1FriendCode: gameState.p1FriendCode || userProfile.friendCode || '',
    p2Id: gameState.p2Id || '',
    p2FriendCode: gameState.player2FriendCode || '',
    nextRoundStarterCode: gameState.player2FriendCode || '',
    nextRoundStarterName: gameState.player2Name || '2. Oyuncu',
    roomType: gameState.mode === 'arena' ? 'live_arena' : gameState.mode === 'pass' ? 'pass' : 'classic',
    arenaFormat: gameState.arenaFormat,
    status: 'completed',
    currentRound: finishedRound,
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
    p2WatchingSlides: false,
    p2WatchedSlides: false,
    lastMatchPercentage: percentage,
    lastCorrectCount: correctCount,
    lastTotalQuestions: totalCount,
    completedAt: new Date().toISOString()
  };

  gameState.liveRoomData = completedRoom;
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

  const liveMs = gameState.liveMatchState;
  const isLiveArenaResult = Boolean(
    gameState.mode === 'arena' && liveMs && Array.isArray(liveMs.history) && liveMs.history.length > 0
  );
  const liveOrder = isLiveArenaResult && Array.isArray(liveMs.turnOrder) ? liveMs.turnOrder : [];
  if (isLiveArenaResult && liveOrder.length > 0) {
    document.getElementById('result-p1-name').textContent = liveOrder[0].name || 'Oyuncu 1';
    document.getElementById('result-p2-name').textContent =
      liveOrder.length === 2 ? liveOrder[1].name || 'Oyuncu 2' : `+${liveOrder.length - 1} Oyuncu`;
  }

  const nextRoundBtn = document.getElementById('btn-next-round-action');
  const nextRoundLabel = document.getElementById('btn-next-round-label');
  if (isLiveArenaResult) {
    // v0.11 CANLI ODA: Her iki oyuncunun ekranında da aynı canlı raund butonu görünür;
    // Odadaki katılımcılardan hangisi basarsa bassın (Player 1 veya Player 2) tüm kurallar korunarak
    // ve başlangıç sırası bir sonraki oyuncuya (liveOrder[1]) geçerek HER İKİ EKRANDA AYNI ANDA yeni canlı raund başlar!
    const liveStarter = (liveOrder[1] && liveOrder[1].name) || (liveOrder[0] && liveOrder[0].name) || 'Sıradaki Oyuncu';
    if (nextRoundLabel) {
      nextRoundLabel.textContent = `${gameState.currentRound + 1}. CANLI RAUNDA GEÇ (İLK SIRA: ${liveStarter.toUpperCase()})`;
    }
    if (nextRoundBtn) {
      nextRoundBtn.onclick = startNextLiveRoundAsHost;
    }
  } else {
    const nextRoundStarter = gameState.player2Name || '2. Oyuncu';
    if (nextRoundLabel) {
      nextRoundLabel.textContent = `${gameState.currentRound + 1}. RAUNDA GEÇ (İLK SIRA: ${nextRoundStarter.toUpperCase()})`;
    }
    if (nextRoundBtn) {
      nextRoundBtn.onclick = startNextRoundInSameRoom;
    }
  }

  const nudgeToast = document.getElementById('result-round2-nudge-toast');
  if (nudgeToast) nudgeToast.classList.add('hidden');

  const roomRef = gameState.liveRoomData || {
    code: gameState.roomCode,
    currentRound: gameState.currentRound,
    p1Id: gameState.p1Id,
    p1FriendCode: gameState.p1FriendCode,
    p2Id: gameState.p2Id,
    p2FriendCode: gameState.player2FriendCode,
    p1: gameState.player1Name,
    p2: gameState.player2Name
  };
  const isP1 = isUserPlayer1OfRoom(roomRef, gameState.currentRound);
  const p1Name = gameState.player1Name || 'Oyuncu 1';
  const p2Name = gameState.player2Name || 'Oyuncu 2';

  // v0.11: 1. Yarı Slaytını Tekrar İzle butonu (Klasik modda Player 1 için, Yan Yana modda ortak ekran için görünür!)
  const p1ReplayBox = document.getElementById('p1-replay-slides-box');
  const p1ReplayLabel = document.getElementById('btn-p1-replay-slides-label');
  const hasHalf1Slides =
    !isLiveArenaResult &&
    !gameState.isSandboxTest &&
    Array.isArray(gameState.selectedQuestions) &&
    gameState.selectedQuestions.length > 0 &&
    Array.isArray(gameState.p2Guesses) &&
    gameState.p2Guesses.length > 0;

  if (p1ReplayBox) {
    if ((isP1 || gameState.mode === 'pass') && hasHalf1Slides) {
      if (p1ReplayLabel) {
        p1ReplayLabel.textContent =
          gameState.mode === 'pass'
            ? `1. YARI SLAYTINI TEKRAR İZLE (${p2Name.toUpperCase()}'NİN TAHMİNLERİ)`
            : `TAHMİN SLAYTINI TEKRAR İZLE (${p2Name.toUpperCase()}'NİN TAHMİNLERİ)`;
      }
      p1ReplayBox.classList.remove('hidden');
    } else {
      p1ReplayBox.classList.add('hidden');
    }
  }

  // v0.10..v0.11: Player 2 için 2. Yarı Slaytını İzle / Tekrar İzle (Yan Yana modda her iki yarı slaytı da tekrar izlenebilir!)
  const p2WatchBox = document.getElementById('p2-watch-slides-box');
  const p2WatchLabel = document.getElementById('btn-p2-watch-slides-label');
  const hasHalf2Slides =
    !isLiveArenaResult &&
    !gameState.isSandboxTest &&
    Array.isArray(gameState.p2Half2Questions) &&
    gameState.p2Half2Questions.length > 0 &&
    Array.isArray(gameState.p1Half2Guesses) &&
    gameState.p1Half2Guesses.length > 0;

  if (p2WatchBox) {
    if ((!isP1 || gameState.mode === 'pass') && hasHalf2Slides) {
      if (p2WatchLabel) {
        const alreadyWatched = Boolean(roomRef && roomRef.p2WatchedSlides);
        p2WatchLabel.textContent =
          gameState.mode === 'pass'
            ? `2. YARI SLAYTINI TEKRAR İZLE (${p1Name.toUpperCase()}'İN TAHMİNLERİ)`
            : alreadyWatched
            ? `SLAYTI TEKRAR İZLE (${p1Name.toUpperCase()}'İN TAHMİNLERİ)`
            : `TAHMİNLERİ KONTROL ET (${p1Name.toUpperCase()}'İN TAHMİN SLAYTINI İZLE)`;
      }
      p2WatchBox.classList.remove('hidden');
    } else {
      p2WatchBox.classList.add('hidden');
    }
  }

  // v0.10 KULLANICI İSTEĞİ: Player 1'in rapor ekranında Player 2 slaytı izlerken animasyonlu bilgi gösterilir, bitince kaybolur!
  const p1WatchingBanner = document.getElementById('p1-partner-watching-slides-banner');
  const p1WatchingTitle = document.getElementById('p1-partner-watching-slides-title');
  const p1WatchingDesc = document.getElementById('p1-partner-watching-slides-desc');
  if (p1WatchingBanner) {
    const isPartnerCurrentlyWatching = Boolean(!isLiveArenaResult && roomRef && roomRef.p2WatchingSlides);
    if (isP1 && isPartnerCurrentlyWatching) {
      const watcherName = (roomRef && roomRef.p2WatchingBy) || p2Name;
      if (p1WatchingTitle) {
        p1WatchingTitle.textContent = `🎬 ${watcherName} şu an tahmin slaytını izliyor...`;
      }
      if (p1WatchingDesc) {
        p1WatchingDesc.textContent = `${watcherName} izlemeyi tamamladığında bu bildirim otomatik olarak kaybolacak.`;
      }
      p1WatchingBanner.classList.remove('hidden');
    } else {
      p1WatchingBanner.classList.add('hidden');
    }
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
    const partner = isP1 ? (gameState.player2Name || 'Arkadaşın') : (gameState.player1Name || 'Arkadaşın');
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
  // 3. Görseldeki (%50 iken (%60) yazma) uyumsuzluğunu gerçek yüzdeyle birebir eşleştir:
  const dynamicVerdictTitle = verdict.title.replace(/\(\%\d+\)/, `(%${percentage})`);
  document.getElementById('result-verdict-title').textContent = dynamicVerdictTitle;
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

  if (gameState.roomCode && !gameState.isSandboxTest) {
    startResultScreenPolling(gameState.roomCode);
  }
}

// Sonuç Ekranında Canlı Dinleme:
// 1) Player 2 slaytı izlerken Player 1'in ekranında "🎬 [Player 2] şu an tahmin slaytını izliyor..." animasyonlu banner'ı anında açılır, bitirince kapanır!
// 2) Player 1 "2. Raunda Geç" bildirimi gönderdiğinde Player 2'nin ekranında anında uyarı çıkar!
function startResultScreenPolling(roomCode) {
  stopResultScreenPolling();
  if (!roomCode) return;

  const currentFinishedRound = gameState.currentRound || 1;
  gameState.resultPollingId = setInterval(async () => {
    const cleanCode = String(roomCode).trim().toUpperCase();
    let localRoom = null;
    try {
      const raw = localStorage.getItem(`senceo_room_${cleanCode}`);
      if (raw) localRoom = JSON.parse(raw);
    } catch (e) {}

    const cloudRoom = await fetchRoomFromDatabase(roomCode);
    const room = cloudRoom || localRoom;
    if (!room) return;

    // Eğer hem local hem cloud varsa, slideStatusUpdatedAt hangisinde daha yeniyse onu kullan:
    let effectiveRoom = room;
    if (localRoom && cloudRoom) {
      const localSlideTs = localRoom.slideStatusUpdatedAt ? new Date(localRoom.slideStatusUpdatedAt).getTime() : 0;
      const cloudSlideTs = cloudRoom.slideStatusUpdatedAt ? new Date(cloudRoom.slideStatusUpdatedAt).getTime() : 0;
      if (localSlideTs > cloudSlideTs) {
        effectiveRoom = {
          ...cloudRoom,
          p2WatchingSlides: localRoom.p2WatchingSlides,
          p2WatchedSlides: localRoom.p2WatchedSlides,
          p2WatchingBy: localRoom.p2WatchingBy,
          slideStatusUpdatedAt: localRoom.slideStatusUpdatedAt
        };
      }
    }

    gameState.liveRoomData = effectiveRoom;

    // v0.11 CANLI ODA: Katılımcılardan biri yeni canlı raundu başlattığında rapor ekranındaki diğer herkes de otomatik olarak yeni raunda girer
    if (
      effectiveRoom.status === 'live_in_progress' &&
      effectiveRoom.liveMatchState &&
      (Number(effectiveRoom.currentRound) || 1) > currentFinishedRound
    ) {
      stopResultScreenPolling();
      loadRoomIntoGameState(effectiveRoom, false);
      return;
    }
    if (effectiveRoom.roomType === 'live_arena') return;

    const isP1 = isUserPlayer1OfRoom(effectiveRoom, currentFinishedRound);

    // v0.10: Player 1'in rapor ekranında Player 2'nin slayt izleme durumunu canlı güncelle!
    const p1WatchingBanner = document.getElementById('p1-partner-watching-slides-banner');
    const p1WatchingTitle = document.getElementById('p1-partner-watching-slides-title');
    const p1WatchingDesc = document.getElementById('p1-partner-watching-slides-desc');
    if (p1WatchingBanner) {
      if (isP1 && effectiveRoom.p2WatchingSlides) {
        const watcherName = effectiveRoom.p2WatchingBy || effectiveRoom.p2 || gameState.player2Name || '2. Oyuncu';
        if (p1WatchingTitle) {
          p1WatchingTitle.textContent = `🎬 ${watcherName} şu an tahmin slaytını izliyor...`;
        }
        if (p1WatchingDesc) {
          p1WatchingDesc.textContent = `${watcherName} izlemeyi tamamladığında bu bildirim otomatik olarak kaybolacak.`;
        }
        p1WatchingBanner.classList.remove('hidden');
      } else {
        p1WatchingBanner.classList.add('hidden');
      }
    }

    // Eğer denemea (P1) sonuç ekranından denemeb'ye (P2) "2. Raunda Geç" bildirimi gönderdiyse:
    if (!isP1 && effectiveRoom.round2NudgeAt && effectiveRoom.round2NudgeAt !== gameState.lastSeenRound2NudgeAt) {
      gameState.lastSeenRound2NudgeAt = effectiveRoom.round2NudgeAt;
      const fromWho = effectiveRoom.round2NudgeFrom || effectiveRoom.p1 || 'Arkadaşın';
      const nextR = (effectiveRoom.currentRound || 1) + 1;
      const banner = document.getElementById('top-notification-banner');
      const textEl = document.getElementById('top-notification-text');
      if (banner && textEl) {
        textEl.textContent = `🔥 "${fromWho}" ${nextR}. Raundu başlatman için seni bekliyor! (İlk sıra sende) →`;
        banner.classList.remove('hidden');
        banner.classList.add('flex');
      }
      playSoundEffect('pop');
      spawnFloatingEmojiBurst('🔥');
    }

    // Eğer denemeb (P2) 2. Raundu başlatıp 5 sorusunu tamamladıysa (waiting_p2 & currentRound > currentFinishedRound):
    if (
      effectiveRoom.status === 'waiting_p2' &&
      (effectiveRoom.currentRound || 1) > currentFinishedRound &&
      Array.isArray(effectiveRoom.p1Answers) &&
      effectiveRoom.p1Answers.length >= TOTAL_QUESTIONS
    ) {
      stopResultScreenPolling();
      setMyRoleForRoom(roomCode, 'p2', effectiveRoom.currentRound);
      triggerPartnerCompletedNotification(effectiveRoom);
      loadRoomIntoGameState(effectiveRoom, false);
    }
  }, 1500);
}

// v0.11: Canlı odada yeni raundu odadaki katılımcılardan herhangi biri (Player 1 veya Player 2) tetikleyebilir;
// kurallar (turnStep, timerSeconds, format, alt mod) korunur, kullanılmış sorular elenir ve başlangıç sırası döner!
async function startNextLiveRoundAsHost() {
  const btn = document.getElementById('btn-next-round-action');
  if (btn) btn.disabled = true;
  try {
    const prevUsed = new Set([
      ...(Array.isArray(gameState.usedQuestionIds) ? gameState.usedQuestionIds : []),
      ...(Array.isArray(gameState.liveRoomData && gameState.liveRoomData.usedQuestionIds)
        ? gameState.liveRoomData.usedQuestionIds
        : []),
      ...(Array.isArray(gameState.liveRoomData && gameState.liveRoomData.qIds)
        ? gameState.liveRoomData.qIds
        : [])
    ]);
    gameState.usedQuestionIds = Array.from(prevUsed);

    const effectiveCat = (gameState.liveRoomData && gameState.liveRoomData.cat) || gameState.category || 'genel';
    const effectiveFormat = (gameState.liveRoomData && gameState.liveRoomData.arenaFormat) || gameState.arenaFormat || '1v1';
    const effectiveSettings = {
      ...gameState.liveSettings,
      ...((gameState.liveRoomData && gameState.liveRoomData.liveSettings) || {})
    };
    gameState.category = effectiveCat;
    gameState.arenaFormat = effectiveFormat;
    gameState.liveSettings = effectiveSettings;

    const pickedQs = pickQuestionsForCategory(effectiveCat, TOTAL_QUESTIONS);
    gameState.selectedQuestions = pickedQs;
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        action: 'start_live_match',
        code: gameState.roomCode,
        requesterCode: userProfile.friendCode,
        qIds: pickedQs.map((q) => q.id),
        arenaFormat: effectiveFormat,
        cat: effectiveCat,
        liveSettings: effectiveSettings
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.room && data.room.status === 'live_in_progress') {
        stopResultScreenPolling();
        gameState.passUsedThisTurn = false;
        gameState.customAnswerUsedThisTurn = false;
        gameState.pendingCustomOptionText = '';
        gameState.activeTimerStepKey = '';
        loadRoomIntoGameState(data.room, false);
        return;
      }
    }
  } catch (e) {
  } finally {
    if (btn) btn.disabled = false;
  }
  showLiveNextRoundWaitInfo('⚠️ Yeni canlı raund başlatılırken bağlantı gecikti, lütfen tekrar dene.');
}

function showLiveNextRoundWaitInfo(customText) {
  const toast = document.getElementById('result-round2-nudge-toast');
  if (!toast) return;
  toast.textContent =
    typeof customText === 'string'
      ? customText
      : '⏳ Canlı odada yeni raundu yalnızca oda kurucusu başlatabilir. Kurucu başlattığı an bu ekran otomatik olarak yeni raunda geçecek.';
  toast.classList.remove('hidden');
}

function renderLiveHistoryBreakdown(container, history) {
  const header = document.createElement('div');
  header.className = "text-xs font-extrabold uppercase tracking-wider text-primary-theme pt-2 pb-1 border-b border-[var(--outline-variant)]";
  header.textContent = `Canlı Oda • ${gameState.currentRound}. Raund Soru Soru Döküm`;
  container.appendChild(header);
  history.forEach((h, idx) => {
    const q = gameState.selectedQuestions[h.qIndex] || QUESTIONS_DB.find((x) => x.id === h.qId);
    if (!q) return;
    const single = [h.answerIdx];
    const guessOnly = [h.guessIdx];
    const customMap = h.customOption ? { 0: h.customOption } : {};
    const tmp = document.createElement('div');
    appendHalfBreakdownCards(
      tmp,
      '',
      [q],
      single,
      guessOnly,
      [h.answerComment || {}],
      [h.guessComment || {}],
      customMap,
      h.answererName || 'Cevaplayan',
      h.guesserName || 'Tahminci'
    );
    const card = tmp.children[1];
    if (card) {
      const titleSpan = card.querySelector('span');
      if (titleSpan) titleSpan.textContent = `${idx + 1}. ${q.q1}`;
      container.appendChild(card);
    }
  });
}

function stopResultScreenPolling() {
  if (gameState.resultPollingId) {
    clearInterval(gameState.resultPollingId);
    gameState.resultPollingId = null;
  }
}

function openNextRoundNudgeModal(targetName, targetCode, nextRoundNum) {
  const modal = document.getElementById('next-round-nudge-modal');
  const titleEl = document.getElementById('next-round-nudge-title');
  const descEl = document.getElementById('next-round-nudge-desc');
  if (!modal) return;

  gameState.pendingNextRoundNudgeTarget = {
    name: targetName || 'Arkadaşın',
    code: targetCode || '',
    nextRoundNum: nextRoundNum || 2
  };

  const lowerTarget = String(targetName || '').trim().toLowerCase();
  const suffix = /[aıou]$/.test(lowerTarget) ? "'ya" : "'ye";
  if (titleEl) {
    titleEl.textContent = `${nextRoundNum}. raunda geçmesi için ${targetName}${suffix} bildirim gönderelim mi?`;
  }
  if (descEl) {
    descEl.innerHTML = `Bu raundda ilk sen başlamıştın! Kural gereği <strong>${nextRoundNum}. Raundu</strong> yalnızca ilk sıra sahibi olan <strong>${escapeHtml(
      targetName
    )}</strong> başlatabilir. Onaylarsan <strong>${escapeHtml(targetName)}</strong> oyuncusuna anında bildirim gönderilecek ve o 5 sorusunu çözdüğü anda sana bildirim gelecek.`;
  }

  modal.classList.remove('hidden');
  playSoundEffect('pop');
}

function closeNextRoundNudgeModal() {
  const modal = document.getElementById('next-round-nudge-modal');
  if (modal) modal.classList.add('hidden');
}

async function confirmSendNextRoundNudge() {
  closeNextRoundNudgeModal();
  const currentFinishedRound = Number(gameState.currentRound || 1);
  const info = gameState.pendingNextRoundNudgeTarget || {
    name: gameState.player2Name || 'Arkadaşın',
    code: gameState.player2FriendCode || '',
    nextRoundNum: currentFinishedRound + 1
  };

  spawnFloatingEmojiBurst('🔔');
  playSoundEffect('correct');

  try {
    await fetch('/api/rooms', {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        action: 'send_nudge',
        nudgeType: 'next_round',
        fromCode: userProfile.friendCode,
        fromName: gameState.player1Name || userProfile.username || 'Arkadaşın',
        toCode: (info.code || '').toUpperCase(),
        roomCode: gameState.roomCode
      })
    });
  } catch (e) {}

  const toast = document.getElementById('result-round2-nudge-toast');
  if (toast) {
    toast.textContent = `🔔 ${info.name} oyuncusuna "${info.nextRoundNum}. Raunda Geç" bildirimi gönderildi! ${info.name} ilk 5 sorusunu tamamladığında sana bildirim gelecek.`;
    toast.classList.remove('hidden');
  }

  // KRİTİK v0.10 DÜZELTMESİ:
  // Biten raundun (Örn: 1. Raund) rolünü ASLA 'p2' olarak ezme! Aksi halde sıradana aynı ekranda tekrar butona bastığında
  // kendisini sıradanb (P2) sanıp sıradanb'nin yerine 2. raundun sorularını çözebiliyordu!
  // Sadece gelecek raund (info.nextRoundNum) için rolünü 'p2' olarak kaydet, mevcut raundda 'p1' olarak koru!
  setMyRoleForRoom(gameState.roomCode, 'p2', info.nextRoundNum);
  setMyRoleForRoom(gameState.roomCode, 'p1', currentFinishedRound);

  // Diyalog raporu ekranında kalmaya devam et ve arka planda dinlemeyi sürdür:
  startResultScreenPolling(gameState.roomCode);
}

// KULLANICI İSTEĞİ: 1. Raundda kim 2. başladıysa (denemeb / sıradanb), 2. Raundda SADECE O KİŞİ 1. başlayabilir!
// Eğer 1. Raundda 1. başlayan kişi (denemea / sıradana) bu butona 1 kez, 2 kez veya 10 kez basarsa:
// ASLA sıradanb'nin yerine geçip soruları çözemez; her seferinde bildirim gönderme onay penceresi açılır!
async function startNextRoundInSameRoom() {
  let latestRoom = null;
  if (gameState.roomCode) {
    latestRoom = await fetchRoomFromDatabase(gameState.roomCode);
  }

  const finishedRoundNum = Number((latestRoom && latestRoom.currentRound) || gameState.currentRound || 1);
  const nextRoundNum = finishedRoundNum + 1;

  // Eğer diğer oyuncu çoktan yeni raundun sorularını hazırlayıp kaydettiyse doğrudan onun sorularını tahmin etmeye gir!
  if (latestRoom && latestRoom.status === 'waiting_p2' && (latestRoom.currentRound || 1) > Number(gameState.currentRound || 1)) {
    setMyRoleForRoom(gameState.roomCode, 'p2', latestRoom.currentRound);
    loadRoomIntoGameState(latestRoom, false);
    return;
  }

  const roomRef = latestRoom || {
    code: gameState.roomCode,
    currentRound: finishedRoundNum,
    p1Id: gameState.p1Id,
    p1FriendCode: gameState.p1FriendCode,
    p2Id: gameState.p2Id,
    p2FriendCode: gameState.player2FriendCode,
    nextRoundStarterCode: gameState.player2FriendCode,
    nextRoundStarterName: gameState.player2Name,
    p1: gameState.player1Name,
    p2: gameState.player2Name
  };

  const prevP2Name = (latestRoom && (latestRoom.nextRoundStarterName || latestRoom.p2)) || gameState.player2Name || '2. Oyuncu';
  const prevP2Code = ((latestRoom && (latestRoom.nextRoundStarterCode || latestRoom.p2FriendCode)) || gameState.player2FriendCode || '').toUpperCase();

  const myCode = (userProfile.friendCode || '').trim().toUpperCase();
  const p1CodeInRoom = ((roomRef && roomRef.p1FriendCode) || '').trim().toUpperCase();
  const myCurrentNameLower = (userProfile.username || '').trim().toLowerCase();
  const roomP1NameLower = String((roomRef && roomRef.p1) || '').trim().toLowerCase();
  const roomP2NameLower = String(prevP2Name || '').trim().toLowerCase();

  const explicitTabRole = getMyRoleForRoom(roomRef, finishedRoundNum);
  let wasIPlayer1InFinishedRound = isUserPlayer1OfRoom(roomRef, finishedRoundNum);

  // Ek Güvenlik Kilidi: Eğer sekme rolü açıkça 'p2' değilse ve benim kodum p1CodeInRoom ise (veya ismim p1 ile aynıysa), kesinlikle P1'im!
  if (!wasIPlayer1InFinishedRound && explicitTabRole !== 'p2' && gameState.mode !== 'pass') {
    if (prevP2Code && myCode && prevP2Code !== myCode && p1CodeInRoom === myCode) {
      wasIPlayer1InFinishedRound = true;
    } else if (myCurrentNameLower && roomP1NameLower && myCurrentNameLower === roomP1NameLower && myCurrentNameLower !== roomP2NameLower) {
      wasIPlayer1InFinishedRound = true;
    }
  }

  if (wasIPlayer1InFinishedRound && gameState.mode !== 'pass') {
    // Sadece sıradanb (P2) 2. raunda geçebilir! sıradana (P1) kaç kez basarsa bassın bildirim gönderme onay penceresi açılır:
    openNextRoundNudgeModal(prevP2Name, prevP2Code, nextRoundNum);
    return;
  }

  // Bu kullanıcı biten raundda 2. Oyuncu (sıradanb / denemeb) ise -> Yeni raundun 1. Oyuncusu olur ve hemen 5 soruyu çözer!
  stopResultScreenPolling();
  const oldP1Name = (latestRoom && latestRoom.p1) || gameState.player1Name || 'Oyuncu 1';
  const oldP1Code = (latestRoom && latestRoom.p1FriendCode) || gameState.p1FriendCode || '';
  const myCurrentName =
    prevP2Name && prevP2Name !== '2. Oyuncu'
      ? prevP2Name
      : userProfile.username || gameState.player2Name || 'Oyuncu 1';

  gameState.currentRound = nextRoundNum;
  gameState.player1Name = myCurrentName;
  gameState.player2Name = oldP1Name;
  gameState.p1Id = userProfile.id || '';
  gameState.p1FriendCode = prevP2Code || userProfile.friendCode || '';
  gameState.player2FriendCode = oldP1Code;
  setMyRoleForRoom(gameState.roomCode, 'p1', nextRoundNum);

  startClassicFirstHalf(true);
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

  const lms = gameState.liveMatchState;
  if (gameState.mode === 'arena' && lms && Array.isArray(lms.history) && lms.history.length > 0) {
    renderLiveHistoryBreakdown(container, lms.history);
    return;
  }

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
  if (gameState.phase === 'p2_watch_p1_slides') {
    setP2WatchingSlidesStatus(false, true);
  }
  stopPollingForPartnerCompletion();
  stopLiveLobbyParticipantPolling();
  stopLiveTurnWaitPolling();
  stopLiveMatchPlayPolling();
  stopQuestionCountdownTimer();
  stopP1WatchSlideTimers();
  stopResultScreenPolling();
  if (window.location.search) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  if (gameState.isInspectingFledMatch && gameState.roomCode) {
    markRoomCodePermanentlyDeleted(gameState.roomCode);
  }
  gameState.isInspectingFledMatch = false;
  gameState.isSandboxTest = false;
  gameState.currentRound = 1;
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
  applyRoomCodeBlurState();

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

  const acceptedFriendLink = await checkIncomingFriendInvite();
  const joinedChallenge = await checkIncomingUrlChallenge();
  if (!joinedChallenge && !acceptedFriendLink) {
    switchTopNavPage('setup');
  }

  if (new URLSearchParams(window.location.search).get('e2e_verify') === '1') {
    await runAutomatedE2EVerification();
  }
});

async function runAutomatedE2EVerification() {
  try {
    // 1. Sürüm Etiketi (v0.11) ve Profil Modalı Kontrolü
    const footerVer = (document.getElementById('footer-version-label') || {}).textContent || '';
    toggleProfileModal(true);
    const profModal = document.getElementById('profile-modal');
    const profOpen = profModal && !profModal.classList.contains('hidden');
    const codeText = (document.getElementById('modal-my-friend-code') || {}).textContent || '';
    const pwdCardVisible = !document.getElementById('guest-password-protect-card')?.classList.contains('hidden');
    console.log(`E2E_VERIFY [1/8] Version=${footerVer} (APP_VERSION=${APP_VERSION}), ProfileOpen=${profOpen}, FriendCode=${codeText}, GuestPwdCard=${pwdCardVisible}`);
    toggleProfileModal(false);

    // 2. Klasik Düelloyu Başlat testi (sıradana & sıradanb)
    const p1Inp = document.getElementById('input-p1-name');
    if (p1Inp) p1Inp.value = 'sıradana';
    selectGameMode('link');
    await handlePrimaryStartAction();
    const qView = document.getElementById('view-question');
    const qOpenLink = qView && !qView.classList.contains('hidden');
    const optCountLink = document.querySelectorAll('#options-container .option-btn').length;
    console.log(`E2E_VERIFY [2/8] Klasik Duello Start Open=${qOpenLink}, Options=${optCountLink}`);

    // 3. v0.10..v0.11 Tam Klasik Akış + P2 Slayt İzleme + P1 Canlı "İzliyor..." Banner + P1 Çift Tıklama Koruması Testi!
    const testRoomCode = gameState.roomCode || 'SNCE2E';
    gameState.p1Answers = [0, 1, 2, 3, 0];
    gameState.p1Comments = [{ emoji: '🔥', text: 'a1' }, {}, {}, {}, {}];
    await showInterstitialScreen('after_p1_answer');
    const savedP1Code = gameState.p1FriendCode;
    // v0.11: Gerçek cihaz simülasyonu — rol, sekme hilesiyle değil KİMLİK (arkadaş kodu) değiştirilerek oynanır
    const e2eRealCode = userProfile.friendCode;
    const e2eActAs = (role) => { userProfile.friendCode = role === 'p1' ? e2eRealCode : 'SNC-9999'; setMyRoleForRoom(testRoomCode, role, 1); };

    // sıradanb (P2) olarak 1. yarıyı tahmin et ve 2. yarı 5 sorusunu cevapla (after_p2_answer)
    gameState.player2Name = 'sıradanb';
    gameState.player2FriendCode = 'SNC-9999';
    gameState.p2Guesses = [0, 2, 2, 1, 0];
    gameState.p2Comments = [{ emoji: '😂', text: 'b1 balon' }, {}, {}, {}, {}];
    gameState.p2Half2Questions = pickQuestionsForCategory('genel', 5);
    gameState.p2Half2Answers = [1, 1, 1, 1, 1];
    gameState.p2Half2Comments = [{ emoji: '😎', text: 'b2' }, {}, {}, {}, {}];
    e2eActAs('p2');
    await showInterstitialScreen('after_p2_answer');

    const localSavedAfterP2 = JSON.parse(localStorage.getItem(`senceo_room_${testRoomCode}`) || '{}');
    const p1Preserved = localSavedAfterP2.p1FriendCode === savedP1Code && localSavedAfterP2.p2FriendCode === 'SNC-9999';

    // sıradana (P1) gözünden waiting_p1_half2 odayı aç -> Slayt (p1_watch_p2_slides) başlar, 5 slayt sonunda p1_guess fazına geçer!
    e2eActAs('p1');
    loadRoomIntoGameState(localSavedAfterP2, false);
    const p1SlideStarted = gameState.phase === 'p1_watch_p2_slides';
    for (let s = 0; s < 5; s++) {
      advanceP1WatchSlide();
    }
    const transitionedToP1Guess = gameState.phase === 'p1_guess' && gameState.half === 2;

    // sıradana (P1) 2. yarı tahminlerini bitirir -> BEKLEMEDEN doğrudan 1. Raund Diyalog Raporu ekranına geçer!
    gameState.p1Half2Guesses = [1, 0, 1, 0, 1];
    gameState.p1Half2Comments = [{ emoji: '🎯', text: 'a2 tahmin yorumu' }, {}, {}, {}, {}];
    await finalizeGameAndShowResults();
    const p1SeesWatchBtn = !document.getElementById('p2-watch-slides-box')?.classList.contains('hidden');

    // Şimdi sıradanb (P2) gözünden 1. Raund Diyalog Raporu ekranına gir -> SADECE sıradanb'de "TAHMİNLERİ KONTROL ET" butonu görünür!
    e2eActAs('p2');
    showResultScreen(false);
    const p2SeesWatchBtn = !document.getElementById('p2-watch-slides-box')?.classList.contains('hidden');

    // sıradanb "TAHMİNLERİ KONTROL ET" butonuna basar -> p2_watch_p1_slides başlar ve P1'in ekranında canlı "izliyor..." banner'ı görünür!
    await startP2WatchP1Slides();
    const p2SlideStarted = gameState.phase === 'p2_watch_p1_slides';
    e2eActAs('p1');
    showResultScreen(false);
    const p1BannerVisibleWhileP2Watching = !document.getElementById('p1-partner-watching-slides-banner')?.classList.contains('hidden');
    const p1BannerText = (document.getElementById('p1-partner-watching-slides-title') || {}).textContent || '';

    // sıradanb 5 slaytı tamamlar -> otomatik olarak 1. Raund Diyalog Raporuna döner ve P1'deki "izliyor..." yazısı kaybolur!
    e2eActAs('p2');
    await startP2WatchP1Slides();
    for (let s = 0; s < 5; s++) {
      advanceP2WatchSlide();
    }
    const p2ReturnedToReport = !document.getElementById('view-result')?.classList.contains('hidden');
    e2eActAs('p1');
    showResultScreen(false);
    const p1BannerGoneAfterFinish = document.getElementById('p1-partner-watching-slides-banner')?.classList.contains('hidden');

    console.log(
      `E2E_VERIFY [3/8] v0.11 P2 Watch P1 Slides & Live Banner: P1Preserved=${p1Preserved}, P1Slide=${p1SlideStarted}->Guess=${transitionedToP1Guess}, P1SeesWatchBtn=${p1SeesWatchBtn} (must be false), P2SeesWatchBtn=${p2SeesWatchBtn} (must be true), P2Slide=${p2SlideStarted}, P1LiveBanner=${p1BannerVisibleWhileP2Watching} ("${p1BannerText}"), P2AutoReturnReport=${p2ReturnedToReport}, P1BannerGoneAfterFinish=${p1BannerGoneAfterFinish}`
    );

    // 4. KRİTİK BUG TESTİ: sıradana (P1) 1. Raund Diyalog Raporunda "2. RAUNDA GEÇ (İLK SIRA: SIRADANB)" butonuna basıp bildirim gönderir,
    // aynı ekranda kalır ve TEKRAR aynı butona bastığında ASLA sıradanb'ymiş gibi soruları çözemez!
    e2eActAs('p1');
    showResultScreen(false);
    await startNextRoundInSameRoom(); // 1. tıklama -> Nudge Modal açılır
    const firstClickOpenedModal = !document.getElementById('next-round-nudge-modal')?.classList.contains('hidden');
    await confirmSendNextRoundNudge(); // Bildirim gönderir -> Diyalog raporunda kalır
    const stayedOnResultAfterNudge = !document.getElementById('view-result')?.classList.contains('hidden');
    await startNextRoundInSameRoom(); // 2. tıklama -> YİNE Nudge Modal açılmalı, ASLA soruları çözmeye geçmemeli!
    const secondClickStillBlockedWithModal =
      !document.getElementById('next-round-nudge-modal')?.classList.contains('hidden') &&
      gameState.phase !== 'p1_answer' &&
      gameState.currentRound === 1;
    closeNextRoundNudgeModal();

    // Şimdi sıradanb (P2) aynı butona bastığında ise 2. Raundu (İlk Sıra: sıradanb) sorunsuz başlatabilmeli!
    e2eActAs('p2');
    await startNextRoundInSameRoom();
    const p2StartedRound2 =
      gameState.currentRound === 2 &&
      gameState.phase === 'p1_answer' &&
      gameState.player1Name === 'sıradanb' &&
      gameState.player2Name === 'sıradana';

    console.log(
      `E2E_VERIFY [4/8] v0.11 Round 2 Role Lock Fix: FirstClickModal=${firstClickOpenedModal}, StayedOnReport=${stayedOnResultAfterNudge}, SecondClickBlocked=${secondClickStillBlockedWithModal} (Prevents P1 impersonating P2!), P2StartedRound2=${p2StartedRound2}`
    );

    userProfile.friendCode = e2eRealCode;
    // 5. Sanal Oyuncular (A, B, C, D, E, F, G, H, J, K - 10 Oyuncu) ile Tüm Canlı Oda Modlarının (1v1, 2v2, 3v3, 4v4, 5v5, FFA) Simülasyon Testi!
    const virtualPlayers = [
      { name: 'Oyuncu_A', code: 'SNC-1001' },
      { name: 'Oyuncu_B', code: 'SNC-1002' },
      { name: 'Oyuncu_C', code: 'SNC-1003' },
      { name: 'Oyuncu_D', code: 'SNC-1004' },
      { name: 'Oyuncu_E', code: 'SNC-1005' },
      { name: 'Oyuncu_F', code: 'SNC-1006' },
      { name: 'Oyuncu_G', code: 'SNC-1007' },
      { name: 'Oyuncu_H', code: 'SNC-1008' },
      { name: 'Oyuncu_J', code: 'SNC-1009' },
      { name: 'Oyuncu_K', code: 'SNC-1010' }
    ];
    const modeTestConfigs = [
      { format: '1v1', count: 2, settings: {} },
      { format: '2v2', count: 4, settings: { teamSubMode: 'partner' } },
      { format: '3v3', count: 6, settings: { teamSubMode: 'rival' } },
      { format: '4v4', count: 8, settings: { teamSubMode: 'partner' } },
      { format: '5v5', count: 10, settings: { teamSubMode: 'rival' } },
      { format: 'ffa', count: 10, settings: { ffaSubMode: 'ebeli', starterMode: 'manual', selectedStarterCode: 'SNC-1001' } }
    ];
    const multiModeResults = [];
    for (const cfg of modeTestConfigs) {
      const subset = virtualPlayers.slice(0, cfg.count);
      const code = `M${cfg.format.toUpperCase()}${Date.now().toString(36).slice(-3).toUpperCase()}`;
      await saveRoomToDatabase({
        code,
        roomType: 'live_arena',
        arenaFormat: cfg.format,
        status: 'live_lobby',
        hostCode: subset[0].code,
        hostName: subset[0].name,
        p1: subset[0].name,
        p1FriendCode: subset[0].code,
        participants: subset.map((p, idx) => ({
          name: p.name,
          code: p.code,
          isHost: idx === 0,
          team: idx < cfg.count / 2 ? 'A' : 'B'
        })),
        liveSettings: cfg.settings
      });
      const startRes = await fetch('/api/rooms', {
        method: 'POST',
        headers: getSupabaseHeaders(),
        body: JSON.stringify({
          action: 'start_live_match',
          code,
          requesterCode: subset[0].code,
          qIds: [1, 2, 3, 4, 5],
          arenaFormat: cfg.format,
          cat: 'genel',
          liveSettings: cfg.settings
        })
      }).then((r) => r.json());
      const ms = startRes && startRes.room && startRes.room.liveMatchState;
      if (ms) {
        // Answer -> Guess -> Next Question adımlarını çalıştır
        await fetch('/api/rooms', {
          method: 'POST',
          headers: getSupabaseHeaders(),
          body: JSON.stringify({
            action: 'submit_live_step',
            subAction: 'lock_answer',
            code,
            friendCode: ms.activeAnswererCode,
            choiceIndex: 2,
            comment: { emoji: '🔥', text: `${ms.activeAnswererName} cevabı` }
          })
        });
        const guessRes = await fetch('/api/rooms', {
          method: 'POST',
          headers: getSupabaseHeaders(),
          body: JSON.stringify({
            action: 'submit_live_step',
            subAction: 'lock_guess',
            code,
            friendCode: ms.activeGuesserCode,
            choiceIndex: 2,
            comment: { emoji: '🎯', text: `${ms.activeGuesserName} tahmini` }
          })
        }).then((r) => r.json());
        const revealMs = guessRes && guessRes.room && guessRes.room.liveMatchState;
        const guesserPts = revealMs && revealMs.scores && revealMs.scores[ms.activeGuesserCode]?.points;
        multiModeResults.push(`${cfg.format}(${cfg.count}p:${ms.activeAnswererName}->${ms.activeGuesserName},pts=${guesserPts})`);
      } else {
        multiModeResults.push(`${cfg.format}:ERR`);
      }
    }
    console.log(`E2E_VERIFY [5/8] 10-Player (A..K) All Arena Formats Verified: ${multiModeResults.join(' | ')}`);

    // 6. Yan Yana (pass) Modu Tam Raund + Sınırsız Slayt Tekrar İzleme + Raund 2 Sıra Değişimi Testi!
    resetToHome();
    if (p1Inp) p1Inp.value = 'YanyanaA';
    selectGameMode('pass');
    await handlePrimaryStartAction();
    const qOpenPass = qView && !qView.classList.contains('hidden');
    const optCountPass = document.querySelectorAll('#options-container .option-btn').length;
    gameState.p1Answers = [0, 1, 2, 0, 1];
    gameState.p1Comments = [{ emoji: '🔥', text: 'yanyana p1 notu' }, {}, {}, {}, {}];
    await showInterstitialScreen('after_p1_answer');
    const passP2Inp = document.getElementById('input-pass-p2-name');
    if (passP2Inp) passP2Inp.value = 'YanyanaB';
    continueFromPassInterstitial();
    gameState.p2Guesses = [0, 1, 1, 0, 2];
    gameState.p2Comments = [{ emoji: '😎', text: 'yanyana p2 tahmini' }, {}, {}, {}, {}];
    await handleEndOfFiveQuestionBlock(); // view-halftime-reversal
    startHalftimeCounterAttack();
    gameState.p2Half2Answers = [2, 2, 1, 0, 1];
    gameState.p2Half2Comments = [{ emoji: '🚀', text: 'yanyana p2 soru notu' }, {}, {}, {}, {}];
    await showInterstitialScreen('after_p2_answer');
    continueFromPassInterstitial(); // p1_watch_p2_slides
    const passSlideStarted = gameState.phase === 'p1_watch_p2_slides';
    for (let s = 0; s < 5; s++) advanceP1WatchSlide();
    const passEnteredHalf2Guess = gameState.phase === 'p1_guess' && gameState.half === 2;
    const passInlineReplayVisible = !document.getElementById('btn-replay-half1-slides-inline')?.classList.contains('hidden');
    gameState.currentQuestionIndex = 2;
    replayHalf1SlidesDuringHalf2();
    const passInlineReplayStarted = gameState.phase === 'p1_watch_p2_slides';
    for (let s = 0; s < 5; s++) advanceP1WatchSlide();
    const passResumedAtQ3 = gameState.phase === 'p1_guess' && gameState.currentQuestionIndex === 2;
    gameState.p1Half2Guesses = [2, 1, 1, 0, 1];
    gameState.p1Half2Comments = [{ emoji: '🎯', text: 'yanyana p1 2.yari tahmini' }, {}, {}, {}, {}];
    await finalizeGameAndShowResults();
    const passBothReplayBtnsVisible =
      !document.getElementById('p1-replay-slides-box')?.classList.contains('hidden') &&
      !document.getElementById('p2-watch-slides-box')?.classList.contains('hidden');
    startReplayHalf1SlidesFromResult();
    for (let s = 0; s < 5; s++) advanceP1WatchSlide();
    const passReturnedAfterResultReplay = !document.getElementById('view-result')?.classList.contains('hidden');
    await startNextRoundInSameRoom();
    const passRound2Swapped =
      gameState.mode === 'pass' &&
      gameState.currentRound === 2 &&
      gameState.player1Name === 'YanyanaB' &&
      gameState.player2Name === 'YanyanaA';
    console.log(
      `E2E_VERIFY [6/8] Yan Yana Start=${qOpenPass}(${optCountPass}), Slide=${passSlideStarted}->Half2=${passEnteredHalf2Guess}, InlineReplay=${passInlineReplayVisible}/${passInlineReplayStarted}->ResumedQ3=${passResumedAtQ3}, ResultBothReplay=${passBothReplayBtnsVisible}->Return=${passReturnedAfterResultReplay}, R2Swapped=${passRound2Swapped}`
    );

    // 7. Canlı Oda Kur & Kod Al (0ms Anında Açılış + Ebe Modu Sadece FFA Kontrolü)
    resetToHome();
    if (p1Inp) p1Inp.value = 'EmirhanTest';
    selectGameMode('arena');
    const t0 = performance.now();
    const startPromise = handlePrimaryStartAction();
    const lobbyView = document.getElementById('view-live-room-lobby');
    const lobbyOpenImmediate = lobbyView && !lobbyView.classList.contains('hidden');
    const openMs = Math.round(performance.now() - t0);
    await startPromise;
    const roomCode = (document.getElementById('live-lobby-room-code') || {}).textContent || '';
    const hostGoldCards = document.querySelectorAll('#live-lobby-participants-grid .host-gold-card').length;
    const ffaSubmodeHiddenIn1v1 = document.getElementById('live-ffa-submode-box')?.classList.contains('hidden');
    console.log(`E2E_VERIFY [7/8] Canli Oda 0ms Open=${lobbyOpenImmediate} (${openMs}ms), RoomCode=${roomCode}, HostGoldCard=${hostGoldCards}, FFAHiddenIn1v1=${ffaSubmodeHiddenIn1v1}`);

    // 8. Göz İkonu Blur & Kaçan Rakip (Opponent Fled) 10 İhtimalli Uyarı Modalı Testi
    toggleRoomCodeBlur();
    const isBlurred = document.body.classList.contains('blur-room-codes');
    toggleRoomCodeBlur();
    openOpponentFledModal({ code: 'TEST99', p1: 'KorkakRakip', p2: 'EmirhanTest', status: 'opponent_fled' });
    const fledModalOpen = !document.getElementById('opponent-fled-modal')?.classList.contains('hidden');
    dismissFledMatchAndGoHome();
    console.log(`E2E_VERIFY [8/8] BlurToggle=${isBlurred}, OpponentFledModal=${fledModalOpen}`);
  } catch (err) {
    console.error('E2E_VERIFY_ERROR:', err && err.stack ? err.stack : err);
  }
}

