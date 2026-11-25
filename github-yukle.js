/**
 * GitHub REST API ile repoyu günceller — git / gh CLI gerektirmez.
 * Token: GITHUB_TOKEN ortam değişkeni veya repo kökündeki .gh-token dosyası.
 */
const fs = require('fs');
const path = require('path');

const KOK = __dirname;
const token = (process.env.GITHUB_TOKEN || '').trim() ||
  (fs.existsSync(path.join(KOK, '.gh-token')) ? fs.readFileSync(path.join(KOK, '.gh-token'), 'utf8').trim() : '');

if (!token) {
  console.error('HATA: GITHUB_TOKEN veya .gh-token dosyası gerekli.');
  process.exit(1);
}

const REPO = 'bsencan3840-svg/site-kapisi-otomasyonu';
const DAL = 'main';
const API = 'https://api.github.com';

async function istek(yol, yontem = 'GET', govde) {
  const yanit = await fetch(API + yol, {
    method: yontem,
    headers: {
      'User-Agent': 'site-kapisi-yukleme',
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: govde ? JSON.stringify(govde) : undefined,
  });
  const metin = await yanit.text();
  let json;
  try { json = JSON.parse(metin); } catch { json = metin; }
  if (!yanit.ok) {
    throw new Error(`${yontem} ${yol} -> HTTP ${yanit.status}: ${JSON.stringify(json).slice(0, 600)}`);
  }
  return json;
}

// Repoya yüklenecek dosyalar (ikili dosya yok, hepsi metin).
const DOSYALAR = [
  '.gitignore',
  '.vercelignore',
  'BENI_OKU.md',
  'YONETICI.md',
  'Site_Kapisi_Otomasyonu.html',
  'baslat.bat',
  'build-tek-dosya.js',
  'build-vercel.js',
  'capacitor.config.json',
  'github-yukle.js',
  'id-olustur.js',
  'package.json',
  'site-profili.json',
  'sunucu.js',
  'vercel.json',
  'api/kapi-ac.js',
  'test/tek-id-test.js',
  'uygulama/baglanti-profili.js',
  'uygulama/ikon.svg',
  'uygulama/index.html',
  'uygulama/kapiMotoru.js',
  'uygulama/manifest.json',
  'uygulama/smartLifeBaglantisi.js',
  'uygulama/stil.css',
];

const SILINENLER = ['uygulama/tuyaBaglantisi.js'];

(async () => {
  console.log('GitHub kimliği doğrulanıyor...');
  const kullanici = await istek('/user');
  console.log('Kullanıcı:', kullanici.login);

  const ref = await istek(`/repos/${REPO}/git/ref/heads/${DAL}`);
  const parentSha = ref.object.sha;
  const mevcutCommit = await istek(`/repos/${REPO}/git/commits/${parentSha}`);
  const baseTree = mevcutCommit.tree.sha;
  const mevcutAgac = await istek(`/repos/${REPO}/git/trees/${baseTree}?recursive=1`);
  const mevcutYollar = new Set((mevcutAgac.tree || []).filter((x) => x.type === 'blob').map((x) => x.path));

  const agac = [];
  for (const dosya of DOSYALAR) {
    const icerik = fs.readFileSync(path.join(KOK, dosya), 'utf8');
    const blob = await istek(`/repos/${REPO}/git/blobs`, 'POST', { content: icerik, encoding: 'utf-8' });
    agac.push({ path: dosya, mode: '100644', type: 'blob', sha: blob.sha });
    console.log('  + ' + dosya);
  }
  for (const dosya of SILINENLER) {
    if (mevcutYollar.has(dosya)) {
      agac.push({ path: dosya, mode: '100644', type: 'blob', sha: null });
      console.log('  - ' + dosya);
    }
  }

  const yeniAgac = await istek(`/repos/${REPO}/git/trees`, 'POST', { base_tree: baseTree, tree: agac });
  const yeniCommit = await istek(`/repos/${REPO}/git/commits`, 'POST', {
    message: '2 metre tolerans, yeni arayüz tasarımı ve tek Smart Life ID akışı',
    parents: [parentSha],
    tree: yeniAgac.sha,
  });
  await istek(`/repos/${REPO}/git/refs/heads/${DAL}`, 'PATCH', { sha: yeniCommit.sha, force: false });

  console.log('\n✓ GitHub repoya yüklendi.');
  console.log('  Commit: ' + yeniCommit.sha);
  console.log('  Adres : https://github.com/' + REPO);
})().catch((hata) => {
  console.error('\nHATA:', hata.message);
  process.exit(1);
});
