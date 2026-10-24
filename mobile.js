// ==========================================================================
// senceo v0.11 — MOBİL KABUK (alt sekme çubuğu, hoş geldin kartı, 6 kutulu kod,
// liderlik kürsüsü). Yalnızca <html class="is-mobile"> iken görünür öğeleri yönetir.
// app.js'ten SONRA yüklenir; app.js bu fonksiyonları typeof kontrolüyle çağırır.
// ==========================================================================

function isMobileShell() {
  return document.documentElement.classList.contains('is-mobile');
}

const MOBILE_VIEW_TO_TAB = {
  'view-home': 'setup',
  'view-active-games': 'duels',
  'view-bonds': 'bonds',
  'view-leaderboard': 'leaderboard'
};

function syncMobileChrome(viewId) {
  const activeTab = MOBILE_VIEW_TO_TAB[viewId || document.body.getAttribute('data-view')] || '';
  document.querySelectorAll('#mobile-bottom-nav .m-nav-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.getAttribute('data-tab') === activeTab);
  });
  if (viewId === 'view-home') syncMobileWelcomeCard();
  syncMobileHeaderLevel();
  syncMobileBadges();
}

function mobileNavTo(tab) {
  if (typeof switchTopNavPage === 'function') switchTopNavPage(tab);
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
}

function syncMobileHeaderLevel() {
  const el = document.getElementById('m-header-level');
  if (!el || typeof userProfile === 'undefined') return;
  el.textContent = `LVL ${userProfile.level || 1} • ${userProfile.xp || 0} XP`;
}

function syncMobileWelcomeCard() {
  if (typeof userProfile === 'undefined') return;
  const nameEl = document.getElementById('m-welcome-name');
  const badgeEl = document.getElementById('m-welcome-badge');
  const linkBtn = document.getElementById('m-welcome-link-btn');
  const descEl = document.getElementById('m-welcome-desc');
  const name =
    userProfile.username && userProfile.username !== 'Misafir Oyuncu' ? userProfile.username : 'Oyuncu';
  if (nameEl) nameEl.textContent = name;
  const isPermanent = Boolean(
    userProfile.isPermanentMember ||
      (userProfile.provider && !['guest', 'Misafir'].includes(userProfile.provider) && userProfile.email)
  );
  if (badgeEl) badgeEl.textContent = isPermanent ? (userProfile.provider || 'Üye') : 'Misafir';
  if (linkBtn) linkBtn.classList.toggle('hidden', isPermanent);
  if (descEl) {
    descEl.textContent = isPermanent
      ? `Arkadaş kodun: ${userProfile.friendCode || ''} • İlerlemen hesabına kayıtlı.`
      : 'İlerlemeni, arkadaş bağlarını ve rozetlerini kalıcı kılmak için oturumunu güvenle eşleştirebilirsin.';
  }
}

// Masaüstü rozetlerini (Aktif Oyunlar sayısı, bağ istekleri) alt çubuğa aynala
function syncMobileBadges() {
  const pairs = [
    ['nav-active-duels-count', 'm-nav-duels-count'],
    ['nav-bonds-req-count', 'm-nav-bonds-count']
  ];
  pairs.forEach(([src, dst]) => {
    const s = document.getElementById(src);
    const d = document.getElementById(dst);
    if (!s || !d) return;
    const txt = (s.textContent || '').trim();
    const visible = !s.classList.contains('hidden') && txt && txt !== '0';
    d.textContent = txt || '0';
    d.classList.toggle('hidden', !visible);
  });
}

function observeMobileBadges() {
  const ids = ['nav-active-duels-count', 'nav-bonds-req-count', 'nav-profile-level-badge', 'nav-profile-xp-label'];
  const obs = new MutationObserver(() => {
    syncMobileBadges();
    syncMobileHeaderLevel();
  });
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) obs.observe(el, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  });
}

// ---------------- 6 KUTULU ODA KODU GİRİŞİ ----------------
function initMobileOtpBoxes() {
  const boxes = Array.from(document.querySelectorAll('.m-otp-box'));
  boxes.forEach((box, idx) => {
    box.addEventListener('input', () => {
      const raw = box.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (raw.length > 1) {
        // Yapıştırma: "SNC123" tek kutuya yapıştırılırsa kutulara dağıt
        raw.split('').slice(0, boxes.length - idx).forEach((ch, k) => (boxes[idx + k].value = ch));
        const next = boxes[Math.min(idx + raw.length, boxes.length - 1)];
        if (next) next.focus();
        return;
      }
      box.value = raw;
      if (raw && boxes[idx + 1]) boxes[idx + 1].focus();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && boxes[idx - 1]) boxes[idx - 1].focus();
      if (e.key === 'Enter') submitMobileOtpJoin();
    });
  });
}

function submitMobileOtpJoin() {
  const code = Array.from(document.querySelectorAll('.m-otp-box')).map((b) => b.value).join('').toUpperCase();
  const hidden = document.getElementById('dashboard-quick-room-input');
  if (hidden) hidden.value = code;
  if (typeof handleDashboardQuickJoin === 'function') {
    handleDashboardQuickJoin({ preventDefault() {} });
  }
}

