// senceo — Stitch Friendship Quiz App Design + Orijinal "The Test" Motoru
// Çift Yönlü Simetrik Düello (Halftime Role Reversal), Kısa Link (?r=KOD),
// Kendi Cevabını Yaz (Custom Answer), Soruyu Değiştir (Shuffle 🔄), 1x Pas,
// Sesli Messenger Sohbet Balonu, Doğrulanmış Arkadaş Kodu (SNC-XXXX) & Bağ Leveli ve Gerçek OAuth Giriş Modalı — v0.04

const APP_VERSION = 'v0.04';
const DEFAULT_SUPABASE_URL = 'https://kypzuqnksnlinkfuxvnl.supabase.co';
const TOTAL_QUESTIONS = 5;
const CIRCLE_CIRCUMFERENCE = 414.69;
const PASS_ANSWER_VALUE = -1;

// 3 Tam Kapsamlı Stitch Tema Tanımları (Varsayılan: Luminous Beyaz)
const THEMES = {
  luminous: {
    id: 'luminous',
    confettiColors: ['#4648d4', '#6063ee', '#006c49', '#b90538']
  },
  obsidian: {
    id: 'obsidian',
    confettiColors: ['#8083ff', '#4edea3', '#ffb2b7', '#ffffff']
  },
  brutal26: {
    id: 'brutal26',
    confettiColors: ['#ccff00', '#ff4d00', '#b892ff', '#ffffff']
  }
};

// Kullanıcı Profil & Çift Level Durumu (Cookie + localStorage + Supabase profiles)
const userProfile = {
  id: '',
  friendCode: '', // Benzersiz Arkadaş Kodu: Örn. SNC-4829
  username: '',
  email: '',
  provider: 'guest', // 'Google' | 'Facebook' | 'iCloud' | 'Misafir' | 'guest'
  isLoggedIn: false,
  avatar: '😎',
  xp: 0,
  level: 1,
  gamesPlayed: 0,
  questionsCorrect: 0,
  friends: [],
  bonds: {} // { 'Salihcan': { code: 'SNC-8412', xp: 120, level: 2, matches: 3, lastPct: 84, verified: true } }
};

// Uygulama Oyun Durumu (State)
const gameState = {
  theme: 'luminous',
  mode: 'link', // 'link' (Klasik The Test Kısa Link) | 'pass' (Yan Yana) | 'arena' (Canlı Oda Kur 1v1..5v5/FFA)
  arenaFormat: '1v1',
  category: 'genel',
  activeLobbyFilter: 'all', // 'all' | 'turn' | 'waiting'
  pendingOAuthProvider: null, // 'Google' | 'Facebook' | 'iCloud'
  currentRound: 1,
  half: 1, // 1: P1 Cevaplar -> P2 Tahmin Eder | 2: Roller Değişir! P2 Cevaplar -> P1 Tahmin Eder
  phase: 'p1_answer', // 'p1_answer' | 'p2_guess' | 'p2_answer' | 'p1_guess'
  player1Name: '',
  player2Name: '',
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

// ---------------- ÇEREZ (COOKIE) + PROFİL + DOĞRULANMIŞ ARKADAŞ & BAĞ SİSTEMİ (#5 & #6) ----------------
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
    const decodedCookie = decodeURIComponent(document.cookie || '');
    const ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i].trim();
      if (c.indexOf(cname) === 0) {
        return c.substring(cname.length, c.length);
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

function loadUserProfile() {
  try {
    const cookieData = getCookie('senceo_user_session');
    const localData = localStorage.getItem('senceo_user_profile');
    const raw = cookieData || localData;
    if (raw) {
      const parsed = JSON.parse(raw);
      Object.assign(userProfile, parsed);
    }
  } catch (e) {}

  if (!userProfile.id) {
    userProfile.id = 'USR_' + Math.random().toString(36).substring(2, 9).toUpperCase();
  }
  if (!userProfile.friendCode || !userProfile.friendCode.startsWith('SNC-')) {
    userProfile.friendCode = generatePersonalFriendCode();
  }

  // Eski sürümden kalma doğrulanmamış (matches === 0 ve code olmayan) sahte 1 LV arkadaş kayıtlarını temizle (#5)
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

  userProfile.level = Math.max(1, Math.floor((userProfile.xp || 0) / 100) + 1);
  renderProfileUI();
}

function saveUserProfile() {
  userProfile.level = Math.max(1, Math.floor((userProfile.xp || 0) / 100) + 1);
  const serialized = JSON.stringify(userProfile);
  try {
    localStorage.setItem('senceo_user_profile', serialized);
    setCookie('senceo_user_session', serialized, 365);
  } catch (e) {}
  renderProfileUI();

  // Supabase profiles tablosuna arka planda senkronize et
  fetch('/api/rooms', {
    method: 'POST',
    headers: getSupabaseHeaders(),
    body: JSON.stringify({ type: 'profile', profile: userProfile })
  }).catch(() => {});
}

// ---------------- GERÇEK SOSYAL GİRİŞ / OAUTH MODALI (#6: İptal Edildiğinde Asla Giriş Yapmaz!) ----------------
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

  // Mevcut girilmiş isim varsa kolaylık için forma yaz ama otomatik login yapma!
  const p1Input = document.getElementById('input-p1-name');
  const currentDraftName = (p1Input && p1Input.value.trim()) || (userProfile.isLoggedIn ? userProfile.username : '');
  if (nameInput) nameInput.value = currentDraftName;
  if (emailInput) emailInput.value = userProfile.email || '';

  // Daha önce kaydedilmiş hesap varsa tek tıkla seçim kartı göster
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
  // İptal edildiğinde kesinlikle giriş yapılmaz! (#6)
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
  userProfile.avatar = providerName === 'Google' ? '🔥' : providerName === 'Facebook' ? '⚡' : '☁️';

  // Hesabı gelecekte hızlı seçim için kaydet
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
  userProfile.xp = 0;
  userProfile.level = 1;
  renderProfileUI();
  toggleProfileModal(false);
}

