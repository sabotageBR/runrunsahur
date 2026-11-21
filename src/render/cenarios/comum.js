// Pecas comuns aos cenarios: ceu em degrade com sol/lua, estrelas, silhuetas no horizonte,
// pontos de brilho (lanternas), paletas que mudam com o amanhecer e os poderes.
import * as THREE from 'three';
import { Modelo } from '../modelo.js';

/** Interpola paletas de chaves { p, ...cores e numeros } em p (0..1). */
export function paletaEm(chaves, p) {
  let a = chaves[0];
  let b = chaves[chaves.length - 1];
  for (let i = 0; i < chaves.length - 1; i++) {
    if (p >= chaves[i].p && p <= chaves[i + 1].p) {
      a = chaves[i];
      b = chaves[i + 1];
      break;
    }
  }
  const t = b.p === a.p ? 0 : Math.max(0, Math.min(1, (p - a.p) / (b.p - a.p)));
  /** @type {Record<string, any>} */
  const r = {};
  for (const k of Object.keys(a)) {
    if (k === 'p') continue;
    if (typeof a[k] === 'number') r[k] = a[k] + (b[k] - a[k]) * t;
    else r[k] = new THREE.Color(a[k]).lerp(new THREE.Color(b[k]), t);
  }
  return r;
}

/** Ceu: esfera com degrade, disco do sol/lua e brilho em volta. */
export function criarCeu() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topo: { value: new THREE.Color('#0b1030') },
      horizonte: { value: new THREE.Color('#2a2f6a') },
      baixo: { value: new THREE.Color('#10122a') },
      astroDir: { value: new THREE.Vector3(0.3, 0.25, -1).normalize() },
      astroCor: { value: new THREE.Color('#fff4d0') },
      astroTam: { value: 0.03 },
      brilho: { value: 0.5 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: `
      uniform vec3 topo; uniform vec3 horizonte; uniform vec3 baixo;
      uniform vec3 astroDir; uniform vec3 astroCor; uniform float astroTam; uniform float brilho;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 cor = h > 0.0 ? mix(horizonte, topo, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(horizonte, baixo, clamp(-h * 4.0, 0.0, 1.0));
        float d = 1.0 - dot(normalize(vDir), astroDir);
        float disco = smoothstep(astroTam, astroTam * 0.6, d);
        float halo = exp(-d * 70.0) * brilho + exp(-d * 9.0) * brilho * 0.15;
        cor += astroCor * (disco * 1.6 + halo);
        gl_FragColor = vec4(cor, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const ceu = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat);
  ceu.frustumCulled = false;
  ceu.renderOrder = -10;
  return { malha: ceu, u: mat.uniforms };
}

/** Estrelas (pontos) num domo. @param {() => number} rnd */
export function criarEstrelas(rnd, n = 700) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const az = rnd() * Math.PI * 2;
    const el = Math.asin(0.08 + rnd() * 0.92);
    pos[i * 3] = Math.cos(el) * Math.cos(az) * 450;
    pos[i * 3 + 1] = Math.sin(el) * 450;
    pos[i * 3 + 2] = Math.cos(el) * Math.sin(az) * 450;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 1, fog: false, depthWrite: false });
  const pontos = new THREE.Points(geo, mat);
  pontos.frustumCulled = false;
  pontos.renderOrder = -9;
  return pontos;
}

/**
 * Pontos de brilho aditivos (lanternas, janelas): uma draw call por grupo.
 * @param {THREE.Texture} textura @param {{ p: number[], cor: string, tam: number }[]} lista
 */
export function criarBrilhos(textura, lista) {
  const pos = new Float32Array(lista.length * 3);
  const cor = new Float32Array(lista.length * 3);
  const tam = new Float32Array(lista.length);
  const c = new THREE.Color();
  lista.forEach((b, i) => {
    pos.set(b.p, i * 3);
    c.set(b.cor);
    cor.set([c.r, c.g, c.b], i * 3);
    tam[i] = b.tam;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(cor, 3));
  geo.setAttribute('tam', new THREE.BufferAttribute(tam, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { mapa: { value: textura }, intensidade: { value: 1 }, escala: { value: 600 } },
    vertexShader: `
      attribute float tam; varying vec3 vCor; uniform float escala;
      void main() {
        vCor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = tam * escala / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D mapa; uniform float intensidade; varying vec3 vCor;
      void main() {
        vec4 t = texture2D(mapa, gl_PointCoord);
        gl_FragColor = vec4(vCor * t.rgb * intensidade, t.a * intensidade);
      }`,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(geo, mat);
  p.frustumCulled = false;
  return p;
}

/** Silhuetas no horizonte: um anel de formas chapadas que acompanha a camera. */
export function anelSilhuetas(formas, cor, raio = 320) {
  const b = new Modelo();
  for (const f of formas) b.add(f.geo, cor, { p: [Math.cos(f.ang) * raio, f.y || 0, Math.sin(f.ang) * raio], r: [0, -f.ang + Math.PI / 2, 0], s: f.s || 1 });
  const g = b.montar({ liso: new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }) }, { sombra: false, recebe: false });
  g.renderOrder = -8;
  return g;
}

/**
 * Moeda (geometria) e poderes (modelos).
 * @param {Record<string, THREE.Material>} m
 */
export function geometriaMoeda() {
  const perfil = [[0, -0.05], [0.22, -0.05], [0.27, -0.025], [0.27, 0.025], [0.22, 0.05], [0.15, 0.05], [0.13, 0.03], [0, 0.03]];
  const metade = new THREE.LatheGeometry(perfil.map(([x, y]) => new THREE.Vector2(x, y)), 28);
  metade.rotateX(Math.PI / 2);
  return metade;
}

/** @param {Record<string, THREE.Material>} m */
export function criarPoder(tipo, m) {
  const b = new Modelo();
  if (tipo === 'ima') {
    b.add(new THREE.TorusGeometry(0.42, 0.15, 12, 24, Math.PI), '#e8323c', { r: [0, 0, Math.PI], p: [0, 0.1, 0] });
    for (const x of [-0.42, 0.42]) {
      b.cilindro(0.15, 0.15, 0.3, '#e8323c', { p: [x, 0.25, 0] });
      b.cilindro(0.155, 0.155, 0.16, '#e9eef5', { p: [x, 0.45, 0], m: 'metal' });
    }
  } else {
    // tambor (bedug) com pele e cordas
    b.cilindro(0.5, 0.5, 0.75, '#c4402f', { r: [Math.PI / 2, 0, 0] }, 24);
    for (const z of [-0.39, 0.39]) {
      b.cilindro(0.47, 0.47, 0.03, '#f3e3c0', { p: [0, 0, z], r: [Math.PI / 2, 0, 0] }, 24);
      b.toro(0.5, 0.045, '#ffd25a', { p: [0, 0, z] });
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.cilindro(0.018, 0.018, 0.78, '#f7e7b5', { p: [Math.cos(a) * 0.51, Math.sin(a) * 0.51, 0], r: [Math.PI / 2, 0, 0] }, 5);
    }
  }
  const g = b.montar(m);
  g.scale.setScalar(1.05);
  return g;
}
