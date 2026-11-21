// Builds dos portais: node tools/empacotar.mjs [--alvo=californiagames|y8] [--saida=pasta]
// - californiagames (padrao, PlataformaSDK): monta dist-californiagames/ (index.html com a tag da SDK, src/, o three
//   vendorizado e as licencas) e grava run-run-sahur-californiagames-<versao>.zip + .sha256 em
//   ../jogos/distribuicao/runrunsahur/californiagames/build/. A SDK nunca entra no build: o portal a serve em
//   /sdk/v1/ na origem dos jogos;
// - y8 (SDK 2-0 da Y8): monta dist-y8/ com a tag async do SDK (CDN da Y8, com onerror para seguir sem anuncios),
//   o src/core/plataforma-y8.js no lugar do plataforma.js, com os ids de package.json "portais.y8", e grava
//   runrunsahur-y8-<versao>.zip + .sha256 em ../jogos/distribuicao/runrunsahur/y8/build/.
// Os dois saem sem o atalho do laboratorio e passam pelas conferencias do portal antes do zip.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [k, ...v] = a.slice(2).split('=');
  return [k, v.length ? v.join('=') : true];
}));
const PACOTE = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
const versao = PACOTE.version;
const SDK_Y8 = 'https://cdn.y8.com/minimal-sdk/2-0/y8.min.js';
/** adaptador que so entra na build da Y8 */
const ADAPTADOR_Y8 = 'src/core/plataforma-y8.js';
const ALVOS = {
  californiagames: {
    nome: (/** @type {string} */ v) => `run-run-sahur-californiagames-${v}.zip`,
    dist: 'dist-californiagames',
    saida: '../jogos/distribuicao/runrunsahur/californiagames/build',
    sdk: '/sdk/v1/plataforma-sdk.js',
    tag: '<!-- SDK do portal: servida pela origem de jogos, nunca copiada para o build. -->\n<script src="/sdk/v1/plataforma-sdk.js"></script>\n',
    adaptador: '',
    proibido: null,
  },
  y8: {
    nome: (/** @type {string} */ v) => `runrunsahur-y8-${v}.zip`,
    dist: 'dist-y8',
    saida: '../jogos/distribuicao/runrunsahur/y8/build',
    sdk: SDK_Y8,
    tag: '<!-- SDK da Y8 (async, do CDN deles). Se nao carregar (bloqueador de anuncio), o jogo segue sem anuncios. -->\n'
      + `<script src="${SDK_Y8}" async onerror="window.__sdkFalhou=1;window.dispatchEvent(new Event('y8sdk.falhou'))"></script>\n`,
    adaptador: ADAPTADOR_Y8,
    /** nada de outro portal no build da Y8, nem em comentario */
    proibido: /californiagames|plataforma-?sdk|poki|crazygames/i,
  },
};
const nomeAlvo = String(args.alvo || 'californiagames');
const A = ALVOS[/** @type {keyof typeof ALVOS} */ (nomeAlvo)];
if (!A) {
  process.stderr.write(`alvo desconhecido: ${nomeAlvo} (${Object.keys(ALVOS).join(', ')})\n`);
  process.exit(1);
}
const DIST = join(RAIZ, A.dist);
const SAIDA = resolve(args.saida || join(RAIZ, A.saida));
const THREE_ARQS = ['three.module.js', 'three.core.js', 'LICENSE'];
/** @type {string[]} */
const falhas = [];

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// index.html: a SDK antes do importmap e dos modulos do jogo; sem o atalho do laboratorio
let html = readFileSync(join(RAIZ, 'index.html'), 'utf8');
html = html.replace('<script type="importmap">', `${A.tag}<script type="importmap">`);
html = html.replace(/<a id="bLab"[^>]*>.*?<\/a>\n/, '');
writeFileSync(join(DIST, 'index.html'), html);

// codigo e fontes (o adaptador da Y8 so entra na build da Y8, e no lugar do plataforma.js)
cpSync(join(RAIZ, 'src'), join(DIST, 'src'), {
  recursive: true,
  filter: (o) => !o.endsWith('.DS_Store') && resolve(o) !== resolve(RAIZ, ADAPTADOR_Y8),
});
if (A.adaptador) {
  // ids do painel do portal: package.json "portais.<alvo>"
  const ids = (PACOTE.portais && PACOTE.portais[nomeAlvo]) || {};
  const vazio = 'export const IDS = {};';
  const t = readFileSync(join(RAIZ, A.adaptador), 'utf8');
  if (!ids.appId || !ids.gameId) falhas.push(`package.json sem "portais.${nomeAlvo}" com appId e gameId`);
  if (t.split(vazio).length !== 2) falhas.push(`${A.adaptador} sem "${vazio}" (uma vez) para gravar os ids`);
  const preenchidos = { appId: String(ids.appId || ''), gameId: String(ids.gameId || '') };
  writeFileSync(join(DIST, 'src/core/plataforma.js'), t.replace(vazio, `export const IDS = ${JSON.stringify(preenchidos)};`));
}
// three: so o que o jogo usa
mkdirSync(join(DIST, 'vendor/three'), { recursive: true });
for (const a of THREE_ARQS) cpSync(join(RAIZ, 'vendor/three', a), join(DIST, 'vendor/three', a));
cpSync(join(RAIZ, 'vendor/three/addons'), join(DIST, 'vendor/three/addons'), { recursive: true });
writeFileSync(join(DIST, 'LICENCAS.txt'), readFileSync(join(RAIZ, 'LICENCAS.txt'), 'utf8'));

