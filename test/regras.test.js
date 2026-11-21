// Regras da partida: trombada desacelera e o chefe chega perto; correndo limpo ele fica para tras;
// ima, reviver e velocidade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarPartida, passo, reviver, velocidadeEm, VEL_INICIAL, VEL_MAXIMA, DIST_MAX, CHOQUE } from '../src/jogo/regras.js';
import { FORMAS } from '../src/jogo/pista.js';

let id = 9000;
const obs = (forma, faixa, z, extra = {}) => ({
  id: id++, tipo: 'obs', forma, faixa, z, c: FORMAS[forma].c, y0: FORMAS[forma].y0, y1: FORMAS[forma].y1, quebravel: forma === 'quebravel',
  rampa: false, vel: 0, ativo: false, quebrado: false, derrubado: false, serra: false, variante: 0, ...extra,
});

/** Partida sem pista gerada (so o que o teste poe), com o chefe longe. */
function vazia(cenario = 'vila') {
  const P = criarPartida({ semente: 1, cenario });
  P.pista.ents = [];
  P.pista.fim = 1e9;
  P.perseguidor.dist = DIST_MAX;
  return P;
}
const correrAte = (P, z, emit = () => {}) => {
  for (let i = 0; i < 6000 && P.d < z && !P.fim; i++) passo(P, 1 / 60, {}, emit);
};

test('a velocidade sobe da inicial ate perto da maxima', () => {
  assert.equal(velocidadeEm(0), VEL_INICIAL);
  assert.ok(velocidadeEm(600) > VEL_MAXIMA - 0.5);
  assert.ok(velocidadeEm(60) > VEL_INICIAL && velocidadeEm(60) < VEL_MAXIMA);
});

test('trombada derruba a velocidade e o chefe encurta a distancia', () => {
  const P = vazia();
  P.pista.ents.push(obs('baixo', 0, 10));
  const evs = [];
  correrAte(P, 10.5, (ev) => evs.push(ev));
  assert.ok(evs.includes('trombada'));
  assert.ok(P.fator < CHOQUE.leve + 0.1, `fator ${P.fator}`);
  // o ponto mais perto que o chefe chegou (depois ele recua de novo)
  let minimo = P.perseguidor.dist;
  for (let i = 0; i < 600 && P.d < 60; i++) {
    passo(P, 1 / 60, {});
    minimo = Math.min(minimo, P.perseguidor.dist);
  }
  assert.equal(P.fator, 1);
  const perda = DIST_MAX - minimo;
  assert.ok(perda > 2 && perda < 7, `perda ${perda.toFixed(2)} m`);
});

test('duas trombadas fortes seguidas: o chefe pega', () => {
  const P = vazia();
  P.pista.ents.push(obs('bloco', 0, 10), obs('bloco', 0, 20));
  correrAte(P, 200);
  assert.equal(P.fim?.motivo, 'pego');
});

test('correndo limpo o chefe fica para tras ate sumir', () => {
  const P = vazia();
  P.perseguidor.dist = 3;
  correrAte(P, 300);
  assert.equal(P.perseguidor.dist, DIST_MAX);
});

test('serra corta ao meio: fim da corrida', () => {
  const P = vazia('rio');
  P.pista.ents.push(obs('bloco', 0, 8, { serra: true }));
  const fins = [];
  correrAte(P, 30, (ev, d) => { if (ev === 'fim') fins.push(d.motivo); });
  assert.equal(P.fim?.motivo, 'serra');
  assert.deepEqual(fins, ['serra']);
});

test('modo Sahur: corre mais e passa por tudo, ate pela serra', () => {
  const P = vazia('rio');
  P.sahur = 5;
  P.pista.ents.push(obs('bloco', 0, 8, { serra: true }), obs('bloco', 0, 20));
  correrAte(P, 40);
  assert.equal(P.fim, null);
  assert.ok(P.v > P.vBase);
});

test('o ima pega moedas de outras faixas a frente', () => {
  const P = vazia();
  P.ima = 5;
  for (let i = 0; i < 5; i++) P.pista.ents.push({ id: id++, tipo: 'moeda', faixa: 1, z: 6 + i * 2, y: 1, pega: false });
  for (let i = 0; i < 30; i++) passo(P, 1 / 60, {});
  assert.equal(P.moedas, 5);
});

test('reviver limpa a frente, afasta o chefe e da folga', () => {
  const P = vazia('rio');
  P.pista.ents.push(obs('bloco', 0, 3, { serra: true }));
  correrAte(P, 20);
  assert.equal(P.fim?.motivo, 'serra');
  reviver(P);
  assert.equal(P.fim, null);
  assert.ok(P.invencivel > 0);
  assert.equal(P.perseguidor.dist, DIST_MAX);
  correrAte(P, 60);
  assert.equal(P.fim, null);
});
