# 🚗 Site Kapısı

Site kapısına **2 metre** yaklaşınca kapıyı otomatik açan uygulama.

## 🌐 Canlı adres

**https://site-kapisi-otomasyonu-main.vercel.app**

Telefondan tarayıcıda bu adresi açın; menüden **Ana Ekrana Ekle** ile uygulama gibi kullanın.

## Tek yapmanız gereken: Smart Life ID

Uygulama sizden **yalnızca tek bir şey** ister: **Smart Life ID**.

- ❌ Başka hiçbir alan, anahtar veya ayar yok
- ❌ Kurulum, paket indirme veya ek adım yok

Bağlantı bilgileri uygulamanın içinde tutulur; kullanıcıya gösterilmez ve sorulmaz.

---

## ▶️ Kullanım

1. `baslat.bat` dosyasına çift tıklayın. Uygulama tarayıcıda açılır.
2. **Tek Kurulum** alanına Smart Life ID'nizi yapıştırın ve **Kaydet**e basın.
3. Bir kez, kapının önünde durup **"Site Kapısını Şimdi Aç"**a basın.
   Kapı konumu otomatik öğrenilir; sizden konum bilgisi istenmez.
4. **"Otomatik Açıcıyı Başlat"**a basın. Artık kapıya 2 m kala otomatik açılır,
   80 m uzaklaştığınızda sistem yeniden kurulur.

Masaüstünde denemek için **Yaklaşma Testi** anahtarını açıp çubuğu 2 m'nin altına çekebilirsiniz.

---

## 📱 Telefonda kullanım

Aynı Wi-Fi'a bağlı telefonunuzdan, siyah pencerede yazan adresi (örn. `http://192.168.1.23:3456`) açın.
Tarayıcı menüsünden **Ana Ekrana Ekle** deyin; tam ekran uygulama gibi çalışır.

İsterseniz `Site_Kapisi_Otomasyonu.html` dosyasını doğrudan da açabilirsiniz: tek dosyadır,
harici dosya veya paket kullanmaz.

---

## 🧪 Doğrulama

```bash
node test/tek-id-test.js
```

Test, yalnızca `smartLifeId` alanıyla tüm akışın çalıştığını ve arayüz mesajlarında
teknik bağlantı bilgilerinin geçmediğini doğrular.
