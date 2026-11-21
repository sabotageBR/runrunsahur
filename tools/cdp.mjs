// Chrome headless pelo protocolo de depuracao (CDP), para os prints e o teste do autopiloto.
// Sobe o servidor local numa porta propria e um Chrome com perfil temporario. O WebGL roda
// pelo SwiftShader (sem GPU), entao o FPS daqui nao vale como medida de desempenho.
// Adaptado de jogos/brainrot-spot-the-difference/tools/cdp.mjs.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { servir } from './servir.mjs';

export const espera = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));

const CHROMES = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

/**
 * raiz: pasta servida (padrao: o jogo; uma build nas provas do portal). extras: argumentos a mais do Chrome
 * (ex.: --host-resolver-rules para bloquear um dominio).
 * @param {{ porta: number, portaDep: number, largura?: number, altura?: number, raiz?: string, extras?: string[] }} o
 */
export async function abrirChrome({ porta, portaDep, largura = 1280, altura = 720, raiz, extras = [] }) {
  const binario = CHROMES.find((c) => existsSync(/** @type {string} */ (c)));
  if (!binario) throw new Error('Chrome nao encontrado (defina CHROME=/caminho)');
  const fechar = await servir(porta, raiz);
  const perfil = mkdtempSync(join(tmpdir(), 'rrs-cdp-'));
  const chrome = spawn(binario, ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl',
    '--ignore-gpu-blocklist', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${portaDep}`, `--user-data-dir=${perfil}`,
    `--window-size=${largura},${altura}`, ...extras, 'about:blank'], { stdio: 'ignore' });
  let alvo = null;
  for (let i = 0; i < 80 && !alvo; i++) {
    await espera(200);
    try {
      alvo = (await (await fetch(`http://127.0.0.1:${portaDep}/json`)).json()).find((/** @type {any} */ x) => x.type === 'page');
    } catch { /* subindo */ }
  }
  if (!alvo) throw new Error('Chrome nao respondeu');
  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let seq = 0;
  const pend = new Map();
  /** @type {string[]} */
  const erros = [];
  /** @type {string[]} */
  const externos = [];
  /** mensagens do proprio navegador (rede, seguranca), fora do console da pagina */
  /** @type {string[]} */
  const registros = [];
  /** @type {Map<string, (params: any) => void>} */
  const ouvintes = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(String(ev.data));
    if (m.method && ouvintes.has(m.method)) ouvintes.get(m.method)(m.params);
    if (m.id && pend.has(m.id)) {
      pend.get(m.id)(m);
      pend.delete(m.id);
    } else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      erros.push(`${d.exception ? d.exception.description : d.text} (${d.url || ''}:${d.lineNumber})`);
    } else if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) {
      erros.push(`[${m.params.type}] ${m.params.args.map((/** @type {any} */ a) => a.value || a.description).join(' ')}`);
    } else if (m.method === 'Network.requestWillBeSent') {
      const u = m.params.request.url;
      if (!u.startsWith(`http://127.0.0.1:${porta}`) && !u.startsWith('data:') && !u.startsWith('blob:')) externos.push(u);
    } else if (m.method === 'Log.entryAdded') {
      const e = m.params.entry;
      registros.push(`[${e.source} ${e.level}] ${e.text}${e.url ? ` (${e.url})` : ''}`);
    }
  });
  /** @param {string} method @param {object} [params] @returns {Promise<any>} */
  const cdp = (method, params = {}) => new Promise((r) => {
    const id = ++seq;
    pend.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Network.enable');
  await cdp('Log.enable');
  /** @param {string} expr */
  const avaliar = async (expr) => {
    const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.exceptionDetails) throw new Error(`${expr}: ${r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text}`);
    return r.result?.result?.value;
  };
  /** @param {number} w @param {number} h @param {number} [dpr] @param {boolean} [mobile] */
  const tela = async (w, h, dpr = 1, mobile = false) => {
    await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile });
    await cdp('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 0 });
    await espera(300);
  };
  /** @returns {Promise<Buffer>} */
  const foto = async () => Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).result.data, 'base64');
  /** @param {string} url */
  const ir = async (url) => {
    await cdp('Page.navigate', { url: url.startsWith('http') ? url : `http://127.0.0.1:${porta}${url}` });
  };
  /** Espera a expressao ficar verdadeira. @param {string} expr @param {number} [ms] */
  const ate = async (expr, ms = 20000) => {
    for (let t = 0; t < ms; t += 150) {
      try {
        if (await avaliar(expr)) return true;
      } catch { /* a pagina ainda carrega */ }
      await espera(150);
    }
    return false;
  };
  const sair = async () => {
    ws.close();
    chrome.kill('SIGKILL');
    await espera(600);
    try {
      rmSync(perfil, { recursive: true, force: true });
    } catch { /* o Chrome ainda solta arquivos */ }
    await fechar();
  };
  /** Ouve um evento do CDP (um ouvinte por metodo). @param {string} metodo @param {(params: any) => void} fn */
  const ouvir = (metodo, fn) => { ouvintes.set(metodo, fn); };
  return { cdp, avaliar, tela, foto, ir, ate, sair, erros, externos, registros, ouvir };
}
