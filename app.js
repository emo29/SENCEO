// senceo - Ana Oyun Motoru, 3'lü Tema Sistemi ve Akış Kontrolü (app.js) — v0.01

const APP_VERSION = 'v0.01';
const TOTAL_QUESTIONS = 5;
const CIRCLE_CIRCUMFERENCE = 414.69; // 2 * Math.PI * 66

// 3 Tam Kapsamlı Tema Tanımları
const THEMES = {
  crimson: {
    id: 'crimson',
    label: 'Crimson Noir',
    badgeText: '🩸 Simsiyah & Kırmızı',
    confettiColors: ['#ff002b', '#990014', '#ffffff', '#ff4d6a']
  },
  brutal26: {
    id: 'brutal26',
    label: 'Neo-Brutal 2026',
    badgeText: '⚡ Ekim 2026 Acid',
    confettiColors: ['#ccff00', '#ff4d00', '#b892ff', '#ffffff']
  },
  cosmic: {
    id: 'cosmic',
    label: 'Cosmic Neon',
    badgeText: '🌌 Cosmic Neon',
    confettiColors: ['#ff007f', '#00f2fe', '#ff7b00', '#10b981']
  }
};

// Uygulama Durumu (State)
const gameState = {
  theme: 'crimson', // Varsayılan (Default) tema: Simsiyah ve Kırmızı tonlar
  mode: 'pass', // 'pass' (Yan Yana) | 'link' (Link ile Meydan Oku)
  category: 'genel', // 'genel' | 'cift' | 'kanka' | 'ekstrem'
  player1Name: '',
  player2Name: '',
  selectedQuestions: [], // 5 adet soru objesi
  p1Answers: [], // 1. oyuncunun seçtiği şık indeksleri (0-3)
  p2Guesses: [], // 2. oyuncunun tahmin ettiği şık indeksleri (0-3)
  currentQuestionIndex: 0,
  currentTurn: 1, // 1: Oyuncu 1 cevaplıyor | 2: Oyuncu 2 tahmin ediyor
  isLocked: false,
  generatedChallengeUrl: ''
};

// Yüzdelik Uyum Yorumları
const SCORE_VERDICTS = {
  100: {
    title: "🧠 Siz tek beyinli iki insan mısınız?! (%100)",
    desc: "İnanılmaz! Telepati kurduğunuz kesinleşti. Birbirinizin ne düşündüğünü kelimesi kelimesine biliyorsunuz. Bu uyumu bozacak hiçbir güç yok!"
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
    desc: "5 soruda 0 doğru! Gözlerinizi kapatıp rastgele bassaydınız bile en azından 1 tanesi tutardı. Siz gerçekten tanıştığınıza emin misiniz?!"
  }
};

// ---------------- TEMA MOTORU VE AYARLAR MODALI ----------------
function applyTheme(themeKey) {
  const validTheme = THEMES[themeKey] ? themeKey : 'crimson';
  gameState.theme = validTheme;
  document.documentElement.setAttribute('data-theme', validTheme);

  try {
    localStorage.setItem('senceo_theme', validTheme);
  } catch (e) {
    // localStorage kapalıysa sessizce devam et
  }

  // Üst bardaki tema ve sürüm etiketini güncelle
  const headerTag = document.getElementById('header-theme-tag');
  if (headerTag) {
    headerTag.textContent = `${THEMES[validTheme].label} • ${APP_VERSION}`;
  }

  // Ana ekrandaki hızlı tema butonlarını güncelle
  const quickPills = document.querySelectorAll('[data-theme-pill]');
  quickPills.forEach((btn) => {
    const key = btn.getAttribute('data-theme-pill');
    if (key === validTheme) {
      btn.className = "theme-quick-pill px-2.5 py-1 text-[10px] font-bold rounded border border-white bg-accent-1 text-black shadow transition";
    } else {
      btn.className = "theme-quick-pill px-2.5 py-1 text-[10px] font-bold rounded border border-white/20 bg-black/40 text-white/75 hover:text-white transition";
    }
  });

  // Ayarlar modalındaki tema kartlarının seçili çerçevesini güncelle
  ['crimson', 'brutal26', 'cosmic'].forEach((key) => {
    const card = document.getElementById(`theme-card-${key}`);
    if (!card) return;
    if (key === validTheme) {
      card.style.borderColor = 'var(--accent-1)';
      card.style.boxShadow = '0 0 18px rgba(255, 255, 255, 0.18)';
    } else {
      card.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      card.style.boxShadow = 'none';
    }
  });
}

