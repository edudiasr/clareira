// Estado do jogo e todas as ações do jogador (construir, melhorar, derrubar mata, reparar...).
// Tudo usa o horário real (timestamps), então obras e produção continuam com o jogo fechado.

import {
  PREDIOS, INICIO, INTERVALO_ONDA, MAX_ONDAS_OFFLINE, PERDA_SE_QG_CAIR, CORTE, ROCHA as CFG_ROCHA,
  RECURSOS, raioClareira,
} from './config.js';
import * as E from './economia.js';
import { gerarMapa, motivoNaoPode, arvoresDoCorte, trocar, tile, distCentro, GRAMA, ROCHA, ARVORE, dentro } from './mapa.js';
import { simular } from './combate.js';

export const VERSAO = 1;
const falha = (erro) => ({ ok: false, erro });

export function novoJogo(semente = (Math.random() * 2 ** 32) >>> 0, agora = Date.now()) {
  const iniciais = [
    { id: 'qg', x: 16, y: 16 },
    { id: 'serraria', x: 12, y: 16 },
  ];
  let mapa = gerarMapa(semente);
  // garante chão limpo embaixo do que já começa construído
  const limpar = [];
  for (const p of iniciais) {
    const t = PREDIOS[p.id].tam;
    for (let dy = 0; dy < t; dy++) for (let dx = 0; dx < t; dx++) limpar.push([p.x + dx, p.y + dy, GRAMA]);
  }
  mapa = trocar(mapa, limpar);
  return {
    versao: VERSAO,
    semente,
    mapa,
    predios: iniciais.map((p, i) => ({ uid: i + 1, ...p, nivel: 1, obra: null, ruina: false })),
    trabalhos: [],
    recursos: { ...INICIO },
    onda: 1,
    proximaOnda: agora + INTERVALO_ONDA,
    antecipada: false,
    recorde: 0,
    historico: [],
    objetivos: [],
    stats: { mortos: 0, ondasVencidas: 0, arvores: 0 },
    proxUid: iniciais.length + 1,
    ultimoTick: agora,
  };
}

// ---------- passagem do tempo ----------

function produzir(estado, ms) {
  if (ms <= 0) return;
  const total = E.producaoTotal(estado);
  const ganho = Object.fromEntries(Object.entries(total).map(([r, v]) => [r, (v * ms) / 60000]));
  E.receber(estado, ganho);
}

/** Avança o relógio do jogo até `agora`: produz recursos e termina obras no momento certo. */
export function atualizar(estado, agora) {
  const concluidos = [];
  for (;;) {
    // próxima obra ou trabalho a terminar
    let prox = null;
    for (const p of estado.predios) if (p.obra && p.obra.fim <= agora && (!prox || p.obra.fim < prox.fim)) prox = { fim: p.obra.fim, p };
    for (const t of estado.trabalhos) if (t.fim <= agora && (!prox || t.fim < prox.fim)) prox = { fim: t.fim, t };
    if (!prox) break;
    produzir(estado, prox.fim - estado.ultimoTick);
    estado.ultimoTick = Math.max(estado.ultimoTick, prox.fim);
    if (prox.p) {
      prox.p.nivel = prox.p.obra.para;
      prox.p.obra = null;
      concluidos.push({ tipo: 'obra', uid: prox.p.uid, id: prox.p.id, nivel: prox.p.nivel });
    } else {
      const t = prox.t;
      estado.trabalhos = estado.trabalhos.filter((x) => x !== t);
      estado.mapa = trocar(estado.mapa, t.tiles.map(([x, y]) => [x, y, GRAMA]));
      const entrou = E.receber(estado, t.ganho);
      if (t.tipo === 'corte') estado.stats.arvores += t.tiles.length;
      concluidos.push({ tipo: t.tipo, tiles: t.tiles, ganho: entrou });
    }
  }
  produzir(estado, agora - estado.ultimoTick);
  estado.ultimoTick = Math.max(estado.ultimoTick, agora);
  return concluidos;
}

// ---------- ações ----------

const qgEmRuinas = (estado) => estado.predios.find((p) => p.id === 'qg')?.ruina;
const contar = (estado, id) => estado.predios.filter((p) => p.id === id).length;

