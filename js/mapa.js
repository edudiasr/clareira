// O terreno: grama, árvore, rocha e veio de ferro, guardado como uma string de N*N letras.
//   . grama   T árvore   R rocha   V veio de ferro

import { N, BORDA, CENTRO, RAIO_INICIAL, PREDIOS, raioClareira } from './config.js';
import { sorteador, inteiro } from './aleatorio.js';

export const GRAMA = '.';
export const ARVORE = 'T';
export const ROCHA = 'R';
export const VEIO = 'V';

export const idx = (x, y) => y * N + x;
export const dentro = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
/** Distância "quadrada" do centro do mapa (a clareira é um quadrado). */
export const distCentro = (x, y) => Math.max(Math.abs(x + 0.5 - CENTRO), Math.abs(y + 0.5 - CENTRO));
export const naBorda = (x, y) => x < BORDA || y < BORDA || x >= N - BORDA || y >= N - BORDA;

export function tile(mapa, x, y) {
  return dentro(x, y) ? mapa[idx(x, y)] : ARVORE;
}

export function trocar(mapa, lista) {
  const a = mapa.split('');
  for (const [x, y, t] of lista) a[idx(x, y)] = t;
  return a.join('');
}

export function gerarMapa(semente) {
  const rnd = sorteador(semente);
  const a = new Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // borda da clareira um pouco irregular, para não parecer recortada com régua
      const ruido = rnd() < 0.18 ? 1 : 0;
      a[idx(x, y)] = distCentro(x, y) <= RAIO_INICIAL - ruido ? GRAMA : ARVORE;
    }
  }
  const livreDoCentro = (x, y) => distCentro(x, y) > 3.5;

  // veios de ferro (2x2): um perto, dentro da clareira, e alguns na mata
  const veios = [];
  const colocarVeio = (dMin, dMax) => {
    for (let tent = 0; tent < 200; tent++) {
      const x = inteiro(rnd, BORDA + 1, N - BORDA - 3);
      const y = inteiro(rnd, BORDA + 1, N - BORDA - 3);
      const d = distCentro(x + 0.5, y + 0.5);
      if (d < dMin || d > dMax) continue;
      if (veios.some(([vx, vy]) => Math.abs(vx - x) < 5 && Math.abs(vy - y) < 5)) continue;
      veios.push([x, y]);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) a[idx(x + dx, y + dy)] = VEIO;
      return;
    }
  };
  colocarVeio(3.5, 5.5);
  for (let i = 0; i < 5; i++) colocarVeio(8, 14);

  // rochas soltas na clareira e na mata
  for (let i = 0; i < 26; i++) {
    const x = inteiro(rnd, BORDA, N - BORDA - 1);
    const y = inteiro(rnd, BORDA, N - BORDA - 1);
    if (a[idx(x, y)] === VEIO || !livreDoCentro(x, y)) continue;
    if (a[idx(x, y)] === GRAMA && rnd() < 0.6) a[idx(x, y)] = ROCHA;
    else if (a[idx(x, y)] === ARVORE && rnd() < 0.35) a[idx(x, y)] = ROCHA;
  }
  return a.join('');
}

// ---------- ocupação ----------

/** Grade com o uid do prédio que ocupa cada tile (ou null). */
export function gradeOcupacao(predios) {
  const g = new Array(N * N).fill(null);
  for (const p of predios) {
    const t = PREDIOS[p.id].tam;
    for (let dy = 0; dy < t; dy++) for (let dx = 0; dx < t; dx++) g[idx(p.x + dx, p.y + dy)] = p.uid;
  }
  return g;
}

/**
 * Pode construir o prédio `id` com o canto em (x, y)? Devolve null se pode, ou o motivo.
 * `ignorar` = uid de um prédio que está sendo movido.
 */
export function motivoNaoPode(mapa, predios, id, x, y, ignorar = null) {
  const def = PREDIOS[id];
  const ocup = gradeOcupacao(predios.filter((p) => p.uid !== ignorar));
  let veios = 0;
  for (let dy = 0; dy < def.tam; dy++) {
    for (let dx = 0; dx < def.tam; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (!dentro(tx, ty) || naBorda(tx, ty)) return 'Fora da área';
      const t = tile(mapa, tx, ty);
      if (t === ARVORE) return 'Tem mata aqui: derrube antes';
      if (t === ROCHA) return 'Tem uma rocha no caminho';
      if (t === VEIO) veios++;
      if (ocup[idx(tx, ty)]) return 'Já tem uma construção aqui';
    }
  }
  if (def.precisaVeio && veios !== def.tam * def.tam) return 'A mina precisa ficar inteira sobre um veio de ferro';
  if (!def.precisaVeio && veios > 0) return 'Veio de ferro é só para a mina';
  return null;
}

/** Tiles de árvore que um corte em (x, y) derruba: bloco 3x3 dentro do limite do QG. */
export function arvoresDoCorte(mapa, x, y, qg) {
  const lista = [];
  let encostaNaClareira = false;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (!dentro(tx, ty) || naBorda(tx, ty) || distCentro(tx, ty) > raioClareira(qg)) continue;
      if (tile(mapa, tx, ty) !== ARVORE) continue;
      lista.push([tx, ty]);
    }
  }
  // vale se o bloco (com uma casa de folga) encosta em chão aberto
  for (let dy = -2; dy <= 2 && !encostaNaClareira; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (dentro(tx, ty) && tile(mapa, tx, ty) !== ARVORE) {
        encostaNaClareira = true;
        break;
      }
    }
  }
  return { lista, encostaNaClareira };
}
