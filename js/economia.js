// Contas da economia: custo, tempo, vida e força de cada nível, produção e limites.

import { PREDIOS, RECURSOS, QG_MAX, REPARO } from './config.js';

const arred = (v) => (v >= 100 ? Math.round(v / 5) * 5 : Math.round(v));

/** Custo para construir (nível 1) ou para subir PARA o nível `nivel`. */
export function custo(id, nivel) {
  const def = PREDIOS[id];
  const fator = def.cresce ** (nivel - 1);
  const c = {};
  for (const r of RECURSOS) {
    const base = def.custo[r];
    if (!base) continue;
    if (r === 'ferro' && def.ferroDesde) {
      if (nivel < def.ferroDesde) continue;
      c.ferro = arred(base * def.cresce ** (nivel - def.ferroDesde));
    } else {
      c[r] = arred(base * fator);
    }
  }
  return c;
}

/** Segundos de obra para chegar ao nível `nivel`. */
export const tempoObra = (id, nivel) => Math.round(PREDIOS[id].tempo * 1.45 ** (nivel - 1));

export const vidaMax = (id, nivel) => Math.round(PREDIOS[id].hp * (1 + 0.3 * (nivel - 1)));
export const danoNivel = (id, nivel) => Math.round(PREDIOS[id].dano * 1.22 ** (nivel - 1));

/** Produção por minuto de um prédio no nível dado. */
export function producao(id, nivel) {
  const p = PREDIOS[id].producao;
  if (!p) return {};
  const fator = 1.3 ** (nivel - 1);
  return Object.fromEntries(Object.entries(p).map(([r, v]) => [r, Math.round(v * fator)]));
}

export const qgNivel = (estado) => estado.predios.find((p) => p.id === 'qg')?.nivel ?? 1;

/** Quantos prédios desse tipo cabem no QG atual. */
export function limite(id, qg) {
  const def = PREDIOS[id];
  if (id === 'qg') return 1;
  return def.limite[Math.min(qg, QG_MAX) - 1] ?? 0;
}

/** Nível máximo que esse prédio pode ter agora (nenhum passa do QG). */
export function nivelMax(id, qg) {
  const def = PREDIOS[id];
  if (id === 'qg') return QG_MAX;
  return Math.min(def.maxNivel ?? QG_MAX, qg);
}

/** Limite de cada recurso guardado. */
export function capacidade(estado) {
  const qg = qgNivel(estado);
  let cap = 800 + 500 * (qg - 1);
  for (const p of estado.predios) {
    if (p.id === 'deposito' && !p.ruina && p.nivel >= 1) {
      cap += Math.round(PREDIOS.deposito.capacidade * 1.35 ** (p.nivel - 1));
    }
  }
  return cap;
}

export function construtores(estado) {
  const temBarracao = estado.predios.some((p) => p.id === 'barracao' && !p.ruina && p.nivel >= 1);
  return 2 + (temBarracao ? 1 : 0);
}

export const obrasAtivas = (estado) =>
  estado.predios.filter((p) => p.obra).length + (estado.trabalhos?.length ?? 0);

export const temConstrutorLivre = (estado) => obrasAtivas(estado) < construtores(estado);

export function podePagar(recursos, c) {
  return Object.entries(c).every(([r, v]) => (recursos[r] ?? 0) >= v);
}

export function faltando(recursos, c) {
  return Object.fromEntries(Object.entries(c).filter(([r, v]) => (recursos[r] ?? 0) < v).map(([r, v]) => [r, v - (recursos[r] ?? 0)]));
}

export function pagar(recursos, c) {
  for (const [r, v] of Object.entries(c)) recursos[r] -= v;
}

/** Soma recursos respeitando o limite. Devolve quanto realmente entrou. */
export function receber(estado, ganho) {
  const cap = capacidade(estado);
  const entrou = {};
  for (const [r, v] of Object.entries(ganho)) {
    const antes = estado.recursos[r];
    estado.recursos[r] = Math.min(cap, antes + v);
    entrou[r] = estado.recursos[r] - antes;
  }
  return entrou;
}

/** Produção total por minuto da vila (só prédios prontos e inteiros produzem). */
export function producaoTotal(estado) {
  const total = Object.fromEntries(RECURSOS.map((r) => [r, 0]));
  for (const p of estado.predios) {
    if (p.ruina || p.obra || !PREDIOS[p.id].producao) continue;
    for (const [r, v] of Object.entries(producao(p.id, p.nivel))) total[r] += v;
  }
  return total;
}

/** Quanto custa reparar um prédio em ruínas. */
export function custoReparo(p) {
  const c = custo(p.id, Math.max(1, p.nivel));
  return Object.fromEntries(Object.entries(c).map(([r, v]) => [r, Math.ceil(v * REPARO)]));
}

export function somarCustos(lista) {
  const t = {};
  for (const c of lista) for (const [r, v] of Object.entries(c)) t[r] = (t[r] ?? 0) + v;
  return t;
}
