/**
 * Site Kapısı Otomasyonu - Bağımsız Yerel Çalıştırıcı ve Smart Life Köprüsü
 * Hiçbir dış pakete ihtiyaç duymaz, doğrudan bilgisayarınızda çalışır.
 */
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const PORT = 3456;
const UYGULAMA_KLASORU = path.join(__dirname, 'uygulama');

const BOLGE_ADRESLERI = {
  eu: 'openapi.tuyaeu.com',
  us: 'openapi.tuyaus.com',
  cn: 'openapi.tuyacn.com',
  in: 'openapi.tuyain.com',
};

const DOSYA_TIPLERI = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// Tuya şifreli imza oluşturucu
function tuyaImzaOlustur({ clientId, secret, accessToken = '', timestamp, method, pathWithQuery, bodyStr = '' }) {
  const icerikOzeti = crypto.createHash('sha256').update(bodyStr, 'utf8').digest('hex').toLowerCase();
  const imzalanacakMetin = [method, icerikOzeti, '', pathWithQuery].join('\n');
  const birlesikVeri = clientId + accessToken + timestamp + imzalanacakMetin;
  return crypto.createHmac('sha256', secret).update(birlesikVeri, 'utf8').digest('hex').toUpperCase();
}

// HTTPS isteği gönderici
function httpsIstekGonder(options, bodyStr = '') {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let veri = '';
      res.on('data', (parca) => { veri += parca; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(veri) });
        } catch {
          resolve({ status: res.statusCode, raw: veri });
        }
      });
    });
    req.on('error', (hata) => reject(hata));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// Tuya Erişim Anahtarı (Token) alıcı
async function tuyaErisimAnahtariAl(ayar) {
  const sunucuAdi = BOLGE_ADRESLERI[ayar.tuyaBolge] || BOLGE_ADRESLERI.eu;
  const yol = '/v1.0/token?grant_type=1';
  const zaman = Date.now().toString();
  const musteriNo = (ayar.tuyaMusteriNo || '').trim();
  const gizliAnahtar = (ayar.tuyaGizliAnahtar || '').trim();

  const imza = tuyaImzaOlustur({
    clientId: musteriNo,
    secret: gizliAnahtar,
    timestamp: zaman,
    method: 'GET',
    pathWithQuery: yol,
  });

  const yanit = await httpsIstekGonder({
    hostname: sunucuAdi,
    path: yol,
    method: 'GET',
    headers: {
      client_id: musteriNo,
      sign: imza,
      t: zaman,
      sign_method: 'HMAC-SHA256',
    },
  });

  if (!yanit.json || !yanit.json.success || !yanit.json.result?.access_token) {
    throw new Error(`Smart Life doğrulama hatası: ${yanit.json?.msg || 'Bilgileri kontrol edin'} (Kod: ${yanit.json?.code || yanit.status})`);
  }
  return yanit.json.result.access_token;
}

function komutDegeriCevir(deger) {
  const temiz = String(deger ?? 'true').trim();
  if (temiz.toLowerCase() === 'true') return true;
  if (temiz.toLowerCase() === 'false') return false;
  if (temiz !== '' && !isNaN(Number(temiz))) return Number(temiz);
  return temiz;
}

// Bilgisayarın yerel ağ (Wi-Fi) IP adresini bulur
function yerelIpBul() {
  const aglar = os.networkInterfaces();
  for (const ad of Object.keys(aglar)) {
    for (const arayuz of aglar[ad] || []) {
      if (arayuz.family === 'IPv4' && !arayuz.internal) {
        return arayuz.address;
      }
    }
  }
  return '127.0.0.1';
}

