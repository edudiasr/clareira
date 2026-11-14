// Monta cada onda de ataque: de que lados vem, quantas tropas e de que tipo.
// A onda N é sempre a mesma para a mesma semente, então dá pra mostrar o aviso antes.

import { INIMIGOS } from './config.js';
import { sorteador, hashTexto, escolher } from './aleatorio.js';

export const LADOS = ['norte', 'leste', 'sul', 'oeste'];

/** "Orçamento" de força da onda: cresce um pouco mais rápido que linear. */
export const forcaDaOnda = (n) => Math.round(3 + 4 * n + n ** 1.35);

/** As tropas ficam mais resistentes a cada onda. */
export const fatorVida = (n) => 1 + 0.09 * (n - 1);

function quantosLados(n, rnd) {
  if (n <= 3) return 1;
  if (n <= 9) return rnd() < 0.5 ? 1 : 2;
  if (n <= 15) return rnd() < 0.5 ? 2 : 3;
  return 2 + Math.floor(rnd() * 3); // 2 a 4
}

export function gerarOnda(n, semente) {
  const rnd = sorteador(hashTexto(`${semente}|onda|${n}`));
  const embaralhados = [...LADOS];
  for (let i = embaralhados.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [embaralhados[i], embaralhados[j]] = [embaralhados[j], embaralhados[i]];
  }
  const lados = embaralhados.slice(0, quantosLados(n, rnd));
  const liberados = Object.entries(INIMIGOS).filter(([, d]) => !d.chefe && d.desde <= n);

  const tropas = [];
  let resta = forcaDaOnda(n);
  // garante variedade: cada tipo liberado entra pelo menos uma vez quando cabe
  for (const [tipo, d] of liberados) {
    if (d.custo <= resta && tipo !== 'fuzileiro') {
      tropas.push(tipo);
      resta -= d.custo;
    }
  }
  while (resta > 0) {
    const cabem = liberados.filter(([, d]) => d.custo <= resta);
    if (!cabem.length) break;
    // fuzileiro aparece mais (peso 3)
    const pesos = cabem.flatMap(([t, d]) => Array(t === 'fuzileiro' ? 3 : d.custo >= 10 ? 1 : 2).fill(t));
    const tipo = escolher(rnd, pesos);
    tropas.push(tipo);
    resta -= INIMIGOS[tipo].custo;
  }

  let chefe = null;
  if (n % 5 === 0) {
    chefe = (n / 5) % 2 === 1 ? 'colheitadeira' : 'helicoptero';
    tropas.push(chefe);
  }

  // distribui pelos lados e espalha no tempo (chegam em levas ao longo de ~25 s)
  const grupos = tropas.map((tipo, i) => ({
    tipo,
    lado: lados[i % lados.length],
    t: INIMIGOS[tipo].chefe ? 12 : Math.round(rnd() * 22 * 10) / 10,
    pos: rnd(), // posição ao longo do lado (0 a 1)
  }));
  grupos.sort((a, b) => a.t - b.t);
  return { numero: n, lados, grupos, chefe, forca: forcaDaOnda(n) };
}

/** Contagem por tipo, para a tela de aviso. */
export function resumoOnda(onda) {
  const c = {};
  for (const g of onda.grupos) c[g.tipo] = (c[g.tipo] ?? 0) + 1;
  return c;
}
