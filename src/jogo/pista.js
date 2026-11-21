// Pista sem fim: entidades logicas (obstaculos, vaos, moedas e poderes) geradas por trechos,
// com semente. Nada aqui sabe de three.js: o render so le as entidades.
//
// Eixos: faixa -1, 0 ou 1 (x = faixa * FAIXA); z cresce para a frente (metros percorridos);
// y para cima. Um obstaculo ocupa [z, z + c] na pista e [y0, y1] na altura.
//
// Garantia de passagem: todo trecho e montado em volta de um caminho seguro (uma faixa
// passavel por fileira, com distancia de reacao entre elas). O teste roda o autopiloto por
// milhares de metros em varias sementes para provar.
import { criarRng } from './rng.js';

export const FAIXA = 2.2;
export const ALTURA_PLATAFORMA = 2.6;
export const RAMPA = 7;

/** Altura de cada forma. `passa` diz como o jogador atravessa. */
export const FORMAS = {
  baixo: { y0: 0, y1: 0.85, c: 0.7, passa: 'pular' },
  quebravel: { y0: 0, y1: 1.0, c: 1.1, passa: 'pular ou tacada' },
  alto: { y0: 1.05, y1: 3.1, c: 0.6, passa: 'rolar' },
  bloco: { y0: 0, y1: 2.5, c: 3.5, passa: 'trocar de faixa' },
  movel: { y0: 0, y1: 2.3, c: 2.8, passa: 'trocar de faixa' },
  plataforma: { y0: 0, y1: ALTURA_PLATAFORMA, c: 18, passa: 'subir pela rampa ou desviar' },
};

/** Velocidade do obstaculo movel (m/s, contra o jogador) e a distancia em que ele comeca a andar. */
export const VEL_MOVEL = 7;
export const ATIVA_MOVEL = 70;

/**
 * @typedef {{ id: number, tipo: 'obs', forma: keyof typeof FORMAS, faixa: number, z: number, c: number,
 *   y0: number, y1: number, quebravel: boolean, rampa: boolean, vel: number, ativo: boolean,
 *   quebrado: boolean, derrubado: boolean, serra: boolean, variante: number }} Obstaculo
 * @typedef {{ id: number, tipo: 'vao', faixa: number, z: number, c: number, variante: number }} Vao
 * @typedef {{ id: number, tipo: 'moeda', faixa: number, z: number, y: number, pega: boolean }} Moeda
 * @typedef {{ id: number, tipo: 'poder', poder: 'ima' | 'sahur', faixa: number, z: number, y: number, pega: boolean }} Poder
 * @typedef {Obstaculo | Vao | Moeda | Poder} Entidade
 */

/**
 * @param {number} semente
 * @param {'vila' | 'rio'} cenario
 */
export function criarPista(semente, cenario) {
  return {
    cenario,
    rng: criarRng(semente),
    /** @type {Entidade[]} */
    ents: [],
    /** ate onde ja foi gerado */
    fim: 0,
    proximoId: 1,
    /** z do ultimo poder colocado */
    ultimoPoder: 0,
    /** trechos gerados (o primeiro e sempre calmo) */
    trechos: 0,
    /** faixa segura no fim do ultimo trecho */
    faixaSegura: 0,
  };
}

/** @typedef {ReturnType<typeof criarPista>} Pista */

/** Distancia entre fileiras: tempo de reacao mais folga. @param {number} v */
export const folgaFileira = (v) => v * 0.78 + 2.5;
/** Distancia entre trechos. @param {number} v */
export const folgaTrecho = (v) => v * 0.9 + 4;

/**
 * Gera trechos ate `z`. `v` e a velocidade prevista ali (m/s).
 * @param {Pista} p @param {number} z @param {number} v
 */
export function gerarAte(p, z, v) {
  if (p.fim === 0) p.fim = 30; // largada livre
  while (p.fim < z) {
    const nivel = Math.min(1, p.fim / 2600);
    p.fim = gerarTrecho(p, p.fim, v * 1.06, nivel);
    p.trechos++;
  }
}

