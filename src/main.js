// Liga tudo: parametros, plataforma (SDK), motor, personagem, os dois mapas, partida, controles,
// som e HUD. Um relogio so (agora(): performance.now menos o tempo de pausa) e logica em passo fixo.
import * as THREE from 'three';
import { lerParametros } from './core/depuracao.js';
import { ler, gravar } from './core/armazenamento.js';
import { criarAudio } from './core/audio.js';
import { criarPlataforma } from './core/plataforma.js';
import { criarMotor } from './render/motor.js';
import { criarPersonagem } from './render/personagem.js';
import { criarMundo } from './render/mundo.js';
import { criarCamera } from './render/camera.js';
import { criarVila } from './render/cenarios/vila.js';
import { criarRio } from './render/cenarios/rio.js';
import { criarRng } from './jogo/rng.js';
import { criarPartida, passo, reviver, amanhecer, DIST_MAX } from './jogo/regras.js';
import { alturaChao } from './jogo/corredor.js';
import { criarAutopiloto, decidir } from './jogo/autopiloto.js';
import { FAIXA } from './jogo/pista.js';
import { criarControles } from './ui/controles.js';
import { criarHud } from './ui/hud.js';
import { T, definirIdioma } from './ui/textos.js';

const PASSO = 1 / 60;
const prm = lerParametros();
const plataforma = criarPlataforma(typeof navigator !== 'undefined' ? navigator.language : 'pt-BR', prm.lang);
/** devolve o controle ao navegador entre as etapas pesadas (a SDK conversa com o portal nesse meio-tempo) */
const respirar = () => new Promise((r) => setTimeout(r, 0));
await plataforma.iniciado;
definirIdioma(plataforma.idioma());
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('tela'));
await respirar();
const motor = criarMotor(canvas, { qualidade: prm.qualidade || 'alta', fixa: prm.fixo || !!prm.qualidade });
plataforma.progresso(0.3);
await respirar();
const heroi = criarPersonagem(motor.texturas);
motor.cena.add(heroi.raiz, heroi.blob);
const cam = criarCamera(motor.camera);
const audio = criarAudio();
const hud = criarHud();

// ------------------------------------------------------------------------------------
// mapas (cada um com o seu mundo; o segundo so e montado quando escolhido)
/** @type {Record<string, ReturnType<typeof criarMundo>>} */
const mundos = {};
function obterMundo(nome) {
  if (!mundos[nome]) {
    const rng = criarRng(nome === 'rio' ? 20261119 : 20261118);
    const ctx = { materiais: motor.materiais, texturas: motor.texturas, rnd: rng.proximo };
    mundos[nome] = criarMundo(motor, nome === 'rio' ? criarRio(ctx) : criarVila(ctx));
  }
  return mundos[nome];
}
/** @type {'vila' | 'rio'} */
let mapa = prm.cenario || (ler('mapa', 'vila') === 'rio' ? 'rio' : 'vila');
await respirar();
let mundo = obterMundo(mapa);
motor.cena.add(mundo.raiz);
motor.cena.fog = mundo.nevoa;
plataforma.progresso(0.8);

let semente = prm.semente || (Date.now() % 100000) + 1;
let P = criarPartida({ semente, cenario: mapa });
let ap = criarAutopiloto();
let autopiloto = prm.auto;
/** @type {'inicio' | 'jogando' | 'morrendo' | 'fim'} */
let estado = 'inicio';
let pausaJogador = false;
let pausaPortal = false;
let anuncio = false;
let mudoPortal = false;
let tempoPausa = 0;
let inicioPausa = 0;
let pausadoAntes = false;
const estaPausado = () => pausaJogador || pausaPortal || anuncio;
const agora = () => performance.now() - tempoPausa - (pausadoAntes ? performance.now() - inicioPausa : 0);
const recordes = { vila: prm.novo ? 0 : ler('recorde:vila', 0), rio: prm.novo ? 0 : ler('recorde:rio', 0) };
let intro = 1;
let tFim = 0;
let tacadaVisual = -1;
const dicasVistas = new Set(prm.novo ? [] : ler('dicas', []));
let tAcum = 0;
let congelado = false;
let passos = 0;