/** Diz se dá pra construir e, se não, por quê (para a loja mostrar). */
export function podeConstruir(estado, id) {
  const qg = E.qgNivel(estado);
  if (qgEmRuinas(estado)) return 'Repare o QG primeiro';
  const lim = E.limite(id, qg);
  if (lim === 0) {
    const precisa = PREDIOS[id].limite.findIndex((v) => v > 0) + 1;
    return `Libera no QG ${precisa}`;
  }
  if (contar(estado, id) >= lim) return `Máximo ${lim} no QG ${qg}`;
  if (PREDIOS[id].tempo > 0 && !E.temConstrutorLivre(estado)) return 'Construtores ocupados';
  if (!E.podePagar(estado.recursos, E.custo(id, 1))) return 'Recursos insuficientes';
  return null;
}

export function construir(estado, id, x, y, agora) {
  const motivo = podeConstruir(estado, id) ?? motivoNaoPode(estado.mapa, estado.predios, id, x, y);
  if (motivo) return falha(motivo);
  E.pagar(estado.recursos, E.custo(id, 1));
  const tempo = E.tempoObra(id, 1);
  const p = {
    uid: estado.proxUid++, id, x, y, nivel: tempo ? 0 : 1, ruina: false,
    obra: tempo ? { inicio: agora, fim: agora + tempo * 1000, para: 1 } : null,
  };
  estado.predios.push(p);
  return { ok: true, predio: p };
}

export function podeMelhorar(estado, p) {
  if (p.obra) return 'Já está em obra';
  if (p.ruina) return 'Repare antes de melhorar';
  if (p.id !== 'qg' && qgEmRuinas(estado)) return 'Repare o QG primeiro';
  const max = E.nivelMax(p.id, E.qgNivel(estado));
  if (p.nivel >= (PREDIOS[p.id].maxNivel ?? 8)) return 'Nível máximo';
  if (p.nivel >= max) return `Suba o QG para o nível ${p.nivel + 1}`;
  if (E.tempoObra(p.id, p.nivel + 1) > 0 && !E.temConstrutorLivre(estado)) return 'Construtores ocupados';
  if (!E.podePagar(estado.recursos, E.custo(p.id, p.nivel + 1))) return 'Recursos insuficientes';
  return null;
}

export function melhorar(estado, uid, agora) {
  const p = estado.predios.find((x) => x.uid === uid);
  if (!p) return falha('Construção não encontrada');
  const motivo = podeMelhorar(estado, p);
  if (motivo) return falha(motivo);
  const para = p.nivel + 1;
  E.pagar(estado.recursos, E.custo(p.id, para));
  const tempo = E.tempoObra(p.id, para);
  if (tempo) p.obra = { inicio: agora, fim: agora + tempo * 1000, para };
  else p.nivel = para;
  return { ok: true };
}

export function mover(estado, uid, x, y) {
  const p = estado.predios.find((q) => q.uid === uid);
  if (!p) return falha('Construção não encontrada');
  const motivo = motivoNaoPode(estado.mapa, estado.predios, p.id, x, y, uid);
  if (motivo) return falha(motivo);
  p.x = x;
  p.y = y;
  return { ok: true };
}

export function infoCorte(estado, x, y) {
  const qg = E.qgNivel(estado);
  if (tile(estado.mapa, x, y) !== ARVORE) return null;
  const { lista, encostaNaClareira } = arvoresDoCorte(estado.mapa, x, y, qg);
  const ocupado = estado.trabalhos.some((t) => t.tiles.some(([a, b]) => lista.some(([c, d]) => a === c && b === d)));
  let motivo = null;
  if (distCentro(x, y) > raioClareira(qg) || !lista.length) motivo = `Suba o QG para abrir mais mata`;
  else if (!encostaNaClareira) motivo = 'Comece pela mata encostada na clareira';
  else if (ocupado) motivo = 'Já tem gente cortando aqui';
  else if (!E.temConstrutorLivre(estado)) motivo = 'Construtores ocupados';
  const custo = { moedas: CORTE.custoPorArvore * lista.length };
  if (!motivo && !E.podePagar(estado.recursos, custo)) motivo = 'Moedas insuficientes';
  return { lista, custo, ganho: { madeira: CORTE.madeiraPorArvore * lista.length }, motivo };
}

