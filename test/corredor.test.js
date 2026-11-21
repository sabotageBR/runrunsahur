// Fisica do corredor: pulo, rolar, tacada, colisao de frente e de lado, rampa e agua.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarCorredor, passoCorredor, ALTURA_PULO, TEMPO_PULO } from '../src/jogo/corredor.js';
import { FORMAS, ALTURA_PLATAFORMA, RAMPA } from '../src/jogo/pista.js';

const DT = 1 / 120;
const V = 12;
let id = 1;
/** @param {keyof typeof FORMAS} forma @param {number} faixa @param {number} z @param {object} [extra] */
const obs = (forma, faixa, z, extra = {}) => ({
  id: id++, tipo: 'obs', forma, faixa, z, c: FORMAS[forma].c, y0: FORMAS[forma].y0, y1: FORMAS[forma].y1,
  quebravel: forma === 'quebravel', rampa: false, vel: 0, ativo: false, quebrado: false, derrubado: false, serra: false, variante: 0, ...extra,
});

/** Corre ate `ate` metros com comandos por distancia. */
function correr(ents, ate, cmds = {}, estado = { sahur: false, invencivel: false }) {
  const c = criarCorredor();
  let d = 0;
  const evs = [];
  let maxY = 0;
  const usados = new Set();
  while (d < ate) {
    /** @type {any} */
    let cmd = {};
    for (const [k, v] of Object.entries(cmds)) {
      if (!usados.has(k) && d >= Number(k)) {
        cmd = v;
        usados.add(k);
      }
    }
    const col = passoCorredor(c, ents, d, V * DT, DT, cmd, estado, (ev) => evs.push(ev));
    d += V * DT;
    maxY = Math.max(maxY, c.y);
    if (col) return { r: col.tipo, col, c, d, evs, maxY };
  }
  return { r: null, col: null, c, d, evs, maxY };
}

test('o pulo sobe ~1,55 m e dura TEMPO_PULO (~0,58 s, queda mais pesada)', () => {
  const c = criarCorredor();
  let t = 0;
  let maxY = 0;
  passoCorredor(c, [], 0, 0, DT, { pular: true }, { sahur: false, invencivel: false }, () => {});
  while (!c.noChao && t < 2) {
    passoCorredor(c, [], 0, 0, DT, {}, { sahur: false, invencivel: false }, () => {});
    t += DT;
    maxY = Math.max(maxY, c.y);
  }
  assert.ok(Math.abs(maxY - ALTURA_PULO) < 0.05, `altura ${maxY}`);
  assert.ok(Math.abs(t - TEMPO_PULO) < 0.03, `tempo ${t}`);
});

test('barreira baixa: tromba em pe (e derruba) e passa pulando', () => {
  const b = obs('baixo', 0, 10);
  const r = correr([b], 20);
  assert.equal(r.r, 'trombada');
  assert.equal(r.col.forte, false);
  assert.ok(b.derrubado);
  assert.equal(correr([obs('baixo', 0, 10)], 20, { 7: { pular: true } }).r, null);
});

test('barreira alta: tromba em pe e pulando, passa rolando', () => {
  assert.equal(correr([obs('alto', 0, 10)], 20).r, 'trombada');
  assert.equal(correr([obs('alto', 0, 10)], 20, { 7: { pular: true } }).r, 'trombada');
  assert.equal(correr([obs('alto', 0, 10)], 20, { 7: { rolar: true } }).r, null);
});

test('a tacada quebra o caixote, mas nao o carrinho', () => {
  const cx = obs('quebravel', 0, 10);
  const r = correr([cx], 20, { 7.5: { tacada: true } });
  assert.equal(r.r, null);
  assert.ok(cx.quebrado);
  assert.ok(r.evs.includes('quebrou'));
  const bl = obs('bloco', 0, 10);
  const r2 = correr([bl], 20, { 7.5: { tacada: true } });
  assert.equal(r2.r, 'trombada');
  assert.equal(r2.col.forte, true);
  assert.equal(bl.quebrado, false);
});

test('bater de lado tropeca e volta para a faixa de antes', () => {
  const bl = obs('bloco', 1, 5, { c: 10 });
  const r = correr([bl], 20, { 8: { direita: true } });
  assert.equal(r.r, 'tropeco');
  assert.equal(r.c.faixa, 0);
});

test('a rampa leva ao topo da plataforma e dela se cai de volta', () => {
  const pl = obs('plataforma', 0, 12, { c: 10, rampa: true });
  const r = correr([pl], 30);
  assert.equal(r.r, null);
  assert.ok(Math.abs(r.maxY - ALTURA_PLATAFORMA) < 0.01, `maxY ${r.maxY}`);
  assert.ok(r.c.y < 0.01 && r.c.noChao);
  assert.ok(RAMPA > 0);
});

test('plataforma sem rampa: escala a parede', () => {
  const r = correr([obs('plataforma', 0, 12, { c: 10 })], 30);
  assert.equal(r.r, 'escalou');
  assert.ok(Math.abs(r.c.y - ALTURA_PLATAFORMA) < 0.01);
});

test('serra corta: de frente e de lado', () => {
  assert.equal(correr([obs('bloco', 0, 10, { serra: true })], 20).r, 'serra');
  assert.equal(correr([obs('bloco', 1, 5, { c: 10, serra: true })], 20, { 8: { direita: true } }).r, 'serra');
  // pular nao adianta: a serra e alta
  assert.equal(correr([obs('bloco', 0, 10, { serra: true })], 20, { 7: { pular: true } }).r, 'serra');
});

test('vao de agua: cai sem pular, passa pulando', () => {
  const vao = () => ({ id: id++, tipo: 'vao', faixa: 0, z: 10, c: 3, variante: 0 });
  assert.equal(correr([vao()], 25).r, 'caiu');
  assert.equal(correr([vao()], 25, { 8.6: { pular: true } }).r, null);
});

test('modo Sahur quebra tudo no caminho', () => {
  const bl = obs('bloco', 0, 10);
  const r = correr([bl], 20, {}, { sahur: true, invencivel: false });
  assert.equal(r.r, null);
  assert.ok(bl.quebrado);
});