/** Remove o que ficou para tras. @param {Pista} p @param {number} z */
export function limparAtras(p, z) {
  if (!p.ents.length || p.ents[0].z + 40 > z) {
    // a lista e quase ordenada; so filtra quando ha o que tirar
    let tem = false;
    for (const e of p.ents) if (fimDe(e) < z) { tem = true; break; }
    if (!tem) return;
  }
  p.ents = p.ents.filter((e) => fimDe(e) >= z);
}

/** @param {Entidade} e */
export const fimDe = (e) => e.z + ('c' in e ? e.c : 0);

// ---------------------------------------------------------------------------------------
// trechos

/** @param {Pista} p @param {number} z0 @param {number} v @param {number} nivel @returns {number} fim */
function gerarTrecho(p, z0, v, nivel) {
  const r = p.rng;
  if (p.trechos === 0) return trechoMoedas(p, z0, v, 6);
  const pesos = {
    fileiras: 5,
    plataformas: 2.2 + nivel,
    quebraveis: 1.2,
    movel: nivel > 0.08 ? 0.8 + nivel * 1.6 : 0,
    vaos: p.cenario === 'rio' ? 1.6 : 0,
    moedas: 0.7,
  };
  const tipo = r.sortear(pesos);
  let fim;
  if (tipo === 'plataformas') fim = trechoPlataformas(p, z0, v, nivel);
  else if (tipo === 'quebraveis') fim = trechoQuebraveis(p, z0, v);
  else if (tipo === 'movel') fim = trechoMovel(p, z0, v, nivel);
  else if (tipo === 'vaos') fim = trechoVaos(p, z0, v, nivel);
  else if (tipo === 'moedas') fim = trechoMoedas(p, z0, v, r.inteiro(6, 10));
  else fim = trechoFileiras(p, z0, v, nivel);
  // poder de tempos em tempos, numa faixa segura logo depois do trecho
  if (fim - p.ultimoPoder > 380 && r.chance(0.55)) {
    const f = p.faixaSegura;
    poder(p, r.chance(0.5) ? 'ima' : 'sahur', f, fim + folgaTrecho(v) * 0.5);
    p.ultimoPoder = fim;
  }
  return fim + folgaTrecho(v);
}

/** Fileiras de obstaculos com um caminho seguro. */
function trechoFileiras(p, z0, v, nivel) {
  const r = p.rng;
  const n = r.inteiro(2, 3 + Math.round(nivel * 2));
  let z = z0;
  let segura = p.faixaSegura;
  for (let i = 0; i < n; i++) {
    // a faixa segura muda no maximo 2 faixas (sempre da tempo de trocar e agir)
    const nova = r.chance(0.55) ? r.inteiro(-1, 1) : segura;
    // moedas guiando ate a faixa segura
    linhaMoedas(p, nova, z - folgaFileira(v) + 3, Math.min(5, Math.floor((folgaFileira(v) - 5) / 2.4)), 0);
    segura = nova;
    const fim = fileira(p, z, segura, nivel, v);
    z = fim + folgaFileira(v);
  }
  p.faixaSegura = segura;
  return z - folgaFileira(v);
}

/**
 * Uma fileira: a faixa segura recebe algo passavel; as outras, qualquer coisa.
 * @returns {number} fim da fileira
 */
function fileira(p, z, segura, nivel, v) {
  const r = p.rng;
  const passaveis = p.cenario === 'rio'
    ? { livre: 1.4 - nivel * 0.6, baixo: 1, alto: 1, quebravel: 0.8, vao: 0.9 }
    : { livre: 1.4 - nivel * 0.6, baixo: 1, alto: 1, quebravel: 0.9 };
  const outras = p.cenario === 'rio'
    ? { livre: 1.2 - nivel * 0.5, baixo: 0.8, alto: 0.7, quebravel: 0.6, bloco: 1 + nivel * 1.5, vao: 0.6 }
    : { livre: 1.2 - nivel * 0.5, baixo: 0.8, alto: 0.7, quebravel: 0.7, bloco: 1 + nivel * 1.5 };
  /** @type {string[]} */
  const conteudo = [];
  for (let f = -1; f <= 1; f++) conteudo.push(r.sortear(f === segura ? passaveis : outras));
  // nunca uma fileira vazia
  if (conteudo.every((c) => c === 'livre')) conteudo[segura + 1] = r.escolher(['baixo', 'alto', 'quebravel']);
  let fim = z;
  for (let f = -1; f <= 1; f++) {
    const c = conteudo[f + 1];
    if (c === 'livre') continue;
    if (c === 'vao') {
      fim = Math.max(fim, vao(p, f, z, r.real(2.6, 3.6)));
      continue;
    }
    const forma = /** @type {keyof typeof FORMAS} */ (c);
    const comp = forma === 'bloco' ? r.real(2.6, 3.4 + nivel * 3) : FORMAS[forma].c;
    fim = Math.max(fim, obstaculo(p, forma, f, z, comp));
    // arco de moedas por cima do que se pula, na faixa segura
    if (f === segura && (forma === 'baixo' || forma === 'quebravel') && r.chance(0.6)) arcoMoedas(p, f, z, v);
  }
  return fim;
}

