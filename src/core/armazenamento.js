// Unico modulo que toca o localStorage. Toda chave tem o prefixo do jogo (a origem dos jogos
// no portal e compartilhada) e todo acesso fica num try/catch (modo privado, bloqueio).
const PREFIXO = 'rrs:';

/** @param {string} chave @param {any} padrao */
export function ler(chave, padrao) {
  try {
    const v = localStorage.getItem(PREFIXO + chave);
    return v === null ? padrao : JSON.parse(v);
  } catch {
    return padrao;
  }
}

/** @param {string} chave @param {any} valor */
export function gravar(chave, valor) {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
  } catch { /* ignora */ }
}
