// Som 100% sintetizado (WebAudio), nenhum arquivo:
// - a FALA do Sahur ("tung tung tung... sahur!") por sintese de formantes (fonte glotal +
//   3 filtros de vogal + ruido para as consoantes);
// - efeitos: o "tung" do tronco (modos de madeira), passos, pulo, moedas com combo, trombada,
//   caixote quebrando, serra, agua, o galo cantando e o castor;
// - ambiente (grilos na vila, correnteza no rio) e musica em laco por mapa;
// - a musica da estrela (modo Sahur), original, rapida e brilhante.
// Volume: mestre <- (efeitos, voz, musica, ambiente). `mudo` e o botao do jogador; `calado` e o
// portal (anuncio, mute); um nao desfaz o outro.

/** Vogais/consoantes: formantes (Hz), ganhos, voz (fonte glotal) e ruido (consoante). */
const FONEMAS = {
  t: { d: 0.028, f: [320, 800, 2300], g: [1, 0.5, 0.15], voz: 0, ruido: 1, rf: 4200 },
  u: { d: 0.11, f: [320, 800, 2300], g: [1, 0.5, 0.12], voz: 1, ruido: 0, rf: 0 },
  ng: { d: 0.075, f: [270, 1800, 2600], g: [1, 0.06, 0.03], voz: 0.6, ruido: 0, rf: 0 },
  s: { d: 0.12, f: [700, 1250, 2600], g: [1, 0.5, 0.2], voz: 0, ruido: 0.75, rf: 6800 },
  a: { d: 0.15, f: [760, 1260, 2600], g: [1, 0.65, 0.22], voz: 1, ruido: 0, rf: 0 },
  h: { d: 0.055, f: [400, 900, 2400], g: [1, 0.5, 0.2], voz: 0.12, ruido: 0.5, rf: 1400 },
  U: { d: 0.13, f: [350, 820, 2300], g: [1, 0.5, 0.14], voz: 1, ruido: 0, rf: 0 },
  r: { d: 0.15, f: [430, 1150, 1650], g: [1, 0.55, 0.3], voz: 0.85, ruido: 0, rf: 0, trilo: true },
  k: { d: 0.03, f: [450, 900, 2400], g: [1, 0.5, 0.2], voz: 0, ruido: 0.9, rf: 2200 },
  o: { d: 0.12, f: [480, 900, 2500], g: [1, 0.55, 0.15], voz: 1, ruido: 0, rf: 0 },
  i: { d: 0.1, f: [300, 2200, 2900], g: [1, 0.5, 0.3], voz: 1, ruido: 0, rf: 0 },
};

