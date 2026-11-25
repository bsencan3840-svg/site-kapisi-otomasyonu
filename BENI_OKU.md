# 🚗 Site Kapısı Otomasyonu (Android & iPhone)

Aracı hiçbir programa ihtiyaç duymadan, **site kapısına 10 metre yaklaşıldığında** arka planda **Smart Life** üzerinden kapıyı otomatik açan kendi özel uygulamanız!

---

## ▶️ 1. Bilgisayarınızda Hemen Şimdi Görmek ve Denemek İçin
Masaüstündeki **`site kapı`** klasörünü açın ve **`baslat.bat`** dosyasına çift tıklayın.
- Hiçbir paket indirme hatası olmadan **1 saniye içinde** ekranınızda uygulamanız açılacaktır!
- Aynı ev/ofis ağına (Wi-Fi) bağlı **iPhone veya Android** telefonunuzun tarayıcısından siyah pencerede yazan adrese (örneğin `http://192.168.1.XX:3456`) girip **Ana Ekrana Ekle** diyerek telefonunuzda da anında tam ekran deneyebilirsiniz.
- Masa başındayken denemek için uygulama içindeki **"🚘 Yaklaşma Test Simülatörü"** anahtarını açıp çubuğu **10 metrenin altına** çekerek kapının otomatik tetiklenmesini ve **80 metre uzaklaşınca** kilidin kendiliğinden sıfırlanmasını canlı izleyebilirsiniz.

---

## 🔑 2. Smart Life Bağlantı Bilgileri Nereden Alınır?
Uygulamanın alt menüsündeki **"🔑 Bağlantı Ayarı"** sekmesine herkes kendi bilgilerini girebilir:

1. **Kapı Cihaz Numarası:**
   - Telefonunuzdaki **Smart Life** uygulamasını açın -> Kapı cihazına dokunun -> Sağ üstteki **Kalem** simgesi -> **Cihaz Bilgileri** -> **Sanal ID** bilgisini kopyalayın.
2. **Erişim Numarası ve Gizli Anahtar:**
   - [iot.tuya.com](https://iot.tuya.com) adresinden ücretsiz geliştirici hesabı açıp **Cloud -> Create Cloud Project** menüsünden bölge olarak **Avrupa (Central Europe)** seçin.
   - Verilen `Access ID` ve `Access Secret` bilgilerini uygulamanıza yapıştırın ve **Link Tuya App Account** sekmesindeki karekodu Smart Life uygulamanızdan okutun.

---

## 📱 3. Doğrudan Android (`.apk`) ve iPhone (`.ipa`) Kurulum Dosyası Üretmek İçin
Projenin içinde hem **Android** hem **iPhone (iOS)** arka plan konum izinlerini içeren hazır paketleme kurulumu (`.github/workflows/mobil-paket-uret.yml`) yer almaktadır:
- Bu klasörü ücretsiz bir GitHub hesabına yüklediğiniz anda, bilgisayarınıza dev derleyici programlar kurmanıza gerek kalmadan **Android kurulum dosyanız (`.apk`)** ve **iPhone kurulum dosyanız (`.ipa`)** otomatik olarak üretilip indirmeye hazır hale gelir!
