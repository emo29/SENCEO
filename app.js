// senceo — Ana Oyun Motoru, Bulut Veritabanı (Supabase & Vercel Cloud DB),
// Emoji/Yorum Sistemi, 1x Pas Jokeri ve Canlı Bildirim Kontrolcüsü (app.js) — v0.02

const APP_VERSION = 'v0.02';
const TOTAL_QUESTIONS = 5;
const CIRCLE_CIRCUMFERENCE = 414.69; // 2 * Math.PI * 66
const PASS_ANSWER_VALUE = -1; // Pas geçilen sorunun şık değeri

// 3 Tam Kapsamlı Tema Tanımları (Varsayılan: Cosmic Neon #6)
const THEMES = {
  cosmic: {
    id: 'cosmic',
    confettiColors: ['#ff007f', '#00f2fe', '#ff7b00', '#10b981']
  },
  crimson: {
    id: 'crimson',
    confettiColors: ['#ff002b', '#990014', '#ffffff', '#ff4d6a']
  },
  brutal26: {
    id: 'brutal26',
    confettiColors: ['#ccff00', '#ff4d00', '#b892ff', '#ffffff']
  }
};

// Uygulama Durumu (State)
const gameState = {
  theme: 'cosmic', // Varsayılan (Default) tema: Cosmic Neon (#6)
  mode: 'pass', // 'pass' (Yan Yana) | 'link' (Canlı Bulut Oda / Davet)
  category: 'genel', // 'genel' | 'cift' | 'kanka' | 'ekstrem'
  player1Name: '',
  player2Name: '',
  selectedQuestions: [], // 5 adet soru objesi
  p1Answers: [], // 1. oyuncunun seçtiği şık indeksleri (0-3 veya -1 = PAS)
  p2Guesses: [], // 2. oyuncunun tahmin ettiği şık indeksleri (0-3 veya -1 = PAS)
  p1Comments: [], // [{ emoji: '🔥', text: '...' }, ...]
  p2Comments: [], // [{ emoji: '😂', text: '...' }, ...]
  p1PassUsed: false, // 1. Oyuncunun 1 adet Pas Jokeri hakkı (#7)
  p2PassUsed: false, // 2. Oyuncunun 1 adet Pas Jokeri hakkı (#7)
  currentQuestionIndex: 0,
  currentTurn: 1, // 1: Oyuncu 1 cevaplıyor | 2: Oyuncu 2 tahmin ediyor
  isLocked: false,
  pendingChoiceIndex: null, // Şık seçildikten sonra yorum/emoji yazılıp onaylanmayı bekleyen seçim
  pendingEmoji: '', // Aktif soruda seçilen tepki emojisi
  roomCode: '', // Bulut veritabanı 6 haneli oda kodu
  generatedChallengeUrl: '',
  pollingIntervalId: null,
  completedRoomDataFromCloud: null
};

// Yüzdelik Uyum Yorumları
const SCORE_VERDICTS = {
  100: {
    title: "🧠 Siz tek beyinli iki insan mısınız?! (%100)",
    desc: "İnanılmaz! Telepati kurduğunuz kesinleşti. Birbirinizin ne düşündüğünü ve ne yorum yazacağını kelimesi kelimesine biliyorsunuz!"
  },
  80: {
    title: "🔥 Efsane İkili! Neredeyse Kusursuz! (%80)",
    desc: "Sadece tek bir soruda fire verdiniz! Birbirinizi ciğerinize kadar tanıyorsunuz, aranızdaki bağ gerçekten çok güçlü."
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
    desc: "Sadece 1 doğru tahmin mi?! Sanırım birbirinizi tanıdığınızı sadece zannediyormuşsunuz. Acilen tanışma faslını baştan alın!"
  },
  0: {
    title: "💀 Tam Bir Felaket! Sıfır Çektiniz! (%0)",
    desc: "Hiçbir tahminde tutturamadınız! Gözlerinizi kapatıp rastgele bassaydınız bile en azından 1 tanesi tutardı. Siz tanıştığınıza emin misiniz?!"
  }
};

// ---------------- TEMA MOTORU VE AYARLAR MODALI ----------------
function applyTheme(themeKey) {
  const validTheme = THEMES[themeKey] ? themeKey : 'cosmic';
  gameState.theme = validTheme;
  document.documentElement.setAttribute('data-theme', validTheme);

  try {
    localStorage.setItem('senceo_theme', validTheme);
  } catch (e) {}

  // Üst barda tema ismi yazmaz, sadece sürüm numarası yazar (#3)
  const headerTag = document.getElementById('header-version-tag');
  if (headerTag) {
    headerTag.textContent = APP_VERSION;
  }
  const pcCornerTag = document.getElementById('pc-corner-version');
  if (pcCornerTag) {
    pcCornerTag.textContent = `${APP_VERSION} • CANLI BULUT DB`;
  }

  // Ayarlar modalındaki tema kartlarının seçili çerçevesini güncelle
  ['cosmic', 'crimson', 'brutal26'].forEach((key) => {
    const card = document.getElementById(`theme-card-${key}`);
    if (!card) return;
    if (key === validTheme) {
      card.style.borderColor = 'var(--accent-1)';
      card.style.boxShadow = '0 0 20px rgba(0, 242, 254, 0.28)';
    } else {
      card.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      card.style.boxShadow = 'none';
    }
  });
}

function initSavedTheme() {
  let initialTheme = 'cosmic'; // Varsayılan: Cosmic Neon (#6)
  try {
    const saved = localStorage.getItem('senceo_theme');
    if (saved && THEMES[saved]) {
      initialTheme = saved;
    }
    const sbUrl = localStorage.getItem('senceo_supabase_url') || '';
    const sbKey = localStorage.getItem('senceo_supabase_key') || '';
    const urlInput = document.getElementById('input-supabase-url');
    const keyInput = document.getElementById('input-supabase-key');
    if (urlInput) urlInput.value = sbUrl;
    if (keyInput) keyInput.value = sbKey;
  } catch (e) {
    initialTheme = 'cosmic';
  }
  applyTheme(initialTheme);
}

function toggleSettingsModal(show) {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  if (show) {
    modal.classList.remove('hidden');
  } else {
    modal.classList.add('hidden');
  }
}

function saveSettingsAndClose() {
  try {
    const urlInput = document.getElementById('input-supabase-url');
    const keyInput = document.getElementById('input-supabase-key');
    if (urlInput) localStorage.setItem('senceo_supabase_url', urlInput.value.trim());
    if (keyInput) localStorage.setItem('senceo_supabase_key', keyInput.value.trim());
  } catch (e) {}
  toggleSettingsModal(false);
}

function toggleCloudJoinModal(show) {
  const modal = document.getElementById('cloud-join-modal');
  if (!modal) return;
  const errEl = document.getElementById('join-room-error');
  if (errEl) errEl.classList.add('hidden');
  if (show) {
    modal.classList.remove('hidden');
    const inp = document.getElementById('input-join-room-code');
    if (inp) inp.focus();
  } else {
    modal.classList.add('hidden');
  }
}

