// Autopiloto: joga sozinho, simulando a partida um pouco a frente (busca de 2 acoes com
// horizonte curto, refeita a cada decisao). Serve aos prints, ao modo &auto e ao teste que
// prova que a pista sempre tem passagem.
import { passo } from './regras.js';
import { fimDe, FAIXA, ALTURA_PLATAFORMA } from './pista.js';

/** @type {import('./corredor.js').Comando[]} */
const ACOES = [
  {},
  { esquerda: true },
  { direita: true },
  { pular: true },
  { rolar: true },
  { tacada: true },
  { esquerda: true, pular: true },
  { direita: true, pular: true },
  { esquerda: true, rolar: true },
  { direita: true, rolar: true },
];
const INTERVALO = 0.06;
const HORIZONTE = 1.5;
const T_SEGUNDA = 0.24;
const DT_SIM = 1 / 30;

export function criarAutopiloto() {
  return { proxima: 0 };
}

/**
 * Comando deste quadro.
 * @param {{ proxima: number }} ap @param {import('./regras.js').Partida} P
 * @returns {import('./corredor.js').Comando}
 */
export function decidir(ap, P) {
  if (P.fim || P.t < ap.proxima) return {};
  ap.proxima = P.t + INTERVALO;
  // caminho barato: sem fazer nada sobrevive? entao so procura moedas trocando de faixa
  const base = simular(P, ACOES[0], ACOES[0]);
  let melhor = { nota: base, a: ACOES[0] };
  if (base >= 1000) {
    for (const a of [ACOES[1], ACOES[2], ACOES[5]]) {
      const n = simular(P, a, ACOES[0]) - 0.6;
      if (n > melhor.nota + 1.5) melhor = { nota: n, a };
    }
    return melhor.a;
  }
  for (const a0 of ACOES) {
    for (const a1 of ACOES) {
      const n = simular(P, a0, a1) - (a0 === ACOES[0] ? 0 : 0.5) - (a1 === ACOES[0] ? 0 : 0.3);
      if (n > melhor.nota) melhor = { nota: n, a: a0 };
    }
  }
  return melhor.a;
}

/** @param {import('./regras.js').Partida} P @param {number} janela */
function clonar(P, janela) {
  const ents = [];
  for (const e of P.pista.ents) {
    if (e.z - 40 < P.d + janela && fimDe(e) > P.d - 3) ents.push({ ...e });
  }
  return {
    ...P,
    pista: { ...P.pista, ents },
    corredor: { ...P.corredor },
    perseguidor: { ...P.perseguidor },
    fim: null,
  };
}

/**
 * Nota de um plano: sobreviver vale 1000 (+ moedas e caixotes); tropecar ou morrer vale menos
 * quanto mais cedo acontece.
 * @param {import('./regras.js').Partida} P @param {import('./corredor.js').Comando} a0 @param {import('./corredor.js').Comando} a1
 */
function simular(P, a0, a1) {
  const S = clonar(P, P.v * HORIZONTE + 14);
  const t0 = S.t;
  let moedas = 0;
  let quebrou = 0;
  let tropeco = -1;
  const emit = (/** @type {string} */ ev) => {
    if (ev === 'moeda') moedas++;
    else if (ev === 'poder') moedas += 25;
    else if (ev === 'quebrou') quebrou++;
    else if ((ev === 'tropeco' || ev === 'trombada' || ev === 'escalou') && tropeco < 0) tropeco = S.t - t0;
  };
  let usou1 = false;
  let primeiro = true;
  while (S.t - t0 < HORIZONTE) {
    let cmd = {};
    if (primeiro) {
      cmd = a0;
      primeiro = false;
    } else if (!usou1 && S.t - t0 >= T_SEGUNDA) {
      cmd = a1;
      usou1 = true;
    } else if (usou1) {
      cmd = reflexo(S);
    }
    passo(S, DT_SIM, cmd, emit, { simulacao: true });
    if (S.fim) return (S.t - t0) * 100;
    if (tropeco >= 0) return tropeco * 100 + 30;
  }
  // prefere ficar no chao firme e perto do centro (mais saidas)
  return 1000 + moedas * 2 + quebrou * 3 - Math.abs(S.corredor.faixa) * 0.4;
}

/**
 * Politica simples usada depois das acoes do plano: reage ao proximo obstaculo da faixa.
 * @param {import('./regras.js').Partida} S
 * @returns {import('./corredor.js').Comando}
 */
export function reflexo(S) {
  const c = S.corredor;
  const v = S.v;
  const prox = proximoNaFaixa(S, c.faixa);
  if (!prox) return {};
  const { e, dist } = prox;
  if (e.tipo === 'vao') return c.noChao && dist <= 0.12 * v + 0.3 ? { pular: true } : {};
  if (e.forma === 'baixo') return c.noChao && dist <= 0.3 * v + 0.35 ? { pular: true } : {};
  if (e.forma === 'quebravel') {
    if (c.recarga <= 0 && dist <= 3.0 + 0.04 * v) return { tacada: true };
    return {};
  }
  if (e.forma === 'alto') return c.rolando <= 0.05 && dist <= 0.25 * v + 0.35 ? { rolar: true } : {};
  // bloco, movel ou plataforma sem rampa: troca para a vizinha mais livre
  const fechando = v + (e.forma === 'movel' ? e.vel : 0);
  if (dist > fechando * 0.55 + 2 || Math.abs(c.x - c.faixa * FAIXA) > 0.01) return {};
  let melhor = 0;
  let folga = -1;
  for (const f of [c.faixa - 1, c.faixa + 1]) {
    if (f < -1 || f > 1) continue;
    const p2 = proximoNaFaixa(S, f, true);
    const dd = p2 ? p2.dist : 999;
    if (dd > folga) {
      folga = dd;
      melhor = f - c.faixa;
    }
  }
  if (melhor < 0) return { esquerda: true };
  if (melhor > 0) return { direita: true };
  return {};
}

/**
 * Proximo obstaculo (ou vao) que ainda importa na faixa `f`.
 * @param {import('./regras.js').Partida} S @param {number} f @param {boolean} [soParede] so o que obriga a trocar de faixa
 */
function proximoNaFaixa(S, f, soParede = false) {
  const c = S.corredor;
  const z = S.d;
  let alvo = null;
  let dist = Infinity;
  for (const e of S.pista.ents) {
    if (e.tipo !== 'obs' && e.tipo !== 'vao') continue;
    if (e.faixa !== f) continue;
    const dd = e.z - z;
    if (dd + ('c' in e ? e.c : 0) < -0.4 || dd > 60) continue;
    if (e.tipo === 'obs') {
      if (e.quebrado || e.derrubado) continue;
      if (c.y >= e.y1 - 0.05 && e.forma !== 'alto') continue; // ja esta por cima
      if (e.forma === 'plataforma' && e.rampa && c.y < 0.1 && dd > 0) continue; // a rampa leva para cima
      if (e.forma === 'plataforma' && c.y >= ALTURA_PLATAFORMA - 0.5) continue;
      if (soParede && !['bloco', 'movel', 'plataforma'].includes(e.forma)) continue;
    } else if (soParede) continue;
    if (dd < -0.4) continue; // ja dentro (ex.: andando ao lado de uma plataforma)
    if (dd < dist) {
      dist = dd;
      alvo = e;
    }
  }
  return alvo ? { e: alvo, dist } : null;
}
