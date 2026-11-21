// Prova da build da Y8 num Chrome headless (CDP), com o zip extraido servido numa porta local livre.
//  a) SDK bloqueado (--host-resolver-rules MAP cdn.y8.com 127.0.0.1:9, como um bloqueador de anuncio): o jogo
//     carrega, um toque comeca a corrida, o botao de video some, "Correr de novo" segue na hora, console limpo;
//     e com o pedido ao SDK segurado 1,5 s e recusado (ERR_BLOCKED_BY_CLIENT), o jogo segue no evento da falha,
//     sem esperar o prazo do adaptador;
//  b) SDK falso no lugar do script da Y8 (o Fetch do CDP responde o pedido ao CDN; o dominio continua mapeado
//     para lugar nenhum): init com os ids, idioma do getPlatformLocale, nada de anuncio na corrida nem no fim,
//     pausa no blur, intersticial so depois do clique num botao da tela de fim, pausa e mudo so no beforeAd,
//     premio so com adViewed e no maximo um intersticial a cada 180 s, contados desde o inicio (o teste adianta o
//     relogio da pagina para simular os 3 minutos).
// Uso: node tools/provar-y8.mjs [--zip=caminho]   (padrao: o zip da versao atual em
//      ../jogos/distribuicao/runrunsahur/y8/build/). Sai com codigo 1 se algum item falhar.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { RAIZ } from './servir.mjs';
import { abrirChrome, espera } from './cdp.mjs';

const PACOTE = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
const IDS = PACOTE.portais.y8;
const SDK = 'https://cdn.y8.com/minimal-sdk/2-0/y8.min.js';
const BLOQUEIO = '--host-resolver-rules=MAP cdn.y8.com 127.0.0.1:9';
const argZip = process.argv.find((a) => a.startsWith('--zip='));
const ZIP = resolve(argZip ? argZip.slice(6) : join(RAIZ, `../jogos/distribuicao/runrunsahur/y8/build/runrunsahur-y8-${PACOTE.version}.zip`));

/** primeira porta livre a partir de p @param {number} p @returns {Promise<number>} */
const portaLivre = (p) => new Promise((ok) => {
  const s = createServer();
  s.once('error', () => ok(portaLivre(p + 1)));
  s.listen(p, '127.0.0.1', () => s.close(() => ok(p)));
});

let falhou = 0;
/** @param {unknown} cond @param {string} msg */
const conferir = (cond, msg) => {
  if (!cond) falhou++;
  process.stdout.write(`  ${cond ? 'ok   ' : 'FALHA'} ${msg}\n`);
};

/** clique de verdade (mouse do CDP) no centro do elemento @param {any} ch @param {string} sel */
async function clicar(ch, sel) {
  const [x, y] = await ch.avaliar(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  await ch.cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await ch.cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await ch.cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}
/** tecla de verdade @param {any} ch @param {string} key @param {number} cod */
async function tecla(ch, key, cod) {
  await ch.cdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code: key, windowsVirtualKeyCode: cod, nativeVirtualKeyCode: cod });
  await ch.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: cod, nativeVirtualKeyCode: cod });
}
/**
 * O chefe alcanca o Sahur (fim natural da corrida) e espera a tela de fim. O prazo e longo porque o SwiftShader
 * as vezes trava alguns segundos num quadro (shader novo). @param {any} ch
 */
async function morrer(ch) {
  for (const fim = Date.now() + 60000; Date.now() < fim;) {
    const e = await ch.avaliar('__rrs.estado');
    if (e === 'fim') return true;
    if (e === 'jogando') await ch.avaliar('(__rrs.P.perseguidor.dist = 0.5, 1)');
    await espera(200);
  }
  return false;
}
/**
 * Marca no proprio navegador quando o SDK falha (ouvinte de captura: o evento sai do <script>), quando o
 * adaptador libera a carga (o main.js troca o <html lang> logo depois do await plataforma.iniciado) e quando o
 * jogo fica pronto (window.__rrs).
 */
