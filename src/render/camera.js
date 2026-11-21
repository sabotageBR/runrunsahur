// Camera: atras e acima do Sahur, seguindo a faixa com atraso, mais aberta no celular em pe,
// com tremor nas trombadas e um leve aumento do FOV com a velocidade. Na tela de inicio fica de
// frente para ele e gira ate as costas quando a corrida comeca.
import * as THREE from 'three';

/** @param {THREE.PerspectiveCamera} camera */
export function criarCamera(camera) {
  const c = { x: 0, y: 0, alvoY: 0, tremor: 0, fovExtra: 0 };
  const _v = new THREE.Vector3();
  const _olhar = new THREE.Vector3();

  /**
   * @param {import('../jogo/regras.js').Partida} P @param {number} dt
   * @param {number} intro 1 = de frente (inicio), 0 = atras (jogo)
   */
  function atualizar(P, dt, intro) {
    const r = P.corredor;
    const retrato = Math.max(0, Math.min(1, (1.25 - camera.aspect) / 0.75));
    const velExtra = Math.max(0, (P.v - 11) / 14);
    c.fovExtra += ((P.sahur > 0 ? 7 : 0) + velExtra * 5 - c.fovExtra) * Math.min(1, dt * 3);
    const fov = 56 + retrato * 14 + c.fovExtra;
    const atras = 6.0 + retrato * 1.2;
    const cima = 3.3 + retrato * 0.7;
    c.x += (r.x * (0.75 + retrato * 0.17) - c.x) * Math.min(1, dt * 7);
    const yAlvo = r.noChao || r.y > 2 ? Math.max(0, r.y) : c.alvoY;
    c.alvoY = yAlvo;
    c.y += (Math.min(yAlvo, 3) - c.y) * Math.min(1, dt * 4);
    c.tremor = Math.max(0, c.tremor - dt * 2.5);
    const tx = (Math.random() - 0.5) * c.tremor * 0.3;
    const ty = (Math.random() - 0.5) * c.tremor * 0.3;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.position.set(c.x + tx, c.y + cima + ty, atras);
    _olhar.set(c.x * 0.85, c.y + 1.05 + retrato * 0.25, -7 - retrato * 1.5);
    if (intro > 0.002) {
      // de frente para o Sahur, girando para as costas
      const k = intro * intro * (3 - 2 * intro);
      const ang = k * Math.PI * 0.92;
      const raio = 4.6 + (1 - k) * 2;
      _v.set(r.x + Math.sin(ang) * raio * 0.45, 1.6 + k * 0.1 + retrato * 0.5 * k, Math.cos(ang) * raio);
      camera.position.lerp(_v, k);
      _olhar.lerp(_v.set(r.x, 1.25, 0), k);
    }
    camera.lookAt(_olhar);
  }

  return {
    atualizar,
    /** @param {number} k */
    tremer(k) {
      c.tremor = Math.max(c.tremor, k);
    },
  };
}
