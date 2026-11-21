// Liga a logica ao render de UM cenario: trechos reciclados, obstaculos vindos de pools,
// obstaculos derrubados voando, moedas em InstancedMesh, poderes, perseguidor (meio
// transparente quando aparece) e efeitos. Tudo fica num grupo (`raiz`): trocar de mapa e so
// trocar o grupo na cena. O heroi e a camera sao do main.
//
// Convencao: o jogador fica em z = 0 do render; um ponto da pista em z logico vai para
// z_render = d - z (o mundo anda em direcao a camera, sem problema de precisao).
import * as THREE from 'three';
import { FAIXA } from '../jogo/pista.js';
import { DIST_MAX } from '../jogo/regras.js';
import { geometriaMoeda, criarPoder } from './cenarios/comum.js';
import { criarEfeitos } from './efeitos.js';

const TAM_TRECHO = 40;
const N_TRECHOS = 7;
const VISTA = 235;
const MAX_MOEDAS = 420;
/** opacidade do perseguidor quando esta na tela (da para ver o Sahur atraves dele) */
const OPACIDADE_PERSEGUIDOR = 0.38;

/**
 * @param {ReturnType<typeof import('./motor.js').criarMotor>} motor
 * @param {any} cenario
 */
export function criarMundo(motor, cenario) {
  const { camera, materiais } = motor;
  const raiz = new THREE.Group();
  raiz.name = `mundo-${cenario.nome}`;
  const nevoa = cenario.montar(raiz);
  const trechos = [];
  for (let i = 0; i < N_TRECHOS; i++) {
    const t = cenario.trecho();
    raiz.add(t);
    trechos.push(t);
  }
  /** objetos que giram (rodas d'agua, laminas) */
  const giratorios = [];
  const coletarGiratorios = (/** @type {THREE.Object3D} */ o) => o.traverse((x) => {
    if (x.userData.gira) giratorios.push(x);
  });
  trechos.forEach(coletarGiratorios);

  // perseguidor com materiais proprios (transparentes quando aparece)
  const perseguidor = cenario.perseguidor();
  /** @type {THREE.Material[]} */
  const matsPerseguidor = [];
  perseguidor.raiz.traverse((o) => {
    const m = /** @type {THREE.Mesh} */ (o);
    if (!m.isMesh) return;
    const mat = /** @type {THREE.Material} */ (m.material).clone();
    mat.transparent = true;
    mat.opacity = 1;
    m.material = mat;
    m.castShadow = true;
    matsPerseguidor.push(mat);
  });
  raiz.add(perseguidor.raiz);
  const efeitos = criarEfeitos(raiz);

  // moedas
  const moedas = new THREE.InstancedMesh(geometriaMoeda(), materiais.ouro, MAX_MOEDAS);
  moedas.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  moedas.castShadow = true;
  moedas.frustumCulled = false;
  raiz.add(moedas);

  /** @type {Map<number, { obj: THREE.Object3D, chave: string, visto: number }>} */
  const vivos = new Map();
  /** @type {Map<string, THREE.Object3D[]>} */
  const pools = new Map();
  let quadro = 0;
  /** moedas pegas voando para o jogador */
  const voando = [];
  /** obstaculos derrubados numa trombada */
  const derrubados = [];

  /** @param {any} e */
  function chaveDe(e) {
    if (e.tipo === 'poder') return `poder:${e.poder}`;
    if (e.forma === 'plataforma') return `plat:${e.id}`;
    if (e.forma === 'bloco') return `bloco:${e.variante % 3}:${Math.round(e.c * 2) / 2}`;
    return `${e.forma}:${e.variante}`;
  }

  /** @param {any} e */
  function criarObj(e) {
    if (e.tipo === 'poder') {
      const g = new THREE.Group();
      const m = criarPoder(e.poder, materiais);
      m.name = 'modelo';
      g.add(m);
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.7, 0.95, 32),
        new THREE.MeshBasicMaterial({ color: e.poder === 'ima' ? '#ff5a6a' : '#ffd25a', transparent: true, opacity: 0.6, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }),
      );
      halo.name = 'halo';
      g.add(halo);
      return g;
    }
    const M = cenario.modelos;
    if (e.forma === 'plataforma') return M.plataforma(e.c, e.rampa, e.variante);
    if (e.forma === 'bloco') return M.bloco(e.variante, e.c);
    return M[e.forma](e.variante);
  }

  function pegar(chave, e) {
    const pool = pools.get(chave);
    const obj = pool && pool.length ? pool.pop() : criarObj(e);
    if (!obj.parent) {
      raiz.add(obj);
      coletarGiratorios(obj);
    }
    obj.visible = true;
    obj.rotation.set(0, 0, 0);
    return obj;
  }

  /** @param {{ obj: THREE.Object3D, chave: string }} v */
  function devolver(v) {
    if (v.chave.startsWith('plat:')) {
      raiz.remove(v.obj);
      v.obj.traverse((x) => {
        const i = giratorios.indexOf(x);
        if (i >= 0) giratorios.splice(i, 1);
      });
      return;
    }
    v.obj.visible = false;
    if (!pools.has(v.chave)) pools.set(v.chave, []);
    /** @type {THREE.Object3D[]} */ (pools.get(v.chave)).push(v.obj);
  }

  function soltar(id) {
    const v = vivos.get(id);
    if (!v) return;
    vivos.delete(id);
    devolver(v);
  }

  /** Obstaculo derrubado: sai voando, girando, empurrado para a frente e para o lado. */
  function derrubar(e, P, forte) {
    const v = vivos.get(e.id);
    if (!v) return;
    vivos.delete(e.id);
    const lado = e.faixa === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(e.faixa);
    const k = forte ? 0.7 : 1.2;
    derrubados.push({
      v, t: 0,
      vel: new THREE.Vector3(lado * (3 + Math.random() * 3) * k, (forte ? 3 : 5.5) + Math.random() * 2, -(P.vBase * (forte ? 0.55 : 0.9))),
      giro: new THREE.Vector3((Math.random() * 6 + 4) * (forte ? 0.5 : 1), (Math.random() - 0.5) * 4, -lado * (Math.random() * 5 + 3) * (forte ? 0.5 : 1)),
    });
  }

  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3(1, 1, 1);
  const chefe = { dist: DIST_MAX, x: 0, investida: 0 };
  let tRiscos = 0;
  let tRastro = 0;

  /**
   * Sincroniza tudo com a partida e avanca as animacoes.
   * @param {import('../jogo/regras.js').Partida} P @param {number} dt
   * @param {{ modo: string, dz: number, pego: boolean }} o
   */
  function atualizar(P, dt, o) {
    quadro++;
    const d = P.d;
    const c = P.corredor;
    // trechos de cenario
    const k0 = Math.floor(d / TAM_TRECHO) - 1;
    for (let j = 0; j < N_TRECHOS; j++) {
      const k = k0 + j;
      const t = trechos[((k % N_TRECHOS) + N_TRECHOS) % N_TRECHOS];
      t.position.z = d - k * TAM_TRECHO;
    }
    for (const g of giratorios) g.rotation.x += dt * g.userData.gira;

    // entidades
    let nm = 0;
    const tempo = P.t;
    for (const e of P.pista.ents) {
      if (e.z - d > VISTA) continue;
      const fim = e.z + ('c' in e ? e.c : 0);
      if (fim < d - 25) continue;
      if (e.tipo === 'moeda') {
        if (e.pega || nm >= MAX_MOEDAS) continue;
        _p.set(e.faixa * FAIXA, e.y, d - e.z);
        _q.setFromEuler(_e.set(0, tempo * 3.2 + e.z * 0.25, 0));
        _m.compose(_p, _q, _s.set(1, 1, 1));
        moedas.setMatrixAt(nm++, _m);
        continue;
      }
      if (e.tipo === 'vao') continue;
      if (e.tipo === 'obs' && e.derrubado) {
        if (vivos.has(e.id)) derrubar(e, P, e.forma === 'bloco' || e.forma === 'movel');
        continue;
      }
      if ((e.tipo === 'obs' && e.quebrado) || (e.tipo === 'poder' && e.pega)) {
        if (vivos.has(e.id)) soltar(e.id);
        continue;
      }
      let v = vivos.get(e.id);
      if (!v) {
        const chave = chaveDe(e);
        v = { obj: pegar(chave, e), chave, visto: quadro };
        vivos.set(e.id, v);
      }
      v.visto = quadro;
      const obj = v.obj;
      obj.position.set(e.faixa * FAIXA, 0, d - e.z);
      if (e.tipo === 'poder') {
        obj.position.y = e.y + Math.sin(tempo * 3 + e.id) * 0.15;
        const mod = obj.getObjectByName('modelo');
        if (mod) mod.rotation.y = tempo * 2.2;
        const halo = obj.getObjectByName('halo');
        if (halo) {
          halo.lookAt(camera.position);
          halo.scale.setScalar(1 + Math.sin(tempo * 6) * 0.08);
        }
      } else if (e.forma === 'movel') {
        obj.traverse((x) => {
          if (x.userData.rola) x.rotation.x -= dt * (e.ativo ? e.vel : 0) / x.userData.rola;
        });
        if (cenario.nome === 'vila') obj.position.y = e.ativo ? Math.abs(Math.sin(tempo * 9 + e.id)) * 0.04 : 0;
        else obj.position.y = Math.sin(tempo * 2 + e.id) * 0.06;
      }
    }
    for (const [id, v] of vivos) if (v.visto !== quadro) soltar(id);

    // derrubados: balistica simples, somem depois de um tempo
    for (let i = derrubados.length - 1; i >= 0; i--) {
      const b = derrubados[i];
      b.t += dt;
      const obj = b.v.obj;
      b.vel.y -= 22 * dt;
      obj.position.x += b.vel.x * dt;
      obj.position.y = Math.max(-0.4, obj.position.y + b.vel.y * dt);
      obj.position.z += o.dz + b.vel.z * dt;
      if (obj.position.y <= -0.4 + 1e-3) {
        b.vel.multiplyScalar(0.6);
        b.vel.y = Math.abs(b.vel.y) * 0.3;
        b.giro.multiplyScalar(0.7);
      }
      obj.rotation.x += b.giro.x * dt;
      obj.rotation.y += b.giro.y * dt;
      obj.rotation.z += b.giro.z * dt;
      if (b.t > 1.8 || obj.position.z > 12) {
        derrubados.splice(i, 1);
        devolver(b.v);
      }
    }

    // moedas voando ate o jogador
    for (let i = voando.length - 1; i >= 0; i--) {
      const m = voando[i];
      m.t += dt;
      const u = Math.min(1, m.t / 0.22);
      if (u >= 1 || nm >= MAX_MOEDAS) {
        voando.splice(i, 1);
        continue;
      }
      _p.set(m.x + (c.x - m.x) * u, m.y + (c.y + 1.1 - m.y) * u + Math.sin(u * Math.PI) * 0.6, m.z * (1 - u));
      _q.setFromEuler(_e.set(0, tempo * 12, 0));
      _m.compose(_p, _q, _s.setScalar(1 - u * 0.7));
      moedas.setMatrixAt(nm++, _m);
    }
    moedas.count = nm;
    moedas.instanceMatrix.needsUpdate = true;

    // perseguidor: a distancia vem da logica. No render ele fica entre a camera e o Sahur,
    // num trecho comprimido (nunca colado na camera), menor e meio transparente.
    chefe.investida = o.pego ? Math.min(1, chefe.investida + dt * 3) : 0;
    const alvo = o.pego ? 0 : P.perseguidor.dist;
    chefe.dist += (alvo - chefe.dist) * Math.min(1, dt * 8);
    chefe.x += (c.x * 0.9 - chefe.x) * Math.min(1, dt * 5);
    const zChefe = o.pego ? 0.9 + (1 - chefe.investida) * 1.2 : 1.5 + chefe.dist * 0.48;
    perseguidor.raiz.position.set(chefe.x - 0.55, 0, zChefe);
    perseguidor.raiz.scale.setScalar(0.78);
    perseguidor.raiz.visible = o.modo !== 'idle' && chefe.dist < 7.5;
    perseguidor.raiz.rotation.x = -chefe.investida * 0.45;
    perseguidor.atualizar(dt, o.modo === 'correr' ? P.v : (o.pego ? 6 : 0));
    for (const m of matsPerseguidor) {
      m.opacity = OPACIDADE_PERSEGUIDOR;
      m.depthWrite = false;
    }

    // modo Sahur: rastro de estrelinhas e riscos de velocidade
    if (P.sahur > 0 && o.modo === 'correr') {
      tRastro += dt;
      while (tRastro > 0.03) {
        tRastro -= 0.03;
        efeitos.estrelinha(new THREE.Vector3(c.x + (Math.random() - 0.5) * 0.8, c.y + 0.3 + Math.random() * 1.8, 0.3));
      }
      tRiscos += dt;
      while (tRiscos > 0.025) {
        tRiscos -= 0.025;
        efeitos.risco(c.x, c.y);
      }
    }

    efeitos.atualizar(dt, o.dz);
    cenario.atualizar(dt, { camera, d, t: P.t, ents: P.pista.ents, x: c.x, y: c.y });
  }

  /** Eventos visuais. @param {string} ev @param {any} dado @param {import('../jogo/regras.js').Partida} P */
  function evento(ev, dado, P) {
    const c = P.corredor;
    if (ev === 'quebrou') {
      const e = dado;
      const pos = new THREE.Vector3(e.faixa * FAIXA, 0.3, P.d - e.z - 0.4);
      const cores = cenario.coresQuebra[e.forma] || cenario.coresQuebra.padrao;
      efeitos.quebrar(pos, cores, e.forma === 'quebravel' ? 1 : 1.3);
    } else if (ev === 'trombada') {
      derrubar(dado.e, P, dado.forte);
      efeitos.poeira(new THREE.Vector3(c.x, c.y + 0.4, -0.6), cenario.corPoeira, 10);
      const cores = cenario.coresQuebra[dado.e.forma] || cenario.coresQuebra.padrao;
      efeitos.quebrar(new THREE.Vector3(c.x, c.y + 0.5, -0.8), cores, 0.5);
    } else if (ev === 'escalou') {
      efeitos.poeira(new THREE.Vector3(c.x, c.y, -0.3), cenario.corPoeira, 8);
    } else if (ev === 'moeda') {
      voando.push({ x: dado.faixa * FAIXA, y: dado.y, z: P.d - dado.z, t: 0 });
      efeitos.brilho(new THREE.Vector3(dado.faixa * FAIXA, dado.y, P.d - dado.z));
    } else if (ev === 'pousou') {
      if (dado) efeitos.poeira(new THREE.Vector3(c.x, c.y, 0), cenario.corPoeira);
    } else if (ev === 'pulo') {
      efeitos.poeira(new THREE.Vector3(c.x, c.y, 0), cenario.corPoeira, 5);
    } else if (ev === 'tropeco') {
      efeitos.poeira(new THREE.Vector3(c.x, c.y + 0.6, -0.4), '#ffffff', 6);
    } else if (ev === 'agua') {
      efeitos.respingo(new THREE.Vector3(c.x, -0.2, 0));
    } else if (ev === 'fim') {
      if (dado.motivo === 'serra') efeitos.serragem(new THREE.Vector3(c.x, 1.3, -0.3));
      else if (dado.motivo === 'caiu') efeitos.respingo(new THREE.Vector3(c.x, -0.2, 0));
      else efeitos.poeira(new THREE.Vector3(c.x, c.y + 0.6, -0.5), '#f4ead2', 8);
    } else if (ev === 'poder') {
      if (dado === 'sahur') efeitos.explosaoEstrela(new THREE.Vector3(c.x, c.y + 1.2, 0));
      else efeitos.brilho(new THREE.Vector3(c.x, c.y + 1.2, -0.5), '#ff6a7a', 18);
    }
  }

  function reiniciar() {
    for (const id of [...vivos.keys()]) soltar(id);
    for (const b of derrubados) devolver(b.v);
    derrubados.length = 0;
    voando.length = 0;
    efeitos.limpar();
    chefe.dist = DIST_MAX;
    chefe.investida = 0;
  }

  return { raiz, nevoa, atualizar, evento, reiniciar, perseguidor, efeitos, cenario };
}
