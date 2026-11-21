// Motor de render: WebGLRenderer, cena, camera que segue o corredor, luz principal com sombra
// que acompanha o jogador, bloom opcional e qualidade automatica pelo FPS.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { configurarRenderer, criarAmbiente, criarMateriais } from './estilo-brinquedo.js';

/** @typedef {'alta' | 'media' | 'baixa'} Qualidade */

const QUALIDADES = {
  alta: { dpr: 2, sombra: 2048, bloom: true },
  media: { dpr: 1.5, sombra: 1024, bloom: false },
  baixa: { dpr: 1, sombra: 0, bloom: false },
};

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ qualidade?: Qualidade, fixa?: boolean }} [o] fixa: nao muda a qualidade sozinha
 */
export function criarMotor(canvas, o = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  configurarRenderer(renderer);
  const cena = new THREE.Scene();
  const env = criarAmbiente(renderer);
  cena.environment = env;
  const { m: materiais, texturas } = criarMateriais();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 700);

  const hemi = new THREE.HemisphereLight('#bcd6ff', '#5b4a3a', 0.8);
  cena.add(hemi);
  const sol = new THREE.DirectionalLight('#ffffff', 2);
  sol.castShadow = true;
  sol.shadow.bias = -0.0004;
  sol.shadow.normalBias = 0.03;
  sol.shadow.radius = 3;
  const sc = sol.shadow.camera;
  sc.left = -16;
  sc.right = 16;
  sc.top = 34;
  sc.bottom = -14;
  sc.near = 1;
  sc.far = 80;
  cena.add(sol);
  cena.add(sol.target);
  /** direcao da luz (de onde ela vem, relativa ao alvo) */
  const dirSol = new THREE.Vector3(10, 22, 6);

  let qualidade = /** @type {Qualidade} */ (o.qualidade || 'alta');
  /** @type {EffectComposer | null} */
  let composer = null;
  /** @type {UnrealBloomPass | null} */
  let bloom = null;
  let largura = 1;
  let altura = 1;

  function aplicarQualidade() {
    const q = QUALIDADES[qualidade];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.dpr));
    renderer.shadowMap.enabled = q.sombra > 0;
    sol.castShadow = q.sombra > 0;
    if (q.sombra > 0 && sol.shadow.mapSize.x !== q.sombra) {
      sol.shadow.mapSize.set(q.sombra, q.sombra);
      if (sol.shadow.map) {
        sol.shadow.map.dispose();
        sol.shadow.map = null;
      }
    }
    if (q.bloom && !composer) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(cena, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(largura, altura), 0.7, 0.5, 2.6);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
    }
    ajustarTela();
  }

  function ajustarTela() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    largura = w;
    altura = h;
    renderer.setSize(w, h, false);
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    }
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /** Luz e sombra acompanham um ponto (o jogador). @param {THREE.Vector3} alvo */
  function seguirLuz(alvo) {
    sol.target.position.set(alvo.x * 0.5, 0, alvo.z - 10);
    sol.position.copy(sol.target.position).add(dirSol);
  }

  // medidor de FPS para a qualidade automatica
  let acum = 0;
  let quadros = 0;
  let fps = 60;
  let ruins = 0;
  /** @param {number} dt */
  function medir(dt) {
    acum += dt;
    quadros++;
    if (acum >= 1) {
      fps = quadros / acum;
      acum = 0;
      quadros = 0;
      if (!o.fixa) {
        ruins = fps < 45 ? ruins + 1 : 0;
        if (ruins >= 3 && qualidade !== 'baixa') {
          qualidade = qualidade === 'alta' ? 'media' : 'baixa';
          ruins = 0;
          aplicarQualidade();
        }
      }
    }
  }

  renderer.info.autoReset = false;
  function renderizar() {
    renderer.info.reset();
    if (composer && QUALIDADES[qualidade].bloom) composer.render();
    else renderer.render(cena, camera);
  }

  aplicarQualidade();
  window.addEventListener('resize', ajustarTela);

  return {
    renderer, cena, camera, sol, hemi, dirSol, materiais, texturas, env,
    ajustarTela, seguirLuz, renderizar, medir,
    get qualidade() { return qualidade; },
    get fps() { return fps; },
    get bloom() { return bloom; },
    get temSombra() { return QUALIDADES[qualidade].sombra > 0; },
    /** @param {Qualidade} q */
    definirQualidade(q) {
      qualidade = q;
      aplicarQualidade();
    },
    info: () => renderer.info.render,
  };
}
