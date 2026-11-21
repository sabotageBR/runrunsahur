// HUD e telas (DOM por cima do canvas): pontos, moedas, multiplicador, perigo (o chefe chegando),
// poderes, dicas, textos flutuantes ("TUNG!"), escolha do mapa, fim de corrida, pausa e os
// efeitos de tela do modo Sahur (borda arco-iris e clarao).
import { T } from './textos.js';
import { DURACAO_IMA, DURACAO_SAHUR, DIST_MAX, DIST_PEGA } from '../jogo/regras.js';

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));

export function criarHud() {
  const el = {
    hud: $('hud'), pontos: $('pontos'), mult: $('mult'), moedas: $('moedas'), poderes: $('poderes'), dica: $('dica'),
    flut: $('flutuantes'), inicio: $('inicio'), fim: $('fim'), pausa: $('pausa'), fps: $('fps'), lab: /** @type {HTMLAnchorElement} */ ($('bLab')),
    som: $('bSom'), anuncio: $('anuncio'), perigo: $('perigo'), perigoBarra: $('perigoBarra'), perigoIcone: $('perigoIcone'),
    estrela: $('estrela'), clarao: $('clarao'), continuar: $('bContinuar'),
  };
  let ultimo = { pontos: -1, moedas: -1, mult: -1, poderes: '', perigo: -1, estrela: '' };
  let timerDica = 0;

  /** Textos que dependem do mapa (os cartoes). */
  function textosMapas() {
    for (const m of ['vila', 'rio']) {
      const nome = document.querySelector(`[data-t-mapa="${m}"]`);
      const sub = document.querySelector(`[data-t-sub="${m}"]`);
      if (nome) nome.textContent = /** @type {any} */ (T.cenarios)[m];
      if (sub) sub.textContent = /** @type {any} */ (T.cenariosSub)[m];
    }
  }

  return {
    el,
    textosMapas,
    /** @param {{ vila: number, rio: number }} recordes @param {string} cenario */
    mostrarInicio(recordes, cenario) {
      textosMapas();
      $('recVila').textContent = Math.floor(recordes.vila).toLocaleString();
      $('recRio').textContent = Math.floor(recordes.rio).toLocaleString();
      this.marcarMapa(cenario);
      el.inicio.hidden = false;
      el.hud.hidden = true;
      el.fim.hidden = true;
      el.pausa.hidden = true;
      this.estrela(0);
    },
    /** @param {string} cenario */
    marcarMapa(cenario) {
      for (const b of document.querySelectorAll('.mapa')) b.classList.toggle('sel', /** @type {HTMLElement} */ (b).dataset.mapa === cenario);
      el.perigoIcone.textContent = cenario === 'rio' ? '🦫' : '🐓';
    },
    jogando() {
      el.inicio.hidden = true;
      el.fim.hidden = true;
      el.pausa.hidden = true;
      el.hud.hidden = false;
    },
    /** @param {import('../jogo/regras.js').Partida} P */
    atualizar(P) {
      const pts = Math.floor(P.pontos);
      if (pts !== ultimo.pontos) {
        el.pontos.textContent = pts.toLocaleString();
        ultimo.pontos = pts;
      }
      if (P.moedas !== ultimo.moedas) {
        el.moedas.textContent = String(P.moedas);
        ultimo.moedas = P.moedas;
      }
      if (P.mult !== ultimo.mult) {
        el.mult.textContent = `x${P.mult}`;
        ultimo.mult = P.mult;
      }
      // perigo: quanto o chefe ja encostou
      const perto = Math.max(0, Math.min(1, (DIST_MAX - 0.5 - P.perseguidor.dist) / (DIST_MAX - 0.5 - DIST_PEGA)));
      const p = Math.round(perto * 40);
      if (p !== ultimo.perigo) {
        el.perigo.classList.toggle('on', perto > 0.02);
        el.perigoBarra.style.width = `${Math.round(perto * 100)}%`;
        ultimo.perigo = p;
      }
      const lista = [];
      if (P.ima > 0) lista.push(['🧲', P.ima / DURACAO_IMA]);
      if (P.sahur > 0) lista.push(['🥁', P.sahur / DURACAO_SAHUR]);
      const chave = lista.map((x) => `${x[0]}${Math.round(Number(x[1]) * 40)}`).join();
      if (chave !== ultimo.poderes) {
        el.poderes.innerHTML = lista.map(([i, f]) => `<div class="poder"><i>${i}</i><div class="barra"><b style="width:${Math.round(Number(f) * 100)}%"></b></div></div>`).join('');
        ultimo.poderes = chave;
      }
      this.estrela(P.sahur);
    },
    /** Borda arco-iris do modo Sahur (pisca no fim). @param {number} resta segundos */
    estrela(resta) {
      const k = resta <= 0 ? '' : resta < 1.5 ? 'fim' : 'on';
      if (k === ultimo.estrela) return;
      ultimo.estrela = k;
      el.estrela.classList.toggle('on', !!k);
      el.estrela.classList.toggle('fim', k === 'fim');
    },
    clarao() {
      el.clarao.classList.remove('on');
      void el.clarao.offsetWidth;
      el.clarao.classList.add('on');
    },
    /** @param {string} txt */
    dica(txt) {
      el.dica.textContent = txt;
      el.dica.classList.add('on');
      clearTimeout(timerDica);
      timerDica = window.setTimeout(() => el.dica.classList.remove('on'), 1600);
    },
    /** Texto flutuante numa posicao da tela (px). @param {string} txt @param {number} x @param {number} y @param {string} [classe] */
    flutuar(txt, x, y, classe = 'tung') {
      const d = document.createElement('div');
      d.className = `flut ${classe}`;
      d.textContent = txt;
      d.style.left = `${x}px`;
      d.style.top = `${y}px`;
      el.flut.appendChild(d);
      setTimeout(() => d.remove(), 1150);
    },
    /**
     * @param {{ motivo: 'serra' | 'pego' | 'caiu', cenario: string, pontos: number, moedas: number, recorde: number, novo: boolean, podeContinuar: boolean }} o
     */
    mostrarFim(o) {
      $('motivo').textContent = T.motivos[o.motivo];
      $('motivoSub').textContent = o.motivo === 'pego' ? /** @type {any} */ (T.perseguidor)[o.cenario] : '';
      $('fimPontos').textContent = Math.floor(o.pontos).toLocaleString();
      $('fimMoedas').textContent = String(o.moedas);
      $('fimRecorde').textContent = Math.floor(o.recorde).toLocaleString();
      $('fimNovo').hidden = !o.novo;
      el.continuar.hidden = !o.podeContinuar;
      el.fim.hidden = false;
      el.hud.hidden = true;
      this.estrela(0);
    },
    /** @param {boolean} on */
    pausa(on) {
      el.pausa.hidden = !on;
    },
    /** @param {boolean} mudo */
    som(mudo) {
      el.som.textContent = mudo ? '🔇' : '🔊';
    },
    /** @param {string} txt */
    fps(txt) {
      el.fps.hidden = false;
      el.fps.textContent = txt;
    },
  };
}
