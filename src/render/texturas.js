// Texturas procedurais em canvas (nenhum arquivo de imagem): veios de madeira, casca do Tung
// Tung com normal map, aneis do tronco, chao da vila e o brilho das lanternas.
import * as THREE from 'three';
import { criarRng } from '../jogo/rng.js';

/** @param {number} w @param {number} h */
function tela(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  return { c, ctx };
}

/** Ruido de valor 2D periodico (tileavel). */
function criarRuido(semente, periodo) {
  const r = criarRng(semente);
  const grade = new Float32Array(periodo * periodo);
  for (let i = 0; i < grade.length; i++) grade[i] = r.proximo();
  const g = (/** @type {number} */ x, /** @type {number} */ y) => grade[((y % periodo + periodo) % periodo) * periodo + ((x % periodo + periodo) % periodo)];
  const suave = (/** @type {number} */ t) => t * t * (3 - 2 * t);
  return (/** @type {number} */ x, /** @type {number} */ y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = suave(x - xi);
    const fy = suave(y - yi);
    const a = g(xi, yi) + (g(xi + 1, yi) - g(xi, yi)) * fx;
    const b = g(xi, yi + 1) + (g(xi + 1, yi + 1) - g(xi, yi + 1)) * fx;
    return a + (b - a) * fy;
  };
}