// ---------------- "THE TEST" İMZA ANİMASYONU: UÇUŞAN EMOJİ PATLAMASI ----------------
function spawnFloatingEmojiBurst(emojiChar, originEvent) {
  const count = 6;
  const startX = originEvent && originEvent.clientX ? originEvent.clientX : window.innerWidth / 2;
  const startY = originEvent && originEvent.clientY ? originEvent.clientY : window.innerHeight * 0.65;

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'floating-emoji-particle';
    el.textContent = emojiChar;
    const offsetX = (Math.random() - 0.5) * 140;
    const offsetY = (Math.random() - 0.5) * 40;
    el.style.left = `${startX + offsetX}px`;
    el.style.top = `${startY + offsetY}px`;
    el.style.animationDuration = `${1.0 + Math.random() * 0.55}s`;
    document.body.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 1600);
  }
}

// ---------------- PC SOL & SAĞ YAN PANELLERİ GÜNCELLEME ----------------
function updateSidePanels() {
  // 1. Pas Jokeri Durumu
  const sidePassEl = document.getElementById('side-pass-status');
  const currentPassUsed = gameState.currentTurn === 1 ? gameState.p1PassUsed : gameState.p2PassUsed;
  if (sidePassEl) {
    if (currentPassUsed) {
      sidePassEl.textContent = "0 / 1 KULLANILDI";
      sidePassEl.className = "px-2 py-0.5 rounded bg-red-500/25 text-red-300 text-xs font-extrabold font-mono-theme";
    } else {
      sidePassEl.textContent = "1 / 1 HAZIR";
      sidePassEl.className = "px-2 py-0.5 rounded bg-emerald-500/25 text-emerald-300 text-xs font-extrabold font-mono-theme";
    }
  }

  // 2. Bulut Oda Kodu Rozeti
  const roomBadge = document.getElementById('side-room-code-badge');
  if (roomBadge) {
    roomBadge.textContent = gameState.roomCode || "YOK";
  }

  // 3. Canlı Uyum Termometresi (2. oyuncu tahmin yaparken dinamik hesaplanır)
  const thermoText = document.getElementById('side-thermometer-text');
  const thermoBar = document.getElementById('side-thermometer-bar');
  if (thermoText && thermoBar) {
    if (gameState.p2Guesses.length === 0) {
      thermoText.textContent = "%100";
      thermoBar.style.width = "100%";
    } else {
      const answeredCount = gameState.p2Guesses.length;
      let matches = 0;
      for (let i = 0; i < answeredCount; i++) {
        if (isQuestionMatch(gameState.p1Answers[i], gameState.p2Guesses[i])) {
          matches++;
        }
      }
      const ratio = Math.round((matches / answeredCount) * 100);
      thermoText.textContent = `%${ratio}`;
      thermoBar.style.width = `${ Math.max(8, ratio) }%`;
    }
  }
}

function appendToLiveReactionFeed(playerName, qNum, emoji, commentText, isPass) {
  const feed = document.getElementById('side-live-Reaction-feed');
  if (!feed) return;

  const item = document.createElement('div');
  item.className = "glass-pill p-3 space-y-1 animate-view border-l-4 border-accent-1";
  const badge = isPass ? '<span class="text-amber-400 font-bold">[PAS GEÇTİ ⏭️]</span>' : '';
  const emojiSpan = emoji ? `<span class="text-base">${emoji}</span>` : '💬';
  const safeComment = commentText ? escapeHtml(commentText) : '<em class="opacity-60">Yorum bırakmadı</em>';

  item.innerHTML = `
    <div class="flex items-center justify-between text-[11px] font-bold">
      <span class="text-accent-1">${escapeHtml(playerName)} • Soru ${qNum}</span>
      <span>${emojiSpan}</span>
    </div>
    <p class="text-xs text-white/90 leading-snug">${badge} ${safeComment}</p>
  `;
  feed.prepend(item);
}

// ---------------- UTF-8 GÜVENLİ BASE64 ENCODE / DECODE ----------------
function encodeChallengePayload(payloadObj) {
  const jsonString = JSON.stringify(payloadObj);
  const bytes = new TextEncoder().encode(jsonString);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return encodeURIComponent(btoa(binary));
}

function decodeChallengePayload(encodedStr) {
  try {
    const base64 = decodeURIComponent(encodedStr);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonString = new TextDecoder().decode(bytes);
    return JSON.parse(jsonString);
  } catch (err) {
    console.error("Challenge URL çözümlenemedi:", err);
    return null;
  }
}

// ---------------- BULUT VERİTABANI (VERCEL /api/rooms & SUPABASE) İŞLEMLERİ ----------------
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "SNC";
  for (let i = 0; i < 3; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getSupabaseHeaders() {
  const headers = { "Content-Type": "application/json" };
  try {
    const sbUrl = localStorage.getItem('senceo_supabase_url');
    const sbKey = localStorage.getItem('senceo_supabase_key');
    if (sbUrl && sbKey) {
      headers["X-Supabase-Url"] = sbUrl;
      headers["X-Supabase-Key"] = sbKey;
    }
  } catch (e) {}
  return headers;
}

async function saveRoomToDatabase(roomPayload) {
  try {
    // 1. Yerel önbelleğe de kaydet
    localStorage.setItem(`senceo_room_${roomPayload.code}`, JSON.stringify(roomPayload));
  } catch (e) {}

  try {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({ room: roomPayload })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.room || roomPayload;
  } catch (err) {
    console.warn("Bulut veritabanı kaydı yerel yedekle devam ediyor:", err);
    return roomPayload;
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
      if (data && data.room) return data.room;
    }
  } catch (err) {
    console.warn("Sunucudan oda okunamadı, yerel önbelleğe bakılıyor:", err);
  }

  try {
    const localRaw = localStorage.getItem(`senceo_room_${cleanCode}`);
    if (localRaw) return JSON.parse(localRaw);
  } catch (e) {}

  return null;
}

// 1. Oyuncu Bulut Odayı kurduğunda karşı oyuncunun testi bitirmesini canlı dinler
function startPollingForPartnerCompletion(roomCode) {
  stopPollingForPartnerCompletion();
  if (!roomCode) return;

  gameState.pollingIntervalId = setInterval(async () => {
    const room = await fetchRoomFromDatabase(roomCode);
    if (room && room.status === 'completed' && Array.isArray(room.p2Guesses) && room.p2Guesses.length > 0) {
      stopPollingForPartnerCompletion();
      triggerPartnerCompletedNotification(room);
    }
  }, 4000);
}

function stopPollingForPartnerCompletion() {
  if (gameState.pollingIntervalId) {
    clearInterval(gameState.pollingIntervalId);
    gameState.pollingIntervalId = null;
  }
}

