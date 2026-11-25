/**
 * Doğrudan Telefon İçinden (iOS ve Android) Smart Life Bağlantı Modülü
 * Telefona kurulduğunda bilgisayara ihtiyaç duymadan doğrudan hücresel veri / Wi-Fi ile çalışır.
 */

const TUYA_ADRESLERI = {
  eu: 'https://openapi.tuyaeu.com',
  us: 'https://openapi.tuyaus.com',
  cn: 'https://openapi.tuyacn.com',
  in: 'https://openapi.tuyain.com',
};

// Tarayıcı ve Mobil WebCrypto ile SHA-256 özeti
async function sha256Hesapla(metin) {
  const veri = new TextEncoder().encode(metin);
  const ozetBuffer = await crypto.subtle.digest('SHA-256', veri);
  return Array.from(new Uint8Array(ozetBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Tarayıcı ve Mobil WebCrypto ile HMAC-SHA256 imzası
async function hmacSha256Hesapla(mesaj, gizliAnahtar) {
  const kodlayici = new TextEncoder();
  const anahtar = await crypto.subtle.importKey(
    'raw',
    kodlayici.encode(gizliAnahtar),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const imzaBuffer = await crypto.subtle.sign('HMAC', anahtar, kodlayici.encode(mesaj));
  return Array.from(new Uint8Array(imzaBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

async function dogrudanTuyaImza(ayarlar) {
  const { clientId, secret, accessToken = '', timestamp, method, pathWithQuery, bodyStr = '' } = ayarlar;
  const icerikOzeti = await sha256Hesapla(bodyStr);
  const imzalanacak = [method, icerikOzeti, '', pathWithQuery].join('\n');
  const hamVeri = clientId + accessToken + timestamp + imzalanacak;
  return await hmacSha256Hesapla(hamVeri, secret);
}

// Uygulama bilgisayarda test sunucusunda mı yoksa telefonda bağımsız paket olarak mı çalışıyor kontrol eder
function yerelSunucuVarMi() {
  return window.location.protocol.startsWith('http') && !window.Capacitor;
}

function degeriTipineCevir(deger) {
  const temiz = String(deger ?? 'true').trim();
  if (temiz.toLowerCase() === 'true') return true;
  if (temiz.toLowerCase() === 'false') return false;
  if (temiz !== '' && !isNaN(Number(temiz))) return Number(temiz);
  return temiz;
}

window.TuyaBaglantisi = {
  /**
   * Site kapısını açma komutu gönderir
   */
  async kapiyiAc(ayar) {
    // Giriş doğrulaması
    if (ayar.tetiklemeYontemi === 'ozelBaglanti') {
      if (!ayar.ozelBaglantiAdresi || !ayar.ozelBaglantiAdresi.trim()) {
        return { basarili: false, mesaj: 'Lütfen özel bağlantı adresini girin.' };
      }
    } else {
      if (!ayar.tuyaMusteriNo?.trim() || !ayar.tuyaGizliAnahtar?.trim()) {
        return {
          basarili: false,
          mesaj: 'Smart Life bağlantı bilgileri henüz girilmemiş ("Bağlantı Ayarları" sekmesinden girebilirsiniz).',
        };
      }
    }

    // 1. Bilgisayar üzerinden test ediliyorsa yerel köprüyü kullan
    if (yerelSunucuVarMi()) {
      try {
        const yanit = await fetch('/api/kapi-ac', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ayar),
        });
        return await yanit.json();
      } catch (hata) {
        return { basarili: false, mesaj: 'Bağlantı hatası: ' + hata.message };
      }
    }

    // 2. Telefonda bağımsız uygulama (Android / iOS) olarak çalışıyorsa doğrudan Tuya bulutuna bağlan
    try {
      if (ayar.tetiklemeYontemi === 'ozelBaglanti') {
        const r = await fetch(ayar.ozelBaglantiAdresi.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ olay: 'kapi_ac', zaman: Date.now() }),
        });
        return {
          basarili: r.ok,
          mesaj: r.ok ? 'Site kapısı özel bağlantı ile açıldı!' : `Hata kodu: ${r.status}`,
        };
      }

      const tabanAdres = TUYA_ADRESLERI[ayar.tuyaBolge] || TUYA_ADRESLERI.eu;
      const musteriNo = ayar.tuyaMusteriNo.trim();
      const gizliAnahtar = ayar.tuyaGizliAnahtar.trim();

      // Adım A: Erişim Anahtarı (Token) Al
      const tokenYolu = '/v1.0/token?grant_type=1';
      const t1 = Date.now().toString();
      const tokenImza = await dogrudanTuyaImza({
        clientId: musteriNo,
        secret: gizliAnahtar,
        timestamp: t1,
        method: 'GET',
        pathWithQuery: tokenYolu,
      });

      const tokenYanit = await fetch(tabanAdres + tokenYolu, {
        method: 'GET',
        headers: {
          client_id: musteriNo,
          sign: tokenImza,
          t: t1,
          sign_method: 'HMAC-SHA256',
        },
      });
      const tokenVeri = await tokenYanit.json();
      if (!tokenVeri.success || !tokenVeri.result?.access_token) {
        return {
          basarili: false,
          mesaj: `Smart Life doğrulama hatası: ${tokenVeri.msg || 'Bilgileri kontrol edin'}`,
        };
      }

      const erisimAnahtari = tokenVeri.result.access_token;
      const t2 = Date.now().toString();
      let komutYolu = '';
      let govdeMetni = '';

      if (ayar.tetiklemeYontemi === 'senaryo') {
        const [evNo, senaryoNo] = (ayar.tuyaSenaryoNo || '').split('/').map((s) => s.trim());
        if (!evNo || !senaryoNo) {
          return { basarili: false, mesaj: 'Senaryo numarası "EvNo/SenaryoNo" biçiminde olmalıdır.' };
        }
        komutYolu = `/v1.0/homes/${evNo}/scenes/${senaryoNo}/trigger`;
        govdeMetni = JSON.stringify({});
      } else {
        const cihazNo = (ayar.tuyaCihazNo || '').trim();
        if (!cihazNo) {
          return { basarili: false, mesaj: 'Lütfen Cihaz Numarası girin.' };
        }
        komutYolu = `/v1.0/iot-03/devices/${cihazNo}/commands`;
        govdeMetni = JSON.stringify({
          commands: [{
            code: (ayar.tuyaKomutKodu || 'switch_1').trim(),
            value: degeriTipineCevir(ayar.tuyaKomutDegeri),
          }],
        });
      }

      const komutImza = await dogrudanTuyaImza({
        clientId: musteriNo,
        secret: gizliAnahtar,
        accessToken: erisimAnahtari,
        timestamp: t2,
        method: 'POST',
        pathWithQuery: komutYolu,
        bodyStr: govdeMetni,
      });

      const komutYanit = await fetch(tabanAdres + komutYolu, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          client_id: musteriNo,
          access_token: erisimAnahtari,
          sign: komutImza,
          t: t2,
          sign_method: 'HMAC-SHA256',
        },
        body: govdeMetni,
      });

      const komutVeri = await komutYanit.json();
      if (!komutVeri.success) {
        return {
          basarili: false,
          mesaj: `Kapı komutu başarısız: ${komutVeri.msg || 'Hata'} (Kod: ${komutVeri.code})`,
        };
      }

      return { basarili: true, mesaj: 'Site kapısı Smart Life üzerinden başarıyla açıldı!' };
    } catch (hata) {
      return { basarili: false, mesaj: 'Bağlantı hatası: ' + hata.message };
    }
  },

  /**
   * Cihazın desteklediği röle / anahtar kodlarını sorgular
   */
  async cihazKodlariniBul(ayar) {
    if (!ayar.tuyaMusteriNo?.trim() || !ayar.tuyaGizliAnahtar?.trim() || !ayar.tuyaCihazNo?.trim()) {
      return { basarili: false, bilgi: 'Lütfen önce Müşteri No, Gizli Anahtar ve Cihaz No alanlarını doldurun.' };
    }

    if (yerelSunucuVarMi()) {
      try {
        const yanit = await fetch('/api/cihaz-sorgula', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ayar),
        });
        return await yanit.json();
      } catch (hata) {
        return { basarili: false, bilgi: 'Sorgu hatası: ' + hata.message };
      }
    }

    try {
      const tabanAdres = TUYA_ADRESLERI[ayar.tuyaBolge] || TUYA_ADRESLERI.eu;
      const musteriNo = ayar.tuyaMusteriNo.trim();
      const gizliAnahtar = ayar.tuyaGizliAnahtar.trim();

      const tokenYolu = '/v1.0/token?grant_type=1';
      const t1 = Date.now().toString();
      const tokenImza = await dogrudanTuyaImza({
        clientId: musteriNo,
        secret: gizliAnahtar,
        timestamp: t1,
        method: 'GET',
        pathWithQuery: tokenYolu,
      });

      const tokenYanit = await fetch(tabanAdres + tokenYolu, {
        method: 'GET',
        headers: { client_id: musteriNo, sign: tokenImza, t: t1, sign_method: 'HMAC-SHA256' },
      });
      const tokenVeri = await tokenYanit.json();
      if (!tokenVeri.success) {
        return { basarili: false, bilgi: `Doğrulama hatası: ${tokenVeri.msg}` };
      }

      const erisimAnahtari = tokenVeri.result.access_token;
      const t2 = Date.now().toString();
      const durumYolu = `/v1.0/iot-03/devices/${ayar.tuyaCihazNo.trim()}/status`;
      const durumImza = await dogrudanTuyaImza({
        clientId: musteriNo,
        secret: gizliAnahtar,
        accessToken: erisimAnahtari,
        timestamp: t2,
        method: 'GET',
        pathWithQuery: durumYolu,
      });

      const durumYanit = await fetch(tabanAdres + durumYolu, {
        method: 'GET',
        headers: {
          client_id: musteriNo,
          access_token: erisimAnahtari,
          sign: durumImza,
          t: t2,
          sign_method: 'HMAC-SHA256',
        },
      });
      const durumVeri = await durumYanit.json();
      if (!durumVeri.success) {
        return { basarili: false, bilgi: `Sorgulanamadı: ${durumVeri.msg}` };
      }

      const kodlar = Array.isArray(durumVeri.result)
        ? durumVeri.result.map((k) => `${k.code} (şu an: ${k.value})`).join(', ')
        : 'switch_1';

      return { basarili: true, bilgi: `Bulunan Komut Kodları: ${kodlar}` };
    } catch (hata) {
      return { basarili: false, bilgi: 'Bağlantı hatası: ' + hata.message };
    }
  },
};
