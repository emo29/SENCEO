# SENCEO — Agent Kuralları ve Geliştirme Protokolü (AGENTS.md)

Bu dosya, **senceo** projesinde çalışan yapay zeka ajanlarının (Agent) uyması gereken zorunlu kuralları, sürümleme standartlarını ve doğrulama protokollerini içerir.

---

## 📌 KURAL 1: Sürümleme (Versioning), Git/GitHub Senkronizasyonu ve Kanıt Onayı

1. **Sürüm Numarası Formatı:**
   - Proje sürüm numarası **`v0.01`**'den başlamıştır.
   - Her güncelleme/değişiklik adımında sürüm numarası `v0.01` -> `v0.02` -> ... -> `v0.99` şeklinde artar ve `v0.99` sonrasında **`v1.00`** olarak devam eder (`v1.01`, `v1.02`...).
   - Aktif sürüm numarası hem bu dosyada hem de uygulama arayüzünde (Ayarlar & Footer) güncel tutulur.

2. **Yerel Git ve GitHub Otomatik Commit Zorunluluğu:**
   - **Her sürümde** değişiklikler hem `senceo` çalışma klasöründeki yerel Git deposuna (`git commit`) kaydedilmeli hem de **`https://github.com/emo29/senceo`** adresindeki uzak (remote) GitHub projesine (`git push`) gönderilmelidir.
   - Ayrıca canlı Vercel ortamı da güncel sürümle senkronize edilmelidir.

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

- **v0.01** — İlk sürüm oluşturuldu, 3 tam kapsamlı tema motoru (Abyssal Crimson [Varsayılan: Simsiyah & Kırmızı], Neo-Brutalist Kinetic [Ekim 2026 Trendi], Cosmic Neon [Orijinal Uzay/Gece Mavisi]), Ayarlar modalı, `AGENTS.md` kuralları, GitHub (`emo29/senceo`) ve Vercel canlı kurulumu tamamlandı.
