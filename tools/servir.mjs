// Servidor estatico minimo (sem dependencias) para o jogo e o laboratorio.
// Uso direto: node tools/servir.mjs [porta]  (padrao 5420, so 127.0.0.1)
// servir(porta, raiz) serve outra pasta (uma build, para as provas do portal).
// Unica escrita: POST /__decisao, da pagina modelos/laboratorio.html (grava docs/decisao.md).
// Adaptado de jogos/brainrot-spot-the-difference/tools/servir.mjs.
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = fileURLToPath(new URL('..', import.meta.url));
export const PORTA_PADRAO = 5420;
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8',
};
const LIMITE = 64 * 1024;

/** @param {import('node:http').IncomingMessage} req */
async function lerCorpo(req) {
  const partes = [];
  let tam = 0;
  for await (const d of req) {
    tam += d.length;
    if (tam > LIMITE) throw new Error('pedido grande demais');
    partes.push(d);
  }
  return JSON.parse(Buffer.concat(partes).toString('utf8'));
}

/** @param {number} porta @param {string} [raiz] pasta servida (padrao: o jogo) @returns {Promise<() => Promise<void>>} fecha o servidor */
export function servir(porta, raiz = RAIZ) {
  const base = resolve(raiz);
  const srv = createServer(async (req, res) => {
    // escolha do laboratorio (modelos/laboratorio.html): grava docs/decisao.md
    if (req.method === 'POST' && req.url === '/__decisao' && base === resolve(RAIZ)) {
      try {
        const d = await lerCorpo(req);
        const cenario = String(d.cenario || '');
        const personagem = String(d.personagem || '');
        if (!/^(vila|rio)$/.test(cenario) || !/^p[12]$/.test(personagem)) throw new Error('escolha invalida');
        const nota = String(d.nota || '').slice(0, 2000);
        await mkdir(join(RAIZ, 'docs'), { recursive: true });
        const quando = new Date().toISOString().replace('T', ' ').slice(0, 16);
        await writeFile(join(RAIZ, 'docs/decisao.md'), `# Escolha do laboratorio\n\n- Quando: ${quando}\n- Cenario: **${cenario}**\n- Personagem: **${personagem}**\n${nota ? `- Nota do dono: ${nota}\n` : ''}\n\`\`\`json\n${JSON.stringify({ cenario, personagem, nota }, null, 1)}\n\`\`\`\n`);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, erro: String(/** @type {Error} */ (e).message || e) }));
      }
      return;
    }
    try {
      const caminho = decodeURIComponent(new URL(req.url || '/', 'http://x').pathname);
      let arq = normalize(join(base, caminho));
      if (!arq.startsWith(base) || arq.includes('node_modules')) throw new Error('fora');
      if ((await stat(arq)).isDirectory()) arq = join(arq, 'index.html');
      const corpo = await readFile(arq);
      res.writeHead(200, { 'content-type': TIPOS[extname(arq).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(corpo);
    } catch {
      res.writeHead(404);
      res.end('404');
    }
  });
  return new Promise((ok, falha) => {
    srv.once('error', falha);
    srv.listen(porta, '127.0.0.1', () => ok(() => new Promise((r) => srv.close(() => r()))));
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const porta = Number(process.argv[2]) || PORTA_PADRAO;
  await servir(porta);
  process.stdout.write(`Jogo em          http://127.0.0.1:${porta}/\n`);
  process.stdout.write(`Laboratorio em   http://127.0.0.1:${porta}/modelos/laboratorio.html\n`);
  process.stdout.write(`Vitrine em       http://127.0.0.1:${porta}/modelos/vitrine.html\n`);
}
