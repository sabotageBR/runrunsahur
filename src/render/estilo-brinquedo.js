// Estilo "3D de brinquedo": plastico/verniz macio, reflexo do ambiente (RoomEnvironment),
// tone mapping ACES, sombras suaves e bordas arredondadas (no construtor de modelos).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { texturaVeios, texturaCorpo, texturaAneis, texturaCasca, texturaChaoVila, texturaBrilho, texturaSombra } from './texturas.js';

/** @param {THREE.WebGLRenderer} renderer */
export function configurarRenderer(renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
}

/** Mapa de ambiente para os reflexos (uma vez so). @param {THREE.WebGLRenderer} renderer */
export function criarAmbiente(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return env;
}

/** Texturas e materiais compartilhados por todos os modelos. */
export function criarMateriais() {
  const veios = texturaVeios();
  const corpo = texturaCorpo();
  const aneis = texturaAneis();
  const casca = texturaCasca();
  const texturas = { veios, corpo, aneis, casca, chaoVila: texturaChaoVila(), brilho: texturaBrilho(), sombra: texturaSombra() };
  /** @type {Record<string, THREE.Material>} */
  const m = {
    // props: cor por vertice
    liso: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0 }),
    madeira: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, map: veios }),
    casca: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, map: casca.mapa, normalMap: casca.normal, normalScale: new THREE.Vector2(0.8, 0.8) }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.85 }),
    tecido: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }),
    brilho: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    vidro: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.1, transmission: 0, transparent: true, opacity: 0.55, clearcoat: 1 }),
    // moeda e poderes
    ouro: new THREE.MeshStandardMaterial({ color: '#ffc531', roughness: 0.22, metalness: 1, emissive: '#5a3a00', emissiveIntensity: 0.6 }),
  };
  return { m, texturas };
}

/**
 * Materiais do personagem (verniz com clearcoat: o "brinquedo de madeira").
 * @param {ReturnType<typeof criarMateriais>['texturas']} tx
 */
export function materiaisPersonagem(tx) {
  return {
    corpo: new THREE.MeshPhysicalMaterial({
      map: tx.corpo.mapa, normalMap: tx.corpo.normal, normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.62, clearcoat: 0.3, clearcoatRoughness: 0.5,
    }),
    topo: new THREE.MeshPhysicalMaterial({ map: tx.aneis, roughness: 0.6, clearcoat: 0.4, clearcoatRoughness: 0.4 }),
    membro: new THREE.MeshPhysicalMaterial({ color: '#d9ad7c', map: tx.veios, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
    taco: new THREE.MeshPhysicalMaterial({ color: '#b5713a', map: tx.veios, roughness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.15 }),
    olho: new THREE.MeshPhysicalMaterial({ color: '#f2efe8', roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
    pupila: new THREE.MeshPhysicalMaterial({ color: '#111018', roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 }),
    escuro: new THREE.MeshStandardMaterial({ color: '#2a1a12', roughness: 0.6 }),
    // miolo da madeira (aparece quando a serra corta o Sahur ao meio)
    miolo: new THREE.MeshStandardMaterial({ color: '#f2d3a2', map: tx.veios, roughness: 0.75 }),
    boca: new THREE.MeshStandardMaterial({ color: '#3a1410', roughness: 0.5 }),
    lingua: new THREE.MeshStandardMaterial({ color: '#d4505a', roughness: 0.5 }),
  };
}
