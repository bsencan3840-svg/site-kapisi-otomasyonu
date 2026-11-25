/**
 * SITE KAPISI MOTORU (tek-ID sürümü)
 * ----------------------------------
 * Kullanıcı ayarları: SADECE "smartLifeId".
 * Kapı konumu, mesafeler, komut kodu vb. dahili olarak yönetilir;
 * arayüzde bunlar için bir alan yoktur.
 */

const AYAR_ANAHTARI = 'site_kapi_ayarlari_v3';
const DURUM_ANAHTARI = 'site_kapi_durumu_v3';

const VARSAYILAN_AYARLAR = {
  // TEK kullanıcı girdisi
  smartLifeId: '',

  // Dahili / otomatik öğrenilen değerler (kullanıcıya sorulmaz)
  kapiEnlem: null,
  kapiBoylam: null,
  acilmaMesafesiMetre: 2,
  sifirlamaMesafesiMetre: 80,
  beklemeSuresiSaniye: 45,
  otomatikAcmaAktif: true,
};

const VARSAYILAN_DURUM = {
  korumaKilidiAktif: false,
  sonAcilmaZamani: 0,
  sonMesafeMetre: null,
  sonSapmaMetre: null,
  durumMesaji: 'Smart Life ID\'nizi girin; kapı konumu ilk testte otomatik öğrenilir.',
  kayitlar: [],
};

const depolama = (function () {
  if (typeof localStorage !== 'undefined') return localStorage;
  const bellek = new Map();
  return {
    getItem: (anahtar) => (bellek.has(anahtar) ? bellek.get(anahtar) : null),
    setItem: (anahtar, deger) => bellek.set(anahtar, deger),
  };
})();