// Karşı oyuncu bitirdiğinde sağ üstte çıkan bildirim ("'X' oyuncu testi cevaplandırdı şimdi kontrol et!")
function triggerPartnerCompletedNotification(completedRoom) {
  gameState.completedRoomDataFromCloud = completedRoom;
  const banner = document.getElementById('top-notification-banner');
  const textEl = document.getElementById('top-notification-text');
  if (!banner || !textEl) return;

  const p2 = completedRoom.p2 || 'Arkadaşın';
  textEl.textContent = `"${p2}" testi cevaplandırdı! Şimdi kontrol et →`;
  banner.classList.remove('hidden');
  banner.classList.add('flex');

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

  // Oda verilerini gameState'e yükle ve doğrudan Sonuç Ekranını aç!
  const loadedQuestions = (room.qIds || [])
    .map((id) => QUESTIONS_DB.find((q) => q.id === id))
    .filter(Boolean);

  if (loadedQuestions.length > 0) {
    gameState.selectedQuestions = loadedQuestions;
  }
  gameState.player1Name = room.p1 || gameState.player1Name;
  gameState.player2Name = room.p2 || 'Arkadaşın';
  gameState.p1Answers = room.p1Answers || [];
  gameState.p2Guesses = room.p2Guesses || [];
  gameState.p1Comments = room.p1Comments || [];
  gameState.p2Comments = room.p2Comments || [];

  updateHeaderVSBar();
  updateSidePanels();
  showResultScreen();
}

// ---------------- EKRAN GEÇİŞ YÖNETİCİSİ ----------------
const ALL_VIEWS = [
  'view-home',
  'view-challenge-welcome',
  'view-question',
  'view-interstitial',
  'view-result'
];

function showView(viewId) {
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

  const counterBadgeMob = document.getElementById('header-counter-badge');
  const counterBadgePc = document.getElementById('header-counter-badge-pc');
  const homeBadge = document.getElementById('header-home-badge');

  if (viewId === 'view-question') {
    if (counterBadgeMob) {
      counterBadgeMob.classList.remove('hidden');
      counterBadgeMob.classList.add('flex');
    }
    if (counterBadgePc) {
      counterBadgePc.classList.remove('hidden');
      counterBadgePc.classList.add('flex');
    }
    if (homeBadge) homeBadge.classList.add('hidden');
  } else {
    if (counterBadgeMob) {
      counterBadgeMob.classList.add('hidden');
      counterBadgeMob.classList.remove('flex');
    }
    if (counterBadgePc) {
      counterBadgePc.classList.add('hidden');
      counterBadgePc.classList.remove('flex');
    }
    if (homeBadge) homeBadge.classList.remove('hidden');
  }

  updateSidePanels();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------------- ÜST BAR (VS BAR) GÜNCELLEMELERİ ----------------
function updateHeaderVSBar() {
  const p1Display = gameState.player1Name.trim() || 'Oyuncu 1';
  const p2Display = gameState.player2Name.trim() || (gameState.mode === 'link' ? 'Arkadaşın' : 'Oyuncu 2');

  document.getElementById('vs-p1-name').textContent = p1Display;
  document.getElementById('vs-p2-name').textContent = p2Display;
}

function syncHeaderNames() {
  const p1Input = document.getElementById('input-p1-name');
  const p2Input = document.getElementById('input-p2-name');
  gameState.player1Name = p1Input ? p1Input.value : '';
  gameState.player2Name = p2Input ? p2Input.value : '';
  updateHeaderVSBar();
}

function syncHeaderNamesFromPass() {
  const passInput = document.getElementById('input-pass-p2-name');
  if (passInput) {
    gameState.player2Name = passInput.value;
    updateHeaderVSBar();
  }
}

// ---------------- BAŞLANGIÇ EKRANI SEÇİMLERİ ----------------
function selectGameMode(mode) {
  gameState.mode = mode;
  const passBtn = document.getElementById('mode-btn-pass');
  const linkBtn = document.getElementById('mode-btn-link');
  const passCheck = document.getElementById('mode-check-pass');
  const linkCheck = document.getElementById('mode-check-link');
  const p2Wrapper = document.getElementById('p2-name-home-wrapper');

  if (mode === 'pass') {
    passBtn.classList.add('is-active');
    linkBtn.classList.remove('is-active');
    passCheck.className = "w-5 h-5 rounded-full bg-accent-1 text-black text-xs flex items-center justify-center font-extrabold opacity-100";
    linkCheck.className = "w-5 h-5 rounded-full bg-white/10 text-xs flex items-center justify-center font-extrabold opacity-0";
    p2Wrapper.classList.remove('hidden');
  } else {
    linkBtn.classList.add('is-active');
    passBtn.classList.remove('is-active');
    linkCheck.className = "w-5 h-5 rounded-full bg-accent-1 text-black text-xs flex items-center justify-center font-extrabold opacity-100";
    passCheck.className = "w-5 h-5 rounded-full bg-white/10 text-xs flex items-center justify-center font-extrabold opacity-0";
    p2Wrapper.classList.add('hidden');
  }

  updateHeaderVSBar();
}

function selectCategory(category) {
  gameState.category = category;
  const buttons = document.querySelectorAll('.cat-btn');
  buttons.forEach((btn) => {
    const btnCat = btn.getAttribute('data-cat');
    if (btnCat === category) {
      btn.classList.add('is-active');
    } else {
      btn.classList.remove('is-active');
    }
  });
}

// ---------------- SORU SEÇİMİ (5 SORU) ----------------
function pickQuestionsForCategory(category) {
  const primary = QUESTIONS_DB.filter((q) => q.category === category);
  const others = QUESTIONS_DB.filter((q) => q.category !== category);
  const pool = [...shuffleArray(primary), ...shuffleArray(others)];
  return pool.slice(0, TOTAL_QUESTIONS);
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ---------------- 1. OYUNCU TURUNU BAŞLAT ----------------
function startPlayerOneTurn() {
  const p1Input = document.getElementById('input-p1-name');
  const p2Input = document.getElementById('input-p2-name');
  const errorBox = document.getElementById('home-error');
  const errorText = document.getElementById('home-error-text');

  const p1Name = p1Input.value.trim();
  const p2Name = p2Input ? p2Input.value.trim() : '';

  if (!p1Name) {
    errorText.textContent = "Lütfen teste başlamadan önce kendi adını (1. Oyuncu) yaz!";
    errorBox.classList.remove('hidden');
    p1Input.focus();
    return;
  }

  errorBox.classList.add('hidden');

  gameState.player1Name = p1Name;
  gameState.player2Name = p2Name;
  gameState.selectedQuestions = pickQuestionsForCategory(gameState.category);
  gameState.p1Answers = [];
  gameState.p2Guesses = [];
  gameState.p1Comments = [];
  gameState.p2Comments = [];
  gameState.p1PassUsed = false;
  gameState.p2PassUsed = false;
  gameState.currentQuestionIndex = 0;
  gameState.currentTurn = 1;
  gameState.isLocked = false;
  gameState.pendingChoiceIndex = null;
  gameState.pendingEmoji = '';
  gameState.roomCode = gameState.mode === 'link' ? generateRoomCode() : '';

  updateHeaderVSBar();
  updateSidePanels();
  showView('view-question');
  renderCurrentQuestion();
}

// ---------------- SORU EKRANINI RENDER ET ----------------
function renderCurrentQuestion() {
  const qIndex = gameState.currentQuestionIndex;
  const questionObj = gameState.selectedQuestions[qIndex];
  if (!questionObj) return;

  const counterText = `SORU ${qIndex + 1} / ${TOTAL_QUESTIONS}`;
  const counterEl = document.getElementById('header-question-counter');
  const counterMobEl = document.getElementById('header-question-counter-mob');
  if (counterEl) counterEl.textContent = counterText;
  if (counterMobEl) counterMobEl.textContent = counterText;

  const progressPercent = ((qIndex + 1) / TOTAL_QUESTIONS) * 100;
  document.getElementById('question-progress-bar').style.width = `${progressPercent}%`;

  document.getElementById('question-category-pill').textContent = questionObj.categoryLabel || '🌟 Genel';

  // Geri bildirim ve yorum çekmecesini sıfırla
  const feedbackBanner = document.getElementById('guess-feedback-banner');
  feedbackBanner.classList.add('hidden');

  const commentDrawer = document.getElementById('post-answer-comment-box');
  commentDrawer.classList.add('hidden');

  const p1RevealedNoteBox = document.getElementById('p1-revealed-note-box');
  p1RevealedNoteBox.classList.add('hidden');

  const commentInput = document.getElementById('input-question-comment');
  if (commentInput) commentInput.value = '';
  gameState.pendingChoiceIndex = null;
  gameState.pendingEmoji = '';
  resetEmojiPickButtons();

  // Pas Jokeri Butonunu Güncelle (#7: Oyun boyunca sadece 1 adet Pas hakkı)
  const passBtn = document.getElementById('btn-use-pass');
  const passLabel = document.getElementById('btn-pass-label');
  const isPassUsed = gameState.currentTurn === 1 ? gameState.p1PassUsed : gameState.p2PassUsed;
  if (passBtn && passLabel) {
    if (isPassUsed) {
      passBtn.disabled = true;
      passBtn.className = "px-3.5 py-1 rounded-full bg-white/10 text-white/40 font-bold text-xs sm:text-sm cursor-not-allowed flex items-center gap-1.5";
      passLabel.textContent = "Pas Hakkı Bitti (0/1)";
    } else {
      passBtn.disabled = false;
      passBtn.className = "px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-black font-extrabold text-xs sm:text-sm shadow-md hover:scale-105 active:scale-95 transition flex items-center gap-1.5";
      passLabel.textContent = "Pas Geç (1 Hak)";
    }
  }

  const turnBadge = document.getElementById('question-turn-badge');
  const stepLabel = document.getElementById('question-step-label');
  const questionTextEl = document.getElementById('question-text');

  if (gameState.currentTurn === 1) {
    turnBadge.innerHTML = `<span>😎</span> <span>${escapeHtml(gameState.player1Name)} Cevaplıyor</span>`;
    stepLabel.textContent = "KENDİ ADINA CEVAPLA (VEYA 1 KEZ PAS GEÇ)";
    questionTextEl.textContent = questionObj.q1;
  } else {
    const p2Name = gameState.player2Name || '2. Oyuncu';
    turnBadge.innerHTML = `<span>🕵️</span> <span>${escapeHtml(p2Name)} Tahmin Ediyor</span>`;
    const p1DidPass = gameState.p1Answers[qIndex] === PASS_ANSWER_VALUE;
    stepLabel.textContent = p1DidPass
      ? `⚡ İPUCU: ${gameState.player1Name.toUpperCase()} BU SORUDA ZORLANDI! SENCE NE YAPTI?`
      : `SENCE ${gameState.player1Name.toUpperCase()} NE SEÇMİŞTİR?`;
    questionTextEl.textContent = questionObj.q2.replace('{p1}', gameState.player1Name);
  }

  // 4 Büyük Şık Butonu (PC'de 2x2 Grid, Mobilde Alt Alta)
  const optionsContainer = document.getElementById('options-container');
  optionsContainer.innerHTML = '';

  questionObj.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = "option-btn w-full p-4 sm:p-5 text-left flex items-center gap-4 focus:outline-none";
    btn.innerHTML = `
      <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-black/70 border border-white/15 flex items-center justify-center text-2xl sm:text-3xl shrink-0 shadow-inner">
        ${opt.icon}
      </div>
      <div class="flex-1 text-sm sm:text-base xl:text-lg font-bold leading-snug">
        ${escapeHtml(opt.text)}
      </div>
      <div class="option-status-icon w-7 h-7 rounded-full border border-white/25 flex items-center justify-center text-sm shrink-0 opacity-75">
      </div>
    `;
    btn.addEventListener('click', (ev) => handleOptionSelect(idx, btn, ev));
    optionsContainer.appendChild(btn);
  });

  gameState.isLocked = false;
  updateSidePanels();
}

