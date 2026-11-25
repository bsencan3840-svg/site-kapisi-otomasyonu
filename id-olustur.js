/** Yönetici aracı: bağlantı için gereken her şeyi TEK bir ID'ye paketler. */
const TB = require('./uygulama/smartLifeBaglantisi.js');

const [clientId, secret, deviceId, bolge = 'eu', komutKodu = 'switch_1', deger = 'true'] = process.argv.slice(2);

if (!clientId || !secret || !deviceId) {
  console.error('Kullanım: node id-olustur.js <clientId> <secret> <cihazId> [bolge] [komutKodu] [deger]');
  process.exit(1);
}

const kod = TB.smartLifeKodUret({
  clientId,
  secret,
  deviceId,
  bolge,
  komutKodu,
  komutDegeri: deger,
});

console.log(kod);
console.log('\nBu kodu kullanıcıya verin; uygulamadaki TEK alana yapıştırması yeterlidir.');
