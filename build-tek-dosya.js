/** Uygulamayı tek bir HTML dosyasına package'ler: harici dosya/yok, kurulum yok. */
const fs = require('fs');
const path = require('path');

const klasor = __dirname;
const parcalar = [
  'uygulama/baglanti-profili.js',
  'uygulama/smartLifeBaglantisi.js',
  'uygulama/kapiMotoru.js',
];

let html = fs.readFileSync(path.join(klasor, 'uygulama/index.html'), 'utf8');
const css = fs.readFileSync(path.join(klasor, 'uygulama/stil.css'), 'utf8');

html = html.replace('<link rel="manifest" href="manifest.json" />', '');
html = html.replace('<link rel="stylesheet" href="stil.css" />', `<style>\n${css}\n</style>`);
for (const parca of parcalar) {
  const kod = fs.readFileSync(path.join(klasor, parca), 'utf8');
  const etiket = `<script src="${path.basename(parca)}"></script>`;
  if (!html.includes(etiket)) throw new Error('Script etiketi bulunamadı: ' + etiket);
  html = html.replace(etiket, `<script>\n${kod}\n</script>`);
}

if (html.includes('<script src=') || html.includes('<link rel="stylesheet"')) {
  throw new Error('Tek dosya derlemesinde harici bağımlılık kaldı.');
}

fs.writeFileSync(path.join(klasor, 'Site_Kapisi_Otomasyonu.html'), html, 'utf8');
console.log('Tek dosya üretildi: Site_Kapisi_Otomasyonu.html (' + html.length + ' karakter)');
