// Unico modulo que le a URL. Parametros de teste e do laboratorio.
//   ?cenario=vila|rio  &semente=N  &auto (autopiloto)  &lang=pt-BR|en|es
//   &fixo&t=12 (avanca 12 s com o autopiloto e congela: prints)  &fps (FPS e draw calls)
//   &lab (botao de voltar ao laboratorio)  &novo (ignora o save)  &qualidade=alta|media|baixa
//   &inv (nao morre)  &tela=inicio|fim (prints das telas)

export function lerParametros() {
  let q;
  try {
    q = new URLSearchParams(location.search);
  } catch {
    q = new URLSearchParams();
  }
  const qual = q.get('qualidade');
  return {
    cenario: /** @type {'vila' | 'rio' | ''} */ (q.get('cenario') === 'rio' ? 'rio' : q.get('cenario') === 'vila' ? 'vila' : ''),
    /** idioma forcado nos testes (o portal manda ?lang= no iframe; a SDK tambem le) */
    lang: q.get('lang') || '',
    semente: Number(q.get('semente')) || 0,
    auto: q.has('auto'),
    fixo: q.has('fixo'),
    t: Number(q.get('t')) || 0,
    fps: q.has('fps'),
    lab: q.has('lab'),
    novo: q.has('novo'),
    qualidade: /** @type {'alta' | 'media' | 'baixa' | null} */ (qual === 'alta' || qual === 'media' || qual === 'baixa' ? qual : null),
    inv: q.has('inv'),
    tela: q.get('tela') || '',
  };
}
