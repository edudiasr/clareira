import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as J from '../js/jogo.js';
import * as M from '../js/mapa.js';
import { criarBatalha, passo, simular } from '../js/combate.js';
import { INTERVALO_ONDA } from '../js/config.js';

const T0 = 1_800_000_000_000;

/** Jogo novo com um espaço limpo garantido para testes. */
function jogo(semente = 11) {
  const e = J.novoJogo(semente, T0);
  const limpar = [];
  for (let y = 10; y <= 24; y++) for (let x = 10; x <= 24; x++) {
    if (M.tile(e.mapa, x, y) !== M.VEIO) limpar.push([x, y, M.GRAMA]);
  }
  e.mapa = M.trocar(e.mapa, limpar);
  e.recursos = { moedas: 800, madeira: 800, pedra: 800, ferro: 0 };
  return e;
}

test('construir gasta recursos, ocupa construtor e termina no tempo certo', () => {
  const e = jogo();
  const r = J.construir(e, 'atiradores', 20, 12, T0);
  assert.ok(r.ok, r.erro);
  assert.equal(e.recursos.madeira, 680);
  assert.equal(r.predio.nivel, 0);
  J.atualizar(e, T0 + 9000);
  assert.equal(r.predio.nivel, 0, 'ainda em obra');
  const fim = J.atualizar(e, T0 + 10000);
  assert.equal(r.predio.nivel, 1);
  assert.equal(fim[0].id, 'atiradores');
});

test('construtores limitam obras ao mesmo tempo', () => {
  const e = jogo();
  assert.ok(J.construir(e, 'atiradores', 20, 12, T0).ok);
  assert.ok(J.construir(e, 'pedreira', 20, 20, T0).ok);
  const terceira = J.construir(e, 'mercado', 12, 20, T0);
  assert.equal(terceira.erro, 'Construtores ocupados');
  e.predios.find((p) => p.id === 'qg').nivel = 2; // muro libera no QG 2
  assert.ok(J.construir(e, 'muro', 14, 12, T0).ok, 'muro é instantâneo, não usa construtor');
});

test('limite por QG e lugar inválido', () => {
  const e = jogo();
  assert.match(J.construir(e, 'canhao', 20, 12, T0).erro, /QG 2/);
  assert.match(J.construir(e, 'atiradores', 16, 16, T0).erro, /construção/);
});

test('produção acumula com o tempo, inclusive com o jogo fechado', () => {
  const e = jogo();
  e.recursos.madeira = 0;
  J.atualizar(e, T0 + 10 * 60000); // serraria nível 1 = 18/min
  assert.equal(Math.round(e.recursos.madeira), 180);
});

test('melhorar não passa do nível do QG', () => {
  const e = jogo();
  const serraria = e.predios.find((p) => p.id === 'serraria');
  assert.match(J.melhorar(e, serraria.uid, T0).erro, /QG para o nível 2/);
  const qg = e.predios.find((p) => p.id === 'qg');
  assert.ok(J.melhorar(e, qg.uid, T0).ok);
  J.atualizar(e, T0 + 60000);
  assert.equal(qg.nivel, 2);
  assert.ok(J.melhorar(e, serraria.uid, T0 + 60000).ok);
});

test('derrubar mata vira grama e dá madeira', () => {
  const e = J.novoJogo(3, T0);
  // acha uma árvore encostada na clareira
  let alvo = null;
  for (let y = 4; y < 32 && !alvo; y++) for (let x = 4; x < 32 && !alvo; x++) {
    const info = J.infoCorte(e, x, y);
    if (info && !info.motivo) alvo = [x, y, info];
  }
  assert.ok(alvo, 'existe mata cortável');
  const [x, y, info] = alvo;
  const madeira = e.recursos.madeira;
  assert.ok(J.cortar(e, x, y, T0).ok);
  J.atualizar(e, T0 + 5000);
  assert.ok(info.lista.every(([a, b]) => M.tile(e.mapa, a, b) === M.GRAMA));
  assert.ok(e.recursos.madeira >= madeira + info.ganho.madeira);
});