// ---------------- 1 ADET KULLANILABİLEN PAS JOKERİ (#7) ----------------
function handlePassQuestion() {
  if (gameState.isLocked) return;

  const isPassUsed = gameState.currentTurn === 1 ? gameState.p1PassUsed : gameState.p2PassUsed;
  if (isPassUsed) return;

  gameState.isLocked = true;
  if (gameState.currentTurn === 1) {
    gameState.p1PassUsed = true;
  } else {
    gameState.p2PassUsed = true;
  }

  // Tüm şıkları kilitle
  const allButtons = document.querySelectorAll('#options-container .option-btn');
  allButtons.forEach((b) => {
    b.disabled = true;
    b.classList.add('opacity-50');
  });

  const passBtn = document.getElementById('btn-use-pass');
  if (passBtn) passBtn.disabled = true;

  spawnFloatingEmojiBurst('⏭️');

  // Pas geçilse bile yorum ve emoji yazabilsin (#7)
  const feedbackBanner = document.getElementById('guess-feedback-banner');
  feedbackBanner.classList.remove('hidden');

  if (gameState.currentTurn === 1) {
    feedbackBanner.className = "rounded-xl px-4 py-3 text-center font-bold text-sm sm:text-base bg-amber-500/25 border border-amber-400/60 text-amber-200";
    feedbackBanner.textContent = `⏭️ Pas Jokerini kullandın! Sonraki soruya geçmeden önce neden pas geçtiğini veya yorumunu aşağıya yazabilirsin.`;
  } else {
    const qIndex = gameState.currentQuestionIndex;
    const correctIndex = gameState.p1Answers[qIndex];
    if (correctIndex >= 0 && allButtons[correctIndex]) {
      allButtons[correctIndex].classList.remove('opacity-50');
      allButtons[correctIndex].classList.add('option-correct');
    }
    feedbackBanner.className = "rounded-xl px-4 py-3 text-center font-bold text-sm sm:text-base bg-amber-500/25 border border-amber-400/60 text-amber-200";
    feedbackBanner.textContent = `⏭️ Pas Jokerini kullandın! (Bu soru doğru sayıldı). Şimdi ${gameState.player1Name}'in notunu gör ve kendi yorumunu yaz!`;
  }

  openPostAnswerCommentDrawer(PASS_ANSWER_VALUE);
  updateSidePanels();
}

