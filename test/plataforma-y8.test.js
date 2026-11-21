// Adaptador da Y8 (src/core/plataforma-y8.js) com um SDK falso: prontidao, ids, idioma, intersticial so com
// anuncio de verdade (pausa e mudo no beforeAd), limite de 180 s, premio so com adViewed e SDK bloqueado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarPlataforma, INTERVALO_MIN } from '../src/core/plataforma-y8.js';

const IDS = { appId: 'a1', gameId: '42' };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** janela falsa com addEventListener (once) e disparar */
function criarJanela(extra = {}) {
  const ouvintes = {};
  return {
    ...extra,
    addEventListener(ev, fn, op) {
      (ouvintes[ev] ||= []).push({ fn, once: !!(op && op.once) });
    },
    disparar(ev) {
      const lista = ouvintes[ev] || [];
      ouvintes[ev] = lista.filter((o) => !o.once);
      for (const o of lista) o.fn();
    },
  };
}

/**
 * SDK falso. modo: 'viu' (mostra e o jogador ve), 'fechou' (mostra e o jogador fecha), 'pulado' (limite de
 * frequencia: so adBreakDone), 'mudo' (nunca responde), 'manual' (guarda o pedido para o teste).
 */
function criarY8(janela, { locale = 'es', modo = 'viu' } = {}) {
  const log = [];
  const f = { log, modo, pedido: /** @type {any} */ (null) };
  const sdk = {
    init: (a, b) => { log.push(`init:${a.appId}:${b && b.gameId}`); return Promise.resolve(); },
    getPlatformLocale: () => Promise.resolve(locale),
    showAd: (p) => {
      log.push(`showAd:${p.type}`);
      f.pedido = p;
      if (f.modo === 'mudo' || f.modo === 'manual') return;
      if (f.modo === 'pulado') { p.adBreakDone({ breakStatus: 'frequencyCapped' }); return; }
      const mostrar = () => {
        p.beforeAd();
        if (p.type === 'reward') {
          if (f.modo === 'viu') p.adViewed();
          else p.adDismissed();
        }
        p.afterAd();
        p.adBreakDone({ breakStatus: f.modo === 'viu' ? 'viewed' : 'dismissed' });
      };
      if (p.type === 'reward') p.beforeReward(mostrar);
      else mostrar();
    },
  };
  janela.y8 = { sdk: () => sdk, emitReadyEvent: () => janela.disparar('y8sdk.ready') };
  return f;
}

test('y8: sem appId o SDK nao inicia, nao ha video e o idioma e ingles', async () => {
  const janela = criarJanela();
  const f = criarY8(janela);
  const p = criarPlataforma('pt-BR', '', { janela, ids: {} });
  await p.iniciado;
  assert.equal(p.portal, false);
  assert.equal(p.anunciosBloqueados(), true);
  assert.equal(await p.recompensado('medium', () => {}), false);
  assert.equal(p.idioma(), 'en');
  assert.deepEqual(f.log, []);
});

test('y8: script bloqueado (onerror da tag) segue na hora, sem anuncios', async () => {
  const ja = criarPlataforma('pt-BR', '', { janela: criarJanela({ __sdkFalhou: 1 }), ids: IDS });
  const t0 = Date.now();
  await ja.iniciado;
  assert.ok(Date.now() - t0 < 200);
  assert.equal(ja.anunciosBloqueados(), true);
  let calou = false;
  await ja.intervalo(() => { calou = true; });
  assert.equal(calou, false);
  // a falha chega depois de o jogo ja esperar
  const janela = criarJanela();
  const depois = criarPlataforma('pt-BR', '', { janela, ids: IDS });
  const t1 = Date.now();
  setTimeout(() => janela.disparar('y8sdk.falhou'), 20);
  await depois.iniciado;
  assert.ok(Date.now() - t1 < 500);
  assert.equal(depois.anunciosBloqueados(), true);
  assert.equal(depois.idioma(), 'en');
});

test('y8: init com appId e gameId, idioma do getPlatformLocale e pausa no blur', async () => {
  const janela = criarJanela();
  const f = criarY8(janela, { locale: 'pt_BR' });
  const p = criarPlataforma('en-US', '', { janela, ids: IDS });
  await p.iniciado;
  assert.deepEqual(f.log, ['init:a1:42']);
  assert.equal(p.portal, true);
  assert.equal(p.idioma(), 'pt-BR');
  assert.equal(p.pausaNoBlur, true);
  assert.equal(p.anunciosBloqueados(), false);
  // idioma que o jogo nao tem: ingles; ?lang= dos testes manda
  const j2 = criarJanela();
  criarY8(j2, { locale: 'fr' });
  const q = criarPlataforma('pt-BR', '', { janela: j2, ids: IDS });
  await q.iniciado;
  assert.equal(q.idioma(), 'en');
  assert.equal(criarPlataforma('en', 'es', { janela: criarJanela(), ids: {} }).idioma(), 'es');
});