// ---------------- ÇİFT LEVEL SİSTEMİ & DOĞRULANMIŞ ARKADAŞ KODU SİSTEMİ (#5) ----------------
function getBondTitle(level, matches) {
  if (!matches || matches <= 0) return 'Düello Bekleniyor';
  if (level >= 4) return 'Ruh İkizi';
  if (level >= 2) return 'Sıkı Kanka';
  return 'Tanışık';
}

function addPersonalAndBondXP(partnerName, correctAnswersCount, matchPercentage = 80, roomCode = '') {
  const gainedXp = Math.max(25, correctAnswersCount * 30);
  userProfile.xp = (userProfile.xp || 0) + gainedXp;
  userProfile.gamesPlayed = (userProfile.gamesPlayed || 0) + 1;
  userProfile.questionsCorrect = (userProfile.questionsCorrect || 0) + correctAnswersCount;

  let bondInfo = { xp: gainedXp, level: 1, matches: 1, lastPct: matchPercentage };
  const cleanPartner = (partnerName || '').trim();
  if (cleanPartner && cleanPartner !== 'Oyuncu 2') {
    if (!userProfile.friends.includes(cleanPartner)) {
      userProfile.friends.push(cleanPartner);
    }
    const existing = userProfile.bonds[cleanPartner] || {
      code: roomCode ? `ODA:${roomCode}` : 'DOĞRULANDI',
      xp: 0,
      level: 1,
      matches: 0,
      commonAnswers: 0,
      lastPct: matchPercentage,
      verified: true
    };
    existing.xp = (existing.xp || 0) + gainedXp;
    existing.matches = (existing.matches || 0) + 1;
    existing.commonAnswers = (existing.commonAnswers || 0) + correctAnswersCount;
    existing.lastPct = matchPercentage;
    existing.verified = true;
    existing.level = Math.max(1, Math.floor(existing.xp / 100) + 1);
    userProfile.bonds[cleanPartner] = existing;
    bondInfo = existing;
  }

  saveUserProfile();
  return { gainedXp, personalLevel: userProfile.level, bondLevel: bondInfo.level, bondMatches: bondInfo.matches };
}

