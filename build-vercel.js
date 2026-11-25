/** Vercel Build Output API — harici kurulum gerektirmeyen hazır çıktı üretir. */
const fs = require('fs');
const path = require('path');

const kok = __dirname;
const cikti = path.join(kok, '.vercel', 'output');

function temizle(dizin) {
  fs.rmSync(dizin, { recursive: true, force: true });
  fs.mkdirSync(dizin, { recursive: true });
}

function kopyala(kaynak, hedef) {
  fs.mkdirSync(path.dirname(hedef), { recursive: true });
  fs.copyFileSync(kaynak, hedef);
}

temizle(cikti);

// Statik uygulama
const statik = path.join(cikti, 'static');
for (const dosya of fs.readdirSync(path.join(kok, 'uygulama'))) {
  const kaynak = path.join(kok, 'uygulama', dosya);
  if (fs.statSync(kaynak).isFile()) kopyala(kaynak, path.join(statik, dosya));
}

// Serverless function: yalnızca tek-ID köprüsü
const fn = path.join(cikti, 'functions', 'api', 'kapi-ac.func');
fs.mkdirSync(fn, { recursive: true });

const handler = fs.readFileSync(path.join(kok, 'api', 'kapi-ac.js'), 'utf8')
  .replace("require('../uygulama/smartLifeBaglantisi.js')", "require('./smartLifeBaglantisi.js')")
  .replace("require('../site-profili.json')", "require('./site-profili.json')");
fs.writeFileSync(path.join(fn, 'index.js'), handler, 'utf8');

kopyala(path.join(kok, 'uygulama', 'smartLifeBaglantisi.js'), path.join(fn, 'smartLifeBaglantisi.js'));
kopyala(path.join(kok, 'site-profili.json'), path.join(fn, 'site-profili.json'));

fs.writeFileSync(path.join(fn, '.vc-config.json'), JSON.stringify({
  runtime: 'nodejs22.x',
  handler: 'index.js',
  maxDuration: 10,
}, null, 2));

fs.writeFileSync(path.join(cikti, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    { src: '/api/kapi-ac', dest: '/api/kapi-ac' },
    { handle: 'filesystem' },
  ],
}, null, 2));

console.log('Vercel çıktısı hazır: .vercel/output');
