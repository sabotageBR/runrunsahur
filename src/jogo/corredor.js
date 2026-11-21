// Fisica do corredor: faixa, pulo, rolar, tacada e colisao com a pista. Logica pura.
//
// O que acontece ao encostar num obstaculo:
// - serra (rio): corta o Sahur ao meio (fim da corrida);
// - de frente num obstaculo comum: TROMBADA. O obstaculo e derrubado (sai voando no render)
//   e o Sahur perde velocidade (o perseguidor chega mais perto). Forte nos grandes;
// - de frente na parede de uma plataforma sem rampa: ESCALA (sobe com dificuldade, perde velocidade);
// - de lado: TROPECO, volta para a faixa de antes e perde um pouco de velocidade;
// - agua (vao do rio): cai e afunda (fim da corrida).
import { FAIXA, ALTURA_PLATAFORMA, RAMPA } from './pista.js';

export const ALTURA_EM_PE = 1.7;
export const ALTURA_ROLANDO = 0.75;
export const MEIA_LARGURA = 0.35;
export const MEIA_LARGURA_OBS = 0.95;
const MEIO_Z = 0.35;
/** pulo: altura, tempo de subida e queda mais pesada (fica mais firme) */
export const ALTURA_PULO = 1.55;
export const TEMPO_SUBIDA = 0.31;
export const GRAVIDADE = (2 * ALTURA_PULO) / (TEMPO_SUBIDA * TEMPO_SUBIDA);
export const VEL_PULO = GRAVIDADE * TEMPO_SUBIDA;
export const QUEDA = 1.3;
/** tempo total no ar de um pulo no plano */
export const TEMPO_PULO = TEMPO_SUBIDA + Math.sqrt((2 * ALTURA_PULO) / (GRAVIDADE * QUEDA));
const VEL_QUEDA_RAPIDA = -26;
/** troca de faixa: rapida no comeco, macia no fim */
const LATERAL_K = 15;
const LATERAL_MIN = 7;
export const TEMPO_ROLAR = 0.62;
export const TEMPO_TACADA = 0.34;
/** janela em que a tacada quebra (segundos desde o inicio) e alcance a frente */
const TACADA_DE = 0.04;
const TACADA_ATE = 0.24;
const ALCANCE_TACADA = 3.4;
const RECARGA_TACADA = 0.42;
const COYOTE = 0.1;
const BUFFER_PULO = 0.16;
/** altura que o pe "sobe sozinho" ao encostar numa beirada */
const DEGRAU = 0.45;

export function criarCorredor() {
  return {
    faixa: 0,
    faixaAnterior: 0,
    x: 0,
    /** velocidade lateral (para inclinar o corpo no render) */
    vx: 0,
    y: 0,
    vy: 0,
    noChao: true,
    /** tempo desde que saiu do chao (coyote) */
    noAr: 0,
    rolando: 0,
    tacada: -1,
    recarga: 0,
    bufferPulo: 0,
    /** afundando num vao */
    caindoNaAgua: false,
    /** subindo uma rampa (para o render inclinar) */
    rampa: false,
  };
}

/** @typedef {ReturnType<typeof criarCorredor>} Corredor */
/** @typedef {{ esquerda?: boolean, direita?: boolean, pular?: boolean, rolar?: boolean, tacada?: boolean }} Comando */
/** @typedef {{ tipo: 'serra' | 'caiu' | 'trombada' | 'escalou' | 'tropeco', e?: any, forte?: boolean }} Colisao */

/** Obstaculo ainda no caminho (nem quebrado pela tacada, nem derrubado numa trombada). @param {any} e */
export const solido = (e) => !e.quebrado && !e.derrubado;

/**
 * Altura do chao embaixo do corredor (plataformas, rampas, topo de obstaculos e vaos).
 * @param {import('./pista.js').Entidade[]} ents @param {number} x @param {number} z @param {number} y
 * @param {boolean} semVao modo Sahur: a agua nao derruba
 * @returns {{ h: number, rampa: boolean }}
 */
