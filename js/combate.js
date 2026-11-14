// Simulação da batalha. Não desenha nada: só calcula posições, tiros e danos em passos de tempo
// fixos. A mesma função roda ao vivo (com a tela mostrando) e "às cegas" quando o jogo estava
// fechado e precisa descobrir o que aconteceu nas ondas perdidas.

import { PREDIOS, INIMIGOS, N, BORDA, DURACAO_MAX_BATALHA } from './config.js';
import { vidaMax, danoNivel } from './economia.js';
import { aEstrela, distRet } from './caminho.js';
import { tile, ARVORE, ROCHA, idx } from './mapa.js';
import { gerarOnda, fatorVida } from './ondas.js';
import { sorteador, hashTexto } from './aleatorio.js';

const REPLANEJAR = 2.5; // segundos entre recálculos de caminho

export function criarBatalha(estado) {
  const n = estado.onda;
  const onda = gerarOnda(n, estado.semente);
  const predios = estado.predios
    .filter((p) => !p.ruina && p.nivel >= 1)
    .map((p) => {
      const def = PREDIOS[p.id];
      const hp = vidaMax(p.id, p.nivel);
      return {
        uid: p.uid, id: p.id, def, x: p.x, y: p.y, tam: def.tam, nivel: p.nivel,
        cx: p.x + def.tam / 2, cy: p.y + def.tam / 2,
        hp, hpMax: hp, morto: false, cd: 0.5, desligadoAte: 0, mira: Math.PI * 0.75,
      };
    });
  return {
    n, onda, mapa: estado.mapa, t: 0, predios,
    rnd: sorteador(hashTexto(`${estado.semente}|batalha|${n}`)),
    inimigos: [], projeteis: [], eventos: [],
    fila: onda.grupos.map((g) => ({ ...g })),
    proxId: 1, mortos: 0, total: onda.grupos.length,
    grade: null, sujo: true, fim: null,
  };
}

// ---------- utilidades ----------

function atualizarGrade(b) {
  if (!b.sujo) return;
  b.grade = new Array(N * N).fill(null);
  for (const p of b.predios) {
    if (p.morto) continue;
    for (let dy = 0; dy < p.tam; dy++) for (let dx = 0; dx < p.tam; dx++) b.grade[idx(p.x + dx, p.y + dy)] = p;
  }
  b.sujo = false;
  for (const e of b.inimigos) e.replanejar = 0;
}

const qg = (b) => b.predios.find((p) => p.id === 'qg');
const evento = (b, ev) => b.eventos.push(ev);
const distPredio = (e, p) => distRet(e.x, e.y, p.x, p.y, p.tam);

function danificar(b, p, dano) {
  if (p.morto) return;
  p.hp -= dano;
  if (p.hp <= 0) {
    p.hp = 0;
    p.morto = true;
    b.sujo = true;
    evento(b, { tipo: 'destruido', x: p.cx, y: p.cy, tam: p.tam, id: p.id });
    if (p.id === 'qg') b.fim = { venceu: false };
  }
}

function ferir(b, e, dano) {
  if (e.morto) return;
  e.hp -= dano;
  if (e.hp <= 0) {
    e.morto = true;
    b.mortos++;
    evento(b, { tipo: 'morte', x: e.x, y: e.y, inimigo: e.tipo, ar: e.ar });
  }
}

// ---------- nascimento ----------

function nascer(b, g) {
  const d = INIMIGOS[g.tipo];
  const ao = BORDA + g.pos * (N - 2 * BORDA);
  const fundo = 0.5 + b.rnd() * 0.8;
  const pos = {
    norte: [ao, fundo], sul: [ao, N - fundo], oeste: [fundo, ao], leste: [N - fundo, ao],
  }[g.lado];
  const vida = Math.round(d.hp * fatorVida(b.n));
  b.inimigos.push({
    id: b.proxId++, tipo: g.tipo, def: d, x: pos[0], y: pos[1], hp: vida, hpMax: vida,
    dano: d.dano * (1 + 0.04 * (b.n - 1)), ar: !!d.ar, cd: 0.5 + b.rnd(), alvo: null, bloqueio: null,
    caminho: null, passo: 0, replanejar: 0, morto: false, angulo: 0, andando: false,
  });
}