function initSavedTheme() {
  let initialTheme = 'crimson'; // Varsayılan: Simsiyah ve kırmızı tonlar
  try {
    const saved = localStorage.getItem('senceo_theme');
    if (saved && THEMES[saved]) {
      initialTheme = saved;
    }
  } catch (e) {
    initialTheme = 'crimson';
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

  const counterBadge = document.getElementById('header-counter-badge');
  const homeBadge = document.getElementById('header-home-badge');
  if (viewId === 'view-question') {
    counterBadge.classList.remove('hidden');
    counterBadge.classList.add('flex');
    if (homeBadge) homeBadge.classList.add('hidden');
  } else {
    counterBadge.classList.add('hidden');
    counterBadge.classList.remove('flex');
    if (homeBadge) homeBadge.classList.remove('hidden');
  }

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
    passCheck.className = "w-4 h-4 rounded-full bg-accent-1 text-black text-[10px] flex items-center justify-center font-extrabold opacity-100";
    linkCheck.className = "w-4 h-4 rounded-full bg-white/10 text-[10px] flex items-center justify-center font-extrabold opacity-0";
    p2Wrapper.classList.remove('hidden');
  } else {
    linkBtn.classList.add('is-active');
    passBtn.classList.remove('is-active');
    linkCheck.className = "w-4 h-4 rounded-full bg-accent-1 text-black text-[10px] flex items-center justify-center font-extrabold opacity-100";
    passCheck.className = "w-4 h-4 rounded-full bg-white/10 text-[10px] flex items-center justify-center font-extrabold opacity-0";
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
  gameState.currentQuestionIndex = 0;
  gameState.currentTurn = 1;
  gameState.isLocked = false;

  updateHeaderVSBar();
  showView('view-question');
  renderCurrentQuestion();
}

// ---------------- SORU EKRANINI RENDER ET ----------------
function renderCurrentQuestion() {
  const qIndex = gameState.currentQuestionIndex;
  const questionObj = gameState.selectedQuestions[qIndex];
  if (!questionObj) return;

  const counterEl = document.getElementById('header-question-counter');
  counterEl.textContent = `SORU ${qIndex + 1} / ${TOTAL_QUESTIONS}`;

  const progressPercent = ((qIndex + 1) / TOTAL_QUESTIONS) * 100;
  document.getElementById('question-progress-bar').style.width = `${progressPercent}%`;

  document.getElementById('question-category-pill').textContent = questionObj.categoryLabel || '🌟 Genel';

  const feedbackBanner = document.getElementById('guess-feedback-banner');
  feedbackBanner.classList.add('hidden');

  const turnBadge = document.getElementById('question-turn-badge');
  const stepLabel = document.getElementById('question-step-label');
  const questionTextEl = document.getElementById('question-text');

  if (gameState.currentTurn === 1) {
    turnBadge.innerHTML = `<span>😎</span> <span>${escapeHtml(gameState.player1Name)} Cevaplıyor</span>`;
    stepLabel.textContent = "KENDİ ADINA CEVAPLA";
    questionTextEl.textContent = questionObj.q1;
  } else {
    const p2Name = gameState.player2Name || '2. Oyuncu';
    turnBadge.innerHTML = `<span>🕵️</span> <span>${escapeHtml(p2Name)} Tahmin Ediyor</span>`;
    stepLabel.textContent = `SENCE ${gameState.player1Name.toUpperCase()} NE SEÇMİŞTİR?`;
    questionTextEl.textContent = questionObj.q2.replace('{p1}', gameState.player1Name);
  }

  const optionsContainer = document.getElementById('options-container');
  optionsContainer.innerHTML = '';

  questionObj.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = "option-btn w-full p-3.5 text-left flex items-center gap-3.5 focus:outline-none";
    btn.innerHTML = `
      <div class="w-11 h-11 rounded-lg bg-black/70 border border-white/15 flex items-center justify-center text-2xl shrink-0">
        ${opt.icon}
      </div>
      <div class="flex-1 text-xs sm:text-sm font-bold leading-snug">
        ${escapeHtml(opt.text)}
      </div>
      <div class="option-status-icon w-6 h-6 rounded-full border border-white/25 flex items-center justify-center text-xs shrink-0 opacity-70">
      </div>
    `;
    btn.addEventListener('click', () => handleOptionSelect(idx, btn));
    optionsContainer.appendChild(btn);
  });

  gameState.isLocked = false;
}