/** Plataformas altas (o papel dos trens): a rampa leva para cima, e o chao segue passavel. */
function trechoPlataformas(p, z0, v, nivel) {
  const r = p.rng;
  const duas = r.chance(0.35 + nivel * 0.3);
  const faixas = [-1, 0, 1];
  // a faixa de chao livre (sempre existe uma)
  const chao = r.escolher(faixas);
  const sobra = faixas.filter((f) => f !== chao);
  const lanes = duas ? sobra : [r.escolher(sobra)];
  let fim = z0;
  lanes.forEach((f, i) => {
    const comRampa = i === 0 || r.chance(0.5);
    const atraso = i === 0 ? 0 : r.real(-4, 8);
    const zi = z0 + RAMPA + Math.max(0, atraso);
    const comp = r.real(16, 26 + nivel * 10);
    const ob = obstaculo(p, 'plataforma', f, zi, comp);
    const o = /** @type {Obstaculo} */ (p.ents[p.ents.length - 1]);
    o.rampa = comRampa;
    if (!comRampa) o.z = Math.max(o.z, z0 + RAMPA + 6); // sem rampa, a frente fica mais longe para dar tempo de ver
    linhaMoedas(p, f, o.z + 2, Math.floor((o.c - 4) / 2.4), ALTURA_PLATAFORMA);
    fim = Math.max(fim, ob, o.z + o.c);
    // emenda: outra plataforma logo depois, sem rampa (pula de uma para a outra)
    if (r.chance(0.3 + nivel * 0.3)) {
      const vaoTopo = r.real(3, Math.min(5, v * 0.3));
      const z2 = o.z + o.c + vaoTopo;
      const c2 = r.real(12, 20);
      obstaculo(p, 'plataforma', f, z2, c2);
      linhaMoedas(p, f, z2 + 2, Math.floor((c2 - 4) / 2.4), ALTURA_PLATAFORMA);
      fim = Math.max(fim, z2 + c2);
    }
  });
  // chao: algumas fileiras leves (nada que exija trocar de faixa)
  let z = z0 + RAMPA + 4;
  while (z < fim - 6) {
    if (r.chance(0.55)) {
      const forma = /** @type {keyof typeof FORMAS} */ (r.escolher(['baixo', 'alto', 'quebravel']));
      obstaculo(p, forma, chao, z, FORMAS[forma].c);
    } else linhaMoedas(p, chao, z, 4, 0);
    z += folgaFileira(v) + 2;
  }
  p.faixaSegura = chao;
  return fim;
}

/** Caixotes nas 3 faixas: a tacada abre caminho (ou pula). */
function trechoQuebraveis(p, z0, v) {
  const r = p.rng;
  const n = r.inteiro(2, 4);
  let z = z0;
  for (let i = 0; i < n; i++) {
    for (let f = -1; f <= 1; f++) obstaculo(p, 'quebravel', f, z, FORMAS.quebravel.c);
    linhaMoedas(p, p.faixaSegura, z + 3, 3, 0);
    z += folgaFileira(v) * 0.85 + 1;
  }
  return z;
}

