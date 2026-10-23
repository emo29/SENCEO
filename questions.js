// senceo — Soru Veri Tabanı (75 Eğlenceli, Samimi ve Tartışma Çıkaracak Türkçe Soru — v0.03)
// Kategoriler: 'genel', 'cift', 'kanka', 'ekstrem'
// Orijinal "The Test" ruhuna uygun 2 şıklı hızlı ikilemler ve 4 şıklı klasik sorular içerir.

const QUESTIONS_DB = [
  // ==================== GENEL & EĞLENCE (1 - 24) ====================
  {
    id: 1,
    category: 'genel',
    categoryLabel: '🌟 Genel',
    q1: "Bir zombi istilası başlasa ilk hamlen ne olur?",
    q2: "Sence {p1}, bir zombi istilası başlasa ilk hamle olarak ne yapardı?",
    options: [
      { icon: "🛒", text: "Marketi yağmalarım" },
      { icon: "🔪", text: "Silah bulup sığınak ararım" },
      { icon: "🧟‍♂️", text: "Panikleyip ilk gün ısırılırım" },
      { icon: "🤝", text: "Zombilerle anlaşmaya çalışırım" }
    ]
  },
  {
    id: 2,
    category: 'genel',
    categoryLabel: '🌟 Genel',
    q1: "Issız bir adaya düşsen yanına alacağın tek şey ne olurdu?",
    q2: "Sence {p1}, ıssız bir adaya düşse yanına tek şey olarak ne alırdı?",
    options: [
      { icon: "📱", text: "Şarjı bitmeyen telefon" },
      { icon: "🔪", text: "Hayatta kalma bıçağı" },
      { icon: "🍕", text: "Sınırsız pizza ve su" },
      { icon: "🎸", text: "Vakit geçirmek için gitar" }
    ]
  },
  {
    id: 3,
    category: 'genel',
    categoryLabel: '🌟 Genel',
    q1: "Piyangodan 100 Milyon TL çıksa ilk yapacağın şey?",
    q2: "Sence {p1}, piyangodan 100 Milyon TL kazansa ilk ne yapardı?",
    options: [
      { icon: "✈️", text: "Kimseye söylemeden ülkeden uçmak" },
      { icon: "🏠", text: "Aileme ve kendime ev/araba almak" },
      { icon: "📈", text: "Hepsini yatırıma/borsaya basmak" },
      { icon: "🎉", text: "Bütün arkadaşları toplayıp efsane bir parti vermek" }
    ]
  },
  {
    id: 4,
    category: 'cift',
    categoryLabel: '❤️ Çift / İlişki',
    q1: "Sevgilinin/En yakın arkadaşının telefonunu gizlice karıştırır mısın?",
    q2: "Sence {p1}, sevgilisinin veya en yakın arkadaşının telefonunu gizlice karıştırır mı?",
    options: [
      { icon: "🕵️‍♂️", text: "Şifresini biliyorsam affetmem bakarım" },
      { icon: "😇", text: "Asla, özel hayata saygım sonsuz" },
      { icon: "🤔", text: "Sadece çok şüphelenirsem bakarım" },
      { icon: "📱", text: "Zaten her şeyini bana kendi gösterir" }
    ]
  },
  {
    id: 5,
    category: 'ekstrem',
    categoryLabel: '🔥 Ekstrem',
    q1: "Görünmezlik pelerinine sahip olsan ilk nereye sızardın?",
    q2: "Sence {p1}, görünmezlik pelerinine sahip olsa ilk nereye sızardı?",
    options: [
      { icon: "🏦", text: "Merkez Bankası kasasına" },
      { icon: "👽", text: "51. Bölgeye" },
      { icon: "🗣️", text: "Arkamdan konuşanların yanına" },
      { icon: "✈️", text: "Bedava dünya turu için ilk uçağa" }
    ]
  },
  {
    id: 6,
    category: 'cift',
    categoryLabel: '❤️ Çift / İlişki',
    q1: "Bir tartışmada haksız olduğunu anladığında ne yaparsın?",
    q2: "Sence {p1}, bir tartışmada haksız olduğunu anladığında ne yapar?",
    options: [
      { icon: "🏳️", text: "Hemen özür diler konuyu kapatırım" },
      { icon: "🔥", text: "Haklı çıkana kadar konuyu saptırırım" },
      { icon: "😶", text: "Hiçbir şey olmamış gibi susup trip atarım" },
      { icon: "😂", text: "Şakaya vurup ortamı yumuşatırım" }
    ]
  },
  {
    id: 7,
    category: 'genel',
    categoryLabel: '🌟 Genel',
    q1: "Gece evde tek başınayken içeriden tıkırtı gelse tepkin ne olur?",
    q2: "Sence {p1}, gece evde tek başınayken içeriden tıkırtı duysa ne yapardı?",
    options: [
      { icon: "🧹", text: "Elime sopayı alıp sesin kaynağını basarım" },
      { icon: "🛌", text: "Yorganı kafama çekip dua ederim" },
      { icon: "📞", text: "Hemen birini arayıp hatta kalmasını isterim" },
      { icon: "🐈", text: "'Kesin rüzgardır' deyip uyumaya devam ederim" }
    ]
  },
  {
    id: 8,
    category: 'kanka',
    categoryLabel: '⚡ Kanka / Eğlence',
    q1: "Seni en çok hangisi çileden çıkarır?",
    q2: "Sence {p1}'i aşağıdakilerden hangisi en çok çileden çıkarır?",
    options: [
      { icon: "🐢", text: "Yavaş yürüyen ve yolu kapatan insanlar" },
      { icon: "💬", text: "Mesajlara 'görüldü' atılıp geç dönülmesi" },
      { icon: "🍽️", text: "Ağız şapırdatarak yemek yenmesi" },
      { icon: "🤥", text: "Gözümün içine baka baka yalan söylenmesi" }
    ]
  },
  {
    id: 9,
    category: 'genel',
    categoryLabel: '🌟 Genel',
    q1: "Hayatın bir film olsa türü ne olurdu?",
    q2: "Sence {p1}'in hayatı bir film olsa türü ne olurdu?",
    options: [
      { icon: "😂", text: "Absürt Komedi" },
      { icon: "🎭", text: "Ağır Dram" },
      { icon: "🎢", text: "Aksiyon ve Macera" },
      { icon: "🤯", text: "Psikolojik Gerilim" }
    ]
  },
  {
    id: 10,
    category: 'kanka',
    categoryLabel: '⚡ Kanka / Eğlence',
    q1: "Bir restoranda siparişin yanlış gelse ne yaparsın?",
    q2: "Sence {p1}, restoranda siparişi yanlış gelse nasıl tepki verir?",
    options: [
      { icon: "🙋‍♂️", text: "Hemen garsonu çağırıp değiştirtirim" },
      { icon: "🤐", text: "'Sorun değil' deyip önüme geleni yerim" },
      { icon: "😒", text: "İçimden söylenirim ama ses çıkarmam" },
      { icon: "⭐", text: "Yemekten sonra mekana 1 yıldız basarım" }
    ]
  },
  {
    id: 11,
    category: 'genel',
    categoryLabel: '🌟 Genel',
    q1: "Geçmişe mi gitmek isterdin yoksa geleceğe mi?",
    q2: "Sence {p1} zaman yolculuğu yapsa hangisini seçerdi?",
    options: [
      { icon: "🦖", text: "Geçmişe gidip hatalarımı düzeltmek ve yatırım yapmak" },
      { icon: "🚀", text: "100 yıl sonrasının teknolojisini görmek" },
      { icon: "🛋️", text: "Hiçbiri, şu anki zamanımdan memnunum" },
      { icon: "👑", text: "Orta Çağ'da bir kral/kraliçe olmak" }
    ]
  },
  {
    id: 12,
    category: 'kanka',
    categoryLabel: '⚡ Kanka / Eğlence',
    q1: "Buluşmaya geç kalan arkadaşına ne yaparsın?",
    q2: "Sence {p1}, buluşmaya geç kalan arkadaşına ne yapar?",
    options: [
      { icon: "😡", text: "Geldiğinde yarım saat surat yaparım" },
      { icon: "⏱️", text: "Ben de bilerek geç giderim, ödeşiriz" },
      { icon: "☕", text: "Hiç takmam, bir kahve söyler beklerim" },
      { icon: "🏃‍♂️", text: "15 dakika bekler, gelmezse basar giderim" }
    ]
  },
  {
    id: 13,
    category: 'cift',
    categoryLabel: '❤️ Çift / İlişki',
    q1: "İdeal bir ilk buluşma (First Date) senin için nasıl olmalı?",
    q2: "Sence {p1} için ideal bir ilk buluşma hangisidir?",
    options: [
      { icon: "🕯️", text: "Şık bir restoranda romantik akşam yemeği" },
      { icon: "☕", text: "Rahat bir kafede kahve içip uzun sohbet etmek" },
      { icon: "🎡", text: "Lunapark, konser veya sıra dışı bir aktivite" },
      { icon: "🌊", text: "Sahilde/parkta salaş bir yürüyüş ve sokak lezzeti" }
    ]
  },
  {
    id: 14,
    category: 'cift',
    categoryLabel: '❤️ Çift / İlişki',
    q1: "İlişkide kıskançlık seviyen nedir?",
    q2: "Sence {p1}'in ikili ilişkilerdeki kıskançlık seviyesi nasıldır?",
    options: [
      { icon: "🌋", text: "Çok kıskancım, sinek uçsa hesabını sorarım" },
      { icon: "🕵️‍♀️", text: "Çaktırmam ama içten içe FBI gibi takip ederim" },
      { icon: "⚖️", text: "Dozunda kıskanırım, güven varsa sorun yoktur" },
      { icon: "🧊", text: "Sıfır kıskançlık, herkes özgür bir bireydir" }
    ]
  },
  {
    id: 15,
    category: 'cift',
    categoryLabel: '❤️ Çift / İlişki',
    q1: "Sevgilin/eşin senin için çok kötü bir yemek yapmış, tepkin ne olur?",
    q2: "Sence {p1}, partneri çok kötü bir yemek yapsa ne tepki verir?",
    options: [
      { icon: "😋", text: "Bayılmış gibi yapıp tabağı sonuna kadar bitiririm" },
      { icon: "😬", text: "'Eline sağlık ama tuzu/kıvamı biraz kaçmış' derim" },
      { icon: "🛵", text: "Açıkça yenmeyeceğini söyleyip dışarıdan sipariş veririm" },
      { icon: "🪴", text: "O bakmıyorken peçeteye veya çöpe gizlice dökerim" }
    ]
  },
  {
    id: 16,
    category: 'kanka',
    categoryLabel: '⚡ Kanka / Eğlence',
    q1: "Arkadaş grubunda senin rolün hangisidir?",
    q2: "Sence {p1}, arkadaş grubunda hangi roldedir?",
    options: [
      { icon: "📋", text: "Planları organize eden 'Anne/Baba' figürü" },
      { icon: "🤡", text: "Ortamı sürekli güldüren kaos ve mizah makinesi" },
      { icon: "🛋️", text: "Her şeye son dakika ikna edilen üşengeç üye" },
      { icon: "🧠", text: "Herkesin derdini dinleyen grup psikoloğu" }
    ]
  },
  {
    id: 17,
    category: 'kanka',
    categoryLabel: '⚡ Kanka / Eğlence',
    q1: "En yakın arkadaşın berbat bir kıyafetle yanına geldi ve 'Nasıl olmuş?' dedi:",
    q2: "Sence {p1}, kankası berbat bir kıyafetle 'Nasıl olmuş?' diye sorsa ne der?",
    options: [
      { icon: "🔥", text: "'Aşırı kötü olmuş, git hemen değiştir!' derim" },
      { icon: "🤥", text: "Moralini bozmamak için 'Çok yakışmış' derim" },
      { icon: "🧐", text: "'Fena değil ama şu parçayı çıkarsan daha iyi' diye kıvırırım" },
      { icon: "😂", text: "Fotoğrafını çekip grupta dalga geçerim" }
    ]
  },
  {
    id: 18,
    category: 'kanka',
    categoryLabel: '⚡ Kanka / Eğlence',
    q1: "Kalabalık ve sıkıcı bir ev partisindesin, ne yaparsın?",
    q2: "Sence {p1}, kalabalık ve sıkıcı bir ev partisinde ne yapar?",
    options: [
      { icon: "🎵", text: "Müziği ele geçirip ortamı canlandırırım" },
      { icon: "🐶", text: "Evdeki kedi/köpekle köşede vakit geçiririm" },
      { icon: "🍕", text: "Sadece atıştırmalıkların başında takılırım" },
      { icon: "🥷", text: "Kimseye vedalaşmadan (Fransız usulü) sıvışırım" }
    ]
  },
  {
    id: 19,
    category: 'ekstrem',
    categoryLabel: '🔥 Ekstrem',
    q1: "Sana 10 Milyon TL verecekler ama 1 yıl boyunca internet ve telefon yasak. Kabul eder misin?",
    q2: "Sence {p1}, 10 Milyon TL karşılığında 1 yıl telefonsuz ve internetsiz kalmayı kabul eder mi?",
    options: [
      { icon: "🤑", text: "Saniyesinde kabul ederim, kitap okur doğada yaşarım" },
      { icon: "📵", text: "Kabul ederim ama ilk aydan duvarları tırmalarım" },
      { icon: "🤔", text: "Çok zorlanırım, parayı peşin verirlerse düşünürüm" },
      { icon: "❌", text: "Asla yapamam, sosyal medyasız ve müziksiz deliririm" }
    ]
  },
  {
    id: 20,
    category: 'ekstrem',
    categoryLabel: '🔥 Ekstrem',
    q1: "Telefonundaki tüm mesaj ve arama geçmişin dev ekranda yayınlansa ne olurdu?",
    q2: "Sence {p1}'in tüm telefon geçmişi dev ekranda yayınlansa ne olurdu?",
    options: [
      { icon: "🛂", text: "Sahte kimlik çıkarıp anında ülkeyi terk ederim" },
      { icon: "😅", text: "Birkaç kişiyle aram bozulur ama toparlarım" },
      { icon: "😎", text: "Hiçbir şey olmaz, gizlim saklım yoktur" },
      { icon: "🧹", text: "Zaten her gün mesajlarımı düzenli silerim, ekran boş çıkar" }
    ]
  },
  {
    id: 21,
    category: 'ekstrem',
    categoryLabel: '🔥 Ekstrem',
    q1: "Bir süper gücün olsa ama karşılığında bir kusurun olsa hangisini seçerdin?",
    q2: "Sence {p1} bu tuhaf süper güç ikilemlerinden hangisini seçerdi?",
    options: [
      { icon: "🧠", text: "Zihin okumak ama kendi düşüncelerinin de sesli duyulması" },
      { icon: "🦅", text: "Uçabilmek ama sadece yürüme hızında (saatte 5 km)" },
      { icon: "⚡", text: "Işınlanmak ama her seferinde rastgele bir kıyafetinin kaybolması" },
      { icon: "⏳", text: "Zamanı durdurmak ama durdurduğun sürece senin de yaşlanman" }
    ]
  },
  {
    id: 22,
    category: 'ekstrem',
    categoryLabel: '🔥 Ekstrem',
    q1: "En yakın arkadaşın bir suç işledi ve senden saklanmak için yardım istedi:",
    q2: "Sence {p1}, en yakın arkadaşı bir suç işleyip yardım istese ne yapardı?",
    options: [
      { icon: "🚗", text: "Sorgusuz sualsiz bagaja atar kaçırırım" },
      { icon: "⚖️", text: "Ne yaptığına bağlı, haklıysa yardım ederim" },
      { icon: "🗣️", text: "Teslim olması için ikna etmeye çalışırım" },
      { icon: "🚔", text: "'Ben yanamam kusura bakma' derim, başımı belaya sokmam" }
    ]
  },
  {
    id: 23,
    category: 'cift',
    categoryLabel: '❤️ Çift / İlişki',
    q1: "Bir ilişkide affedemeyeceğin en büyük 'Red Flag' (Kırmızı Çizgi) nedir?",
    q2: "Sence {p1} için bir ilişkideki en büyük 'Red Flag' hangisidir?",
    options: [
      { icon: "📱", text: "Eski sevgiliyle hala 'arkadaşça' görüşüyor olması" },
      { icon: "💸", text: "Aşırı cimri olması ve her kuruşun hesabını yapması" },
      { icon: "🙄", text: "Garsonlara veya çalışanlara kaba davranması" },
      { icon: "🎭", text: "Sürekli ilgi çekmeye çalışması ve drama yaratması" }
    ]
  },
  {
    id: 24,
    category: 'ekstrem',
    categoryLabel: '🔥 Ekstrem',
    q1: "Dünyanın sonuna 24 saat kaldığı açıklansa son gününü nasıl geçirirsin?",
    q2: "Sence {p1}, dünyanın sonuna 24 saat kalsa son gününü nasıl geçirirdi?",
    options: [
      { icon: "🫂", text: "Sevdiklerime sarılıp sakin bir yerde beklerim" },
      { icon: "🏎️", text: "En lüks arabayı kaçırıp son hız sürerim" },
      { icon: "🍔", text: "Kalori hesabı yapmadan dünyadaki tüm tatlı ve yemekleri yerim" },
      { icon: "😴", text: "Panik yaşamamak için uyku ilacı alıp uyurum" }
    ]
  },

  // ==================== SORULAR 25 - 54 ====================
  {
    id: 25,
    category: 'genel',
    categoryLabel: '🌟 Genel',
    q1: "Sabah alarmın çaldığında senin klasik rutinin hangisidir?",
    q2: "Sence {p1}, sabah alarmı çaldığında ne yapar?",
    options: [
      { icon: "⏰", text: "İlk alarmda zıpkın gibi yataktan fırlarım" },
      { icon: "😴", text: "En az 5 kere '5 dakika daha' diyerek ertelerim" },
      { icon: "📱", text: "Yataktan çıkmadan yarım saat sosyal medyada gezerim" },
      { icon: "🔇", text: "Alarmı hiç duymam bile, kesin geç kalırım" }
    ]
  },
  {
    id: 26,
    category: 'genel',
    categoryLabel: '🌟 Genel',
    q1: "Asansörde tanımadığın biriyle yalnız kaldığında ne yaparsın?",
    q2: "Sence {p1}, asansörde yabancıyla yalnız kaldığında ne yapar?",
    options: [
      { icon: "📱", text: "Çok önemli bir işim varmış gibi telefona gömülürüm" },
      { icon: "🪞", text: "Çaktırmadan aynadan kendime ve üstüme başıma bakarım" },
      { icon: "🙂", text: "Hafifçe gülümseyip 'İyi günler' derim" },
      { icon: "👀", text: "Tavana veya kat numaralarına bakıp sessizce beklerim" }
    ]
  },
  {
    id: 27,
    category: 'genel',
    categoryLabel: '🌟 Genel',
    q1: "İnternetten alışveriş yaparken hangisi tam olarak sensin?",
    q2: "Sence {p1}, internetten alışveriş yaparken nasıl davranır?",
    options: [
      { icon: "🛒", text: "Sepeti doldurup doldurup hiçbirini almadan kapatırım" },
      { icon: "🔍", text: "Yüzlerce yorumu ve 1 yıldızlı değerlendirmeleri tek tek okurum" },
      { icon: "⚡", text: "Beğendiğim şeyi 10 saniyede düşünmeden satın alırım" },
      { icon: "🏷️", text: "İndirim kodu veya kampanya gelene kadar favorilerde bekletirim" }
    ]
  },
  {
    id: 28,
    category: 'genel',
    categoryLabel: '🌟 Genel',
    q1: "Bir sabah uyandığında karşı cinse dönüştüğünü fark etsen ilk ne yaparsın?",
    q2: "Sence {p1}, bir sabah karşı cins olarak uyansa ilk ne yapardı?",
    options: [
      { icon: "🪞", text: "Saatlerce aynanın karşısında yeni tipimi incelerim" },
      { icon: "😱", text: "Rüya gördüğümü sanıp tekrar uyumaya çalışırım" },
      { icon: "🗣️", text: "En yakın arkadaşımı arayıp şoka sokarım" },
      { icon: "🕺", text: "Dışarı çıkıp karşı cinsin dünyasını test ederim" }
    ]
  },
  {
    id: 29,
    category: 'genel',
    categoryLabel: '🌟 Genel',
    q1: "Yolda yürürken herkesin içinde fena halde ayağın takılıp düşsen ne yaparsın?",
    q2: "Sence {p1}, kalabalıkta yere kapaklansa durumu nasıl kurtarır?",
    options: [
      { icon: "😂", text: "Yerdeyken kendime kahkahalarla gülerim" },
      { icon: "🏃", text: "Hiçbir şey olmamış gibi ışık hızıyla kalkıp yürürüm" },
      { icon: "👟", text: "Suçu kaldırım taşına veya ayakkabı bağcığıma atarım" },
      { icon: "🤕", text: "Çok acımış gibi yapıp insanların acımasını beklerim" }
    ]
  },
  {
    id: 30,
    category: 'genel',
    categoryLabel: '🌟 Genel',
    q1: "Bir diziye veya filme başladığında senin izleme tarzın nasıldır?",
    q2: "Sence {p1}'in dizi/film izleme alışkanlığı nasıldır?",
    options: [
      { icon: "🍿", text: "Sabaha kadar uyumam, bütün sezonu tek oturuşta bitiririm" },
      { icon: "😴", text: "Daha ilk 15 dakikada koltukta sızıp uyuyakalırım" },
      { icon: "⏩", text: "Sıkıcı sahneleri 10 saniye ileri sara sara izlerim" },
      { icon: "🕵️", text: "Meraktan dayanamayıp önce son bölümün özetini okurum" }
    ]
  },
  {
    id: 31,
    category: 'genel',
    categoryLabel: '🌟 Genel',
    q1: "Ömrünün sonuna kadar sadece tek bir mutfağın yemeklerini yiyebilsen hangisini seçerdin?",
    q2: "Sence {p1}, ömrü boyunca tek bir mutfak seçse hangisini seçerdi?",
    options: [
      { icon: "🥙", text: "Tabii ki Türk Mutfağı (Kebaplar, lahmacun, mantı)" },
      { icon: "🍕", text: "İtalyan Mutfağı (Pizza, makarna, tiramisu)" },
      { icon: "🍔", text: "Amerikan Fast-Food (Burger, patates kızartması)" },
      { icon: "🍣", text: "Uzak Doğu Mutfağı (Sushi, ramen, noodle)" }
    ]
  },
  {
    id: 32,
    category: 'genel',
    categoryLabel: '🌟 Genel',
    q1: "Tatil anlayışın aşağıdakilerden hangisine daha yakındır?",
    q2: "Sence {p1} için ideal tatil hangisidir?",
    options: [
      { icon: "🏖️", text: "Her şey dahil otelde şezlongdan hiç kalkmadan yatmak" },
      { icon: "🎒", text: "Sırt çantasını alıp günde 20 bin adım yeni şehirler gezmek" },
      { icon: "⛺", text: "Doğada, ormanda veya deniz kenarında kamp yapmak" },
      { icon: "🏠", text: "Evde klimayı açıp kimseyi görmeden kafa dinlemek" }
    ]
  },
  {
    id: 33,
    category: 'cift',
    categoryLabel: '❤️ Çift / İlişki',
    q1: "Sevgilinle mesajlaşırken 'Peki' veya 'Tamam' yazması senin için ne ifade eder?",
    q2: "Sence {p1}, partneri sadece 'Peki' yazsa nasıl tepki verir?",
    options: [
      { icon: "🚨", text: "Büyük kriz kapıda demektir, hemen 'Ne oldu?' diye ararım" },
      { icon: "😤", text: "Ben de ona daha soğuk yapıp sadece 'Ok' yazarım" },
      { icon: "🤷", text: "Hiç anlam yüklemem, gerçekten tamam demiştir" },
      { icon: "🧐", text: "Son 24 saatte ne hata yaptığımı düşünmeye başlarım" }
    ]
  },
  {
    id: 34,
    category: 'cift',
    categoryLabel: '❤️ Çift / İlişki',
    q1: "Sevgilinin en yakın arkadaşından hiç hoşlanmadın. Ne yaparsın?",
    q2: "Sence {p1}, sevgilisinin en yakın arkadaşından hoşlanmasa ne yapar?",
    options: [
      { icon: "🗣️", text: "Sevgilime açıkça 'Ben bu insanı sevmiyorum' derim" },
      { icon: "🎭", text: "Sevgilim üzülmesin diye seviyormuş gibi rol yaparım" },
      { icon: "🐍", text: "İnce ince açıklarını yakalayıp sevgilimi ondan soğuturum" },
      { icon: "🚪", text: "Onun olduğu hiçbir ortama gitmemeye çalışırım" }
    ]
  },
  {
    id: 35,
    category: 'cift',
    categoryLabel: '❤️ Çift / İlişki',
    q1: "Yıldönümü veya sevgilinin doğum gününü tamamen unuttun! Nasıl toparlarsın?",
    q2: "Sence {p1}, özel bir günü unutsa durumu nasıl kurtarmaya çalışır?",
    options: [
      { icon: "🎁", text: "'Aslında akşam için büyük sürpriz hazırladım!' diye blöf yaparım" },
      { icon: "🥺", text: "Dürüstçe unuttuğumu itiraf edip kendimi affettirmeye çalışırım" },
      { icon: "💐", text: "Hemen en pahalı hediyeyi/çiçeği sipariş edip kuryeyi suçlarım" },
      { icon: "🤒", text: "Aniden çok hastalanmış numarası yapıp gündemi değiştiririm" }
    ]
  },
  {
    id: 36,
    category: 'cift',
    categoryLabel: '❤️ Çift / İlişki',
    q1: "İlişkide sosyal medya paylaşımı senin için ne kadar önemlidir?",
    q2: "Sence {p1}, ilişkide sosyal medya paylaşımlarına nasıl bakar?",
    options: [
      { icon: "📸", text: "Beni paylaşmıyorsa kesin bir şey saklıyordur, olay çıkarırım" },
      { icon: "🧿", text: "Nazar değer, özel hayatımız gizli kalsın hiç paylaşmayalım" },
      { icon: "✨", text: "Ara sıra tatlı fotoğraflarımızı story atmak hoşuma gider" },
      { icon: "📵", text: "Sosyal medyayı hiç umursamam, gerçek hayattaki ilgisi yeter" }
    ]
  },
  {
    id: 37,
    category: 'cift',
    categoryLabel: '❤️ Çift / İlişki',
    q1: "Eski sevgilin gece saat 02:30'da 'Uyudun mu?' diye mesaj attı:",
    q2: "Sence {p1}, eski sevgilisinden gece 02:30'da 'Uyudun mu?' mesajı alsa ne yapar?",
    options: [
      { icon: "🚫", text: "Cevap bile vermeden anında her yerden engellerim" },
      { icon: "👀", text: "Sadece 'Görüldü' atıp acı çekmesini izlerim" },
      { icon: "🔥", text: "Merakıma yenik düşüp 'Ne var?' diye cevap yazarım" },
      { icon: "📸", text: "Ekran görüntüsü alıp hemen kankalar grubuna atarım" }
    ]
  },
  {
    id: 38,
    category: 'cift',
    categoryLabel: '❤️ Çift / İlişki',
    q1: "Sevgilinle dizi izlerken sen uyuyakalmışsın, o da diziyi bensiz bitirmiş! Tepkin?",
    q2: "Sence {p1}, partneri birlikte izledikleri diziyi onsuz bitirse ne yapar?",
    options: [
      { icon: "💔", text: "Bunu resmen ihanet sayarım, 2 gün trip atarım" },
      { icon: "😈", text: "Ben de bir sonraki dizinin finalini ona spoiler veririm" },
      { icon: "😴", text: "'Uyuyan suçludur' derim, kaldığım yerden kendim izlerim" },
      { icon: "🔄", text: "Zorla benimle birlikte o bölümleri baştan izletirim" }
    ]
  },
  {
    id: 39,
    category: 'cift',
    categoryLabel: '❤️ Çift / İlişki',
    q1: "Sevgi Dilin (Love Language) aşağıdakilerden hangisidir?",
    q2: "Sence {p1}'in sevgi dili (aşkı gösterme biçimi) hangisidir?",
    options: [
      { icon: "🫂", text: "Fiziksel temas (Sarılmak, el ele tutuşmak)" },
      { icon: "💬", text: "Onaylayıcı ve güzel sözler duymak / iltifatlar" },
      { icon: "⏳", text: "Birlikte kaliteli ve baş başa vakit geçirmek" },
      { icon: "🎁", text: "Düşünülmüş sürpriz hediyeler ve jestler" }
    ]
  },
  {
    id: 40,
    category: 'cift',
    categoryLabel: '❤️ Çift / İlişki',
    q1: "Hoşlandığın kişiye ilk adımı sen mi atarsın yoksa bekler misin?",
    q2: "Sence {p1}, hoşlandığı birine ilk adımı nasıl atar?",
    options: [
      { icon: "🎯", text: "Hiç vakit kaybetmem, gider doğrudan duygularımı söylerim" },
      { icon: "🔥", text: "Alevli story yanıtlarıyla ve ufak sinyallerle yol yaparım" },
      { icon: "🧊", text: "O ilk adımı atana kadar gururumdan asla belli etmem" },
      { icon: "🕵️", text: "Ortak arkadaşları devreye sokup ağzını aratırım" }
    ]
  },
  {
    id: 41,
    category: 'kanka',
    categoryLabel: '⚡ Kanka / Eğlence',
    q1: "Kankanla ortak çekildiğiniz fotoğrafta sen harika çıkmışsın ama kankan berbat çıkmış:",
    q2: "Sence {p1}, kendisinin harika ama kankasının berbat çıktığı fotoğrafı ne yapar?",
    options: [
      { icon: "😈", text: "Hiç acımam, 'Doğal halimiz kanka' deyip hemen paylaşırım" },
      { icon: "🎨", text: "Kankamın yüzüne komik bir emoji yapıştırıp story atarım" },
      { icon: "🤝", text: "Kankamı satmam, ikimizin de iyi çıktığı başka fotoğraf ararım" },
      { icon: "✂️", text: "Kankamı fotoğraftan kırpıp tek başıma paylaşırım" }
    ]
  },
  {
    id: 42,
    category: 'kanka',
    categoryLabel: '⚡ Kanka / Eğlence',
    q1: "Arkadaşın senden borç para istedi ama geri ödemeyeceğini adın gibi biliyorsun:",
    q2: "Sence {p1}, borcunu ödemeyeceğini bildiği bir arkadaşı para istese ne yapar?",
    options: [
      { icon: "💸", text: "Arkadaşlığımız bozulmasın diye sadakam olsun der veririm" },
      { icon: "📉", text: "'Vallahi ben de bu ay çok sıkışığım kanka' diye bahane uydururum" },
      { icon: "📝", text: "Veririm ama her gördüğümde laf sokarak hatırlatırım" },
      { icon: "🛑", text: "Yüzüne karşı 'Sen borcunu ödemiyorsun' deyip reddederim" }
    ]
  },
  {
    id: 43,
    category: 'kanka',
    categoryLabel: '⚡ Kanka / Eğlence',
    q1: "Kankan sana 'Sakın kimseye söyleme!' diyerek dev bir dedikodu anlattı:",
    q2: "Sence {p1}, 'Kimseye söyleme' denilen büyük bir sırrı ne kadar tutabilir?",
    options: [
      { icon: "🔒", text: "Mezara kadar götürürüm, benden asla laf çıkmaz" },
      { icon: "🤫", text: "Sadece en güvendiğim 1 kişiye 'Bak sen de kimseye deme' diye anlatırım" },
      { icon: "🎭", text: "İsim vermeden 'Benim bir arkadaşın başına şu gelmiş' diye anlatırım" },
      { icon: "📢", text: "Daha telefonu kapatmadan diğer gruba yetiştiririm" }
    ]
  },
  {
    id: 44,
    category: 'kanka',
    categoryLabel: '⚡ Kanka / Eğlence',
    q1: "Grupça lüks bir restorana gittiniz, sen sadece çay içtin ama 'Hesabı eşit bölelim' dediler:",
    q2: "Sence {p1}, sadece çay içtiği masada hesap eşit bölünmek istense ne yapar?",
    options: [
      { icon: "🧮", text: "'Ne münasebet, ben sadece çay içtim!' der kendi payımı öderim" },
      { icon: "😶", text: "Utancımdan ses çıkaramam, paşa paşa ortak hesabı öderim" },
      { icon: "🍮", text: "Madem eşit ödüyoruz deyip hemen üstüne 3 tane tatlı sipariş ederim" },
      { icon: "🚻", text: "Hesap gelirken tuvalete kaçarım" }
    ]
  },
  {
    id: 45,
    category: 'kanka',
    categoryLabel: '⚡ Kanka / Eğlence',
    q1: "WhatsApp'ta en çok hangi iletişim tarzını kullanırsın?",
    q2: "Sence {p1}'in WhatsApp mesajlaşma tarzı hangisidir?",
    options: [
      { icon: "🎙️", text: "3 dakikalık podcast gibi uzun ses kayıtları atarım" },
      { icon: "⌨️", text: "Her kelimeyi ayrı mesaj olarak 'tık-tık-tık' alt alta yazarım" },
      { icon: "🖼️", text: "Yazmaya üşenirim, sadece komik çıkartma (sticker) ve GIF atarım" },
      { icon: "📞", text: "Mesajlaşmayı sevmem, direkt ararım" }
    ]
  },
  {
    id: 46,
    category: 'kanka',
    categoryLabel: '⚡ Kanka / Eğlence',
    q1: "Kankan hiç yakışmayan bir saç modeli yaptırmış ve çok heyecanlı. İlk tepkin?",
    q2: "Sence {p1}, kankası berbat bir saç kesimiyle gelse ne tepki verir?",
    options: [
      { icon: "🤣", text: "Kendimi tutamam, gözümden yaş gelene kadar gülerim" },
      { icon: "🧢", text: "'Kanka sana şapka çok yakışıyor biliyor musun' derim" },
      { icon: "😇", text: "'Değişik bir hava katmış, yüzün açılmış' diye moral veririm" },
      { icon: "✂️", text: "'Kuaförü mahkemeye verelim, bunu sana kim yaptı?' derim" }
    ]
  },
  {
    id: 47,
    category: 'kanka',
    categoryLabel: '⚡ Kanka / Eğlence',
    q1: "Masa oyunlarında (UNO, Monopoly, Tabu vb.) senin karakterin nasıldır?",
    q2: "Sence {p1}, arkadaşlarıyla oyun oynarken nasıl birine dönüşür?",
    options: [
      { icon: "🏆", text: "Aşırı hırslıyımdır, kaybedersem masayı devirebilirim" },
      { icon: "🃏", text: "Çaktırmadan ufak tefek hileler yapıp herkesi birbirine düşürürüm" },
      { icon: "😂", text: "Kazanmak umurumda olmaz, sadece gırgır şamata yaparım" },
      { icon: "📖", text: "Kuralları herkesten iyi bilen resmi hakem gibi davranırım" }
    ]
  },
  {
    id: 48,
    category: 'ekstrem',
    categoryLabel: '🔥 Ekstrem',
    q1: "Sana 5 Milyon TL verecekler ama 1 yıl boyunca her gün aynı kıyafeti giyeceksin:",
    q2: "Sence {p1}, 5 Milyon TL için 1 yıl boyunca tek tip kıyafetle gezer mi?",
    options: [
      { icon: "👕", text: "Çizgi film karakteri gibi 1 yıl siyah tişörtle gezerim, parayı verin!" },
      { icon: "🧥", text: "Aksesuar ve ayakkabıyla kombinleyip bir şekilde çözerim" },
      { icon: "🤔", text: "Düğünlerde ve özel günlerde çok zor olur, kararsızım" },
      { icon: "💅", text: "Tarzımdan ödün veremem, kabul etmem" }
    ]
  },
  {
    id: 49,
    category: 'ekstrem',
    categoryLabel: '🔥 Ekstrem',
    q1: "Bir korku filminde olsaydın sence hikayede senin sonun ne olurdu?",
    q2: "Sence {p1} bir korku filminde karakter olsa başına ne gelirdi?",
    options: [
      { icon: "🚪", text: "Tuhaf sesi merak edip bodruma inen ve ilk elenen kişi olurdum" },
      { icon: "🧠", text: "Katilin tuzaklarını çözüp filmin sonunda hayatta kalan tek kişi olurdum" },
      { icon: "🏃", text: "Daha filmin 5. dakikasında tehlikeyi sezip kasabadan kaçardım" },
      { icon: "🔪", text: "Filmin sonunda aslında katilin işbirlikçisi olduğum ortaya çıkardı!" }
    ]
  },
  {
    id: 50,
    category: 'ekstrem',
    categoryLabel: '🔥 Ekstrem',
    q1: "Yapay zeka robotlar dünyayı ele geçirse senin stratejin ne olurdu?",
    q2: "Sence {p1}, yapay zeka dünyayı ele geçirse ne yapardı?",
    options: [
      { icon: "🤖", text: "'Ben zaten hep size kibar davrandım, teşekkür ettim' deyip anlaşırım" },
      { icon: "🔌", text: "Direniş ordusuna katılıp robotların fişini çekmeye çalışırım" },
      { icon: "⛰️", text: "Teknolojinin olmadığı ıssız bir dağ köyüne yerleşirim" },
      { icon: "🔋", text: "Beni de cyborg yapmaları için gönüllü olurum" }
    ]
  },
  {
    id: 51,
    category: 'ekstrem',
    categoryLabel: '🔥 Ekstrem',
    q1: "1 hafta boyunca söylediğin hiçbir yalan anlaşılmasa ve herkes sana inansa ne yapardın?",
    q2: "Sence {p1}, 1 hafta boyunca söylediği her şeye herkes inansa ne yapardı?",
    options: [
      { icon: "🏦", text: "En büyük şirketin CEO'su olduğumu söyleyip servet kazanırdım" },
      { icon: "🎓", text: "Tüm sınavları ve mülakatları konuşarak geçerdim" },
      { icon: "😇", text: "Vicdanım elvermez, yine de kimseyi kandırmazdım" },
      { icon: "👽", text: "İnsanlara uzaylıların elçisi olduğumu söyleyip eğlenirdim" }
    ]
  },
  {
    id: 52,
    category: 'ekstrem',
    categoryLabel: '🔥 Ekstrem',
    q1: "Hayatın boyunca ya sadece fısıldayarak ya da sadece bağırarak konuşmak zorunda kalsan?",
    q2: "Sence {p1} bu tuhaf ikilemden hangisini seçerdi?",
    options: [
      { icon: "🤫", text: "Sadece fısıldayarak konuşmak (Gizemli ve sakin olurum)" },
      { icon: "📢", text: "Sadece bağırarak konuşmak (En azından herkes beni duyar)" },
      { icon: "📝", text: "Hiç konuşmam, elimde not defteriyle yazarak anlaşırım" },
      { icon: "🎭", text: "İşaret dili öğrenip konuşmayı tamamen bırakırım" }
    ]
  },
  {
    id: 53,
    category: 'genel',
    categoryLabel: '🌟 Genel',
    q1: "Gece saat 03:00'te aniden gelen açlık krizinde mutfakta senin favorin nedir?",
    q2: "Sence {p1}, gece 03:00'te acıktığında mutfakta neye saldırır?",
    options: [
      { icon: "🥪", text: "Bol kaşarlı, sucuklu devasa bir gece tostu" },
      { icon: "🍫", text: "Dolaptaki bütün çikolata, bisküvi ve abur cuburlar" },
      { icon: "🍝", text: "Üşenmeden tencere çıkarıp soslu makarna/noodle haşlarım" },
      { icon: "💧", text: "Bir bardak su içip 'Yarın kahvaltıda yerim' diyerek uyurum" }
    ]
  },
  {
    id: 54,
    category: 'kanka',
    categoryLabel: '⚡ Kanka / Eğlence',
    q1: "Telefonunun şarjı %1 kaldı ve dışarıdasın. Son %1'i ne için harcarsın?",
    q2: "Sence {p1}, telefonunun son %1 şarjını ne için kullanır?",
    options: [
      { icon: "📍", text: "Kankama veya aileme 'Şarjım bitiyor, şu konumdayım' yazarım" },
      { icon: "🎵", text: "Telefon kapanana kadar dinlediğim şarkının bitmesini beklerim" },
      { icon: "🗺️", text: "Eve dönüş yolunu unutmamak için haritaya son kez bakarım" },
      { icon: "📸", text: "O anki kaosumu ölümsüzleştirmek için son bir story atarım" }
    ]
  },

  // ==================== YENİ "THE TEST" HIZLI & VURUCU SORULAR (55 - 75) ====================
  {
    id: 55,
    category: 'genel',
    categoryLabel: '🌟 Genel',
    q1: "Hangisi senin gizli suçlu zevkin (guilty pleasure)?",
    q2: "Sence {p1}'in kimseye çaktırmadığı gizli zevki hangisidir?",
    options: [
      { icon: "🕵️", text: "Hiç tanımadığım insanların profillerini saatlerce stalklamak" },
      { icon: "🎶", text: "Çok popüler ama utanç verici pop/arabesk şarkıları ezbere söylemek" },
      { icon: "📺", text: "Aşırı saçma gündüz kuşağı veya kaos programlarını izlemek" },
      { icon: "🍰", text: "Gece herkes uyurken gizlice mutfakta tatlı gömmek" }
    ]
  },
  {
    id: 56,
    category: 'kanka',
    categoryLabel: '⚡ Kanka / Eğlence',
    q1: "Sokakta bir anda kavga çıksa ilk tepkin ne olur?",
    q2: "Sence {p1}, ortamda bir anda kavga çıksa ne yapar?",
    options: [
      { icon: "🥊", text: "Hiç düşünmeden kankamın yanına dalıp kavgaya girerim" },
      { icon: "🕊️", text: "Araya girip iki tarafı da sakinleştirmeye çalışırım" },
      { icon: "🏃💨", text: "Arkamı bile dönmeden ışık hızıyla olay yerinden uzarım" },
      { icon: "🍿", text: "Güvenli bir köşeye çekilip çekirdek çitleyerek izlerim" }
    ]
  },
  {
    id: 57,
    category: 'cift',
    categoryLabel: '❤️ Çift / İlişki',
    q1: "Telefonunu kilitlemeden masanın üstünde bırakıp tuvalete gidebilir misin?",
    q2: "Sence {p1}, telefonunu şifresiz şekilde masada bırakıp gidebilir mi?",
    options: [
      { icon: "😎", text: "Rahatlıkla bırakırım, sakladığım hiçbir şey yok" },
      { icon: "😰", text: "Bırakırım ama aklım masada kalır, koşarak dönerim" },
      { icon: "🔒", text: "Asla! Tuvalete bile gitsem telefon cebimde gelir" },
      { icon: "✈️", text: "Bildirimleri ve interneti kapatıp öyle bırakırım" }
    ]
  },
  {
    id: 58,
    category: 'genel',
    categoryLabel: '🌟 Genel',
    q1: "Hangisini tercih edersin: Her zaman 15 dakika geç kalmak mı, 1 saat erken gitmek mi?",
    q2: "Sence {p1} bu ikilemden hangisini tercih ederdi?",
    options: [
      { icon: "⏳", text: "Her yere 1 saat erken gidip beklemek" },
      { icon: "🏃", text: "Her yere 15 dakika havalı şekilde geç kalmak" }
    ]
  },
  {
    id: 59,
    category: 'cift',
    categoryLabel: '❤️ Çift / İlişki',
    q1: "İlişkide hangisi daha önemlidir: Tutku ve heyecan mı, huzur ve güven mi?",
    q2: "Sence {p1} bir ilişkide hangisine daha çok önem verir?",
    options: [
      { icon: "🔥", text: "Kesinlikle tutku, heyecan ve adrenalin!" },
      { icon: "🏡", text: "Kesinlikle huzur, sadakat ve kafa rahatlığı!" }
    ]
  },
  {
    id: 60,
    category: 'kanka',
    categoryLabel: '⚡ Kanka / Eğlence',
    q1: "Hangisi daha çok sensin: Planlı programlı mı, son dakika kaosu mu?",
    q2: "Sence {p1} hangisine daha çok uyuyor?",
    options: [
      { icon: "📅", text: "Her şeyi günler öncesinden saat saat planlayan" },
      { icon: "🌪️", text: "Tamamen anlık yaşayan son dakika kaos insanı" }
    ]
  },
  {
    id: 61,
    category: 'ekstrem',
    categoryLabel: '🔥 Ekstrem',
    q1: "Hangisini seçerdin: Zengin ama yapayalnız olmak mı, parasız ama çok sevilen biri olmak mı?",
    q2: "Sence {p1} bu zorlu ikilemde hangisini seçer?",
    options: [
      { icon: "💎", text: "Ultra zengin olup yatımda tek başıma takılmak" },
      { icon: "❤️", text: "Mütevazı yaşayıp etrafımda gerçek dostlarla mutlu olmak" }
    ]
  },
  {
    id: 62,
    category: 'genel',
    categoryLabel: '🌟 Genel',
    q1: "Gece insanı mısın yoksa sabah insanı mı?",
    q2: "Sence {p1} gece insanı mıdır yoksa sabah insanı mı?",
    options: [
      { icon: "🦉", text: "Tam bir gece baykuşuyum, enerjim gece 12'den sonra gelir" },
      { icon: "☀️", text: "Sabah insanıyım, güneş doğarken enerjik uyanırım" }
    ]
  },
  {
    id: 63,
    category: 'cift',
    categoryLabel: '❤️ Çift / İlişki',
    q1: "Kıskandığında tepkini nasıl belli edersin?",
    q2: "Sence {p1} kıskandığında bunu nasıl belli eder?",
    options: [
      { icon: "⚡", text: "Anında laf sokarım ve suratımdan düşen bin parça olur" },
      { icon: "🧊", text: "Buz gibi soğuk konuşmaya ve kısa cevaplar vermeye başlarım" },
      { icon: "🎭", text: "Hiç bozuntuya vermem ama o konuyu burnundan getiririm" },
      { icon: "🗣️", text: "Açık açık 'Şu an kıskandım ve rahatsız oldum' derim" }
    ]
  },
  {
    id: 64,
    category: 'kanka',
    categoryLabel: '⚡ Kanka / Eğlence',
    q1: "Bir ortama girdiğinde ilk dikkat ettiğin şey nedir?",
    q2: "Sence {p1} yeni bir ortama girdiğinde ilk neye dikkat eder?",
    options: [
      { icon: "👀", text: "İnsanların enerjisine, kimlerin samimi kimlerin yapmacık olduğuna" },
      { icon: "🍕", text: "Yemeklere, ikramlara ve en rahat koltuğun nerede olduğuna" },
      { icon: "🎵", text: "Çalan müziğe ve mekanın ambiyansına" },
      { icon: "🚪", text: "Sıkılırsam nereden çaktırmadan kaçabileceğime" }
    ]
  },
  {
    id: 65,
    category: 'ekstrem',
    categoryLabel: '🔥 Ekstrem',
    q1: "Telefonundan sadece 1 uygulamayı kurtarma şansın olsa hangisini seçerdin?",
    q2: "Sence {p1} telefonunda tek bir uygulamayı tutabilecek olsa hangisini seçerdi?",
    options: [
      { icon: "💬", text: "WhatsApp (İletişimsiz kalamam)" },
      { icon: "📸", text: "Instagram / TikTok (Stalk ve eğlence şart)" },
      { icon: "🎧", text: "Spotify / YouTube (Müziksiz ve videosuz yaşayamam)" },
      { icon: "🗺️", text: "Haritalar & Banka Uygulaması (Hayatta kalmak için)" }
    ]
  },
  {
    id: 66,
    category: 'genel',
    categoryLabel: '🌟 Genel',
    q1: "Biri sana hak etmediğin bir iltifat ettiğinde ne yaparsın?",
    q2: "Sence {p1}, abartılı bir iltifat aldığında nasıl tepki verir?",
    options: [
      { icon: "👑", text: "'Biliyorum canım, teşekkürler' deyip havaya girerim" },
      { icon: "😳", text: "Utanıp konuyu değiştirmeye çalışırım" },
      { icon: "🤨", text: "'Kesin benden bir şey isteyecek' diye şüphelenirim" },
      { icon: "💖", text: "Ben de hemen karşı tarafa daha büyük bir iltifat ederim" }
    ]
  },
  {
    id: 67,
    category: 'cift',
    categoryLabel: '❤️ Çift / İlişki',
    q1: "Sevgilinin telefon şifresini bilmek ister misin?",
    q2: "Sence {p1} sevgilisinin telefon şifresini bilmek ister mi?",
    options: [
      { icon: "🔑", text: "Kesinlikle bilmeliyim, şeffaflık şart!" },
      { icon: "🙅", text: "Gerek yok, herkesin özel alanı olmalı" }
    ]
  },
  {
    id: 68,
    category: 'kanka',
    categoryLabel: '⚡ Kanka / Eğlence',
    q1: "Kankanla tatile çıktınız, hangi konuda kesin tartışırsınız?",
    q2: "Sence {p1} ile tatile çıksan hangi konuda tartışma çıkar?",
    options: [
      { icon: "⏰", text: "Sabah uyanma ve hazırlanma süresinin uzunluğu" },
      { icon: "🍽️", text: "'Bugün nerede ne yiyeceğiz?' kararsızlığı" },
      { icon: "📸", text: "'Beni güzel çekemedin, baştan çek!' kavgası" },
      { icon: "💸", text: "Para harcama ve bütçe planlaması" }
    ]
  },
  {
    id: 69,
    category: 'ekstrem',
    categoryLabel: '🔥 Ekstrem',
    q1: "100.000 TL karşılığında en yakın arkadaşının tüm sırlarını ifşa eder misin?",
    q2: "Sence {p1}, 100.000 TL teklif edilse en yakın arkadaşının sırlarını anlatır mı?",
    options: [
      { icon: "🛡️", text: "Asla! 100 Milyon da verseler kankamı satmam" },
      { icon: "🤝", text: "Sırları anlatırım, parayı kankamla 50-50 bölüşürüz!" },
      { icon: "🤫", text: "Sadece zararsız ve komik olan sırlarını anlatırım" },
      { icon: "😈", text: "Parayı alır kankama da 'Hacklenmişim' derim" }
    ]
  },
  {
    id: 70,
    category: 'genel',
    categoryLabel: '🌟 Genel',
    q1: "Sinirlendiğinde seni en hızlı ne sakinleştirir?",
    q2: "Sence {p1} çok sinirlendiğinde onu en hızlı ne sakinleştirir?",
    options: [
      { icon: "🍫", text: "Güzel bir yemek veya tatlı yemek" },
      { icon: "🎧", text: "Yalnız kalıp kulaklıkla müzik dinlemek" },
      { icon: "🫂", text: "Sevdiğim birinin sarılıp 'Haklısın' demesi" },
      { icon: "💤", text: "Uyuyup her şeyi unutmak" }
    ]
  },
  {
    id: 71,
    category: 'cift',
    categoryLabel: '❤️ Çift / İlişki',
    q1: "İlk buluşmada hesabı kim ödemeli?",
    q2: "Sence {p1}'e göre ilk buluşmada hesabı kim ödemeli?",
    options: [
      { icon: "💳", text: "Davet eden kimse o ödemeli" },
      { icon: "⚖️", text: "Alman usulü yarı yarıya paylaşılmalı" },
      { icon: "🎩", text: "Centilmenlik gereği erkek ödemeli" },
      { icon: "☕", text: "Biri yemeği öderse diğeri kahveleri ödemeli" }
    ]
  },
  {
    id: 72,
    category: 'kanka',
    categoryLabel: '⚡ Kanka / Eğlence',
    q1: "Arkadaş grubunda kimin esprilerine daha çok gülünür?",
    q2: "Sence {p1} kendi espri yeteneğini nasıl görüyordur?",
    options: [
      { icon: "👑", text: "Grubun komedyeni benim, her dediğime koparlar" },
      { icon: "🧊", text: "Soğuk espri uzmanıyımdır, önce sessizlik olur sonra gülerler" },
      { icon: "😂", text: "Ben espri yapmam ama yapılan her şeye en çok ben gülerim" },
      { icon: "😏", text: "Sadece zeki insanların anlayacağı ince mizah yaparım" }
    ]
  },
  {
    id: 73,
    category: 'ekstrem',
    categoryLabel: '🔥 Ekstrem',
    q1: "Bir günlüğüne görünmez olsan kimin evine gizlice girip ne yaptığına bakardın?",
    q2: "Sence {p1} bir günlüğüne görünmez olsa kimin ne yaptığına bakardı?",
    options: [
      { icon: "💘", text: "Hoşlandığım kişinin veya eski sevgilimin" },
      { icon: "🌟", text: "En sevdiğim ünlünün / milyarderin" },
      { icon: "👯", text: "En yakın arkadaşımın (Arkamdan ne konuşuyor diye)" },
      { icon: "🏠", text: "Kimsenin evine girmem, markette bedava takılırım" }
    ]
  },
  {
    id: 74,
    category: 'genel',
    categoryLabel: '🌟 Genel',
    q1: "Mesajlara cevap verme hızın nasıldır?",
    q2: "Sence {p1}'in mesajlara cevap verme hızı nasıldır?",
    options: [
      { icon: "⚡", text: "Telefon elimdedir, 3 saniye içinde anında yazarım" },
      { icon: "🧠", text: "Bildirimden okurum, içimden cevap verip yazmayı unuturum" },
      { icon: "👑", text: "Kişisine göre değişir; sevdiğimse anında, değilse 3 gün sonra" },
      { icon: "🔕", text: "Telefonum hep sessizdedir, saatler sonra görürüm" }
    ]
  },
  {
    id: 75,
    category: 'cift',
    categoryLabel: '❤️ Çift / İlişki',
    q1: "Ayrılık sonrası senin klasik tepkin hangisidir?",
    q2: "Sence {p1} bir ayrılık yaşadığında ilk ne yapar?",
    options: [
      { icon: "💇", text: "Saçımı/tarzımı değiştirip spora başlarım (Glow up!)" },
      { icon: "🍦", text: "3 gün odadan çıkmayıp hüzünlü şarkılarla dertlenirim" },
      { icon: "🎉", text: "Hiç üzülmemiş gibi kankalarla dışarı çıkıp story atarım" },
      { icon: "🧹", text: "Tüm fotoğrafları silip ortak eşyaları çöpe atarım" }
    ]
  }
];
