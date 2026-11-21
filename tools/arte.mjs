// Gera a thumb (1024x1024) e a capa (1920x1080) do portal com tools/arte.html.
// Uso: node tools/arte.mjs <pasta de saida>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { abrirChrome, espera } from './cdp.mjs';

const saida = resolve(process.argv[2] || 'arte');
mkdirSync(saida, { recursive: true });
const c = await abrirChrome({ porta: 5428, portaDep: 9428 });
for (const [tipo, w, h, extra] of [['thumb', 1024, 1024, ''], ['capa', 1920, 1080, '']]) {
  await c.tela(w, h);
  await c.ir(`/tools/arte.html?tipo=${tipo}${extra}`);
  if (!(await c.ate('!!(window.__arte && __arte.pronto)', 60000))) throw new Error(`${tipo}: nao renderizou`);
  await espera(800);
  writeFileSync(join(saida, `${tipo}.png`), await c.foto());
  process.stdout.write(`  ${tipo}.png\n`);
}
process.stdout.write(c.erros.length ? `ERROS:\n${c.erros.join('\n')}\n` : 'console limpo\n');
await c.sair();
