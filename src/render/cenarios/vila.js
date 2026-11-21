// Cenario "Vila do Sahur": ruas de uma vila indonesia as 3h da manha. Casas de madeira sobre
// palafitas, telhado de telha, lanternas, bandeirinhas, coqueiros. O ceu clareia com a
// distancia (o amanhecer chegando). Perseguidor: o galo gigante do amanhecer.
import * as THREE from 'three';
import { Modelo } from '../modelo.js';
import { criarCeu, criarEstrelas, criarBrilhos, anelSilhuetas, paletaEm } from './comum.js';
import { RAMPA, ALTURA_PLATAFORMA } from '../../jogo/pista.js';

const PAREDES = ['#5fb3a1', '#e8a65d', '#d97a7a', '#88b3e0', '#f0d58a', '#b48ad8', '#7cc49a'];
const TELHAS = ['#b5482f', '#9c3b2a', '#c96a3a', '#a8452f'];
const MADEIRA_ESCURA = '#6b3f22';
const BAMBU = '#cdb560';
const LUZ_QUENTE = '#ffb24a';

/** Paleta do amanhecer (p = fracao da distancia ate o dia). */
const PALETA = [
  { p: 0, topo: '#060a24', horiz: '#222a66', baixo: '#0b0d22', nevoa: '#161d4a', hemiCeu: '#6070c8', hemiChao: '#251d30', hemi: 0.55, sol: '#9fb2ff', solI: 1.15, env: 0.3, astro: '#fff6dc', brilhoAstro: 0.35, estrelas: 1, lanternas: 1, exp: 1.1, luzQ: 26, silh: '#141a40' },
  { p: 0.55, topo: '#1b2160', horiz: '#c76682', baixo: '#2a2040', nevoa: '#5a4272', hemiCeu: '#a089d0', hemiChao: '#3f2a3a', hemi: 0.85, sol: '#ffb08a', solI: 1.6, env: 0.55, astro: '#ffd0a0', brilhoAstro: 0.6, estrelas: 0.35, lanternas: 0.8, exp: 1.05, luzQ: 18, silh: '#3a2d58' },
  { p: 1, topo: '#4f86d8', horiz: '#ffbf7a', baixo: '#7a5a5a', nevoa: '#f0b892', hemiCeu: '#c9dcff', hemiChao: '#7a5a3a', hemi: 1.0, sol: '#ffd6a8', solI: 2.6, env: 0.85, astro: '#fff0c8', brilhoAstro: 1.0, estrelas: 0, lanternas: 0.25, exp: 1.0, luzQ: 6, silh: '#8a6278' },
];

/**
 * @param {{ materiais: Record<string, THREE.Material>, texturas: any, rnd: () => number }} ctx
 */