const sunucu = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1) KAPI TETİKLEME KÖPRÜSÜ (/api/kapi-ac)
  if (req.method === 'POST' && req.url === '/api/kapi-ac') {
    let govde = '';
    req.on('data', (p) => { govde += p; });
    req.on('end', async () => {
      try {
        const ayar = JSON.parse(govde);

        // Özel Bağlantı (Webhook) Modu
        if (ayar.tetiklemeYontemi === 'ozelBaglanti') {
          const baglanti = new URL(ayar.ozelBaglantiAdresi.trim());
          const veri = JSON.stringify({ olay: 'kapi_ac', zaman: Date.now() });
          const yanit = await httpsIstekGonder({
            hostname: baglanti.hostname,
            port: baglanti.port || 443,
            path: baglanti.pathname + baglanti.search,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }, veri);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            basarili: yanit.status >= 200 && yanit.status < 300,
            mesaj: yanit.status >= 200 && yanit.status < 300
              ? 'Site kapısı özel bağlantı üzerinden açıldı!'
              : `Özel bağlantı hatası (Durum: ${yanit.status})`,
          }));
          return;
        }

        const sunucuAdi = BOLGE_ADRESLERI[ayar.tuyaBolge] || BOLGE_ADRESLERI.eu;
        const token = await tuyaErisimAnahtariAl(ayar);
        const zaman = Date.now().toString();
        const musteriNo = ayar.tuyaMusteriNo.trim();
        const gizliAnahtar = ayar.tuyaGizliAnahtar.trim();

        let yol = '';
        let gonderilecekVeri = '';

        if (ayar.tetiklemeYontemi === 'senaryo') {
          const [evNo, senaryoNo] = (ayar.tuyaSenaryoNo || '').split('/').map((s) => s.trim());
          if (!evNo || !senaryoNo) {
            throw new Error('Senaryo numarası "EvNo/SenaryoNo" biçiminde olmalıdır.');
          }
          yol = `/v1.0/homes/${evNo}/scenes/${senaryoNo}/trigger`;
          gonderilecekVeri = JSON.stringify({});
        } else {
          const cihazNo = (ayar.tuyaCihazNo || '').trim();
          if (!cihazNo) throw new Error('Lütfen Cihaz Numarası (Device ID) girin.');
          yol = `/v1.0/iot-03/devices/${cihazNo}/commands`;
          gonderilecekVeri = JSON.stringify({
            commands: [{
              code: (ayar.tuyaKomutKodu || 'switch_1').trim(),
              value: komutDegeriCevir(ayar.tuyaKomutDegeri),
            }],
          });
        }

        const imza = tuyaImzaOlustur({
          clientId: musteriNo,
          secret: gizliAnahtar,
          accessToken: token,
          timestamp: zaman,
          method: 'POST',
          pathWithQuery: yol,
          bodyStr: gonderilecekVeri,
        });

        const yanit = await httpsIstekGonder({
          hostname: sunucuAdi,
          path: yol,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            client_id: musteriNo,
            access_token: token,
            sign: imza,
            t: zaman,
            sign_method: 'HMAC-SHA256',
          },
        }, gonderilecekVeri);

        if (!yanit.json?.success) {
          throw new Error(`Komut gönderilemedi: ${yanit.json?.msg || 'Bilinmeyen hata'} (Kod: ${yanit.json?.code})`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          basarili: true,
          mesaj: 'Site kapısı Smart Life üzerinden başarıyla açıldı!',
        }));
      } catch (hata) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ basarili: false, mesaj: hata.message }));
      }
    });
    return;
  }

  // 2) CİHAZ KOMUT KODU SORGULAMA (/api/cihaz-sorgula)
  if (req.method === 'POST' && req.url === '/api/cihaz-sorgula') {
    let govde = '';
    req.on('data', (p) => { govde += p; });
    req.on('end', async () => {
      try {
        const ayar = JSON.parse(govde);
        const sunucuAdi = BOLGE_ADRESLERI[ayar.tuyaBolge] || BOLGE_ADRESLERI.eu;
        const token = await tuyaErisimAnahtariAl(ayar);
        const zaman = Date.now().toString();
        const cihazNo = (ayar.tuyaCihazNo || '').trim();
        const yol = `/v1.0/iot-03/devices/${cihazNo}/status`;

        const imza = tuyaImzaOlustur({
          clientId: ayar.tuyaMusteriNo.trim(),
          secret: ayar.tuyaGizliAnahtar.trim(),
          accessToken: token,
          timestamp: zaman,
          method: 'GET',
          pathWithQuery: yol,
        });

        const yanit = await httpsIstekGonder({
          hostname: sunucuAdi,
          path: yol,
          method: 'GET',
          headers: {
            client_id: ayar.tuyaMusteriNo.trim(),
            access_token: token,
            sign: imza,
            t: zaman,
            sign_method: 'HMAC-SHA256',
          },
        });

        if (!yanit.json?.success) {
          throw new Error(`Cihaz sorgulanamadı: ${yanit.json?.msg} (Kod: ${yanit.json?.code})`);
        }

        const kodlar = Array.isArray(yanit.json.result)
          ? yanit.json.result.map((k) => `${k.code} (mevcut değer: ${k.value})`).join(', ')
          : 'switch_1';

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ basarili: true, bilgi: `Bulunan Komut Kodları: ${kodlar}` }));
      } catch (hata) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ basarili: false, bilgi: hata.message }));
      }
    });
    return;
  }

  // 3) UYGULAMA DOSYALARINI SUNMA
  let temizYol = req.url.split('?')[0];
  if (temizYol === '/') temizYol = '/index.html';
  const dosyaYolu = path.join(UYGULAMA_KLASORU, temizYol);

  if (!dosyaYolu.startsWith(UYGULAMA_KLASORU)) {
    res.writeHead(403);
    res.end('Erişim reddedildi');
    return;
  }

  fs.readFile(dosyaYolu, (err, icerik) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Dosya bulunamadı');
      return;
    }
    const uzanti = path.extname(dosyaYolu).toLowerCase();
    res.writeHead(200, { 'Content-Type': DOSYA_TIPLERI[uzanti] || 'application/octet-stream' });
    res.end(icerik);
  });
});

sunucu.listen(PORT, '0.0.0.0', () => {
  const ip = yerelIpBul();
  console.log('======================================================');
  console.log('  🚗 SİTE KAPISI OTOMASYONU ÇALIŞIYOR!');
  console.log('======================================================');
  console.log(`  Bilgisayardan açmak için : http://localhost:${PORT}`);
  console.log(`  Telefondan (Wi-Fi) açmak : http://${ip}:${PORT}`);
  console.log('======================================================');
  exec(`start http://localhost:${PORT}`);
});
