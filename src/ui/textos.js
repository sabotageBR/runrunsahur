// Textos da interface em pt-BR, en e es (o idioma vem do portal, por src/core/plataforma.js).

const TEXTOS = {
  'pt-BR': {
    toque: 'Toque para correr',
    teclas: '← → desvia · ↑ pula · ↓ rola · toque ou espaço: TUNG!',
    escolhaMapa: 'Escolha o mapa',
    pontos: 'Pontos',
    moedas: 'Moedas',
    recorde: 'Recorde',
    jogarDeNovo: 'Correr de novo',
    continuar: 'Continuar',
    continuarSub: 'assista a um vídeo',
    trocarMapa: 'Trocar de mapa',
    pausa: 'Pausa',
    voltar: 'Voltar',
    novoRecorde: 'Novo recorde!',
    motivos: { serra: 'Serrado ao meio!', pego: 'Pego!', caiu: 'Caiu na água!' },
    perseguidor: { vila: 'O galo do amanhecer te alcançou.', rio: 'O castor te alcançou.' },
    dicaPerseguidor: 'Cada trombada deixa o chefe mais perto!',
    dicas: {
      baixo: '↑ Pule!', quebravel: 'Toque: TUNG! Quebra os caixotes', alto: '↓ Role por baixo!', bloco: '← → Desvie!',
      serra: '← → Fuja da serra!', movel: '← → Saia da frente!', plataforma: 'Suba pela rampa!', vao: '↑ Pule a água!',
    },
    poderes: { ima: 'Ímã!', sahur: 'MODO SAHUR!' },
    cenarios: { vila: 'Vila do Sahur', rio: 'Rio de toras' },
    cenariosSub: { vila: 'A vila às 3h da manhã', rio: 'Toras, serras e água' },
    anuncio: 'Intervalo',
  },
  en: {
    toque: 'Tap to run',
    teclas: '← → dodge · ↑ jump · ↓ roll · tap or space: TUNG!',
    escolhaMapa: 'Pick a map',
    pontos: 'Score',
    moedas: 'Coins',
    recorde: 'Best',
    jogarDeNovo: 'Run again',
    continuar: 'Continue',
    continuarSub: 'watch a video',
    trocarMapa: 'Change map',
    pausa: 'Paused',
    voltar: 'Resume',
    novoRecorde: 'New best!',
    motivos: { serra: 'Sawed in half!', pego: 'Caught!', caiu: 'Splash!' },
    perseguidor: { vila: 'The dawn rooster caught you.', rio: 'The beaver caught you.' },
    dicaPerseguidor: 'Every bump brings the boss closer!',
    dicas: {
      baixo: '↑ Jump!', quebravel: 'Tap: TUNG! Smash the crates', alto: '↓ Roll under!', bloco: '← → Dodge!',
      serra: '← → Avoid the saw!', movel: '← → Get out of the way!', plataforma: 'Take the ramp!', vao: '↑ Jump the water!',
    },
    poderes: { ima: 'Magnet!', sahur: 'SAHUR MODE!' },
    cenarios: { vila: 'Sahur Village', rio: 'Log River' },
    cenariosSub: { vila: 'The village at 3 a.m.', rio: 'Logs, saws and water' },
    anuncio: 'Break',
  },
  es: {
    toque: 'Toca para correr',
    teclas: '← → esquiva · ↑ salta · ↓ rueda · toque o espacio: ¡TUNG!',
    escolhaMapa: 'Elige el mapa',
    pontos: 'Puntos',
    moedas: 'Monedas',
    recorde: 'Récord',
    jogarDeNovo: 'Correr de nuevo',
    continuar: 'Continuar',
    continuarSub: 'mira un video',
    trocarMapa: 'Cambiar de mapa',
    pausa: 'Pausa',
    voltar: 'Seguir',
    novoRecorde: '¡Nuevo récord!',
    motivos: { serra: '¡Partido por la sierra!', pego: '¡Atrapado!', caiu: '¡Al agua!' },
    perseguidor: { vila: 'El gallo del amanecer te alcanzó.', rio: 'El castor te alcanzó.' },
    dicaPerseguidor: '¡Cada choque acerca al jefe!',
    dicas: {
      baixo: '↑ ¡Salta!', quebravel: 'Toque: ¡TUNG! Rompe las cajas', alto: '↓ ¡Rueda por debajo!', bloco: '← → ¡Esquiva!',
      serra: '← → ¡Cuidado con la sierra!', movel: '← → ¡Apártate!', plataforma: '¡Sube por la rampa!', vao: '↑ ¡Salta el agua!',
    },
    poderes: { ima: '¡Imán!', sahur: '¡MODO SAHUR!' },
    cenarios: { vila: 'Aldea Sahur', rio: 'Río de troncos' },
    cenariosSub: { vila: 'La aldea a las 3 de la mañana', rio: 'Troncos, sierras y agua' },
    anuncio: 'Pausa publicitaria',
  },
};

/** Textos do idioma atual (muda com definirIdioma). */
export let T = TEXTOS['pt-BR'];

/** @param {'pt-BR' | 'en' | 'es'} idioma */
export function definirIdioma(idioma) {
  T = TEXTOS[idioma] || TEXTOS.en;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = idioma;
    for (const el of document.querySelectorAll('[data-t]')) {
      const k = /** @type {HTMLElement} */ (el).dataset.t || '';
      const v = /** @type {any} */ (T)[k];
      if (typeof v === 'string') el.textContent = v;
    }
  }
  return T;
}
