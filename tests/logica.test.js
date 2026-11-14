import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/economia.js';
import * as M from '../js/mapa.js';
import { aEstrela } from '../js/caminho.js';
import { gerarOnda, forcaDaOnda } from '../js/ondas.js';
import { INIMIGOS, N } from '../js/config.js';

test('custo cresce a cada nível e ferro do QG só entra a partir do nível 4', () => {
  const n2 = E.custo('qg', 2);
  const n3 = E.custo('qg', 3);
  assert.ok(n3.madeira > n2.madeira);
  assert.equal(n2.ferro, undefined);
  assert.equal(E.custo('qg', 4).ferro, 60);
  assert.deepEqual(E.custo('muro', 1), { pedra: 20 });
});

test('limites dependem do QG e nenhum prédio passa do nível do QG', () => {
  assert.equal(E.limite('canhao', 1), 0);
  assert.equal(E.limite('canhao', 2), 1);
  assert.equal(E.nivelMax('atiradores', 3), 3);
  assert.equal(E.nivelMax('vigia', 8), 3);
  assert.equal(E.nivelMax('qg', 1), 8);
});

test('capacidade cresce com QG e depósitos prontos', () => {
  const base = { predios: [{ id: 'qg', nivel: 1 }] };
  assert.equal(E.capacidade(base), 800);
  const comDeposito = { predios: [{ id: 'qg', nivel: 2 }, { id: 'deposito', nivel: 1 }, { id: 'deposito', nivel: 0, obra: {} }] };
  assert.equal(E.capacidade(comDeposito), 800 + 500 + 700);
});

test('receber respeita o limite', () => {
  const estado = { predios: [{ id: 'qg', nivel: 1 }], recursos: { moedas: 790, madeira: 0, pedra: 0, ferro: 0 } };
  const entrou = E.receber(estado, { moedas: 50 });
  assert.equal(estado.recursos.moedas, 800);
  assert.equal(entrou.moedas, 10);
});

test('mapa é sempre o mesmo para a mesma semente e tem clareira no centro', () => {
  const a = M.gerarMapa(42);
  assert.equal(a, M.gerarMapa(42));
  assert.notEqual(a, M.gerarMapa(43));
  assert.equal(a.length, N * N);
  assert.equal(M.tile(a, 0, 0), M.ARVORE);
  assert.notEqual(M.tile(a, 17, 17), M.ARVORE);
  assert.ok(a.split('').filter((t) => t === M.VEIO).length >= 8, 'tem veios de ferro');
});

test('não constrói em cima de mata, de outro prédio, nem mina fora do veio', () => {
  let mapa = M.gerarMapa(7);
  mapa = M.trocar(mapa, [[10, 10, M.GRAMA], [11, 10, M.GRAMA], [10, 11, M.GRAMA], [11, 11, M.GRAMA]]);
  const predios = [{ uid: 1, id: 'qg', x: 16, y: 16 }];
  assert.equal(M.motivoNaoPode(mapa, predios, 'serraria', 10, 10), null);
  assert.match(M.motivoNaoPode(mapa, predios, 'serraria', 16, 17), /construção/);
  assert.match(M.motivoNaoPode(mapa, predios, 'serraria', 3, 3), /mata/);
  assert.match(M.motivoNaoPode(mapa, predios, 'mina', 10, 10), /veio/);
});

test('corte só derruba árvores dentro do limite do QG', () => {
  const mapa = M.gerarMapa(5);
  const longe = M.arvoresDoCorte(mapa, 4, 4, 1);
  assert.equal(longe.lista.length, 0, 'QG 1 não alcança a beira do mapa');
  const perto = M.arvoresDoCorte(mapa, 25, 17, 1);
  assert.ok(perto.lista.length > 0);
});

test('A* desvia de obstáculo e devolve null quando não tem saída', () => {
  const bloqueado = new Set(['5,3', '5,4', '5,5', '5,6', '5,7']);
  const custo = (x, y) => (bloqueado.has(`${x},${y}`) ? Infinity : 1);
  const c = aEstrela({ inicio: [2, 5], objetivo: (x, y) => x === 8 && y === 5, custo, heuristica: (x, y) => Math.hypot(8 - x, 5 - y) });
  assert.ok(c);
  assert.deepEqual(c.at(-1), [8, 5]);
  assert.ok(c.every(([x, y]) => !bloqueado.has(`${x},${y}`)));
  const preso = aEstrela({ inicio: [0, 0], objetivo: (x) => x === 9, custo: (x) => (x === 1 ? Infinity : 1), heuristica: () => 0 });
  assert.equal(preso, null);
});

test('ondas: mesma semente gera a mesma onda, ficam mais fortes e têm chefe a cada 5', () => {
  assert.deepEqual(gerarOnda(3, 99), gerarOnda(3, 99));
  assert.ok(forcaDaOnda(10) > forcaDaOnda(2));
  const o1 = gerarOnda(1, 99);
  assert.equal(o1.lados.length, 1);
  assert.ok(o1.grupos.every((g) => g.tipo === 'fuzileiro'), 'onda 1 só tem fuzileiros');
  assert.equal(gerarOnda(5, 99).chefe, 'colheitadeira');
  assert.equal(gerarOnda(10, 99).chefe, 'helicoptero');
  const o12 = gerarOnda(12, 99);
  const tipos = new Set(o12.grupos.map((g) => g.tipo));
  assert.ok(tipos.has('trator') && tipos.has('bazuca'));
  const custo = o12.grupos.reduce((s, g) => s + INIMIGOS[g.tipo].custo, 0);
  assert.ok(custo <= forcaDaOnda(12));
});