export function chaoEm(ents, x, z, y, semVao) {
  let h = 0;
  let agua = false;
  let rampa = false;
  for (const e of ents) {
    if (e.z - RAMPA > z + 1) continue;
    if (e.tipo === 'vao') {
      if (!semVao && z >= e.z && z <= e.z + e.c && Math.abs(x - e.faixa * FAIXA) < 0.6) agua = true;
      continue;
    }
    if (e.tipo !== 'obs' || !solido(e) || e.forma === 'alto' || e.serra) continue;
    if (Math.abs(x - e.faixa * FAIXA) > 1.0) continue;
    if (e.forma !== 'plataforma') {
      // da para pousar em cima de qualquer obstaculo baixo o bastante (tolerancia pequena)
      if (z >= e.z && z <= e.z + e.c && y >= e.y1 - 0.25) h = Math.max(h, e.y1);
      continue;
    }
    if (z >= e.z && z <= e.z + e.c) {
      if (y >= ALTURA_PLATAFORMA - DEGRAU) h = Math.max(h, ALTURA_PLATAFORMA);
    } else if (e.rampa && z >= e.z - RAMPA && z < e.z) {
      const hr = ALTURA_PLATAFORMA * (z - (e.z - RAMPA)) / RAMPA;
      if (y >= hr - DEGRAU - 0.2 && hr >= h) {
        h = hr;
        rampa = true;
      }
    }
  }
  if (agua && h === 0) return { h: -20, rampa: false };
  return { h, rampa };
}

/** So a altura do chao (o render usa para a sombra). */
export const alturaChao = (ents, x, z, y, semVao) => chaoEm(ents, x, z, y, semVao).h;

/**
 * Um passo de fisica. `d` e a distancia antes do passo e `dz` o avanco.
 * @param {Corredor} c @param {import('./pista.js').Entidade[]} ents @param {number} d @param {number} dz
 * @param {number} dt @param {Comando} cmd @param {{ sahur: boolean, invencivel: boolean }} estado
 * @param {(ev: string, dado?: any) => void} emitir
 * @returns {Colisao | null}
 */
