// Adaptador da Y8 (SDK 2-0, docs.y8.com), com a mesma interface do plataforma.js. Entra so na build da Y8:
// o tools/empacotar.mjs --alvo=y8 grava este arquivo no lugar do src/core/plataforma.js (com os ids) e poe a
// tag async do SDK, do CDN da Y8, no <head>. Base: o adaptador do kit (jogos/distribuicao/kit/src/core/portais/y8.js).
// Regras seguidas (Ad Placement Guidelines e Game Requirements da Y8):
// - appId e gameId da aba "SDK Initialization" do painel, em package.json "portais.y8" (o empacotar.mjs grava
//   em IDS). Sem appId o SDK nem inicia e o jogo segue sem anuncios;
// - prontidao pelo evento y8sdk.ready, mais emitReadyEvent() para o caso de o SDK ja ter chegado. Se o script
//   nao carregar (bloqueador de anuncio), o onerror da tag liga window.__sdkFalhou e dispara y8sdk.falhou:
//   o jogo segue na hora, sem anuncios e sem o botao de video;
// - pre-roll: e da propria Y8, antes do jogo;
// - intersticial (type 'next') so no clique do jogador num botao da tela de fim ("Correr de novo" e "Trocar de
//   mapa", os pontos de intervalo que o jogo ja usa), nunca automatico, e no maximo um a cada INTERVALO_MIN,
//   contado desde o inicio do jogo (o pre-roll da Y8 vale como o primeiro). Break pulado pelo SDK nao conta, e
//   a Y8 ainda limita a frequencia por conta propria;
// - pausar e calar SO dentro do beforeAd; break pulado (limite de frequencia, sem anuncio) nao chama beforeAd
//   e termina no adBreakDone. O jogo volta no afterAd (intersticial) ou no adBreakDone;
// - premiado (type 'reward') so no "Continuar", por escolha do jogador; premio so com adViewed;
// - idioma por getPlatformLocale (pt-BR, en, es); sem resposta, ingles;
// - pausaNoBlur: o main.js abre a pausa quando a janela perde o foco.

/** @typedef {'pt-BR' | 'en' | 'es'} Idioma */

/** Os ids do painel da Y8 (o tools/empacotar.mjs grava os de package.json "portais.y8"). */
export const IDS = {};

/** Minimo entre dois intersticiais mostrados (ms). */
export const INTERVALO_MIN = 180000;

/** Prazos em ms: SDK pronto, idioma, comeco do anuncio (por tipo), duracao maxima e fecho depois do afterAd. */
export const PRAZOS = Object.freeze({ pronto: 4000, idioma: 1500, next: 6000, reward: 10000, anuncio: 180000, fecho: 1500 });

/** @param {string} l @returns {Idioma} */
const normalizar = (l) => {
  const x = String(l || '').toLowerCase();
  if (x.startsWith('pt')) return 'pt-BR';
  if (x.startsWith('es')) return 'es';
  return 'en';
};

/** Resolve com o valor ou com a reserva no prazo (ou na rejeicao). Nunca rejeita. */
function comPrazo(promessa, ms, reserva) {
  return new Promise((resolve) => {
    const id = setTimeout(() => resolve(reserva), ms);
    Promise.resolve(promessa).then((v) => { clearTimeout(id); resolve(v); }, () => { clearTimeout(id); resolve(reserva); });
  });
}

/**
 * @param {string} [_navegador] nao usado: na Y8 o padrao e ingles (o idioma vem do subdominio)
 * @param {string} [forcado] ?lang= dos testes
 * @param {{ janela?: any, obterY8?: () => any, ids?: Record<string, string>, relogio?: () => number, prazos?: Partial<typeof PRAZOS> }} [o]
 */
