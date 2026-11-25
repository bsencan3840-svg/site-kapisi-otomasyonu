/**
 * Vercel serverless function — tek-ID kapı köprüsü.
 * Tarayıcıdan yalnızca { smartLifeId } gelir; diğer her şey gizlidir.
 */
const SmartLifeBaglantisi = require('../uygulama/smartLifeBaglantisi.js');

let dosyaProfili = {};
try { dosyaProfili = require('../site-profili.json'); } catch { dosyaProfili = {}; }

function profil() {
  return {
    bolge: process.env.SMART_BOLGE || dosyaProfili.bolge || 'eu',
    clientId: process.env.SMART_CLIENT_ID || dosyaProfili.clientId || '',
    secret: process.env.SMART_SECRET || dosyaProfili.secret || '',
    komutKodu: dosyaProfili.komutKodu || 'switch_1',
    komutDegeri: dosyaProfili.komutDegeri ?? true,
  };
}

async function agIstemi({ url, method, headers, body }) {
  const yanit = await fetch(url, {
    method,
    headers,
    body: method === 'GET' ? undefined : body,
  });
  let json = null;
  try { json = await yanit.json(); } catch { /* boş yanıt */ }
  return { status: yanit.status, json };
}

async function govdeOku(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return new Promise((coz) => {
    let veri = '';
    req.on('data', (parca) => { veri += parca; });
    req.on('end', () => {
      try { coz(JSON.parse(veri || '{}')); } catch { coz({}); }
    });
    req.on('error', () => coz({}));
  });
}

function yanitGonder(res, kod, nesne) {
  res.writeHead(kod, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(nesne));
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    yanitGonder(res, 405, { basarili: false, mesaj: 'Kapı açılamadı. Lütfen tekrar deneyin.' });
    return;
  }

  try {
    const gelen = await govdeOku(req);
    const sonuc = await SmartLifeBaglantisi.kapiyiAc(
      { smartLifeId: gelen.smartLifeId },
      { sunucuKoprusu: false, profil: profil(), http: agIstemi }
    );
    yanitGonder(res, 200, sonuc);
  } catch {
    yanitGonder(res, 200, { basarili: false, mesaj: 'Kapı açılamadı. Lütfen tekrar deneyin.' });
  }
};