// ---------------------------------------------------------------- conferencia (regras do portal)
/** @param {string} dir @returns {string[]} */
const listar = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? listar(p) : [p];
});
/** @param {string} t */
const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const arquivos = listar(DIST);
const head = html.slice(0, html.indexOf('</head>'));
if (!head.includes(A.tag)) falhas.push('index.html sem a tag da SDK no <head>');
const iSdk = html.indexOf(A.sdk);
if (iSdk > html.indexOf('type="importmap"') || iSdk > html.indexOf('type="module"')) falhas.push('a SDK deve vir antes dos scripts do jogo');
if (/id="bLab"|laboratorio/.test(html)) falhas.push('index.html com o atalho do laboratorio');
const PROIBIDAS = /\.(php|exe|dll|bat|cmd|sh|py|rb|pl|jar|so|dylib|cgi|map)$/i;
for (const a of arquivos) {
  const r = relative(DIST, a);
  if (PROIBIDAS.test(r)) falhas.push(`extensao proibida: ${r}`);
  if (/(^|\/)\.DS_Store$|__MACOSX/.test(r)) falhas.push(`lixo do macOS: ${r}`);
  if (/plataforma-sdk\.js$/.test(r)) falhas.push(`a SDK nao vai no build: ${r}`);
  if (/\.(js|html|css)$/.test(r) && !r.startsWith('vendor/')) {
    const bruto = readFileSync(a, 'utf8');
    // a tag da SDK do alvo e o unico recurso externo permitido
    const t = semComentarios(bruto).split(A.sdk).join('');
    if (/(?:src|href)\s*=\s*["'](?:https?:)?\/\//i.test(t)) falhas.push(`recurso externo em ${r}`);
    if (/localStorage\.clear\(/.test(t)) falhas.push(`localStorage.clear em ${r}`);
    if (A.proibido) {
      if (/https?:\/\//.test(t)) falhas.push(`URL absoluta em ${r}`);
      if (/<a\s/i.test(t)) falhas.push(`link em ${r}`);
      if (/console\.(log|info|debug)\s*\(/.test(t)) falhas.push(`console.log em ${r}`);
      const marca = bruto.match(A.proibido);
      if (marca) falhas.push(`nome de outro portal em ${r}: ${marca[0]}`);
    }
  }
}
if (A.adaptador) {
  const plat = readFileSync(join(DIST, 'src/core/plataforma.js'), 'utf8');
  if (!/export const IDS = \{"appId":"[0-9a-f]+","gameId":"\d+"\};/.test(plat)) falhas.push('src/core/plataforma.js sem os ids gravados');
}
if (arquivos.some((a) => a.endsWith('plataforma-y8.js'))) falhas.push('plataforma-y8.js sobrou no build');
if (arquivos.length > 5000) falhas.push(`arquivos demais: ${arquivos.length}`);
if (falhas.length) {
  process.stderr.write(`build recusado:\n- ${falhas.join('\n- ')}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------- zip + sha256
mkdirSync(SAIDA, { recursive: true });
const nome = A.nome(versao);
const zip = join(SAIDA, nome);
rmSync(zip, { force: true });
execFileSync('zip', ['-r', '-X', '-q', '-9', zip, '.', '-x', '*.DS_Store'], { cwd: DIST });
const lista = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n');
if (!lista.includes('index.html') || lista.some((n) => /__MACOSX|\.DS_Store/.test(n))) {
  process.stderr.write('zip invalido: sem index.html na raiz ou com lixo do sistema\n');
  process.exit(1);
}
const sha = createHash('sha256').update(readFileSync(zip)).digest('hex');
writeFileSync(join(SAIDA, nome.replace(/\.zip$/, '.sha256')), `${sha}  ${nome}\n`);
const tam = statSync(zip).size;
const bruto = arquivos.reduce((n, a) => n + statSync(a).size, 0);
process.stdout.write(`build ${nomeAlvo} ${versao}: ${arquivos.length} arquivos, ${(bruto / 1024 / 1024).toFixed(2)} MB -> ${(tam / 1024 / 1024).toFixed(2)} MB zipado\n`);
process.stdout.write(`${relative(process.cwd(), zip)}\n${sha}\n`);
