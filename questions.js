// senceo - Soru Veri Tabanı (24 Eğlenceli ve Tartışma Çıkaracak Soru)
// Kategoriler: 'genel', 'cift', 'kanka', 'ekstrem'

const QUESTIONS_DB = [
  // --- GENEL & EĞLENCE ---
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
  }
];
