// O Tung Tung Sahur procedural (P1, fiel ao meme): tronco de madeira com rosto, bracos e pernas
// finos e o taco. O corpo e feito de DUAS METADES (esquerda e direita), coladas: a serra do rio
// separa as duas. Animacoes por codigo: corrida, curva, pulo, rolar como tronco, tacada,
// trombada (tonto), escalada, corte, caido e o brilho de estrela do modo Sahur.
//
// O personagem olha para -z (para longe da camera). Direita dele = +x.
import * as THREE from 'three';
import { materiaisPersonagem } from './estilo-brinquedo.js';

export const P = {
  coxa: 0.34, canela: 0.32, corpo: 1.3, raio: 0.27, raioTopo: 0.255, braco: 0.38, antebraco: 0.36,
  membro: 0.058, mao: 0.085, pe: [0.16, 0.1, 0.28], olho: 0.088, pupila: 0.031, olhoY: 0.76, olhoX: 0.105,
  sobrancelha: [0.13, 0.038], boca: [0.055, 0.03], taco: 1.0, raioTaco: 0.06, ombroY: 0.56,
};

/** @param {number} a @param {number} b @param {number} k */
const aprox = (a, b, k) => a + (b - a) * Math.min(1, Math.max(0, k));
const suave = (/** @type {number} */ t) => t * t * (3 - 2 * t);
const _cor = new THREE.Color();

/**
 * @param {ReturnType<typeof import('./estilo-brinquedo.js').criarMateriais>['texturas']} tx
 */
