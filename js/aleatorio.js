// Sorteio com semente: a mesma semente gera sempre a mesma sequência.
// Assim o mapa e cada onda são reproduzíveis (e testáveis).

export function hashTexto(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Gerador mulberry32: devolve uma função que sorteia números entre 0 e 1. */
export function sorteador(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const inteiro = (rnd, min, max) => min + Math.floor(rnd() * (max - min + 1));
export const escolher = (rnd, lista) => lista[Math.floor(rnd() * lista.length)];