// ---------------- ŞIK SEÇİMİ VE DOĞRU/YANLIŞ ANİMASYONU ----------------
function handleOptionSelect(selectedIndex, clickedBtn) {
  if (gameState.isLocked) return;
  gameState.isLocked = true;

  const allButtons = document.querySelectorAll('#options-container .option-btn');
  allButtons.forEach((b) => (b.disabled = true));

  if (gameState.currentTurn === 1) {
    gameState.p1Answers.push(selectedIndex);
    clickedBtn.classList.add('option-selected-p1');
    const statusIcon = clickedBtn.querySelector('.option-status-icon');
    if (statusIcon) {
      statusIcon.innerHTML = '✓';
      statusIcon.className = 'option-status-icon w-6 h-6 rounded-full bg-accent-1 text-black font-extrabold flex items-center justify-center text-xs shrink-0';
    }

    setTimeout(() => {
      advanceAfterSelection();
    }, 380);
  } else {
    const qIndex = gameState.currentQuestionIndex;
    const correctIndex = gameState.p1Answers[qIndex];
    gameState.p2Guesses.push(selectedIndex);

    const feedbackBanner = document.getElementById('guess-feedback-banner');
    feedbackBanner.classList.remove('hidden');

    if (selectedIndex === correctIndex) {
      clickedBtn.classList.add('option-correct');
      const statusIcon = clickedBtn.querySelector('.option-status-icon');
      if (statusIcon) {
        statusIcon.innerHTML = '✓';
        statusIcon.className = 'option-status-icon w-6 h-6 rounded-full bg-emerald-400 text-black font-extrabold flex items-center justify-center text-xs shrink-0';
      }
      feedbackBanner.className = "rounded-xl px-4 py-2 text-center font-bold text-xs tracking-wide bg-emerald-500/25 border border-emerald-400/60 text-emerald-200 animate-pulse";
      feedbackBanner.textContent = `🎯 Tam İsabet! ${gameState.player1Name} tam olarak bunu seçmişti!`;
    } else {
      clickedBtn.classList.add('option-wrong');
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
          rightIcon.className = 'option-status-icon w-6 h-6 rounded-full bg-emerald-400 text-black font-extrabold flex items-center justify-center text-xs shrink-0';
        }
      }

      feedbackBanner.className = "rounded-xl px-4 py-2 text-center font-bold text-xs tracking-wide bg-red-500/25 border border-red-400/60 text-red-200";
      feedbackBanner.textContent = `❌ Yanlış Tahmin! ${gameState.player1Name} yeşil işaretli şıkkı seçmişti.`;
    }

    setTimeout(() => {
      advanceAfterSelection();
    }, 1250);
  }
}

function advanceAfterSelection() {
  if (gameState.currentQuestionIndex < TOTAL_QUESTIONS - 1) {
    gameState.currentQuestionIndex++;
    renderCurrentQuestion();
  } else {
    if (gameState.currentTurn === 1) {
      showInterstitialScreen();
    } else {
      showResultScreen();
    }
  }
}

