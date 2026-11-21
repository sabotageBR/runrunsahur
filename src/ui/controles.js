// Entrada: teclado (setas/WASD, espaco = tacada) e toque/mouse (deslizar para os lados,
// para cima e para baixo; toque curto = tacada). O swipe vale assim que passa do limite,
// sem esperar soltar o dedo.

/** @param {HTMLElement} alvo @param {() => void} [aoGesto] */
export function criarControles(alvo, aoGesto = () => {}) {
  /** @type {import('../jogo/corredor.js').Comando} */
  let fila = {};
  let ativo = true;
  const tecla = (/** @type {KeyboardEvent} */ e) => {
    if (!ativo) return;
    const k = e.key.toLowerCase();
    let ok = true;
    if (k === 'arrowleft' || k === 'a') fila.esquerda = true;
    else if (k === 'arrowright' || k === 'd') fila.direita = true;
    else if (k === 'arrowup' || k === 'w') fila.pular = true;
    else if (k === 'arrowdown' || k === 's') fila.rolar = true;
    else if (k === ' ' || k === 'x' || k === 'enter') fila.tacada = true;
    else ok = false;
    if (ok) {
      e.preventDefault();
      aoGesto();
    }
  };
  window.addEventListener('keydown', tecla);

  let toque = null;
  const limite = () => Math.max(24, Math.min(window.innerWidth, window.innerHeight) * 0.05);
  alvo.addEventListener('pointerdown', (e) => {
    if (!ativo) return;
    toque = { x: e.clientX, y: e.clientY, t: performance.now(), usado: false, id: e.pointerId };
    aoGesto();
  });
  alvo.addEventListener('pointermove', (e) => {
    if (!toque || toque.usado || e.pointerId !== toque.id) return;
    const dx = e.clientX - toque.x;
    const dy = e.clientY - toque.y;
    if (Math.hypot(dx, dy) < limite()) return;
    toque.usado = true;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) fila.esquerda = true;
      else fila.direita = true;
    } else if (dy < 0) fila.pular = true;
    else fila.rolar = true;
  });
  const soltar = (/** @type {PointerEvent} */ e) => {
    if (!toque || e.pointerId !== toque.id) return;
    if (!toque.usado && performance.now() - toque.t < 350) fila.tacada = true;
    toque = null;
  };
  alvo.addEventListener('pointerup', soltar);
  alvo.addEventListener('pointercancel', () => { toque = null; });

  return {
    /** Comandos acumulados desde o ultimo quadro. */
    consumir() {
      const c = fila;
      fila = {};
      return c;
    },
    /** @param {boolean} a */
    ligar(a) {
      ativo = a;
      fila = {};
      toque = null;
    },
  };
}