const MARCAS = `addEventListener('y8sdk.falhou', function () { window.__tFalha = performance.now(); }, true);
new MutationObserver(function () { if (!window.__tIdioma) window.__tIdioma = performance.now(); })
  .observe(document, { attributes: true, attributeFilter: ['lang'], subtree: true });
Object.defineProperty(window, '__rrs', { configurable: true, set: function (v) {
  Object.defineProperty(window, '__rrs', { value: v, writable: true, configurable: true });
  window.__tPronto = performance.now();
} });`;
/** relogio da pagina que o teste adianta (__avancar(ms)), para simular os 3 minutos entre intersticiais */
const RELOGIO = `(function () {
  var orig = performance.now.bind(performance), extra = 0;
  performance.now = function () { return orig() + extra; };
  window.__avancar = function (ms) { extra += ms; };
})();`;
const TEMPOS = '[window.__tFalha, window.__tIdioma, window.__tPronto].map(Math.round)';
/** erros do proprio navegador (rede), fora o favicon do servidor local @param {any} ch */
const errosRede = (ch) => ch.registros.filter((r) => /^\[\w+ error\]/.test(r) && !r.includes('favicon.ico'));
/** @param {string} sel */
const visivel = (sel) => `!document.querySelector(${JSON.stringify(sel)}).hidden`;
const pronto = '!!(window.__rrs && __rrs.pronto && __rrs.estado === "inicio")';

// ------------------------------------------------------------------------------------
const pasta = mkdtempSync(join(tmpdir(), 'rrs-y8-'));
execFileSync('unzip', ['-q', ZIP, '-d', pasta]);
process.stdout.write(`build: ${ZIP}\nservida de: ${pasta}\n`);

// ------------------------------------------------------------------------------------ a) SDK bloqueado
{
  process.stdout.write('\na) SDK bloqueado (bloqueador de anuncio)\n');
  const porta = await portaLivre(5431);
  const ch = await abrirChrome({ porta, portaDep: await portaLivre(9431), raiz: pasta, extras: [BLOQUEIO] });
  await ch.cdp('Page.addScriptToEvaluateOnNewDocument', { source: MARCAS });
  await ch.ir('/index.html');
  const carregou = await ch.ate(pronto, 30000);
  const [tFalha, tIdioma, tPronto] = await ch.avaliar(TEMPOS);
  conferir(await ch.avaliar('window.__sdkFalhou === 1') && tFalha > 0 && tFalha < 2000, `o onerror da tag do SDK avisou a falha aos ${tFalha} ms`);
  conferir(tIdioma > 0 && tIdioma - tFalha < 2000, `o adaptador liberou a carga aos ${tIdioma} ms`);
  conferir(carregou && tPronto < 15000, `o jogo ficou pronto aos ${tPronto} ms da navegacao (Chrome headless com SwiftShader, sem GPU)`);
  conferir(await ch.avaliar('__rrs.idioma') === 'en', `idioma sem SDK: ${await ch.avaliar('__rrs.idioma')} (padrao ingles)`);
  await espera(800);
  await ch.cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: 640, y: 330, button: 'left', clickCount: 1 });
  await ch.cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 640, y: 330, button: 'left', clickCount: 1 });
  conferir(await ch.ate('__rrs.estado === "jogando"', 5000), 'um toque na tela comecou a corrida');
  conferir(await ch.ate('__rrs.P.t > 1', 20000), `a corrida anda (t = ${(await ch.avaliar('__rrs.P.t')).toFixed(1)} s de jogo)`);
  conferir(await morrer(ch), 'fim da corrida (pego pelo chefe)');
  conferir(await ch.avaliar('document.getElementById("bContinuar").hidden'), 'sem SDK, o botao "Continue" (video) fica escondido');
  await clicar(ch, '#bDeNovo');
  conferir(await ch.ate('__rrs.estado === "jogando"', 2000), '"Run again" sem SDK recomeca na hora');
  conferir(ch.erros.length === 0, `console sem erro do jogo${ch.erros.length ? `: ${ch.erros.join(' | ')}` : ''}`);
  const rede = errosRede(ch);
  conferir(rede.length === 1 && rede[0].includes(SDK), `so a falha esperada do SDK na rede: ${rede.join(' | ')}`);
  const outros = ch.externos.filter((u) => u !== SDK);
  conferir(outros.length === 0, `nenhum pedido externo alem do SDK${outros.length ? `: ${outros.join(' ')}` : ''}`);

  // o bloqueio chega depois de o jogo comecar a esperar o SDK: segue no evento, sem o prazo de 4 s
  ch.ouvir('Fetch.requestPaused', (p) => {
    setTimeout(() => ch.cdp('Fetch.failRequest', { requestId: p.requestId, errorReason: 'BlockedByClient' }), 1500);
  });
  await ch.cdp('Fetch.enable', { patterns: [{ urlPattern: '*://cdn.y8.com/*', requestStage: 'Request' }] });
  await ch.ir('/index.html?novo');
  await ch.ate(pronto, 30000);
  const [f2, i2, p2] = await ch.avaliar(TEMPOS);
  conferir(f2 > 1400 && i2 - f2 < 300, `SDK recusado aos ${f2} ms: o jogo seguiu ${i2 - f2} ms depois (pronto aos ${p2} ms)`);
  conferir(ch.erros.length === 0, 'console sem erro do jogo');
  await ch.sair();
}

