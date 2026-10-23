# SENCEO — Agent Kuralları ve Geliştirme Protokolü (AGENTS.md)

Bu dosya, **senceo** projesinde çalışan yapay zeka ajanlarının (Agent) uyması gereken zorunlu kuralları, sürümleme standartlarını ve doğrulama protokollerini içerir.

---

## 📌 KURAL 1: Sürümleme (Versioning), Git/GitHub Senkronizasyonu ve Kanıt Onayı

1. **Sürüm Numarası Formatı:**
   - Proje sürüm numarası **`v0.01`**'den başlamıştır.
   - Her güncelleme/değişiklik adımında sürüm numarası `v0.01` -> `v0.02` -> `v0.03` ... -> `v0.99` şeklinde artar ve `v0.99` sonrasında **`v1.00`** olarak devam eder (`v1.01`, `v1.02`...).
   - Aktif sürüm numarası hem bu dosyada hem de uygulama arayüzünde (yalnızca Footer kısmında, üst barda değil) güncel tutulur.

2. **Yerel Git ve GitHub Otomatik Commit Zorunluluğu:**
   - **Her sürümde** değişiklikler hem `senceo` çalışma klasöründeki yerel Git deposuna (`git commit`) kaydedilmeli hem de **`https://github.com/emo29/senceo`** adresindeki uzak (remote) GitHub projesine (`git push`) gönderilmelidir.
   - Ayrıca canlı Vercel ortamı (`https://senceo-xi.vercel.app`) da güncel sürümle senkronize edilmelidir.

3. **5 Sürümde Bir Kanıt ve "Okudunuz mu?" Onay Mekanizması:**
   - Her **5 sürümde bir** (veya ilgili kilometre taşlarında) yerel Git ve GitHub'a commit/push yapıldığına dair somut kanıt (commit hash, git log çıktısı, GitHub API/push doğrulaması) kullanıcıya sunulmalıdır.
   - Kullanıcı bu kanıtı ve mesajı **okuduğunu açıkça onaylamadan**, her sürüm yanıtının sonuna bu kanıt bilgisi eklenmeli ve şu uyarı yazılmalıdır:
     > *"Okudunuz mu? Okuduğunuzu onaylamazsanız bu yazıyı görmeye devam edeceksiniz."*

---

## 📌 KURAL 2: Sıfır Varsayım ve Zorunlu Gerçek Test Protokolü

1. **Varsayımla Hareket Etmek Yasaktır:**
   - Kullanıcı herhangi bir özellik için *"olmadı"*, *"başaramadın"*, *"yanlış oldu"* veya *"hata var"* derse, kesinlikle kafadan uydurma açıklama yapılmayacak veya *"öyle olur diye düşündüm"* denilerek hazıra konmayacaktır.
2. **Bizzat Uçtan Uca Test Zorunluluğu:**
   - Yazılan her kod, yapılan her düzeltme ve dağıtılan (deploy edilen) her link gerçek ortamda (yerel sunucu, gerçek HTTP istekleri, DOM/JS doğrulama testleri ve canlı Vercel/GitHub URL kontrolü ile) bizzat test edilip doğrulandıktan sonra kullanıcıya sunulacaktır.

---

## 📊 Sürüm Geçmişi (Version Log)

