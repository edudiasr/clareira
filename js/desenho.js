// Funções de desenho isométrico: converter tile -> pixel e desenhar caixas, cilindros e afins.
// Tudo é desenhado com formas no Canvas, sem nenhuma imagem pronta.

import { N } from './config.js';

export const TW = 64; // largura do losango de um tile
export const TH = 32; // altura do losango
export const TOPO = 120; // espaço acima do mapa para as árvores e torres mais altas
export const LARGURA_MUNDO = N * TW;
export const ALTURA_MUNDO = N * TH + TOPO + 40;

/** Tile (pode ser fracionário) -> pixel do "mundo". */
export const iso = (x, y) => [(x - y) * (TW / 2) + LARGURA_MUNDO / 2, (x + y) * (TH / 2) + TOPO];

/** Pixel do mundo -> tile (fracionário). */
export function deIso(px, py) {
  const a = (px - LARGURA_MUNDO / 2) / (TW / 2);
  const b = (py - TOPO) / (TH / 2);
  return [(a + b) / 2, (b - a) / 2];
}

export function losango(ctx, x, y, tam = 1) {
  const [ax, ay] = iso(x, y);
  const [bx, by] = iso(x + tam, y);
  const [cx, cy] = iso(x + tam, y + tam);
  const [dx, dy] = iso(x, y + tam);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.lineTo(dx, dy);
  ctx.closePath();
}

/** Clareia ou escurece uma cor #rrggbb. */
export function tom(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f))));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

/**
 * Caixa isométrica sobre o retângulo de tiles [x0..x1] x [y0..y1], com altura h (pixels).
 * cor = cor base; as faces saem mais claras/escuras para dar volume.
 */
export function caixa(ctx, x0, y0, x1, y1, h, cor, { base = 0, topo = null, contorno = true } = {}) {
  const p = (x, y, z) => {
    const [px, py] = iso(x, y);
    return [px, py - z];
  };
  const A = p(x0, y0, base + h);
  const B = p(x1, y0, base + h);
  const C = p(x1, y1, base + h);
  const D = p(x0, y1, base + h);
  const Bb = p(x1, y0, base);
  const Cb = p(x1, y1, base);
  const Db = p(x0, y1, base);
  // face esquerda (frente-esquerda)
  ctx.beginPath();
  ctx.moveTo(...D); ctx.lineTo(...C); ctx.lineTo(...Cb); ctx.lineTo(...Db); ctx.closePath();
  ctx.fillStyle = tom(cor, -0.18);
  ctx.fill();
  // face direita
  ctx.beginPath();
  ctx.moveTo(...C); ctx.lineTo(...B); ctx.lineTo(...Bb); ctx.lineTo(...Cb); ctx.closePath();
  ctx.fillStyle = tom(cor, -0.36);
  ctx.fill();
  // tampa
  ctx.beginPath();
  ctx.moveTo(...A); ctx.lineTo(...B); ctx.lineTo(...C); ctx.lineTo(...D); ctx.closePath();
  ctx.fillStyle = topo ?? tom(cor, 0.12);
  ctx.fill();
  if (contorno) {
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(...A); ctx.lineTo(...B); ctx.lineTo(...Bb); ctx.lineTo(...Cb); ctx.lineTo(...Db); ctx.lineTo(...D); ctx.closePath();
    ctx.moveTo(...D); ctx.lineTo(...C); ctx.lineTo(...B);
    ctx.moveTo(...C); ctx.lineTo(...Cb);
    ctx.stroke();
  }
  return { A, B, C, D };
}

/** Telhado de duas águas sobre o retângulo. */
export function telhado(ctx, x0, y0, x1, y1, base, alt, cor) {
  const p = (x, y, z) => {
    const [px, py] = iso(x, y);
    return [px, py - z];
  };
  const my = (y0 + y1) / 2;
  const cumeA = p(x0, my, base + alt);
  const cumeB = p(x1, my, base + alt);
  // água de trás (aparece um pouco por cima)
  ctx.beginPath();
  ctx.moveTo(...cumeA); ctx.lineTo(...cumeB); ctx.lineTo(...p(x1, y0, base)); ctx.lineTo(...p(x0, y0, base)); ctx.closePath();
  ctx.fillStyle = tom(cor, 0.15);
  ctx.fill();
  // oitão direito
  ctx.beginPath();
  ctx.moveTo(...cumeB); ctx.lineTo(...p(x1, y0, base)); ctx.lineTo(...p(x1, y1, base)); ctx.closePath();
  ctx.fillStyle = tom(cor, -0.35);
  ctx.fill();
  // água da frente
  ctx.beginPath();
  ctx.moveTo(...cumeA); ctx.lineTo(...cumeB); ctx.lineTo(...p(x1, y1, base)); ctx.lineTo(...p(x0, y1, base)); ctx.closePath();
  ctx.fillStyle = tom(cor, -0.05);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.moveTo(...cumeA); ctx.lineTo(...cumeB);
  ctx.stroke();
}

/** Cilindro em pé (torre, tanque, tesla). (x, y) = centro em tiles, r em tiles. */
export function cilindro(ctx, x, y, r, h, cor, base = 0) {
  const [cx, cy] = iso(x, y);
  const rx = r * TW * 0.707;
  const ry = rx / 2;
  const g = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
  g.addColorStop(0, tom(cor, -0.05));
  g.addColorStop(0.5, tom(cor, -0.2));
  g.addColorStop(1, tom(cor, -0.45));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy - base, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(cx - rx, cy - base - h);
  ctx.ellipse(cx, cy - base - h, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = tom(cor, 0.15);
  ctx.beginPath();
  ctx.ellipse(cx, cy - base - h, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.stroke();
  return [cx, cy - base - h];
}

export function sombra(ctx, x, y, rx, alfa = 0.3) {
  const [cx, cy] = iso(x, y);
  ctx.fillStyle = `rgba(0,0,0,${alfa})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, rx / 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Ângulo do mundo (em tiles) -> direção na tela. */
export function direcaoTela(ang) {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const sx = (dx - dy) * (TW / 2);
  const sy = (dx + dy) * (TH / 2);
  const m = Math.hypot(sx, sy) || 1;
  return [sx / m, sy / m];
}
