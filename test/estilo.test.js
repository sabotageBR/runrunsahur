// Fronteiras do codigo: a logica e pura; so um modulo toca o localStorage; so um le a URL;
// sem console.log; nenhuma URL externa no jogo (o portal so permite a origem dos jogos).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
/** @param {string} dir @returns {string[]} */
const listar = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? listar(p) : p.endsWith('.js') ? [p] : [];
});
const SRC = listar(join(RAIZ, 'src'));
const ler = (p) => readFileSync(p, 'utf8');
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('src/jogo e logica pura (sem three, DOM, Math.random nem relogio)', () => {
  for (const p of SRC.filter((x) => x.includes(`${join('src', 'jogo')}`))) {
    const s = semComentarios(ler(p));
    for (const proibido of ["from 'three'", 'Math.random', 'document.', 'window.', 'performance.', 'Date.now', 'localStorage']) {
      assert.ok(!s.includes(proibido), `${relative(RAIZ, p)} usa ${proibido}`);
    }
  }
});

test('so armazenamento.js toca o localStorage; so depuracao.js le a URL', () => {
  for (const p of SRC) {
    const s = semComentarios(ler(p));
    const r = relative(RAIZ, p);
    if (!r.endsWith('armazenamento.js')) assert.ok(!s.includes('localStorage'), `${r} usa localStorage`);
    if (!r.endsWith('depuracao.js')) assert.ok(!/location\.(search|href)|URLSearchParams/.test(s), `${r} le a URL`);
  }
});

test('sem console.log', () => {
  for (const p of SRC) assert.ok(!semComentarios(ler(p)).includes('console.log'), relative(RAIZ, p));
});

test('nenhuma URL externa no jogo', () => {
  for (const p of [...SRC, join(RAIZ, 'index.html')]) {
    const s = semComentarios(ler(p));
    assert.ok(!/https?:\/\//.test(s), `${relative(RAIZ, p)} tem URL externa`);
  }
});

test('o importmap aponta para o three vendorizado', () => {
  const html = ler(join(RAIZ, 'index.html'));
  assert.ok(html.includes('"three": "./vendor/three/three.module.js"'));
  assert.ok(statSync(join(RAIZ, 'vendor/three/three.module.js')).size > 100000);
  assert.ok(statSync(join(RAIZ, 'vendor/three/three.core.js')).size > 100000);
});