export function criarVila(ctx) {
  const { materiais: M0, texturas: T, rnd } = ctx;
  const chaoTex = T.chaoVila.clone();
  chaoTex.repeat.set(2, 9);
  chaoTex.needsUpdate = true;
  const M = {
    ...M0,
    chao: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, map: chaoTex }),
  };
  const pick = (/** @type {any[]} */ l) => l[Math.floor(rnd() * l.length)];

  // ---------------------------------------------------------------------------------
  // ceu, estrelas, silhuetas e luz quente
  const ceu = criarCeu();
  const estrelas = criarEstrelas(rnd);
  const formas = [];
  for (let i = 0; i < 46; i++) {
    const ang = -Math.PI * 0.95 + (i / 46) * Math.PI * 0.9 + rnd() * 0.02;
    const tipo = rnd();
    if (tipo < 0.12) {
      // cupula com torre (silhueta)
      formas.push({ geo: new THREE.SphereGeometry(9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), ang, y: 10 + rnd() * 4 });
      formas.push({ geo: new THREE.CylinderGeometry(1.4, 1.6, 30, 8), ang: ang + 0.04, y: 15 });
    } else if (tipo < 0.5) {
      formas.push({ geo: new THREE.BoxGeometry(14 + rnd() * 10, 6 + rnd() * 8, 4), ang, y: 3 });
      formas.push({ geo: new THREE.ConeGeometry(10 + rnd() * 4, 6, 4), ang, y: 11 + rnd() * 3 });
    } else {
      // coqueiro
      formas.push({ geo: new THREE.CylinderGeometry(0.6, 0.9, 22, 5), ang, y: 11 });
      formas.push({ geo: new THREE.SphereGeometry(5, 7, 4), ang, y: 22, s: [1.4, 0.5, 1.4] });
    }
  }
  const silhuetas = anelSilhuetas(formas, '#ffffff');
  const matSilhueta = /** @type {THREE.MeshBasicMaterial} */ (/** @type {THREE.Mesh} */ (silhuetas.children[0]).material);
  const luzQuente = new THREE.PointLight(LUZ_QUENTE, 26, 16, 1.6);

  // ---------------------------------------------------------------------------------
  // trecho de cenario (40 m): rua, calcadas, casas, coqueiros, lanternas, bandeirinhas
  function trecho() {
    const b = new Modelo(rnd);
    /** @type {{ p: number[], cor: string, tam: number }[]} */
    const brilhos = [];
    // rua e lados
    b.caixa(9.2, 0.1, 40, '#a8805c', { p: [0, -0.05, -20], m: 'chao' }, 0);
    // pedras de calcamento marcando as faixas (discretas)
    for (const x of [-1.1, 1.1]) {
      for (let z = -0.8; z > -40; z -= 1.15) b.caixa(0.3, 0.03, 0.8, '#8a6a4c', { p: [x + (rnd() - 0.5) * 0.06, 0.012, z], m: 'chao', var: 0.25 }, 0.04);
    }
    for (const s of [-1, 1]) {
      b.caixa(0.32, 0.26, 40, '#9d9384', { p: [s * 4.75, 0.08, -20] }, 0);
      b.caixa(5.2, 0.14, 40, '#5b6c3b', { p: [s * 7.5, 0.04, -20], m: 'chao' }, 0);
      b.caixa(16, 0.1, 40, '#435532', { p: [s * 18, 0.0, -20] }, 0);
      // casas da frente
      let z = -1 - rnd() * 3;
      while (z > -36) {
        const w = 5.5 + rnd() * 2.5;
        casa(b, brilhos, s, s * 11.2, z - w / 2, w);
        const vao = 2.5 + rnd() * 2.5;
        if (rnd() < 0.7) coqueiro(b, s * (6.4 + rnd() * 1.2), z - w - vao / 2, 5.5 + rnd() * 2.5);
        else bananeira(b, s * (6.6 + rnd()), z - w - vao / 2);
        z -= w + vao;
      }
      // fundo: casas simples e coqueiros altos
      for (let zf = -3 - rnd() * 4; zf > -38; zf -= 7 + rnd() * 5) {
        const w = 5 + rnd() * 3;
        const x = s * (18 + rnd() * 5);
        b.caixa(5, 3 + rnd(), w, pick(PAREDES), { p: [x, 2.0, zf], var: 0.25 }, 0);
        telhado(b, x, 3.6 + 0.3, zf, 5.6, w + 0.6, pick(TELHAS));
        if (rnd() < 0.5) brilhos.push({ p: [x - s * 2.55, 2.2, zf], cor: LUZ_QUENTE, tam: 2.2 });
        if (rnd() < 0.5) coqueiro(b, x + s * 4, zf - 3, 8 + rnd() * 3);
      }
      // postes com lanterna
      for (const zl of [-8, -28]) {
        const x = s * 4.95;
        b.cilindro(0.08, 0.1, 3.8, MADEIRA_ESCURA, { p: [x, 1.9, zl], m: 'madeira' }, 8);
        b.caixa(0.08, 0.08, 0.9, MADEIRA_ESCURA, { p: [x - s * 0.35, 3.7, zl], r: [0, Math.PI / 2, 0] }, 0);
        b.cilindro(0.01, 0.01, 0.35, '#222222', { p: [x - s * 0.7, 3.5, zl] }, 4);
        const cor = pick(['#ff5a3a', '#ff8a2a', '#ffcb3a']);
        b.esfera(0.24, cor, { p: [x - s * 0.7, 3.2, zl], s: [1, 1.25, 1], m: 'brilho', k: 2.8 }, 12);
        b.cilindro(0.12, 0.12, 0.06, '#3a2a1a', { p: [x - s * 0.7, 3.5, zl] }, 8);
        b.cilindro(0.12, 0.12, 0.06, '#3a2a1a', { p: [x - s * 0.7, 2.9, zl] }, 8);
        brilhos.push({ p: [x - s * 0.7, 3.2, zl], cor: '#ff9a40', tam: 4.2 });
      }
    }
    // bandeirinhas de lado a lado (bem acima das plataformas)
    const zb = -18 - rnd() * 4;
    const cores = ['#e8323c', '#ffd23a', '#2fb36b', '#2f7fe0', '#ffffff', '#ff7a2a'];
    const n = 18;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = -4.9 + u * 9.8;
      const y = 7.6 - Math.sin(u * Math.PI) * 0.8;
      if (i < n) {
        const x2 = -4.9 + ((i + 1) / n) * 9.8;
        const y2 = 7.6 - Math.sin(((i + 1) / n) * Math.PI) * 0.8;
        const comp = Math.hypot(x2 - x, y2 - y);
        b.cilindro(0.012, 0.012, comp, '#3a2a1a', { p: [(x + x2) / 2, (y + y2) / 2, zb], r: [0, 0, Math.PI / 2 + Math.atan2(y2 - y, x2 - x)] }, 4);
        b.cone(0.2, 0.42, cores[i % cores.length], { p: [(x + x2) / 2, (y + y2) / 2 - 0.22, zb], r: [Math.PI, 0, 0], s: [1, 1, 0.12], m: 'tecido' }, 3);
      }
      if (i % 4 === 2) {
        // ketupat pendurado (losango de folha trancada)
        b.add(new THREE.OctahedronGeometry(0.2, 0), '#8fcf4a', { p: [x, y - 0.5, zb], s: [1, 1.3, 0.6] });
        b.add(new THREE.OctahedronGeometry(0.21, 0), '#e8c84a', { p: [x, y - 0.5, zb], s: [0.5, 1.32, 0.62] });
      }
    }
    for (const s of [-1, 1]) b.cilindro(0.06, 0.08, 7.8, MADEIRA_ESCURA, { p: [s * 4.95, 3.9, zb], m: 'madeira' }, 6);
    const g = b.montar(M);
    if (brilhos.length) {
      const pts = criarBrilhos(T.brilho, brilhos);
      pts.name = 'brilhos';
      g.add(pts);
    }
    return g;
  }

  /** Casa de palafita com varanda, janelas acesas e telhado de duas aguas. */
  function casa(b, brilhos, s, x, z, w) {
    const parede = pick(PAREDES);
    const prof = 4.6;
    const fx = x - s * prof / 2; // fachada (lado da rua)
    for (const dz of [-w / 2 + 0.3, 0, w / 2 - 0.3]) {
      for (const dx of [-prof / 2 + 0.3, prof / 2 - 0.3]) b.cilindro(0.12, 0.12, 1.1, MADEIRA_ESCURA, { p: [x + dx, 0.55, z + dz], m: 'madeira' }, 6);
    }
    b.caixa(prof + 0.4, 0.22, w + 0.2, '#8a5a32', { p: [x, 1.15, z], m: 'madeira' }, 0);
    b.caixa(prof - 0.4, 2.6, w - 0.4, parede, { p: [x + s * 0.2, 2.55, z], m: 'madeira', var: 0.12 }, 0);
    // faixas de madeira na parede
    b.caixa(0.06, 0.12, w - 0.3, '#f5ecd8', { p: [fx + s * 0.39 - s * 0.06, 1.4, z] }, 0);
    b.caixa(0.06, 0.12, w - 0.3, '#f5ecd8', { p: [fx + s * 0.39 - s * 0.06, 3.75, z] }, 0);
    // janelas acesas com moldura e venezianas
    const jx = fx + s * 0.38 - s * 0.05;
    const nj = w > 6.5 ? 2 : 1;
    for (let j = 0; j < nj; j++) {
      const jz = z + (nj === 1 ? -w * 0.18 : (j === 0 ? -w * 0.28 : w * 0.12));
      const acesa = rnd() < 0.75;
      b.caixa(0.05, 0.95, 0.85, acesa ? '#ffc067' : '#2a2a4a', { p: [jx, 2.65, jz], m: acesa ? 'brilho' : 'liso', k: acesa ? 2.2 : 1 }, 0);
      b.caixa(0.08, 1.1, 0.1, '#f5ecd8', { p: [jx - s * 0.02, 2.65, jz - 0.47] }, 0);
      b.caixa(0.08, 1.1, 0.1, '#f5ecd8', { p: [jx - s * 0.02, 2.65, jz + 0.47] }, 0);
      b.caixa(0.08, 0.1, 1.05, '#f5ecd8', { p: [jx - s * 0.02, 3.2, jz] }, 0);
      b.caixa(0.08, 0.1, 1.05, '#f5ecd8', { p: [jx - s * 0.02, 2.1, jz] }, 0);
      b.caixa(0.06, 1.0, 0.42, '#3a8a6a', { p: [jx - s * 0.04, 2.65, jz - 0.75], r: [0, s * 0.5, 0] }, 0);
      if (acesa) brilhos.push({ p: [jx - s * 0.3, 2.65, jz], cor: '#ffb050', tam: 2.4 });
    }
    // porta e escadinha
    const pz = z + w * 0.3;
    b.caixa(0.06, 1.85, 0.9, '#7a3f22', { p: [jx, 2.17, pz], m: 'madeira' }, 0);
    for (let i = 0; i < 3; i++) b.caixa(0.4, 0.12, 1.0, '#8a5a32', { p: [fx - s * (0.25 + i * 0.35), 0.95 - i * 0.32, pz], m: 'madeira' }, 0);
    // telhado
    telhado(b, x, 4.0, z, prof + 1.4, w + 1.0, pick(TELHAS));
    // cerquinha de bambu no quintal
    if (rnd() < 0.7) {
      const cx = s * 5.6;
      for (let dz = -w / 2; dz <= w / 2; dz += 0.7) b.cilindro(0.04, 0.04, 0.8, BAMBU, { p: [cx, 0.45, z + dz] }, 5);
      b.cilindro(0.03, 0.03, w, BAMBU, { p: [cx, 0.65, z], r: [Math.PI / 2, 0, 0] }, 5);
      b.cilindro(0.03, 0.03, w, BAMBU, { p: [cx, 0.35, z], r: [Math.PI / 2, 0, 0] }, 5);
    }
    // vasos
    if (rnd() < 0.6) {
      for (let i = 0; i < 2; i++) {
        const vz = z - w / 2 + 0.8 + i * 1.1;
        b.cilindro(0.22, 0.16, 0.35, '#b8603a', { p: [s * 6.3, 0.25, vz] }, 10);
        b.esfera(0.32, '#3f9a4a', { p: [s * 6.3, 0.6, vz], s: [1, 0.8, 1], var: 0.3 }, 8);
      }
    }
  }

  /** Telhado de duas aguas (cumeeira paralela a rua). */
  function telhado(b, x, y, z, larg, comp, cor) {
    const ang = 0.5;
    const meia = larg / 2 / Math.cos(ang);
    for (const s of [-1, 1]) {
      b.caixa(meia + 0.1, 0.16, comp, cor, { p: [x + s * larg / 4, y + Math.tan(ang) * larg / 4, z], r: [0, 0, -s * ang], var: 0.08 }, 0);
      // fileiras de telha (relevo)
      for (let i = 1; i < 4; i++) {
        const u = i / 4;
        b.caixa(0.06, 0.06, comp, '#7a2e1e', { p: [x + s * larg / 2 * u, y + Math.tan(ang) * larg / 2 * (1 - u) + 0.1, z], r: [0, 0, -s * ang] }, 0);
      }
    }
    b.caixa(0.3, 0.22, comp + 0.1, '#6e2a1c', { p: [x, y + Math.tan(ang) * larg / 2 + 0.05, z] }, 0);
    // triangulo da empena
    for (const dz of [-comp / 2 + 0.5, comp / 2 - 0.5]) {
      b.add(new THREE.CylinderGeometry(0.01, larg / 2 - 0.3, Math.tan(ang) * larg / 2 - 0.1, 3, 1), '#e9dcc0', { p: [x, y + Math.tan(ang) * larg / 4, z + dz], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.06] });
    }
  }

  function coqueiro(b, x, z, h) {
    const n = 7;
    let px = x;
    let pz = z;
    const incl = (rnd() - 0.5) * 0.5;
    for (let i = 0; i < n; i++) {
      const y = (i + 0.5) * h / n;
      px += incl * 0.18;
      b.cilindro(0.17 - i * 0.012, 0.2 - i * 0.012, h / n + 0.05, i % 2 ? '#8a6a48' : '#7a5c3e', { p: [px, y, pz], r: [0, 0, -incl * 0.3] }, 7);
    }
    const topo = [px, h, pz];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + rnd() * 0.3;
      const cai = 0.35 + rnd() * 0.3;
      b.esfera(1, i % 2 ? '#3fa04a' : '#2f8a3e', {
        p: [topo[0] + Math.cos(a) * 1.0, topo[1] - 0.25, topo[2] + Math.sin(a) * 1.0],
        r: [0, -a, cai], s: [1.5, 0.07, 0.32], var: 0.15,
      }, 8);
    }
    for (let i = 0; i < 3; i++) b.esfera(0.16, '#5a3a1a', { p: [topo[0] + Math.cos(i * 2.1) * 0.22, topo[1] - 0.35, topo[2] + Math.sin(i * 2.1) * 0.22] }, 8);
  }

  function bananeira(b, x, z) {
    b.cilindro(0.12, 0.16, 1.6, '#7a9a3a', { p: [x, 0.8, z] }, 7);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.esfera(1, '#4cae48', { p: [x + Math.cos(a) * 0.7, 1.7, z + Math.sin(a) * 0.7], r: [0, -a, 0.6], s: [0.9, 0.05, 0.3], var: 0.2 }, 8);
    }
  }

  // ---------------------------------------------------------------------------------
  // obstaculos (origem na frente, no chao; o corpo vai para -z)
  const cache = new Map();
  const deCache = (chave, fazer) => {
    if (!cache.has(chave)) cache.set(chave, fazer());
    return cache.get(chave).clone();
  };

  const modelos = {
    /** barreira baixa: cerca de bambu listrada, banco com sacos de arroz ou potes */
    baixo: (v) => deCache(`baixo${v % 3}`, () => {
      const b = new Modelo(rnd);
      const z = -0.35;
      if (v % 3 === 0) {
        for (const x of [-0.85, 0.85]) {
          b.cilindro(0.07, 0.08, 0.95, BAMBU, { p: [x, 0.47, z], m: 'madeira' }, 8);
          b.caixa(0.3, 0.08, 0.4, MADEIRA_ESCURA, { p: [x, 0.04, z] });
        }
        for (const y of [0.32, 0.58, 0.82]) {
          for (let i = 0; i < 6; i++) b.cilindro(0.055, 0.055, 1.9 / 6, i % 2 ? '#f4efe6' : '#e8423a', { p: [-0.95 + (i + 0.5) * 1.9 / 6, y, z], r: [0, 0, Math.PI / 2] }, 10);
        }
      } else if (v % 3 === 1) {
        b.caixa(1.9, 0.1, 0.6, '#9a6436', { p: [0, 0.4, z], m: 'madeira' });
        for (const x of [-0.8, 0.8]) for (const dz of [-0.22, 0.22]) b.caixa(0.08, 0.4, 0.08, MADEIRA_ESCURA, { p: [x, 0.2, z + dz] });
        for (const x of [-0.6, 0, 0.6]) {
          b.caixa(0.55, 0.36, 0.48, '#e8d6a8', { p: [x, 0.64, z], var: 0.1 }, 0.14);
          b.cilindro(0.07, 0.1, 0.08, '#c9b07a', { p: [x, 0.84, z] }, 8);
        }
      } else {
        for (const x of [-0.62, 0, 0.62]) {
          b.torno([[0, 0], [0.22, 0], [0.32, 0.25], [0.3, 0.55], [0.2, 0.7], [0.22, 0.78], [0.16, 0.8]], '#c4693e', { p: [x, 0, z], var: 0.15 }, 14);
          b.esfera(0.2, '#3f9a4a', { p: [x, 0.8, z], var: 0.2 }, 8);
        }
      }
      return b.montar(M);
    }),
    /** caixotes de fruta (quebra com a tacada) */
    quebravel: (v) => deCache(`quebravel${v % 2}`, () => {
      const b = new Modelo(rnd);
      const z = -0.55;
      for (const x of [-0.48, 0.48]) {
        b.caixa(0.9, 0.72, 1.0, '#d9a066', { p: [x, 0.36, z], m: 'madeira', var: 0.1 }, 0.04);
        for (const y of [0.18, 0.54]) b.caixa(0.92, 0.05, 1.02, '#9a6436', { p: [x, y, z], m: 'madeira' }, 0);
      }
      const fruta = v % 2 ? '#ff8a1e' : '#d8283a';
      for (let i = 0; i < 14; i++) {
        b.esfera(0.12, fruta, { p: [-0.8 + (i % 7) * 0.27, 0.8 + (i > 6 ? 0.1 : 0), z - 0.2 + (i > 6 ? 0.35 : 0)], var: 0.2 }, 8);
      }
      return b.montar(M);
    }),
    /** batik pendurado numa armacao de bambu (passa rolando por baixo) */
    alto: (v) => deCache(`alto${v % 2}`, () => {
      const b = new Modelo(rnd);
      const z = -0.3;
      for (const x of [-1.0, 1.0]) b.cilindro(0.07, 0.08, 3.25, BAMBU, { p: [x, 1.62, z], m: 'madeira' }, 8);
      b.cilindro(0.06, 0.06, 2.2, BAMBU, { p: [0, 3.15, z], r: [0, 0, Math.PI / 2], m: 'madeira' }, 8);
      const tons = v % 2 ? ['#2b3a8c', '#d9a43a', '#2b3a8c', '#d9a43a', '#2b3a8c'] : ['#a23a2a', '#f0c060', '#2a6a5a', '#f0c060', '#a23a2a'];
      for (let i = 0; i < 5; i++) b.caixa(0.38, 1.9, 0.05, tons[i], { p: [-0.76 + i * 0.38, 2.1, z], m: 'tecido' }, 0);
      for (let i = 0; i < 9; i++) b.add(new THREE.OctahedronGeometry(0.09, 0), '#f6efe0', { p: [-0.8 + i * 0.2, 2.1 + Math.sin(i) * 0.5, z + 0.04], s: [1, 1.4, 0.3] });
      for (let i = 0; i < 12; i++) b.esfera(0.035, '#f6efe0', { p: [-0.9 + i * 0.165, 1.12, z] }, 6);
      return b.montar(M);
    }),
    /** gerobak: carrinho de comida (bloqueia a faixa; da para pousar em cima) */
    bloco: (v, c) => deCache(`bloco${v % 3}:${Math.round(c * 2) / 2}`, () => {
      const b = new Modelo(rnd);
      const cor = ['#3d7fd1', '#3fae6a', '#d8473a'][v % 3];
      const L = Math.round(c * 2) / 2;
      b.caixa(1.8, 1.15, L, cor, { p: [0, 0.95, -L / 2], m: 'madeira' }, 0.08);
      b.caixa(1.84, 0.12, L + 0.04, '#f4ead2', { p: [0, 1.5, -L / 2] }, 0.03);
      b.caixa(1.84, 0.12, L + 0.04, '#f4ead2', { p: [0, 0.42, -L / 2] }, 0.03);
      b.caixa(1.5, 0.55, L - 0.5, '#bfe6ff', { p: [0, 1.85, -L / 2], m: 'vidro' }, 0.03);
      for (let i = 0; i < Math.floor(L / 0.6); i++) b.esfera(0.13, pick(['#ffcf4a', '#ff8a3a', '#7ad04a', '#f4e6c8']), { p: [-0.45 + (i % 3) * 0.45, 1.72, -0.5 - i * 0.55] }, 8);
      for (const x of [-0.85, 0.85]) for (const zz of [-0.15, -L + 0.15]) b.cilindro(0.04, 0.04, 0.85, '#e8e8e8', { p: [x, 2.05, zz], m: 'metal' }, 6);
      b.caixa(2.05, 0.1, L + 0.3, '#f4ead2', { p: [0, 2.48, -L / 2] }, 0.04);
      for (let i = 0; i < Math.round(L / 0.35); i++) {
        const zz = -0.1 - i * 0.35;
        for (const x of [-1.03, 1.03]) b.cilindro(0.17, 0.17, 0.08, i % 2 ? '#e8323c' : '#ffffff', { p: [x, 2.36, zz], r: [0, 0, Math.PI / 2], s: [1, 1, 1] }, 10);
      }
      for (const x of [-0.95, 0.95]) {
        b.cilindro(0.42, 0.42, 0.1, '#3a2a20', { p: [x, 0.42, -L * 0.65], r: [0, 0, Math.PI / 2] }, 16);
        b.cilindro(0.12, 0.12, 0.13, '#d0d0d0', { p: [x, 0.42, -L * 0.65], r: [0, 0, Math.PI / 2], m: 'metal' }, 10);
      }
      b.caixa(0.1, 0.42, 0.1, MADEIRA_ESCURA, { p: [0, 0.2, -0.3] });
      return b.montar(M);
    }),
    /** becak (triciclo) vindo na contramao */
    movel: (v) => deCache(`movel${v % 2}`, () => {
      const b = new Modelo(rnd);
      const capota = v % 2 ? '#2a7ad1' : '#e8a020';
      // banco do passageiro (na frente, virado para o jogador)
      b.caixa(1.5, 0.5, 0.9, '#d63a3a', { p: [0, 0.95, -0.6] }, 0.1);
      b.caixa(1.5, 0.75, 0.18, '#d63a3a', { p: [0, 1.4, -1.0] }, 0.08);
      b.caixa(1.6, 0.6, 1.0, '#f4ead2', { p: [0, 0.5, -0.6], m: 'madeira' }, 0.06);
      // capota
      b.add(new THREE.CylinderGeometry(0.85, 0.85, 1.1, 16, 1, true, 0, Math.PI), capota, { p: [0, 1.65, -0.85], r: [Math.PI / 2, Math.PI / 2, 0], m: 'tecido' });
      for (let i = 0; i < 10; i++) b.esfera(0.05, '#ffffff', { p: [-0.8 + i * 0.178, 1.62, -0.3] }, 6);
      // rodas
      for (const x of [-0.82, 0.82]) {
        b.cilindro(0.36, 0.36, 0.08, '#222222', { p: [x, 0.36, -0.55], r: [0, 0, Math.PI / 2] }, 18);
        b.cilindro(0.18, 0.18, 0.1, '#d0d0d0', { p: [x, 0.36, -0.55], r: [0, 0, Math.PI / 2], m: 'metal' }, 10);
      }
      b.cilindro(0.36, 0.36, 0.08, '#222222', { p: [0, 0.36, -2.4], r: [0, 0, Math.PI / 2] }, 18);
      // quadro e o banco do condutor
      b.cilindro(0.04, 0.04, 1.6, '#c8c8c8', { p: [0, 0.75, -1.7], r: [Math.PI / 2 - 0.25, 0, 0], m: 'metal' }, 6);
      b.caixa(0.3, 0.1, 0.35, '#2a2a2a', { p: [0, 1.25, -2.2] }, 0.04);
      b.cilindro(0.03, 0.03, 0.7, '#c8c8c8', { p: [0, 1.5, -2.0], r: [0, 0, Math.PI / 2], m: 'metal' }, 6);
      // farol
      b.esfera(0.1, '#fff2c0', { p: [0, 0.95, -0.02], m: 'brilho', k: 3 }, 10);
      const g = b.montar(M);
      g.add(criarBrilhos(T.brilho, [{ p: [0, 0.95, 0.1], cor: '#fff0c0', tam: 3 }]));
      return g;
    }),
    /** fileira de barracas (corre-se no telhado). Modulos de 4 m. */
    plataforma: (c, rampa, v) => {
      const g = new THREE.Group();
      const n = Math.max(1, Math.round(c / 4));
      const L = c / n;
      for (let i = 0; i < n; i++) {
        const mod = deCache(`barraca${(v + i) % 3}`, () => barraca((v + i) % 3));
        mod.position.z = -i * L;
        mod.scale.z = L / 4;
        g.add(mod);
      }
      g.add(deCache('frenteBarraca', frenteBarraca));
      if (rampa) g.add(deCache('rampa', rampaMadeira));
      return g;
    },
  };

  /** Modulo de barraca de 4 m: postes, toldo listrado nos lados, balcao e telhado plano. */
  function barraca(v) {
    const b = new Modelo(rnd);
    const H = ALTURA_PLATAFORMA;
    const listras = [['#e8323c', '#ffffff'], ['#2fb36b', '#ffd23a'], ['#2f7fe0', '#ffffff']][v];
    for (const x of [-0.95, 0.95]) for (const z of [-0.1, -3.9]) b.caixa(0.16, H - 0.15, 0.16, MADEIRA_ESCURA, { p: [x, (H - 0.15) / 2, z], m: 'madeira' }, 0.03);
    // telhado (onde se corre): tabuas
    b.caixa(2.1, 0.16, 4.0, '#b07a45', { p: [0, H - 0.08, -2], m: 'madeira' }, 0.03);
    for (let i = 0; i < 6; i++) b.caixa(2.12, 0.012, 0.03, '#6b4022', { p: [0, H + 0.002, -0.33 - i * 0.67] }, 0);
    b.caixa(0.08, 0.1, 4.0, '#6b4022', { p: [-1.04, H + 0.03, -2] }, 0);
    b.caixa(0.08, 0.1, 4.0, '#6b4022', { p: [1.04, H + 0.03, -2] }, 0);
    // toldo listrado (saia) dos dois lados
    for (const s of [-1, 1]) {
      for (let i = 0; i < 8; i++) {
        b.caixa(0.05, 0.55, 0.5, listras[i % 2], { p: [s * 1.07, H - 0.42, -0.25 - i * 0.5], m: 'tecido' }, 0);
        b.cilindro(0.25, 0.25, 0.05, listras[i % 2], { p: [s * 1.07, H - 0.7, -0.25 - i * 0.5], r: [0, 0, Math.PI / 2], s: [1, 1, 1], m: 'tecido' }, 10);
      }
      // balcao com mercadorias
      b.caixa(0.5, 0.95, 3.6, '#e8d6a8', { p: [s * 0.72, 0.48, -2], m: 'madeira' }, 0.04);
      for (let i = 0; i < 6; i++) {
        const cor = pick(['#ffcf4a', '#ff8a3a', '#7ad04a', '#e8323c', '#f4e6c8', '#8a5ad0']);
        if (i % 2) b.cilindro(0.11, 0.11, 0.28, cor, { p: [s * 0.72, 1.1, -0.5 - i * 0.55] }, 10);
        else b.caixa(0.3, 0.22, 0.3, cor, { p: [s * 0.72, 1.06, -0.5 - i * 0.55] }, 0.05);
      }
    }
    // lampada pendurada
    b.esfera(0.13, '#ffe0a0', { p: [0, H - 0.5, -2], m: 'brilho', k: 3 }, 10);
    const g = b.montar(M);
    g.add(criarBrilhos(T.brilho, [{ p: [0, H - 0.5, -2], cor: '#ffc070', tam: 3 }]));
    return g;
  }

  /** Frente da fileira: parede com placa e lanterninhas (bem visivel: e uma parede). */
  function frenteBarraca() {
    const b = new Modelo(rnd);
    const H = ALTURA_PLATAFORMA;
    b.caixa(2.1, H - 0.2, 0.14, '#c98d55', { p: [0, (H - 0.2) / 2, -0.07], m: 'madeira' }, 0.03);
    for (let i = 0; i < 5; i++) b.caixa(2.12, 0.03, 0.15, '#7a4a2a', { p: [0, 0.35 + i * 0.45, -0.07] }, 0);
    b.caixa(1.5, 0.6, 0.06, '#2a6a5a', { p: [0, 1.75, 0.02] }, 0.03);
    b.caixa(1.3, 0.12, 0.07, '#ffd25a', { p: [0, 1.85, 0.04] }, 0.02);
    b.caixa(0.9, 0.1, 0.07, '#ffffff', { p: [0, 1.65, 0.04] }, 0.02);
    for (const x of [-0.85, 0.85]) {
      b.esfera(0.15, '#ff5a3a', { p: [x, 2.1, 0.12], s: [1, 1.2, 1], m: 'brilho', k: 2.6 }, 10);
    }
    return b.montar(M);
  }

  /** Rampa de tabuas ate o telhado. */
  function rampaMadeira() {
    const b = new Modelo(rnd);
    const H = ALTURA_PLATAFORMA;
    const ang = Math.atan2(H, RAMPA);
    const comp = Math.hypot(H, RAMPA);
    const esp = 0.14;
    const cy = H / 2 - Math.cos(ang) * esp / 2;
    const cz = RAMPA / 2 - Math.sin(ang) * esp / 2;
    b.caixa(1.9, esp, comp, '#c08a52', { p: [0, cy, cz], r: [ang, 0, 0], m: 'madeira' }, 0.03);
    // ripas
    for (let i = 1; i < 12; i++) {
      const u = i / 12;
      b.caixa(1.92, 0.04, 0.06, '#6b4022', { p: [0, H * (1 - u) + 0.01, RAMPA * u], r: [ang, 0, 0] }, 0);
    }
    for (const x of [-0.9, 0.9]) {
      b.caixa(0.08, 0.08, comp, '#7a4a2a', { p: [x, cy + 0.45, cz], r: [ang, 0, 0] }, 0);
      for (const u of [0.25, 0.6]) b.caixa(0.1, H * (1 - u), 0.1, MADEIRA_ESCURA, { p: [x, H * (1 - u) / 2, RAMPA * u], m: 'madeira' }, 0);
    }
    return b.montar(M);
  }

  // ---------------------------------------------------------------------------------
  // perseguidor: galo gigante
  function perseguidor() {
    const raiz = new THREE.Group();
    const corpo = new THREE.Group();
    raiz.add(corpo);
    const b = new Modelo(rnd);
    b.esfera(1.0, '#d4542a', { p: [0, 1.9, 0], s: [0.95, 0.9, 1.15] }, 20);
    b.esfera(0.75, '#f0a040', { p: [0, 1.75, -0.55], s: [0.9, 1, 0.7] }, 16);
    b.esfera(0.55, '#e06a2a', { p: [0, 2.85, -0.75] }, 16);
    for (let i = 0; i < 4; i++) b.esfera(0.17 - i * 0.015, '#e8202a', { p: [0, 3.35 - i * 0.04, -0.95 + i * 0.22] }, 10);
    b.cone(0.16, 0.42, '#ffc21a', { p: [0, 2.82, -1.38], r: [-Math.PI / 2, 0, 0] }, 10);
    b.esfera(0.12, '#e8202a', { p: [0, 2.48, -1.2], s: [0.8, 1.4, 0.8] }, 10);
    for (const x of [-0.27, 0.27]) {
      b.esfera(0.14, '#ffffff', { p: [x, 3.0, -1.1] }, 12);
      b.esfera(0.07, '#111111', { p: [x * 0.95, 3.0, -1.23] }, 8);
      b.caixa(0.22, 0.05, 0.06, '#3a1a10', { p: [x, 3.18, -1.18], r: [0, 0, x > 0 ? 0.4 : -0.4] }, 0.02);
    }
    // cauda
    for (let i = 0; i < 6; i++) {
      const a = -0.9 + i * 0.36;
      b.esfera(1, i % 2 ? '#1f4a3a' : '#2a2a3a', { p: [Math.sin(a) * 0.4, 2.6 + Math.cos(a) * 0.2, 1.15], r: [0.9, a * 0.5, a], s: [0.22, 1.1, 0.12] }, 10);
    }
    corpo.add(b.montar(M));
    // asas e pernas animadas
    const asas = [-1, 1].map((s) => {
      const a = new Modelo(rnd);
      a.esfera(1, '#b84422', { p: [s * 0.25, -0.3, 0], s: [0.22, 0.65, 0.85] }, 12);
      const g = a.montar(M);
      g.position.set(s * 0.85, 2.1, 0.1);
      corpo.add(g);
      return g;
    });
    const pernas = [-1, 1].map((s) => {
      const a = new Modelo(rnd);
      a.cilindro(0.08, 0.08, 1.1, '#ffb21a', { p: [0, -0.55, 0] }, 8);
      for (const r of [-0.5, 0, 0.5]) a.caixa(0.07, 0.07, 0.45, '#ffb21a', { p: [Math.sin(r) * 0.2, -1.08, -0.2 * Math.cos(r)], r: [0, r, 0] }, 0.03);
      const g = a.montar(M);
      g.position.set(s * 0.4, 1.15, 0);
      raiz.add(g);
      return g;
    });
    let fase = 0;
    return {
      raiz,
      /** @param {number} dt @param {number} v */
      atualizar(dt, v) {
        fase += dt * (6 + v * 0.35);
        const s = Math.sin(fase);
        pernas[0].rotation.x = s * 0.8;
        pernas[1].rotation.x = -s * 0.8;
        corpo.position.y = Math.abs(s) * 0.18;
        corpo.rotation.x = -0.12 + Math.sin(fase * 2) * 0.04;
        asas[0].rotation.z = -0.3 - Math.abs(Math.sin(fase * 1.5)) * 0.9;
        asas[1].rotation.z = 0.3 + Math.abs(Math.sin(fase * 1.5)) * 0.9;
      },
    };
  }

  // ---------------------------------------------------------------------------------
  /** Poe o ceu e a luz no grupo do cenario e devolve a nevoa dele. @param {THREE.Group} raiz */
  function montar(raiz) {
    raiz.add(ceu.malha, estrelas, silhuetas, luzQuente);
    return new THREE.Fog('#1a2252', 30, 175);
  }

  /** Aplica a paleta do amanhecer. @param {any} motor @param {number} p */
  function aplicarLuz(motor, p) {
    const c = paletaEm(PALETA, p);
    ceu.u.topo.value.copy(c.topo);
    ceu.u.horizonte.value.copy(c.horiz);
    ceu.u.baixo.value.copy(c.baixo);
    ceu.u.astroCor.value.copy(c.astro);
    ceu.u.brilho.value = c.brilhoAstro;
    // a lua desce e o sol sobe atras dela (mesma direcao, so a cor muda)
    ceu.u.astroDir.value.set(0.35, 0.32 - p * 0.24, -1).normalize();
    ceu.u.astroTam.value = 0.0016 + p * 0.0012;
    /** @type {THREE.PointsMaterial} */ (estrelas.material).opacity = c.estrelas;
    estrelas.visible = c.estrelas > 0.02;
    const cena = motor.cena;
    cena.fog.color.copy(c.nevoa);
    motor.hemi.color.copy(c.hemiCeu);
    motor.hemi.groundColor.copy(c.hemiChao);
    motor.hemi.intensity = c.hemi;
    motor.sol.color.copy(c.sol);
    motor.sol.intensity = c.solI;
    motor.dirSol.set(-9, 20, -4 - p * 6);
    cena.environmentIntensity = c.env;
    motor.renderer.toneMappingExposure = c.exp;
    luzQuente.intensity = c.luzQ;
    matSilhueta.color.copy(c.silh);
    lanternas = c.lanternas;
  }
  let lanternas = 1;

  /** @param {number} dt @param {{ camera: THREE.Camera, d: number, x: number, y: number }} e */
  function atualizar(dt, e) {
    ceu.malha.position.copy(e.camera.position);
    estrelas.position.copy(e.camera.position);
    silhuetas.position.set(e.camera.position.x, 0, e.camera.position.z);
    luzQuente.position.set(e.x * 0.6, 4.2, -3.5);
    return lanternas;
  }

  return {
    nome: 'vila',
    montar,
    trecho,
    modelos,
    perseguidor,
    aplicarLuz,
    atualizar,
    coresQuebra: { quebravel: ['#d9a066', '#9a6436', '#ff8a1e', '#d8283a'], padrao: ['#c98d55', '#7a4a2a', '#e8d6a8'] },
    corPoeira: '#d8b48a',
  };
}