audio.definirMudo(prm.novo ? false : ler('mudo', false));
hud.som(audio.mudo);
if (hud.el.lab) hud.el.lab.hidden = !prm.lab; // o build nao tem o atalho do laboratorio

const controles = criarControles(canvas, () => {
  audio.destravar();
  if (estado === 'inicio' && !estaPausado()) comecar();
});

// ------------------------------------------------------------------------------------
// pausa e som: jogador, portal e anuncio somados (um nao desfaz o outro)
function aplicarPausa() {
  const p = estaPausado();
  if (p !== pausadoAntes) {
    if (p) inicioPausa = performance.now();
    else tempoPausa += performance.now() - inicioPausa;
    pausadoAntes = p;
    audio.pausar(p);
    controles.ligar(!p && estado === 'jogando');
  }
  hud.pausa(pausaJogador && !anuncio);
  audio.calar(mudoPortal || anuncio);
  sincronizarGameplay();
}
/** gameplayStart/Stop conforme o estado (so com o jogador correndo de fato). */
function sincronizarGameplay() {
  if (estado === 'jogando' && !estaPausado() && !congelado) plataforma.jogar();
  else plataforma.parar();
}
plataforma.on('pause', () => { pausaPortal = true; aplicarPausa(); });
plataforma.on('resume', () => { pausaPortal = false; aplicarPausa(); });
plataforma.on('mute', () => { mudoPortal = true; aplicarPausa(); });
plataforma.on('unmute', () => { mudoPortal = false; aplicarPausa(); });

// ------------------------------------------------------------------------------------
/** @param {'vila' | 'rio'} nome */
function trocarMapa(nome) {
  if (nome === mapa && P.t === 0) return;
  motor.cena.remove(mundo.raiz);
  mapa = nome;
  mundo = obterMundo(nome);
  motor.cena.add(mundo.raiz);
  motor.cena.fog = mundo.nevoa;
  mundo.reiniciar();
  gravar('mapa', nome);
  novaPartida();
  mundo.cenario.aplicarLuz(motor, 0);
  hud.marcarMapa(nome);
  audio.ambiente(nome);
}

function novaPartida() {
  semente = prm.semente ? semente + 1 : (Date.now() % 100000) + 1;
  P = criarPartida({ semente, cenario: mapa });
  ap = criarAutopiloto();
  mundo.reiniciar();
  heroi.disparar('reiniciar');
  tAcum = 0;
  audio.estrela(false);
}

function comecar() {
  if (estado === 'jogando') return;
  estado = 'jogando';
  hud.jogando();
  controles.ligar(true);
  audio.destravar();
  audio.tocar('inicio');
  audio.musica(mapa, true);
  audio.ambiente(mapa);
  plataforma.medir('run', mapa, 'start');
  sincronizarGameplay();
}

/** Volta para a tela de inicio (escolha do mapa). */
function irParaInicio() {
  novaPartida();
  estado = 'inicio';
  controles.ligar(true);
  hud.mostrarInicio(recordes, mapa);
  audio.musica(mapa, false);
  sincronizarGameplay();
}

