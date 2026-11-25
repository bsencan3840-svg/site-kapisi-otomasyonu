/**
 * Site Kapısı 10 Metre Hassas Konum, Akıllı Kilit ve Arka Plan Takip Motoru
 * Hem Android hem iOS arka plan konum eklentisiyle, hem de canlı GPS ve masaüstü simülatörüyle çalışır.
 */

const AYAR_ANAHTARI = 'site_kapi_ayarlari_v2';
const DURUM_ANAHTARI = 'site_kapi_durumu_v2';

const VARSAYILAN_AYARLAR = {
  tetiklemeYontemi: 'cihaz', // 'cihaz' | 'senaryo' | 'ozelBaglanti'
  tuyaBolge: 'eu',
  tuyaMusteriNo: '',
  tuyaGizliAnahtar: '',
  tuyaCihazNo: '',
  tuyaKomutKodu: 'switch_1',
  tuyaKomutDegeri: 'true',
  tuyaSenaryoNo: '',
  ozelBaglantiAdresi: '',

  kapiEnlem: 41.008200,
  kapiBoylam: 28.978400,
  acilmaMesafesiMetre: 10,
  sifirlamaMesafesiMetre: 80,
  beklemeSuresiSaniye: 45,
  otomatikAcmaAktif: true,
};

const VARSAYILAN_DURUM = {
  korumaKilidiAktif: false,
  sonAcilmaZamani: 0,
  sonMesafeMetre: null,
  sonSapmaMetre: null,
  durumMesaji: 'Konum takibi başlatılmaya hazır.',
  kayitlar: [],
};

