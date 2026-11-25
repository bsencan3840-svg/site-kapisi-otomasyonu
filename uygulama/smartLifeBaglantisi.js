/**
 * TEK-ID SMART LIFE BAĞLANTISI
 * ----------------------------
 * Kullanıcıdan yalnızca "Smart Life ID" istenir. Bağlantıyla ilgili
 * hiçbir teknik bilgi arayüzde yer almaz; kullanıcıya erişim anahtarı
 * gibi kavramlar hiç gösterilmez. Hepsi dahili olarak çözülür.
 *
 * Harici paket yoktur: SHA-256 ve HMAC-SHA256 saf JavaScript ile
 * uygulanmıştır (file:// ve mobil WebView'de de çalışır).
 */

/* ------------------------------------------------------------------ */
/* Saf JavaScript SHA-256 / HMAC-SHA256                                */
/* ------------------------------------------------------------------ */

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function metneBayt(metin) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(String(metin));
  const sonuc = [];
  const kodlu = unescape(encodeURIComponent(String(metin)));
  for (let i = 0; i < kodlu.length; i++) sonuc.push(kodlu.charCodeAt(i));
  return new Uint8Array(sonuc);
}

function sagaDondur(x, n) {
  return (x >>> n) | (x << (32 - n));
}

function sha256Bayt(baytlar) {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  const uzunluk = baytlar.length;
  // 0x80 + (0..63) padding + 8 bayt bit uzunluğu
  const toplam = Math.ceil((uzunluk + 9) / 64) * 64;
  const dolu = new Uint8Array(toplam);
  dolu.set(baytlar);
  dolu[uzunluk] = 0x80;

  const gorunum = new DataView(dolu.buffer);
  gorunum.setUint32(toplam - 8, Math.floor(uzunluk / 0x20000000));
  gorunum.setUint32(toplam - 4, (uzunluk << 3) >>> 0);

  const w = new Uint32Array(64);
  for (let i = 0; i < toplam; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = gorunum.getUint32(i + j * 4);
    for (let j = 16; j < 64; j++) {
      const x = w[j - 15];
      const y = w[j - 2];
      const s0 = sagaDondur(x, 7) ^ sagaDondur(x, 18) ^ (x >>> 3);
      const s1 = sagaDondur(y, 17) ^ sagaDondur(y, 19) ^ (y >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }

    let a = h[0], b = h[1], c = h[2], d = h[3];
    let e = h[4], f = h[5], g = h[6], hh = h[7];

    for (let j = 0; j < 64; j++) {
      const S1 = sagaDondur(e, 6) ^ sagaDondur(e, 11) ^ sagaDondur(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + SHA256_K[j] + w[j]) >>> 0;
      const S0 = sagaDondur(a, 2) ^ sagaDondur(a, 13) ^ sagaDondur(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }

  const cikti = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    cikti[i * 4] = (h[i] >>> 24) & 0xff;
    cikti[i * 4 + 1] = (h[i] >>> 16) & 0xff;
    cikti[i * 4 + 2] = (h[i] >>> 8) & 0xff;
    cikti[i * 4 + 3] = h[i] & 0xff;
  }
  return cikti;
}

function onaltiligaCevir(baytlar) {
  let metin = '';
  for (let i = 0; i < baytlar.length; i++) metin += baytlar[i].toString(16).padStart(2, '0');
  return metin;
}

function sha256Ozet(metin) {
  return onaltiligaCevir(sha256Bayt(metneBayt(metin)));
}

function hmacSha256Ozet(mesaj, anahtar) {
  let anahtarBayt = metneBayt(anahtar);
  if (anahtarBayt.length > 64) anahtarBayt = sha256Bayt(anahtarBayt);

  const pad = new Uint8Array(64);
  pad.set(anahtarBayt);

  const mesajBayt = metneBayt(mesaj);
  const ic = new Uint8Array(64 + mesajBayt.length);
  const dis = new Uint8Array(64 + 32);
  for (let i = 0; i < 64; i++) {
    ic[i] = pad[i] ^ 0x36;
    dis[i] = pad[i] ^ 0x5c;
  }
  ic.set(mesajBayt, 64);
  dis.set(sha256Bayt(ic), 64);
  return onaltiligaCevir(sha256Bayt(dis)).toUpperCase();
}

function imzaOlustur({ clientId, secret, accessToken = '', timestamp, method, pathWithQuery, bodyStr = '' }) {
  const ozet = sha256Ozet(bodyStr);
  const imzalanacak = [method, ozet, '', pathWithQuery].join('\n');
  return hmacSha256Ozet(clientId + accessToken + timestamp + imzalanacak, secret);
}

/* ------------------------------------------------------------------ */
/* TEK ID çözümü                                                       */
/* ------------------------------------------------------------------ */

function base64urlKodla(metin) {
  const baytlar = metneBayt(metin);
  if (typeof Buffer !== 'undefined') return Buffer.from(baytlar).toString('base64url');
  let ikili = '';
  baytlar.forEach((b) => { ikili += String.fromCharCode(b); });
  return btoa(ikili).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64urlCoz(kod) {
  const duzeltilen = kod.replace(/-/g, '+').replace(/_/g, '/');
  const dolgu = duzeltilen.length % 4 ? '='.repeat(4 - (duzeltilen.length % 4)) : '';
  if (typeof Buffer !== 'undefined') return Buffer.from(duzeltilen + dolgu, 'base64').toString('utf8');
  const ikili = atob(duzeltilen + dolgu);
  return new TextDecoder().decode(Uint8Array.from(ikili, (c) => c.charCodeAt(0)));
}

/** Yönetici tarafından üretilen, HER ŞEYİ içeren tek-ID kurulum kodu. */
function smartLifeKodUret({ clientId, secret, deviceId, bolge = 'eu', komutKodu = 'switch_1', komutDegeri = true }) {
  return 'SL1.' + base64urlKodla(JSON.stringify({
    c: clientId, s: secret, d: deviceId, r: bolge, k: komutKodu, v: komutDegeri,
  }));
}

function degeriTipineCevir(deger) {
  if (typeof deger === 'boolean' || typeof deger === 'number') return deger;
  const temiz = String(deger ?? 'true').trim();
  if (temiz.toLowerCase() === 'true') return true;
  if (temiz.toLowerCase() === 'false') return false;
  if (temiz !== '' && !isNaN(Number(temiz))) return Number(temiz);
  return temiz;
}

/**
 * Tek input'a yazılan değeri çözümler.
 *  - "SL1...."  -> yöneticinin verdiği tek-ID kurulum kodu (her şey içinde)
 *  - diğer      -> Smart Life cihaz ID'si + gizli site profili
 */
function cozSmartLifeId(hamDeger, profil = {}) {
  const ham = String(hamDeger ?? '').trim();
  if (!ham) return null;

  if (/^SL1\./i.test(ham)) {
    try {
      const o = JSON.parse(base64urlCoz(ham.slice(4)));
      if (!o.d) return null;
      return {
        deviceId: String(o.d).trim(),
        clientId: String(o.c || '').trim(),
        secret: String(o.s || '').trim(),
        bolge: String(o.r || 'eu').trim(),
        komutKodu: String(o.k || 'switch_1').trim(),
        komutDegeri: degeriTipineCevir(o.v ?? true),
      };
    } catch {
      return { hata: 'Smart Life ID okunamadı. Lütfen kontrol edip tekrar deneyin.' };
    }
  }

  return {
    deviceId: ham,
    clientId: String(profil.clientId || '').trim(),
    secret: String(profil.secret || '').trim(),
    bolge: String(profil.bolge || 'eu').trim(),
    komutKodu: String(profil.komutKodu || 'switch_1').trim(),
    komutDegeri: degeriTipineCevir(profil.komutDegeri ?? true),
  };
}

const BOLGE_ADRESLERI = {
  eu: 'https://openapi.tuyaeu.com',
  us: 'https://openapi.tuyaus.com',
  cn: 'https://openapi.tuyacn.com',
  in: 'https://openapi.tuyain.com',
};

/* ------------------------------------------------------------------ */
/* HTTP katmanı (harici paket yok)                                     */
/* ------------------------------------------------------------------ */

async function fetchHttp({ url, method, headers, body }) {
  const yanit = await fetch(url, {
    method,
    headers,
    body: method === 'GET' ? undefined : (body || undefined),
  });
  let json;
  try { json = await yanit.json(); } catch { json = null; }
  return { status: yanit.status, json };
}

async function capacitorHttp({ url, method, headers, body }) {
  const eklenti = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Http;
  const yanit = await eklenti.request({
    url,
    method,
    headers,
    data: body ? JSON.parse(body) : undefined,
  });
  const veri = typeof yanit.data === 'string' ? JSON.parse(yanit.data) : yanit.data;
  return { status: yanit.statusCode || yanit.status, json: veri };
}

function varsayilanHttp() {
  if (typeof window !== 'undefined') {
    const cap = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Http;
    if (cap) return capacitorHttp;
  }
  return fetchHttp;
}

/** Yalnızca tek-ID alır; geri kalanını kendisi çözer. */
async function kapiyiAc(ayar, secenekler = {}) {
  const tekId = String((ayar && (ayar.smartLifeId ?? ayar.id)) ?? '').trim();
  if (!tekId) return { basarili: false, mesaj: 'Lütfen Smart Life ID\'nizi girin.' };

  // Tarayıcıda yerel sunucu varsa bulut çağrısı sunucu tarafında yapılır
  // (bulut API'si tarayıcı kökenlerine CORS izni vermediği için).
  if (secenekler.sunucuKoprusu !== false &&
      typeof window !== 'undefined' &&
      /^https?:$/.test(window.location.protocol)) {
    try {
      const yanit = await fetch('/api/kapi-ac', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smartLifeId: tekId }),
      });
      return await yanit.json();
    } catch (hata) {
      return { basarili: false, mesaj: 'Bağlantı kurulamadı. Lütfen tekrar deneyin.' };
    }
  }

  let profil = secenekler.profil;
  if (!profil && typeof window !== 'undefined' && window.SITE_PROFILI) profil = window.SITE_PROFILI;
  const coz = cozSmartLifeId(tekId, profil || {});
  if (!coz) return { basarili: false, mesaj: 'Smart Life ID okunamadı.' };
  if (coz.hata) return { basarili: false, mesaj: coz.hata };

  const http = secenekler.http || varsayilanHttp();

  if (!coz.clientId || !coz.secret) {
    return {
      basarili: false,
      mesaj: 'Kapı açma servisi şu an hazır değil. Lütfen daha sonra tekrar deneyin.',
    };
  }

  const taban = BOLGE_ADRESLERI[coz.bolge] || BOLGE_ADRESLERI.eu;

  try {
    // Adım 1: erişim anahtarı (tek-ID içinden gelen gizli profille)
    const tokenYolu = '/v1.0/token?grant_type=1';
    const t1 = Date.now().toString();
    const tokenYanit = await http({
      url: taban + tokenYolu,
      method: 'GET',
      headers: {
        client_id: coz.clientId,
        sign: imzaOlustur({ clientId: coz.clientId, secret: coz.secret, timestamp: t1, method: 'GET', pathWithQuery: tokenYolu }),
        t: t1,
        sign_method: 'HMAC-SHA256',
      },
    });
    if (!tokenYanit.json || !tokenYanit.json.success || !tokenYanit.json.result?.access_token) {
      return {
        basarili: false,
        mesaj: 'Smart Life bağlantısı doğrulanamadı. Lütfen ID\'nizi kontrol edip tekrar deneyin.',
      };
    }
    const token = tokenYanit.json.result.access_token;

    // Adım 2: kapı rölesine açma komutu (komut kodu da dahili)
    const komutYolu = `/v1.0/iot-03/devices/${encodeURIComponent(coz.deviceId)}/commands`;
    const govde = JSON.stringify({
      commands: [{ code: coz.komutKodu, value: degeriTipineCevir(coz.komutDegeri) }],
    });
    const t2 = Date.now().toString();
    const komutYanit = await http({
      url: taban + komutYolu,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        client_id: coz.clientId,
        access_token: token,
        sign: imzaOlustur({
          clientId: coz.clientId,
          secret: coz.secret,
          accessToken: token,
          timestamp: t2,
          method: 'POST',
          pathWithQuery: komutYolu,
          bodyStr: govde,
        }),
        t: t2,
        sign_method: 'HMAC-SHA256',
      },
      body: govde,
    });

    if (!komutYanit.json || !komutYanit.json.success) {
      return {
        basarili: false,
        mesaj: 'Kapıya açma komutu ulaşmadı. Lütfen tekrar deneyin.',
      };
    }
    return { basarili: true, mesaj: 'Site kapısı açıldı!' };
  } catch {
    return { basarili: false, mesaj: 'Bağlantı kurulamadı. Lütfen tekrar deneyin.' };
  }
}

const SmartLifeBaglantisi = {
  kapiyiAc,
  cozSmartLifeId,
  smartLifeKodUret,
  sha256Ozet,
  hmacSha256Ozet,
  imzaOlustur,
};

if (typeof window !== 'undefined') window.SmartLifeBaglantisi = SmartLifeBaglantisi;
if (typeof module !== 'undefined' && module.exports) module.exports = SmartLifeBaglantisi;
