// Regras da partida: velocidade, pontos, moedas, poderes, perseguidor e fim. Logica pura.
//
// Perseguidor ("o chefe"): corre sempre na velocidade base. Toda trombada derruba a velocidade
// do Sahur, que volta aos poucos; enquanto ele esta mais lento, o chefe encurta a distancia.
// Correndo limpo, o chefe cansa e fica para tras. Distancia zero: pego.
import { criarPista, gerarAte, limparAtras, FAIXA, ATIVA_MOVEL } from './pista.js';
import { criarCorredor, passoCorredor } from './corredor.js';

export const VEL_INICIAL = 11;
export const VEL_MAXIMA = 25;
/** segundos ate a velocidade chegar a ~63% do caminho ate a maxima */
const CONSTANTE_VEL = 140;
export const DURACAO_IMA = 10;
export const DURACAO_SAHUR = 8;
/** o modo Sahur corre mais */
export const BONUS_SAHUR = 1.18;
const INVENCIVEL_REVIVER = 2.5;
/** distancia em que a "luz do dia" chega ao maximo (o amanhecer) */
export const DISTANCIA_AMANHECER = 4000;
const PASSO_MAX = 0.45;

/** perseguidor: distancia maxima (fora da tela), inicial e a que pega */
export const DIST_MAX = 14;
export const DIST_INICIAL = 4;
export const DIST_PEGA = 0.9;
/** metros por segundo que o chefe perde quando o Sahur corre limpo */
const RECUO = 1.1;
/** recuperacao da velocidade, proporcional a velocidade base (perda em metros quase igual em qualquer velocidade) */
const RECUPERA = 0.022;
/** fator de velocidade logo depois de cada tipo de choque */
export const CHOQUE = { tropeco: 0.62, leve: 0.55, escalou: 0.42, forte: 0.3 };

/** @param {number} t segundos de corrida */
export const velocidadeEm = (t) => VEL_INICIAL + (VEL_MAXIMA - VEL_INICIAL) * (1 - Math.exp(-t / CONSTANTE_VEL));

/**
 * @param {{ semente: number, cenario: 'vila' | 'rio' }} o
 */
export function criarPartida({ semente, cenario }) {
  const pista = criarPista(semente, cenario);
  gerarAte(pista, 240, VEL_INICIAL);
  return {
    cenario,
    pista,
    corredor: criarCorredor(),
    /** segundos de corrida */
    t: 0,
    /** metros percorridos */
    d: 0,
    /** velocidade atual e a base (sem choque nem bonus) */
    v: VEL_INICIAL,
    vBase: VEL_INICIAL,
    /** 1 = velocidade cheia; cai nos choques e volta aos poucos */
    fator: 1,
    pontos: 0,
    moedas: 0,
    quebrados: 0,
    trombadas: 0,
    mult: 1,
    ima: 0,
    sahur: 0,
    invencivel: 0,
    /** perseguidor: distancia atras do Sahur (m) */
    perseguidor: { dist: DIST_INICIAL },
    /** @type {null | { motivo: 'serra' | 'pego' | 'caiu', t: number }} */
    fim: null,
    revividas: 0,
  };
}

/** @typedef {ReturnType<typeof criarPartida>} Partida */

/**
 * Avanca a partida. Os eventos vao para `emitir` (som, efeitos, HUD).
 * @param {Partida} P @param {number} dt @param {import('./corredor.js').Comando} cmd
 * @param {(ev: string, dado?: any) => void} [emitir]
 * @param {{ simulacao?: boolean, imortal?: boolean }} [op]
 */
export function passo(P, dt, cmd, emitir = () => {}, op = {}) {
  if (P.fim) return;
  P.vBase = velocidadeEm(P.t);
  P.v = P.vBase * P.fator * (P.sahur > 0 ? BONUS_SAHUR : 1);
  const total = P.v * dt;
  const n = Math.max(1, Math.ceil(total / PASSO_MAX));
  const sub = dt / n;
  for (let i = 0; i < n && !P.fim; i++) subpasso(P, sub, i === 0 ? cmd : {}, emitir, op);
  if (!op.simulacao) {
    gerarAte(P.pista, P.d + 240, P.vBase);
    limparAtras(P.pista, P.d - 30);
  }
}

