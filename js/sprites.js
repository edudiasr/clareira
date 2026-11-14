// Como cada coisa do jogo é desenhada: terreno, árvores, prédios, tropas e efeitos.

import { N, PREDIOS } from './config.js';
import { iso, losango, caixa, telhado, cilindro, sombra, tom, direcaoTela, TW, TH, LARGURA_MUNDO, ALTURA_MUNDO } from './desenho.js';
import { tile, ARVORE, ROCHA, VEIO, naBorda, idx } from './mapa.js';
import { sorteador, hashTexto } from './aleatorio.js';

// ---------- terreno (desenhado uma vez numa tela escondida) ----------

function pinheiro(ctx, px, py, s, rnd, escuro) {
  const verdes = escuro ? ['#163b22', '#1d4a2a', '#24572f'] : ['#1f5530', '#2a6b3a', '#368047'];
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(px, py, 14 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a3020';
  ctx.fillRect(px - 2.5 * s, py - 10 * s, 5 * s, 10 * s);
  const camadas = 3;
  for (let i = 0; i < camadas; i++) {
    const base = py - 8 * s - i * 13 * s;
    const larg = (17 - i * 4) * s;
    const alt = 22 * s;
    const cor = verdes[i];
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.moveTo(px - larg, base);
    ctx.lineTo(px, base - alt);
    ctx.lineTo(px + larg, base);
    ctx.quadraticCurveTo(px, base + 5 * s, px - larg, base);
    ctx.fill();
    // lado iluminado
    ctx.fillStyle = tom(cor, 0.18);
    ctx.beginPath();
    ctx.moveTo(px - larg, base);
    ctx.lineTo(px, base - alt);
    ctx.lineTo(px - larg * 0.15, base + 1);
    ctx.fill();
  }
  if (rnd() < 0.12) {
    // frutinhas vermelhas de vez em quando
    ctx.fillStyle = '#c94b3c';
    ctx.beginPath();
    ctx.arc(px + 6 * s, py - 18 * s, 1.8 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function folhosa(ctx, px, py, s) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(px, py, 15 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a3020';
  ctx.fillRect(px - 3 * s, py - 16 * s, 6 * s, 16 * s);
  const bolas = [[0, -30, 15], [-10, -22, 11], [10, -22, 11], [0, -40, 10]];
  for (const [dx, dy, r] of bolas) {
    ctx.fillStyle = '#2e6b34';
    ctx.beginPath();
    ctx.arc(px + dx * s, py + dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#3f8a44';
  ctx.beginPath();
  ctx.arc(px - 4 * s, py - 34 * s, 8 * s, 0, Math.PI * 2);
  ctx.fill();
}

function rocha(ctx, x, y, rnd) {
  const [px, py] = iso(x + 0.5, y + 0.5);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(px, py + 2, 18, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  const pedras = [[-6, 0, 12], [7, 2, 9], [0, -6, 9]];
  for (const [dx, dy, r] of pedras) {
    const rr = r * (0.8 + rnd() * 0.4);
    const g = ctx.createRadialGradient(px + dx - rr / 3, py + dy - rr / 2, 1, px + dx, py + dy, rr);
    g.addColorStop(0, '#c3c7cc');
    g.addColorStop(1, '#6b7078');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(px + dx, py + dy - rr / 2, rr, rr * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Desenha o chão, a mata e as rochas numa tela escondida (só redesenha quando o mapa muda). */
export function desenharTerreno(cv, mapa, semente) {
  const ctx = cv.getContext('2d');
  const escala = cv.width / LARGURA_MUNDO;
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.fillStyle = '#0c1d11';
  ctx.fillRect(0, 0, LARGURA_MUNDO, ALTURA_MUNDO);

  // chão
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const t = tile(mapa, x, y);
      const h = hashTexto(`${semente}:${x}:${y}`);
      const v = ((h & 255) / 255 - 0.5) * 0.08;
      let cor;
      if (t === ARVORE) cor = tom('#1f3d22', v);
      else cor = tom((x + y) % 2 ? '#5c9a45' : '#60a048', v);
      losango(ctx, x, y);
      ctx.fillStyle = cor;
      ctx.fill();
      if (t === VEIO) {
        losango(ctx, x, y);
        ctx.fillStyle = 'rgba(120,80,50,0.55)';
        ctx.fill();
        const r = sorteador(h);
        for (let i = 0; i < 5; i++) {
          const [px, py] = iso(x + 0.2 + r() * 0.6, y + 0.2 + r() * 0.6);
          ctx.fillStyle = i % 2 ? '#d4732e' : '#8a5a3a';
          ctx.beginPath();
          ctx.ellipse(px, py, 4 + r() * 3, 2.5 + r() * 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (t !== ARVORE && (h >> 8) % 7 === 0) {
        // tufinhos de grama e florzinhas
        const r = sorteador(h);
        const [px, py] = iso(x + 0.3 + r() * 0.4, y + 0.3 + r() * 0.4);
        ctx.strokeStyle = '#3f7a33';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
          ctx.moveTo(px + i * 3, py);
          ctx.lineTo(px + i * 4, py - 6);
        }
        ctx.stroke();
        if (r() < 0.4) {
          ctx.fillStyle = r() < 0.5 ? '#f5e66b' : '#f0f0f0';
          ctx.beginPath();
          ctx.arc(px + 5, py - 3, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  // sombra da mata sobre a grama da beira
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (tile(mapa, x, y) === ARVORE) continue;
      const vizMata = [[-1, 0], [0, -1]].filter(([dx, dy]) => tile(mapa, x + dx, y + dy) === ARVORE).length;
      if (!vizMata) continue;
      losango(ctx, x, y);
      ctx.fillStyle = `rgba(10,30,12,${0.12 * vizMata})`;
      ctx.fill();
    }
  }

  // árvores e rochas, de trás para frente
  for (let soma = 0; soma <= 2 * (N - 1); soma++) {
    for (let x = Math.max(0, soma - N + 1); x <= Math.min(N - 1, soma); x++) {
      const y = soma - x;
      const t = mapa[idx(x, y)];
      const rnd = sorteador(hashTexto(`${semente}|arv|${x}|${y}`));
      if (t === ROCHA) {
        rocha(ctx, x, y, rnd);
      } else if (t === ARVORE) {
        const borda = naBorda(x, y);
        const qtd = rnd() < 0.55 ? 2 : 1;
        for (let i = 0; i < qtd; i++) {
          const [px, py] = iso(x + 0.25 + rnd() * 0.5, y + 0.25 + rnd() * 0.5);
          const s = (borda ? 1.05 : 0.85) + rnd() * 0.35;
          if (rnd() < 0.18) folhosa(ctx, px, py, s * 0.9);
          else pinheiro(ctx, px, py, s, rnd, borda);
        }
      }
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------- prédios ----------

const VERDE_DEFENSOR = '#3c8d4e';

function base(ctx, p, tam, cor = '#7b6a4f') {
  const m = 0.06;
  losango(ctx, p.x + m, p.y + m, tam - 2 * m);
  ctx.fillStyle = cor;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.stroke();
}

function bandeira(ctx, px, py, t, cor) {
  ctx.strokeStyle = '#3a2a1a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py - 26);
  ctx.stroke();
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.moveTo(px, py - 26);
  const onda = Math.sin(t * 5) * 2;
  ctx.quadraticCurveTo(px + 8, py - 28 + onda, px + 16, py - 23 + onda);
  ctx.lineTo(px + 16, py - 17 + onda);
  ctx.quadraticCurveTo(px + 8, py - 20 - onda, px, py - 16);
  ctx.closePath();
  ctx.fill();
}

function estrelas(ctx, px, py, nivel) {
  if (nivel < 2) return;
  ctx.font = 'bold 10px Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const txt = `${nivel}`;
  ctx.beginPath();
  ctx.roundRect(px - 9, py - 8, 18, 14, 7);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(txt, px, py + 3);
}

const DESENHOS = {
  qg(ctx, p, o) {
    const n = p.nivel || 1;
    base(ctx, p, 3, '#8a7a5c');
    const pedra = n >= 5 ? '#6f7680' : '#8f959c';
    caixa(ctx, p.x + 0.25, p.y + 0.25, p.x + 2.75, p.y + 2.75, 16 + n * 1.5, pedra);
    const h1 = 16 + n * 1.5;
    caixa(ctx, p.x + 0.6, p.y + 0.6, p.x + 2.4, p.y + 2.4, 22 + n * 2, '#a5733f', { base: h1 });
    const h2 = h1 + 22 + n * 2;
    telhado(ctx, p.x + 0.45, p.y + 0.45, p.x + 2.55, p.y + 2.55, h2, 18 + n, n >= 6 ? '#2f4f7a' : '#8b3a2a');
    if (n >= 3) {
      for (const [dx, dy] of [[0.35, 2.65], [2.65, 2.65], [2.65, 0.35]]) cilindro(ctx, p.x + dx, p.y + dy, 0.28, h1 + 14, pedra);
    }
    const [fx, fy] = iso(p.x + 1.5, p.y + 1.5);
    bandeira(ctx, fx, fy - h2 - 18 - n, o.t, '#3fbf5a');
    if (n >= 7) {
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(fx, fy - h2 - 6, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    return h2 + 30;
  },

  serraria(ctx, p, o) {
    base(ctx, p, 2, '#8d6e4a');
    caixa(ctx, p.x + 0.2, p.y + 0.6, p.x + 1.4, p.y + 1.8, 18, '#9c6b3b');
    telhado(ctx, p.x + 0.1, p.y + 0.5, p.x + 1.5, p.y + 1.9, 18, 12, '#6b4a2b');
    // pilha de toras
    for (let i = 0; i < 3; i++) {
      const [px, py] = iso(p.x + 1.65, p.y + 0.35 + i * 0.28);
      ctx.fillStyle = '#7a4f2a';
      ctx.beginPath();
      ctx.ellipse(px, py - 5, 12, 5, -0.46, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d8b07a';
      ctx.beginPath();
      ctx.arc(px + 10, py - 10, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // serra girando
    const [sx, sy] = iso(p.x + 1.55, p.y + 1.55);
    ctx.save();
    ctx.translate(sx, sy - 12);
    ctx.rotate(o.ativo ? o.t * 8 : 0);
    ctx.fillStyle = '#c9ced4';
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = i % 2 ? 7 : 9;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return 34;
  },

  pedreira(ctx, p, o) {
    base(ctx, p, 2, '#8c8577');
    const pilhas = [[0.3, 0.3, 0.9, 0.9, 14], [1.0, 0.25, 1.75, 0.95, 10], [0.25, 1.0, 0.95, 1.7, 9]];
    for (const [a, b, c, d, h] of pilhas) caixa(ctx, p.x + a, p.y + b, p.x + c, p.y + d, h, '#9ba1a8');
    // guindaste
    const [bx, by] = iso(p.x + 1.4, p.y + 1.4);
    ctx.strokeStyle = '#6b4a2b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx, by - 40);
    ctx.lineTo(bx - 24, by - 30);
    ctx.stroke();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    const balanco = o.ativo ? Math.sin(o.t * 2) * 3 : 0;
    ctx.beginPath();
    ctx.moveTo(bx - 24, by - 30);
    ctx.lineTo(bx - 24 + balanco, by - 14);
    ctx.stroke();
    ctx.fillStyle = '#9ba1a8';
    ctx.fillRect(bx - 28 + balanco, by - 14, 8, 6);
    return 44;
  },

  mina(ctx, p, o) {
    base(ctx, p, 2, '#6e5544');
    caixa(ctx, p.x + 0.2, p.y + 0.2, p.x + 1.8, p.y + 1.3, 22, '#5d5a57', { topo: '#4d6b3a' });
    // entrada
    const [ex, ey] = iso(p.x + 1.0, p.y + 1.3);
    ctx.fillStyle = '#1b1410';
    ctx.beginPath();
    ctx.moveTo(ex - 10, ey);
    ctx.lineTo(ex - 10, ey - 12);
    ctx.quadraticCurveTo(ex, ey - 22, ex + 10, ey - 12);
    ctx.lineTo(ex + 10, ey);
    ctx.fill();
    ctx.strokeStyle = '#7a4f2a';
    ctx.lineWidth = 3;
    ctx.stroke();
    // carrinho com minério
    const vai = o.ativo ? (Math.sin(o.t * 1.5) + 1) * 0.25 : 0;
    caixa(ctx, p.x + 0.9 + vai, p.y + 1.45, p.x + 1.35 + vai, p.y + 1.8, 6, '#4a4a4a');
    const [cx, cy] = iso(p.x + 1.12 + vai, p.y + 1.62);
    ctx.fillStyle = '#d4732e';
    ctx.beginPath();
    ctx.arc(cx, cy - 8, 4, 0, Math.PI * 2);
    ctx.arc(cx + 4, cy - 7, 3, 0, Math.PI * 2);
    ctx.fill();
    return 30;
  },

  mercado(ctx, p, o) {
    base(ctx, p, 2, '#a08a62');
    caixa(ctx, p.x + 0.3, p.y + 0.3, p.x + 1.7, p.y + 1.7, 12, '#b98a52');
    // toldo listrado
    for (let i = 0; i < 4; i++) {
      const y0 = p.y + 0.15 + i * 0.425;
      telhado(ctx, p.x + 0.15, y0, p.x + 1.85, y0 + 0.425, 12, 7, i % 2 ? '#f0e6d2' : '#d0453a');
    }
    // moeda
    const [mx, my] = iso(p.x + 1, p.y + 1);
    const pulo = o.ativo ? Math.abs(Math.sin(o.t * 2.5)) * 4 : 0;
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my - 34 - pulo, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    return 44;
  },

  deposito(ctx, p) {
    base(ctx, p, 2, '#8d7a5a');
    caixa(ctx, p.x + 0.25, p.y + 0.25, p.x + 1.75, p.y + 1.1, 20, '#7a5634');
    caixa(ctx, p.x + 0.3, p.y + 1.2, p.x + 0.85, p.y + 1.75, 12, '#a0703c');
    caixa(ctx, p.x + 0.35, p.y + 1.25, p.x + 0.8, p.y + 1.7, 10, '#a0703c', { base: 12 });
    cilindro(ctx, p.x + 1.3, p.y + 1.45, 0.2, 14, '#6b4a2b');
    cilindro(ctx, p.x + 1.62, p.y + 1.45, 0.2, 14, '#6b4a2b');
    return 28;
  },

  vigia(ctx, p, o) {
    base(ctx, p, 2, '#7d6a4c');
    const h = 54 + (p.nivel || 1) * 6;
    for (const [dx, dy] of [[0.55, 0.55], [1.45, 0.55], [0.55, 1.45], [1.45, 1.45]]) {
      caixa(ctx, p.x + dx - 0.07, p.y + dy - 0.07, p.x + dx + 0.07, p.y + dy + 0.07, h, '#6b4a2b', { contorno: false });
    }
    caixa(ctx, p.x + 0.4, p.y + 0.4, p.x + 1.6, p.y + 1.6, 8, '#8b5e34', { base: h });
    telhado(ctx, p.x + 0.35, p.y + 0.35, p.x + 1.65, p.y + 1.65, h + 22, 12, '#5a3d24');
    const [lx, ly] = iso(p.x + 1, p.y + 1);
    const brilho = 0.6 + Math.sin(o.t * 3) * 0.3;
    ctx.fillStyle = `rgba(255,214,90,${brilho})`;
    ctx.beginPath();
    ctx.arc(lx, ly - h - 14, 4, 0, Math.PI * 2);
    ctx.fill();
    return h + 40;
  },

  barracao(ctx, p) {
    base(ctx, p, 2, '#8d7a5a');
    caixa(ctx, p.x + 0.3, p.y + 0.3, p.x + 1.7, p.y + 1.7, 18, '#b07b47');
    telhado(ctx, p.x + 0.2, p.y + 0.2, p.x + 1.8, p.y + 1.8, 18, 14, '#4f6b3a');
    const [hx, hy] = iso(p.x + 1, p.y + 1.85);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.roundRect(hx - 9, hy - 22, 18, 10, 3);
    ctx.fill();
    ctx.fillStyle = '#5a3d24';
    ctx.font = 'bold 8px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚒', hx, hy - 14);
    return 40;
  },

  atiradores(ctx, p, o) {
    const n = p.nivel || 1;
    base(ctx, p, 2, '#7d6a4c');
    cilindro(ctx, p.x + 1, p.y + 1, 0.62, 12, '#8f959c');
    const h = 30 + n * 3;
    caixa(ctx, p.x + 0.55, p.y + 0.55, p.x + 1.45, p.y + 1.45, h, '#9c6b3b', { base: 12 });
    caixa(ctx, p.x + 0.4, p.y + 0.4, p.x + 1.6, p.y + 1.6, 6, '#7a5634', { base: 12 + h });
    const topo = 18 + h;
    // atirador
    const [tx, ty] = iso(p.x + 1, p.y + 1);
    const [dx, dy] = direcaoTela(o.mira ?? 0.8);
    soldado(ctx, tx, ty - topo, VERDE_DEFENSOR, '#2d5e38', dx, dy, o.t, false, 0.9);
    if (n >= 4) bandeira(ctx, ...iso(p.x + 0.45, p.y + 0.45).map((v, i) => (i ? v - topo + 4 : v)), o.t, '#3fbf5a');
    return topo + 24;
  },

  canhao(ctx, p, o) {
    const n = p.nivel || 1;
    base(ctx, p, 2, '#7d6a4c');
    const [cx, cy] = cilindro(ctx, p.x + 1, p.y + 1, 0.75, 12 + n, n >= 5 ? '#6f7680' : '#8f959c');
    const [dx, dy] = direcaoTela(o.mira ?? 0.8);
    const recuo = o.recuo ?? 0;
    ctx.strokeStyle = '#2b2f33';
    ctx.lineCap = 'round';
    ctx.lineWidth = 9 + n * 0.6;
    ctx.beginPath();
    ctx.moveTo(cx - dx * 4, cy - 6);
    ctx.lineTo(cx + dx * (22 - recuo), cy - 6 + dy * (22 - recuo) - 3);
    ctx.stroke();
    ctx.strokeStyle = '#4a5056';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - dx * 2, cy - 9);
    ctx.lineTo(cx + dx * (18 - recuo), cy - 9 + dy * (18 - recuo) - 3);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = '#5a3d24';
    ctx.beginPath();
    ctx.arc(cx - 8, cy - 3, 5, 0, Math.PI * 2);
    ctx.arc(cx + 8, cy - 3, 5, 0, Math.PI * 2);
    ctx.fill();
    return 30;
  },

  morteiro(ctx, p, o) {
    base(ctx, p, 2, '#7d6a4c');
    // sacos de areia
    const [cx, cy] = iso(p.x + 1, p.y + 1);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.fillStyle = i % 2 ? '#b9a27a' : '#a68f68';
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * 30, cy + Math.sin(a) * 15 - 6, 10, 6, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#4d4033';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 4, 22, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    const [dx, dy] = direcaoTela(o.mira ?? 0.8);
    ctx.strokeStyle = '#30363c';
    ctx.lineCap = 'round';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx + dx * 8, cy - 26 + dy * 4);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.ellipse(cx + dx * 8, cy - 27 + dy * 4, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    return 36;
  },

  tesla(ctx, p, o) {
    const n = p.nivel || 1;
    base(ctx, p, 2, '#5f6670');
    caixa(ctx, p.x + 0.45, p.y + 0.45, p.x + 1.55, p.y + 1.55, 10, '#4c5560');
    const h = 38 + n * 3;
    const [tx, ty] = cilindro(ctx, p.x + 1, p.y + 1, 0.12, h, '#9aa4ae', 10);
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = '#c88a3a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(tx, ty + 10 + i * 6, 9, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const pulso = o.desligado ? 0.15 : 0.55 + Math.sin(o.t * 6) * 0.25;
    const g = ctx.createRadialGradient(tx, ty - 4, 1, tx, ty - 4, 20);
    g.addColorStop(0, `rgba(190,245,255,${pulso + 0.3})`);
    g.addColorStop(1, 'rgba(80,200,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(tx, ty - 4, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = o.desligado ? '#556' : '#bff3ff';
    ctx.beginPath();
    ctx.arc(tx, ty - 4, 7, 0, Math.PI * 2);
    ctx.fill();
    if (!o.desligado && Math.random() < 0.08) {
      ctx.strokeStyle = 'rgba(160,240,255,0.8)';
      ctx.lineWidth = 1.5;
      raioZigue(ctx, tx, ty - 4, tx + (Math.random() - 0.5) * 30, ty + 10 + Math.random() * 10, 4);
    }
    return h + 30;
  },

  muro(ctx, p, o) {
    const n = p.nivel || 1;
    const cor = n >= 5 ? '#6f7680' : n >= 3 ? '#8f959c' : '#a39a86';
    const viz = o.vizinhosMuro ?? {};
    const m = 0.2;
    const h = 14 + n * 2;
    caixa(ctx, p.x + m, p.y + m, p.x + 1 - m, p.y + 1 - m, h + 4, cor);
    // conecta com os muros vizinhos (só para frente, para não desenhar duas vezes)
    if (viz.direita) caixa(ctx, p.x + 1 - m, p.y + 0.3, p.x + 1 + m, p.y + 0.7, h, cor);
    if (viz.baixo) caixa(ctx, p.x + 0.3, p.y + 1 - m, p.x + 0.7, p.y + 1 + m, h, cor);
    return h + 10;
  },

  armadilha(ctx, p, o) {
    const [cx, cy] = iso(p.x + 0.5, p.y + 0.5);
    ctx.globalAlpha = o.fantasma ? 0.9 : 0.55;
    ctx.fillStyle = '#3b3b33';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 9, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d0453a';
    ctx.beginPath();
    ctx.arc(cx, cy - 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return 10;
  },
};

function obraAndaimes(ctx, p, tam, progresso, t) {
  const m = 0.12;
  base(ctx, p, tam, '#9b8a68');
  const h = 18 + tam * 6;
  const cantos = [[m, m], [tam - m, m], [m, tam - m], [tam - m, tam - m]];
  ctx.strokeStyle = '#8b5e34';
  ctx.lineWidth = 2;
  for (const [dx, dy] of cantos) {
    const [px, py] = iso(p.x + dx, p.y + dy);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py - h);
    ctx.stroke();
  }
  const anel = (z) => {
    ctx.beginPath();
    const pts = [[m, m], [tam - m, m], [tam - m, tam - m], [m, tam - m]].map(([dx, dy]) => {
      const [px, py] = iso(p.x + dx, p.y + dy);
      return [px, py - z];
    });
    ctx.moveTo(...pts[0]);
    for (const q of pts.slice(1)) ctx.lineTo(...q);
    ctx.closePath();
    ctx.stroke();
  };
  anel(h * 0.5);
  anel(h);
  // caixa subindo conforme o progresso
  caixa(ctx, p.x + 0.35, p.y + 0.35, p.x + tam - 0.35, p.y + tam - 0.35, Math.max(2, h * 0.8 * progresso), '#b5a184');
  // martelinho
  const [hx, hy] = iso(p.x + tam / 2, p.y + tam / 2);
  ctx.save();
  ctx.translate(hx + 10, hy - h - 6);
  ctx.rotate(Math.sin(t * 10) * 0.6);
  ctx.fillStyle = '#5a3d24';
  ctx.fillRect(-1.5, 0, 3, 10);
  ctx.fillStyle = '#9aa4ae';
  ctx.fillRect(-5, -2, 10, 4);
  ctx.restore();
  return h + 10;
}

function ruina(ctx, p, tam, t) {
  base(ctx, p, tam, '#4a4036');
  const rnd = sorteador(p.uid * 7919);
  const pedacos = tam * tam * 3;
  for (let i = 0; i < pedacos; i++) {
    const x = p.x + 0.2 + rnd() * (tam - 0.5);
    const y = p.y + 0.2 + rnd() * (tam - 0.5);
    const s = 0.12 + rnd() * 0.18;
    caixa(ctx, x, y, x + s, y + s, 3 + rnd() * 7, rnd() < 0.5 ? '#6b5a46' : '#7c7f84', { contorno: false });
  }
  // fumaça
  const [cx, cy] = iso(p.x + tam / 2, p.y + tam / 2);
  for (let i = 0; i < 3; i++) {
    const fase = (t * 0.4 + i / 3) % 1;
    ctx.fillStyle = `rgba(60,60,60,${0.35 * (1 - fase)})`;
    ctx.beginPath();
    ctx.arc(cx + Math.sin(fase * 6 + i) * 6, cy - 10 - fase * 40, 5 + fase * 10, 0, Math.PI * 2);
    ctx.fill();
  }
  return 20;
}

/**
 * Desenha um prédio. o = { t, mira, ativo, progresso, fantasma, ruina, desligado, vizinhosMuro }
 * Devolve a altura aproximada (para posicionar barras de vida e rótulos).
 */
export function desenharPredio(ctx, p, o) {
  const tam = PREDIOS[p.id].tam;
  if (o.ruina) return ruina(ctx, p, tam, o.t);
  if (p.nivel === 0 && !o.fantasma) return obraAndaimes(ctx, p, tam, o.progresso ?? 0, o.t);
  return DESENHOS[p.id](ctx, p, o);
}

export function seloNivel(ctx, p, altura) {
  const tam = PREDIOS[p.id].tam;
  if (tam < 2) return;
  const [x, y] = iso(p.x + tam / 2, p.y + tam / 2);
  estrelas(ctx, x, y - altura - 2, p.nivel);
}

// ---------- tropas ----------

const LARANJA = '#f28c28';
const AMARELO = '#ffd23f';

/** Bonequinho genérico. (dx, dy) = direção para onde olha na tela. */
export function soldado(ctx, px, py, cor, calca, dx, dy, t, andando, s = 1, arma = 'fuzil') {
  const passo = andando ? Math.sin(t * 14) : 0;
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(s * 1.3, s * 1.3);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // pernas
  ctx.strokeStyle = calca;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-2, -7);
  ctx.lineTo(-2 + passo * 2, -1);
  ctx.moveTo(2, -7);
  ctx.lineTo(2 - passo * 2, -1);
  ctx.stroke();
  // corpo
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.roundRect(-4.5, -16, 9, 10, 3);
  ctx.fill();
  // cabeça e capacete
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(0, -19, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cor === LARANJA ? AMARELO : '#2d5e38';
  ctx.beginPath();
  ctx.arc(0, -20.5, 4, Math.PI, 0);
  ctx.fill();
  // arma
  ctx.strokeStyle = '#222';
  ctx.lineWidth = arma === 'bazuca' ? 4 : 2;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  const comp = arma === 'bazuca' ? 13 : arma === 'serra' ? 9 : 11;
  ctx.lineTo(dx * comp, -12 + dy * comp * 0.6);
  ctx.stroke();
  if (arma === 'serra') {
    ctx.fillStyle = '#c9ced4';
    ctx.fillRect(dx * comp - 2, -13 + dy * comp * 0.6, 5, 2);
  }
  ctx.lineCap = 'butt';
  ctx.restore();
}

function veiculo(ctx, e, t, cor, tamanho, extra) {
  const [px, py] = iso(e.x, e.y);
  const [dx, dy] = direcaoTela(e.angulo);
  ctx.save();
  ctx.translate(px, py);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 20 * tamanho, 10 * tamanho, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(Math.atan2(dy, dx) * 0.25);
  // esteiras
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.roundRect(-16 * tamanho, -8 * tamanho, 32 * tamanho, 9 * tamanho, 4);
  ctx.fill();
  const rolar = (t * 20) % 6;
  ctx.fillStyle = '#4a4a4a';
  for (let i = -15; i < 15; i += 6) ctx.fillRect((i + rolar) * tamanho, -7 * tamanho, 2, 7 * tamanho);
  // corpo
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.roundRect(-13 * tamanho, -20 * tamanho, 26 * tamanho, 13 * tamanho, 3);
  ctx.fill();
  ctx.fillStyle = tom(cor, -0.25);
  ctx.fillRect(-13 * tamanho, -10 * tamanho, 26 * tamanho, 3 * tamanho);
  ctx.fillStyle = '#9ed6ff';
  ctx.fillRect(-4 * tamanho, -26 * tamanho, 10 * tamanho, 7 * tamanho);
  ctx.strokeStyle = '#333';
  ctx.strokeRect(-4 * tamanho, -26 * tamanho, 10 * tamanho, 7 * tamanho);
  extra?.(ctx, dx, dy, tamanho);
  ctx.restore();
}

export function desenharInimigo(ctx, e, t) {
  const [px, py] = iso(e.x, e.y);
  const [dx, dy] = direcaoTela(e.angulo);
  switch (e.tipo) {
    case 'fuzileiro':
      soldado(ctx, px, py, LARANJA, '#3a3f45', dx, dy, t + e.id, e.andando);
      break;
    case 'motosserra':
      soldado(ctx, px, py, '#c0392b', '#3a3f45', dx, dy, t + e.id, e.andando, 1.05, 'serra');
      break;
    case 'bazuca':
      soldado(ctx, px, py, '#d67a1f', '#2f3337', dx, dy, t + e.id, e.andando, 1.05, 'bazuca');
      break;
    case 'engenheiro':
      soldado(ctx, px, py, '#e0c040', '#3a3f45', dx, dy, t + e.id, e.andando, 1, 'chave');
      ctx.fillStyle = '#55c8ff';
      ctx.beginPath();
      ctx.arc(px + 6, py - 18, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'motoqueiro': {
      ctx.save();
      ctx.translate(px, py);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-dx * 7, -3 - dy * 3, 3.5, 0, Math.PI * 2);
      ctx.arc(dx * 7, -3 + dy * 3, 3.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = LARANJA;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-dx * 7, -5);
      ctx.lineTo(dx * 7, -5 + dy * 3);
      ctx.stroke();
      ctx.restore();
      soldado(ctx, px, py - 5, LARANJA, '#3a3f45', dx, dy, 0, false, 0.85);
      break;
    }
    case 'trator':
      veiculo(ctx, e, t, '#e8b923', 1, (c, ddx) => {
        c.fillStyle = '#777';
        c.fillRect(ddx > 0 ? 13 : -18, -12, 5, 12);
      });
      break;
    case 'colheitadeira':
      veiculo(ctx, e, t, '#8bbf2e', 1.8, (c, ddx) => {
        c.save();
        c.translate(ddx > 0 ? 28 : -28, -14);
        c.rotate(t * 6);
        c.strokeStyle = '#c9a227';
        c.lineWidth = 3;
        for (let i = 0; i < 4; i++) {
          c.rotate(Math.PI / 4);
          c.beginPath();
          c.moveTo(-10, 0);
          c.lineTo(10, 0);
          c.stroke();
        }
        c.restore();
      });
      break;
    case 'helicoptero': {
      const alt = 48 + Math.sin(t * 2 + e.id) * 3;
      sombra(ctx, e.x, e.y, 18, 0.25);
      ctx.save();
      ctx.translate(px, py - alt);
      ctx.scale(1.5, 1.5);
      ctx.fillStyle = '#3d454d';
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 9, Math.atan2(dy, dx) * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = LARANJA;
      ctx.fillRect(-12, -2, 24, 3);
      ctx.strokeStyle = '#3d454d';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-dx * 10, 0);
      ctx.lineTo(-dx * 30, -4);
      ctx.stroke();
      ctx.fillStyle = '#9ed6ff';
      ctx.beginPath();
      ctx.ellipse(dx * 9, -2, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // hélice
      ctx.strokeStyle = 'rgba(30,30,30,0.7)';
      ctx.lineWidth = 2;
      const a = t * 30;
      ctx.beginPath();
      ctx.ellipse(0, -12, 30, 8, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(30,30,30,0.15)';
      ctx.stroke();
      ctx.strokeStyle = 'rgba(30,30,30,0.7)';
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 30, -12 + Math.sin(a) * 8);
      ctx.lineTo(-Math.cos(a) * 30, -12 - Math.sin(a) * 8);
      ctx.stroke();
      ctx.restore();
      break;
    }
    default:
      soldado(ctx, px, py, LARANJA, '#333', dx, dy, t, e.andando);
  }
  // barra de vida
  if (e.hp < e.hpMax) {
    const alt = e.ar ? 84 : e.def.chefe ? 50 : 36;
    const larg = e.def.chefe ? 40 : 18;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(px - larg / 2 - 1, py - alt - 1, larg + 2, 5);
    ctx.fillStyle = e.hp / e.hpMax > 0.4 ? '#ff7a3c' : '#e5332d';
    ctx.fillRect(px - larg / 2, py - alt, (larg * e.hp) / e.hpMax, 3);
  }
}

export function barraVida(ctx, x, y, frac, larg = 34) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(x - larg / 2 - 1, y - 1, larg + 2, 6);
  ctx.fillStyle = frac > 0.5 ? '#4cd964' : frac > 0.25 ? '#ffd23f' : '#e5332d';
  ctx.fillRect(x - larg / 2, y, larg * frac, 4);
}

export function raioZigue(ctx, x0, y0, x1, y1, partes = 6) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 1; i < partes; i++) {
    const f = i / partes;
    ctx.lineTo(x0 + (x1 - x0) * f + (Math.random() - 0.5) * 12, y0 + (y1 - y0) * f + (Math.random() - 0.5) * 12);
  }
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

/** Prévia de um prédio para a loja (canvas pequeno). */
export function previa(cv, id) {
  const ctx = cv.getContext('2d');
  const tam = PREDIOS[id].tam;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  const [cx, cy] = iso(tam / 2, tam / 2);
  const escala = (cv.width / dpr / (tam * TW + 20)) * (tam === 1 ? 0.65 : 1) * dpr;
  ctx.setTransform(escala, 0, 0, escala, cv.width / 2 - cx * escala, cv.height * 0.72 - cy * escala);
  desenharPredio(ctx, { id, x: 0, y: 0, nivel: 1, uid: 1 }, { t: 0.4, mira: 0.8, ativo: false, fantasma: true });
}

export { TH };
