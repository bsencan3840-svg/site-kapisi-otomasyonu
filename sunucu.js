/**
 * Bağımsız yerel çalıştırıcı (harici paket yok).
 * Kullanıcıdan yalnızca Smart Life ID alır; geri kalan her şey gizlidir.
 */
const httpModul = require('http');
const httpsModul = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const SmartLifeBaglantisi = require('./uygulama/smartLifeBaglantisi.js');

const PORT = 3456;
const UYGULAMA_KLASORU = path.join(__dirname, 'uygulama');

const DOSYA_TIPLERI = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function siteProfiliYukle() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'site-profili.json'), 'utf8'));
  } catch {
    return { bolge: 'eu', clientId: '', secret: '', komutKodu: 'switch_1', komutDegeri: true };
  }
}

function agIstemi({ url, method, headers, body }) {
  return new Promise((resolve, reject) => {
    const adres = new URL(url);
    const modul = adres.protocol === 'https:' ? httpsModul : httpModul;
    const istek = modul.request({
      hostname: adres.hostname,
      port: adres.port || undefined,
      path: adres.pathname + adres.search,
      method,
      headers,
    }, ( Yanit ) => {
      let veri = '';
      Yanit.on('data', (parca) => { veri += parca; });
      Yanit.on('end', () => {
        try { resolve({ status: Yanit.statusCode, json: JSON.parse(veri) }); }
        catch { resolve({ status: Yanit.statusCode, json: null }); }
      });
    });
    istek.on('error', reject);
    if (body) istek.write(body);
    istek.end();
  });
}

function gonder(res, nesne, durum = 200) {
  res.writeHead(durum, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(nesne));
}

const sunucu = httpModul.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // TEK ID KÖPRÜSÜ: istekte yalnızca smartLifeId vardır.
  if (req.method === 'POST' && req.url === '/api/kapi-ac') {
    let govde = '';
    req.on('data', (p) => { govde += p; });
    req.on('end', async () => {
      try {
        const gelen = JSON.parse(govde || '{}');
        const sonuc = await SmartLifeBaglantisi.kapiyiAc(
          { smartLifeId: gelen.smartLifeId },
          { sunucuKoprusu: false, profil: siteProfiliYukle(), http: agIstemi }
        );
        gonder(res, sonuc);
      } catch {
        gonder(res, { basarili: false, mesaj: 'Kapı açılamadı. Lütfen tekrar deneyin.' });
      }
    });
    return;
  }

  let temizYol = decodeURIComponent(req.url.split('?')[0]);
  if (temizYol === '/') temizYol = '/index.html';
  const dosyaYolu = path.resolve(UYGULAMA_KLASORU, '.' + temizYol);
  if (!dosyaYolu.startsWith(UYGULAMA_KLASORU + path.sep) && dosyaYolu !== path.join(UYGULAMA_KLASORU, 'index.html')) {
    res.writeHead(403);
    res.end('Erişim reddedildi');
    return;
  }

  fs.readFile(dosyaYolu, (hata, icerik) => {
    if (hata) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Dosya bulunamadı');
      return;
    }
    res.writeHead(200, { 'Content-Type': DOSYA_TIPLERI[path.extname(dosyaYolu).toLowerCase()] || 'application/octet-stream' });
    res.end(icerik);
  });
});

function yerelIp() {
  const aglar = os.networkInterfaces();
  for (const ad of Object.keys(aglar)) {
    for (const arayuz of aglar[ad] || []) {
      if (arayuz.family === 'IPv4' && !arayuz.internal) return arayuz.address;
    }
  }
  return '127.0.0.1';
}

sunucu.listen(PORT, '0.0.0.0', () => {
  console.log('======================================================');
  console.log('  🚗 SİTE KAPISI ÇALIŞIYOR');
  console.log('======================================================');
  console.log(`  Bilgisayar: http://localhost:${PORT}`);
  console.log(`  Telefon   : http://${yerelIp()}:${PORT}`);
  console.log('======================================================');
  if (process.platform === 'win32') exec(`start http://localhost:${PORT}`);
});