/** @param {Partida} P @param {number} dt @param {import('./corredor.js').Comando} cmd @param {(ev: string, dado?: any) => void} emitir @param {{ simulacao?: boolean, imortal?: boolean }} op */
function subpasso(P, dt, cmd, emitir, op) {
  P.t += dt;
  const v = P.vBase * P.fator * (P.sahur > 0 ? BONUS_SAHUR : 1);
  const dz = v * dt;
  const ents = P.pista.ents;
  // moveis andam contra o jogador quando chegam perto
  for (const e of ents) {
    if (e.tipo !== 'obs' || e.forma !== 'movel') continue;
    if (!e.ativo && e.z - P.d < ATIVA_MOVEL) e.ativo = true;
    if (e.ativo && !e.derrubado) e.z -= e.vel * dt;
  }
  const c = P.corredor;
  const r = passoCorredor(c, ents, P.d, dz, dt, cmd, { sahur: P.sahur > 0, invencivel: P.invencivel > 0 || !!op.imortal }, (ev, dado) => {
    if (ev === 'quebrou') {
      P.quebrados++;
      P.pontos += 25 * P.mult;
    }
    emitir(ev, dado);
  });
  P.d += dz;
  P.mult = 1 + Math.min(4, Math.floor(P.t / 30));
  P.pontos += dz * P.mult;
  if (P.ima > 0) P.ima -= dt;
  if (P.sahur > 0) {
    P.sahur -= dt;
    if (P.sahur <= 0) {
      P.invencivel = Math.max(P.invencivel, 1); // folga ao acabar o modo Sahur
      emitir('sahurFim');
    }
  }
  if (P.invencivel > 0) P.invencivel -= dt;

  // velocidade volta aos poucos; o chefe anda na velocidade base
  if (P.fator < 1) P.fator = Math.min(1, P.fator + RECUPERA * P.vBase * dt);
  const pg = P.perseguidor;
  const antes = pg.dist;
  pg.dist += (v - P.vBase) * dt;
  if (P.fator >= 0.999) pg.dist += RECUO * dt;
  pg.dist = Math.min(DIST_MAX, pg.dist);
  if (antes < 7 && pg.dist >= 7) emitir('perseguidorLonge');
  if (antes >= 7 && pg.dist < 7) emitir('perseguidorPerto');

  if (r) {
    if (r.tipo === 'serra' || r.tipo === 'caiu') {
      if (op.imortal) return;
      terminar(P, r.tipo, emitir, r.e);
      return;
    }
    const k = r.tipo === 'tropeco' ? CHOQUE.tropeco : r.tipo === 'escalou' ? CHOQUE.escalou : r.forte ? CHOQUE.forte : CHOQUE.leve;
    P.fator = Math.min(P.fator, k);
    P.trombadas++;
    emitir(r.tipo, r);
  }
  if (!op.imortal && pg.dist <= DIST_PEGA) {
    terminar(P, 'pego', emitir);
    return;
  }

  // coletas
  const zj = P.d;
  const alcanceIma = P.ima > 0 ? 14 : 0;
  for (const e of ents) {
    if (e.tipo !== 'moeda' && e.tipo !== 'poder') continue;
    if (e.pega) continue;
    if (e.z > zj + 1.2 + alcanceIma || e.z < zj - 1.2) continue;
    const dx = Math.abs(c.x - e.faixa * FAIXA);
    const dy = e.y - (c.y + 0.9);
    const pertoIma = e.tipo === 'moeda' && alcanceIma > 0 && e.z < zj + alcanceIma && Math.abs(dy) < 4;
    if (pertoIma || (dx < 1.1 && Math.abs(e.z - zj) < 1.0 && Math.abs(dy) < 1.3)) {
      e.pega = true;
      if (e.tipo === 'moeda') {
        P.moedas++;
        emitir('moeda', e);
      } else {
        if (e.poder === 'ima') P.ima = DURACAO_IMA;
        else {
          P.sahur = DURACAO_SAHUR;
          P.fator = 1;
        }
        emitir('poder', e.poder);
      }
    }
  }
}

/** @param {Partida} P @param {'serra' | 'pego' | 'caiu'} motivo @param {(ev: string, dado?: any) => void} emitir @param {any} [e] */
function terminar(P, motivo, emitir, e) {
  P.fim = { motivo, t: P.t };
  emitir('fim', { motivo, e });
}

/**
 * Continuar depois do fim (recompensado): limpa a frente, afasta o chefe e da alguns segundos de folga.
 * @param {Partida} P
 */
export function reviver(P) {
  if (!P.fim) return;
  P.fim = null;
  P.revividas++;
  const c = P.corredor;
  for (const e of P.pista.ents) {
    if (e.tipo === 'obs' && e.z < P.d + 40 && e.z + e.c > P.d - 2) e.quebrado = true;
  }
  P.pista.ents = P.pista.ents.filter((e) => !(e.tipo === 'vao' && e.z < P.d + 40 && e.z + e.c > P.d - 4));
  c.caindoNaAgua = false;
  c.y = 0;
  c.vy = 0;
  c.noChao = true;
  c.rolando = 0;
  c.x = c.faixa * FAIXA;
  P.fator = 1;
  P.invencivel = INVENCIVEL_REVIVER;
  P.perseguidor.dist = DIST_MAX;
}

/** Fracao do amanhecer (0 = madrugada, 1 = dia). @param {Partida} P */
export const amanhecer = (P) => Math.min(1, P.d / DISTANCIA_AMANHECER);
