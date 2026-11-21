// Cenario "Rio de toras": a pista e feita de toras amarradas boiando num rio que desce ate a
// serraria. Pinheiros nas margens, montanhas ao fundo, manha clareando. Vaos de agua (pular),
// troncos atravessados, serras girando, balsas de toras (plataformas). Perseguidor: castor.
import * as THREE from 'three';
import { Modelo } from '../modelo.js';
import { criarCeu, anelSilhuetas, paletaEm } from './comum.js';
import { texturaOndas } from '../texturas.js';
import { FAIXA, RAMPA, ALTURA_PLATAFORMA } from '../../jogo/pista.js';

const PALETA = [
  { p: 0, topo: '#78acea', horiz: '#ffd7a2', baixo: '#a8c0a0', nevoa: '#f0dcbc', hemiCeu: '#d6e8ff', hemiChao: '#6b8a4a', hemi: 0.95, sol: '#ffcf8f', solI: 2.5, env: 0.85, astro: '#fff1c0', brilhoAstro: 0.9, exp: 1.0, agua: '#2a9cc0', silh: '#7d9ab8' },
  { p: 1, topo: '#3a8ce0', horiz: '#d2ebff', baixo: '#a0c4d0', nevoa: '#d2e8f4', hemiCeu: '#e6f2ff', hemiChao: '#6a9a4a', hemi: 1.05, sol: '#fff6e8', solI: 2.9, env: 1.0, astro: '#ffffff', brilhoAstro: 0.6, exp: 1.0, agua: '#2aa8cc', silh: '#8fb0cc' },
];
const VERDES = ['#2f7a3e', '#3a8a46', '#2a6a3a', '#41964d'];
const TORA = '#a8784e';
const PASSO_TORA = 0.52;

/**
 * @param {{ materiais: Record<string, THREE.Material>, texturas: any, rnd: () => number }} ctx
 */