- **v0.06** — İki yönlü bulut Arkadaşlık & Bağ İsteği sistemi (`send_friend_request`, `respond_friend_request` ile `SNC-9644` -> `SNC-2281` gibi eklemelerde karşı tarafa **Kabul Et / Reddet** isteği ve bildirim düşmesi), çift yönlü `p1FriendCode` & `p2FriendCode` aktif düello indekslemesi, kendi kurduğu odada `"Odayı Kontrol Et"` butonuna basan 1. oyuncuya yanlışlıkla `"Senin Adın Nedir?"` sormak yerine kendi paylaşım/bekleme ekranını (`showWaitingShareScreenForExistingRoom`) açma düzeltmesi, `stitch_friendship_quiz_app_design` HTML dosyalarındaki tüm eksik bileşenlerin (`🔔 Bildirimler` merkezi, `Liderlik` sekmesi ve sayfası, `Aktif Düellolar` filtre sayaçları, `🔔 Hatırlatma Gönder` dürtme sistemi, 3 adımlı mikro rehber ve interaktif footer bilgi modalları) eklenmesi, 4. tema (`Neo-Brutal Acid`) yazı tipi taşma düzeltmesi (`Space Grotesk`), `"Kendi Öz Seviyen"` ifadesinin **`"senceo Seviyen"`** olarak güncellenmesi, `"Bu Cihazda Test Et"` modunun karşı saldırısız ve `0` veritabanı/XP etkili saf simülasyon (`isSandboxTest`) yapılması ve 4 katmanlı mantık analizindeki tüm kritik hataların (`409` retry, `activeRooms[]`, `Round 2` state temizliği, `join_live_lobby`) giderilmesi tamamlandı.
- **v0.05** — (5. Sürüm Kilometre Taşı): Ayarlar modalında 4 tam kapsamlı tema seçeneği düzenlendi (**1. Luminous Social Gaming [Varsayılan Beyaz]**, **2. Obsidian Kinetic [Koyu]**, **3. Cosmic Neon [Eski Uzay Mavisi & Neon Pembe]** ve **4. Neo-Brutal Acid**); `stitch_friendship_quiz_app_design` tasarımına birebir sadık kalınarak `Yeni Oyun`, `Aktif Oyunlar` ve `Bağlarım` sekmeleri aynı sayfada aşağı kaydırmak yerine birbirinden tamamen bağımsız ayrı sayfalar (`#view-home`, `#view-active-games`, `#view-bonds`) olarak ayrıldı; `Aktif Düellolar` ekranına her düello için tekil **`Bitir / Sil`** (`deleteDuelFromLobby`) ve toplu **`Tümünü Temizle`** (`clearAllActiveDuels`) özellikleri eklendi; `"Klasik 'The Test'"` ifadesi tüm arayüzde **`"Klasik Oyun"`** olarak değiştirildi; Arkadaş Kodu (`SNC-XXXX`) ile eklenen bir arkadaşın 5 soruyu çözüp bitirdiği aktif düelloya **`Düello Başlat / Katıl ⚡`** butonuyla doğrudan katılabilmesi için `/api/rooms` üzerinde `friends/SNC-XXXX.json` indekslemesi ve `startDuelWithFriend()` aktif oda yakalama motoru kuruldu.
- **v0.04** — `stitch_friendship_quiz_app_design` mimarisine geçiş yapıldı: Yeni kullanıcılar için varsayılan tema **1. Luminous Social Gaming (Beyaz)** olarak ayarlandı, **2. Obsidian Kinetic (Koyu)** ve yeni arayüze uyarlanan **3. Neo-Brutal Acid** eklendi; Ayarlar modalından Supabase veritabanı bağlantı kutuları tamamen kaldırıldı; sağ üstteki buton `"Odaya Katıl"` olarak güncellendi; üst bardaki sürüm bilgisi kaldırılıp en alttaki sürüm bilgisi noktasız formatla (`v0.04`) düzenlendi; Google/Facebook/iCloud girişlerinde `window.prompt` hatası kaldırılıp iptal edildiğinde kesinlikle giriş yapmayan gerçek OAuth Hesap Seçici Modalı eklendi; rastgele isim yazarak sahte `1 LV` arkadaş ekleme kaldırılıp benzersiz **Arkadaş Kodu (`SNC-XXXX`)**, **Oda Kodu (`SNC123`)** ve gerçek ortak maç doğrulamalı Bağ Ağı sistemi kuruldu.
- **v0.03** — Orijinal Facebook Messenger "The Test" tam oyun döngüsü (2 Aşamalı Karşılıklı Rol Değişimi / Halftime Reversal & Çoklu Raund), ultra kısa davet linkleri (`?r=SNC84K`), doğrudan sonuç karnesi paylaşım linki (`?r=SNC84K&view=result`), sol üstte kompakt Profil & Seviye butonu, Google/Facebook/iCloud + "Üye Olmadan Devam Et" çerezli giriş sistemi, Çift Level Sistemi (Kendi Öz XP Seviyesi + Arkadaş İkili Bağ Seviyesi), Canlı Oda Kurma Lobisi (`1v1`, `2v2`, `3v3`, `4v4`, `5v5`, `Herkes Tek` — sorular başlamadan önce oda kodu verme), `🔄 Soruyu Değiştir (2/2)`, `⏭️ Pas (1/1)`, `✏️ Kendi Cevabını Yaz (1/1)`, ses efektli Messenger Gizli Sohbet Balonu, 75 soruluk dev havuz, `SIFRELERIM_GIZLI.txt` + `.gitignore` koruması ve `supabase_setup.sql` (`kypzuqnksnlinkfuxvnl`) kurulumu eklendi.
- **v0.02** — Canlı Bulut Veritabanı (`/api/rooms`), 54 soru, Emoji & Yorum sistemi, sağ üst bildirim çanı ve `emirhanus imp.` alt bilgisi eklendi.
- **v0.01** — İlk sürüm oluşturuldu, 3 tam kapsamlı tema motoru, Ayarlar modalı, `AGENTS.md` kuralları, GitHub (`emo29/senceo`) ve Vercel canlı kurulumu tamamlandı.