// ------------------------------------------------------------------------------------ b) SDK falso
const FALSO = `(function () {
  var f = window.__y8falso = { log: [], modo: 'manual', pedido: null, ultimoClique: null };
  var t = function () { return Math.round(performance.now()); };
  var sdk = {
    init: function (a, b) { f.log.push({ ev: 'init', appId: a && a.appId, gameId: b && b.gameId, t: t() }); return Promise.resolve(); },
    getPlatformLocale: function () { return Promise.resolve('es'); },
    showAd: function (p) {
      f.log.push({ ev: 'showAd', type: p.type, t: t(), estado: window.__rrs && window.__rrs.estado, clique: f.ultimoClique });
      f.pedido = p;
      if (f.modo === 'pular') p.adBreakDone({ breakStatus: 'frequencyCapped' });
    }
  };
  window.y8 = { sdk: function () { return sdk; }, emitReadyEvent: function () { dispatchEvent(new Event('y8sdk.ready')); } };
  addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('button') : null;
    f.ultimoClique = { id: b ? b.id : '', t: t(), confiavel: e.isTrusted };
  }, true);
  dispatchEvent(new Event('y8sdk.ready'));
})();`;
{
  process.stdout.write('\nb) SDK falso da Y8\n');
  const porta = await portaLivre(5441);
  const ch = await abrirChrome({ porta, portaDep: await portaLivre(9441), raiz: pasta, extras: [BLOQUEIO] });
  ch.ouvir('Fetch.requestPaused', (p) => {
    if (p.request.url === SDK) {
      ch.cdp('Fetch.fulfillRequest', {
        requestId: p.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'text/javascript' }, { name: 'Access-Control-Allow-Origin', value: '*' }],
        body: Buffer.from(FALSO).toString('base64'),
      });
    } else ch.cdp('Fetch.failRequest', { requestId: p.requestId, errorReason: 'BlockedByClient' });
  });
  await ch.cdp('Fetch.enable', { patterns: [{ urlPattern: '*://cdn.y8.com/*', requestStage: 'Request' }] });
  await ch.cdp('Page.addScriptToEvaluateOnNewDocument', { source: MARCAS + RELOGIO });
  await ch.ir('/index.html');
  conferir(await ch.ate(pronto, 30000), `o jogo ficou pronto com o SDK aos ${await ch.avaliar('Math.round(window.__tPronto)')} ms`);
  const log = async () => /** @type {any[]} */ (await ch.avaliar('__y8falso.log'));
  const anuncios = async () => (await log()).filter((x) => x.ev === 'showAd');
  const init = (await log()).filter((x) => x.ev === 'init');
  conferir(init.length === 1 && init[0].appId === IDS.appId && init[0].gameId === IDS.gameId,
    `init recebeu os ids do painel: ${JSON.stringify(init.map((x) => ({ appId: x.appId, gameId: x.gameId })))}`);
  conferir(await ch.avaliar('__rrs.idioma') === 'es', `idioma do getPlatformLocale ('es'): ${await ch.avaliar('__rrs.idioma')}`);
  await espera(800);
  await tecla(ch, 'ArrowUp', 38);
  conferir(await ch.ate('__rrs.estado === "jogando"', 5000), 'uma tecla comecou a corrida');
  await espera(2000);
  // perder o foco abre a pausa
  await ch.avaliar('(window.dispatchEvent(new Event("blur")), 1)');
  conferir(await ch.ate(`__rrs.pausado && ${visivel('#pausa')}`, 2000), 'perder o foco (blur) abriu a pausa da corrida');
  await clicar(ch, '#bVoltar');
  conferir(await ch.ate('!__rrs.pausado && __rrs.estado === "jogando"', 2000), '"Resume" volta a corrida');
  await espera(1000);
  conferir((await anuncios()).length === 0, 'nenhum anuncio pedido durante a corrida');
  conferir(await morrer(ch), 'fim da corrida');
  await espera(2500);
  conferir((await anuncios()).length === 0, 'nenhum anuncio automatico na tela de fim');
  conferir(await ch.avaliar(visivel('#bContinuar')), 'com SDK, o botao "Continue" (video) aparece');

  // premiado fechado antes do fim: sem premio
  await clicar(ch, '#bContinuar');
  conferir(await ch.ate('__y8falso.pedido && __y8falso.pedido.type === "reward"', 2000), 'clique em "Continue" pediu showAd reward');
  await ch.avaliar('(__y8falso.pedido.beforeReward(function () { __y8falso.mostrou = true; }), 1)');
  conferir(await ch.avaliar('__y8falso.mostrou === true'), 'o jogo aceitou o video no beforeReward');
  conferir(await ch.avaliar('!__rrs.pausado && !__rrs.calado'), 'antes do beforeAd o jogo nao pausa nem cala');
  await ch.avaliar('(__y8falso.pedido.beforeAd(), 1)');
  conferir(await ch.ate('__rrs.pausado && __rrs.calado', 1000), 'beforeAd (premiado): jogo pausado e mudo');
  await ch.avaliar('(__y8falso.pedido.adDismissed(), __y8falso.pedido.afterAd(), __y8falso.pedido.adBreakDone({ breakStatus: "dismissed" }), 1)');
  await espera(800);
  conferir(await ch.avaliar('__rrs.estado === "fim" && __rrs.P.revividas === 0'), 'video fechado (sem adViewed): sem premio, continua na tela de fim');
  conferir(await ch.avaliar('!__rrs.pausado && !__rrs.calado'), 'depois do anuncio o jogo volta a tocar');

  // premiado visto: continua a corrida
  await ch.avaliar('(__y8falso.pedido = null, 1)');
  await clicar(ch, '#bContinuar');
  conferir(await ch.ate('__y8falso.pedido && __y8falso.pedido.type === "reward"', 2000), 'novo clique em "Continue" pediu outro reward');
  await ch.avaliar('(__y8falso.pedido.beforeReward(function () {}), __y8falso.pedido.beforeAd(), 1)');
  conferir(await ch.ate('__rrs.pausado && __rrs.calado', 1000), 'beforeAd: pausado e mudo');
  await ch.avaliar('(__y8falso.pedido.adViewed(), __y8falso.pedido.afterAd(), __y8falso.pedido.adBreakDone({ breakStatus: "viewed" }), 1)');
  conferir(await ch.ate('__rrs.estado === "jogando" && __rrs.P.revividas === 1 && !__rrs.pausado && !__rrs.calado', 3000),
    'adViewed: o premio saiu (a corrida continuou) e o som voltou');

  // os primeiros 180 s do jogo contam como intervalo (a Y8 mostra o proprio pre-roll): nada de intersticial
  conferir(await morrer(ch), 'fim da corrida');
  conferir(await ch.avaliar('document.getElementById("bContinuar").hidden'), '"Continue" so uma vez por corrida');
  await ch.avaliar('(__y8falso.pedido = null, 1)');
  await clicar(ch, '#bDeNovo');
  conferir(await ch.ate('__rrs.estado === "jogando"', 3000), '"Run again" nos primeiros 180 s recomeca sem anuncio');
  conferir(await ch.avaliar('__y8falso.pedido === null'), 'nenhum intersticial nos primeiros 180 s (o pre-roll da Y8 conta)');

  // passam 3 minutos (o teste adianta o relogio da pagina). Intersticial pulado pelo SDK: nao pausa e segue
  await ch.avaliar('(__avancar(181000), 1)');
  conferir(await morrer(ch), 'fim da corrida (3 min depois)');
  await ch.avaliar('(__y8falso.modo = "pular", __y8falso.pedido = null, 1)');
  await espera(1500);
  conferir((await anuncios()).filter((x) => x.type === 'next').length === 0, 'nenhum intersticial antes do clique');
  await clicar(ch, '#bDeNovo');
  conferir(await ch.ate('__y8falso.pedido && __y8falso.pedido.type === "next"', 2000), 'clique em "Run again" pediu showAd next');
  conferir(await ch.ate('__rrs.estado === "jogando"', 3000), 'break pulado (frequencyCapped): a corrida segue na hora');
  conferir(await ch.avaliar('!__rrs.pausado && !__rrs.calado'), 'break pulado nao pausou nem calou');

  // intersticial de verdade (o pulado nao gastou o limite)
  conferir(await morrer(ch), 'fim da corrida');
  await ch.avaliar('(__y8falso.modo = "manual", __y8falso.pedido = null, 1)');
  await espera(1500);
  const antes = (await anuncios()).filter((x) => x.type === 'next').length;
  await clicar(ch, '#bDeNovo');
  conferir(await ch.ate('__y8falso.pedido && __y8falso.pedido.type === "next"', 2000), 'clique em "Run again" pediu showAd next de novo');
  conferir((await anuncios()).filter((x) => x.type === 'next').length === antes + 1, 'um pedido por clique');
  conferir(await ch.avaliar('!__rrs.pausado && !__rrs.calado'), 'antes do beforeAd o jogo nao pausa nem cala');
  await ch.avaliar('(__y8falso.pedido.beforeAd(), 1)');
  conferir(await ch.ate('__rrs.pausado && __rrs.calado && __rrs.estado === "fim"', 1000), 'beforeAd (intersticial): pausado, mudo e a corrida espera');
  await espera(1000);
  conferir(await ch.avaliar('__rrs.estado === "fim"'), 'durante o anuncio a corrida nao comeca');
  await ch.avaliar('(__y8falso.pedido.afterAd(), __y8falso.pedido.adBreakDone({ breakStatus: "viewed" }), 1)');
  conferir(await ch.ate('__rrs.estado === "jogando" && !__rrs.pausado && !__rrs.calado', 3000), 'afterAd/adBreakDone: a corrida comecou com som');

  // limite de 180 s: os proximos cliques nao pedem outro
  conferir(await morrer(ch), 'fim da corrida');
  await ch.avaliar('(__y8falso.pedido = null, 1)');
  await clicar(ch, '#bDeNovo');
  conferir(await ch.ate('__rrs.estado === "jogando"', 3000), '"Run again" logo depois de um intersticial segue sem anuncio');
  conferir(await morrer(ch), 'fim da corrida');
  await clicar(ch, '#bMapa');
  conferir(await ch.ate('__rrs.estado === "inicio"', 3000), '"Change map" volta ao inicio');
  conferir(await ch.avaliar('__y8falso.pedido === null'), 'nenhum intersticial antes de 180 s do anterior');

  // mais 3 minutos: "Change map" tambem e ponto de intervalo
  await ch.avaliar('(__avancar(181000), 1)');
  await tecla(ch, 'ArrowUp', 38);
  conferir(await ch.ate('__rrs.estado === "jogando"', 5000), 'nova corrida');
  conferir(await morrer(ch), 'fim da corrida');
  await clicar(ch, '#bMapa');
  conferir(await ch.ate('__y8falso.pedido && __y8falso.pedido.type === "next"', 2000), 'clique em "Change map" pediu showAd next');
  await ch.avaliar('(__y8falso.pedido.beforeAd(), 1)');
  conferir(await ch.ate('__rrs.pausado && __rrs.calado', 1000), 'beforeAd: pausado e mudo');
  await ch.avaliar('(__y8falso.pedido.afterAd(), __y8falso.pedido.adBreakDone({ breakStatus: "viewed" }), 1)');
  conferir(await ch.ate('__rrs.estado === "inicio" && !__rrs.pausado && !__rrs.calado', 3000), 'depois do anuncio, a escolha do mapa com som');

  const todos = await anuncios();
  const semClique = todos.filter((x) => !x.clique || !x.clique.confiavel || !['bDeNovo', 'bMapa', 'bContinuar'].includes(x.clique.id) || x.t - x.clique.t > 300 || x.estado !== 'fim');
  conferir(todos.length === 5 && semClique.length === 0,
    `todos os ${todos.length} pedidos sairam ate 300 ms depois de um clique de verdade num botao da tela de fim: ${todos.map((x) => `${x.type}<-${x.clique && x.clique.id}+${x.t - x.clique.t}ms`).join(', ')}`);
  conferir(ch.erros.length === 0, `console sem erro${ch.erros.length ? `: ${ch.erros.join(' | ')}` : ''}`);
  conferir(errosRede(ch).length === 0, `nenhum erro de rede${errosRede(ch).length ? `: ${errosRede(ch).join(' | ')}` : ''}`);
  const outros = ch.externos.filter((u) => u !== SDK);
  conferir(outros.length === 0, `nenhum pedido externo alem do SDK${outros.length ? `: ${outros.join(' ')}` : ''}`);
  await ch.sair();
}

rmSync(pasta, { recursive: true, force: true });
process.stdout.write(falhou ? `\n${falhou} item(ns) falharam\n` : '\ntudo certo\n');
process.exit(falhou ? 1 : 0);