// Arkadaş Kodu (SNC-XXXX) veya Oynanmış Oda Kodu (SNCXXX) ile Doğrulanmış Bağ Ekleme (#5)
async function addVerifiedFriendByCode(inputId, feedbackId) {
  const inp = document.getElementById(inputId);
  const feedbackEl = document.getElementById(feedbackId);
  if (!inp) return;

  const rawVal = inp.value.trim().toUpperCase();
  const showFeedback = (msg, isError) => {
    if (!feedbackEl) return;
    feedbackEl.textContent = msg;
    feedbackEl.className = `text-[11px] font-bold ${isError ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`;
    feedbackEl.classList.remove('hidden');
  };

  if (!rawVal) {
    showFeedback('⚠️ Lütfen bir Arkadaş Kodu (Örn: SNC-4829) veya Oda Kodu (Örn: SNC123) girin.', true);
    return;
  }

  // Kendi kodunu girmesini engelle
  if (rawVal === userProfile.friendCode) {
    showFeedback('⚠️ Bu senin kendi Arkadaş Kodun! Arkadaşının kodunu girmelisin.', true);
    return;
  }

  // 1. Durum: SNC-XXXX formatında Arkadaş Kodu girildiyse
  const friendCodeRegex = /^SNC-\d{4}$/;
  if (friendCodeRegex.test(rawVal)) {
    const labelName = `Oyuncu (${rawVal})`;
    if (!userProfile.bonds[labelName]) {
      userProfile.bonds[labelName] = {
        code: rawVal,
        xp: 0,
        level: 0, // Oyun oynanana kadar 0 LVL (Beklemede) olarak görünür! (#5)
        matches: 0,
        commonAnswers: 0,
        lastPct: 0,
        verified: true
      };
    }
    inp.value = '';
    saveUserProfile();
    showFeedback(`✅ ${rawVal} kodlu arkadaş eklendi! Seviye kazanmak için birlikte ilk düellonuzu başlatın.`, false);
    return;
  }

  // 2. Durum: 6 Haneli Oda Kodu (Örn: SNC84K) girildiyse -> Buluttan odayı doğrula ve gerçek rakibi bağa ekle!
  if (rawVal.startsWith('SNC') && rawVal.length >= 5) {
    showFeedback('⏳ Oda kodu veritabanından doğrulanıyor...', false);
    const room = await fetchRoomFromDatabase(rawVal);
    if (!room) {
      showFeedback(`❌ "${rawVal}" kodlu aktif bir oda bulunamadı!`, true);
      return;
    }

    const myName = (userProfile.username || gameState.player1Name || '').toLowerCase();
    const partnerName = (room.p1 && room.p1.toLowerCase() !== myName) ? room.p1 : (room.p2 || room.p1 || `Oda #${rawVal}`);
    const pct = typeof room.lastMatchPercentage === 'number' ? room.lastMatchPercentage : 80;
    const corr = typeof room.lastCorrectCount === 'number' ? room.lastCorrectCount : 3;

    const existing = userProfile.bonds[partnerName] || {
      code: `ODA:${rawVal}`,
      xp: 0,
      level: 1,
      matches: 0,
      commonAnswers: 0,
      lastPct: pct,
      verified: true
    };

    if (room.status === 'completed') {
      existing.matches = Math.max(1, existing.matches + 1);
      existing.commonAnswers = (existing.commonAnswers || 0) + corr;
      existing.xp = Math.max(40, (existing.xp || 0) + corr * 25);
      existing.level = Math.max(1, Math.floor(existing.xp / 100) + 1);
      existing.lastPct = pct;
    } else {
      existing.level = existing.matches > 0 ? existing.level : 0;
    }

    userProfile.bonds[partnerName] = existing;
    inp.value = '';
    saveUserProfile();
    showFeedback(`✅ Oda #${rawVal} doğrulandı! "${partnerName}" ile bağınız eklendi.`, false);
    return;
  }

  // 3. Durum: Rastgele metin/isim yazıldıysa sahte 1 LV eklemeyi reddet! (#5)
  showFeedback(
    '⚠️ Rastgele isim yazarak sahte seviye eklenemez! Lütfen arkadaşının "SNC-XXXX" Arkadaş Kodunu veya birlikte oynadığınız "SNC123" Oda Kodunu girin.',
    true
  );
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

function startDuelWithFriend(friendName) {
  const cleanName = friendName.replace(/^Oyuncu \((SNC-\d+)\)$/, '$1');
  const p2Input = document.getElementById('input-p2-name');
  if (p2Input) {
    p2Input.value = cleanName;
  }
  gameState.player2Name = cleanName;
  toggleProfileModal(false);
  switchHomeSection('setup');
  if (p2Input) p2Input.focus();
}

function checkIncomingFriendInvite() {
  const params = new URLSearchParams(window.location.search);
  const fCode = params.get('friend');
  const fName = params.get('fname');
  if (fCode && /^SNC-\d{4}$/i.test(fCode.trim())) {
    const codeUpper = fCode.trim().toUpperCase();
    if (codeUpper !== userProfile.friendCode) {
      const displayFriend = fName && fName.trim() ? `${fName.trim()} (${codeUpper})` : `Oyuncu (${codeUpper})`;
      if (!userProfile.bonds[displayFriend]) {
        userProfile.bonds[displayFriend] = {
          code: codeUpper,
          xp: 0,
          level: 0,
          matches: 0,
          commonAnswers: 0,
          lastPct: 0,
          verified: true
        };
        saveUserProfile();
      }
      const p2Input = document.getElementById('input-p2-name');
      if (p2Input && fName) {
        p2Input.value = fName.trim();
        gameState.player2Name = fName.trim();
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
  if (navXp) navXp.textContent = `${xpTotal} XP`;

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
      if (sProv) sProv.textContent = userProfile.provider;
    } else {
      authCard.classList.remove('hidden');
      loggedStrip.classList.add('hidden');
    }
  }

  // Profil Modalı İçeriği
  const mName = document.getElementById('modal-profile-name');
  const mProv = document.getElementById('modal-profile-provider');
  const mLvl = document.getElementById('modal-personal-level');
  const mBar = document.getElementById('modal-personal-xp-bar');
  const mXpText = document.getElementById('modal-personal-xp-text');
  const mStats = document.getElementById('modal-personal-stats');

  if (mName) mName.textContent = displayName;
  if (mProv) {
    mProv.textContent = userProfile.isLoggedIn
      ? `${userProfile.provider}${userProfile.email ? ` (${userProfile.email})` : ''} • Çerez Aktif`
      : 'Misafir Oturumu';
  }
  if (mLvl) mLvl.textContent = `LVL ${lvl}`;
  if (mBar) mBar.style.width = `${Math.max(10, xpInLevel)}%`;
  if (mXpText) mXpText.textContent = `${xpInLevel} / 100 XP (Toplam: ${xpTotal} XP)`;
  if (mStats) mStats.textContent = `${userProfile.questionsCorrect || 0} Doğru Tahmin • ${userProfile.gamesPlayed || 0} Oyun`;

  renderBondsLists();
}

function renderBondsLists() {
  const modalListEl = document.getElementById('profile-friends-bond-list');
  const dashListEl = document.getElementById('dashboard-bonds-list');
  const allFriends = Object.keys(userProfile.bonds || {});

  // 1. Profil Modalı İçi Liste
  if (modalListEl) {
    modalListEl.innerHTML = '';
    if (allFriends.length === 0) {
      modalListEl.innerHTML = `
        <div class="text-xs text-muted-theme italic py-2">
          Henüz doğrulanmış bir arkadaş bağın yok. Bir arkadaşınla düello tamamla veya onun <strong>SNC-XXXX</strong> kodunu ekle!
        </div>
      `;
    } else {
      allFriends.forEach((fName) => {
        const b = userProfile.bonds[fName] || { xp: 0, level: 0, matches: 0 };
        const isPending = (b.matches || 0) === 0;
        const badgeHtml = isPending
          ? `<span class="px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-300 font-bold text-[10px]">⏳ Oyun Bekleniyor (0 XP)</span>`
          : `<span class="px-2 py-0.5 rounded bg-primary-theme font-mono-theme font-extrabold text-[11px]">BAĞ LVL ${b.level || 1}</span>`;

        const row = document.createElement('div');
        row.className = "stitch-subcard px-3 py-2 flex items-center justify-between gap-2 text-xs";
        row.innerHTML = `
          <div class="min-w-0">
            <div class="font-bold truncate">${escapeHtml(fName)}</div>
            <div class="text-[10px] text-muted-theme">${b.matches || 0} Ortak Oyun • ${b.xp || 0} Bağ XP</div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            ${badgeHtml}
            <button type="button" onclick="startDuelWithFriend('${escapeHtml(fName)}')" class="px-2 py-1 rounded bg-emerald-500 text-white font-bold text-[10px]" title="Bu arkadaşınla hemen düello başlat">
              Oyna ⚡
            </button>
          </div>
        `;
        modalListEl.appendChild(row);
      });
    }
  }

  // 2. Stitch Dashboard Sağ Kolon "Bağ Ağı" Listesi
  if (dashListEl) {
    dashListEl.innerHTML = '';
    if (allFriends.length === 0) {
      dashListEl.innerHTML = `
        <div class="py-3 text-xs text-muted-theme text-center">
          Henüz ortak oyun tamamladığın bir arkadaşın yok. Bir düello bitirdiğinde veya arkadaş kodunu girdiğinde bağ ağın burada listelenir.
        </div>
      `;
    } else {
      allFriends.forEach((fName) => {
        const b = userProfile.bonds[fName] || { xp: 0, level: 0, matches: 0, commonAnswers: 0, lastPct: 0 };
        const initials = fName.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ0-9]/g, '').slice(0, 2).toUpperCase() || 'OY';
        const isPending = (b.matches || 0) === 0;
        const bondTitle = getBondTitle(b.level || 0, b.matches || 0);

        const row = document.createElement('div');
        row.className = "py-2.5 flex items-center justify-between gap-2";
        row.innerHTML = `
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-10 h-10 rounded-full bg-[var(--primary-fixed)] text-primary-theme font-bold text-xs flex items-center justify-center shrink-0">
              ${escapeHtml(initials)}
            </div>
            <div class="min-w-0">
              <h5 class="font-bold text-xs sm:text-sm truncate">${escapeHtml(fName)}</h5>
              <span class="text-[11px] text-muted-theme">
                ${isPending ? 'Henüz ortak oyun yok' : `${b.commonAnswers || b.matches * 3} Ortak Yanıt • ${b.matches} Oyun`}
              </span>
            </div>
          </div>
          <div class="flex flex-col items-end gap-1 shrink-0">
            <span class="px-2 py-0.5 rounded-full stitch-subcard text-[10px] font-bold text-primary-theme">
              ${isPending ? '⏳ Davetli' : `${bondTitle} (LVL ${b.level || 1})`}
            </span>
            ${
              isPending
                ? `<button type="button" onclick="startDuelWithFriend('${escapeHtml(fName)}')" class="text-[11px] font-bold text-emerald-500 hover:underline">Düello Başlat ⚡</button>`
                : `<span class="text-xs font-extrabold">%${b.lastPct || 80} Uyum</span>`
            }
          </div>
        `;
        dashListEl.appendChild(row);
      });
    }
  }
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

// ---------------- STITCH TEMA MOTORU (1: Luminous Beyaz Varsayılan, 2: Obsidian Koyu, 3: Neo-Brutal Acid #1) ----------------
function normalizeThemeKey(key) {
  if (key === 'cosmic') return 'luminous';
  if (key === 'crimson') return 'obsidian';
  return THEMES[key] ? key : 'luminous';
}

function applyTheme(themeKey) {
  const validTheme = normalizeThemeKey(themeKey);
  gameState.theme = validTheme;
  document.documentElement.setAttribute('data-theme', validTheme);

  try {
    localStorage.setItem('senceo_theme_v4', validTheme);
  } catch (e) {}

  ['luminous', 'obsidian', 'brutal26'].forEach((key) => {
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
  // Yeni kullanıcılar için her zaman Beyaz ('luminous') varsayılan temadır! (#1)
  let initialTheme = 'luminous';
  try {
    const saved = localStorage.getItem('senceo_theme_v4');
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

// ---------------- STITCH ÜST NAVİGASYON SEKME GEÇİŞİ ----------------
function switchHomeSection(target) {
  showView('view-home');
  const navIds = {
    setup: 'nav-tab-setup',
    duels: 'nav-tab-duels',
    bonds: 'nav-tab-bonds'
  };
  Object.keys(navIds).forEach((k) => {
    const btn = document.getElementById(navIds[k]);
    if (!btn) return;
    if (k === target) {
      btn.className = "px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors bg-[var(--surface-high)] text-primary-theme";
    } else {
      btn.className = "px-3.5 py-2 rounded-lg text-sm font-semibold text-muted-theme hover:bg-[var(--surface-container)] transition-colors";
    }
  });

  if (target === 'duels') {
    const el = document.getElementById('home-section-dashboard');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (target === 'bonds') {
    const el = document.getElementById('home-section-bonds');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

// ---------------- VERİTABANI & AKTİF DÜELLOLAR LOBİSİ ----------------
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

function saveRoomToLocalLobbyList(roomPayload) {
  try {
    localStorage.setItem(`senceo_room_${roomPayload.code}`, JSON.stringify(roomPayload));
    const listRaw = localStorage.getItem('senceo_my_rooms_index') || '[]';
    const codes = JSON.parse(listRaw);
    if (!codes.includes(roomPayload.code)) {
      codes.unshift(roomPayload.code);
      localStorage.setItem('senceo_my_rooms_index', JSON.stringify(codes.slice(0, 20)));
    }
  } catch (e) {}
}

async function saveRoomToDatabase(roomPayload) {
  saveRoomToLocalLobbyList(roomPayload);
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

async function refreshActiveGamesLobby() {
  const container = document.getElementById('active-games-lobby-list');
  if (!container) return;

  let codes = [];
  try {
    codes = JSON.parse(localStorage.getItem('senceo_my_rooms_index') || '[]');
  } catch (e) {}

  if (codes.length === 0) {
    container.innerHTML = `
      <div class="stitch-card p-6 text-center space-y-2">
        <div class="w-12 h-12 mx-auto rounded-full stitch-subcard flex items-center justify-center text-primary-theme">
          <span class="material-symbols-outlined text-[24px]">sports_esports</span>
        </div>
        <h3 class="font-display-theme font-bold text-sm sm:text-base">Henüz Aktif Düellon Yok</h3>
        <p class="text-xs text-muted-theme max-w-md mx-auto">
          Yukarıdaki karttan hemen yeni bir <strong>Klasik "The Test"</strong> veya <strong>Canlı Oda</strong> başlatarak arkadaşlarına meydan oku!
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  let renderedCount = 0;

  for (const code of codes.slice(0, 10)) {
    let room = null;
    try {
      const raw = localStorage.getItem(`senceo_room_${code}`);
      if (raw) room = JSON.parse(raw);
    } catch (e) {}
    if (!room) continue;

    const myName = (userProfile.username || gameState.player1Name || '').toLowerCase();
    const isP1 = room.p1 && room.p1.toLowerCase() === myName;
    const isMyTurn =
      (room.status === 'waiting_p1_half2' && isP1) ||
      (room.status === 'waiting_p2' && !isP1);

    if (gameState.activeLobbyFilter === 'turn' && !isMyTurn) continue;
    if (gameState.activeLobbyFilter === 'waiting' && isMyTurn) continue;

    renderedCount++;
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
      progressPct = 65;
      actionLabel = 'Hamleye Devam Et';
    } else {
      statusPill = `<span class="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 font-bold text-[11px]">⏳ Rakip Bekleniyor</span>`;
      progressPct = 40;
      actionLabel = 'Kontrol Et';
    }

    const opponentName = isP1 ? (room.p2 || 'Rakip Bekleniyor') : (room.p1 || 'Oyuncu 1');
    const initials = opponentName.slice(0, 2).toUpperCase();

    const card = document.createElement('div');
    card.className = "stitch-card p-5 space-y-3 hover:border-[var(--primary)] transition";
    card.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-full bg-[var(--primary-fixed)] text-primary-theme font-bold text-sm flex items-center justify-center shrink-0">
            ${escapeHtml(initials)}
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="font-display-theme font-bold text-sm sm:text-base">${escapeHtml(room.p1 || 'Oyuncu 1')} ⚡ ${escapeHtml(room.p2 || 'Rakip')}</h3>
              ${statusPill}
            </div>
            <p class="text-xs text-muted-theme">Oda Kodu: <strong class="font-mono-theme text-primary-theme">#${escapeHtml(room.code)}</strong> • Raunt ${room.currentRound || 1}</p>
          </div>
        </div>
        ${
          typeof room.lastMatchPercentage === 'number'
            ? `<div class="px-3 py-1 rounded-full stitch-subcard text-xs font-extrabold text-primary-theme self-start sm:self-auto">❤️ %${room.lastMatchPercentage} Uyum</div>`
            : ''
        }
      </div>

      <div class="w-full h-2 rounded-full bg-[var(--surface-high)] overflow-hidden">
        <div class="h-full bg-primary-theme rounded-full transition-all duration-500" style="width: ${progressPct}%"></div>
      </div>

      <div class="flex items-center justify-between pt-1">
        <span class="text-xs text-muted-theme font-mono-theme">Kategori: ${escapeHtml((room.cat || 'genel').toUpperCase())}</span>
        <button
          type="button"
          onclick="openRoomFromLobbyCard('${escapeHtml(room.code)}')"
          class="theme-btn-primary px-4 py-2 text-xs flex items-center gap-1"
        >
          <span>${actionLabel}</span>
          <span class="material-symbols-outlined text-[15px]">play_arrow</span>
        </button>
      </div>
    `;
    container.appendChild(card);
  }

  if (renderedCount === 0) {
    container.innerHTML = `
      <div class="stitch-card p-4 text-xs text-muted-theme text-center">
        Bu filtrede gösterilecek aktif oyun bulunamadı.
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

// Canlı Bildirim Dinleyici
function startPollingForPartnerCompletion(roomCode) {
  stopPollingForPartnerCompletion();
  if (!roomCode) return;

  gameState.pollingIntervalId = setInterval(async () => {
    const room = await fetchRoomFromDatabase(roomCode);
    if (!room) return;
    if (room.status === 'waiting_p1_half2' || room.status === 'completed') {
      stopPollingForPartnerCompletion();
      triggerPartnerCompletedNotification(room);
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
  'view-live-room-lobby',
  'view-challenge-welcome',
  'view-question',
  'view-halftime-reversal',
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

  const duelHeader = document.getElementById('duel-vs-header');
  if (duelHeader) {
    if (viewId === 'view-question' || viewId === 'view-halftime-reversal' || viewId === 'view-result') {
      duelHeader.classList.remove('hidden');
    } else {
      duelHeader.classList.add('hidden');
    }
  }

  if (viewId === 'view-home') {
    refreshActiveGamesLobby();
    renderBondsLists();
  }

  updateDuelHeaderUI();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------------- ÜST DÜELLO BARI VE 5 NOKTALI İLERLEME GÖSTERGESİ ----------------
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
    p2Sub.textContent = bondObj && bondObj.level > 0
      ? `Bağ: LVL ${bondObj.level}`
      : `Mod: ${gameState.mode === 'arena' ? gameState.arenaFormat.toUpperCase() : 'Klasik'}`;
  }

  const roundBadge = document.getElementById('duel-round-badge');
  if (roundBadge) {
    roundBadge.textContent = `RAUND ${gameState.currentRound} • YARI ${gameState.half}/2`;
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

function syncHeaderNames() {
  const p1Input = document.getElementById('input-p1-name');
  const p2Input = document.getElementById('input-p2-name');
  gameState.player1Name = p1Input ? p1Input.value : '';
  gameState.player2Name = p2Input ? p2Input.value : '';
  if (gameState.player1Name.trim()) {
    userProfile.username = gameState.player1Name.trim();
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
    'ffa': '🌪️ Herkes Tek (Free-For-All): Rastgele bir oyuncunun sorularını bil ve puan kazan!'
  };
  const descEl = document.getElementById('arena-format-desc');
  if (descEl) descEl.textContent = descMap[fmt] || '';
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
  const p2Name = p2Input ? p2Input.value.trim() : '';

  if (!p1Name) {
    errorText.textContent = "Lütfen başlamadan önce kendi adını yaz!";
    errorBox.classList.remove('hidden');
    if (p1Input) p1Input.focus();
    return;
  }
  errorBox.classList.add('hidden');

  gameState.player1Name = p1Name;
  gameState.player2Name = p2Name;
  userProfile.username = p1Name;
  saveUserProfile();

  if (gameState.mode === 'arena') {
    gameState.roomCode = generateRoomCode();
    document.getElementById('live-lobby-room-code').textContent = gameState.roomCode;
    document.getElementById('live-lobby-players-list').textContent = `😎 ${p1Name} (Oda Kurucu)${p2Name ? ` ⚡ ${p2Name}` : ' • Katılımcılar Bekleniyor...'}`;
    const catSelect = document.getElementById('live-lobby-cat-select');
    if (catSelect) catSelect.value = gameState.category;

    await saveRoomToDatabase({
      code: gameState.roomCode,
      roomType: 'live_arena',
      arenaFormat: gameState.arenaFormat,
      status: 'lobby_open',
      currentRound: 1,
      p1: p1Name,
      p2: p2Name,
      cat: gameState.category,
      thm: gameState.theme,
      qIds: [],
      createdAt: new Date().toISOString()
    });

    showView('view-live-room-lobby');
    return;
  }

  startClassicFirstHalf();
}

function startMatchFromLiveLobby() {
  startClassicFirstHalf();
}

function startClassicFirstHalf() {
  if (!gameState.roomCode) {
    gameState.roomCode = generateRoomCode();
  }
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
  gameState.currentQuestionIndex = 0;
  gameState.progressDots = [];
  gameState.isLocked = false;

  updateDuelHeaderUI();
  showView('view-question');
  renderCurrentQuestion();
}

// ---------------- SORU EKRANI RENDER & MEKANİKLER ----------------
function isCurrentPhaseAnswering() {
  return gameState.phase === 'p1_answer' || gameState.phase === 'p2_answer';
}

function getActiveQuestionList() {
  return gameState.half === 1 ? gameState.selectedQuestions : gameState.p2Half2Questions;
}

function renderCurrentQuestion() {
  const qIndex = gameState.currentQuestionIndex;
  const qList = getActiveQuestionList();
  const questionObj = qList[qIndex];
  if (!questionObj) return;

  const isAnswering = isCurrentPhaseAnswering();
  const answererName = gameState.half === 1 ? gameState.player1Name : (gameState.player2Name || '2. Oyuncu');
  const guesserName = gameState.half === 1 ? (gameState.player2Name || '2. Oyuncu') : gameState.player1Name;

  document.getElementById('header-question-counter').textContent = `SORU ${qIndex + 1} / ${TOTAL_QUESTIONS}`;

  document.getElementById('messenger-secret-bubble').classList.add('hidden');
  document.getElementById('guess-feedback-banner').classList.add('hidden');
  document.getElementById('post-answer-comment-box').classList.add('hidden');
  toggleCustomAnswerBox(false);

  const commentInput = document.getElementById('input-question-comment');
  if (commentInput) commentInput.value = '';
  gameState.pendingChoiceIndex = null;
  gameState.pendingEmoji = '';
  resetEmojiPickButtons();

  // 1. Soruyu Değiştir (Shuffle 🔄) Butonu
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

  // 2. Klasik Modda 1 Adet Pas Geçme Hakkı
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

  // 3. "✏️ Kendi Cevabını Yaz" (Custom Answer) Butonu
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
  updateDuelHeaderUI();
}

function handleShuffleQuestion() {
  if (gameState.isLocked || !isCurrentPhaseAnswering() || gameState.shufflesLeft <= 0) return;

  const replacement = pickQuestionsForCategory(gameState.category, 1)[0];
  if (!replacement) return;

  gameState.shufflesLeft--;
  const qList = getActiveQuestionList();
  qList[gameState.currentQuestionIndex] = replacement;

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

function handleOptionSelect(selectedIndex, clickedBtn, clickEvent) {
  if (gameState.isLocked) return;
  gameState.isLocked = true;

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

    const secretEntry = targetComments[qIndex];
    if (secretEntry && (secretEntry.emoji || secretEntry.text)) {
      const bubbleEl = document.getElementById('messenger-secret-bubble');
      const senderEl = document.getElementById('messenger-bubble-sender');
      const textEl = document.getElementById('messenger-bubble-text');
      if (bubbleEl && senderEl && textEl) {
        senderEl.textContent = `💬 ${answererName} Diyor Ki:`;
        textEl.textContent = `${secretEntry.emoji || ''} ${secretEntry.text || ''}`.trim();
        bubbleEl.classList.remove('hidden');
        setTimeout(() => playSoundEffect('pop'), 180);
      }
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

function confirmStepAndAdvance() {
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

  if (gameState.currentQuestionIndex < TOTAL_QUESTIONS - 1) {
    gameState.currentQuestionIndex++;
    renderCurrentQuestion();
  } else {
    handleEndOfFiveQuestionBlock();
  }
}

// ---------------- 5 SORULUK BLOK SONU VE ROLLERİN DEĞİŞMESİ ----------------
async function handleEndOfFiveQuestionBlock() {
  if (gameState.phase === 'p1_answer') {
    await showInterstitialScreen('after_p1_answer');
  } else if (gameState.phase === 'p2_guess') {
    let c1 = 0;
    for (let i = 0; i < TOTAL_QUESTIONS; i++) {
      if (isQuestionMatch(gameState.p1Answers[i], gameState.p2Guesses[i])) c1++;
    }
    const pct1 = Math.round((c1 / TOTAL_QUESTIONS) * 100);
    gameState.half1Score = { correct: c1, total: TOTAL_QUESTIONS };

    document.getElementById('halftime-title').textContent = `1. Yarı Bitti! ${gameState.player1Name}'i %${pct1} Tanıdın! 🔥`;
    document.getElementById('halftime-desc').innerHTML = `Orijinal <strong>"The Test"</strong> kuralı: Roller değişiyor! Şimdi sıra sende (<strong>${escapeHtml(gameState.player2Name || '2. Oyuncu')}</strong>)! Kendinle ilgili 5 yeni soruyu cevapla, bakalım <strong>${escapeHtml(gameState.player1Name)}</strong> seni ne kadar tanıyor?`;
    showView('view-halftime-reversal');
  } else if (gameState.phase === 'p2_answer') {
    await showInterstitialScreen('after_p2_answer');
  } else if (gameState.phase === 'p1_guess') {
    await finalizeGameAndShowResults();
  }
}

function startHalftimeCounterAttack() {
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
    subEl.innerHTML = `Cevapların bulut veritabanına kaydedildi (Oda: <strong>${gameState.roomCode}</strong>). Kısa linki arkadaşına gönder!`;
  }

  const statusPill = document.getElementById('cloud-save-status-pill');
  if (statusPill) statusPill.textContent = "⚡ Veritabanına Kaydediliyor...";
  await saveRoomToDatabase(roomRecord);
  if (statusPill) statusPill.textContent = `✅ Veritabanına Kaydedildi (#${gameState.roomCode})`;

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

function openChallengeLinkDirectly() {
  if (gameState.generatedChallengeUrl) {
    window.location.href = gameState.generatedChallengeUrl;
  }
}

// ---------------- ODA KODU VEYA KISA LİNK (?r=KOD) İLE ODAYI YÜKLEME ----------------
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
  if (btn) btn.textContent = "ARANIYOR...";

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

function loadRoomIntoGameState(room, forceResultView = false) {
  gameState.roomCode = room.code || '';
  gameState.mode = room.roomType === 'live_arena' ? 'arena' : 'link';
  gameState.arenaFormat = room.arenaFormat || '1v1';
  gameState.currentRound = room.currentRound || 1;
  gameState.category = room.cat || 'genel';
  gameState.player1Name = room.p1 || 'Oyuncu 1';
  gameState.player2Name = room.p2 || '';
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

  const q1List = (room.qIds || []).map((id) => QUESTIONS_DB.find((q) => q.id === id)).filter(Boolean);
  gameState.selectedQuestions = q1List.length > 0 ? q1List : pickQuestionsForCategory(gameState.category, TOTAL_QUESTIONS);

  const q2List = (room.p2Half2QIds || []).map((id) => QUESTIONS_DB.find((q) => q.id === id)).filter(Boolean);
  gameState.p2Half2Questions = q2List;

  if (room.status === 'lobby_open' && (!room.qIds || room.qIds.length === 0)) {
    startClassicFirstHalf();
    return true;
  }

  if (forceResultView || room.status === 'completed') {
    showResultScreen();
    return true;
  }

  if (room.status === 'waiting_p1_half2') {
    gameState.half = 2;
    gameState.phase = 'p1_guess';
    gameState.currentQuestionIndex = 0;
    gameState.progressDots = [];
    updateDuelHeaderUI();
    showView('view-question');
    renderCurrentQuestion();
    return true;
  }

  gameState.half = 1;
  gameState.phase = 'p2_guess';
  gameState.currentQuestionIndex = 0;
  gameState.progressDots = [];

  const titleEl = document.getElementById('challenge-welcome-title');
  titleEl.innerHTML = `<span class="text-primary-theme">${escapeHtml(gameState.player1Name)}</span> sana meydan okudu! Bakalım onu ne kadar tanıyorsun?`;
  const nameInput = document.getElementById('input-challenger-p2-name');
  if (nameInput && gameState.player2Name) nameInput.value = gameState.player2Name;

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
  gameState.half = 1;
  gameState.phase = 'p2_guess';
  gameState.currentQuestionIndex = 0;
  gameState.progressDots = [];

  updateDuelHeaderUI();
  showView('view-question');
  renderCurrentQuestion();
}

// ---------------- SONUÇ HESAPLAMA, XP / BAĞ LEVELİ VE DOĞRUDAN SONUÇ LİNKİ ----------------
function isQuestionMatch(ans, guess) {
  if (ans === PASS_ANSWER_VALUE) return true;
  return ans === guess;
}

async function finalizeGameAndShowResults() {
  const { correctCount, totalCount, percentage } = calculateOverallRoundScore();

  if (!gameState.roomCode) {
    gameState.roomCode = generateRoomCode();
  }

  const completedRoom = {
    code: gameState.roomCode,
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

  const nextRoundBtn = document.getElementById('btn-next-round-label');
  if (nextRoundBtn) {
    nextRoundBtn.textContent = `${gameState.currentRound + 1}. RAUNDA GEÇ (YENİ SORULARLA DEVAM ET!)`;
  }

  if (awardXpNow) {
    const partner = gameState.player2Name || 'Arkadaşın';
    const gain = addPersonalAndBondXP(partner, correctCount, percentage, gameState.roomCode);
    document.getElementById('result-personal-xp-pill').textContent = `⭐ Öz Seviye: LVL ${gain.personalLevel} (+${gain.gainedXp} XP)`;
    document.getElementById('result-bond-xp-pill').textContent = `🤝 ${partner} ile Bağ: LVL ${gain.bondLevel}`;
  }

  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const directResultUrl = `${baseUrl}?r=${gameState.roomCode || 'SNC'}&view=result`;
  const directUrlTextEl = document.getElementById('result-direct-url-text');
  if (directUrlTextEl) directUrlTextEl.textContent = directResultUrl;

  if (gameState.roomCode) {
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

function startNextRoundInSameRoom() {
  gameState.currentRound = (gameState.currentRound || 1) + 1;
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
  const p2Name = gameState.player2Name || '2. Oyuncu';

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

  if (gameState.p2Half2Questions.length > 0 && gameState.p1Half2Guesses.length > 0) {
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

// ---------------- DOĞRUDAN SONUÇ KARNESİ LİNKİNİ PAYLAŞMA ----------------
function shareScoreResult() {
  const { correctCount, totalCount, percentage } = calculateOverallRoundScore();
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const directResultUrl = `${baseUrl}?r=${gameState.roomCode || 'SNC'}&view=result`;

  const shareText = `⚡ senceo ${gameState.currentRound}. Raund Uyum Karnemiz!\n😎 ${gameState.player1Name} & 🕵️ ${gameState.player2Name}\n🎯 Uyum Skorumuz: %${percentage} (${correctCount}/${totalCount} Doğru)!\n📋 Kim ne cevap verdi ve ne yorum yazdı görmek için tıkla: ${directResultUrl}`;

  if (navigator.share) {
    navigator.share({
      title: 'senceo Uyum Karnemiz!',
      text: shareText,
      url: directResultUrl
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
      if (toast) {
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
      }
    });
  }
}

function resetToHome() {
  stopPollingForPartnerCompletion();
  if (window.location.search) {
    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, document.title, cleanUrl);
  }
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

// ---------------- SAYFA YÜKLENDİĞİNDE BAŞLAT ----------------
window.addEventListener('DOMContentLoaded', async () => {
  initSavedTheme();
  loadUserProfile();
  checkIncomingFriendInvite();

  const p1Input = document.getElementById('input-p1-name');
  if (p1Input && userProfile.username && userProfile.username !== 'Misafir Oyuncu' && userProfile.username !== 'Misafir') {
    p1Input.value = userProfile.username;
    gameState.player1Name = userProfile.username;
  }

  const hasChallenge = await checkIncomingUrlChallenge();
  if (!hasChallenge) {
    selectGameMode('link');
    selectCategory('genel');
    showView('view-home');
  }
});
