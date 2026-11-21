// Copia o three.js (versao fixa do package.json) para vendor/three/. O jogo carrega so daqui,
// por importmap: nenhuma URL externa. Rode de novo depois de trocar a versao (npm run vendor).
import { copyFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const ORIGEM = join(RAIZ, 'node_modules/three');
const DESTINO = join(RAIZ, 'vendor/three');

/** Addons usados pelo jogo (caminhos relativos a examples/jsm/). */
const ADDONS = [
  'geometries/RoundedBoxGeometry.js',
  'environments/RoomEnvironment.js',
  'utils/BufferGeometryUtils.js',
  'postprocessing/EffectComposer.js',
  'postprocessing/RenderPass.js',
  'postprocessing/OutputPass.js',
  'postprocessing/UnrealBloomPass.js',
  'postprocessing/ShaderPass.js',
  'postprocessing/MaskPass.js',
  'postprocessing/Pass.js',
  'shaders/CopyShader.js',
  'shaders/LuminosityHighPassShader.js',
  'shaders/OutputShader.js',
];

const versao = JSON.parse(readFileSync(join(ORIGEM, 'package.json'), 'utf8')).version;
rmSync(DESTINO, { recursive: true, force: true });
mkdirSync(DESTINO, { recursive: true });
for (const arq of ['build/three.module.js', 'build/three.core.js', 'LICENSE']) {
  copyFileSync(join(ORIGEM, arq), join(DESTINO, arq.replace('build/', '')));
}
for (const a of ADDONS) {
  const dest = join(DESTINO, 'addons', a);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(join(ORIGEM, 'examples/jsm', a), dest);
}
process.stdout.write(`three ${versao} copiado para vendor/three/ (${ADDONS.length} addons)\n`);