/** @param {string} ev @param {any} dado */
function emitir(ev, dado) {
  mundo.evento(ev, dado, P);
  if (ev === 'tacada') {
    tacadaVisual = 0;
    audio.tocar('tacada');
  } else if (ev === 'quebrou') {
    audio.tocar('quebrou');
    flutuarNoHeroi('TUNG!', 'tung');
    cam.tremer(0.25);
  } else if (ev === 'moeda') audio.tocar('moeda');
  else if (ev === 'pulo') {
    audio.tocar('pulo');
    heroi.disparar('pulo');
  } else if (ev === 'rolar') audio.tocar('rolar');
  else if (ev === 'faixa') audio.tocar('faixa');
  else if (ev === 'pousou') {
    heroi.disparar('pousou', dado);
    if (dado) audio.tocar('pousou');
  } else if (ev === 'tropeco') {
    audio.tocar('tropeco');
    heroi.disparar('tropeco');
    cam.tremer(0.5);
  } else if (ev === 'trombada') {
    audio.tocar('trombada');
    heroi.disparar('trombada', dado.forte);
    cam.tremer(dado.forte ? 1.1 : 0.7);
    flutuarNoHeroi(dado.forte ? 'TUNG!!' : 'TUNG!', 'ai');
    avisarPerseguidor();
  } else if (ev === 'escalou') {
    audio.tocar('escalou');
    heroi.disparar('escalou');
    cam.tremer(0.5);
    avisarPerseguidor();
  } else if (ev === 'agua') audio.tocar('agua');
  else if (ev === 'perseguidorPerto') audio.tocar(mapa === 'rio' ? 'castor' : 'galo');
  else if (ev === 'poder') {
    if (dado === 'sahur') {
      audio.tocar('sahur');
      audio.estrela(true);
      hud.clarao();
      cam.tremer(0.4);
    } else audio.tocar('poder');
    flutuarNoHeroi(T.poderes[/** @type {'ima' | 'sahur'} */ (dado)], 'poder');
  } else if (ev === 'sahurFim') audio.estrela(false);
  else if (ev === 'fim') {
    const motivo = dado.motivo;
    if (motivo === 'serra') {
      audio.tocar('serra');
      heroi.disparar('cortar');
      cam.tremer(1.0);
    } else if (motivo === 'pego') {
      audio.tocar(mapa === 'rio' ? 'castor' : 'galo');
      cam.tremer(0.6);
    }
    audio.tocar('fim');
    audio.estrela(false);
    audio.serraPerto(0);
    estado = 'morrendo';
    tFim = 0;
    controles.ligar(false);
    plataforma.medir('run', mapa, 'end');
    plataforma.medir('death', motivo);
    sincronizarGameplay();
  }
}

/** Na primeira trombada da sessao, explica o chefe. */
function avisarPerseguidor() {
  if (dicasVistas.has('perseguidor') || prm.auto || prm.fixo) return;
  dicasVistas.add('perseguidor');
  gravar('dicas', [...dicasVistas]);
  hud.dica(T.dicaPerseguidor);
}

const _v = new THREE.Vector3();
function flutuarNoHeroi(txt, classe) {
  _v.set(P.corredor.x, P.corredor.y + 2.3, -0.5).project(motor.camera);
  const r = canvas.getBoundingClientRect();
  hud.flutuar(txt, (_v.x * 0.5 + 0.5) * r.width, (-_v.y * 0.5 + 0.5) * r.height, classe);
}

function terminarPartida() {
  estado = 'fim';
  const pts = Math.floor(P.pontos);
  const novo = pts > recordes[mapa];
  if (novo) {
    recordes[mapa] = pts;
    if (!prm.novo) gravar(`recorde:${mapa}`, pts);
  }
  audio.musica(mapa, false);
  hud.mostrarFim({
    motivo: /** @type {any} */ (P.fim?.motivo || 'pego'), cenario: mapa, pontos: P.pontos, moedas: P.moedas, recorde: recordes[mapa], novo,
    podeContinuar: P.revividas === 0 && !plataforma.anunciosBloqueados(),
  });
  sincronizarGameplay();
}

/** Dica de contexto na primeira vez que cada coisa aparece na faixa do jogador. */
function verificarDicas() {
  if (prm.auto || prm.fixo || autopiloto) return;
  const c = P.corredor;
  for (const e of P.pista.ents) {
    if (e.tipo !== 'obs' && e.tipo !== 'vao') continue;
    const dist = e.z - P.d;
    if (dist < 4 || dist > 26) continue;
    if (e.faixa !== c.faixa) continue;
    const ob = /** @type {any} */ (e);
    const k = e.tipo === 'vao' ? 'vao' : ob.serra ? 'serra' : ob.forma;
    if (k === 'plataforma' && !ob.rampa) continue;
    if (dicasVistas.has(k)) continue;
    dicasVistas.add(k);
    gravar('dicas', [...dicasVistas]);
    hud.dica(/** @type {any} */ (T.dicas)[k]);
    break;
  }
}