// ---------------- ŞIK SEÇİMİ VE EMOJİ/YORUM ÇEKMECESİNİN AÇILMASI ----------------
function handleOptionSelect(selectedIndex, clickedBtn, clickEvent) {
  if (gameState.isLocked) return;
  gameState.isLocked = true;

  const allButtons = document.querySelectorAll('#options-container .option-btn');
  allButtons.forEach((b) => (b.disabled = true));

  const passBtn = document.getElementById('btn-use-pass');
  if (passBtn) passBtn.disabled = true;

  const qIndex = gameState.currentQuestionIndex;
  const chosenEmoji = gameState.selectedQuestions[qIndex]?.options[selectedIndex]?.icon || '✨';
  spawnFloatingEmojiBurst(chosenEmoji, clickEvent);

  if (gameState.currentTurn === 1) {
    clickedBtn.classList.add('option-selected-p1');
    const statusIcon = clickedBtn.querySelector('.option-status-icon');
    if (statusIcon) {
      statusIcon.innerHTML = '✓';
      statusIcon.className = 'option-status-icon w-7 h-7 rounded-full bg-accent-1 text-black font-extrabold flex items-center justify-center text-sm shrink-0';
    }
  } else {
    // 2. Oyuncu tahmin yapıyor -> Doğru/Yanlış kontrolü
    const correctIndex = gameState.p1Answers[qIndex];
    const feedbackBanner = document.getElementById('guess-feedback-banner');
    feedbackBanner.classList.remove('hidden');

    if (correctIndex === PASS_ANSWER_VALUE) {
      // 1. Oyuncu bu soruyu Pas geçmişti!
      clickedBtn.classList.add('option-correct');
      feedbackBanner.className = "rounded-xl px-4 py-3 text-center font-bold text-sm sm:text-base bg-emerald-500/25 border border-emerald-400/60 text-emerald-200";
      feedbackBanner.textContent = `⏭️ Sürpriz! ${gameState.player1Name} bu soruda Pas Jokerini kullanmıştı! Bakalım aşağıda ne yorum bırakmış?`;
    } else if (selectedIndex === correctIndex) {
      clickedBtn.classList.add('option-correct');
      const statusIcon = clickedBtn.querySelector('.option-status-icon');
      if (statusIcon) {
        statusIcon.innerHTML = '✓';
        statusIcon.className = 'option-status-icon w-7 h-7 rounded-full bg-emerald-400 text-black font-extrabold flex items-center justify-center text-sm shrink-0';
      }
      feedbackBanner.className = "rounded-xl px-4 py-3 text-center font-bold text-sm sm:text-base bg-emerald-500/25 border border-emerald-400/60 text-emerald-200 animate-pulse";
      feedbackBanner.textContent = `🎯 Tam İsabet! ${gameState.player1Name} tam olarak bunu seçmişti!`;
      spawnFloatingEmojiBurst('🎯', clickEvent);
    } else {
      clickedBtn.classList.add('option-wrong');
      const wrongIcon = clickedBtn.querySelector('.option-status-icon');
      if (wrongIcon) {
        wrongIcon.innerHTML = '✕';
        wrongIcon.className = 'option-status-icon w-7 h-7 rounded-full bg-red-500 text-white font-extrabold flex items-center justify-center text-sm shrink-0';
      }

      const correctBtn = allButtons[correctIndex];
      if (correctBtn) {
        correctBtn.classList.add('option-correct');
        const rightIcon = correctBtn.querySelector('.option-status-icon');
        if (rightIcon) {
          rightIcon.innerHTML = '✓';
          rightIcon.className = 'option-status-icon w-7 h-7 rounded-full bg-emerald-400 text-black font-extrabold flex items-center justify-center text-sm shrink-0';
        }
      }

      feedbackBanner.className = "rounded-xl px-4 py-3 text-center font-bold text-sm sm:text-base bg-red-500/25 border border-red-400/60 text-red-200";
      feedbackBanner.textContent = `❌ Yanlış Tahmin! ${gameState.player1Name} yeşil işaretli şıkkı seçmişti.`;
    }
  }

  // Seçimden (veya Pas'tan) hemen sonra Emoji + Yorum yazma çekmecesini aç (#7)
  openPostAnswerCommentDrawer(selectedIndex);
}

function openPostAnswerCommentDrawer(choiceIdx) {
  gameState.pendingChoiceIndex = choiceIdx;
  const drawer = document.getElementById('post-answer-comment-box');
  const p1NoteBox = document.getElementById('p1-revealed-note-box');
  const p1NoteTitle = document.getElementById('p1-revealed-note-title');
  const p1NoteContent = document.getElementById('p1-revealed-note-content');
  const confirmBtnText = document.getElementById('btn-confirm-step-text');
  const qIndex = gameState.currentQuestionIndex;

  // Eğer 2. Oyuncu oynuyorsa, 1. Oyuncunun bu soruya bıraktığı emoji ve yorumu hemen göster! (#7)
  if (gameState.currentTurn === 2) {
    const p1Entry = gameState.p1Comments[qIndex] || { emoji: '', text: '' };
    const p1WasPass = gameState.p1Answers[qIndex] === PASS_ANSWER_VALUE;
    p1NoteBox.classList.remove('hidden');
    p1NoteTitle.textContent = `${gameState.player1Name}'in Bu Soruya Tepkisi & Yorumu:`;

    if (p1Entry.emoji || p1Entry.text) {
      p1NoteContent.innerHTML = `${p1Entry.emoji ? `<span class="text-xl mr-1.5">${p1Entry.emoji}</span>` : ''}<span>"${escapeHtml(p1Entry.text || 'Sadece emoji bıraktı')}"</span>`;
    } else {
      p1NoteContent.innerHTML = `<span class="opacity-70 italic">${gameState.player1Name} bu soruya ekstra bir yazılı not bırakmadı.${p1WasPass ? ' (Pas Jokerini kullandı)' : ''}</span>`;
    }
  } else {
    p1NoteBox.classList.add('hidden');
  }

  const isLastQuestion = qIndex >= TOTAL_QUESTIONS - 1;
  if (confirmBtnText) {
    confirmBtnText.textContent = isLastQuestion ? 'TURU TAMAMLA' : 'SONRAKİ SORU';
  }

  drawer.classList.remove('hidden');
  const commentInput = document.getElementById('input-question-comment');
  if (commentInput) {
    commentInput.focus();
  }
}

function selectReactionEmoji(emojiChar, ev) {
  gameState.pendingEmoji = emojiChar;
  spawnFloatingEmojiBurst(emojiChar, ev);

  const buttons = document.querySelectorAll('#emoji-reaction-bar .emoji-pick-btn');
  buttons.forEach((btn) => {
    if (btn.getAttribute('data-emoji') === emojiChar) {
      btn.className = "emoji-pick-btn w-9 h-9 rounded-lg bg-accent-1 text-black scale-110 font-bold text-lg flex items-center justify-center transition shadow-lg";
    } else {
      btn.className = "emoji-pick-btn w-9 h-9 rounded-lg bg-white/10 hover:bg-white/25 text-lg flex items-center justify-center transition";
    }
  });
}

