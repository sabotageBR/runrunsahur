// Particulas em InstancedMesh (uma draw call por tipo): lascas de madeira e frutas ao
// quebrar, poeira ao pousar, respingo de agua e brilho ao pegar moeda.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const MAX = 260;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

/** @param {THREE.Object3D} cena */
export function criarEfeitos(cena) {
  const lascas = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 1, 0.15), new THREE.MeshStandardMaterial({ roughness: 0.6 }), MAX);
  const bolhas = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9, transparent: true, opacity: 0.85 }), MAX);
  const faiscas = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), 260);
  const riscos = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }), 90);
  const TODOS = [lascas, bolhas, faiscas, riscos];
  for (const im of TODOS) {
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.count = 0;
    im.frustumCulled = false;
    cena.add(im);
  }
  lascas.castShadow = true;
  /** @typedef {{ im: THREE.InstancedMesh, p: THREE.Vector3, v: THREE.Vector3, r: THREE.Vector3, vr: THREE.Vector3, tam: THREE.Vector3, vida: number, total: number, cor: THREE.Color, grav: number, cresce: number }} Part */
  /** @type {Part[]} */
  const parts = [];

  function nova(im, p, v, tam, vida, cor, grav = 22, cresce = 0, gira = true) {
    if (parts.length > MAX * 3) parts.shift();
    parts.push({
      im, p: p.clone(), v, r: gira ? new THREE.Vector3(Math.random() * 6, Math.random() * 6, 0) : new THREE.Vector3(), vr: gira ? new THREE.Vector3((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, 0) : new THREE.Vector3(),
      tam, vida, total: vida, cor: cor instanceof THREE.Color ? cor.clone() : new THREE.Color(cor), grav, cresce,
    });
  }

  return {
    /** Caixote ou obstaculo quebrado: lascas nas cores dadas. @param {THREE.Vector3} pos @param {string[]} cores @param {number} [forca] */
    quebrar(pos, cores, forca = 1) {
      for (let i = 0; i < 26; i++) {
        const v = new THREE.Vector3((Math.random() - 0.5) * 9, 3 + Math.random() * 7, -4 - Math.random() * 8).multiplyScalar(forca);
        const t = 0.08 + Math.random() * 0.16;
        const tam = Math.random() < 0.5 ? new THREE.Vector3(t * 2.6, t * 0.5, t) : new THREE.Vector3(t, t, t);
        nova(lascas, pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, Math.random() * 0.9, 0)), v, tam, 0.9 + Math.random() * 0.5, cores[i % cores.length]);
      }
      for (let i = 0; i < 6; i++) {
        const v = new THREE.Vector3((Math.random() - 0.5) * 4, 1 + Math.random() * 2, -2);
        nova(bolhas, pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.3, 0)), v, new THREE.Vector3(0.16, 0.16, 0.16), 0.5, '#efe2c8', 0, 1.5);
      }
    },
    /** Poeira (ou agua) aos pes. @param {THREE.Vector3} pos @param {string} cor @param {number} [n] */
    poeira(pos, cor, n = 7) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const v = new THREE.Vector3(Math.cos(a) * 2.5, 0.6 + Math.random(), Math.sin(a) * 1.5 + 2);
        nova(bolhas, pos.clone().add(new THREE.Vector3(Math.cos(a) * 0.3, 0.05, 0)), v, new THREE.Vector3(0.1, 0.1, 0.1), 0.4, cor, -1, 1.8);
      }
    },
    /** Respingo (rio). @param {THREE.Vector3} pos */
    respingo(pos) {
      for (let i = 0; i < 18; i++) {
        const v = new THREE.Vector3((Math.random() - 0.5) * 5, 4 + Math.random() * 6, (Math.random() - 0.5) * 4);
        nova(bolhas, pos.clone(), v, new THREE.Vector3(0.12, 0.12, 0.12), 0.8, i % 3 ? '#bfeaff' : '#ffffff', 18, 0.5);
      }
    },
    /** Brilho ao pegar moeda. @param {THREE.Vector3} pos @param {string} [cor] */
    brilho(pos, cor = '#ffe27a', n = 5) {
      for (let i = 0; i < n; i++) {
        const v = new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 2 + 3);
        nova(faiscas, pos, v, new THREE.Vector3(0.09, 0.09, 0.09), 0.35, cor, 4, -0.5);
      }
    },
    /** Serragem da serra (o corte). @param {THREE.Vector3} pos */
    serragem(pos) {
      for (let i = 0; i < 90; i++) {
        const v = new THREE.Vector3((Math.random() - 0.5) * 10, 2 + Math.random() * 7, (Math.random() - 0.3) * 8);
        const t = 0.04 + Math.random() * 0.07;
        nova(lascas, pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 1.2, 0)), v, new THREE.Vector3(t, t, t), 1.2 + Math.random() * 0.6, i % 4 ? '#f2d3a2' : '#c98d55');
      }
    },
    /** Estrelinha arco-iris do rastro do modo Sahur. @param {THREE.Vector3} pos */
    estrelinha(pos) {
      const cor = new THREE.Color().setHSL(Math.random(), 1, 0.6);
      cor.multiplyScalar(2.2);
      nova(faiscas, pos, new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, 2 + Math.random() * 3), new THREE.Vector3(0.07, 0.07, 0.07), 0.5, cor, 2, -0.6);
    },
    /** Estouro de estrelas ao pegar o tambor (entrada no modo Sahur). @param {THREE.Vector3} pos */
    explosaoEstrela(pos) {
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const cor = new THREE.Color().setHSL(i / 60, 1, 0.6).multiplyScalar(2.4);
        const v = new THREE.Vector3(Math.cos(a) * 7, Math.sin(a) * 7 + 2, (Math.random() - 0.5) * 3);
        nova(faiscas, pos, v, new THREE.Vector3(0.11, 0.11, 0.11), 0.8, cor, 3, -0.4);
      }
    },
    /** Risco de velocidade passando pelo jogador. @param {number} x @param {number} y */
    risco(x, y) {
      const p = new THREE.Vector3(x + (Math.random() - 0.5) * 7, y + 0.2 + Math.random() * 3.2, -18 - Math.random() * 8);
      const k = 0.02 + Math.random() * 0.02;
      nova(riscos, p, new THREE.Vector3(0, 0, 55), new THREE.Vector3(k, k, 1.8 + Math.random() * 1.5), 0.45, '#ffffff', 0, 0, false);
    },
    /** @param {number} dt @param {number} dz quanto o mundo andou (as particulas ficam no lugar da pista) */
    atualizar(dt, dz) {
      for (const im of TODOS) im.count = 0;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.vida -= dt;
        if (p.vida <= 0) {
          parts.splice(i, 1);
          continue;
        }
        p.v.y -= p.grav * dt;
        p.p.addScaledVector(p.v, dt);
        p.p.z += dz;
        if (p.p.y < 0.05 && p.grav > 0) {
          p.p.y = 0.05;
          p.v.y *= -0.3;
          p.v.x *= 0.6;
          p.v.z *= 0.6;
        }
        p.r.addScaledVector(p.vr, dt);
        const u = p.vida / p.total;
        const k = p.im === riscos ? 1 : p.cresce ? 1 + (1 - u) * p.cresce : Math.min(1, u * 3);
        const im = p.im;
        if (im.count >= im.instanceMatrix.count) continue;
        _m.compose(p.p, _q.setFromEuler(_e.set(p.r.x, p.r.y, 0)), _s.copy(p.tam).multiplyScalar(k * (p.cresce ? Math.min(1, u * 2) : 1)));
        im.setMatrixAt(im.count, _m);
        im.setColorAt(im.count, _c.copy(p.cor));
        im.count++;
      }
      for (const im of TODOS) {
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
    },
    limpar() {
      parts.length = 0;
    },
  };
}
