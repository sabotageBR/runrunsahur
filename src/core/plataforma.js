// Adaptador da PlataformaSDK (californiagames.io). Unico modulo que fala com a SDK.
// Sem a SDK (desenvolvimento local), tudo vira um substituto que nao faz nada: o jogo roda igual,
// o "Continuar" libera o premio e o idioma vem do navegador.
// Regras seguidas (jogos/distribuicao/INTEGRACAO.md):
// - init logo no comeco; gameLoadingStart/Finished (uma vez so);
// - gameplayStart so depois do loading e quando o jogador corre de fato; gameplayStop em menu,
//   fim de corrida, pausa e ANTES de qualquer intervalo;
// - commercialBreak em todo ponto natural (fim de corrida -> correr de novo, troca de mapa);
//   o portal decide a frequencia;
// - rewardedBreak sempre na forma de objeto; premio so com === true; botao some com bloqueador;
// - pause/resume/mute/unmute idempotentes, somados a pausa e ao mudo do proprio jogo;
// - idioma por getLanguage (pt-BR, en, es; o resto vira en).

/** @typedef {'pt-BR' | 'en' | 'es'} Idioma */

/** @param {string} [navegador] idioma do navegador (so sem a SDK) @param {string} [forcado] ?lang= dos testes */
export function criarPlataforma(navegador = 'pt-BR', forcado = '') {
  /** @type {any} */
  const sdk = /** @type {any} */ (globalThis).PlataformaSDK;
  const portal = !!sdk;
  let carregado = false;
  let jogando = false;
  const ouvintes = { pause: [], resume: [], mute: [], unmute: [] };

  /** resolve quando o aperto de mao com o portal termina (ou a SDK cai no modo autonomo) */
  let iniciado = Promise.resolve();
  if (portal) {
    try {
      iniciado = Promise.resolve(sdk.init()).catch(() => {});
      sdk.gameLoadingStart();
      for (const ev of /** @type {const} */ (['pause', 'resume', 'mute', 'unmute'])) {
        sdk.on(ev, () => {
          for (const cb of ouvintes[ev]) cb();
        });
      }
    } catch { /* ignora */ }
  }

  /** @param {string} l @returns {Idioma} */
  const normalizar = (l) => {
    const x = String(l || '').toLowerCase();
    if (x.startsWith('pt')) return 'pt-BR';
    if (x.startsWith('es')) return 'es';
    return 'en';
  };

  return {
    portal,
    iniciado,
    /** perder o foco da janela nao pausa aqui (so a aba oculta); a Y8 liga (plataforma-y8.js) */
    pausaNoBlur: false,
    /** @returns {Idioma} */
    idioma() {
      if (forcado) return normalizar(forcado);
      if (portal) {
        try {
          return normalizar(sdk.getLanguage());
        } catch { /* cai no padrao */ }
        return 'en';
      }
      return normalizar(navegador);
    },
    /** @param {number} f */
    progresso(f) {
      if (portal) try { sdk.gameLoadingProgress(Math.max(0, Math.min(1, f))); } catch { /* ignora */ }
    },
    carregou() {
      if (carregado) return;
      carregado = true;
      if (portal) try { sdk.gameLoadingFinished(); } catch { /* ignora */ }
    },
    jogar() {
      if (!carregado || jogando) return;
      jogando = true;
      if (portal) try { sdk.gameplayStart(); } catch { /* ignora */ }
    },
    parar() {
      if (!jogando) return;
      jogando = false;
      if (portal) try { sdk.gameplayStop(); } catch { /* ignora */ }
    },
    get jogando() { return jogando; },
    /**
     * Ponto natural de pausa. Para o gameplay antes. Resolve quando o jogo pode seguir.
     * @param {() => void} aoComecar pausar e calar o jogo
     */
    async intervalo(aoComecar) {
      this.parar();
      if (!portal) return;
      try {
        await sdk.commercialBreak(aoComecar);
      } catch { /* segue o jogo */ }
    },
    /**
     * Video que o jogador escolheu ver. So da o premio com true.
     * @param {'small' | 'medium' | 'large'} tamanho @param {() => void} aoComecar
     * @returns {Promise<boolean>}
     */
    async recompensado(tamanho, aoComecar) {
      this.parar();
      if (!portal) return true; // desenvolvimento: libera o premio
      try {
        return (await sdk.rewardedBreak({ size: tamanho, onStart: aoComecar })) === true;
      } catch {
        return false;
      }
    },
    anunciosBloqueados() {
      if (!portal) return false;
      try {
        return !!sdk.isAdBlocked();
      } catch {
        return false;
      }
    },
    /** @param {'pause' | 'resume' | 'mute' | 'unmute'} ev @param {() => void} cb */
    on(ev, cb) {
      ouvintes[ev].push(cb);
    },
    /** @param {string} cat @param {string} [oQue] @param {string} [acao] */
    medir(cat, oQue, acao) {
      if (portal) try { sdk.measure(cat, oQue, acao); } catch { /* ignora */ }
    },
    /** @param {unknown} erro */
    erro(erro) {
      if (portal) try { sdk.captureError(erro); } catch { /* ignora */ }
    },
  };
}

/** @typedef {ReturnType<typeof criarPlataforma>} Plataforma */