export function cortar(estado, x, y, agora) {
  const info = infoCorte(estado, x, y);
  if (!info) return falha('Não tem mata aqui');
  if (info.motivo) return falha(info.motivo);
  E.pagar(estado.recursos, info.custo);
  estado.trabalhos.push({ tipo: 'corte', tiles: info.lista, inicio: agora, fim: agora + CORTE.tempo * 1000, ganho: info.ganho });
  return { ok: true };
}

export function infoRocha(estado, x, y) {
  if (tile(estado.mapa, x, y) !== ROCHA) return null;
  const vizinhoLivre = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => dentro(x + dx, y + dy) && tile(estado.mapa, x + dx, y + dy) !== ARVORE);
  let motivo = null;
  if (!vizinhoLivre) motivo = 'Abra a mata em volta primeiro';
  else if (estado.trabalhos.some((t) => t.tiles.some(([a, b]) => a === x && b === y))) motivo = 'Já estão quebrando';
  else if (!E.temConstrutorLivre(estado)) motivo = 'Construtores ocupados';
  else if (!E.podePagar(estado.recursos, { moedas: CFG_ROCHA.custo })) motivo = 'Moedas insuficientes';
  return { custo: { moedas: CFG_ROCHA.custo }, ganho: { pedra: CFG_ROCHA.pedra }, motivo };
}

export function quebrarRocha(estado, x, y, agora) {
  const info = infoRocha(estado, x, y);
  if (!info) return falha('Não tem rocha aqui');
  if (info.motivo) return falha(info.motivo);
  E.pagar(estado.recursos, info.custo);
  estado.trabalhos.push({ tipo: 'rocha', tiles: [[x, y]], inicio: agora, fim: agora + CFG_ROCHA.tempo * 1000, ganho: info.ganho });
  return { ok: true };
}

export const emRuinas = (estado) => estado.predios.filter((p) => p.ruina);
export const custoRepararTudo = (estado) => E.somarCustos(emRuinas(estado).map(E.custoReparo));

export function repararTudo(estado) {
  const ruinas = emRuinas(estado);
  if (!ruinas.length) return falha('Nada para reparar');
  const c = custoRepararTudo(estado);
  if (!E.podePagar(estado.recursos, c)) return falha('Recursos insuficientes para reparar tudo');
  E.pagar(estado.recursos, c);
  for (const p of ruinas) p.ruina = false;
  return { ok: true };
}

export function reparar(estado, uid) {
  const p = estado.predios.find((x) => x.uid === uid);
  if (!p?.ruina) return falha('Não precisa de reparo');
  const c = E.custoReparo(p);
  if (!E.podePagar(estado.recursos, c)) return falha('Recursos insuficientes');
  E.pagar(estado.recursos, c);
  p.ruina = false;
  return { ok: true };
}

// ---------- ondas ----------

export const recompensaOnda = (n, antecipada) => {
  const f = antecipada ? 1.25 : 1;
  return { moedas: Math.round((40 + 22 * n) * f), madeira: Math.round((30 + 15 * n) * f), pedra: Math.round(10 * n * f) };
};

/** Aplica o resultado de uma batalha na vila. */
export function aplicarResultado(estado, r, agora) {
  for (const uid of r.destruidos) {
    const p = estado.predios.find((x) => x.uid === uid);
    if (p) p.ruina = true;
  }
  if (r.venceu) {
    r.recompensa = E.receber(estado, recompensaOnda(r.onda, estado.antecipada));
    estado.recorde = Math.max(estado.recorde, r.onda);
    estado.stats.ondasVencidas++;
  } else {
    r.perda = {};
    for (const rec of RECURSOS) {
      const v = Math.floor(estado.recursos[rec] * PERDA_SE_QG_CAIR);
      estado.recursos[rec] -= v;
      r.perda[rec] = v;
    }
  }
  estado.stats.mortos += r.mortos;
  estado.onda = r.onda + 1;
  estado.antecipada = false;
  estado.historico.unshift({ ...r, quando: agora });
  estado.historico.length = Math.min(estado.historico.length, 30);
  return r;
}