export function criarRio(ctx) {
  const { materiais: M0, texturas: T, rnd } = ctx;
  const ondas = texturaOndas();
  ondas.repeat.set(10, 60);
  const matAgua = new THREE.MeshStandardMaterial({ color: '#2a9cc0', roughness: 0.32, metalness: 0, envMapIntensity: 0.1, normalMap: ondas, normalScale: new THREE.Vector2(0.45, 0.45) });
  const aneisTora = T.aneis;
  const M = {
    ...M0,
    grama: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: T.chaoVila }),
    anel: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, map: aneisTora }),
  };
  const pick = (/** @type {any[]} */ l) => l[Math.floor(rnd() * l.length)];

  // ceu, montanhas e nuvens
  const ceu = criarCeu();
  const formas = [];
  for (let i = 0; i < 26; i++) {
    const ang = -Math.PI * 0.98 + (i / 26) * Math.PI * 0.96;
    const h = 40 + rnd() * 60;
    formas.push({ geo: new THREE.ConeGeometry(30 + rnd() * 30, h, 6), ang, y: h / 2 - 4 });
  }
  const montanhas = anelSilhuetas(formas, '#ffffff', 340);
  const matMontanha = /** @type {THREE.MeshBasicMaterial} */ (/** @type {THREE.Mesh} */ (montanhas.children[0]).material);
  const nuvens = (() => {
    const b = new Modelo(rnd);
    for (let i = 0; i < 14; i++) {
      const ang = -Math.PI * 0.95 + rnd() * Math.PI * 0.9;
      const r = 260;
      const cx = Math.cos(ang) * r;
      const cz = Math.sin(ang) * r;
      const y = 70 + rnd() * 50;
      for (let j = 0; j < 5; j++) b.esfera(8 + rnd() * 8, '#ffffff', { p: [cx + (j - 2) * 9, y + rnd() * 5, cz + (rnd() - 0.5) * 6], s: [1, 0.6, 1] }, 10);
    }
    return b.montar({ liso: new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.92 }) }, { sombra: false, recebe: false });
  })();

  // agua: um plano grande que acompanha o jogador
  const agua = new THREE.Mesh(new THREE.PlaneGeometry(90, 420, 1, 1), matAgua);
  agua.rotation.x = -Math.PI / 2;
  agua.position.y = -0.32;
  agua.receiveShadow = true;

  // pista de toras: InstancedMesh com uma tora atravessada por posicao
  const geoTora = new THREE.CylinderGeometry(0.25, 0.25, FAIXA - 0.25, 12, 1);
  geoTora.rotateZ(Math.PI / 2);
  const matTora = new THREE.MeshStandardMaterial({ map: T.casca.mapa, normalMap: T.casca.normal, roughness: 0.85 });
  const MAXT = 1700;
  const toras = new THREE.InstancedMesh(geoTora, matTora, MAXT);
  toras.castShadow = false;
  toras.receiveShadow = true;
  toras.frustumCulled = false;
  toras.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const corTora = new THREE.Color();
  for (let i = 0; i < MAXT; i++) toras.setColorAt(i, corTora.setHSL(0.07, 0.35, 0.62 + ((i * 7919) % 13) / 60));
  // cordas (amarracao) a cada 4 toras
  const cordas = new THREE.InstancedMesh(new THREE.TorusGeometry(0.262, 0.022, 6, 14), new THREE.MeshStandardMaterial({ color: '#5e4529', roughness: 0.95 }), 900);
  cordas.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cordas.frustumCulled = false;

  // ---------------------------------------------------------------------------------
  // margens (40 m): grama, pedras, pinheiros, pilhas de toras e as vezes a serraria
  function trecho() {
    const b = new Modelo(rnd);
    const gira = [];
    for (const s of [-1, 1]) {
      // barranco
      b.caixa(30, 1.2, 40, '#6fae55', { p: [s * 27, 0.0, -20], m: 'grama' }, 0);
      b.caixa(2.4, 0.9, 40, '#8a7a5a', { p: [s * 12.6, -0.25, -20], r: [0, 0, s * 0.35] }, 0);
      for (let i = 0; i < 9; i++) b.esfera(0.5 + rnd() * 0.7, '#8c8c86', { p: [s * (11.8 + rnd() * 1.4), 0.0, -rnd() * 40], s: [1, 0.6, 1], var: 0.25 }, 8);
      // pinheiros
      for (let i = 0; i < 9; i++) {
        const x = s * (15 + rnd() * 20);
        const z = -rnd() * 40;
        pinheiro(b, x, z, 5 + rnd() * 6);
      }
      // arbustos e flores
      for (let i = 0; i < 8; i++) b.esfera(0.6 + rnd() * 0.5, pick(VERDES), { p: [s * (14 + rnd() * 3), 0.7, -rnd() * 40], var: 0.2 }, 8);
      for (let i = 0; i < 14; i++) b.esfera(0.09, pick(['#ffffff', '#ffd23a', '#ff6a8a', '#b48ad8']), { p: [s * (14 + rnd() * 5), 0.65, -rnd() * 40] }, 6);
      // pilha de toras na margem
      if (rnd() < 0.6) {
        const z = -5 - rnd() * 30;
        const x = s * 16.5;
        for (let l = 0; l < 3; l++) {
          for (let k = 0; k < 3 - l; k++) {
            b.cilindro(0.38, 0.38, 4, TORA, { p: [x, 0.98 + l * 0.66, z - 0.8 + k * 0.78 + l * 0.39], r: [0, 0, Math.PI / 2], m: 'casca', var: 0.15 }, 12);
          }
        }
      }
    }
    // serraria numa das margens
    if (rnd() < 0.45) {
      const s = rnd() < 0.5 ? -1 : 1;
      const x = s * 19;
      const z = -20;
      b.caixa(8, 5, 12, '#b5763f', { p: [x, 3.1, z], m: 'madeira' }, 0);
      for (let i = 0; i < 9; i++) b.caixa(0.1, 5, 0.12, '#7a4a2a', { p: [x - s * 4.05, 3.1, z - 5.6 + i * 1.4] }, 0);
      b.caixa(9.5, 0.3, 6.4, '#7a3a2a', { p: [x - s * 1.4, 6.3, z - 3.0], r: [-0.5, 0, 0] }, 0);
      b.caixa(9.5, 0.3, 6.4, '#7a3a2a', { p: [x - s * 1.4, 6.3, z + 3.0], r: [0.5, 0, 0] }, 0);
      b.caixa(1.6, 1.4, 0.1, '#ffe8a0', { p: [x - s * 4.06, 3.6, z - 2], r: [0, Math.PI / 2, 0], m: 'brilho', k: 1.2 }, 0);
      b.cilindro(0.5, 0.6, 3, '#6a6a70', { p: [x + s * 2, 7.5, z + 3], m: 'metal' }, 10);
      // roda d'agua (gira)
      const rb = new Modelo(rnd);
      rb.cilindro(2.2, 2.2, 0.25, '#8a5a32', { r: [0, 0, Math.PI / 2], m: 'madeira' }, 20);
      rb.cilindro(1.6, 1.6, 0.3, '#5a3a22', { r: [0, 0, Math.PI / 2], m: 'madeira' }, 20);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        rb.caixa(0.9, 0.12, 0.7, '#a86a3a', { p: [0, Math.sin(a) * 2.3, Math.cos(a) * 2.3], r: [a, 0, 0], m: 'madeira' }, 0);
      }
      const roda = rb.montar(M);
      roda.position.set(x - s * 4.6, 1.6, z + 2);
      roda.userData.gira = 1.2;
      gira.push(roda);
    }
    const g = b.montar(M);
    for (const r of gira) g.add(r);
    return g;
  }

  function pinheiro(b, x, z, h) {
    b.cilindro(0.18, 0.26, h * 0.3, '#6a4a2a', { p: [x, 0.6 + h * 0.15, z] }, 6);
    const cor = pick(VERDES);
    for (let i = 0; i < 3; i++) {
      const y = 0.6 + h * (0.3 + i * 0.22);
      b.cone(h * (0.3 - i * 0.07), h * 0.38, cor, { p: [x, y + h * 0.14, z], var: 0.12 }, 8);
    }
  }

  // ---------------------------------------------------------------------------------
  const cache = new Map();
  const deCache = (chave, fazer) => {
    if (!cache.has(chave)) cache.set(chave, fazer());
    return cache.get(chave).clone();
  };

  /** tora atravessada (horizontal, eixo x) */
  function toraX(b, raio, comp, p, cor = TORA) {
    b.cilindro(raio, raio, comp, cor, { p, r: [0, 0, Math.PI / 2], m: 'casca', var: 0.1 }, 16);
    for (const s of [-1, 1]) b.add(new THREE.CircleGeometry(raio * 0.96, 16), '#ffffff', { p: [p[0] + s * (comp / 2 + 0.002), p[1], p[2]], r: [0, s * Math.PI / 2, 0], m: 'anel' });
  }

  const modelos = {
    baixo: (v) => deCache(`baixo${v % 2}`, () => {
      const b = new Modelo(rnd);
      if (v % 2 === 0) {
        toraX(b, 0.42, 2.05, [0, 0.42, -0.35]);
        for (let i = 0; i < 4; i++) b.esfera(0.16, '#5aa04a', { p: [-0.7 + i * 0.45, 0.8, -0.35 + (rnd() - 0.5) * 0.3], s: [1.3, 0.35, 1], var: 0.2 }, 8);
        b.cilindro(0.04, 0.05, 0.18, '#f0e6d0', { p: [0.55, 0.92, -0.25] }, 6);
        b.esfera(0.12, '#e8323c', { p: [0.55, 1.02, -0.25], s: [1, 0.55, 1] }, 10);
      } else {
        b.esfera(0.75, '#8c8c86', { p: [0, 0.2, -0.35], s: [1.3, 0.85, 0.6], var: 0.1 }, 10);
        b.esfera(0.3, '#5aa04a', { p: [0.3, 0.76, -0.35], s: [1.4, 0.3, 1.2] }, 8);
      }
      return b.montar(M);
    }),
    quebravel: (v) => deCache(`quebravel${v % 2}`, () => {
      const b = new Modelo(rnd);
      for (const x of [-0.5, 0.5]) {
        if (v % 2) {
          b.torno([[0, 0], [0.34, 0], [0.42, 0.45], [0.34, 0.92], [0, 0.92]], '#b07a45', { p: [x, 0.0, -0.55], m: 'madeira' }, 16);
          for (const y of [0.15, 0.77]) b.toro(0.37, 0.025, '#5a5a60', { p: [x, y, -0.55], r: [Math.PI / 2, 0, 0], m: 'metal' });
        } else {
          b.caixa(0.88, 0.85, 0.95, '#d9a066', { p: [x, 0.43, -0.55], m: 'madeira' }, 0.04);
          b.caixa(0.9, 0.06, 0.97, '#7a4a2a', { p: [x, 0.43, -0.55] }, 0);
        }
      }
      b.caixa(0.5, 0.18, 0.4, '#e8d6a8', { p: [0, 0.98, -0.5] }, 0.06);
      return b.montar(M);
    }),
    alto: () => deCache('alto', () => {
      const b = new Modelo(rnd);
      const z = -0.3;
      for (const x of [-1.05, 1.05]) b.cilindro(0.11, 0.13, 3.6, '#7a5232', { p: [x, 1.5, z], m: 'casca' }, 8);
      toraX(b, 0.12, 2.4, [0, 3.2, z], '#7a5232');
      for (const x of [-0.6, 0.6]) b.cilindro(0.02, 0.02, 1.55, '#d8c08a', { p: [x, 2.4, z] }, 4);
      toraX(b, 0.3, 2.0, [0, 1.38, z]);
      // placa de perigo (sem texto): listras
      for (let i = 0; i < 5; i++) b.caixa(0.32, 0.18, 0.04, i % 2 ? '#222222' : '#ffd23a', { p: [-0.64 + i * 0.32, 1.38, z + 0.31], r: [0, 0, 0.5] }, 0);
      return b.montar(M);
    }),
    bloco: (v, c) => deCache(`bloco:${Math.round(c * 2) / 2}`, () => {
      const L = Math.round(c * 2) / 2;
      const b = new Modelo(rnd);
      b.caixa(1.95, 0.5, L, '#8a5a32', { p: [0, 0.05, -L / 2], m: 'madeira' }, 0.05);
      for (let i = 0; i < 4; i++) toraX(b, 0.22, 1.95, [0, -0.15, -0.3 - i * (L - 0.6) / 3]);
      for (const x of [-0.9, 0.9]) {
        b.caixa(0.15, 2.2, 0.15, '#5a5a60', { p: [x, 1.4, -L / 2 + 0.6], m: 'metal' }, 0.03);
        b.caixa(0.15, 2.2, 0.15, '#5a5a60', { p: [x, 1.4, -L / 2 - 0.6], m: 'metal' }, 0.03);
      }
      b.caixa(1.95, 0.18, 1.5, '#ffb21a', { p: [0, 2.45, -L / 2] }, 0.04);
      for (let i = 0; i < 6; i++) b.caixa(0.2, 0.19, 1.52, i % 2 ? '#222222' : '#ffb21a', { p: [-0.83 + i * 0.33, 2.45, -L / 2], r: [0, 0, 0.6] }, 0);
      const g = b.montar(M);
      // lamina (gira em torno de x)
      const s = new Modelo(rnd);
      s.cilindro(1.0, 1.0, 0.05, '#dfe6ee', { r: [0, 0, Math.PI / 2], m: 'metal' }, 28);
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        s.cone(0.09, 0.2, '#dfe6ee', { p: [0, Math.sin(a) * 1.05, Math.cos(a) * 1.05], r: [a, 0, 0], s: [0.4, 1, 1], m: 'metal' }, 4);
      }
      s.cilindro(0.18, 0.18, 0.12, '#e8323c', { r: [0, 0, Math.PI / 2] }, 12);
      const lamina = s.montar(M);
      lamina.position.set(0, 1.35, -L / 2);
      lamina.userData.gira = 14;
      g.add(lamina);
      return g;
    }),
    movel: () => deCache('movel', () => {
      const g = new THREE.Group();
      const b = new Modelo(rnd);
      toraX(b, 1.12, 1.9, [0, 0, 0]);
      b.esfera(0.25, '#5aa04a', { p: [0.4, 1.0, 0.3], s: [1.4, 0.4, 1] }, 8);
      const rolo = b.montar(M);
      rolo.position.set(0, 1.12, -1.2);
      rolo.userData.rola = 1.12;
      g.add(rolo);
      return g;
    }),
    plataforma: (c, rampa, v) => {
      const g = new THREE.Group();
      const n = Math.max(1, Math.round(c / 4));
      const L = c / n;
      for (let i = 0; i < n; i++) {
        const mod = deCache(`balsa${(v + i) % 2}`, () => balsa((v + i) % 2));
        mod.position.z = -i * L;
        mod.scale.z = L / 4;
        g.add(mod);
      }
      g.add(deCache('frenteBalsa', frenteBalsa));
      if (rampa) g.add(deCache('rampaBalsa', rampaBalsa));
      return g;
    },
  };

  /** Modulo de balsa de 4 m: toras empilhadas e um deque de tabuas no topo. */
  function balsa(v) {
    const b = new Modelo(rnd);
    const H = ALTURA_PLATAFORMA;
    for (let i = 0; i < 4; i++) b.cilindro(0.3, 0.3, 4, TORA, { p: [-0.75 + i * 0.5, 0.15, -2], r: [Math.PI / 2, 0, 0], m: 'casca', var: 0.12 }, 12);
    for (let i = 0; i < 3; i++) b.cilindro(0.38, 0.38, 4, TORA, { p: [-0.62 + i * 0.62, 0.95, -2], r: [Math.PI / 2, 0, 0], m: 'casca', var: 0.12 }, 12);
    for (let i = 0; i < 4; i++) b.cilindro(0.3, 0.3, 4, TORA, { p: [-0.75 + i * 0.5, 1.75, -2], r: [Math.PI / 2, 0, 0], m: 'casca', var: 0.12 }, 12);
    b.caixa(2.05, 0.28, 4.0, '#c08a52', { p: [0, H - 0.14, -2], m: 'madeira' }, 0.03);
    for (let i = 0; i < 8; i++) b.caixa(2.07, 0.01, 0.025, '#6b4022', { p: [0, H + 0.002, -0.25 - i * 0.5] }, 0);
    // amarracao: cordas por fora das toras, nas pontas do modulo
    for (const z of [-0.35, -3.65]) {
      b.caixa(2.12, 0.06, 0.07, '#5a4026', { p: [0, 2.2, z] }, 0);
      for (const x of [-1.04, 1.04]) b.caixa(0.06, 2.0, 0.07, '#5a4026', { p: [x, 1.2, z] }, 0);
    }
    if (v === 1) {
      b.cilindro(0.06, 0.06, 1.4, '#7a5232', { p: [0.85, H + 0.7, -2] }, 6);
      b.caixa(0.04, 0.5, 0.8, '#e8323c', { p: [0.85, H + 1.15, -2.4], m: 'tecido' }, 0);
    }
    return b.montar(M);
  }

  function frenteBalsa() {
    const b = new Modelo(rnd);
    for (let i = 0; i < 4; i++) b.add(new THREE.CircleGeometry(0.29, 16), '#ffffff', { p: [-0.75 + i * 0.5, 0.15, 0.002], m: 'anel' });
    for (let i = 0; i < 3; i++) b.add(new THREE.CircleGeometry(0.37, 16), '#ffffff', { p: [-0.62 + i * 0.62, 0.95, 0.002], m: 'anel' });
    for (let i = 0; i < 4; i++) b.add(new THREE.CircleGeometry(0.29, 16), '#ffffff', { p: [-0.75 + i * 0.5, 1.75, 0.002], m: 'anel' });
    b.caixa(2.05, 0.3, 0.1, '#7a4a2a', { p: [0, ALTURA_PLATAFORMA - 0.15, 0.0] }, 0.03);
    return b.montar(M);
  }

  function rampaBalsa() {
    const b = new Modelo(rnd);
    const H = ALTURA_PLATAFORMA;
    const ang = Math.atan2(H, RAMPA);
    const comp = Math.hypot(H, RAMPA);
    const esp = 0.16;
    const cy = H / 2 - Math.cos(ang) * esp / 2;
    const cz = RAMPA / 2 - Math.sin(ang) * esp / 2;
    b.caixa(1.95, esp, comp, '#c08a52', { p: [0, cy, cz], r: [ang, 0, 0], m: 'madeira' }, 0.03);
    for (let i = 1; i < 14; i++) {
      const u = i / 14;
      b.caixa(1.97, 0.04, 0.05, '#6b4022', { p: [0, H * (1 - u) + 0.01, RAMPA * u], r: [ang, 0, 0] }, 0);
    }
    for (const x of [-0.7, 0.7]) b.cilindro(0.26, 0.3, comp, TORA, { p: [x, cy - 0.3, cz], r: [ang + Math.PI / 2, 0, 0], m: 'casca' }, 10);
    return b.montar(M);
  }

  // ---------------------------------------------------------------------------------
  function perseguidor() {
    const raiz = new THREE.Group();
    const corpo = new THREE.Group();
    raiz.add(corpo);
    const b = new Modelo(rnd);
    b.esfera(0.95, '#8a5a33', { p: [0, 1.55, 0], s: [1, 1.1, 1.2] }, 20);
    b.esfera(0.7, '#c89a6a', { p: [0, 1.4, -0.6], s: [0.9, 1.05, 0.6] }, 16);
    b.esfera(0.62, '#8a5a33', { p: [0, 2.55, -0.55] }, 18);
    b.esfera(0.36, '#c89a6a', { p: [0, 2.38, -1.02], s: [1.2, 0.85, 0.9] }, 14);
    b.esfera(0.11, '#1a1010', { p: [0, 2.55, -1.3] }, 10);
    for (const x of [-0.08, 0.08]) b.caixa(0.14, 0.26, 0.06, '#fff2c0', { p: [x, 2.12, -1.2] }, 0.03);
    for (const x of [-0.26, 0.26]) {
      b.esfera(0.13, '#ffffff', { p: [x, 2.78, -0.98] }, 12);
      b.esfera(0.065, '#111111', { p: [x * 0.95, 2.78, -1.1] }, 8);
      b.caixa(0.2, 0.05, 0.06, '#3a2010', { p: [x, 2.95, -1.05], r: [0, 0, x > 0 ? 0.45 : -0.45] }, 0.02);
      b.esfera(0.16, '#6a4026', { p: [x * 1.8, 3.08, -0.5] }, 10);
    }
    // cauda chata (remo) com textura cruzada
    b.caixa(0.9, 0.12, 1.4, '#4a3324', { p: [0, 0.5, 1.25], r: [-0.35, 0, 0] }, 0.08);
    for (let i = 0; i < 5; i++) b.caixa(0.92, 0.13, 0.03, '#2e2018', { p: [0, 0.5 + (i - 2) * 0.09, 1.25 + (i - 2) * 0.25], r: [-0.35, 0, 0] }, 0);
    corpo.add(b.montar(M));
    const bracos = [-1, 1].map((s) => {
      const a = new Modelo(rnd);
      a.esfera(0.2, '#7a4a2a', { p: [0, -0.3, 0], s: [0.8, 1.6, 0.8] }, 10);
      const g = a.montar(M);
      g.position.set(s * 0.8, 1.8, -0.6);
      corpo.add(g);
      return g;
    });
    const pernas = [-1, 1].map((s) => {
      const a = new Modelo(rnd);
      a.esfera(0.32, '#7a4a2a', { p: [0, -0.3, 0], s: [0.9, 1.2, 1] }, 10);
      a.caixa(0.4, 0.12, 0.6, '#3a2618', { p: [0, -0.62, -0.15] }, 0.05);
      const g = a.montar(M);
      g.position.set(s * 0.55, 0.7, 0.1);
      raiz.add(g);
      return g;
    });
    let fase = 0;
    return {
      raiz,
      atualizar(dt, v) {
        fase += dt * (7 + v * 0.35);
        const s = Math.sin(fase);
        pernas[0].rotation.x = s * 0.9;
        pernas[1].rotation.x = -s * 0.9;
        bracos[0].rotation.x = -s * 0.8 - 0.4;
        bracos[1].rotation.x = s * 0.8 - 0.4;
        corpo.position.y = Math.abs(s) * 0.15;
        corpo.rotation.z = s * 0.06;
      },
    };
  }

  // ---------------------------------------------------------------------------------
  // a vila tem uma luz pontual; o rio tambem (quase apagada) para os shaders serem os mesmos
  const luzReflexo = new THREE.PointLight('#bfefff', 0.0, 10, 2);
  /** @param {THREE.Group} raiz */
  function montar(raiz) {
    raiz.add(ceu.malha, montanhas, nuvens, agua, toras, cordas, luzReflexo);
    return new THREE.Fog('#f0dcbc', 70, 280);
  }

  function aplicarLuz(motor, p) {
    const c = paletaEm(PALETA, p);
    ceu.u.topo.value.copy(c.topo);
    ceu.u.horizonte.value.copy(c.horiz);
    ceu.u.baixo.value.copy(c.baixo);
    ceu.u.astroCor.value.copy(c.astro);
    ceu.u.brilho.value = c.brilhoAstro;
    ceu.u.astroDir.value.set(-0.45, 0.22 + p * 0.3, -1).normalize();
    ceu.u.astroTam.value = 0.0022;
    motor.cena.fog.color.copy(c.nevoa);
    motor.hemi.color.copy(c.hemiCeu);
    motor.hemi.groundColor.copy(c.hemiChao);
    motor.hemi.intensity = c.hemi;
    motor.sol.color.copy(c.sol);
    motor.sol.intensity = c.solI;
    motor.dirSol.set(-12, 22 + p * 6, -10);
    motor.cena.environmentIntensity = c.env;
    motor.renderer.toneMappingExposure = c.exp;
    matAgua.color.copy(c.agua);
    matMontanha.color.copy(c.silh);
  }

  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3(1, 1, 1);

  /**
   * Agua, toras da pista (com os vaos) e ceu.
   * @param {number} dt @param {{ camera: THREE.Camera, d: number, t: number, ents: import('../../jogo/pista.js').Entidade[] }} e
   */
  function atualizar(dt, e) {
    ceu.malha.position.copy(e.camera.position);
    montanhas.position.set(e.camera.position.x, -6, e.camera.position.z);
    nuvens.position.set(e.camera.position.x * 0.5, 0, e.camera.position.z);
    agua.position.z = -150;
    // a correnteza: a agua corre na direcao do jogador mais rapido que a pista
    ondas.offset.y = -(e.d * 0.012 + e.t * 0.05) % 1;
    ondas.offset.x = Math.sin(e.t * 0.3) * 0.02;
    // vaos visiveis
    const vaos = [];
    for (const v of e.ents) if (v.tipo === 'vao' && v.z < e.d + 240 && v.z + v.c > e.d - 20) vaos.push(v);
    let n = 0;
    let nc = 0;
    const k0 = Math.floor((e.d - 14) / PASSO_TORA);
    const k1 = Math.floor((e.d + 230) / PASSO_TORA);
    for (let k = k0; k <= k1 && n < MAXT - 3; k++) {
      const z = k * PASSO_TORA;
      for (let f = -1; f <= 1; f++) {
        let noVao = false;
        for (const v of vaos) {
          if (v.faixa === f && z > v.z - 0.2 && z < v.z + v.c + 0.2) {
            noVao = true;
            break;
          }
        }
        if (noVao) continue;
        const bob = Math.sin(e.t * 2.2 + k * 0.7 + f * 1.3) * 0.035;
        _p.set(f * FAIXA, -0.25 + bob, e.d - z);
        _q.setFromEuler(_e.set(0, 0, Math.sin(e.t * 1.7 + k * 0.4 + f) * 0.025));
        _m.compose(_p, _q, _s);
        toras.setMatrixAt(n++, _m);
        if (k % 6 === 0 && nc < 890) {
          for (const dx of [-0.75, 0.75]) {
            _p.set(f * FAIXA + dx, -0.25 + bob, e.d - z);
            _q.setFromEuler(_e.set(0, Math.PI / 2, 0));
            _m.compose(_p, _q, _s.set(1, 1, 1));
            cordas.setMatrixAt(nc++, _m);
          }
        }
      }
    }
    toras.count = n;
    cordas.count = nc;
    toras.instanceMatrix.needsUpdate = true;
    cordas.instanceMatrix.needsUpdate = true;
    return 0;
  }

  return {
    nome: 'rio',
    montar,
    trecho,
    modelos,
    perseguidor,
    aplicarLuz,
    atualizar,
    coresQuebra: { quebravel: ['#d9a066', '#b07a45', '#7a4a2a', '#e8d6a8'], padrao: ['#a8784e', '#6a4a2a'] },
    corPoeira: '#bfeaff',
  };
}