export function criarPlataforma(_navegador = 'en', forcado = '', o = {}) {
  const janela = o.janela !== undefined ? o.janela : typeof window !== 'undefined' ? window : null;
  const obterY8 = o.obterY8 || (() => janela && janela.y8);
  const ids = o.ids || IDS;
  const relogio = o.relogio || (() => performance.now());
  const prazo = { ...PRAZOS, ...(o.prazos || {}) };
  /** @type {any} */
  let sdk = null;
  let locale = '';
  let carregado = false;
  let jogando = false;
  /** instante do ultimo intersticial mostrado (beforeAd). Conta do inicio do jogo: a Y8 mostra o proprio pre-roll */
  let ultimoIntervalo = relogio();
  /** @type {Promise<any>|null} break em andamento (clique repetido espera o mesmo) */
  let pendente = null;
  const ouvintes = { pause: [], resume: [], mute: [], unmute: [] };
  /** @param {'pause' | 'resume' | 'mute' | 'unmute'} ev */
  const avisar = (ev) => {
    for (const cb of ouvintes[ev]) try { cb(); } catch { /* ignora */ }
  };
  const temAnuncios = () => !!sdk && !!ids.gameId;

  /** O objeto window.y8 quando o SDK fica pronto; null se o script falhou ou nao ha appId. */
  function esperarSdk() {
    return new Promise((resolve) => {
      if (!janela || !ids.appId || janela.__sdkFalhou) {
        resolve(null);
        return;
      }
      // captura: dentro do onerror da tag, o dispatchEvent e o do proprio <script> (o evento nao borbulha);
      // so um ouvinte de captura na janela o recebe
      janela.addEventListener('y8sdk.falhou', () => resolve(null), { once: true, capture: true });
      janela.addEventListener('y8sdk.ready', () => resolve(obterY8()), { once: true, capture: true });
      try {
        const ja = obterY8();
        if (ja && typeof ja.emitReadyEvent === 'function') ja.emitReadyEvent();
      } catch { /* o evento vem do script */ }
    });
  }

  async function iniciar() {
    const y8 = await esperarSdk();
    if (!y8 || typeof y8.sdk !== 'function') return;
    try {
      const s = y8.sdk();
      const anuncios = ids.gameId ? { gameId: String(ids.gameId), preloadAdBreaks: 'on', sound: 'on' } : undefined;
      Promise.resolve(s.init({ appId: String(ids.appId), autoLogin: false }, anuncios)).catch(() => {});
      sdk = s;
    } catch {
      return;
    }
    try {
      const l = await comPrazo(sdk.getPlatformLocale(), prazo.idioma, '');
      locale = typeof l === 'string' ? l : '';
    } catch {
      locale = '';
    }
  }

  /** resolve quando o SDK responde, falha ou o prazo vence (se ele chegar depois, os anuncios ligam dali em diante) */
  const iniciado = comPrazo(iniciar(), prazo.pronto, undefined);

  /**
   * Pede um break da Y8. Resolve no fim (intersticial: true; premiado: true so com adViewed).
   * Se o anuncio so comecar depois do prazo, o jogo ja seguiu: pausa e cala pelo canal do portal (pause/mute).
   * @param {'next' | 'reward'} tipo @param {() => void} aoComecar
   * @returns {Promise<boolean>}
   */
  function pedir(tipo, aoComecar) {
    return new Promise((resolve) => {
      const premiado = tipo === 'reward';
      let viu = false;
      let fim = false;
      let atrasado = false;
      let tardio = false;
      /** @type {any} */
      let id = null;
      const armar = (ms, fn) => {
        clearTimeout(id);
        id = setTimeout(fn, ms);
      };
      const sair = (ok) => {
        if (fim) return;
        fim = true;
        clearTimeout(id);
        resolve(ok);
      };
      const soltarTardio = () => {
        if (!tardio) return;
        tardio = false;
        avisar('resume');
        avisar('unmute');
      };
      armar(prazo[tipo], () => {
        atrasado = true;
        if (!premiado) ultimoIntervalo = relogio(); // SDK mudo: nao insistir a cada clique
        sair(false);
      });
      /** @type {any} */
      const pedido = {
        type: tipo,
        name: premiado ? 'continue-run' : 'run-again',
        beforeAd: () => {
          if (!premiado) ultimoIntervalo = relogio();
          if (fim) {
            if (atrasado && !tardio) {
              tardio = true;
              avisar('pause');
              avisar('mute');
            }
            return;
          }
          armar(prazo.anuncio, () => sair(premiado ? viu : true));
          if (typeof aoComecar === 'function') aoComecar();
        },
        afterAd: () => {
          if (tardio) {
            soltarTardio();
            return;
          }
          if (!premiado) sair(true);
          else armar(prazo.fecho, () => sair(viu));
        },
        adBreakDone: () => {
          soltarTardio();
          sair(premiado ? viu : true);
        },
      };
      if (premiado) {
        // o jogador ja escolheu ver (botao "Continuar"): mostra direto
        pedido.beforeReward = (mostrar) => { if (typeof mostrar === 'function') mostrar(); };
        pedido.adViewed = () => { viu = true; };
        pedido.adDismissed = () => {};
      }
      try {
        Promise.resolve(sdk.showAd(pedido)).catch(() => sair(false));
      } catch {
        sair(false);
      }
    });
  }

  const api = {
    get portal() { return !!sdk; },
    iniciado,
    /** pausar quando a janela perde o foco (requisito da Y8) */
    pausaNoBlur: true,
    /** @returns {Idioma} */
    idioma() {
      return normalizar(forcado || locale || 'en');
    },
    /** @param {number} _f */
    progresso(_f) {},
    carregou() {
      carregado = true;
    },
    jogar() {
      if (!carregado || jogando) return;
      jogando = true;
    },
    parar() {
      jogando = false;
    },
    get jogando() { return jogando; },
    /**
     * Intersticial depois do clique num botao da tela de fim. Resolve quando o jogo pode seguir.
     * @param {() => void} aoComecar pausar e calar o jogo (so no beforeAd)
     */
    async intervalo(aoComecar) {
      api.parar();
      if (!temAnuncios()) return;
      if (pendente) {
        await pendente;
        return;
      }
      if (relogio() - ultimoIntervalo < INTERVALO_MIN) return;
      pendente = pedir('next', aoComecar);
      try {
        await pendente;
      } finally {
        pendente = null;
      }
    },
    /**
     * Video que o jogador escolheu ver. So da o premio com adViewed.
     * @param {'small' | 'medium' | 'large'} _tamanho @param {() => void} aoComecar
     * @returns {Promise<boolean>}
     */
    async recompensado(_tamanho, aoComecar) {
      api.parar();
      if (!temAnuncios() || pendente) return false;
      pendente = pedir('reward', aoComecar);
      try {
        return (await pendente) === true;
      } finally {
        pendente = null;
      }
    },
    /** sem SDK (bloqueador, sem ids) nao ha video: o botao "Continuar" some */
    anunciosBloqueados() {
      return !temAnuncios();
    },
    /** @param {'pause' | 'resume' | 'mute' | 'unmute'} ev @param {() => void} cb */
    on(ev, cb) {
      ouvintes[ev].push(cb);
    },
    /** @param {string} _cat @param {string} [_oQue] @param {string} [_acao] */
    medir(_cat, _oQue, _acao) {},
    /** @param {unknown} _erro */
    erro(_erro) {},
  };
  return api;
}

/** @typedef {ReturnType<typeof criarPlataforma>} Plataforma */