// ---------- escolha de alvo e caminho ----------

function escolherAlvo(b, e) {
  const vivos = b.predios.filter((p) => !p.morto && p.id !== 'armadilha');
  const pref = e.def.alvo;
  const filtro = {
    muro: (p) => p.id === 'muro',
    recurso: (p) => p.def.cat === 'recurso',
    defesa: (p) => p.def.cat === 'defesa' && p.id !== 'muro',
    qualquer: (p) => p.id !== 'muro',
  }[pref];
  let lista = vivos.filter(filtro);
  if (!lista.length) lista = vivos.filter((p) => p.id !== 'muro');
  if (!lista.length) lista = vivos;
  let melhor = null;
  let menor = Infinity;
  for (const p of lista) {
    const d = distPredio(e, p);
    if (d < menor) {
      menor = d;
      melhor = p;
    }
  }
  e.alvo = melhor;
  e.caminho = null;
  e.replanejar = 0;
}

function custoTile(b, e, x, y) {
  const t = tile(b.mapa, x, y);
  if (t === ROCHA) return Infinity;
  const p = b.grade[idx(x, y)];
  if (p && p !== e.alvo && p.id !== 'armadilha') return p.id === 'muro' ? 9 : 30; // dá pra passar quebrando
  if (t === ARVORE) return e.def.abreMata ? 1.1 : 2.2;
  return 1;
}

function planejar(b, e) {
  const a = e.alvo;
  const alcance = Math.max(e.def.alcance, 0.75);
  const sx = Math.min(N - 1, Math.max(0, Math.floor(e.x)));
  const sy = Math.min(N - 1, Math.max(0, Math.floor(e.y)));
  e.caminho = aEstrela({
    inicio: [sx, sy],
    objetivo: (x, y) => {
      const p = b.grade[idx(x, y)];
      if (p && p.id !== 'armadilha') return false;
      return distRet(x + 0.5, y + 0.5, a.x, a.y, a.tam) <= alcance;
    },
    custo: (x, y) => custoTile(b, e, x, y),
    heuristica: (x, y) => Math.max(0, distRet(x + 0.5, y + 0.5, a.x, a.y, a.tam) - alcance),
  }) ?? [];
  e.passo = 0;
  e.replanejar = REPLANEJAR;
}

// ---------- tropas ----------

function atacar(b, e, p) {
  e.angulo = Math.atan2(p.cy - e.y, p.cx - e.x);
  if (e.cd > 0) return;
  e.cd = e.def.cadencia;
  if (e.def.sabota && p.def.cat === 'defesa') {
    p.desligadoAte = b.t + e.def.sabota;
    evento(b, { tipo: 'sabotagem', x: p.cx, y: p.cy, de: [e.x, e.y] });
  }
  let dano = e.dano;
  if (p.id === 'muro' && e.def.bonusMuro) dano *= e.def.bonusMuro;
  danificar(b, p, dano);
  if (e.def.area) {
    for (const o of b.predios) {
      if (o !== p && !o.morto && distRet(p.cx, p.cy, o.x, o.y, o.tam) <= e.def.area) danificar(b, o, dano * 0.5);
    }
  }
  const estilo = e.tipo === 'bazuca' || e.tipo === 'helicoptero' ? 'foguete' : e.def.alcance > 1.5 ? 'bala' : 'corte';
  evento(b, { tipo: 'ataque', estilo, de: [e.x, e.y], para: [p.cx, p.cy], ar: e.ar, inimigo: e.tipo });
}