/** Zumbido da serra mais forte quanto mais perto (rio). */
function somDaSerra() {
  if (mapa !== 'rio' || estado !== 'jogando') {
    audio.serraPerto(0);
    return;
  }
  let k = 0;
  for (const e of P.pista.ents) {
    if (e.tipo !== 'obs' || !(/** @type {any} */ (e).serra) || e.quebrado || e.derrubado) continue;
    const dz = e.z - P.d;
    if (dz < -6 || dz > 40) continue;
    const dist = Math.hypot(dz, (e.faixa * FAIXA - P.corredor.x) * 2);
    k = Math.max(k, 1 - dist / 40);
  }
  audio.serraPerto(k);
}

// ------------------------------------------------------------------------------------
// botoes
const clique = (id, fn) => {
  const b = document.getElementById(id);
  if (!b) return;
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    audio.destravar();
    fn();
  });
};
clique('bDeNovo', async () => {
  // ponto natural: intervalo comercial antes de correr de novo
  await plataforma.intervalo(() => { anuncio = true; aplicarPausa(); });
  anuncio = false;
  aplicarPausa();
  novaPartida();
  estado = 'inicio';
  comecar();
});
clique('bMapa', async () => {
  await plataforma.intervalo(() => { anuncio = true; aplicarPausa(); });
  anuncio = false;
  aplicarPausa();
  irParaInicio();
});
clique('bContinuar', async () => {
  const ok = await plataforma.recompensado('medium', () => { anuncio = true; aplicarPausa(); });
  anuncio = false;
  aplicarPausa();
  if (!ok) return;
  reviver(P);
  mundo.reiniciar();
  heroi.disparar('reiniciar');
  estado = 'jogando';
  hud.jogando();
  controles.ligar(true);
  audio.musica(mapa, true);
  sincronizarGameplay();
});
clique('bPausa', () => { pausaJogador = true; aplicarPausa(); });
clique('bVoltar', () => { pausaJogador = false; aplicarPausa(); });
clique('bSom', () => {
  audio.definirMudo(!audio.mudo);
  gravar('mudo', audio.mudo);
  hud.som(audio.mudo);
});
for (const b of document.querySelectorAll('.mapa')) {
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    audio.destravar();
    audio.tocar('botao');
    const nome = /** @type {HTMLElement} */ (b).dataset.mapa === 'rio' ? 'rio' : 'vila';
    if (nome !== mapa) trocarMapa(nome);
  });
}
window.addEventListener('keydown', (e) => {
  if ((e.key === 'Escape' || e.key.toLowerCase() === 'p') && estado === 'jogando') {
    pausaJogador = !pausaJogador;
    aplicarPausa();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && estado === 'jogando') {
    pausaJogador = true;
    aplicarPausa();
  }
});
// portal que pede pausa ao perder o foco (Y8): a janela perdeu o foco no meio da corrida, abre a pausa
window.addEventListener('blur', () => {
  if (plataforma.pausaNoBlur && estado === 'jogando' && !pausaJogador) {
    pausaJogador = true;
    aplicarPausa();
  }
});
window.addEventListener('error', (e) => plataforma.erro(e.error || e.message));

// ------------------------------------------------------------------------------------
// laco
let ultimo = agora();
let acumLuz = 1;
let primeiroQuadro = true;

function quadro() {
  requestAnimationFrame(quadro);
  const t = agora();
  let dt = Math.min(0.1, (t - ultimo) / 1000);
  ultimo = t;
  if (estaPausado() || congelado) dt = 0;
  motor.medir(dt || PASSO);
  let dz = 0;
  if (estado === 'jogando' && dt > 0) {
    tAcum += dt;
    let n = 0;
    while (tAcum >= PASSO && n < 6 && estado === 'jogando') {
      const cmd = autopiloto ? decidir(ap, P) : controles.consumir();
      const d0 = P.d;
      passo(P, PASSO, cmd, emitir, { imortal: prm.inv });
      dz += P.d - d0;
      tAcum -= PASSO;
      n++;
    }
    if (n >= 6) tAcum = 0;
    verificarDicas();
    hud.atualizar(P);
    somDaSerra();
    // passos no ritmo da corrida
    const c = P.corredor;
    if (c.noChao && c.rolando <= 0) {
      passos += dt * 2 * (1.6 + P.v * 0.065);
      if (passos >= 1) {
        passos -= 1;
        audio.tocar('passo');
      }
    }
  } else if (estado === 'morrendo') {
    tFim += dt;
    if (tFim > (P.fim?.motivo === 'serra' ? 1.7 : 1.3)) terminarPartida();
  }
  if (tacadaVisual >= 0) {
    tacadaVisual += dt;
    if (tacadaVisual > 0.34) tacadaVisual = -1;
  }
  atualizarCena(dt, dz);
  acumLuz += dt;
  if (acumLuz > 0.2 || dt === 0) {
    mundo.cenario.aplicarLuz(motor, amanhecer(P));
    acumLuz = 0;
  }
  motor.renderizar();
  if (primeiroQuadro) {
    primeiroQuadro = false;
    plataforma.progresso(1);
    plataforma.carregou();
    sincronizarGameplay();
  }
  if (prm.fps) {
    const inf = motor.info();
    hud.fps(`${motor.fps.toFixed(0)} fps  ${inf.calls} draws\n${(inf.triangles / 1000).toFixed(0)}k tris  ${motor.qualidade}`);
  }
}