function resetEmojiPickButtons() {
  const buttons = document.querySelectorAll('#emoji-reaction-bar .emoji-pick-btn');
  buttons.forEach((btn) => {
    btn.className = "emoji-pick-btn w-9 h-9 rounded-lg bg-white/10 hover:bg-white/25 text-lg flex items-center justify-center transition";
  });
}

function confirmStepAndAdvance() {
  if (gameState.pendingChoiceIndex === null) return;

  const qIndex = gameState.currentQuestionIndex;
  const commentInput = document.getElementById('input-question-comment');
  const commentText = commentInput ? commentInput.value.trim() : '';
  const emoji = gameState.pendingEmoji || '';
  const choice = gameState.pendingChoiceIndex;
  const isPass = choice === PASS_ANSWER_VALUE;

  if (gameState.currentTurn === 1) {
    gameState.p1Answers.push(choice);
    gameState.p1Comments.push({ emoji, text: commentText });
    appendToLiveReactionFeed(gameState.player1Name, qIndex + 1, emoji, commentText, isPass);
  } else {
    gameState.p2Guesses.push(choice);
    gameState.p2Comments.push({ emoji, text: commentText });
    appendToLiveReactionFeed(gameState.player2Name || '2. Oyuncu', qIndex + 1, emoji, commentText, isPass);
  }

  gameState.pendingChoiceIndex = null;
  gameState.pendingEmoji = '';
  updateSidePanels();

  if (gameState.currentQuestionIndex < TOTAL_QUESTIONS - 1) {
    gameState.currentQuestionIndex++;
    renderCurrentQuestion();
  } else {
    if (gameState.currentTurn === 1) {
      showInterstitialScreen();
    } else {
      finalizeGameAndShowResults();
    }
  }
}

// ---------------- ARA EKRAN: CİHAZI DEVRET VEYA BULUT VERİTABANINA KAYDET ----------------
async function showInterstitialScreen() {
  showView('view-interstitial');

  const passBox = document.getElementById('interstitial-pass-box');
  const linkBox = document.getElementById('interstitial-link-box');

  if (gameState.mode === 'pass') {
    passBox.classList.remove('hidden');
    linkBox.classList.add('hidden');

    const descEl = document.getElementById('pass-description-text');
    descEl.innerHTML = `<strong class="text-accent-1">${escapeHtml(gameState.player1Name)}</strong> 5 soruyu cevapladı, emojilerini ve yorumlarını bıraktı. Şimdi cihazı arkadaşına ver, bakalım seni ne kadar tanıyor!`;

    const passInput = document.getElementById('input-pass-p2-name');
    passInput.value = gameState.player2Name || '';
    document.getElementById('pass-name-error').classList.add('hidden');
  } else {
    passBox.classList.add('hidden');
    linkBox.classList.remove('hidden');

    if (!gameState.roomCode) {
      gameState.roomCode = generateRoomCode();
    }

    const codeDisplay = document.getElementById('generated-room-code-display');
    if (codeDisplay) codeDisplay.textContent = gameState.roomCode;

    const statusPill = document.getElementById('cloud-save-status-pill');
    if (statusPill) {
      statusPill.textContent = "⚡ Bulut Veritabanına Kaydediliyor...";
    }

    const roomRecord = {
      code: gameState.roomCode,
      status: 'waiting_p2',
      p1: gameState.player1Name,
      p2: gameState.player2Name || '',
      cat: gameState.category,
      thm: gameState.theme,
      qIds: gameState.selectedQuestions.map((q) => q.id),
      p1Answers: gameState.p1Answers,
      p1Comments: gameState.p1Comments,
      p2Guesses: [],
      p2Comments: [],
      createdAt: new Date().toISOString()
    };

    // Hem kısa `?room=KOD` hem de yedek `?challenge=...` parametresi oluştur
    const encoded = encodeChallengePayload({
      code: gameState.roomCode,
      p1: gameState.player1Name,
      cat: gameState.category,
      qIds: roomRecord.qIds,
      ans: gameState.p1Answers,
      c1: gameState.p1Comments,
      thm: gameState.theme
    });

    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const challengeUrl = `${baseUrl}?room=${gameState.roomCode}&challenge=${encoded}`;
    gameState.generatedChallengeUrl = challengeUrl;

    const urlInput = document.getElementById('generated-challenge-url');
    urlInput.value = challengeUrl;
    document.getElementById('copy-toast').classList.add('hidden');

    updateSidePanels();

    // Bulut Veritabanına kaydet ve karşı oyuncunun bitirmesini canlı dinlemeye başla!
    await saveRoomToDatabase(roomRecord);
    if (statusPill) {
      statusPill.textContent = `✅ Bulut Veritabanına Kaydedildi (Oda: ${gameState.roomCode})`;
    }
    startPollingForPartnerCompletion(gameState.roomCode);
  }
}

// ---------------- 2. OYUNCU TURUNU BAŞLAT (PASS & PLAY) ----------------
function startPlayerTwoTurn() {
  const passInput = document.getElementById('input-pass-p2-name');
  const errEl = document.getElementById('pass-name-error');
  const p2Name = passInput.value.trim();

  if (!p2Name) {
    errEl.classList.remove('hidden');
    passInput.focus();
    return;
  }

  errEl.classList.add('hidden');
  gameState.player2Name = p2Name;
  gameState.currentTurn = 2;
  gameState.currentQuestionIndex = 0;
  gameState.p2Guesses = [];
  gameState.p2Comments = [];
  gameState.p2PassUsed = false;

  updateHeaderVSBar();
  showView('view-question');
  renderCurrentQuestion();
}

// ---------------- ODA KODU İLE KATILMA / KONTROL ETME ----------------
async function joinRoomByCode() {
  const codeInput = document.getElementById('input-join-room-code');
  const errEl = document.getElementById('join-room-error');
  const btn = document.getElementById('btn-fetch-cloud-room');

  const code = codeInput ? codeInput.value.trim().toUpperCase() : '';
  if (!code || code.length < 3) {
    errEl.textContent = "⚠️ Lütfen geçerli bir Oda Kodu girin!";
    errEl.classList.remove('hidden');
    return;
  }

  errEl.classList.add('hidden');
  if (btn) btn.textContent = "VERİTABANINDAN ARANIYOR...";

  const room = await fetchRoomFromDatabase(code);
  if (btn) btn.innerHTML = '<span>ODAYI BUL VE AÇ</span><span>⚡</span>';

  if (!room) {
    errEl.textContent = `❌ "${code}" kodlu oda bulunamadı! Kodu kontrol edin.`;
    errEl.classList.remove('hidden');
    return;
  }

  toggleCloudJoinModal(false);
  loadRoomIntoGameState(room);
}

