// A pista sempre tem passagem: o autopiloto corre 150 s em varias sementes, nos 2 cenarios,
// sem morrer e sem tropecar. E a mesma semente gera a mesma pista.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarPista, gerarAte, FAIXA } from '../src/jogo/pista.js';
import { criarPartida, passo } from '../src/jogo/regras.js';
import { criarAutopiloto, decidir } from '../src/jogo/autopiloto.js';

for (const cenario of /** @type {const} */ (['vila', 'rio'])) {
  test(`${cenario}: o autopiloto corre 150 s sem morrer nem trombar em 8 sementes`, () => {
    for (let semente = 101; semente <= 108; semente++) {
      const P = criarPartida({ semente, cenario });
      const ap = criarAutopiloto();
      let choques = 0;
      while (!P.fim && P.t < 150) {
        passo(P, 1 / 60, decidir(ap, P), (ev) => { if (ev === 'tropeco' || ev === 'trombada' || ev === 'escalou') choques++; });
      }
      assert.equal(P.fim, null, `semente ${semente}: ${P.fim?.motivo} em t=${P.t.toFixed(1)} d=${P.d.toFixed(0)}`);
      assert.equal(choques, 0, `semente ${semente}: ${choques} choques`);
      assert.ok(P.moedas > 100, `semente ${semente}: poucas moedas (${P.moedas})`);
    }
  });
}

test('mesma semente, mesma pista', () => {
  const a = criarPista(42, 'rio');
  const b = criarPista(42, 'rio');
  gerarAte(a, 1500, 15);
  gerarAte(b, 1500, 15);
  assert.deepEqual(a.ents, b.ents);
  const c = criarPista(43, 'rio');
  gerarAte(c, 1500, 15);
  assert.notDeepEqual(a.ents, c.ents);
});

test('a vila nao tem vaos e o rio tem', () => {
  const v = criarPista(5, 'vila');
  const r = criarPista(5, 'rio');
  gerarAte(v, 4000, 15);
  gerarAte(r, 4000, 15);
  assert.equal(v.ents.filter((e) => e.tipo === 'vao').length, 0);
  assert.ok(r.ents.filter((e) => e.tipo === 'vao').length > 5);
});

test('nenhuma fileira bloqueia as 3 faixas com parede', () => {
  for (const cenario of /** @type {const} */ (['vila', 'rio'])) {
    const p = criarPista(77, cenario);
    gerarAte(p, 6000, 20);
    const paredes = p.ents.filter((e) => e.tipo === 'obs' && (e.forma === 'bloco' || (e.forma === 'plataforma' && !e.rampa)));
    for (const e of paredes) {
      const juntas = paredes.filter((o) => o.z < e.z + e.c && o.z + o.c > e.z);
      const faixas = new Set(juntas.map((o) => o.faixa));
      assert.ok(faixas.size < 3, `${cenario}: 3 faixas fechadas em z=${e.z.toFixed(1)}`);
    }
    assert.ok(FAIXA > 2);
  }
});