function moverInimigo(b, e, dt) {
  e.cd -= dt;
  if (!e.alvo || e.alvo.morto) escolherAlvo(b, e);
  if (!e.alvo) return;
  if (e.bloqueio?.morto) e.bloqueio = null;
  e.andando = false;

  if (e.bloqueio) return atacar(b, e, e.bloqueio);
  if (distPredio(e, e.alvo) <= e.def.alcance) return atacar(b, e, e.alvo);

  if (e.ar) {
    const ang = Math.atan2(e.alvo.cy - e.y, e.alvo.cx - e.x);
    e.x += Math.cos(ang) * e.def.vel * dt;
    e.y += Math.sin(ang) * e.def.vel * dt;
    e.angulo = ang;
    e.andando = true;
    return;
  }

  e.replanejar -= dt;
  if (!e.caminho || e.replanejar <= 0) planejar(b, e);
  const prox = e.caminho[e.passo];
  if (!prox) {
    // sem caminho: anda reto (acontece raramente, cercado por rochas)
    const ang = Math.atan2(e.alvo.cy - e.y, e.alvo.cx - e.x);
    e.x += Math.cos(ang) * e.def.vel * 0.5 * dt;
    e.y += Math.sin(ang) * e.def.vel * 0.5 * dt;
    return;
  }
  const [px, py] = prox;
  const noCaminho = b.grade[idx(px, py)];
  if (noCaminho && noCaminho !== e.alvo && noCaminho.id !== 'armadilha') {
    e.bloqueio = noCaminho; // muro ou prédio no meio: quebra
    return atacar(b, e, noCaminho);
  }
  const tx = px + 0.5;
  const ty = py + 0.5;
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy);
  const naMata = tile(b.mapa, Math.floor(e.x), Math.floor(e.y)) === ARVORE && !e.def.abreMata;
  const v = e.def.vel * (naMata ? 0.65 : 1) * dt;
  e.angulo = Math.atan2(dy, dx);
  e.andando = true;
  if (d <= v) {
    e.x = tx;
    e.y = ty;
    e.passo++;
  } else {
    e.x += (dx / d) * v;
    e.y += (dy / d) * v;
  }
}

// ---------- defesas ----------

function maisProximo(b, d, filtro) {
  let melhor = null;
  let menor = Infinity;
  for (const e of b.inimigos) {
    if (e.morto || !filtro(e)) continue;
    const dist = Math.hypot(e.x - d.cx, e.y - d.cy);
    if (dist < menor) {
      menor = dist;
      melhor = e;
    }
  }
  return melhor ? [melhor, menor] : [null, Infinity];
}

function atirar(b, d, dt) {
  const def = d.def;
  if (d.desligadoAte > b.t) return;
  d.cd -= dt;
  if (d.cd > 0) return;
  const alcance = def.alcance + d.tam / 2 - 0.5;
  const [alvo, dist] = maisProximo(b, d, (e) => (def.ar || !e.ar) && Math.hypot(e.x - d.cx, e.y - d.cy) >= (def.minimo ?? 0));
  if (!alvo || dist > alcance) return;
  d.cd = def.cadencia;
  d.mira = Math.atan2(alvo.y - d.cy, alvo.x - d.cx);
  const dano = danoNivel(d.id, d.nivel);

  if (d.id === 'atiradores') {
    ferir(b, alvo, dano);
    evento(b, { tipo: 'tiro', de: [d.cx, d.cy], para: [alvo.x, alvo.y], ar: alvo.ar });
  } else if (d.id === 'canhao') {
    b.projeteis.push({ tipo: 'bala', x: d.cx, y: d.cy, alvo, vel: 10, dano, de: [d.cx, d.cy] });
    evento(b, { tipo: 'disparo', de: [d.cx, d.cy], arma: 'canhao', mira: d.mira });
  } else if (d.id === 'morteiro') {
    const voo = 1.3;
    b.projeteis.push({
      tipo: 'granada', de: [d.cx, d.cy], para: [alvo.x, alvo.y], t: 0, voo, dano, area: def.area,
    });
    evento(b, { tipo: 'disparo', de: [d.cx, d.cy], arma: 'morteiro', mira: d.mira });
  } else if (d.id === 'tesla') {
    const atingidos = [alvo];
    let atual = alvo;
    for (let i = 1; i < def.saltos; i++) {
      let prox = null;
      let menor = 2.4;
      for (const e of b.inimigos) {
        if (e.morto || atingidos.includes(e)) continue;
        const dd = Math.hypot(e.x - atual.x, e.y - atual.y);
        if (dd < menor) {
          menor = dd;
          prox = e;
        }
      }
      if (!prox) break;
      atingidos.push(prox);
      atual = prox;
    }
    const pontos = [[d.cx, d.cy], ...atingidos.map((e) => [e.x, e.y])];
    atingidos.forEach((e, i) => ferir(b, e, dano * 0.75 ** i));
    evento(b, { tipo: 'raio', pontos, ar: atingidos.map((e) => e.ar) });
  }
}