// ---------------- ARA EKRAN: TELEFONU DEVRET VEYA LİNK PAYLAŞ ----------------
function showInterstitialScreen() {
  showView('view-interstitial');

  const passBox = document.getElementById('interstitial-pass-box');
  const linkBox = document.getElementById('interstitial-link-box');

  if (gameState.mode === 'pass') {
    passBox.classList.remove('hidden');
    linkBox.classList.add('hidden');

    const descEl = document.getElementById('pass-description-text');
    descEl.innerHTML = `<strong class="text-accent-1">${escapeHtml(gameState.player1Name)}</strong> 5 soruyu kendi adına cevapladı. Şimdi telefonu arkadaşına ver, bakalım onu ne kadar tanıyor!`;

    const passInput = document.getElementById('input-pass-p2-name');
    passInput.value = gameState.player2Name || '';
    document.getElementById('pass-name-error').classList.add('hidden');
  } else {
    passBox.classList.add('hidden');
    linkBox.classList.remove('hidden');

    const payload = {
      p1: gameState.player1Name,
      cat: gameState.category,
      qIds: gameState.selectedQuestions.map((q) => q.id),
      ans: gameState.p1Answers,
      thm: gameState.theme
    };

    const encoded = encodeChallengePayload(payload);
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const challengeUrl = `${baseUrl}?challenge=${encoded}`;
    gameState.generatedChallengeUrl = challengeUrl;

    const urlInput = document.getElementById('generated-challenge-url');
    urlInput.value = challengeUrl;
    document.getElementById('copy-toast').classList.add('hidden');
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

  updateHeaderVSBar();
  showView('view-question');
  renderCurrentQuestion();
}

// ---------------- URL PAYLAŞIM MODU FONKSİYONLARI ----------------
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
  const text = `🔥 Selam! "senceo"da kendimle ilgili 5 soruyu cevapladım. Bakalım beni ne kadar tanıyorsun? Tıkla ve tahmin et: ${url}`;
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

// ---------------- URL'DEN GELEN MEYDAN OKUMAYI KONTROL ET ----------------
function checkIncomingUrlChallenge() {
  const params = new URLSearchParams(window.location.search);
  const challengeParam = params.get('challenge');
  if (!challengeParam) return false;

  const decoded = decodeChallengePayload(challengeParam);
  if (
    !decoded ||
    typeof decoded.p1 !== 'string' ||
    !Array.isArray(decoded.qIds) ||
    !Array.isArray(decoded.ans) ||
    decoded.qIds.length === 0
  ) {
    return false;
  }

  const loadedQuestions = decoded.qIds
    .map((id) => QUESTIONS_DB.find((q) => q.id === id))
    .filter(Boolean);

  if (loadedQuestions.length === 0) return false;

  if (decoded.thm && THEMES[decoded.thm]) {
    applyTheme(decoded.thm);
  }

  gameState.mode = 'link';
  gameState.category = decoded.cat || 'genel';
  gameState.player1Name = decoded.p1;
  gameState.player2Name = '';
  gameState.selectedQuestions = loadedQuestions;
  gameState.p1Answers = decoded.ans;
  gameState.p2Guesses = [];
  gameState.currentQuestionIndex = 0;
  gameState.currentTurn = 2;

  updateHeaderVSBar();

  const titleEl = document.getElementById('challenge-welcome-title');
  titleEl.innerHTML = `<span class="text-accent-1">${escapeHtml(gameState.player1Name)}</span> sana meydan okudu! Bakalım onu ne kadar tanıyorsun?`;

  showView('view-challenge-welcome');
  return true;
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

  updateHeaderVSBar();
  showView('view-question');
  renderCurrentQuestion();
}

// ---------------- SONUÇ EKRANI (SCOREBOARD) ----------------
function showResultScreen() {
  showView('view-result');

  const total = gameState.selectedQuestions.length;
  let correctCount = 0;

  gameState.selectedQuestions.forEach((q, idx) => {
    if (gameState.p1Answers[idx] === gameState.p2Guesses[idx]) {
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

function renderBreakdownList() {
  const container = document.getElementById('result-breakdown-list');
  container.innerHTML = '';

  const p1Name = gameState.player1Name || '1. Oyuncu';
  const p2Name = gameState.player2Name || '2. Oyuncu';

  gameState.selectedQuestions.forEach((q, idx) => {
    const p1Idx = gameState.p1Answers[idx];
    const p2Idx = gameState.p2Guesses[idx];
    const isCorrect = p1Idx === p2Idx;

    const p1Opt = q.options[p1Idx] || { icon: '❓', text: '-' };
    const p2Opt = q.options[p2Idx] || { icon: '❓', text: '-' };

    const card = document.createElement('div');
    card.className = isCorrect
      ? "rounded-xl p-3.5 bg-emerald-500/15 border border-emerald-400/50 space-y-2"
      : "rounded-xl p-3.5 bg-red-500/15 border border-red-400/50 space-y-2";

    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <span class="text-xs font-bold text-white leading-snug">
          ${idx + 1}. ${escapeHtml(q.q1)}
        </span>
        <span class="shrink-0 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
          isCorrect ? 'bg-emerald-400 text-black' : 'bg-red-500 text-white'
        }">
          ${isCorrect ? '✓ Doğru' : '✕ Yanlış'}
        </span>
      </div>

      <div class="grid grid-cols-1 gap-1.5 text-[11px] pt-1">
        <div class="flex items-center gap-2 bg-black/60 px-2.5 py-1.5 rounded border border-white/10">
          <span class="font-bold text-accent-1 shrink-0">${escapeHtml(p1Name)} (Cevap):</span>
          <span class="text-white/90 truncate">${p1Opt.icon} ${escapeHtml(p1Opt.text)}</span>
        </div>
        <div class="flex items-center gap-2 bg-black/60 px-2.5 py-1.5 rounded border border-white/10">
          <span class="font-bold text-white shrink-0">${escapeHtml(p2Name)} (Tahmin):</span>
          <span class="text-white/90 truncate">${p2Opt.icon} ${escapeHtml(p2Opt.text)}</span>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

function triggerCelebrationConfetti(isPerfect) {
  const themeConfetti = THEMES[gameState.theme]?.confettiColors || ['#ff002b', '#ffffff'];
  try {
    confetti({
      particleCount: isPerfect ? 110 : 65,
      spread: 75,
      origin: { y: 0.6 },
      colors: themeConfetti
    });
    if (isPerfect) {
      setTimeout(() => {
        confetti({
          particleCount: 80,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: themeConfetti
        });
        confetti({
          particleCount: 80,
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
    if (gameState.p1Answers[idx] === gameState.p2Guesses[idx]) correctCount++;
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
  if (window.location.search) {
    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  gameState.p1Answers = [];
  gameState.p2Guesses = [];
  gameState.currentQuestionIndex = 0;
  gameState.currentTurn = 1;
  gameState.isLocked = false;

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
window.addEventListener('DOMContentLoaded', () => {
  initSavedTheme();
  const hasChallenge = checkIncomingUrlChallenge();
  if (!hasChallenge) {
    selectGameMode('pass');
    selectCategory('genel');
    showView('view-home');
  }
});