function mesafeHesaplaMetre(enlem1, boylam1, enlem2, boylam2) {
  if (![enlem1, boylam1, enlem2, boylam2].every(Number.isFinite)) return null;
  const dunyaYaricapi = 6371000;
  const rad = (derece) => (derece * Math.PI) / 180;
  const dLat = rad(enlem2 - enlem1);
  const dLon = rad(boylam2 - boylam1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(enlem1)) * Math.cos(rad(enlem2)) * Math.sin(dLon / 2) ** 2;
  return dunyaYaricapi * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const KapiMotoru = {
  izlemeNo: null,
  arkaPlanEklentiNo: null,
  ekranUyanikTutucu: null,
  calisiyorMu: false,
  simulasyonModu: false,
  tetiklemeSuruyorMu: false,
  arayuzYenileici: null,

  ayarlariYukle() {
    try {
      const ham = depolama.getItem(AYAR_ANAHTARI);
      if (!ham) return { ...VARSAYILAN_AYARLAR };
      return { ...VARSAYILAN_AYARLAR, ...JSON.parse(ham) };
    } catch {
      return { ...VARSAYILAN_AYARLAR };
    }
  },

  ayarlariKaydet(yeni) {
    const birlesik = { ...VARSAYILAN_AYARLAR, ...yeni };
    depolama.setItem(AYAR_ANAHTARI, JSON.stringify(birlesik));
    return birlesik;
  },

  smartLifeIdKaydet(id) {
    return this.ayarlariKaydet({ ...this.ayarlariYukle(), smartLifeId: String(id || '').trim() });
  },

  /** Kapı konumu kullanıcıya sorulmaz; kapı önünde test açmasıyla öğrenilir. */
  kapiyiKalibreEt(enlem, boylam, kayit = true) {
    if (!Number.isFinite(enlem) || !Number.isFinite(boylam)) return false;
    const ayar = this.ayarlariYukle();
    ayar.kapiEnlem = Number(enlem.toFixed(6));
    ayar.kapiBoylam = Number(boylam.toFixed(6));
    this.ayarlariKaydet(ayar);
    if (kayit) this.kayitEkle(`📍 Site kapısı konumu otomatik öğrenildi: ${ayar.kapiEnlem}, ${ayar.kapiBoylam}`);
    return true;
  },

  kalibrasyonVarMi() {
    const ayar = this.ayarlariYukle();
    if (!Number.isFinite(ayar.kapiEnlem) || !Number.isFinite(ayar.kapiBoylam)) return false;
    // Simülatörden / hatalı ölçümden kalan (0,0) koordinatı geçerli sayılmaz.
    if (Math.abs(ayar.kapiEnlem) < 0.001 && Math.abs(ayar.kapiBoylam) < 0.001) return false;
    return true;
  },

  /** Kapı konumunu sıfırlar; kullanıcı kapı önünde "Şimdi Aç"a basarak yeniden öğretir. */
  kalibrasyonuSifirla() {
    const ayar = this.ayarlariYukle();
    ayar.kapiEnlem = null;
    ayar.kapiBoylam = null;
    this.ayarlariKaydet(ayar);
    const durum = this.durumuYukle();
    durum.sonMesafeMetre = null;
    durum.sonSapmaMetre = null;
    durum.korumaKilidiAktif = false;
    durum.durumMesaji = 'Kapı konumu sıfırlandı. Kapı önünde bir kez "Şimdi Aç"a basın.';
    this.durumuKaydet(durum);
    this.kayitEkle('📍 Kapı konumu sıfırlandı; yeniden öğrenilecek.');
    return durum;
  },

  durumuYukle() {
    try {
      const ham = depolama.getItem(DURUM_ANAHTARI);
      if (!ham) return { ...VARSAYILAN_DURUM };
      return { ...VARSAYILAN_DURUM, ...JSON.parse(ham) };
    } catch {
      return { ...VARSAYILAN_DURUM };
    }
  },

  durumuKaydet(yeniDurum) {
    depolama.setItem(DURUM_ANAHTARI, JSON.stringify(yeniDurum));
    if (typeof this.arayuzYenileici === 'function') this.arayuzYenileici(yeniDurum);
  },

  kayitEkle(mesaj) {
    const durum = this.durumuYukle();
    const saat = new Date().toLocaleTimeString('tr-TR');
    durum.kayitlar = [`[${saat}] ${mesaj}`, ...(durum.kayitlar || [])].slice(0, 50);
    this.durumuKaydet(durum);
  },

  bildirimGoster(baslik, icerik) {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(baslik, { body: icerik });
      }
      const AudioCtx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      }
    } catch { /* sessizce geç */ }
  },

  async mesafeyiDegerlendir(hamMesafeMetre, sapmaMetre = 3) {
    const ayar = this.ayarlariYukle();
    const durum = this.durumuYukle();
    const mesafe = Math.round(Number(hamMesafeMetre) * 10) / 10;
    const simdi = Date.now();

    durum.sonMesafeMetre = mesafe;
    durum.sonSapmaMetre = sapmaMetre ? Math.round(sapmaMetre) : null;

    if (!ayar.smartLifeId && !this.simulasyonModu) {
      durum.durumMesaji = 'Smart Life ID\'nizi girin.';
      this.durumuKaydet(durum);
      return;
    }

    if (!this.simulasyonModu && !this.kalibrasyonVarMi()) {
      // Kalibrasyon yokken (0,0)'a olan mesafeyi göstermek sahte bir sayı üretir.
      durum.sonMesafeMetre = null;
      durum.durumMesaji = 'Kapı konumu öğreniliyor: kapı önünde bir kez "Şimdi Aç"a basın.';
      this.durumuKaydet(durum);
      return;
    }

    if (!ayar.otomatikAcmaAktif) {
      durum.durumMesaji = 'Otomatik kapı açma şu an kapalı.';
      this.durumuKaydet(durum);
      return;
    }

    if (durum.korumaKilidiAktif) {
      if (mesafe >= ayar.sifirlamaMesafesiMetre) {
        durum.korumaKilidiAktif = false;
        durum.durumMesaji = `Siteden uzaklaşıldı — dönüşte ${ayar.acilmaMesafesiMetre}m kala kapı açılacak.`;
        this.durumuKaydet(durum);
        this.kayitEkle(`🔄 Kapıdan ${mesafe}m uzaklaşıldı; otomatik açıcı yeniden kuruldu.`);
        this.bildirimGoster('Kapı Otomasyonu Hazır 🔄', 'Dönüşünüzde kapı otomatik açılacak.');
        return;
      }
      durum.durumMesaji = `Kapı açıldı (kilitli). Yeniden kurulması için ${ayar.sifirlamaMesafesiMetre}m uzaklaşın.`;
      this.durumuKaydet(durum);
      return;
    }

    if (mesafe <= ayar.acilmaMesafesiMetre) {
      if (this.tetiklemeSuruyorMu) return;
      const gecen = (simdi - (durum.sonAcilmaZamani || 0)) / 1000;
      if (gecen < ayar.beklemeSuresiSaniye) {
        durum.durumMesaji = `Bekleme süresinde (${Math.ceil(ayar.beklemeSuresiSaniye - gecen)} sn kaldı).`;
        this.durumuKaydet(durum);
        return;
      }

      if (this.simulasyonModu) {
        // Test modunda gerçek kapıya komut gönderilmez; sadece akış test edilir.
        durum.korumaKilidiAktif = true;
        durum.sonAcilmaZamani = simdi;
        durum.durumMesaji = `🧪 Test tetiklemesi: ${mesafe}m (gerçek kapıya komut gönderilmedi).`;
        this.durumuKaydet(durum);
        this.kayitEkle(`🧪 TEST: ${mesafe}m yaklaşma algılandı; gerçek komut gönderilmedi.`);
        return;
      }

      this.tetiklemeSuruyorMu = true;
      durum.korumaKilidiAktif = true;
      durum.sonAcilmaZamani = simdi;
      durum.durumMesaji = '🎯 Yaklaşma algılandı; kapı açılıyor...';
      this.durumuKaydet(durum);
      this.kayitEkle(`🎯 Kapıya ${mesafe}m yaklaşıldı; açma komutu gönderiliyor...`);

      const baglanti = typeof window !== 'undefined' ? window.SmartLifeBaglantisi : null;
      const sonuc = baglanti ? await baglanti.kapiyiAc(ayar) : { basarili: false, mesaj: 'Bağlantı modülü yüklenemedi.' };
      this.tetiklemeSuruyorMu = false;

      const guncel = this.durumuYukle();
      if (sonuc.basarili) {
        guncel.durumMesaji = '✅ Site kapısı otomatik açıldı!';
        this.durumuKaydet(guncel);
        this.kayitEkle('✅ BAŞARILI: ' + sonuc.mesaj);
        this.bildirimGoster('🚗 Site Kapısı Açıldı!', `Kapıya ${mesafe} metre yaklaştınız.`);
      } else {
        guncel.durumMesaji = '⚠️ Tetiklendi ancak: ' + sonuc.mesaj;
        this.durumuKaydet(guncel);
        this.kayitEkle('⚠️ UYARI: ' + sonuc.mesaj);
        this.bildirimGoster('⚠️ Kapı Komutu Uyarısı', sonuc.mesaj);
      }
      return;
    }

    durum.durumMesaji = `Kapıya ${mesafe} metre uzaklıktasınız (${ayar.acilmaMesafesiMetre}m kala açılır).`;
    this.durumuKaydet(durum);
  },

  async koordinatiDegerlendir(enlem, boylam, sapma) {
    if (this.simulasyonModu) return;
    const ayar = this.ayarlariYukle();

    if (!this.kalibrasyonVarMi() || !Number.isFinite(enlem) || !Number.isFinite(boylam)) {
      const durum = this.durumuYukle();
      durum.sonMesafeMetre = null;
      durum.sonSapmaMetre = Number.isFinite(sapma) ? Math.round(sapma) : null;
      durum.durumMesaji = 'Kapı konumu öğreniliyor: kapı önünde bir kez "Şimdi Aç"a basın.';
      this.durumuKaydet(durum);
      return;
    }

    const mesafe = mesafeHesaplaMetre(enlem, boylam, ayar.kapiEnlem, ayar.kapiBoylam);
    if (mesafe === null) return;

    // 2 m eşiğinde güvenilmez GPS ölçümü yanlış tetikleme yapmasın.
    const sapmaSiniri = Math.max(8, ayar.acilmaMesafesiMetre * 3);
    if (Number.isFinite(sapma) && sapma > sapmaSiniri) {
      const durum = this.durumuYukle();
      durum.sonMesafeMetre = mesafe;
      durum.sonSapmaMetre = Math.round(sapma);
      durum.durumMesaji = `GPS sinyali zayıf (±${Math.round(sapma)}m). Mesafe yaklaşık ${Math.round(mesafe)}m; tetikleme bekletildi.`;
      this.durumuKaydet(durum);
      return;
    }

    await this.mesafeyiDegerlendir(mesafe, sapma);
  },

  async takibiBaslat() {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch { /* yoksay */ }
    }
    if (typeof navigator !== 'undefined' && navigator.wakeLock) {
      try { this.ekranUyanikTutucu = await navigator.wakeLock.request('screen'); } catch { /* yoksay */ }
    }

    const bg = typeof window !== 'undefined' && window.Capacitor?.Plugins?.BackgroundGeolocation;
    if (bg) {
      try {
        this.arkaPlanEklentiNo = await bg.addWatcher(
          {
            backgroundMessage: 'Site kapısına yaklaştığınızda kapı otomatik açılacak.',
            backgroundTitle: '🛡️ Site Kapısı Otomatik Açıcı Aktif',
            requestPermissions: true,
            stale: false,
            distanceFilter: 2,
          },
          (konum, hata) => {
            if (hata) { this.kayitEkle('⚠️ Konum uyarısı: ' + (hata.message || hata.code)); return; }
            if (konum) this.koordinatiDegerlendir(konum.latitude, konum.longitude, konum.accuracy);
          }
        );
        this.calisiyorMu = true;
        this.kayitEkle('🚀 Arka plan 2m hassas takip başlatıldı.');
        return { basarili: true, mesaj: 'Arka plan takibi aktif!' };
      } catch { this.kayitEkle('ℹ️ Standart GPS moduna geçiliyor...'); }
    }

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return { basarili: false, mesaj: 'Bu cihazda konum özelliği yok; simülatörü kullanabilirsiniz.' };
    }
    if (this.izlemeNo !== null) navigator.geolocation.clearWatch(this.izlemeNo);
    this.izlemeNo = navigator.geolocation.watchPosition(
      (poz) => this.koordinatiDegerlendir(poz.coords.latitude, poz.coords.longitude, poz.coords.accuracy),
      () => {
        const durum = this.durumuYukle();
        durum.durumMesaji = 'GPS sinyali bekleniyor veya konum izni verilmedi.';
        this.durumuKaydet(durum);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
    this.calisiyorMu = true;
    this.kayitEkle('🚀 Yüksek hassasiyetli konum takibi başlatıldı.');
    return { basarili: true, mesaj: '2 metre hassas konum takibi başlatıldı!' };
  },

  async takibiDurdur() {
    if (typeof navigator !== 'undefined' && this.izlemeNo !== null) {
      navigator.geolocation.clearWatch(this.izlemeNo);
      this.izlemeNo = null;
    }
    const bg = typeof window !== 'undefined' && window.Capacitor?.Plugins?.BackgroundGeolocation;
    if (bg && this.arkaPlanEklentiNo) {
      try { await bg.removeWatcher({ id: this.arkaPlanEklentiNo }); } catch { /* yoksay */ }
      this.arkaPlanEklentiNo = null;
    }
    if (this.ekranUyanikTutucu) {
      try { await this.ekranUyanikTutucu.release(); } catch { /* yoksay */ }
      this.ekranUyanikTutucu = null;
    }
    this.calisiyorMu = false;
    const durum = this.durumuYukle();
    durum.durumMesaji = 'Konum takibi durduruldu.';
    this.durumuKaydet(durum);
    this.kayitEkle('⏹️ Konum takibi durduruldu.');
  },

  korumaKilidiniSifirla() {
    const durum = this.durumuYukle();
    durum.korumaKilidiAktif = false;
    durum.sonAcilmaZamani = 0;
    durum.durumMesaji = 'Koruma kilidi sıfırlandı; kapı tekrar açılmaya hazır.';
    this.durumuKaydet(durum);
    this.kayitEkle('🔓 Koruma kilidi elle sıfırlandı.');
  },
};

if (typeof window !== 'undefined') window.KapiMotoru = KapiMotoru;
if (typeof module !== 'undefined' && module.exports) module.exports = KapiMotoru;