function loadRoomIntoGameState(room) {
  const loadedQuestions = (room.qIds || [])
    .map((id) => QUESTIONS_DB.find((q) => q.id === id))
    .filter(Boolean);

  if (loadedQuestions.length === 0) return false;

  if (room.thm && THEMES[room.thm]) {
    applyTheme(room.thm);
  }

  gameState.mode = 'link';
  gameState.roomCode = room.code || '';
  gameState.category = room.cat || 'genel';
  gameState.player1Name = room.p1 || 'Oyuncu 1';
  gameState.player2Name = room.p2 || '';
  gameState.selectedQuestions = loadedQuestions;
  gameState.p1Answers = room.p1Answers || room.ans || [];
  gameState.p1Comments = room.p1Comments || room.c1 || [];
  gameState.p2Guesses = room.p2Guesses || [];
  gameState.p2Comments = room.p2Comments || [];
  gameState.p2PassUsed = false;
  gameState.currentQuestionIndex = 0;
  gameState.currentTurn = 2;

  updateHeaderVSBar();
  updateSidePanels();

  // Eğer oda zaten 2. oyuncu tarafından tamamlanmışsa doğrudan Sonuç Ekranını aç!
  if (room.status === 'completed' && gameState.p2Guesses.length > 0) {
    showResultScreen();
    return true;
  }

  const titleEl = document.getElementById('challenge-welcome-title');
  titleEl.innerHTML = `<span class="text-accent-1">${escapeHtml(gameState.player1Name)}</span> sana meydan okudu! Bakalım onu ne kadar tanıyorsun?`;

  showView('view-challenge-welcome');
  return true;
}

// ---------------- PAYLAŞIM MODU FONKSİYONLARI ----------------
function copyChallengeLink() {
  const url = gameState.generatedChallengeUrl;
  if (!url) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showCopyToast();
    }).catch(() => {
      fallbackCopyText(url);
    });
  } else {
    fallbackCopyText(url);
  }
}

function fallbackCopyText(text) {
  const input = document.getElementById('generated-challenge-url');
  if (input) {
    input.select();
    input.setSelectionRange(0, 99999);
    document.execCommand('copy');
    showCopyToast();
  }
}

function showCopyToast() {
  const toast = document.getElementById('copy-toast');
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

function shareViaWhatsApp() {
  const url = gameState.generatedChallengeUrl;
  const codeText = gameState.roomCode ? `(Oda Kodu: ${gameState.roomCode}) ` : '';
  const text = `🔥 Selam! "senceo"da kendimle ilgili 5 soruyu cevapladım ve yorumlarımı bıraktım ${codeText}Bakalım beni ne kadar tanıyorsun? Tıkla ve tahmin et: ${url}`;
  if (navigator.share) {
    navigator.share({
      title: 'senceo - Beni Ne Kadar Tanıyorsun?',
      text: text,
      url: url
    }).catch(() => {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    });
  } else {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  }
}

function openChallengeLinkDirectly() {
  if (gameState.generatedChallengeUrl) {
    window.location.href = gameState.generatedChallengeUrl;
  }
}

// ---------------- SAYFA AÇILIŞINDA ODA VEYA CHALLENGE KONTROLÜ ----------------
async function checkIncomingUrlChallenge() {
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  const challengeParam = params.get('challenge');

  // 1. Önce Bulut Veritabanından ?room=KOD kontrol et
  if (roomParam) {
    const cloudRoom = await fetchRoomFromDatabase(roomParam);
    if (cloudRoom) {
      return loadRoomIntoGameState(cloudRoom);
    }
  }

  // 2. Yedek olarak ?challenge= Base64 parametresini çözümle
  if (challengeParam) {
    const decoded = decodeChallengePayload(challengeParam);
    if (
      decoded &&
      typeof decoded.p1 === 'string' &&
      Array.isArray(decoded.qIds) &&
      Array.isArray(decoded.ans) &&
      decoded.qIds.length > 0
    ) {
      return loadRoomIntoGameState({
        code: decoded.code || roomParam || '',
        status: 'waiting_p2',
        p1: decoded.p1,
        cat: decoded.cat,
        thm: decoded.thm,
        qIds: decoded.qIds,
        p1Answers: decoded.ans,
        p1Comments: decoded.c1 || []
      });
    }
  }

  return false;
}

function acceptUrlChallenge() {
  const nameInput = document.getElementById('input-challenger-p2-name');
  const errEl = document.getElementById('challenge-name-error');
  const p2Name = nameInput.value.trim();

  if (!p2Name) {
    errEl.classList.remove('hidden');
    nameInput.focus();
    return;
  }

  errEl.classList.add('hidden');
  gameState.player2Name = p2Name;
  gameState.currentTurn = 2;
  gameState.currentQuestionIndex = 0;
  gameState.p2Guesses = [];
  gameState.p2Comments = [];
  gameState.p2PassUsed = false;

  updateHeaderVSBar();
  showView('view-question');
  renderCurrentQuestion();
}

// ---------------- OYUN SONU: BULUT VERİTABANINI GÜNCELLE VE SONUÇ EKRANINI GÖSTER ----------------
function isQuestionMatch(p1Ans, p2Guess) {
  if (p1Ans === PASS_ANSWER_VALUE || p2Guess === PASS_ANSWER_VALUE) {
    return true; // Pas Jokeri kullanılan soru uyumu düşürmez
  }
  return p1Ans === p2Guess;
}

async function finalizeGameAndShowResults() {
  // Eğer Bulut Odası varsa 2. Oyuncunun tahminlerini ve yorumlarını veritabanına kaydet ki 1. Oyuncuya bildirim gitsin!
  if (gameState.roomCode) {
    const completedRoom = {
      code: gameState.roomCode,
      status: 'completed',
      p1: gameState.player1Name,
      p2: gameState.player2Name || '2. Oyuncu',
      cat: gameState.category,
      thm: gameState.theme,
      qIds: gameState.selectedQuestions.map((q) => q.id),
      p1Answers: gameState.p1Answers,
      p1Comments: gameState.p1Comments,
      p2Guesses: gameState.p2Guesses,
      p2Comments: gameState.p2Comments,
      completedAt: new Date().toISOString()
    };
    await saveRoomToDatabase(completedRoom);
  }

  showResultScreen();
}

function showResultScreen() {
  showView('view-result');

  const total = gameState.selectedQuestions.length;
  let correctCount = 0;

  gameState.selectedQuestions.forEach((q, idx) => {
    if (isQuestionMatch(gameState.p1Answers[idx], gameState.p2Guesses[idx])) {
      correctCount++;
    }
  });

  const percentage = Math.round((correctCount / total) * 100);

  document.getElementById('result-p1-name').textContent = gameState.player1Name || 'Oyuncu 1';
  document.getElementById('result-p2-name').textContent = gameState.player2Name || 'Oyuncu 2';
  document.getElementById('result-correct-ratio').textContent = `${correctCount} / ${total} Doğru`;

  const verdict = SCORE_VERDICTS[percentage] || SCORE_VERDICTS[60];
  document.getElementById('result-verdict-title').textContent = verdict.title;
  document.getElementById('result-verdict-desc').textContent = verdict.desc;

  const circleEl = document.getElementById('score-circle-progress');
  const percentTextEl = document.getElementById('score-percentage-text');

  circleEl.style.strokeDashoffset = `${CIRCLE_CIRCUMFERENCE}`;
  percentTextEl.textContent = `%0`;

  setTimeout(() => {
    const targetOffset = CIRCLE_CIRCUMFERENCE - (percentage / 100) * CIRCLE_CIRCUMFERENCE;
    circleEl.style.strokeDashoffset = `${targetOffset}`;
    animateCounterValue(percentTextEl, 0, percentage, 1100);
  }, 120);

  if (percentage >= 60 && typeof confetti === 'function') {
    setTimeout(() => {
      triggerCelebrationConfetti(percentage === 100);
    }, 350);
  }

  renderBreakdownList();
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
    const currentVal = Math.round(start + (end - start) * progress);
    element.textContent = `%${currentVal}`;
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }
  requestAnimationFrame(step);
}