/**
 * Ao abrir o jogo: resolve as ondas que caíram enquanto ele estava fechado (simulando cada uma
 * no horário em que aconteceu) e devolve o relatório. Ondas que vencem agora ficam para a tela.
 */
export function recuperarTempo(estado, agora, folga = 30000) {
  const relatorio = { ondas: [], obras: [], antes: { ...estado.recursos }, desde: estado.ultimoTick };
  let feitas = 0;
  while (estado.proximaOnda < agora - folga && feitas < MAX_ONDAS_OFFLINE) {
    relatorio.obras.push(...atualizar(estado, estado.proximaOnda));
    const r = simular(estado);
    relatorio.ondas.push(aplicarResultado(estado, r, estado.proximaOnda));
    estado.proximaOnda += INTERVALO_ONDA;
    feitas++;
  }
  if (estado.proximaOnda < agora - folga) estado.proximaOnda = agora + INTERVALO_ONDA; // passou tempo demais
  relatorio.obras.push(...atualizar(estado, agora));
  relatorio.depois = { ...estado.recursos };
  return relatorio;
}

// ---------- objetivos (guiam o começo do jogo) ----------

export const OBJETIVOS = [
  { id: 'torre', texto: 'Construa 2 Torres de Atiradores perto do QG', ok: (e) => e.predios.filter((p) => p.id === 'atiradores' && p.nivel >= 1).length >= 2, premio: { moedas: 120 } },
  { id: 'pedreira', texto: 'Construa uma Pedreira', ok: (e) => e.predios.some((p) => p.id === 'pedreira' && p.nivel >= 1), premio: { madeira: 120 } },
  { id: 'mata', texto: 'Derrube um pedaço da mata', ok: (e) => e.stats.arvores > 0, premio: { moedas: 80 } },
  { id: 'mercado', texto: 'Construa um Mercado', ok: (e) => e.predios.some((p) => p.id === 'mercado' && p.nivel >= 1), premio: { pedra: 100 } },
  { id: 'onda1', texto: 'Sobreviva à primeira onda', ok: (e) => e.stats.ondasVencidas > 0, premio: { moedas: 200, madeira: 150 } },
  { id: 'qg2', texto: 'Suba o QG para o nível 2', ok: (e) => E.qgNivel(e) >= 2, premio: { pedra: 200 } },
  { id: 'canhao', texto: 'Construa um Canhão', ok: (e) => e.predios.some((p) => p.id === 'canhao' && p.nivel >= 1), premio: { moedas: 200 } },
  { id: 'ferro', texto: 'Construa uma Mina de Ferro sobre um veio', ok: (e) => e.predios.some((p) => p.id === 'mina' && p.nivel >= 1), premio: { madeira: 300 } },
  { id: 'muros', texto: 'Levante 10 muros', ok: (e) => e.predios.filter((p) => p.id === 'muro').length >= 10, premio: { pedra: 250 } },
  { id: 'onda5', texto: 'Derrote o primeiro chefe (onda 5)', ok: (e) => e.recorde >= 5, premio: { moedas: 600, ferro: 100 } },
  { id: 'qg4', texto: 'Suba o QG para o nível 4', ok: (e) => E.qgNivel(e) >= 4, premio: { ferro: 200 } },
  { id: 'tesla', texto: 'Construa uma Tesla', ok: (e) => e.predios.some((p) => p.id === 'tesla' && p.nivel >= 1), premio: { moedas: 1000 } },
];

export function objetivoAtual(estado) {
  return OBJETIVOS.find((o) => !estado.objetivos.includes(o.id)) ?? null;
}

/** Marca os objetivos cumpridos (na ordem) e entrega os prêmios. */
export function checarObjetivos(estado) {
  const feitos = [];
  for (;;) {
    const o = objetivoAtual(estado);
    if (!o || !o.ok(estado)) break;
    estado.objetivos.push(o.id);
    feitos.push({ ...o, recebido: E.receber(estado, o.premio) });
  }
  return feitos;
}

// ---------- salvar ----------

export function serializar(estado) {
  return JSON.stringify(estado);
}

export function carregar(texto) {
  try {
    const e = JSON.parse(texto);
    if (e?.versao !== VERSAO || typeof e.mapa !== 'string') return null;
    return e;
  } catch {
    return null;
  }
}
