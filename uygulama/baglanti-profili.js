/**
 * SİTE BAĞLANTI PROFİLİ (kullanıcıya asla gösterilmez, asla sorulmaz)
 * ------------------------------------------------------------------
 * Telefondaki kullanıcı yalnızca TEK bir alana "Smart Life ID" yaznar.
 * Bulut bağlantısı için gereken teknik bilgiler burada, uygulamanın
 * içinde tutulur; arayüzde bunlara dair hiçbir alan, buton veya uyarı yoktur.
 *
 * Bu dosyayı yalnızca site yöneticisi bir kez doldurur. Kullanıcıların
 * yapması gereken tek şey aşağıdaki gibi tek bir ID girmektir:
 *   - cihazın Smart Life "Sanal ID"si  veya
 *   - yöneticinin verdiği "SL1...." tek-ID kurulum kodu
 *
 * İki yöntem de aynı tek input alanına yazılır; uygulama otomatik ayırt eder.
 */

const SITE_PROFILI = {
  // Varsayılan bölge.
  bolge: 'eu',

  // Dahili bağlantı bilgileri (kullanıcıya asla sorulmaz / gösterilmez).
  clientId: '',
  secret: '',

  // Kapı rölesinin varsayılan komutu (kullanıcıya sorulmaz).
  komutKodu: 'switch_1',
  komutDegeri: true,
};

if (typeof window !== 'undefined') window.SITE_PROFILI = SITE_PROFILI;
if (typeof module !== 'undefined' && module.exports) module.exports = SITE_PROFILI;