export function passoCorredor(c, ents, d, dz, dt, cmd, estado, emitir) {
  // comandos
  if (cmd.esquerda && c.faixa > -1) {
    c.faixaAnterior = c.faixa;
    c.faixa--;
    emitir('faixa', -1);
  }
  if (cmd.direita && c.faixa < 1) {
    c.faixaAnterior = c.faixa;
    c.faixa++;
    emitir('faixa', 1);
  }
  if (cmd.pular) c.bufferPulo = BUFFER_PULO;
  if (cmd.rolar) {
    if (!c.noChao && c.vy > VEL_QUEDA_RAPIDA) c.vy = VEL_QUEDA_RAPIDA;
    if (c.rolando <= 0) emitir('rolar');
    c.rolando = TEMPO_ROLAR;
    c.bufferPulo = 0;
  }
  if (cmd.tacada && c.recarga <= 0) {
    c.tacada = 0;
    c.recarga = RECARGA_TACADA;
    emitir('tacada');
  }
  c.recarga -= dt;
  if (c.tacada >= 0) {
    c.tacada += dt;
    if (c.tacada > TEMPO_TACADA) c.tacada = -1;
  }
  if (c.rolando > 0) c.rolando -= dt;
  if (c.bufferPulo > 0) c.bufferPulo -= dt;

  const xAnt = c.x;
  const yAnt = c.y;
  // lateral: rapida no comeco e macia no fim
  const alvo = c.faixa * FAIXA;
  const falta = alvo - c.x;
  const passoX = Math.max(LATERAL_MIN, Math.abs(falta) * LATERAL_K) * dt;
  c.x = Math.abs(falta) <= passoX ? alvo : c.x + Math.sign(falta) * passoX;
  c.vx = dt > 0 ? (c.x - xAnt) / dt : 0;

  // pulo (com coyote e buffer)
  if (c.bufferPulo > 0 && (c.noChao || c.noAr < COYOTE) && c.vy <= 0.01 && !c.caindoNaAgua) {
    c.vy = VEL_PULO;
    c.noChao = false;
    c.noAr = COYOTE;
    c.bufferPulo = 0;
    c.rolando = 0;
    emitir('pulo');
  }

  const z = d + dz;
  const chao = chaoEm(ents, c.x, z, yAnt, estado.sahur);
  let h = chao.h;
  if (c.caindoNaAgua) h = -20; // quem afundou nao volta
  c.rampa = chao.rampa && c.noChao;
  if (c.noChao && h < c.y - 0.05) {
    c.noChao = false; // saiu da beirada
    c.noAr = 0;
  }
  if (!c.noChao) {
    c.noAr += dt;
    // cai mais pesado do que sobe
    c.vy -= GRAVIDADE * (c.vy < 0 ? QUEDA : 1) * dt;
    c.y += c.vy * dt;
    if (c.y <= h && h > -1) {
      const forte = c.vy < -9;
      c.y = h;
      c.vy = 0;
      c.noChao = true;
      emitir('pousou', forte);
    }
  } else {
    c.y = h; // rampa
  }
  if (h <= -1 && c.y < -0.05) {
    if (!c.caindoNaAgua) emitir('agua');
    c.caindoNaAgua = true;
  }
  if (c.y < -1.4) return { tipo: 'caiu' };

  // colisao
  const altura = c.rolando > 0 ? ALTURA_ROLANDO : ALTURA_EM_PE;
  for (const e of ents) {
    if (e.tipo !== 'obs' || !solido(e)) continue;
    if (e.z > z + MEIO_Z + 0.5) continue;
    if (e.z + e.c < z - MEIO_Z) continue;
    const ox = e.faixa * FAIXA;
    if (Math.abs(c.x - ox) >= MEIA_LARGURA + MEIA_LARGURA_OBS) continue;
    if (c.y >= e.y1 || c.y + altura <= e.y0) continue;
    // sobreposicao nos 3 eixos
    if (e.forma !== 'alto' && !e.serra) {
      // vindo de cima (ou quase no topo), pousa
      const tol = e.forma === 'plataforma' ? DEGRAU : 0.25;
      if (yAnt >= e.y1 - 0.05 || (c.y + tol >= e.y1 && c.vy <= 0.01)) {
        c.y = e.y1;
        if (c.vy <= 0) {
          c.noChao = true;
          c.vy = 0;
        }
        continue;
      }
    }
    if (estado.sahur) {
      if (e.forma === 'plataforma') {
        // o tambor leva por cima
        c.y = e.y1;
        c.vy = 0;
        c.noChao = true;
      } else {
        e.quebrado = true;
        emitir('quebrou', e);
      }
      continue;
    }
    if (estado.invencivel) continue;
    if (e.serra) return { tipo: 'serra', e };
    const forte = e.forma === 'bloco' || e.forma === 'movel';
    const zFrenteAnt = e.z + (e.forma === 'movel' ? e.vel * dt : 0);
    if (d + MEIO_Z <= zFrenteAnt + 0.05) {
      if (Math.abs(c.x - ox) < 0.9) {
        if (e.forma === 'plataforma') {
          // parede sem rampa: escala com dificuldade
          c.y = e.y1;
          c.vy = 0;
          c.noChao = true;
          c.rolando = 0;
          return { tipo: 'escalou', e };
        }
        e.derrubado = true;
        c.rolando = 0;
        return { tipo: 'trombada', e, forte };
      }
      // raspou na quina: tropeca e sai para o lado de fora
      if (c.faixa === e.faixa) c.faixa = c.faixaAnterior;
      c.x = ox + Math.sign(c.x - ox) * (MEIA_LARGURA + MEIA_LARGURA_OBS + 0.01);
      return { tipo: 'tropeco', e };
    }
    // de lado so se o passo anterior estava livre no x; senao e trombada
    if (Math.abs(xAnt - ox) < MEIA_LARGURA + MEIA_LARGURA_OBS) {
      if (e.forma === 'plataforma') {
        c.y = e.y1;
        c.vy = 0;
        c.noChao = true;
        return { tipo: 'escalou', e };
      }
      e.derrubado = true;
      return { tipo: 'trombada', e, forte };
    }
    c.faixa = c.faixaAnterior;
    c.x = xAnt;
    return { tipo: 'tropeco', e };
  }

  // tacada quebra caixotes a frente
  if (c.tacada >= TACADA_DE && c.tacada <= TACADA_ATE) {
    for (const e of ents) {
      if (e.tipo !== 'obs' || !e.quebravel || !solido(e)) continue;
      if (e.z > z + ALCANCE_TACADA || e.z + e.c < z - MEIO_Z) continue;
      if (Math.abs(c.x - e.faixa * FAIXA) > 1.3) continue;
      if (c.y > e.y1 + 0.3) continue;
      e.quebrado = true;
      emitir('quebrou', e);
    }
  }
  return null;
}
