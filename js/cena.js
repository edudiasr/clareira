// A cena: câmera (arrastar e zoom), terreno em cache, ordem de desenho e efeitos da batalha.

import { N, PREDIOS } from './config.js';
import { iso, deIso, losango, LARGURA_MUNDO, ALTURA_MUNDO, TW } from './desenho.js';
import { desenharTerreno, desenharPredio, desenharInimigo, barraVida, raioZigue, seloNivel, soldado } from './sprites.js';
import { CENTRO } from './config.js';

const DURACAO = { tiro: 0.09, raio: 0.16, explosao: 0.7, flash: 0.12, impacto: 0.35, foguete: 0.35, sabotagem: 0.6, corte: 0.2 };

export class Cena {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.terreno = document.createElement('canvas');
    this.mapaDesenhado = null;
    const [cx, cy] = iso(CENTRO, CENTRO);
    this.cam = { x: cx, y: cy - 30, zoom: 1 };
    this.efeitos = [];
    this.particulas = [];
    this.marcas = [];
    this.textos = [];
    this.folhas = Array.from({ length: 14 }, () => this.novaFolha(true));
    this.recuo = new Map();
    this.redimensionar();
  }

  redimensionar() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.larg = this.cv.clientWidth;
    this.alt = this.cv.clientHeight;
    this.cv.width = Math.round(this.larg * dpr);
    this.cv.height = Math.round(this.alt * dpr);
    this.limitarCamera();
  }

  // ---------- câmera ----------

  zoomMin() {
    return Math.max(0.35, Math.min(this.larg / (LARGURA_MUNDO * 0.8), this.alt / (ALTURA_MUNDO * 0.8)));
  }

  limitarCamera() {
    this.cam.zoom = Math.min(2.2, Math.max(this.zoomMin(), this.cam.zoom));
    this.cam.x = Math.min(LARGURA_MUNDO, Math.max(0, this.cam.x));
    this.cam.y = Math.min(ALTURA_MUNDO, Math.max(0, this.cam.y));
  }

  telaParaMundo(sx, sy) {
    return [(sx - this.larg / 2) / this.cam.zoom + this.cam.x, (sy - this.alt / 2) / this.cam.zoom + this.cam.y];
  }

  mundoParaTela(wx, wy) {
    return [(wx - this.cam.x) * this.cam.zoom + this.larg / 2, (wy - this.cam.y) * this.cam.zoom + this.alt / 2];
  }

  telaParaTile(sx, sy) {
    return deIso(...this.telaParaMundo(sx, sy));
  }

  arrastar(dx, dy) {
    this.cam.x -= dx / this.cam.zoom;
    this.cam.y -= dy / this.cam.zoom;
    this.limitarCamera();
  }

  zoomEm(sx, sy, fator) {
    const [wx, wy] = this.telaParaMundo(sx, sy);
    this.cam.zoom *= fator;
    this.limitarCamera();
    const [nx, ny] = this.telaParaMundo(sx, sy);
    this.cam.x += wx - nx;
    this.cam.y += wy - ny;
    this.limitarCamera();
  }

  centralizar(x, y) {
    const [wx, wy] = iso(x, y);
    this.cam.x = wx;
    this.cam.y = wy - 20;
    this.limitarCamera();
  }

  // ---------- terreno ----------

  atualizarTerreno(estado) {
    if (estado.mapa === this.mapaDesenhado) return;
    const escala = Math.min(1.5, this.dpr * 0.9 + 0.2);
    this.terreno.width = Math.round(LARGURA_MUNDO * escala);
    this.terreno.height = Math.round(ALTURA_MUNDO * escala);
    desenharTerreno(this.terreno, estado.mapa, estado.semente);
    this.mapaDesenhado = estado.mapa;
  }

  // ---------- efeitos ----------

  novaFolha(espalhar = false) {
    return {
      x: Math.random() * LARGURA_MUNDO,
      y: espalhar ? Math.random() * ALTURA_MUNDO : -20,
      vx: 8 + Math.random() * 14,
      vy: 14 + Math.random() * 12,
      giro: Math.random() * 6,
      cor: Math.random() < 0.5 ? '#c98a2e' : '#7aa83a',
    };
  }

  efeito(tipo, dados) {
    this.efeitos.push({ tipo, t: 0, dur: DURACAO[tipo] ?? 0.4, ...dados });
  }

  estilhacos(x, y, qtd, cores, forca = 60, z = 0) {
    for (let i = 0; i < qtd; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = forca * (0.3 + Math.random());
      this.particulas.push({
        x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5, vz: 40 + Math.random() * forca,
        vida: 0.6 + Math.random() * 0.6, idade: 0, cor: cores[i % cores.length], tam: 1.5 + Math.random() * 2.5,
      });
    }
  }

  fumaca(x, y, qtd = 4, z = 10) {
    for (let i = 0; i < qtd; i++) {
      this.particulas.push({
        x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 6, z, vx: (Math.random() - 0.5) * 8, vy: 0,
        vz: 18 + Math.random() * 12, vida: 1 + Math.random(), idade: 0, cor: 'fumaca', tam: 5 + Math.random() * 5, semGravidade: true,
      });
    }
  }

  texto(x, y, txt, cor = '#ffd23f') {
    this.textos.push({ x, y, txt, cor, idade: 0 });
  }

  /** Transforma os eventos da batalha em efeitos visuais. `som` recebe o nome do som a tocar. */
  consumirEventos(b, som) {
    for (const ev of b.eventos) {
      const P = (x, y) => iso(x, y);
      switch (ev.tipo) {
        case 'tiro': {
          const [ax, ay] = P(...ev.de);
          const [bx, by] = P(...ev.para);
          this.efeito('tiro', { ax, ay: ay - 52, bx, by: by - (ev.ar ? 50 : 12) });
          som?.('tiro');
          break;
        }
        case 'disparo': {
          const [x, y] = P(...ev.de);
          this.efeito('flash', { x, y: y - 22, grande: ev.arma === 'canhao' });
          this.fumaca(x, y, 3, 20);
          if (ev.arma === 'canhao') this.recuo.set(`${ev.de}`, 0.2);
          som?.(ev.arma);
          break;
        }
        case 'impacto': {
          const [x, y] = P(ev.x, ev.y);
          this.efeito('impacto', { x, y: y - 8 });
          this.estilhacos(x, y, 6, ['#ffcf6b', '#8a6a4a']);
          break;
        }
        case 'explosao': {
          const [x, y] = P(ev.x, ev.y);
          this.efeito('explosao', { x, y, r: ev.raio * TW * 0.6 });
          this.estilhacos(x, y, 14, ['#ffb03b', '#ff6a2b', '#5a4632', '#333']);
          this.fumaca(x, y, 6, 4);
          this.marcas.push({ x, y, r: ev.raio * TW * 0.45, vida: 12 });
          som?.('explosao');
          break;
        }
        case 'raio': {
          const pts = ev.pontos.map(([x, y], i) => {
            const [px, py] = P(x, y);
            return [px, py - (i === 0 ? 60 : ev.ar[i - 1] ? 50 : 12)];
          });
          this.efeito('raio', { pts });
          som?.('raio');
          break;
        }
        case 'ataque': {
          const [ax, ay] = P(...ev.de);
          const [bx, by] = P(...ev.para);
          const altA = ev.ar ? 48 : 12;
          if (ev.estilo === 'foguete') {
            this.efeito('foguete', { ax, ay: ay - altA, bx, by: by - 14 });
            som?.('foguete');
          } else if (ev.estilo === 'bala') {
            this.efeito('tiro', { ax, ay: ay - altA, bx, by: by - 14, inimigo: true });
          } else {
            this.efeito('corte', { x: bx, y: by - 10 });
            this.estilhacos(bx, by, 3, ['#ffe08a', '#bbb'], 30, 10);
          }
          break;
        }
        case 'sabotagem': {
          const [x, y] = P(ev.x, ev.y);
          this.efeito('sabotagem', { x, y: y - 30 });
          som?.('sabotagem');
          break;
        }
        case 'destruido': {
          const [x, y] = P(ev.x, ev.y);
          this.efeito('explosao', { x, y: y - 10, r: ev.tam * 26 });
          this.estilhacos(x, y, 24, ['#8a6a4a', '#9aa0a6', '#ffb03b', '#5a3d24'], 90, 10);
          this.fumaca(x, y, 10, 10);
          som?.('destruido');
          break;
        }
        case 'morte': {
          const [x, y] = P(ev.x, ev.y);
          this.estilhacos(x, y - (ev.ar ? 48 : 0), ev.ar ? 20 : 6, ev.ar ? ['#3d454d', '#ff6a2b', '#ffb03b'] : ['#f28c28', '#ffd23f'], ev.ar ? 80 : 40, ev.ar ? 48 : 8);
          if (ev.ar) {
            this.efeito('explosao', { x, y: y - 48, r: 30 });
            som?.('explosao');
          }
          break;
        }
        default:
      }
    }
    b.eventos.length = 0;
  }

  // ---------- desenho ----------

  /**
   * o = { estado, batalha, selecao, fantasma:{id,x,y,ok}, corte:[[x,y]], ladosAlerta, t, dt, agora, inimigosVisiveis }
   */
  desenhar(o) {
    const { ctx } = this;
    const { estado, batalha, t, dt } = o;
    this.atualizarTerreno(estado);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0c1d11';
    ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    const z = this.cam.zoom * this.dpr;
    ctx.setTransform(z, 0, 0, z, (this.larg / 2 - this.cam.x * this.cam.zoom) * this.dpr, (this.alt / 2 - this.cam.y * this.cam.zoom) * this.dpr);
    ctx.drawImage(this.terreno, 0, 0, LARGURA_MUNDO, ALTURA_MUNDO);

    // marcas de explosão no chão
    for (const m of this.marcas) {
      m.vida -= dt;
      ctx.fillStyle = `rgba(30,22,14,${Math.min(0.45, m.vida / 12)})`;
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, m.r, m.r / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    this.marcas = this.marcas.filter((m) => m.vida > 0);

    this.desenharAlertas(o);
    this.desenharGuias(o);

    // objetos ordenados por profundidade
    const vivos = batalha ? new Map(batalha.predios.map((p) => [p.uid, p])) : null;
    const muros = new Set(estado.predios.filter((p) => p.id === 'muro' && !p.ruina).map((p) => `${p.x},${p.y}`));
    const lista = [];
    for (const p of estado.predios) {
      if (p.id === 'armadilha' && batalha) {
        const bp = vivos.get(p.uid);
        if (!bp || bp.morto) continue;
      }
      const tam = PREDIOS[p.id].tam;
      lista.push({ prof: p.x + p.y + tam, tipo: 'predio', p });
    }
    if (batalha) for (const e of batalha.inimigos) lista.push({ prof: e.x + e.y + (e.ar ? 3 : 0), tipo: 'inimigo', e });
    for (const tr of estado.trabalhos) lista.push({ prof: tr.tiles[0][0] + tr.tiles[0][1] + 1, tipo: 'trabalho', tr });
    if (o.fantasma) lista.push({ prof: o.fantasma.x + o.fantasma.y + PREDIOS[o.fantasma.id].tam, tipo: 'fantasma', f: o.fantasma });
    lista.sort((a, b) => a.prof - b.prof);

    const barras = [];
    for (const it of lista) {
      if (it.tipo === 'predio') {
        const p = it.p;
        if (o.fantasma?.mover === p.uid) continue;
        const bp = vivos?.get(p.uid);
        const def = PREDIOS[p.id];
        const recuoK = bp ? `${[bp.cx, bp.cy]}` : null;
        let recuo = 0;
        if (recuoK && this.recuo.has(recuoK)) {
          recuo = this.recuo.get(recuoK) * 30;
          const v = this.recuo.get(recuoK) - dt;
          if (v <= 0) this.recuo.delete(recuoK);
          else this.recuo.set(recuoK, v);
        }
        const progresso = p.obra ? Math.min(1, (o.agora - p.obra.inicio) / (p.obra.fim - p.obra.inicio)) : 0;
        const altura = desenharPredio(ctx, p, {
          t,
          mira: bp?.mira,
          recuo,
          ativo: !p.obra && !p.ruina && !batalha,
          progresso,
          ruina: p.ruina || bp?.morto,
          desligado: bp && bp.desligadoAte > batalha.t,
          vizinhosMuro: p.id === 'muro' ? { direita: muros.has(`${p.x + 1},${p.y}`), baixo: muros.has(`${p.x},${p.y + 1}`) } : null,
        });
        const [cx, cy] = iso(p.x + def.tam / 2, p.y + def.tam / 2);
        if (bp && !bp.morto && bp.hp < bp.hpMax) barras.push([cx, cy - altura - 6, bp.hp / bp.hpMax, def.tam >= 2 ? 36 : 20]);
        if (p.obra && p.nivel > 0) this.andaimeMelhoria(ctx, p, t);
        if (p.obra) barras.push([cx, cy - altura - 10, progresso, 40, '#ffd23f']);
        if (bp && bp.desligadoAte > batalha.t && Math.random() < 0.3) this.estilhacos(cx, cy - altura * 0.6, 1, ['#7fe3ff'], 20, 0);
        if (o.selecao?.uid === p.uid && !batalha) seloNivel(ctx, p, altura);
      } else if (it.tipo === 'inimigo') {
        desenharInimigo(ctx, it.e, t);
      } else if (it.tipo === 'trabalho') {
        this.desenharTrabalho(ctx, it.tr, t, o.agora);
      } else if (it.tipo === 'fantasma') {
        const f = it.f;
        ctx.globalAlpha = 0.75;
        desenharPredio(ctx, { id: f.id, x: f.x, y: f.y, nivel: f.nivel ?? 1, uid: 0 }, { t, fantasma: true, mira: 0.8 });
        ctx.globalAlpha = 1;
      }
    }
    for (const [x, y, f, l, cor] of barras) {
      if (cor) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x - l / 2 - 1, y - 1, l + 2, 6);
        ctx.fillStyle = cor;
        ctx.fillRect(x - l / 2, y, l * f, 4);
      } else barraVida(ctx, x, y, f, l);
    }

    if (batalha) this.desenharProjeteis(ctx, batalha);
    this.desenharEfeitos(ctx, dt);
    this.desenharParticulas(ctx, dt);
    this.desenharTextos(ctx, dt);
    this.desenharFolhas(ctx, dt);
  }

  andaimeMelhoria(ctx, p, t) {
    const tam = PREDIOS[p.id].tam;
    ctx.strokeStyle = 'rgba(139,94,52,0.9)';
    ctx.lineWidth = 2;
    for (const [dx, dy] of [[0.05, tam - 0.05], [tam - 0.05, tam - 0.05], [tam - 0.05, 0.05]]) {
      const [x, y] = iso(p.x + dx, p.y + dy);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 30);
      ctx.stroke();
    }
    const [hx, hy] = iso(p.x + tam, p.y + tam);
    soldado(ctx, hx - 6, hy - 2, '#3c8d4e', '#2d5e38', 0.7, -0.7, t * 2, true, 0.8);
  }

  desenharTrabalho(ctx, tr, t, agora) {
    const prog = Math.min(1, (agora - tr.inicio) / (tr.fim - tr.inicio));
    for (const [x, y] of tr.tiles.slice(0, 3)) {
      const [px, py] = iso(x + 0.5, y + 0.9);
      soldado(ctx, px, py, '#3c8d4e', '#2d5e38', -0.7, -0.6, t * 1.4 + x, false, 0.85, tr.tipo === 'corte' ? 'serra' : 'fuzil');
      if (Math.random() < 0.15) this.estilhacos(px - 6, py - 10, 1, tr.tipo === 'corte' ? ['#d8b07a'] : ['#aaa'], 25, 6);
    }
    const [cx, cy] = iso(tr.tiles[0][0] + 0.5, tr.tiles[0][1] + 0.5);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(cx - 21, cy - 66, 42, 6);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(cx - 20, cy - 65, 40 * prog, 4);
  }

  desenharAlertas(o) {
    if (!o.ladosAlerta?.length) return;
    const { ctx } = this;
    const pulso = 0.25 + Math.sin(o.t * 5) * 0.12;
    for (const lado of o.ladosAlerta) {
      const faixa = {
        norte: [[0, 0], [N, 0], [N, 2.5], [0, 2.5]],
        sul: [[0, N - 2.5], [N, N - 2.5], [N, N], [0, N]],
        oeste: [[0, 0], [2.5, 0], [2.5, N], [0, N]],
        leste: [[N - 2.5, 0], [N, 0], [N, N], [N - 2.5, N]],
      }[lado];
      ctx.beginPath();
      faixa.forEach(([x, y], i) => (i ? ctx.lineTo(...iso(x, y)) : ctx.moveTo(...iso(x, y))));
      ctx.closePath();
      ctx.fillStyle = `rgba(229,51,45,${pulso})`;
      ctx.fill();
    }
  }

  desenharGuias(o) {
    const { ctx } = this;
    // área de corte
    if (o.corte?.length) {
      for (const [x, y] of o.corte) {
        losango(ctx, x, y);
        ctx.fillStyle = 'rgba(255,210,63,0.35)';
        ctx.fill();
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    // alcance da defesa selecionada ou do fantasma
    const alvo = o.fantasma ?? o.selecao;
    const def = alvo && PREDIOS[alvo.id];
    if (def?.alcance) {
      const [cx, cy] = iso(alvo.x + def.tam / 2, alvo.y + def.tam / 2);
      const r = (def.alcance + def.tam / 2 - 0.5) * TW * 0.707;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (def.minimo) {
        const rm = def.minimo * TW * 0.707;
        ctx.strokeStyle = 'rgba(229,83,61,0.7)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, rm, rm / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    // contorno da seleção
    if (o.selecao && !o.fantasma) {
      const tam = o.selecao.tam ?? PREDIOS[o.selecao.id]?.tam ?? 1;
      losango(ctx, o.selecao.x, o.selecao.y, tam);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    // pegada do fantasma
    if (o.fantasma) {
      const tam = PREDIOS[o.fantasma.id].tam;
      losango(ctx, o.fantasma.x, o.fantasma.y, tam);
      ctx.fillStyle = o.fantasma.ok ? 'rgba(76,217,100,0.35)' : 'rgba(229,51,45,0.4)';
      ctx.fill();
      ctx.strokeStyle = o.fantasma.ok ? '#4cd964' : '#e5332d';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  desenharProjeteis(ctx, b) {
    for (const pr of b.projeteis) {
      if (pr.tipo === 'bala') {
        const [x, y] = iso(pr.x, pr.y);
        ctx.fillStyle = '#1b1b1b';
        ctx.beginPath();
        ctx.arc(x, y - 16, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (pr.tipo === 'granada') {
        const f = pr.t / pr.voo;
        const [ax, ay] = iso(...pr.de);
        const [bx, by] = iso(...pr.para);
        const x = ax + (bx - ax) * f;
        const y = ay + (by - ay) * f - Math.sin(f * Math.PI) * 140 - 24 * (1 - f);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(ax + (bx - ax) * f, ay + (by - ay) * f, 5, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2b2b2b';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        if (Math.random() < 0.5) this.particulas.push({ x, y: y + 0, z: 0, vx: 0, vy: 0, vz: 0, vida: 0.5, idade: 0, cor: 'fumaca', tam: 3, semGravidade: true });
      }
    }
  }

  desenharEfeitos(ctx, dt) {
    for (const ef of this.efeitos) {
      ef.t += dt;
      const f = Math.min(1, ef.t / ef.dur);
      switch (ef.tipo) {
        case 'tiro':
          ctx.strokeStyle = ef.inimigo ? `rgba(255,170,90,${1 - f})` : `rgba(255,240,170,${1 - f})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ef.ax, ef.ay);
          ctx.lineTo(ef.bx, ef.by);
          ctx.stroke();
          break;
        case 'flash':
          ctx.fillStyle = `rgba(255,220,120,${1 - f})`;
          ctx.beginPath();
          ctx.arc(ef.x, ef.y, (ef.grande ? 14 : 8) * (1 + f), 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'impacto':
          ctx.strokeStyle = `rgba(255,200,120,${1 - f})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(ef.x, ef.y, 6 + f * 14, 3 + f * 7, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'explosao': {
          const r = ef.r * (0.4 + f * 0.8);
          const g = ctx.createRadialGradient(ef.x, ef.y - r * 0.3, 1, ef.x, ef.y - r * 0.3, r);
          g.addColorStop(0, `rgba(255,250,200,${1 - f})`);
          g.addColorStop(0.4, `rgba(255,150,40,${0.9 * (1 - f)})`);
          g.addColorStop(1, 'rgba(120,40,10,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(ef.x, ef.y - r * 0.3, r, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'raio':
          ctx.lineWidth = 4;
          ctx.strokeStyle = `rgba(120,220,255,${0.5 * (1 - f)})`;
          for (let i = 1; i < ef.pts.length; i++) raioZigue(ctx, ...ef.pts[i - 1], ...ef.pts[i], 6);
          ctx.lineWidth = 1.6;
          ctx.strokeStyle = `rgba(235,252,255,${1 - f})`;
          for (let i = 1; i < ef.pts.length; i++) raioZigue(ctx, ...ef.pts[i - 1], ...ef.pts[i], 6);
          break;
        case 'foguete': {
          const x = ef.ax + (ef.bx - ef.ax) * f;
          const y = ef.ay + (ef.by - ef.ay) * f - Math.sin(f * Math.PI) * 20;
          ctx.fillStyle = '#ff8a3a';
          ctx.beginPath();
          ctx.arc(x, y, 3.5, 0, Math.PI * 2);
          ctx.fill();
          this.particulas.push({ x, y, z: 0, vx: 0, vy: 0, vz: 4, vida: 0.4, idade: 0, cor: 'fumaca', tam: 3, semGravidade: true });
          if (ef.t + dt >= ef.dur) {
            this.efeitos.push({ tipo: 'explosao', t: 0, dur: 0.45, x: ef.bx, y: ef.by + 10, r: 18 });
            this.estilhacos(ef.bx, ef.by + 10, 6, ['#ffb03b', '#555'], 50, 8);
          }
          break;
        }
        case 'corte':
          ctx.strokeStyle = `rgba(255,240,180,${1 - f})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(ef.x, ef.y, 6 + f * 6, -1, 1);
          ctx.stroke();
          break;
        case 'sabotagem':
          ctx.strokeStyle = `rgba(127,227,255,${1 - f})`;
          ctx.lineWidth = 2;
          for (let i = 0; i < 3; i++) raioZigue(ctx, ef.x, ef.y, ef.x + (Math.random() - 0.5) * 30, ef.y + (Math.random() - 0.5) * 20, 3);
          break;
        default:
      }
    }
    this.efeitos = this.efeitos.filter((e) => e.t < e.dur);
  }

  desenharParticulas(ctx, dt) {
    for (const p of this.particulas) {
      p.idade += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (!p.semGravidade) {
        p.vz -= 260 * dt;
        p.z = Math.max(0, p.z + p.vz * dt);
        if (p.z === 0) {
          p.vx *= 0.8;
          p.vy *= 0.8;
        }
      } else {
        p.z += p.vz * dt;
      }
      const vida = 1 - p.idade / p.vida;
      if (p.cor === 'fumaca') {
        ctx.fillStyle = `rgba(90,90,90,${0.35 * vida})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y - p.z, p.tam * (1.6 - vida * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = Math.max(0, vida);
        ctx.fillStyle = p.cor;
        ctx.fillRect(p.x - p.tam / 2, p.y - p.z - p.tam / 2, p.tam, p.tam);
        ctx.globalAlpha = 1;
      }
    }
    this.particulas = this.particulas.filter((p) => p.idade < p.vida);
    if (this.particulas.length > 700) this.particulas.splice(0, this.particulas.length - 700);
  }

  desenharTextos(ctx, dt) {
    ctx.textAlign = 'center';
    ctx.font = '900 15px Nunito, sans-serif';
    for (const tx of this.textos) {
      tx.idade += dt;
      const a = Math.max(0, 1 - tx.idade / 1.6);
      ctx.globalAlpha = a;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(tx.txt, tx.x, tx.y - tx.idade * 30);
      ctx.fillStyle = tx.cor;
      ctx.fillText(tx.txt, tx.x, tx.y - tx.idade * 30);
    }
    ctx.globalAlpha = 1;
    this.textos = this.textos.filter((t) => t.idade < 1.6);
  }

  desenharFolhas(ctx, dt) {
    for (const f of this.folhas) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.giro += dt * 3;
      if (f.y > ALTURA_MUNDO + 20 || f.x > LARGURA_MUNDO + 20) Object.assign(f, this.novaFolha());
      ctx.save();
      ctx.translate(f.x + Math.sin(f.giro) * 10, f.y);
      ctx.rotate(f.giro);
      ctx.fillStyle = f.cor;
      ctx.beginPath();
      ctx.ellipse(0, 0, 4, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
