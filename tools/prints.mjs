// Prints do laboratorio: para cada cenario x personagem, paisagem (1280x720), celular em pe
// (390x844, dpr 2) e a tela de inicio no celular; mais a vitrine. Grava em modelos/prints/
// e relata erros do console e qualquer pedido a outro dominio.
// Uso: node tools/prints.mjs [vila-p1 rio-p2 ...]   (padrao: todos)
// O WebGL roda no SwiftShader (sem GPU): cada print leva alguns segundos.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from './servir.mjs';
import { abrirChrome, espera } from './cdp.mjs';

const SAIDA = join(RAIZ, 'modelos/prints');
mkdirSync(SAIDA, { recursive: true });
/** semente e instante congelado de cada cenario (mesmo quadro para P1 e P2) */
const CENA = { vila: { semente: 7, t: 9 }, rio: { semente: 3, t: 4 } };
const pedidos = process.argv.slice(2);
const celulas = [];
for (const c of ['vila', 'rio']) for (const p of ['p1', 'p2']) if (!pedidos.length || pedidos.includes(`${c}-${p}`)) celulas.push([c, p]);

const ch = await abrirChrome({ porta: 5427, portaDep: 9427 });
const gravar = async (nome) => {
  writeFileSync(join(SAIDA, nome), await ch.foto());
  process.stdout.write(`  ${nome}\n`);
};
const congelado = '!!(window.__rrs && __rrs.congelado)';
const pronto = '!!(window.__rrs && __rrs.pronto)';

for (const [c, p] of celulas) {
  const { semente, t } = CENA[c];
  const jogo = `/index.html?cenario=${c}&personagem=${p}&semente=${semente}&fixo&t=${t}&novo&qualidade=alta`;
  await ch.tela(1280, 720);
  await ch.ir(jogo);
  if (!(await ch.ate(congelado, 40000))) throw new Error(`${c}-${p}: nao congelou`);
  await espera(2500);
  await gravar(`${c}-${p}-paisagem.png`);
  await ch.tela(390, 844, 2, true);
  await ch.ir(jogo);
  await ch.ate(congelado, 40000);
  await espera(3000);
  await gravar(`${c}-${p}-retrato.png`);
  await ch.ir(`/index.html?cenario=${c}&personagem=${p}&novo&qualidade=alta`);
  await ch.ate(pronto, 40000);
  await espera(3500);
  await gravar(`${c}-${p}-inicio.png`);
}
if (!pedidos.length || pedidos.includes('vitrine')) {
  await ch.tela(1280, 720);
  await ch.ir('/modelos/vitrine.html?parado&qualidade=alta');
  await ch.ate('!!(window.__vitrine && __vitrine.pronto)', 30000);
  await espera(3000);
  await gravar('vitrine.png');
}
process.stdout.write(ch.erros.length ? `ERROS NO CONSOLE:\n${ch.erros.join('\n')}\n` : 'console limpo\n');
process.stdout.write(ch.externos.length ? `PEDIDOS EXTERNOS:\n${ch.externos.join('\n')}\n` : 'nenhum pedido externo\n');
await ch.sair();