export function criarAudio() {
  /** @type {AudioContext | null} */
  let ctx = null;
  /** @type {Record<string, GainNode>} */
  const bus = {};
  let mudo = false;
  let calado = false;
  let pausado = false;
  /** @type {AudioBuffer | null} */
  let ruido = null;
  const musica = { ligada: false, cenario: 'vila', proxima: 0, passo: 0, timer: 0, estrela: false };
  const ambiente = { cenario: '', nos: /** @type {AudioNode[]} */ ([]), timer: 0 };
  let serra = /** @type {{ osc: OscillatorNode, g: GainNode } | null} */ (null);
  let combo = { n: 0, t: 0 };

  const volMestre = () => (mudo || calado ? 0 : 0.85);

  function garantir() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.18;
      comp.connect(ctx.destination);
      bus.mestre = ctx.createGain();
      bus.mestre.gain.value = volMestre();
      bus.mestre.connect(comp);
      for (const [nome, v] of [['fx', 0.9], ['voz', 1.0], ['musica', 0.3], ['amb', 0.35]]) {
        bus[nome] = ctx.createGain();
        bus[nome].gain.value = /** @type {number} */ (v);
        bus[nome].connect(bus.mestre);
      }
      // eco curto na voz (fica com cara de "anuncio de alto-falante" do meme)
      const eco = ctx.createDelay(0.5);
      eco.delayTime.value = 0.11;
      const ecoG = ctx.createGain();
      ecoG.gain.value = 0.22;
      bus.voz.connect(eco);
      eco.connect(ecoG);
      ecoG.connect(bus.mestre);
      ecoG.connect(eco);
      ruido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = ruido.getChannelData(0);
      let s = 1;
      for (let i = 0; i < d.length; i++) {
        s = (s * 16807) % 2147483647;
        d[i] = (s / 2147483647) * 2 - 1;
      }
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  /** @param {number} freq @param {number} t0 @param {number} dur @param {{ tipo?: OscillatorType, vol?: number, ate?: number, destino?: AudioNode, ataque?: number }} [o] */
  function tom(freq, t0, dur, o = {}) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.tipo || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.ate) osc.frequency.exponentialRampToValueAtTime(o.ate, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol ?? 0.3, t0 + (o.ataque ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(o.destino || bus.fx);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** @param {number} t0 @param {number} dur @param {{ freq?: number, q?: number, vol?: number, tipo?: BiquadFilterType, destino?: AudioNode, ate?: number, ataque?: number }} [o] */
  function chiado(t0, dur, o = {}) {
    if (!ctx || !ruido) return;
    const src = ctx.createBufferSource();
    src.buffer = ruido;
    const f = ctx.createBiquadFilter();
    f.type = o.tipo || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1000, t0);
    if (o.ate) f.frequency.exponentialRampToValueAtTime(o.ate, t0 + dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    if (o.ataque) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(o.vol ?? 0.3, t0 + o.ataque);
    } else g.gain.setValueAtTime(o.vol ?? 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(o.destino || bus.fx);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + dur + 0.02);
  }

  /** "Tung": madeira oca (tres modos com decaimentos diferentes + estalo). */
  function tung(t0, alt = 1, destino = bus.fx, vol = 0.55) {
    tom(165 * alt, t0, 0.32, { ate: 120 * alt, vol, destino });
    tom(165 * 2.76 * alt, t0, 0.12, { vol: vol * 0.32, destino, tipo: 'sine' });
    tom(165 * 5.4 * alt, t0, 0.05, { vol: vol * 0.16, destino, tipo: 'triangle' });
    chiado(t0, 0.03, { freq: 2600, q: 1.5, vol: vol * 0.55, destino });
    chiado(t0, 0.12, { freq: 420 * alt, q: 4, vol: vol * 0.35, destino });
  }

  /**
   * Fala por formantes. `silabas` e uma lista de [fonema, ...] por silaba, com a altura (Hz).
   * @param {number} t0 @param {{ fones: string[], f0: number, f0fim?: number, vol?: number }[]} silabas
   * @param {{ pausa?: number, timbre?: number, destino?: AudioNode }} [o]
   * @returns {number} quando termina
   */
  function falar(t0, silabas, o = {}) {
    if (!ctx || !ruido) return t0;
    const timbre = o.timbre || 1;
    const dest = o.destino || bus.voz;
    // fonte glotal: dente de serra com vibrato leve
    const glote = ctx.createOscillator();
    glote.type = 'sawtooth';
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.5;
    const vibG = ctx.createGain();
    vibG.gain.value = 2.5;
    vib.connect(vibG);
    vibG.connect(glote.frequency);
    const gVoz = ctx.createGain();
    gVoz.gain.value = 0;
    glote.connect(gVoz);
    const ru = ctx.createBufferSource();
    ru.buffer = ruido;
    ru.loop = true;
    const fRu = ctx.createBiquadFilter();
    fRu.type = 'bandpass';
    fRu.Q.value = 1.4;
    const gRu = ctx.createGain();
    gRu.gain.value = 0;
    ru.connect(fRu);
    fRu.connect(gRu);
    const saida = ctx.createGain();
    saida.gain.value = 1;
    const filtros = [0, 1, 2].map(() => {
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 9;
      const g = ctx.createGain();
      gVoz.connect(f);
      gRu.connect(f);
      f.connect(g);
      g.connect(saida);
      return { f, g };
    });
    // a consoante tambem passa direto (chiado do s e do t)
    gRu.connect(saida);
    const passaBaixa = ctx.createBiquadFilter();
    passaBaixa.type = 'lowpass';
    passaBaixa.frequency.value = 7000;
    saida.connect(passaBaixa);
    passaBaixa.connect(dest);

    let t = t0;
    for (const sil of silabas) {
      const vol = sil.vol ?? 1;
      const durSil = sil.fones.reduce((n, f) => n + FONEMAS[f].d, 0);
      glote.frequency.setValueAtTime(sil.f0, t);
      glote.frequency.linearRampToValueAtTime(sil.f0fim ?? sil.f0 * 0.94, t + durSil);
      for (const nome of sil.fones) {
        const F = FONEMAS[nome];
        filtros.forEach(({ f, g }, i) => {
          f.frequency.setTargetAtTime(F.f[i] * timbre, t, 0.012);
          g.gain.setTargetAtTime(F.g[i] * 2.2, t, 0.012);
        });
        gVoz.gain.setTargetAtTime(F.voz * 0.55 * vol, t, 0.01);
        gRu.gain.setTargetAtTime(F.ruido * 0.5 * vol, t, 0.005);
        if (F.rf) fRu.frequency.setValueAtTime(F.rf, t);
        if (F.trilo) {
          // r vibrado: tres batidinhas
          for (let k = 0; k < 3; k++) {
            gVoz.gain.setTargetAtTime(0.12 * vol, t + k * 0.05 + 0.02, 0.006);
            gVoz.gain.setTargetAtTime(F.voz * 0.55 * vol, t + k * 0.05 + 0.035, 0.006);
          }
        }
        t += F.d;
      }
      gVoz.gain.setTargetAtTime(0, t, 0.015);
      gRu.gain.setTargetAtTime(0, t, 0.01);
      t += o.pausa ?? 0.02;
    }
    glote.start(t0);
    vib.start(t0);
    ru.start(t0, Math.random());
    const fim = t + 0.25;
    glote.stop(fim);
    vib.stop(fim);
    ru.stop(fim);
    return t;
  }

  const TUNG = (f0) => ({ fones: ['t', 'u', 'ng'], f0, f0fim: f0 * 0.9 });
  /** "Tung tung ... sahur!" com n tungs. */
  function falaSahur(t0, n = 9, vol = 1) {
    const sil = [];
    for (let i = 0; i < n; i++) sil.push({ ...TUNG(118 + (i % 3 === 2 ? 6 : 0)), vol });
    let t = falar(t0, sil, { pausa: 0.03 });
    t += 0.06;
    falar(t, [{ fones: ['s', 'a'], f0: 122, f0fim: 128, vol }, { fones: ['h', 'U', 'r'], f0: 150, f0fim: 112, vol: vol * 1.1 }], { pausa: 0.0 });
  }

  const SONS = {
    tacada: () => {
      const t = ctx.currentTime;
      chiado(t, 0.14, { freq: 2600, ate: 500, q: 0.8, vol: 0.2 });
    },
    quebrou: () => {
      const t = ctx.currentTime;
      tung(t, 1.0, bus.fx, 0.6);
      for (let i = 0; i < 4; i++) chiado(t + 0.02 + i * 0.03, 0.06, { freq: 1200 + i * 500, q: 3, vol: 0.18 });
      chiado(t, 0.3, { freq: 700, q: 0.6, vol: 0.35, tipo: 'lowpass' });
      falar(t + 0.02, [{ fones: ['t', 'u', 'ng'], f0: 140, f0fim: 120, vol: 0.55 }]);
    },
    pulo: () => {
      const t = ctx.currentTime;
      tom(260, t, 0.18, { ate: 640, vol: 0.12, tipo: 'triangle' });
      chiado(t, 0.16, { freq: 1200, ate: 3200, vol: 0.07 });
    },
    rolar: () => {
      const t = ctx.currentTime;
      for (let i = 0; i < 3; i++) tung(t + i * 0.09, 0.62, bus.fx, 0.18);
      chiado(t, 0.35, { freq: 260, q: 0.6, vol: 0.2, tipo: 'lowpass' });
    },
    faixa: () => {
      const t = ctx.currentTime;
      chiado(t, 0.12, { freq: 900, ate: 2800, q: 1.2, vol: 0.07, ataque: 0.02 });
    },
    moeda: () => {
      const t = ctx.currentTime;
      combo.n = t - combo.t < 0.45 ? Math.min(combo.n + 1, 10) : 0;
      combo.t = t;
      const k = Math.pow(2, combo.n / 12);
      tom(1318 * k, t, 0.08, { tipo: 'square', vol: 0.045 });
      tom(1976 * k, t + 0.05, 0.16, { tipo: 'square', vol: 0.04 });
      tom(3952 * k, t + 0.05, 0.12, { tipo: 'sine', vol: 0.02 });
    },
    pousou: () => {
      const t = ctx.currentTime;
      tung(t, 0.5, bus.fx, 0.2);
      chiado(t, 0.1, { freq: 300, q: 0.7, vol: 0.15, tipo: 'lowpass' });
    },
    tropeco: () => {
      const t = ctx.currentTime;
      tung(t, 0.55, bus.fx, 0.45);
      falar(t + 0.03, [{ fones: ['o', 'U'], f0: 190, f0fim: 140, vol: 0.5 }]);
    },
    trombada: () => {
      const t = ctx.currentTime;
      tung(t, 0.42, bus.fx, 0.8);
      chiado(t, 0.4, { freq: 600, q: 0.5, vol: 0.5, tipo: 'lowpass' });
      for (let i = 0; i < 5; i++) chiado(t + i * 0.04, 0.07, { freq: 900 + Math.random() * 1800, q: 4, vol: 0.16 });
      falar(t + 0.05, [{ fones: ['o', 'U'], f0: 210, f0fim: 120, vol: 0.7 }]);
      // passarinhos da tontura
      for (let i = 0; i < 4; i++) tom(2400 + (i % 2) * 400, t + 0.35 + i * 0.12, 0.08, { tipo: 'sine', vol: 0.05, ate: 2900 });
    },
    escalou: () => {
      const t = ctx.currentTime;
      for (let i = 0; i < 4; i++) tung(t + i * 0.06, 0.8 + i * 0.05, bus.fx, 0.18);
      falar(t, [{ fones: ['h', 'u'], f0: 170, f0fim: 200, vol: 0.4 }]);
    },
    agua: () => {
      const t = ctx.currentTime;
      chiado(t, 0.6, { freq: 900, q: 0.6, vol: 0.45, tipo: 'lowpass', ate: 300 });
      for (let i = 0; i < 6; i++) tom(500 + Math.random() * 900, t + 0.05 + i * 0.05, 0.08, { ate: 1500, vol: 0.06 });
    },
    serra: () => {
      const t = ctx.currentTime;
      tom(1600, t, 0.7, { tipo: 'sawtooth', ate: 900, vol: 0.12 });
      tom(1650, t, 0.7, { tipo: 'sawtooth', ate: 940, vol: 0.1 });
      chiado(t, 0.8, { freq: 3000, q: 1, vol: 0.4, ate: 1200 });
      tung(t + 0.05, 0.7, bus.fx, 0.6);
      tung(t + 0.5, 0.5, bus.fx, 0.5);
    },
    fim: () => {
      const t = ctx.currentTime;
      [523, 440, 349, 262].forEach((f, i) => tom(f, t + 0.25 + i * 0.13, 0.22, { tipo: 'triangle', vol: 0.12 }));
    },
    poder: () => {
      const t = ctx.currentTime;
      [523, 659, 784, 1046, 1318].forEach((f, i) => tom(f, t + i * 0.06, 0.18, { tipo: 'triangle', vol: 0.12 }));
    },
    sahur: () => {
      // entrada da estrela: brilho subindo + a fala curta
      const t = ctx.currentTime;
      [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tom(523 * Math.pow(2, s / 12), t + i * 0.045, 0.25, { tipo: 'square', vol: 0.05 }));
      chiado(t, 0.6, { freq: 6000, q: 0.8, vol: 0.12, ataque: 0.2 });
      falaSahur(t + 0.35, 3, 1);
    },
    inicio: () => {
      falaSahur(ctx.currentTime + 0.05, 9, 1);
    },
    galo: () => {
      // co-co-ri-cooo (formantes agudos)
      const t = ctx.currentTime;
      falar(t, [
        { fones: ['k', 'o'], f0: 520, f0fim: 560 }, { fones: ['k', 'o'], f0: 600, f0fim: 640 },
        { fones: ['r', 'i'], f0: 760, f0fim: 820 }, { fones: ['k', 'o', 'U'], f0: 900, f0fim: 620, vol: 1.2 },
      ], { pausa: 0.01, timbre: 1.25, destino: bus.fx });
    },
    castor: () => {
      const t = ctx.currentTime;
      for (let i = 0; i < 6; i++) {
        tom(1300 + (i % 2) * 500, t + i * 0.07, 0.05, { tipo: 'square', vol: 0.05, ate: 1800 });
        chiado(t + i * 0.07, 0.03, { freq: 3500, q: 3, vol: 0.08 });
      }
    },
    passo: () => {
      const t = ctx.currentTime;
      if (ambiente.cenario === 'rio') tung(t, 0.9 + Math.random() * 0.1, bus.fx, 0.07);
      else chiado(t, 0.06, { freq: 380 + Math.random() * 80, q: 1.5, vol: 0.12, tipo: 'lowpass' });
    },
    botao: () => {
      const t = ctx.currentTime;
      tung(t, 1.2, bus.fx, 0.3);
    },
  };

  // ---------------------------------------------------------------------------------
  // musica: lookahead. Vila: gamelan (sinos + kendang), rio: dedilhado folk. Estrela: rapida.
  const MELODIA = {
    vila: [0, 2, 3, 2, 4, 3, 2, -1, 1, 2, 3, 5, 4, 3, 2, -1, 0, 2, 3, 2, 4, 5, 7, -1, 6, 5, 4, 3, 2, 1, 0, -1],
    rio: [2, 4, 5, 4, 2, 4, 5, 7, 5, 4, 2, 1, 0, 1, 2, -1, 2, 4, 5, 4, 7, 6, 5, 4, 2, 1, 2, 4, 2, 1, 0, -1],
    estrela: [0, 4, 7, 12, 7, 4, 0, 4, 2, 5, 9, 14, 9, 5, 2, 5, 4, 7, 11, 16, 11, 7, 4, 7, 5, 9, 12, 17, 16, 14, 12, 11],
  };
  const ESCALA = [0, 2, 4, 7, 9, 12, 14, 16];
  const BAIXO = [0, 0, 5, 7];
  function agendarMusica() {
    if (!ctx || !musica.ligada) return;
    const qual = musica.estrela ? 'estrela' : musica.cenario;
    const bpm = qual === 'estrela' ? 168 : qual === 'vila' ? 112 : 124;
    const colcheia = 60 / bpm / 2;
    while (musica.proxima < ctx.currentTime + 0.25) {
      const t = musica.proxima;
      const p = musica.passo;
      const mel = MELODIA[qual];
      const grau = mel[p % mel.length];
      const base = qual === 'vila' ? 293.66 : qual === 'rio' ? 261.63 : 392;
      const destino = bus.musica;
      if (qual === 'estrela') {
        const f = base * Math.pow(2, grau / 12);
        tom(f, t, 0.12, { tipo: 'square', vol: 0.06, destino });
        tom(f * 2, t, 0.06, { tipo: 'square', vol: 0.025, destino });
        if (p % 2 === 0) tom(base / 4 * Math.pow(2, BAIXO[(p / 8 | 0) % 4] / 12), t, 0.14, { tipo: 'triangle', vol: 0.2, destino });
        if (p % 4 === 0) tung(t, 0.75, destino, 0.4);
        if (p % 4 === 2) chiado(t, 0.08, { freq: 2500, q: 0.8, vol: 0.18, destino });
        chiado(t, 0.03, { freq: 8000, q: 1, vol: 0.05, destino });
      } else {
        if (grau >= 0) {
          const f = base * Math.pow(2, ESCALA[grau] / 12);
          if (qual === 'vila') {
            tom(f, t, 0.6, { vol: 0.15, destino });
            tom(f * 2.76, t, 0.25, { vol: 0.04, destino });
            if (p % 2 === 0) tom(f * 2, t + colcheia, 0.25, { vol: 0.035, destino });
          } else {
            tom(f, t, 0.2, { tipo: 'triangle', vol: 0.13, destino });
            tom(f * 2, t, 0.09, { tipo: 'sine', vol: 0.05, destino });
            tom(f * 1.5, t + colcheia * 0.5, 0.08, { tipo: 'triangle', vol: 0.03, destino });
          }
        }
        if (p % 4 === 0) tom(base / 2 * Math.pow(2, BAIXO[(p / 8 | 0) % 4] / 12), t, 0.4, { tipo: 'triangle', vol: 0.17, destino });
        if (qual === 'vila') {
          // kendang: tung grave e tak agudo
          if (p % 8 === 0 || p % 8 === 3 || p % 8 === 6) tung(t, 0.8, destino, 0.32);
          if (p % 4 === 2) chiado(t, 0.05, { freq: 1800, q: 2, vol: 0.12, destino });
          if (p % 16 === 15) tom(1760, t, 0.4, { vol: 0.03, destino });
        } else {
          if (p % 4 === 0) tung(t, 0.6, destino, 0.28);
          if (p % 2 === 1) chiado(t, 0.05, { freq: 7000, q: 1, vol: 0.05, destino });
          if (p % 8 === 4) chiado(t, 0.09, { freq: 2200, q: 0.7, vol: 0.12, destino });
        }
      }
      musica.passo++;
      musica.proxima += colcheia;
    }
  }

  // ---------------------------------------------------------------------------------
  // ambiente: grilos e cachorro longe (vila); correnteza e passarinhos (rio)
  function ligarAmbiente(cenario) {
    if (!ctx || !ruido) return;
    desligarAmbiente();
    ambiente.cenario = cenario;
    if (cenario === 'rio') {
      const src = ctx.createBufferSource();
      src.buffer = ruido;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 700;
      const g = ctx.createGain();
      g.gain.value = 0.35;
      src.connect(f);
      f.connect(g);
      g.connect(bus.amb);
      src.start();
      ambiente.nos.push(src);
    }
    ambiente.timer = window.setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      if (ambiente.cenario === 'vila') {
        // grilo: trinado agudo
        if (Math.random() < 0.6) for (let i = 0; i < 4; i++) tom(4400 + Math.random() * 300, t + i * 0.045, 0.03, { vol: 0.02, destino: bus.amb });
      } else if (Math.random() < 0.3) {
        // passarinho
        const f = 2200 + Math.random() * 1200;
        tom(f, t, 0.12, { ate: f * 1.4, vol: 0.025, destino: bus.amb });
        tom(f * 1.2, t + 0.15, 0.1, { ate: f, vol: 0.02, destino: bus.amb });
      }
    }, 700);
  }
  function desligarAmbiente() {
    for (const n of ambiente.nos) {
      try { /** @type {AudioScheduledSourceNode} */ (n).stop(); } catch { /* ja parou */ }
    }
    ambiente.nos = [];
    clearInterval(ambiente.timer);
  }

  return {
    /** Precisa de um gesto do jogador para comecar. */
    destravar() {
      if (!garantir() || !ctx) return;
      if (ctx.state === 'suspended' && !pausado) ctx.resume().catch(() => {});
    },
    /** @param {keyof typeof SONS} nome */
    tocar(nome) {
      if (!ctx || pausado || ctx.state !== 'running') return;
      try {
        SONS[nome]();
      } catch { /* ignora */ }
    },
    /** @param {'vila' | 'rio'} cenario @param {boolean} ligar */
    musica(cenario, ligar) {
      musica.cenario = cenario;
      if (ligar && !musica.ligada) {
        musica.ligada = true;
        if (ctx) musica.proxima = ctx.currentTime + 0.1;
        musica.timer = window.setInterval(() => {
          if (ctx && musica.proxima < ctx.currentTime) musica.proxima = ctx.currentTime + 0.05;
          agendarMusica();
        }, 80);
      } else if (!ligar && musica.ligada) {
        musica.ligada = false;
        clearInterval(musica.timer);
      }
    },
    /** Musica da estrela durante o modo Sahur. @param {boolean} on */
    estrela(on) {
      if (musica.estrela === on) return;
      musica.estrela = on;
      musica.passo = 0;
    },
    /** @param {'vila' | 'rio' | ''} cenario */
    ambiente(cenario) {
      if (!ctx) return;
      if (!cenario) desligarAmbiente();
      else if (cenario !== ambiente.cenario || !ambiente.timer) ligarAmbiente(cenario);
    },
    /** Zumbido da serra conforme a distancia (0 = longe, 1 = colada). @param {number} k */
    serraPerto(k) {
      if (!ctx) return;
      if (!serra && k > 0.01) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 1180;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 1500;
        f.Q.value = 2;
        const g = ctx.createGain();
        g.gain.value = 0;
        osc.connect(f);
        f.connect(g);
        g.connect(bus.fx);
        osc.start();
        serra = { osc, g };
      }
      if (serra) serra.g.gain.setTargetAtTime(Math.min(1, k) * 0.07, ctx.currentTime, 0.08);
    },
    /** Botao de som do jogador. @param {boolean} m */
    definirMudo(m) {
      mudo = m;
      if (bus.mestre && ctx) bus.mestre.gain.setTargetAtTime(volMestre(), ctx.currentTime, 0.02);
    },
    /** Portal (mute/unmute e anuncio). @param {boolean} c */
    calar(c) {
      calado = c;
      if (bus.mestre && ctx) bus.mestre.gain.setTargetAtTime(volMestre(), ctx.currentTime, 0.02);
    },
    get mudo() { return mudo; },
    get calado() { return mudo || calado; },
    /** @param {boolean} p */
    pausar(p) {
      pausado = p;
      if (!ctx) return;
      if (p) ctx.suspend().catch(() => {});
      else ctx.resume().catch(() => {});
    },
  };
}