/** Um obstaculo andando contra o jogador; as outras faixas ficam leves. */
function trechoMovel(p, z0, v, nivel) {
  const r = p.rng;
  const m = r.inteiro(-1, 1);
  const livres = [-1, 0, 1].filter((f) => f !== m);
  // o movel anda ate ~30 m para tras antes do encontro: o trecho reserva esse espaco
  const zm = z0 + 32;
  const o = obstaculo(p, 'movel', m, zm, FORMAS.movel.c);
  const ob = /** @type {Obstaculo} */ (p.ents[p.ents.length - 1]);
  ob.vel = VEL_MOVEL + nivel * 3;
  const segura = r.escolher(livres);
  linhaMoedas(p, segura, z0 + 4, 8, 0);
  // as outras faixas podem ter uma fileira leve depois do movel
  if (r.chance(0.5 + nivel * 0.3)) {
    const forma = /** @type {keyof typeof FORMAS} */ (r.escolher(['baixo', 'alto', 'quebravel']));
    obstaculo(p, forma, segura, zm + 6, FORMAS[forma].c);
  }
  p.faixaSegura = segura;
  return Math.max(o, zm + 8);
}

/** Rio: canal de agua atravessando as 3 faixas (pular), as vezes com serra numa faixa. */
function trechoVaos(p, z0, v, nivel) {
  const r = p.rng;
  const n = r.inteiro(1, 2 + Math.round(nivel));
  let z = z0;
  for (let i = 0; i < n; i++) {
    const c = r.real(2.6, 3.4);
    const serra = nivel > 0.2 && r.chance(0.4) ? r.inteiro(-1, 1) : 9;
    for (let f = -1; f <= 1; f++) {
      if (f === serra) obstaculo(p, 'bloco', f, z, FORMAS.bloco.c);
      else vao(p, f, z, c);
    }
    if (serra !== 9 && serra === p.faixaSegura) p.faixaSegura = serra === 0 ? 1 : 0;
    arcoMoedas(p, p.faixaSegura, z, v);
    z += Math.max(c, FORMAS.bloco.c) + folgaFileira(v);
  }
  return z - folgaFileira(v);
}

/** Respiro: so moedas. */
function trechoMoedas(p, z0, v, n) {
  const f = p.rng.inteiro(-1, 1);
  linhaMoedas(p, f, z0, n, 0);
  p.faixaSegura = f;
  return z0 + n * 2.4;
}

// ---------------------------------------------------------------------------------------
// entidades

/** @returns {number} fim */
function obstaculo(p, forma, faixa, z, c) {
  const F = FORMAS[forma];
  p.ents.push({
    id: p.proximoId++, tipo: 'obs', forma, faixa, z, c, y0: F.y0, y1: F.y1,
    quebravel: forma === 'quebravel', rampa: false, vel: 0, ativo: false, quebrado: false, derrubado: false,
    // no rio o bloco e a serra da serraria: corta o Sahur ao meio
    serra: forma === 'bloco' && p.cenario === 'rio',
    variante: p.rng.inteiro(0, 3),
  });
  return z + c;
}

/** @returns {number} fim */
function vao(p, faixa, z, c) {
  p.ents.push({ id: p.proximoId++, tipo: 'vao', faixa, z, c, variante: p.rng.inteiro(0, 3) });
  return z + c;
}

function linhaMoedas(p, faixa, z, n, base) {
  for (let i = 0; i < n; i++) {
    p.ents.push({ id: p.proximoId++, tipo: 'moeda', faixa, z: z + i * 2.4, y: base + 1.0, pega: false });
  }
}

/** Moedas no arco do pulo sobre um obstaculo em z. */
function arcoMoedas(p, faixa, z, v) {
  const alcance = v * 0.58; // tempo no ar do pulo (corredor.TEMPO_PULO)
  const n = 5;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    p.ents.push({
      id: p.proximoId++, tipo: 'moeda', faixa, z: z - alcance * 0.45 + u * alcance, y: 1.0 + 1.35 * 4 * u * (1 - u), pega: false,
    });
  }
}

function poder(p, tipo, faixa, z) {
  p.ents.push({ id: p.proximoId++, tipo: 'poder', poder: tipo, faixa, z, y: 1.2, pega: false });
}