/** @param {HTMLCanvasElement} c @param {boolean} [cor] */
function textura(c, cor = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (cor) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Normal map a partir de um mapa de altura (Sobel). @param {Float32Array} alt @param {number} w @param {number} h @param {number} forca */
function normalDeAltura(alt, w, h, forca) {
  const { c, ctx } = tela(w, h);
  const img = ctx.createImageData(w, h);
  const A = (/** @type {number} */ x, /** @type {number} */ y) => alt[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (A(x + 1, y) - A(x - 1, y)) * forca;
      const dy = (A(x, y + 1) - A(x, y - 1)) * forca;
      const n = new THREE.Vector3(-dx, -dy, 1).normalize();
      const i = (y * w + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255;
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return textura(c, false);
}

/**
 * Veios claros de madeira em tons de cinza (multiplicam a cor por vertice dos props).
 */
export function texturaVeios() {
  const W = 256;
  const H = 256;
  const { c, ctx } = tela(W, H);
  const img = ctx.createImageData(W, H);
  const ruido = criarRuido(7, 16);
  const ruido2 = criarRuido(11, 64);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      const desvio = ruido(u * 4, v * 16) * 1.6;
      const veio = Math.sin((u * 26 + desvio) * Math.PI);
      const fino = ruido2(u * 64, v * 4);
      let k = 0.86 + veio * 0.07 + (fino - 0.5) * 0.12;
      k = Math.max(0.62, Math.min(1, k));
      const i = (y * W + x) * 4;
      img.data[i] = k * 255;
      img.data[i + 1] = k * 252;
      img.data[i + 2] = k * 246;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return textura(c);
}

/**
 * Corpo do Tung Tung: madeira clara com veios verticais e alguns nos. Cor + normal map.
 * O u da LatheGeometry da a volta no tronco; o v sobe.
 */
export function texturaCorpo() {
  const W = 512;
  const H = 512;
  const { c, ctx } = tela(W, H);
  const img = ctx.createImageData(W, H);
  const alt = new Float32Array(W * H);
  const ruido = criarRuido(3, 32);
  const ruidoFino = criarRuido(5, 128);
  // nos (centro u,v e raio), longe do rosto (u = 0.5 fica de frente para -z)
  const nos = [[0.14, 0.62, 0.035], [0.28, 0.25, 0.025], [0.92, 0.72, 0.03], [0.06, 0.2, 0.02], [0.7, 0.22, 0.022]];
  const base = new THREE.Color('#e2b98a');
  const escuro = new THREE.Color('#a8784b');
  const tmp = new THREE.Color();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = 1 - y / H;
      let desvio = ruido(u * 8, v * 6) * 2.2;
      let h = 0;
      for (const [nu, nv, nr] of nos) {
        let du = Math.abs(u - nu);
        du = Math.min(du, 1 - du);
        const dv = (v - nv) * 0.5;
        const dist = Math.sqrt(du * du + dv * dv);
        if (dist < nr * 3) desvio += Math.sin(dist / nr * 3) * (1 - dist / (nr * 3)) * 2.5;
        if (dist < nr) h -= (1 - dist / nr) * 0.6;
      }
      const veio = Math.sin((u * 46 + desvio) * Math.PI);
      const fino = ruidoFino(u * 128, v * 10);
      const t = Math.max(0, Math.min(1, 0.3 + veio * 0.22 + (fino - 0.5) * 0.35 - h * 0.6));
      tmp.copy(base).lerp(escuro, t);
      const i = (y * W + x) * 4;
      img.data[i] = tmp.r * 255;
      img.data[i + 1] = tmp.g * 255;
      img.data[i + 2] = tmp.b * 255;
      img.data[i + 3] = 255;
      alt[y * W + x] = veio * 0.25 + fino * 0.4 + h;
    }
  }
  ctx.putImageData(img, 0, 0);
  const mapa = textura(c);
  mapa.wrapT = THREE.ClampToEdgeWrapping;
  const normal = normalDeAltura(alt, W, H, 2.2);
  normal.wrapT = THREE.ClampToEdgeWrapping;
  return { mapa, normal };
}

/** Aneis do tronco (o topo cortado do Tung Tung e as pontas das toras). */
export function texturaAneis() {
  const W = 256;
  const { c, ctx } = tela(W, W);
  const img = ctx.createImageData(W, W);
  const ruido = criarRuido(9, 16);
  const claro = new THREE.Color('#f0d3a6');
  const escuro = new THREE.Color('#c1915c');
  const casca = new THREE.Color('#6d4527');
  const tmp = new THREE.Color();
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x / W - 0.5;
      const dy = y / W - 0.5;
      const ang = Math.atan2(dy, dx);
      const r = Math.sqrt(dx * dx + dy * dy) * 2 + ruido(Math.cos(ang) * 3 + 5, Math.sin(ang) * 3 + 5) * 0.06;
      const anel = 0.5 + 0.5 * Math.sin(r * 58);
      tmp.copy(claro).lerp(escuro, anel * 0.55);
      if (r > 0.9) tmp.copy(casca);
      const i = (y * W + x) * 4;
      img.data[i] = tmp.r * 255;
      img.data[i + 1] = tmp.g * 255;
      img.data[i + 2] = tmp.b * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return textura(c);
}

/** Casca escura das toras do rio (cor + normal). */
export function texturaCasca() {
  const W = 256;
  const H = 256;
  const { c, ctx } = tela(W, H);
  const img = ctx.createImageData(W, H);
  const alt = new Float32Array(W * H);
  const ruido = criarRuido(21, 32);
  const ruido2 = criarRuido(23, 64);
  const a = new THREE.Color('#8a5a35');
  const b = new THREE.Color('#4e301c');
  const tmp = new THREE.Color();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      const fenda = Math.abs(Math.sin((u * 18 + ruido(u * 6, v * 3) * 2.5) * Math.PI));
      const k = Math.pow(fenda, 0.4) * 0.7 + ruido2(u * 64, v * 16) * 0.3;
      tmp.copy(b).lerp(a, k);
      const i = (y * W + x) * 4;
      img.data[i] = tmp.r * 255;
      img.data[i + 1] = tmp.g * 255;
      img.data[i + 2] = tmp.b * 255;
      img.data[i + 3] = 255;
      alt[y * W + x] = k;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { mapa: textura(c), normal: normalDeAltura(alt, W, H, 3) };
}

/** Chao de terra batida com pedrinhas (vila). Tons de cinza claros, multiplicados pela cor. */
export function texturaChaoVila() {
  const W = 512;
  const { c, ctx } = tela(W, W);
  const img = ctx.createImageData(W, W);
  const ruido = criarRuido(31, 32);
  const ruido2 = criarRuido(33, 128);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const k = 0.8 + (ruido(x / 16, y / 16) - 0.5) * 0.18 + (ruido2(x / 4, y / 4) - 0.5) * 0.1;
      const i = (y * W + x) * 4;
      img.data[i] = k * 255;
      img.data[i + 1] = k * 250;
      img.data[i + 2] = k * 242;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // pedrinhas arredondadas
  const r = criarRng(35);
  for (let i = 0; i < 260; i++) {
    const x = r.real(0, W);
    const y = r.real(0, W);
    const raio = r.real(3, 9);
    const g = ctx.createRadialGradient(x - raio * 0.3, y - raio * 0.3, 1, x, y, raio);
    const tom = Math.round(r.real(170, 230));
    g.addColorStop(0, `rgb(${tom + 20},${tom + 18},${tom + 14})`);
    g.addColorStop(1, `rgb(${tom - 50},${tom - 52},${tom - 56})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, raio, raio * r.real(0.6, 1), r.real(0, 3), 0, Math.PI * 2);
    ctx.fill();
  }
  return textura(c);
}

/** Sprite radial de brilho (lanternas, poderes). */
export function texturaBrilho() {
  const W = 128;
  const { c, ctx } = tela(W, W);
  const g = ctx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, W);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Sombra de contato redonda (embaixo do personagem e do perseguidor). */
export function texturaSombra() {
  const W = 128;
  const { c, ctx } = tela(W, W);
  const g = ctx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, W);
  return new THREE.CanvasTexture(c);
}

/** Normal map de ondinhas para a agua do rio (tileavel). */
export function texturaOndas() {
  const W = 256;
  const alt = new Float32Array(W * W);
  const r1 = criarRuido(41, 16);
  const r2 = criarRuido(43, 32);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      alt[y * W + x] = r1(x / 16, y / 16) * 0.7 + r2(x / 8, y / 8) * 0.3;
    }
  }
  return normalDeAltura(alt, W, W, 4);
}