// ---------------- DAVET LİNKİ PAYLAŞ (Mobil Paylaşım Sayfası) ----------------
async function mobileShareInvite() {
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const inpP1 = document.getElementById('input-p1-name');
  const candidateName =
    (typeof userProfile !== 'undefined' && userProfile.username && userProfile.username !== 'Misafir Oyuncu'
      ? userProfile.username.trim()
      : '') ||
    (inpP1 && inpP1.value.trim()) ||
    'Arkadaşın';
  if (
    typeof userProfile !== 'undefined' &&
    candidateName !== 'Arkadaşın' &&
    (!userProfile.username || userProfile.username === 'Misafir Oyuncu')
  ) {
    userProfile.username = candidateName;
    if (typeof saveUserProfile === 'function') saveUserProfile(false);
  }
  const code = (typeof userProfile !== 'undefined' && userProfile.friendCode) || '';
  const url = `${baseUrl}?friend=${encodeURIComponent(code)}&fname=${encodeURIComponent(candidateName)}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'senceo', text: `senceo'da benimle düello yap! Arkadaş kodum: ${code}`, url });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  if (typeof copyMyFriendInviteLink === 'function') copyMyFriendInviteLink();
}

function mobileCopyFriendCode() {
  const code = (typeof userProfile !== 'undefined' && userProfile.friendCode) || '';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => {
      const toast = document.getElementById('friend-invite-copy-toast');
      if (toast) {
        toast.textContent = `✅ Arkadaş kodun (${code}) kopyalandı!`;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
      }
    });
  }
}

// ---------------- LİDERLİK: Bireysel / İkililer sekmesi + Kürsü + Sıram kartı ----------------
function setMobileLeaderboardTab(tab) {
  const isPlayers = tab !== 'bonds';
  document.getElementById('m-lb-tab-players')?.classList.toggle('is-active', isPlayers);
  document.getElementById('m-lb-tab-bonds')?.classList.toggle('is-active', !isPlayers);
  document.getElementById('lb-card-players')?.classList.toggle('m-lb-hidden', !isPlayers);
  document.getElementById('lb-card-bonds')?.classList.toggle('m-lb-hidden', isPlayers);
  document.getElementById('m-lb-podium-wrap')?.classList.toggle('m-lb-hidden', !isPlayers);
}

function initialsOf(name) {
  const clean = String(name || '').replace(/\(SNC-\d{4}\)/i, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'OY';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function renderMobileLeaderboardExtras(players) {
  if (!Array.isArray(players)) return;
  const esc = typeof escapeHtml === 'function' ? escapeHtml : (s) => String(s);
  const shortName = (n) => String(n || '').replace(/\s*\(SNC-\d{4}\)/i, '');

  const meIdx = players.findIndex((p) => p.isMe);
  const me = meIdx >= 0 ? players[meIdx] : null;
  const rankEl = document.getElementById('m-lb-my-rank');
  if (rankEl && me) {
    rankEl.innerHTML = `
      <div class="w-12 h-14 rounded-xl bg-primary-theme flex flex-col items-center justify-center shrink-0 leading-none">
        <span class="text-[10px] font-bold opacity-80">SIRA</span>
        <span class="font-display-theme font-extrabold text-lg">#${meIdx + 1}</span>
      </div>
      <div class="w-11 h-11 rounded-full stitch-subcard flex items-center justify-center font-extrabold text-primary-theme shrink-0">${esc(initialsOf(me.name))}</div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <span class="font-bold text-sm truncate">Sen (${esc(shortName(me.name))})</span>
          <span class="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 text-[10px] font-extrabold">SEN</span>
        </div>
        <div class="text-xs text-muted-theme truncate">LVL ${me.lvl} • ${me.xp} TP • ${me.correct || 0} Doğru Tahmin</div>
      </div>`;
  }

  const podium = document.getElementById('m-lb-podium');
  if (podium) {
    const top = players.slice(0, 3);
    const order = [top[1], top[0], top[2]];
    const medals = ['🥈', '🥇', '🥉'];
    const ranks = [2, 1, 3];
    podium.innerHTML = order
      .map((p, i) => {
        if (!p) return '<div></div>';
        return `
        <div class="m-podium-col ${ranks[i] === 1 ? 'is-first' : ''}">
          <div class="text-lg leading-none">${medals[i]}</div>
          <div class="m-podium-avatar">${esc(initialsOf(p.name))}</div>
          <div class="m-podium-box">
            <div class="text-[11px] font-extrabold text-muted-theme">${ranks[i]}</div>
            <div class="m-podium-name">${esc(shortName(p.name))}${p.isMe ? ' (Sen)' : ''}</div>
            <div class="text-xs font-extrabold text-primary-theme">${p.xp} TP</div>
            <div class="text-[10px] text-muted-theme">LVL ${p.lvl}</div>
          </div>
        </div>`;
      })
      .join('');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  observeMobileBadges();
  initMobileOtpBoxes();
  setMobileLeaderboardTab('players');
  syncMobileChrome(document.body.getAttribute('data-view') || 'view-home');
});