test('y8: o SDK que chega depois do modulo (evento y8sdk.ready) tambem liga', async () => {
  const janela = criarJanela();
  const p = criarPlataforma('en', '', { janela, ids: IDS });
  const f = criarY8(janela);
  setTimeout(() => janela.disparar('y8sdk.ready'), 20);
  await p.iniciado;
  assert.deepEqual(f.log, ['init:a1:42']);
  assert.equal(p.idioma(), 'es');
});

test('y8: intersticial cala so no beforeAd; pulado nao cala nem gasta o limite; 180 s entre anuncios', async () => {
  const janela = criarJanela();
  const f = criarY8(janela, { modo: 'pulado' });
  let agora = 0;
  const p = criarPlataforma('en', '', { janela, ids: IDS, relogio: () => agora });
  await p.iniciado;
  let calou = 0;
  const aoComecar = () => { calou++; };
  const pedidos = () => f.log.filter((x) => x === 'showAd:next').length;
  agora = INTERVALO_MIN - 1;
  await p.intervalo(aoComecar);
  assert.equal(pedidos(), 0, 'nos primeiros 180 s do jogo (o pre-roll da Y8 conta) nao pede');
  agora = INTERVALO_MIN;
  await p.intervalo(aoComecar);
  assert.equal(pedidos(), 1);
  assert.equal(calou, 0, 'break pulado pelo limite de frequencia nao pausa nem cala');
  f.modo = 'viu';
  agora = INTERVALO_MIN + 1000;
  await p.intervalo(aoComecar);
  assert.equal(pedidos(), 2, 'o pulado nao gastou o limite');
  assert.equal(calou, 1);
  agora = INTERVALO_MIN + 1000 + INTERVALO_MIN - 1;
  await p.intervalo(aoComecar);
  assert.equal(pedidos(), 2, 'antes de 180 s do anterior nao pede outro');
  agora = INTERVALO_MIN + 1000 + INTERVALO_MIN;
  await p.intervalo(aoComecar);
  assert.equal(pedidos(), 3);
  assert.equal(calou, 2);
});

test('y8: o jogo so volta no afterAd; clique repetido espera o mesmo break', async () => {
  const janela = criarJanela();
  const f = criarY8(janela, { modo: 'manual' });
  let agora = 0;
  const p = criarPlataforma('en', '', { janela, ids: IDS, relogio: () => agora });
  await p.iniciado;
  agora = INTERVALO_MIN;
  let calou = 0;
  let voltou = 0;
  const um = p.intervalo(() => { calou++; }).then(() => { voltou++; });
  const dois = p.intervalo(() => { calou++; }).then(() => { voltou++; });
  await espera(10);
  assert.equal(f.log.filter((x) => x === 'showAd:next').length, 1);
  f.pedido.beforeAd();
  await espera(10);
  assert.equal(calou, 1);
  assert.equal(voltou, 0, 'durante o anuncio o jogo espera');
  f.pedido.afterAd();
  await Promise.all([um, dois]);
  assert.equal(voltou, 2);
  f.pedido.adBreakDone({ breakStatus: 'viewed' });
});

test('y8: premio so com adViewed', async () => {
  const janela = criarJanela();
  const f = criarY8(janela, { modo: 'viu' });
  const p = criarPlataforma('en', '', { janela, ids: IDS });
  await p.iniciado;
  let calou = 0;
  assert.equal(await p.recompensado('medium', () => { calou++; }), true);
  assert.equal(calou, 1);
  f.modo = 'fechou';
  assert.equal(await p.recompensado('medium', () => { calou++; }), false, 'fechou o video: sem premio');
  f.modo = 'pulado';
  assert.equal(await p.recompensado('medium', () => { calou++; }), false, 'sem anuncio: sem premio');
  assert.equal(calou, 2);
  assert.deepEqual(f.log.filter((x) => x.startsWith('showAd')), ['showAd:reward', 'showAd:reward', 'showAd:reward']);
});

test('y8: SDK que nao responde nao prende o jogo; anuncio atrasado pausa e cala pelo canal do portal', async () => {
  const janela = criarJanela();
  const f = criarY8(janela, { modo: 'mudo' });
  let agora = 0;
  const p = criarPlataforma('en', '', { janela, ids: IDS, relogio: () => agora, prazos: { next: 30, reward: 30 } });
  await p.iniciado;
  agora = INTERVALO_MIN;
  const sinais = [];
  for (const ev of /** @type {const} */ (['pause', 'resume', 'mute', 'unmute'])) p.on(ev, () => sinais.push(ev));
  let calou = 0;
  const t0 = Date.now();
  await p.intervalo(() => { calou++; });
  assert.ok(Date.now() - t0 < 300);
  const atrasado = f.pedido;
  assert.equal(atrasado.type, 'next');
  assert.equal(await p.recompensado('medium', () => { calou++; }), false);
  // o intersticial comeca depois do prazo: o jogo ja seguiu
  atrasado.beforeAd();
  assert.deepEqual(sinais, ['pause', 'mute']);
  atrasado.afterAd();
  atrasado.adBreakDone({ breakStatus: 'viewed' });
  assert.deepEqual(sinais, ['pause', 'mute', 'resume', 'unmute']);
  assert.equal(calou, 0);
});