test('sem defesas, a onda derruba o QG e leva 30% dos recursos', () => {
  const e = jogo();
  e.recursos = { moedas: 500, madeira: 500, pedra: 500, ferro: 0 };
  e.onda = 4;
  const r = J.aplicarResultado(e, simular(e), T0);
  assert.equal(r.venceu, false);
  assert.equal(e.recursos.moedas, 350);
  assert.ok(e.predios.find((p) => p.id === 'qg').ruina);
  assert.match(J.construir(e, 'atiradores', 20, 12, T0).erro, /Repare o QG/);
  assert.ok(J.repararTudo(e).ok);
  assert.ok(!e.predios.some((p) => p.ruina));
});

test('três torres seguram a primeira onda', () => {
  const e = jogo();
  for (const [x, y] of [[20, 13], [12, 20], [20, 20], [12, 12]]) {
    e.predios.push({ uid: e.proxUid++, id: 'atiradores', x, y, nivel: 1, obra: null, ruina: false });
  }
  const r = simular(e);
  assert.equal(r.venceu, true);
  assert.equal(r.mortos, r.total);
  assert.ok(r.duracao < 240);
});

test('batalha é determinística: mesma vila, mesmo resultado', () => {
  const a = jogo();
  const b = jogo();
  a.onda = b.onda = 6;
  for (const e of [a, b]) e.predios.push({ uid: 50, id: 'atiradores', x: 20, y: 13, nivel: 2, obra: null, ruina: false });
  assert.deepEqual(simular(a), simular(b));
});

test('mina terrestre explode quando pisam e some', () => {
  const e = jogo();
  // linha de minas em volta do QG
  for (let x = 12; x <= 22; x++) for (const y of [13, 21]) e.predios.push({ uid: e.proxUid++, id: 'armadilha', x, y, nivel: 1, obra: null, ruina: false });
  for (let y = 13; y <= 21; y++) for (const x of [13, 21]) e.predios.push({ uid: e.proxUid++, id: 'armadilha', x, y, nivel: 1, obra: null, ruina: false });
  const b = criarBatalha(e);
  const explosoes = [];
  while (!b.fim) {
    passo(b, 1 / 20);
    explosoes.push(...b.eventos.filter((ev) => ev.tipo === 'explosao' && ev.mina));
    b.eventos.length = 0;
  }
  assert.ok(explosoes.length > 0);
  assert.ok(b.mortos > 0);
});

test('ondas perdidas com o jogo fechado são simuladas ao voltar', () => {
  const e = jogo();
  for (const [x, y] of [[20, 13], [12, 20], [20, 20], [12, 12]]) {
    e.predios.push({ uid: e.proxUid++, id: 'atiradores', x, y, nivel: 1, obra: null, ruina: false });
  }
  const volta = T0 + INTERVALO_ONDA * 2 + 5 * 60000; // 35 min depois
  const rel = J.recuperarTempo(e, volta);
  assert.equal(rel.ondas.length, 2);
  assert.equal(e.onda, 3);
  assert.ok(e.proximaOnda > volta);
});

test('objetivos são cumpridos na ordem e dão prêmio', () => {
  const e = jogo();
  assert.equal(J.objetivoAtual(e).id, 'torre');
  e.predios.push({ uid: 99, id: 'atiradores', x: 20, y: 13, nivel: 1, obra: null, ruina: false });
  assert.deepEqual(J.checarObjetivos(e), [], 'uma torre só não basta');
  e.predios.push({ uid: 98, id: 'atiradores', x: 12, y: 20, nivel: 1, obra: null, ruina: false });
  e.recursos.moedas = 300;
  const moedas = e.recursos.moedas;
  const feitos = J.checarObjetivos(e);
  assert.equal(feitos[0].id, 'torre');
  assert.equal(e.recursos.moedas, moedas + 120);
  assert.equal(J.objetivoAtual(e).id, 'pedreira');
});

test('salvar e carregar mantém o jogo', () => {
  const e = jogo();
  const c = J.carregar(J.serializar(e));
  assert.deepEqual(c, e);
  assert.equal(J.carregar('{lixo'), null);
});
