// Construtor de modelos: junta primitivas coloridas (cor por vertice) numa geometria so por
// material. Cada prop vira 1 a 3 draw calls, nao dezenas.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

/**
 * @typedef {{ p?: number[], r?: number[], s?: number[] | number, m?: string, var?: number, k?: number }} Opcoes
 * p: posicao, r: rotacao (euler xyz), s: escala, m: chave do material, var: variacao de cor (0..1),
 * k: multiplica a cor (acima de 1 o bloom pega, no material 'brilho')
 */

export class Modelo {
  /** @param {() => number} [aleatorio] */
  constructor(aleatorio = Math.random) {
    /** @type {Map<string, THREE.BufferGeometry[]>} */
    this.partes = new Map();
    this.aleatorio = aleatorio;
  }

  /**
   * @param {THREE.BufferGeometry} geo @param {number | string} cor @param {Opcoes} [o]
   */
  add(geo, cor, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    for (const nome of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(nome)) g.deleteAttribute(nome);
    }
    _c.set(cor);
    if (o.k) _c.multiplyScalar(o.k);
    if (o.var) {
      const k = 1 + (this.aleatorio() - 0.5) * o.var;
      _c.multiplyScalar(k);
    }
    const n = g.attributes.position.count;
    const cores = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      cores[i * 3] = _c.r;
      cores[i * 3 + 1] = _c.g;
      cores[i * 3 + 2] = _c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cores, 3));
    const p = o.p || [0, 0, 0];
    const r = o.r || [0, 0, 0];
    const s = typeof o.s === 'number' ? [o.s, o.s, o.s] : (o.s || [1, 1, 1]);
    _m.compose(_p.set(p[0], p[1], p[2]), _q.setFromEuler(_e.set(r[0], r[1], r[2])), _s.set(s[0], s[1], s[2]));
    g.applyMatrix4(_m);
    const chave = o.m || 'liso';
    if (!this.partes.has(chave)) this.partes.set(chave, []);
    /** @type {THREE.BufferGeometry[]} */ (this.partes.get(chave)).push(g);
    return this;
  }

  /** caixa de bordas arredondadas (base no centro) */
  caixa(w, h, d, cor, o = {}, raio = 0.06) {
    const r = Math.min(raio, w / 2.01, h / 2.01, d / 2.01);
    const geo = r > 0.005 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
    return this.add(geo, cor, o);
  }

  cilindro(rt, rb, h, cor, o = {}, seg = 14) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg, 1), cor, o);
  }

  esfera(r, cor, o = {}, seg = 14) {
    return this.add(new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.7))), cor, o);
  }

  cone(r, h, cor, o = {}, seg = 12) {
    return this.add(new THREE.ConeGeometry(r, h, seg, 1), cor, o);
  }

  toro(r, tubo, cor, o = {}, arco = Math.PI * 2) {
    return this.add(new THREE.TorusGeometry(r, tubo, 8, 18, arco), cor, o);
  }

  /** @param {number[][]} pontos perfil [raio, altura] */
  torno(pontos, cor, o = {}, seg = 16) {
    return this.add(new THREE.LatheGeometry(pontos.map(([x, y]) => new THREE.Vector2(x, y)), seg), cor, o);
  }

  /**
   * Monta o grupo, uma malha por material.
   * @param {Record<string, THREE.Material>} materiais
   * @param {{ sombra?: boolean, recebe?: boolean }} [o]
   */
  montar(materiais, o = {}) {
    const grupo = new THREE.Group();
    for (const [chave, geos] of this.partes) {
      const geo = mergeGeometries(geos, false);
      if (!geo) continue;
      geo.computeBoundingSphere();
      const mat = materiais[chave] || materiais.liso;
      const malha = new THREE.Mesh(geo, mat);
      malha.castShadow = o.sombra !== false && chave !== 'brilho';
      malha.receiveShadow = o.recebe !== false;
      malha.name = chave;
      grupo.add(malha);
    }
    for (const geos of this.partes.values()) for (const g of geos) g.dispose();
    this.partes.clear();
    return grupo;
  }
}
