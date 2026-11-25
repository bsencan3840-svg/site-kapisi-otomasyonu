# Site yöneticisi notu (kullanıcıya gösterilmez)

Kullanıcı yalnızca Smart Life ID'sini girer. Bağlantıya dair teknik değerler
`site-profili.json` dosyasında tutulur ve arayüzde hiçbir yerde görünmez:

```json
{
  "bolge": "eu",
  "clientId": "...",
  "secret": "...",
  "komutKodu": "switch_1",
  "komutDegeri": true
}
```

Bu dosya bir kez doldurulduğunda site sakinleri yalnızca kendi cihaz ID'lerini
yazarlar. Başka bir şey sorulmaz.

Alternatif olarak, teknik bilgileri hiç dosyaya koymadan **tek bir kurulum kodu**
üretilebilir; kullanıcı bu kodu yine aynı tek alana yapıştırır:

```bash
node id-olustur.js <clientId> <secret> <cihazId> [bolge] [komutKodu] [deger]
```

Çıktı `SL1....` biçimindedir ve bağlantı için gereken her şeyi içerir.
Kullanıcıya verilen tek şey budur; ayrıca bir bilgi istenmez.
