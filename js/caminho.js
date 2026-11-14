// Busca de caminho A* na grade (8 direções).
// As tropas usam isso para chegar no alvo desviando de prédios, contornando muros
// quando compensa e atravessando a mata (mais devagar) quando é o jeito.

import { N } from './config.js';

const VIZ = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/** Fila de prioridade (heap binário) pelo menor `f`. */
class Heap {
  constructor() { this.a = []; }
  get tamanho() { return this.a.length; }
  push(item) {
    const a = this.a;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const pai = (i - 1) >> 1;
      if (a[pai].f <= a[i].f) break;
      [a[pai], a[i]] = [a[i], a[pai]];
      i = pai;
    }
  }
  pop() {
    const a = this.a;
    const topo = a[0];
    const ultimo = a.pop();
    if (a.length) {
      a[0] = ultimo;
      let i = 0;
      for (;;) {
        const e = 2 * i + 1;
        const d = e + 1;
        let m = i;
        if (e < a.length && a[e].f < a[m].f) m = e;
        if (d < a.length && a[d].f < a[m].f) m = d;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return topo;
  }
}

/**
 * @param inicio      [x, y]
 * @param objetivo    (x, y) => boolean  — chegou?
 * @param custo       (x, y) => número (Infinity = bloqueado)
 * @param heuristica  (x, y) => estimativa até o objetivo (não pode superestimar)
 * @returns lista de [x, y] do primeiro passo até o objetivo, ou null
 */
export function aEstrela({ inicio, objetivo, custo, heuristica, limite = 6000 }) {
  const [sx, sy] = inicio;
  if (objetivo(sx, sy)) return [];
  const g = new Float64Array(N * N).fill(Infinity);
  const veio = new Int32Array(N * N).fill(-1);
  const fechado = new Uint8Array(N * N);
  const aberta = new Heap();
  const k0 = sy * N + sx;
  g[k0] = 0;
  aberta.push({ k: k0, f: heuristica(sx, sy) });
  let expandidos = 0;

  while (aberta.tamanho && expandidos < limite) {
    const { k } = aberta.pop();
    if (fechado[k]) continue;
    fechado[k] = 1;
    expandidos++;
    const x = k % N;
    const y = (k / N) | 0;
    if (objetivo(x, y)) {
      const caminho = [];
      for (let c = k; c !== k0; c = veio[c]) caminho.push([c % N, (c / N) | 0]);
      return caminho.reverse();
    }
    for (const [dx, dy, passo] of VIZ) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const c = custo(nx, ny);
      if (c === Infinity) continue;
      // na diagonal, não corta quina de coisa bloqueada
      if (dx && dy && (custo(x + dx, y) === Infinity || custo(x, y + dy) === Infinity)) continue;
      const nk = ny * N + nx;
      const ng = g[k] + passo * c;
      if (ng < g[nk]) {
        g[nk] = ng;
        veio[nk] = k;
        aberta.push({ k: nk, f: ng + heuristica(nx, ny) });
      }
    }
  }
  return null;
}

/** Distância de um ponto até o retângulo [x, y, x+tam, y+tam]. */
export function distRet(px, py, x, y, tam) {
  const dx = Math.max(x - px, 0, px - (x + tam));
  const dy = Math.max(y - py, 0, py - (y + tam));
  return Math.hypot(dx, dy);
}