/** Mundo, heroi e camera de um quadro. @param {number} dt @param {number} dz */
function atualizarCena(dt, dz) {
  const fim = P.fim?.motivo;
  const modo = estado === 'inicio' ? 'idle' : estado === 'jogando' ? 'correr' : fim === 'serra' ? 'cortado' : fim === 'pego' ? 'pego' : 'caido';
  mundo.atualizar(P, dt, { modo, dz, pego: (estado === 'morrendo' || estado === 'fim') && fim === 'pego' });
  const c = P.corredor;
  heroi.raiz.position.set(c.x, Math.max(c.y, -1.2), 0);
  const chao = alturaChao(P.pista.ents, c.x, P.d, c.y + 0.05, P.sahur > 0);
  heroi.blob.visible = chao > -1 && !c.caindoNaAgua;
  heroi.blob.position.set(c.x, Math.max(0, chao) + 0.02, 0);
  heroi.atualizar(dt, {
    modo, v: P.v, noChao: c.noChao, vy: c.vy, rolando: c.rolando > 0, tacada: tacadaVisual,
    altura: c.y, chao: Math.max(0, chao), sahur: estado === 'jogando' ? P.sahur : 0, vx: c.vx, rampa: c.rampa,
  });
  intro += ((estado === 'inicio' ? 1 : 0) - intro) * Math.min(1, dt * 2.6);
  cam.atualizar(P, dt, intro > 0.002 ? intro : 0);
}

// ------------------------------------------------------------------------------------
// largada
hud.mostrarInicio(recordes, mapa);
mundo.cenario.aplicarLuz(motor, 0);
if (prm.auto || prm.fixo) {
  comecar();
  intro = 0;
}
if (prm.fixo) {
  // avanca com o autopiloto ate t e congela (prints)
  while (P.t < prm.t && !P.fim) {
    const d0 = P.d;
    passo(P, PASSO, decidir(ap, P), emitir, { imortal: prm.inv });
    if (tacadaVisual >= 0) {
      tacadaVisual += PASSO;
      if (tacadaVisual > 0.34) tacadaVisual = -1;
    }
    atualizarCena(PASSO, P.d - d0);
  }
  hud.atualizar(P);
  mundo.cenario.aplicarLuz(motor, amanhecer(P));
  congelado = true;
}
if (prm.tela === 'fim') {
  P.fim = { motivo: 'pego', t: P.t };
  terminarPartida();
}
requestAnimationFrame(quadro);

// ganchos para os prints, a prova do portal e os testes
/** @type {any} */ (window).__rrs = {
  get P() { return P; },
  get estado() { return estado; },
  get mapa() { return mapa; },
  get congelado() { return congelado; },
  get pausado() { return estaPausado(); },
  get calado() { return audio.calado; },
  get mudo() { return audio.mudo; },
  get jogando() { return plataforma.jogando; },
  get idioma() { return document.documentElement.lang; },
  agora,
  motor,
  pronto: true,
  DIST_MAX,
  /** liga/desliga o autopiloto (fotos de gameplay na prova) @param {boolean} on */
  autopiloto(on) { autopiloto = on; },
  /** troca de mapa na tela de inicio @param {'vila' | 'rio'} nome */
  mapa_(nome) { trocarMapa(nome); },
};