// Dünya üzerindeki iki koordinat arasındaki gerçek mesafeyi metre cinsinden hesaplar
function mesafeHesaplaMetre(enlem1, boylam1, enlem2, boylam2) {
  const dunyaYaricapi = 6371000;
  const radyanaCevir = (derece) => (derece * Math.PI) / 180;

  const dEnlem = radyanaCevir(enlem2 - enlem1);
  const dBoylam = radyanaCevir(boylam2 - boylam1);

  const a =
    Math.sin(dEnlem / 2) * Math.sin(dEnlem / 2) +
    Math.cos(radyanaCevir(enlem1)) *
      Math.cos(radyanaCevir(enlem2)) *
      Math.sin(dBoylam / 2) *
      Math.sin(dBoylam / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return dunyaYaricapi * c;
}

window.KapiMotoru = {
  izlemeNo: null,
  arkaPlanEklentiNo: null,
  ekranUyanikTutucu: null,
  calisiyorMu: false,
  simulasyonModu: false,
  tetiklemeSuruyorMu: false,
  arayuzYenileici: null,

  ayarlariYukle() {
    try {
      const ham = localStorage.getItem(AYAR_ANAHTARI);
      if (!ham) return { ...VARSAYILAN_AYARLAR };
      return { ...VARSAYILAN_AYARLAR, ...JSON.parse(ham) };
    } catch {
      return { ...VARSAYILAN_AYARLAR };
    }
  },

  ayarlariKaydet(yeniAyarlar) {
    localStorage.setItem(AYAR_ANAHTARI, JSON.stringify(yeniAyarlar));
  },

  durumuYukle() {
    try {
      const ham = localStorage.getItem(DURUM_ANAHTARI);
      if (!ham) return { ...VARSAYILAN_DURUM };
      return { ...VARSAYILAN_DURUM, ...JSON.parse(ham) };
    } catch {
      return { ...VARSAYILAN_DURUM };
    }
  },

  durumuKaydet(yeniDurum) {
    localStorage.setItem(DURUM_ANAHTARI, JSON.stringify(yeniDurum));
    if (typeof this.arayuzYenileici === 'function') {
      this.arayuzYenileici(yeniDurum);
    }
  },

  kayitEkle(mesaj) {
    const durum = this.durumuYukle();
    const saat = new Date().toLocaleTimeString('tr-TR');
    durum.kayitlar = [`[${saat}] ${mesaj}`, ...(durum.kayitlar || [])].slice(0, 50);
    this.durumuKaydet(durum);
  },

  bildirimGoster(baslik, icerik) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(baslik, { body: icerik });
      }
      // Hafif sesli uyarı (Web Audio API)
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
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
    } catch {
      // Sessizce geç
    }
  },

  /**
   * Doğrudan metre değeriyle (Simülatörden veya GPS'ten) kapı açma mantığını değerlendirir
   */
  async mesafeyiDegerlendir(hamMesafeMetre, sapmaMetre = 3) {
    const ayar = this.ayarlariYukle();
    const durum = this.durumuYukle();
    const yuvarlanmisMesafe = Math.round(hamMesafeMetre * 10) / 10;
    const simdi = Date.now();

    durum.sonMesafeMetre = yuvarlanmisMesafe;
    durum.sonSapmaMetre = sapmaMetre ? Math.round(sapmaMetre) : null;

    if (!ayar.otomatikAcmaAktif) {
      durum.durumMesaji = 'Otomatik kapı açma şu an kapalı.';
      this.durumuKaydet(durum);
      return;
    }

    // 1. AKILLI KORUMA KİLİDİ KONTROLÜ:
    // Kapı açıldıktan sonra site içinde / evde beklerken tekrar açılmasın diye kilitlidir.
    // Kullanıcı kapıdan belirlenen sıfırlama mesafesi (örn. 80m) kadar uzaklaşınca kilit kendiliğinden kalkar!
    if (durum.korumaKilidiAktif) {
      if (yuvarlanmisMesafe >= ayar.sifirlamaMesafesiMetre) {
        durum.korumaKilidiAktif = false;
        durum.durumMesaji = 'Siteden uzaklaşıldı — Dönüşünüzde 10m kala kapı otomatik açılacak!';
        this.durumuKaydet(durum);
        this.kayitEkle(`🔄 Kapıdan ${yuvarlanmisMesafe}m uzaklaşıldı (≥${ayar.sifirlamaMesafesiMetre}m). Otomatik açıcı tekrar kuruldu!`);
        this.bildirimGoster('Kapı Otomasyonu Hazır 🔄', 'Dönüşünüzde site kapısına 10 metre yaklaştığınızda otomatik açılacak.');
        return;
      }

      durum.durumMesaji = `Kapı açıldı (Kilitli). Tekrar kurulması için ${ayar.sifirlamaMesafesiMetre}m uzaklaşın.`;
      this.durumuKaydet(durum);
      return;
    }

    // 2. 10 METRE YAKLAŞMA KONTROLÜ:
    if (yuvarlanmisMesafe <= ayar.acilmaMesafesiMetre) {
      if (this.tetiklemeSuruyorMu) return;

      const gecenSaniye = (simdi - (durum.sonAcilmaZamani || 0)) / 1000;
      if (gecenSaniye < ayar.beklemeSuresiSaniye) {
        const kalan = Math.ceil(ayar.beklemeSuresiSaniye - gecenSaniye);
        durum.durumMesaji = `Bekleme süresinde (${kalan} sn kaldı).`;
        this.durumuKaydet(durum);
        return;
      }

      this.tetiklemeSuruyorMu = true;
      durum.korumaKilidiAktif = true;
      durum.sonAcilmaZamani = simdi;
      durum.durumMesaji = '🎯 10 metre sınırı geçildi! Site kapısı açılıyor...';
      this.durumuKaydet(durum);
      this.kayitEkle(`🎯 Kapıya ${yuvarlanmisMesafe}m yaklaşıldı (Hedef: ≤${ayar.acilmaMesafesiMetre}m). Açma komutu gönderiliyor...`);

      const sonuc = await window.TuyaBaglantisi.kapiyiAc(ayar);
      this.tetiklemeSuruyorMu = false;

      const guncelDurum = this.durumuYukle();
      if (sonuc.basarili) {
        guncelDurum.durumMesaji = '✅ Site kapısı otomatik açıldı!';
        this.durumuKaydet(guncelDurum);
        this.kayitEkle(`✅ BAŞARILI: ${sonuc.mesaj}`);
        this.bildirimGoster('🚗 Site Kapısı Açıldı!', `Kapıya ${yuvarlanmisMesafe} metre yaklaştınız.`);
      } else {
        // Bağlantı henüz girilmediyse veya hata verdiyse kullanıcı görsün ama çift istek yağmuruna tutmasın
        guncelDurum.durumMesaji = `⚠️ Tetiklendi ancak: ${sonuc.mesaj}`;
        this.durumuKaydet(guncelDurum);
        this.kayitEkle(`⚠️ UYARI: ${sonuc.mesaj}`);
        this.bildirimGoster('⚠️ Kapı Komutu Uyarısı', sonuc.mesaj);
      }
      return;
    }

    durum.durumMesaji = `Kapıya ${yuvarlanmisMesafe} metre uzaklıktasınız (${ayar.acilmaMesafesiMetre}m kala açılır).`;
    this.durumuKaydet(durum);
  },

  /**
   * Gerçek GPS koordinatı geldiğinde mesafeyi hesaplayıp değerlendirir
   */
  async koordinatiDegerlendir(enlem, boylam, sapma) {
    if (this.simulasyonModu) return;
    const ayar = this.ayarlariYukle();
    const mesafe = mesafeHesaplaMetre(enlem, boylam, ayar.kapiEnlem, ayar.kapiBoylam);
    await this.mesafeyiDegerlendir(mesafe, sapma);
  },

  /**
   * Hem Android/iOS Arka Plan Servisini hem Canlı Konum Takibini başlatır
   */
  async takibiBaslat() {
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch {}
    }

    // Araçta ekran açıkken uyku moduna girmesini engelle (Wake Lock)
    if ('wakeLock' in navigator) {
      try {
        this.ekranUyanikTutucu = await navigator.wakeLock.request('screen');
      } catch {}
    }

    // 1. Eğer telefona yüklenmiş gerçek Android / iOS uygulaması içindeysek Arka Plan Konum Servisini başlat
    const bgEklenti = window.Capacitor?.Plugins?.BackgroundGeolocation;
    if (bgEklenti) {
      try {
        this.arkaPlanEklentiNo = await bgEklenti.addWatcher(
          {
            backgroundMessage: 'Site kapısına 10 metre yaklaştığınızda kapı otomatik açılacak.',
            backgroundTitle: '🛡️ Site Kapısı Otomatik Açıcı Aktif',
            requestPermissions: true,
            stale: false,
            distanceFilter: 2, // Her 2 metrede bir hassas kontrol
          },
          (konum, hata) => {
            if (hata) {
              this.kayitEkle('⚠️ Arka plan konum uyarısı: ' + (hata.message || hata.code));
              return;
            }
            if (konum) {
              this.koordinatiDegerlendir(konum.latitude, konum.longitude, konum.accuracy);
            }
          }
        );
        this.calisiyorMu = true;
        this.kayitEkle('🚀 Android/iOS arka plan 10m hassas takip servisi başlatıldı.');
        return { basarili: true, mesaj: 'Arka plan servisi aktif! Telefon cebinizdeyken bile 10m kala kapı açılacak.' };
      } catch (e) {
        this.kayitEkle('ℹ️ Standart GPS moduna geçiliyor...');
      }
    }

    // 2. Standart Yüksek Hassasiyetli GPS Takibi
    if (!('geolocation' in navigator)) {
      return { basarili: false, mesaj: 'Cihazınızda konum özelliği bulunamadı. Simülatör modunu kullanabilirsiniz.' };
    }

    if (this.izlemeNo !== null) {
      navigator.geolocation.clearWatch(this.izlemeNo);
    }

    this.izlemeNo = navigator.geolocation.watchPosition(
      (pozisyon) => {
        this.koordinatiDegerlendir(
          pozisyon.coords.latitude,
          pozisyon.coords.longitude,
          pozisyon.coords.accuracy
        );
      },
      (hata) => {
        const durum = this.durumuYukle();
        durum.durumMesaji = 'GPS sinyali bekleniyor veya konum izni verilmedi. (Test için aşağıdaki Simülatörü açabilirsiniz)';
        this.durumuKaydet(durum);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );

    this.calisiyorMu = true;
    this.kayitEkle('🚀 Yüksek hassasiyetli (10m) konum takibi başlatıldı.');
    return { basarili: true, mesaj: '10 metre hassas konum takibi başlatıldı!' };
  },

  async takibiDurdur() {
    if (this.izlemeNo !== null) {
      navigator.geolocation.clearWatch(this.izlemeNo);
      this.izlemeNo = null;
    }
    const bgEklenti = window.Capacitor?.Plugins?.BackgroundGeolocation;
    if (bgEklenti && this.arkaPlanEklentiNo) {
      try {
        await bgEklenti.removeWatcher({ id: this.arkaPlanEklentiNo });
      } catch {}
      this.arkaPlanEklentiNo = null;
    }
    if (this.ekranUyanikTutucu) {
      try { await this.ekranUyanikTutucu.release(); } catch {}
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
    durum.durumMesaji = 'Koruma kilidi sıfırlandı. Kapı tekrar açılmaya hazır.';
    this.durumuKaydet(durum);
    this.kayitEkle('🔓 Koruma kilidi elle sıfırlandı.');
  },
};
