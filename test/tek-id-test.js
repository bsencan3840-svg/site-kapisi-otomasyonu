/**
 * "Sadece Smart Life ID" akışının doğrulama testleri.
 * Çalıştır: node test/tek-id-test.js
 */
const assert = require('assert');
const crypto = require('crypto');
const TB = require('../uygulama/smartLifeBaglantisi.js');

(async () => {
  // 1) Kripto doğrulama vektörleri
  assert.strictEqual(TB.sha256Ozet('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.strictEqual(
    TB.hmacSha256Ozet('The quick brown fox jumps over the lazy dog', 'key'),
    'F7BC83F430538424B13298E6AA6FB143EF4D59A14946175997479DBC2D1A3CD8'
  );
  console.log('✓ SHA-256 / HMAC-SHA256 doğrulandı');

  // 2) Tek-ID çözümleme: sadece cihaz ID'si
  const coz = TB.cozSmartLifeId('cihaz-123456', {
    bolge: 'eu', clientId: 'cid', secret: 'sifre', komutKodu: 'switch_1', komutDegeri: true,
  });
  assert.deepStrictEqual(
    { d: coz.deviceId, c: coz.clientId, s: coz.secret, r: coz.bolge, k: coz.komutKodu },
    { d: 'cihaz-123456', c: 'cid', s: 'sifre', r: 'eu', k: 'switch_1' }
  );
  console.log('✓ Yalnızca Smart Life ID ile tüm bağlantı çözüldü');

  // 3) Tek-ID kurulum kodu: her şey tek alanın içinde
  const tekId = TB.smartLifeKodUret({
    clientId: 'cid2', secret: 'sifre2', deviceId: 'ayettekinden-farkli-cihaz', bolge: 'us',
  });
  const coz2 = TB.cozSmartLifeId(tekId, {});
  assert.strictEqual(coz2.deviceId, 'ayettekinden-farkli-cihaz');
  assert.strictEqual(coz2.clientId, 'cid2');
  assert.strictEqual(coz2.bolge, 'us');
  console.log('✓ SL1 tek-ID kodu tek başına çalışıyor');

  // 4) Uçtan uca: ayar nesnesinde SADECE smartLifeId var
  const cagirilar = [];
  const sahteHttp = async (istek) => {
    cagirilar.push(istek);
    if (istek.url.includes('/token')) {
      return { status: 200, json: { success: true, result: { access_token: 'TOKEN123' } } };
    }
    return { status: 200, json: { success: true, result: {} } };
  };
  const sonuc = await TB.kapiyiAc(
    { smartLifeId: 'cihaz-123456' },
    {
      sunucuKoprusu: false,
      http: sahteHttp,
      profil: { bolge: 'eu', clientId: 'cid', secret: 'sifre', komutKodu: 'switch_1', komutDegeri: true },
    }
  );
  assert.strictEqual(sonuc.basarili, true, sonuc.mesaj);
  assert.strictEqual(cagirilar.length, 2);
  assert.strictEqual(cagirilar[0].url, 'https://openapi.tuyaeu.com/v1.0/token?grant_type=1');
  assert.strictEqual(cagirilar[1].url, 'https://openapi.tuyaeu.com/v1.0/iot-03/devices/cihaz-123456/commands');
  assert.deepStrictEqual(JSON.parse(cagirilar[1].body).commands[0], { code: 'switch_1', value: true });

  // Sunucu tarafındaki imzayla aynı imza üretiliyor mu?
  const t = cagirilar[1].headers.t;
  const ozet = crypto.createHash('sha256').update(cagirilar[1].body, 'utf8').digest('hex');
  const imzalanacak = ['POST', ozet, '', '/v1.0/iot-03/devices/cihaz-123456/commands'].join('\n');
  const beklenen = crypto.createHmac('sha256', 'sifre')
    .update('cid' + 'TOKEN123' + t + imzalanacak, 'utf8').digest('hex').toUpperCase();
  assert.strictEqual(cagirilar[1].headers.sign, beklenen);
  console.log('✓ Tek ID → token + açma komutu + geçerli imza');

  // 5) Kullanıcıya teknik bir ayrıntı sızdırılmıyor mu?
  const tumMesajlar = [sonuc.mesaj, TB.kapiyiAc({ smartLifeId: '' }).mesaj,
    TB.cozSmartLifeId('SL1.bozuk', {}).hata].join(' ').toUpperCase();
  for (const yasakli of ['ACCESS ID', 'ACCESS SECRET', 'CLIENT', 'TUYA', 'WEBHOOK', 'SL1 KURULUM']) {
    assert.ok(!tumMesajlar.includes(yasakli), `Kullanıcı mesajında teknik terim var: ${yasakli}`);
  }
  console.log('✓ Kullanıcı mesajlarında Tuya / erişim bilgisi geçmiyor');

  // 6) Kapı motoru: konum kullanıcıya sorulmadan öğreniliyor ve kilit döngüsü çalışıyor
  const bellek = new Map();
  global.localStorage = {
    getItem: (k) => (bellek.has(k) ? bellek.get(k) : null),
    setItem: (k, v) => bellek.set(k, v),
  };
  let acmaSayisi = 0;
  global.window = {
    SmartLifeBaglantisi: { kapiyiAc: async () => { acmaSayisi++; return { basarili: true, mesaj: 'Site kapısı açıldı!' }; } },
  };
  const KM = require('../uygulama/kapiMotoru.js');
  KM.smartLifeIdKaydet('cihaz-123456');
  assert.strictEqual(KM.kalibrasyonVarMi(), false);
  KM.kapiyiKalibreEt(41.0082, 28.9784); // gerçek uygulamada "Şimdi Aç" ile otomatik olur
  assert.strictEqual(KM.kalibrasyonVarMi(), true);

  await KM.mesafeyiDegerlendir(5, 3);
  assert.strictEqual(acmaSayisi, 1);
  assert.strictEqual(KM.durumuYukle().korumaKilidiAktif, true);
  await KM.mesafeyiDegerlendir(5, 3);
  assert.strictEqual(acmaSayisi, 1, 'koruma kilidi tekrar açma yapmamalı');
  await KM.mesafeyiDegerlendir(85, 3);
  assert.strictEqual(KM.durumuYukle().korumaKilidiAktif, false);
  await KM.mesafeyiDegerlendir(5, 3);
  assert.strictEqual(KM.durumuYukle().sonAcilmaZamani > 0, true);
  console.log('✓ 10m tetikleme, koruma kilidi ve 80m sıfırlama çalışıyor');

  // 7) Kalibrasyon yokken (0,0)'a sahte mesafe gösterilmemeli
  KM.kalibrasyonuSifirla();
  await KM.koordinatiDegerlendir(41.0082, 28.9784, 5);
  assert.strictEqual(KM.durumuYukle().sonMesafeMetre, null);
  assert.ok(KM.durumuYukle().durumMesaji.includes('Kapı konumu öğreniliyor'));
  console.log('✓ Kalibrasyonsuz sahte mesafe (0,0 koordinatına ~10.000 km) gösterilmiyor');

  // 8) Simülatör gerçek kapı koordinatını bozmamalı ve gerçek komut göndermemeli
  KM.kapiyiKalibreEt(41.0082, 28.9784, false);
  KM.korumaKilidiniSifirla();
  const acmaOnce = acmaSayisi;
  KM.simulasyonModu = true;
  await KM.mesafeyiDegerlendir(4, 2);
  assert.strictEqual(acmaSayisi, acmaOnce, 'test modu gerçek kapıya komut göndermemeli');
  assert.strictEqual(KM.durumuYukle().korumaKilidiAktif, true);
  assert.strictEqual(KM.ayarlariYukle().kapiEnlem, 41.0082, 'test modu kalibrasyonu değiştirmemeli');
  KM.simulasyonModu = false;
  console.log('✓ Test modu gerçek konumu bozmuyor ve gerçek komut göndermiyor');

  // 9) Zayıf GPS sinyali yanlış tetikleme yapmamalı
  KM.kalibrasyonuSifirla();
  KM.kapiyiKalibreEt(41.0082, 28.9784, false);
  KM.korumaKilidiniSifirla();
  await KM.koordinatiDegerlendir(41.0082, 28.9784, 45);
  assert.strictEqual(KM.durumuYukle().korumaKilidiAktif, false);
  assert.strictEqual(acmaSayisi, acmaOnce, 'düşük hassasiyette kapı açılmamalı');
  console.log('✓ Zayıf GPS (±45m) yanlış tetikleme yapmıyor');

  // 10) Gerçek haversine mesafesi mantıklı (~1 derece enlem ≈ 111 km)
  await KM.koordinatiDegerlendir(42.0082, 28.9784, 3);
  const hesaplanan = KM.durumuYukle().sonMesafeMetre;
  assert.ok(hesaplanan > 110000 && hesaplanan < 112000, `mesafe: ${hesaplanan}`);
  console.log('✓ Gerçek koordinatlardan doğru mesafe hesaplanıyor');

  console.log('\nTÜM TESTLER GEÇTİ — uygulama tek Smart Life ID ile çalışıyor.');
})().catch((hata) => {
  console.error('TEST BAŞARISIZ:', hata);
  process.exit(1);
});