export function criarPersonagem(tx) {
  const M = materiaisPersonagem(tx);
  const brilhaveis = [M.corpo, M.topo, M.membro, M.taco];
  const coresOriginais = brilhaveis.map((m) => m.color.clone());
  const sombra = (/** @type {THREE.Mesh} */ m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const quadrilY = P.coxa + P.canela + P.pe[1] * 0.5;
  const H = P.corpo;
  const r = P.raio;
  const rt = P.raioTopo;

  const raiz = new THREE.Group();
  raiz.name = 'tungtung';
  // pivo no centro do corpo: inclina, gira (rolar) e balanca
  const pivo = new THREE.Group();
  pivo.rotation.order = 'XYZ';
  raiz.add(pivo);
  const corpo = new THREE.Group();
  pivo.add(corpo);

  // ------------------------------------------------------------------------------------
  // tronco em duas metades (torno de meia volta): direita = phi 0..PI (x >= 0), esquerda = PI..2PI
  const perfil = [
    [0, 0], [r * 0.7, 0], [r * 0.93, 0.02], [r, 0.08], [r * 1.01, H * 0.3], [(r + rt) / 2, H * 0.6], [rt, H - 0.05], [rt * 0.97, H - 0.012], [rt * 0.9, H],
  ].map(([x, y]) => new THREE.Vector2(x, y - H / 2));
  /** @type {Record<string, THREE.Group>} */
  const metade = {};
  for (const lado of [-1, 1]) {
    const g = new THREE.Group();
    g.name = lado < 0 ? 'metadeE' : 'metadeD';
    corpo.add(g);
    metade[lado] = g;
    const phi0 = lado > 0 ? 0 : Math.PI;
    const geo = new THREE.LatheGeometry(perfil, 22, phi0, Math.PI);
    // a textura da a volta inteira no tronco: cada metade usa metade do u
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (lado > 0 ? 0 : 0.5) + uv.getX(i) * 0.5);
    g.add(sombra(new THREE.Mesh(geo, M.corpo)));
    // meia tampa com os aneis no topo
    const tampa = sombra(new THREE.Mesh(new THREE.CircleGeometry(rt * 0.92, 20, lado > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI), M.topo));
    tampa.rotation.x = -Math.PI / 2;
    tampa.position.y = H / 2 - 0.004;
    g.add(tampa);
    // face do corte (so aparece quando a serra separa as metades): o contorno do tronco
    const forma = new THREE.Shape();
    perfil.forEach((p, i) => (i === 0 ? forma.moveTo(p.x * 0.99, p.y) : forma.lineTo(p.x * 0.99, p.y)));
    for (let i = perfil.length - 1; i >= 0; i--) forma.lineTo(-perfil[i].x * 0.99, perfil[i].y);
    const miolo = new THREE.Mesh(new THREE.ShapeGeometry(forma), M.miolo);
    miolo.rotation.y = lado > 0 ? -Math.PI / 2 : Math.PI / 2;
    miolo.position.x = lado * 0.002;
    g.add(miolo);
  }

  // rosto (na frente, -z): cada parte vai para a metade do lado dela
  const yRosto = -H / 2 + H * P.olhoY;
  const zFrente = (/** @type {number} */ y) => {
    const t = (y + H / 2) / H;
    return -(r + (rt - r) * Math.max(0, (t - 0.3) / 0.7));
  };
  const rosto = { [-1]: new THREE.Group(), [1]: new THREE.Group() };
  for (const lado of [-1, 1]) {
    rosto[lado].position.y = yRosto;
    metade[lado].add(rosto[lado]);
  }
  const olhos = [];
  const pupilas = [];
  for (const lado of [-1, 1]) {
    const olho = new THREE.Mesh(new THREE.SphereGeometry(P.olho, 24, 16), M.olho);
    olho.scale.set(1, 1.12, 0.55);
    olho.position.set(lado * P.olhoX, 0, zFrente(yRosto) + P.olho * 0.22);
    rosto[lado].add(olho);
    olhos.push(olho);
    const pupila = new THREE.Mesh(new THREE.SphereGeometry(P.pupila, 16, 12), M.pupila);
    pupila.position.set(lado * P.olhoX - lado * P.olho * 0.12, P.olho * 0.08, olho.position.z - P.olho * 0.52);
    pupila.scale.set(1, 1, 0.5);
    rosto[lado].add(pupila);
    pupilas.push(pupila);
    const brilho = new THREE.Mesh(new THREE.SphereGeometry(P.pupila * 0.32, 8, 6), M.olho);
    brilho.position.set(pupila.position.x + P.pupila * 0.35, pupila.position.y + P.pupila * 0.35, pupila.position.z - P.pupila * 0.4);
    rosto[lado].add(brilho);
    pupilas.push(brilho);
    // sobrancelha grossa, arqueada para o centro (cara intensa)
    const s = new THREE.Mesh(new THREE.CapsuleGeometry(P.sobrancelha[1] * 0.5, P.sobrancelha[0], 4, 10), M.escuro);
    s.rotation.z = Math.PI / 2 + lado * 0.32;
    s.position.set(lado * P.olhoX * 1.02, P.olho * 1.45, zFrente(yRosto + P.olho) + 0.01);
    s.scale.z = 0.6;
    rosto[lado].add(s);
  }
  const yBoca = -P.olho * 2.0;
  const boca = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), M.boca);
  boca.scale.set(P.boca[0], P.boca[1], 0.03);
  boca.position.set(0, yBoca, zFrente(yRosto + yBoca) + 0.012);
  rosto[-1].add(boca);
  const lingua = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), M.lingua);
  lingua.scale.set(P.boca[0] * 0.6, P.boca[1] * 0.45, 0.02);
  lingua.position.set(0, yBoca - P.boca[1] * 0.42, boca.position.z - 0.006);
  rosto[-1].add(lingua);
  const nariz = new THREE.Mesh(new THREE.SphereGeometry(P.olho * 0.42, 14, 10), M.membro);
  nariz.scale.set(0.8, 1.1, 0.7);
  nariz.position.set(0, -P.olho * 0.75, zFrente(yRosto) - 0.005);
  rosto[1].add(nariz);

  // ------------------------------------------------------------------------------------
  // membros: capsulas em grupos (ombro > cotovelo > mao; quadril > joelho > pe)
  const capsula = (/** @type {number} */ comp, raio = P.membro) => {
    const g = new THREE.CapsuleGeometry(raio, comp, 4, 10);
    g.translate(0, -comp / 2, 0);
    return sombra(new THREE.Mesh(g, M.membro));
  };
  /** @param {number} lado -1 esquerda, 1 direita */
  const criarBraco = (lado) => {
    const ombro = new THREE.Group();
    ombro.rotation.order = 'YXZ';
    ombro.position.set(lado * (r * 0.97), -H / 2 + H * P.ombroY, 0);
    ombro.add(new THREE.Mesh(new THREE.SphereGeometry(P.membro * 1.45, 12, 8), M.membro));
    ombro.add(capsula(P.braco));
    const cotovelo = new THREE.Group();
    cotovelo.position.y = -P.braco;
    ombro.add(cotovelo);
    cotovelo.add(capsula(P.antebraco, P.membro * 0.95));
    const mao = new THREE.Group();
    mao.position.y = -P.antebraco;
    cotovelo.add(mao);
    const punho = sombra(new THREE.Mesh(new THREE.SphereGeometry(P.mao, 14, 10), M.membro));
    punho.scale.set(1, 1.1, 1);
    mao.add(punho);
    metade[lado].add(ombro);
    return { ombro, cotovelo, mao };
  };
  const criarPerna = (/** @type {number} */ lado) => {
    const quadril = new THREE.Group();
    quadril.position.set(lado * r * 0.45, -H / 2 + 0.04, 0);
    quadril.add(capsula(P.coxa, P.membro * 1.08));
    const joelho = new THREE.Group();
    joelho.position.y = -P.coxa;
    quadril.add(joelho);
    joelho.add(capsula(P.canela));
    const pe = new THREE.Group();
    pe.position.y = -P.canela;
    joelho.add(pe);
    const sapato = sombra(new THREE.Mesh(new THREE.CapsuleGeometry(P.pe[1] * 0.5, P.pe[2] - P.pe[1], 4, 10), M.membro));
    sapato.rotation.x = Math.PI / 2;
    sapato.scale.set(P.pe[0] / P.pe[1], 1, 1);
    sapato.position.set(0, -P.pe[1] * 0.25, -P.pe[2] * 0.22);
    pe.add(sapato);
    pivo.add(quadril);
    return { quadril, joelho, pe };
  };
  const bE = criarBraco(-1);
  const bD = criarBraco(1);
  const pE = criarPerna(-1);
  const pD = criarPerna(1);
  const membros = [bE.ombro, bD.ombro, pE.quadril, pD.quadril];

  // taco de beisebol na mao direita (eixo +y no proprio grupo)
  const taco = new THREE.Group();
  const L = P.taco;
  const rT = P.raioTaco;
  const perfilTaco = [[0, -0.03], [rT * 0.62, -0.03], [rT * 0.66, -0.005], [rT * 0.4, 0.01], [rT * 0.38, L * 0.35], [rT * 0.62, L * 0.6], [rT * 0.92, L * 0.85], [rT, L * 0.97], [rT * 0.75, L], [0, L]];
  taco.add(sombra(new THREE.Mesh(new THREE.LatheGeometry(perfilTaco.map(([x, y]) => new THREE.Vector2(x, y)), 18), M.taco)));
  const fita = new THREE.Mesh(new THREE.CylinderGeometry(rT * 0.44, rT * 0.44, L * 0.18, 12), M.escuro);
  fita.position.y = L * 0.12;
  taco.add(fita);
  taco.position.set(0, -P.mao * 0.2, 0);
  bD.mao.add(taco);
  // rastro da tacada
  const alcanceTaco = P.braco + P.antebraco + L;
  const rastro = new THREE.Mesh(
    new THREE.RingGeometry(alcanceTaco * 0.62, alcanceTaco * 1.02, 32, 1, 0, 2.0),
    new THREE.MeshBasicMaterial({ color: '#ffe3a0', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  );
  rastro.position.set(r * 0.97, -H / 2 + H * P.ombroY, 0);
  rastro.visible = false;
  pivo.add(rastro);

  // estrelinhas de tontura (trombada forte)
  const tontura = new THREE.Group();
  const matEstrela = new THREE.MeshBasicMaterial({ color: '#ffe14a', toneMapped: false });
  for (let i = 0; i < 4; i++) {
    const e = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), matEstrela);
    e.scale.set(1, 1, 0.4);
    tontura.add(e);
  }
  tontura.position.y = H / 2 + 0.22;
  tontura.visible = false;
  corpo.add(tontura);

  // luz da estrela (sempre na cena, intensidade 0 fora do modo Sahur: nao recompila shaders)
  const luzEstrela = new THREE.PointLight('#ffffff', 0, 7, 1.6);
  luzEstrela.position.set(0, 1.2, -0.6);
  raiz.add(luzEstrela);

  // sombra de contato
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.1),
    new THREE.MeshBasicMaterial({ map: tx.sombra, transparent: true, depthWrite: false, toneMapped: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.renderOrder = 1;

  // ------------------------------------------------------------------------------------
  // animacao
  const A = {
    fase: 0, rol: 0, giroRolar: 0, ar: 0, squash: 1, vSquash: 0, tacada: -1, tropeco: 99, trombada: 99,
    forte: false, escala: 99, piscar: 2, olharX: 0, olharY: 0, cair: 0, corte: -1, tempo: 0, batuque: 0,
    agacha: 0, banco: 0, guinada: 0, estrela: -1, giroEstrela: 0,
  };
  const centroY = quadrilY + H / 2;

  /** Posiciona uma metade girando em volta da borda de baixo (cai para fora). */
  function abrirMetade(lado, ang, sep, queda) {
    const g = metade[lado];
    const px = lado * r;
    const py = -H / 2;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    // posicao = p + offset - R*p
    g.rotation.set(0, 0, ang);
    g.position.set(px + lado * sep - (c * px - s * py), py - queda - (s * px + c * py), 0);
  }

  /**
   * @param {number} dt
   * @param {{ modo: 'correr' | 'idle' | 'vitrine' | 'pego' | 'caido' | 'cortado', v?: number, noChao?: boolean, vy?: number,
   *   rolando?: boolean, tacada?: number, altura?: number, chao?: number, sahur?: number, vx?: number, rampa?: boolean }} e
   */
  function atualizar(dt, e) {
    dt = Math.max(0, dt); // o primeiro quadro do rAF pode vir com tempo negativo
    A.tempo += dt;
    const v = e.v || 0;
    const correndo = e.modo === 'correr';
    if (correndo) A.fase += dt * Math.PI * 2 * (1.6 + v * 0.065);
    A.rol = aprox(A.rol, e.rolando ? 1 : 0, dt * 16);
    const noArAgora = correndo && !e.noChao;
    A.ar = aprox(A.ar, noArAgora ? 1 : 0, dt * 12);
    // mola do squash
    A.vSquash += (-(A.squash - 1) * 300 - A.vSquash * 18) * dt;
    A.squash += A.vSquash * dt;
    if (noArAgora && (e.vy || 0) > 2) A.squash = aprox(A.squash, 1.12, dt * 10);
    A.agacha = Math.max(0, A.agacha - dt * 5);
    A.tacada = e.tacada ?? -1;
    A.tropeco += dt;
    A.trombada += dt;
    A.escala += dt;
    A.cair = aprox(A.cair, e.modo === 'caido' || e.modo === 'pego' ? 1 : 0, dt * 6);
    // curva: inclina para o lado da troca de faixa
    const vx = e.vx || 0;
    A.banco = aprox(A.banco, Math.max(-0.4, Math.min(0.4, -vx * 0.03)), dt * 14);
    A.guinada = aprox(A.guinada, Math.max(-0.3, Math.min(0.3, -vx * 0.018)), dt * 12);

    const s = Math.sin(A.fase);
    const cO = Math.cos(A.fase);
    // --- pernas: coxa vai e volta; joelho dobra forte quando a perna volta para a frente
    let qE = 0, qD = 0, jE = -0.15, jD = -0.15;
    if (correndo) {
      qE = s * 1.0;
      qD = -s * 1.0;
      jE = -0.2 - Math.pow(Math.max(0, cO), 1.2) * 1.7;
      jD = -0.2 - Math.pow(Math.max(0, -cO), 1.2) * 1.7;
    }
    // no ar: sobe encolhido, desce esticando para pousar
    const descendo = (e.vy || 0) < 0;
    qE = aprox(qE, descendo ? 0.45 : 1.15, A.ar);
    qD = aprox(qD, descendo ? -0.1 : -0.4, A.ar);
    jE = aprox(jE, descendo ? -0.7 : -1.75, A.ar);
    jD = aprox(jD, descendo ? -0.3 : -0.6, A.ar);
    // agachada do pouso
    qE += A.agacha * 0.5;
    qD += A.agacha * 0.5;
    jE -= A.agacha * 0.9;
    jD -= A.agacha * 0.9;
    pE.quadril.rotation.set(qE, 0, 0);
    pD.quadril.rotation.set(qD, 0, 0);
    pE.joelho.rotation.x = jE;
    pD.joelho.rotation.x = jD;
    pE.pe.rotation.x = -jE * 0.45 - qE * 0.35;
    pD.pe.rotation.x = -jD * 0.45 - qD * 0.35;

    // --- bracos: bombeando na corrida (cotovelo dobrado), o direito leva o taco
    let oE = 0, oD = 0, cE = 0.4, cD = 1.2, zE = -0.12, zD = 0.12, yD = 0, maoD = 0;
    if (correndo) {
      oE = -s * 0.95;
      oD = s * 0.5 + 0.3;
      cE = 1.25 + Math.max(0, -s) * 0.45;
      cD = 1.35 + Math.max(0, s) * 0.2;
      zE = -0.18;
      zD = 0.16;
    } else if (e.modo === 'idle' || e.modo === 'vitrine') {
      // batuca o taco no ombro: tung tung tung
      A.batuque += dt;
      const b = Math.max(0, Math.sin(A.batuque * Math.PI * 3.2));
      oD = 0.35 + b * 0.25;
      cD = 1.9 - b * 0.35;
      oE = 0.05;
      cE = 0.25;
      zD = 0.2;
    }
    oE = aprox(oE, 0.3, A.ar);
    zE = aprox(zE, -2.1, A.ar);
    zD = aprox(zD, 1.4, A.ar);
    // trombada: bracos se debatendo
    if (A.trombada < 0.6) {
      const k = 1 - A.trombada / 0.6;
      oE += Math.sin(A.tempo * 40) * 0.9 * k;
      oD += Math.cos(A.tempo * 37) * 0.6 * k;
      zE -= 0.9 * k;
      zD += 0.6 * k;
    }
    // escalada: bracos para cima, pernas chutando
    if (A.escala < 0.45) {
      const k = 1 - A.escala / 0.45;
      oE = aprox(oE, 2.6 + Math.sin(A.tempo * 30) * 0.4, k);
      oD = aprox(oD, 2.4, k);
      pE.quadril.rotation.x += Math.sin(A.tempo * 30) * 0.8 * k;
      pD.quadril.rotation.x -= Math.sin(A.tempo * 30) * 0.8 * k;
    }
    // tacada: preparo (0-0.06), golpe (0.06-0.2), acompanhamento
    let giroTacada = 0;
    let tacoGolpe = 0;
    if (A.tacada >= 0) {
      const t = A.tacada;
      const prep = suave(Math.min(1, t / 0.06));
      const golpe = suave(Math.max(0, Math.min(1, (t - 0.06) / 0.14)));
      const volta = suave(Math.max(0, Math.min(1, (t - 0.22) / 0.12)));
      const angulo = -1.9 * prep + 3.6 * golpe;
      yD = angulo * (1 - volta);
      oD = aprox(oD, 1.45, prep * (1 - volta));
      cD = aprox(cD, 0.15, prep * (1 - volta));
      zD = aprox(zD, 0.1, prep * (1 - volta));
      maoD = -1.45 * prep * (1 - volta);
      giroTacada = (-0.5 * prep + 1.0 * golpe) * (1 - volta);
      rastro.visible = golpe > 0.05 && volta < 0.9;
      /** @type {THREE.MeshBasicMaterial} */ (rastro.material).opacity = 0.8 * Math.sin(Math.min(1, golpe * 1.3) * Math.PI * 0.5 + golpe * Math.PI * 0.5) * (1 - volta);
      rastro.rotation.set(-Math.PI / 2, 0, yD + Math.PI / 2 - 2.0);
      tacoGolpe = prep * (1 - volta);
    } else rastro.visible = false;
    // estrela: bracos para cima na entrada
    if (A.estrela >= 0 && A.estrela < 0.7) {
      const k = Math.sin((A.estrela / 0.7) * Math.PI);
      zE = aprox(zE, -2.6, k);
      zD = aprox(zD, 2.6, k);
    }
    bE.ombro.rotation.set(oE, 0, zE);
    bD.ombro.rotation.set(oD, yD, zD);
    bE.cotovelo.rotation.x = cE;
    bD.cotovelo.rotation.x = cD;
    bD.mao.rotation.x = maoD;
    taco.rotation.set(aprox(-0.95, -1.5, tacoGolpe), 0, aprox(-0.2, 0, tacoGolpe));

    // --- corpo
    const quique = correndo ? Math.abs(s) * 0.09 * (1 - A.ar) - A.agacha * 0.12 : 0;
    let inclina = correndo ? -0.13 - Math.min(0.12, Math.max(0, v - 11) * 0.007) - (e.rampa ? 0.12 : 0) : 0;
    if (e.modo === 'vitrine' || e.modo === 'idle') inclina = Math.sin(A.tempo * 1.7) * 0.03;
    // trombada: joga o corpo para tras
    if (A.trombada < 0.5) inclina += Math.sin((A.trombada / 0.5) * Math.PI) * (A.forte ? 0.7 : 0.4);
    let ladoTrop = 0;
    if (A.tropeco < 0.5) ladoTrop = Math.sin(A.tropeco * 30) * (1 - A.tropeco / 0.5) * 0.35;
    // rolar como tronco: deita (eixo em x) e gira
    if (A.rol > 0.01) A.giroRolar -= dt * (Math.max(v, 8) / (r + 0.02));
    else A.giroRolar = 0;
    const yNormal = centroY + quique;
    const yDeitado = r + 0.02;
    pivo.position.y = aprox(yNormal, yDeitado, A.rol);
    // estrela: giro de entrada
    if (A.estrela >= 0 && A.estrela < 0.7) A.giroEstrela = suave(A.estrela / 0.7) * Math.PI * 4;
    else A.giroEstrela = 0;
    pivo.rotation.set(
      aprox(inclina, A.giroRolar, A.rol) - A.cair * 1.35,
      (correndo ? s * 0.12 : 0) + giroTacada + A.guinada + A.giroEstrela,
      aprox(ladoTrop + A.banco + (correndo ? cO * 0.05 : 0), Math.PI / 2, A.rol),
    );
    const escMembro = Math.max(0.001, 1 - A.rol * 1.15);
    for (const m of membros) m.scale.setScalar(escMembro);
    taco.visible = A.rol < 0.6;
    const sq = Math.max(0.6, Math.min(1.4, A.squash));
    corpo.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));

    // --- corte da serra: as metades caem para os lados, as pernas cedem
    if (A.corte >= 0) {
      A.corte += dt;
      const u = Math.min(1, A.corte / 1.1);
      const ang = (Math.PI / 2 - 0.12) * u * u;
      abrirMetade(-1, ang, 0.04 + u * 0.18, 0);
      abrirMetade(1, -ang, 0.04 + u * 0.18, 0);
      const k = Math.min(1, A.corte / 0.5);
      pivo.position.y = aprox(centroY, H / 2 + 0.05, k);
      pivo.rotation.set(0, 0, 0);
      pE.quadril.rotation.set(1.4 * k, 0, -0.5 * k);
      pD.quadril.rotation.set(1.4 * k, 0, 0.5 * k);
      pE.joelho.rotation.x = -2.4 * k;
      pD.joelho.rotation.x = -2.4 * k;
      corpo.scale.set(1, 1, 1);
    } else {
      for (const lado of [-1, 1]) {
        metade[lado].position.set(0, 0, 0);
        metade[lado].rotation.set(0, 0, 0);
      }
    }

    // --- modo Sahur: estrela (arco-iris piscando) e um pouco maior
    const sahur = e.sahur || 0;
    if (sahur > 0) {
      if (A.estrela < 0) A.estrela = 0;
      A.estrela += dt;
      // no fim pisca mais devagar, avisando que vai acabar
      const vel = sahur < 1.5 ? 6 : 14;
      const hue = (A.tempo * vel * 0.12) % 1;
      const pulso = sahur < 1.5 ? (Math.sin(A.tempo * 18) > 0 ? 1 : 0.15) : 1;
      // tinge a madeira com a cor do arco-iris (forte) e acende um brilho da mesma cor
      _cor.setHSL(hue, 1, 0.6);
      brilhaveis.forEach((m, i) => {
        m.color.copy(coresOriginais[i]).lerp(_cor, 0.75 * pulso);
        m.emissive.setHSL(hue, 1, 0.45);
        m.emissiveIntensity = 0.3 * pulso;
      });
      luzEstrela.color.copy(_cor);
      luzEstrela.intensity = 4 * pulso;
    } else if (A.estrela >= 0) {
      A.estrela = -1;
      brilhaveis.forEach((m, i) => {
        m.color.copy(coresOriginais[i]);
        m.emissive.setRGB(0, 0, 0);
        m.emissiveIntensity = 0;
      });
      luzEstrela.intensity = 0;
    }
    const esc = sahur > 0 ? 1.15 : 1;
    raiz.scale.setScalar(aprox(raiz.scale.x, esc, dt * 6));

    // tontura
    tontura.visible = A.trombada < 1.2 && A.forte;
    if (tontura.visible) {
      tontura.children.forEach((estrela, i) => {
        const a = A.tempo * 7 + (i / tontura.children.length) * Math.PI * 2;
        estrela.position.set(Math.cos(a) * 0.32, Math.sin(a * 2) * 0.05, Math.sin(a) * 0.32);
        estrela.rotation.y = a * 2;
      });
    }

    // olhos: piscar e olhar
    A.piscar -= dt;
    let abre = 1;
    if (A.piscar < 0.12) abre = Math.abs(A.piscar - 0.06) / 0.06;
    if (A.piscar < 0) A.piscar = 2 + (Math.sin(A.tempo * 12.9898) * 0.5 + 0.5) * 3;
    if (A.cair > 0.5 || A.corte >= 0 || A.trombada < 0.6) abre = 1.25;
    for (const o of olhos) o.scale.y = 1.12 * Math.max(0.08, abre);
    if (e.modo === 'vitrine') {
      A.olharX = Math.sin(A.tempo * 0.7) * 0.6;
      A.olharY = Math.sin(A.tempo * 0.43) * 0.3;
    }
    for (const p of pupilas) {
      p.visible = abre > 0.4;
      p.userData.base ??= p.position.clone();
      p.position.x = p.userData.base.x + A.olharX * P.olho * 0.25;
      p.position.y = p.userData.base.y + A.olharY * P.olho * 0.25;
    }

    // sombra de contato: encolhe com a altura
    const alt = Math.max(0, (e.altura || 0) - (e.chao || 0));
    const k2 = Math.max(0.35, 1 - alt * 0.25);
    blob.scale.setScalar(k2 * (A.rol > 0.5 || A.corte >= 0 ? 1.4 : 1));
    /** @type {THREE.MeshBasicMaterial} */ (blob.material).opacity = k2;
  }

  /** @param {string} ev @param {any} [dado] */
  function disparar(ev, dado) {
    if (ev === 'pulo') {
      A.squash = 0.72;
      A.vSquash = 0;
    } else if (ev === 'pousou') {
      A.squash = 0.7;
      A.vSquash = 0;
      A.agacha = dado ? 1 : 0.5;
    } else if (ev === 'tropeco') {
      A.tropeco = 0;
    } else if (ev === 'trombada') {
      A.trombada = 0;
      A.forte = !!dado;
      A.squash = 0.75;
    } else if (ev === 'escalou') {
      A.escala = 0;
    } else if (ev === 'cortar') {
      A.corte = 0;
    } else if (ev === 'reiniciar') {
      A.cair = 0;
      A.rol = 0;
      A.tropeco = 99;
      A.trombada = 99;
      A.escala = 99;
      A.corte = -1;
    }
  }

  return { raiz, blob, atualizar, disparar, P, altura: quadrilY + H };
}