// Sonuç Ekranında Her İki Oyuncunun Şıklarını ve Yorumlarını Sırasıyla Göster (#7)
function renderBreakdownList() {
  const container = document.getElementById('result-breakdown-list');
  container.innerHTML = '';

  const p1Name = gameState.player1Name || '1. Oyuncu';
  const p2Name = gameState.player2Name || '2. Oyuncu';

  gameState.selectedQuestions.forEach((q, idx) => {
    const p1Idx = gameState.p1Answers[idx];
    const p2Idx = gameState.p2Guesses[idx];
    const isCorrect = isQuestionMatch(p1Idx, p2Idx);

    const p1Opt = p1Idx === PASS_ANSWER_VALUE
      ? { icon: '⏭️', text: 'Pas Jokerini Kullandı' }
      : (q.options[p1Idx] || { icon: '❓', text: '-' });

    const p2Opt = p2Idx === PASS_ANSWER_VALUE
      ? { icon: '⏭️', text: 'Pas Jokerini Kullandı' }
      : (q.options[p2Idx] || { icon: '❓', text: '-' });

    const p1Comm = gameState.p1Comments[idx] || { emoji: '', text: '' };
    const p2Comm = gameState.p2Comments[idx] || { emoji: '', text: '' };

    const p1NoteHtml = (p1Comm.emoji || p1Comm.text)
      ? `<div class="mt-1 text-xs text-white/90 bg-white/5 px-2.5 py-1.5 rounded border-l-2 border-accent-1">
           <span class="font-bold text-accent-1">1️⃣ ${escapeHtml(p1Name)} Yorumu:</span> ${p1Comm.emoji || ''} ${escapeHtml(p1Comm.text || '')}
         </div>`
      : '';

    const p2NoteHtml = (p2Comm.emoji || p2Comm.text)
      ? `<div class="mt-1 text-xs text-white/90 bg-white/5 px-2.5 py-1.5 rounded border-l-2 border-pink-400">
           <span class="font-bold text-pink-300">2️⃣ ${escapeHtml(p2Name)} Yorumu:</span> ${p2Comm.emoji || ''} ${escapeHtml(p2Comm.text || '')}
         </div>`
      : '';

    const card = document.createElement('div');
    card.className = isCorrect
      ? "rounded-xl p-4 bg-emerald-500/15 border border-emerald-400/50 space-y-2"
      : "rounded-xl p-4 bg-red-500/15 border border-red-400/50 space-y-2";

    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <span class="text-xs sm:text-sm font-bold text-white leading-snug">
          ${idx + 1}. ${escapeHtml(q.q1)}
        </span>
        <span class="shrink-0 px-2.5 py-0.5 rounded text-xs font-extrabold uppercase ${
          isCorrect ? 'bg-emerald-400 text-black' : 'bg-red-500 text-white'
        }">
          ${isCorrect ? '✓ Uyumlu' : '✕ Farklı'}
        </span>
      </div>

      <div class="grid grid-cols-1 gap-1.5 text-xs pt-1">
        <div class="bg-black/60 px-3 py-2 rounded-lg border border-white/10">
          <div class="flex items-center gap-2">
            <span class="font-bold text-accent-1 shrink-0">${escapeHtml(p1Name)} (Seçim):</span>
            <span class="text-white font-semibold truncate">${p1Opt.icon} ${escapeHtml(p1Opt.text)}</span>
          </div>
          ${p1NoteHtml}
        </div>

        <div class="bg-black/60 px-3 py-2 rounded-lg border border-white/10">
          <div class="flex items-center gap-2">
            <span class="font-bold text-white shrink-0">${escapeHtml(p2Name)} (Tahmin):</span>
            <span class="text-white font-semibold truncate">${p2Opt.icon} ${escapeHtml(p2Opt.text)}</span>
          </div>
          ${p2NoteHtml}
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

function triggerCelebrationConfetti(isPerfect) {
  const themeConfetti = THEMES[gameState.theme]?.confettiColors || ['#00f2fe', '#ff007f'];
  try {
    confetti({
      particleCount: isPerfect ? 120 : 70,
      spread: 80,
      origin: { y: 0.6 },
      colors: themeConfetti
    });
    if (isPerfect) {
      setTimeout(() => {
        confetti({
          particleCount: 85,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: themeConfetti
        });
        confetti({
          particleCount: 85,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: themeConfetti
        });
      }, 300);
    }
  } catch (e) {
    console.warn("Konfeti çalıştırılamadı:", e);
  }
}

// ---------------- SONUCU PAYLAŞ VE TEKRAR OYNA ----------------
function shareScoreResult() {
  const total = gameState.selectedQuestions.length;
  let correctCount = 0;
  gameState.selectedQuestions.forEach((q, idx) => {
    if (isQuestionMatch(gameState.p1Answers[idx], gameState.p2Guesses[idx])) correctCount++;
  });
  const percentage = Math.round((correctCount / total) * 100);

  const shareText = `⚡ senceo Uyum Testi Sonucu!\n😎 ${gameState.player1Name} & 🕵️ ${gameState.player2Name}\n🎯 Uyum Skorumuz: %${percentage} (${correctCount}/${total} Doğru)!\nSen de arkadaşını test et: ${window.location.origin}${window.location.pathname}`;

  if (navigator.share) {
    navigator.share({
      title: 'senceo Uyum Skorumuz!',
      text: shareText
    }).catch(() => {
      copyResultTextToClipboard(shareText);
    });
  } else {
    copyResultTextToClipboard(shareText);
  }
}

function copyResultTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      const toast = document.getElementById('result-share-toast');
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 3000);
    });
  }
}

function resetToHome() {
  stopPollingForPartnerCompletion();
  if (window.location.search) {
    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  gameState.p1Answers = [];
  gameState.p2Guesses = [];
  gameState.p1Comments = [];
  gameState.p2Comments = [];
  gameState.p1PassUsed = false;
  gameState.p2PassUsed = false;
  gameState.currentQuestionIndex = 0;
  gameState.currentTurn = 1;
  gameState.isLocked = false;
  gameState.pendingChoiceIndex = null;
  gameState.roomCode = '';

  syncHeaderNames();
  showView('view-home');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------------- SAYFA YÜKLENDİĞİĞİNDE BAŞLAT ----------------
window.addEventListener('DOMContentLoaded', async () => {
  initSavedTheme();
  const hasChallenge = await checkIncomingUrlChallenge();
  if (!hasChallenge) {
    selectGameMode('pass');
    selectCategory('genel');
    showView('view-home');
  }
});
