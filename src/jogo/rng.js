// Gerador pseudoaleatorio com semente (mulberry32). Toda a logica usa este, nunca Math.random,
// para que a mesma semente gere a mesma pista (testes, prints e autopiloto).

/**
 * @param {number} semente
 */
export function criarRng(semente) {
  let s = (semente >>> 0) || 1;
  const proximo = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    proximo,
    /** inteiro em [a, b] */
    inteiro: (/** @type {number} */ a, /** @type {number} */ b) => a + Math.floor(proximo() * (b - a + 1)),
    /** real em [a, b) */
    real: (/** @type {number} */ a, /** @type {number} */ b) => a + proximo() * (b - a),
    /** @template T @param {T[]} lista @returns {T} */
    escolher: (lista) => lista[Math.floor(proximo() * lista.length)],
    chance: (/** @type {number} */ p) => proximo() < p,
    /** escolhe pela tabela de pesos { chave: peso } */
    sortear: (/** @type {Record<string, number>} */ pesos) => {
      const chaves = Object.keys(pesos);
      let total = 0;
      for (const k of chaves) total += pesos[k];
      let r = proximo() * total;
      for (const k of chaves) {
        r -= pesos[k];
        if (r < 0) return k;
      }
      return chaves[chaves.length - 1];
    },
  };
}