function moverProjeteis(b, dt) {
  for (const pr of b.projeteis) {
    if (pr.tipo === 'bala') {
      if (pr.alvo.morto) { pr.fim = true; continue; }
      const dx = pr.alvo.x - pr.x;
      const dy = pr.alvo.y - pr.y;
      const d = Math.hypot(dx, dy);
      const v = pr.vel * dt;
      if (d <= v) {
        ferir(b, pr.alvo, pr.dano);
        evento(b, { tipo: 'impacto', x: pr.alvo.x, y: pr.alvo.y, forte: true });
        pr.fim = true;
      } else {
        pr.x += (dx / d) * v;
        pr.y += (dy / d) * v;
      }
    } else if (pr.tipo === 'granada') {
      pr.t += dt;
      if (pr.t >= pr.voo) {
        const [x, y] = pr.para;
        for (const e of b.inimigos) {
          if (!e.morto && !e.ar && Math.hypot(e.x - x, e.y - y) <= pr.area) ferir(b, e, pr.dano);
        }
        evento(b, { tipo: 'explosao', x, y, raio: pr.area });
        pr.fim = true;
      }
    }
  }
  b.projeteis = b.projeteis.filter((p) => !p.fim);
}

function armadilhas(b) {
  for (const a of b.predios) {
    if (a.morto || a.id !== 'armadilha') continue;
    const pisou = b.inimigos.some((e) => !e.morto && !e.ar && Math.hypot(e.x - a.cx, e.y - a.cy) < 0.6);
    if (!pisou) continue;
    const dano = danoNivel('armadilha', a.nivel);
    for (const e of b.inimigos) {
      if (!e.morto && !e.ar && Math.hypot(e.x - a.cx, e.y - a.cy) <= a.def.area) ferir(b, e, dano);
    }
    a.morto = true;
    a.hp = 0;
    b.sujo = true;
    evento(b, { tipo: 'explosao', x: a.cx, y: a.cy, raio: a.def.area, mina: true });
  }
}

// ---------- passo ----------

export function passo(b, dt) {
  if (b.fim) return;
  b.t += dt;
  while (b.fila.length && b.fila[0].t <= b.t) nascer(b, b.fila.shift());
  atualizarGrade(b);
  for (const e of b.inimigos) if (!e.morto) moverInimigo(b, e, dt);
  armadilhas(b);
  for (const d of b.predios) if (!d.morto && d.def.cat === 'defesa' && d.def.dano && d.id !== 'armadilha') atirar(b, d, dt);
  moverProjeteis(b, dt);
  b.inimigos = b.inimigos.filter((e) => !e.morto);

  if (b.fim) return;
  const vivos = b.inimigos.length;
  if (!b.fila.length && vivos === 0) b.fim = { venceu: true };
  else if (b.t >= DURACAO_MAX_BATALHA) b.fim = { venceu: true, recuaram: vivos };
}

export function resultado(b) {
  const q = qg(b);
  return {
    onda: b.n,
    venceu: !q?.morto,
    destruidos: b.predios.filter((p) => p.morto).map((p) => p.uid),
    mortos: b.mortos,
    total: b.total,
    duracao: Math.round(b.t),
    recuaram: b.fim?.recuaram ?? 0,
  };
}

/** Roda a batalha inteira sem desenhar (ondas que aconteceram com o jogo fechado). */
export function simular(estado, dt = 1 / 20) {
  const b = criarBatalha(estado);
  while (!b.fim) {
    passo(b, dt);
    b.eventos.length = 0;
  }
  return resultado(b);
}
