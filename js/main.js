// Liga tudo: carrega o jogo, roda o loop, trata toque/mouse e monta os painéis da interface.

import { PREDIOS, RECURSOS, NOME_RECURSO, INTERVALO_ONDA, ORDEM_LOJA, INIMIGOS, CORTE, ROCHA as CFG_ROCHA } from './config.js';
import * as J from './jogo.js';
import * as E from './economia.js';
import { motivoNaoPode, tile, ARVORE, ROCHA, gradeOcupacao, idx } from './mapa.js';
import { criarBatalha, passo, resultado } from './combate.js';
import { gerarOnda, resumoOnda } from './ondas.js';
import { Cena } from './cena.js';
import { iso } from './desenho.js';
import { previa } from './sprites.js';
import { iniciarSom, tocar, alternarSom, somLigado } from './som.js';
import { $, $$, esc, icone, numero, tempo, relogio, custoHTML, avisar, abrirModal, fecharModal, modalAberto, iniciarModal } from './ui.js';

const CHAVE = 'clareira:save';
const DT = 1 / 30;

// ---------- estado ----------

let estado = null;
let novo = false;
try {
  estado = J.carregar(localStorage.getItem(CHAVE));
} catch { /* sem armazenamento */ }
if (!estado) {
  estado = J.novoJogo();
  novo = true;
}

let batalha = null;
let velocidade = 1;
let acumulado = 0;
let selecao = null; // { tipo: 'predio', uid } | { tipo: 'arvore' | 'rocha', x, y }
let fantasma = null; // { id, x, y, ok, mover?: uid }
let abaLoja = 'defesa';
let sujo = false;
let avisouMinuto = false;

const cena = new Cena($('#tela'));
const predioPorUid = (uid) => estado.predios.find((p) => p.uid === uid);

function salvar() {
  try {
    localStorage.setItem(CHAVE, J.serializar(estado));
  } catch { /* armazenamento cheio/bloqueado */ }
  sujo = false;
}

// ---------- seleção e toque ----------

function predioNoTile(x, y) {
  const grade = gradeOcupacao(estado.predios);
  const uid = grade[idx(x, y)] ?? null;
  return uid ? predioPorUid(uid) : null;
}

/** Prédios altos cobrem tiles de trás; olha também os tiles da frente. */
function predioNoToque(fx, fy) {
  const x = Math.floor(fx);
  const y = Math.floor(fy);
  for (const k of [0, 1, 2]) {
    const p = (x + k >= 0 && y + k >= 0 && x + k < 36 && y + k < 36) ? predioNoTile(x + k, y + k) : null;
    if (p && (k === 0 || PREDIOS[p.id].tam >= 2)) return p;
  }
  return null;
}

function tocar_(sx, sy) {
  const [fx, fy] = cena.telaParaTile(sx, sy);
  if (fantasma) {
    const tam = PREDIOS[fantasma.id].tam;
    const x = Math.floor(fx - tam / 2 + 0.5);
    const y = Math.floor(fy - tam / 2 + 0.5);
    if (x === fantasma.x && y === fantasma.y && fantasma.ok && !matchMedia('(pointer: coarse)').matches) return confirmarColocar();
    posicionarFantasma(x, y);
    return;
  }
  if (batalha) return;
  const p = predioNoToque(fx, fy);
  const x = Math.floor(fx);
  const y = Math.floor(fy);
  if (p) selecionar({ tipo: 'predio', uid: p.uid });
  else if (tile(estado.mapa, x, y) === ARVORE) selecionar({ tipo: 'arvore', x, y });
  else if (tile(estado.mapa, x, y) === ROCHA) selecionar({ tipo: 'rocha', x, y });
  else selecionar(null);
}

function selecionar(s) {
  selecao = s;
  if (s) tocar('clique');
  fecharLoja();
  desenharPainel(true);
}

// ---------- colocar / mover ----------

function posicionarFantasma(x, y) {
  fantasma.x = x;
  fantasma.y = y;
  fantasma.ok = !motivoNaoPode(estado.mapa, estado.predios, fantasma.id, x, y, fantasma.mover ?? null);
  atualizarBarraColocar();
}

/** Procura uma posição válida perto do centro da tela para o fantasma começar. */
function lugarInicial(id) {
  const [fx, fy] = cena.telaParaTile(cena.larg / 2, cena.alt / 2);
  const cx = Math.floor(fx);
  const cy = Math.floor(fy);
  for (let r = 0; r < 14; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!motivoNaoPode(estado.mapa, estado.predios, id, cx + dx, cy + dy)) return [cx + dx, cy + dy];
      }
    }
  }
  return [cx, cy];
}

function comecarColocar(id) {
  fecharLoja();
  selecao = null;
  desenharPainel(true);
  const [x, y] = lugarInicial(id);
  fantasma = { id, x, y, ok: false };
  posicionarFantasma(x, y);
  $('#colocar').hidden = false;
  $('.barra-baixo').hidden = true;
}

function comecarMover(p) {
  selecao = null;
  desenharPainel(true);
  fantasma = { id: p.id, x: p.x, y: p.y, ok: true, mover: p.uid, nivel: p.nivel };
  posicionarFantasma(p.x, p.y);
  $('#colocar').hidden = false;
  $('.barra-baixo').hidden = true;
}

function cancelarColocar() {
  fantasma = null;
  $('#colocar').hidden = true;
  $('.barra-baixo').hidden = false;
}

function atualizarBarraColocar() {
  if (!fantasma) return;
  const motivo = motivoNaoPode(estado.mapa, estado.predios, fantasma.id, fantasma.x, fantasma.y, fantasma.mover ?? null);
  const def = PREDIOS[fantasma.id];
  $('#colocar-info').innerHTML = fantasma.mover
    ? `<b>Movendo ${esc(def.nome)}</b><span>${motivo ? esc(motivo) : 'Toque no mapa para escolher o lugar'}</span>`
    : `<b>${esc(def.nome)}</b><span>${motivo ? esc(motivo) : custoHTML(E.custo(fantasma.id, 1), estado.recursos)}</span>`;
  $('#colocar-ok').disabled = !!motivo;
}

function confirmarColocar() {
  if (!fantasma?.ok) return;
  const agora = Date.now();
  if (fantasma.mover) {
    const r = J.mover(estado, fantasma.mover, fantasma.x, fantasma.y);
    if (!r.ok) return erro(r.erro);
    tocar('construir');
    sujo = true;
    return cancelarColocar();
  }
  const r = J.construir(estado, fantasma.id, fantasma.x, fantasma.y, agora);
  if (!r.ok) return erro(r.erro);
  tocar('construir');
  sujo = true;
  const [px, py] = iso(fantasma.x + PREDIOS[fantasma.id].tam / 2, fantasma.y + PREDIOS[fantasma.id].tam / 2);
  cena.estilhacos(px, py, 10, ['#d8c39a', '#8b5e34'], 40, 4);
  // muro e mina: continua colocando em sequência
  if ((fantasma.id === 'muro' || fantasma.id === 'armadilha') && !J.podeConstruir(estado, fantasma.id)) {
    const [dx, dy] = fantasma.ultimoPasso ?? [1, 0];
    const nx = fantasma.x + dx;
    const ny = fantasma.y + dy;
    fantasma.ultimoPasso = [dx, dy];
    posicionarFantasma(nx, ny);
    return;
  }
  cancelarColocar();
}

function erro(msg) {
  tocar('erro');
  avisar(`<b>Não deu:</b> ${esc(msg)}`, 'erro');
}

// ---------- painel do que está selecionado ----------

let htmlPainel = '';

function linhaStat(rotulo, atual, prox) {
  return `<div class="stat"><span>${rotulo}</span><b>${atual}${prox != null && prox !== atual ? ` <em>→ ${prox}</em>` : ''}</b></div>`;
}

function statsPredio(p) {
  const def = PREDIOS[p.id];
  const n = Math.max(1, p.nivel);
  const prox = p.nivel < E.nivelMax(p.id, 8) && !p.obra ? n + 1 : null;
  const linhas = [];
  linhas.push(linhaStat('Vida', numero(E.vidaMax(p.id, n)), prox && numero(E.vidaMax(p.id, prox))));
  if (def.dano) {
    linhas.push(linhaStat(p.id === 'armadilha' ? 'Dano da explosão' : 'Dano por tiro', numero(E.danoNivel(p.id, n)), prox && numero(E.danoNivel(p.id, prox))));
    if (def.cadencia) linhas.push(linhaStat('Disparos', `1 a cada ${String(def.cadencia).replace('.', ',')}s`));
    if (def.alcance) linhas.push(linhaStat('Alcance', `${String(def.alcance).replace('.', ',')} casas${def.minimo ? ` (cego até ${String(def.minimo).replace('.', ',')})` : ''}`));
    linhas.push(linhaStat('Acerta', def.ar ? 'Chão e ar' : 'Só chão'));
    if (def.saltos) linhas.push(linhaStat('Salta entre', `${def.saltos} inimigos`));
  }
  if (def.producao) {
    const r = Object.keys(def.producao)[0];
    linhas.push(linhaStat(`${icone(r)} por minuto`, E.producao(p.id, n)[r], prox && E.producao(p.id, prox)[r]));
  }
  if (p.id === 'deposito') linhas.push(linhaStat('Guarda a mais', numero(def.capacidade * 1.35 ** (n - 1)), prox && numero(def.capacidade * 1.35 ** (prox - 1))));
  if (p.id === 'vigia') linhas.push(linhaStat('Aviso antes da onda', `${def.alerta[n - 1]} min`, prox && `${def.alerta[prox - 1]} min`));
  if (p.id === 'qg') {
    const q = p.nivel;
    const libera = Object.entries(PREDIOS).filter(([id, d]) => id !== 'qg' && E.limite(id, q + 1) > E.limite(id, q)).map(([, d]) => d.nome);
    linhas.push(linhaStat('Guarda', `${numero(E.capacidade(estado))} de cada`));
    if (q < 8) linhas.push(`<p class="libera"><b>No nível ${q + 1}:</b> ${libera.length ? esc(libera.join(', ')) : 'mais níveis para tudo'} e mais mata para derrubar.</p>`);
  }
  return linhas.join('');
}

function htmlPainelAtual(agora) {
  if (!selecao) return '';
  if (selecao.tipo === 'predio') {
    const p = predioPorUid(selecao.uid);
    if (!p) return '';
    const def = PREDIOS[p.id];
    let status = '';
    let acoes = '';
    if (p.ruina) {
      const c = E.custoReparo(p);
      status = `<span class="tag ruim">${p.id === 'armadilha' ? 'Detonada' : 'Em ruínas'}</span>`;
      acoes += `<button class="btn verde" data-acao="reparar">${p.id === 'armadilha' ? 'Rearmar' : 'Reparar'}<small>${custoHTML(c, estado.recursos)}</small></button>`;
    } else if (p.obra) {
      status = `<span class="tag obra">Em obra · ${tempo((p.obra.fim - agora) / 1000)}</span>`;
    } else {
      const motivo = J.podeMelhorar(estado, p);
      const maxAbs = p.nivel >= (def.maxNivel ?? 8);
      if (!maxAbs) {
        const c = E.custo(p.id, p.nivel + 1);
        const t = E.tempoObra(p.id, p.nivel + 1);
        acoes += `<button class="btn amarelo" data-acao="melhorar" ${motivo ? 'disabled' : ''}>Melhorar p/ nível ${p.nivel + 1}<small>${custoHTML(c, estado.recursos)}${t ? ` · ${tempo(t)}` : ''}</small>${motivo && motivo !== 'Recursos insuficientes' ? `<em>${esc(motivo)}</em>` : ''}</button>`;
      } else {
        status = '<span class="tag max">Nível máximo</span>';
      }
    }
    if (p.id !== 'qg' && !p.obra) acoes += '<button class="btn" data-acao="mover">Mover</button>';
    return `<div class="painel-topo"><div><h3>${esc(def.nome)}</h3><span class="nivel">Nível ${Math.max(p.nivel, 0) || 'em construção'}</span>${status}</div>
      <button class="fechar" data-acao="fechar" aria-label="Fechar">✕</button></div>
      <p class="desc">${esc(def.desc)}</p>
      <div class="stats">${statsPredio(p)}</div>
      <div class="acoes">${acoes}</div>`;
  }
  if (selecao.tipo === 'arvore') {
    const info = J.infoCorte(estado, selecao.x, selecao.y);
    if (!info) return '';
    return `<div class="painel-topo"><div><h3>Mata fechada</h3><span class="nivel">${info.lista.length} árvores neste trecho</span></div>
      <button class="fechar" data-acao="fechar" aria-label="Fechar">✕</button></div>
      <p class="desc">Derrubar abre espaço para construir e rende madeira. Mas cuidado: a mata também esconde a vila.</p>
      <div class="stats">${linhaStat('Rende', `${icone('madeira')} ${numero(info.ganho.madeira)}`)}${linhaStat('Leva', tempo(CORTE.tempo))}</div>
      <div class="acoes"><button class="btn verde" data-acao="cortar" ${info.motivo ? 'disabled' : ''}>Derrubar<small>${custoHTML(info.custo, estado.recursos)}</small>${info.motivo ? `<em>${esc(info.motivo)}</em>` : ''}</button></div>`;
  }
  if (selecao.tipo === 'rocha') {
    const info = J.infoRocha(estado, selecao.x, selecao.y);
    if (!info) return '';
    return `<div class="painel-topo"><div><h3>Rocha</h3><span class="nivel">Ocupa espaço</span></div>
      <button class="fechar" data-acao="fechar" aria-label="Fechar">✕</button></div>
      <p class="desc">Quebrar libera o espaço e rende pedra.</p>
      <div class="stats">${linhaStat('Rende', `${icone('pedra')} ${numero(info.ganho.pedra)}`)}${linhaStat('Leva', tempo(CFG_ROCHA.tempo))}</div>
      <div class="acoes"><button class="btn verde" data-acao="quebrar" ${info.motivo ? 'disabled' : ''}>Quebrar<small>${custoHTML(info.custo, estado.recursos)}</small>${info.motivo ? `<em>${esc(info.motivo)}</em>` : ''}</button></div>`;
  }
  return '';
}

function desenharPainel(forcar = false) {
  const html = htmlPainelAtual(Date.now());
  const painel = $('#painel');
  if (!html) {
    painel.hidden = true;
    htmlPainel = '';
    if (selecao && !forcar) selecao = null;
    return;
  }
  painel.hidden = false;
  if (html !== htmlPainel || forcar) {
    painel.innerHTML = html;
    htmlPainel = html;
  }
}

$('#painel').addEventListener('click', (e) => {
  const b = e.target.closest('[data-acao]');
  if (!b || b.disabled) return;
  const agora = Date.now();
  const acao = b.dataset.acao;
  if (acao === 'fechar') return selecionar(null);
  let r = { ok: true };
  if (acao === 'melhorar') r = J.melhorar(estado, selecao.uid, agora);
  else if (acao === 'reparar') r = J.reparar(estado, selecao.uid);
  else if (acao === 'cortar') r = J.cortar(estado, selecao.x, selecao.y, agora);
  else if (acao === 'quebrar') r = J.quebrarRocha(estado, selecao.x, selecao.y, agora);
  else if (acao === 'mover') return comecarMover(predioPorUid(selecao.uid));
  if (!r.ok) return erro(r.erro);
  tocar('construir');
  sujo = true;
  if (acao === 'cortar' || acao === 'quebrar') selecionar(null);
  else desenharPainel(true);
});

// ---------- loja ----------

function abrirLoja() {
  if (batalha) return;
  selecao = null;
  desenharPainel(true);
  $('#loja').hidden = false;
  desenharLoja();
  tocar('clique');
}

function fecharLoja() {
  $('#loja').hidden = true;
}

function desenharLoja() {
  $$('#loja [data-aba]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aba === abaLoja)));
  const qg = E.qgNivel(estado);
  $('#loja-itens').innerHTML = ORDEM_LOJA[abaLoja].map((id) => {
    const def = PREDIOS[id];
    const motivo = J.podeConstruir(estado, id);
    const lim = E.limite(id, qg);
    const tem = estado.predios.filter((p) => p.id === id).length;
    const bloqueado = lim === 0;
    return `<button class="item ${motivo ? 'indisponivel' : ''} ${bloqueado ? 'trancado' : ''}" data-id="${id}" ${motivo && motivo !== 'Recursos insuficientes' && motivo !== 'Construtores ocupados' ? '' : ''}>
      <canvas data-previa="${id}" width="180" height="140"></canvas>
      <span class="item-qtd">${tem}/${lim}</span>
      <b>${esc(def.nome)}</b>
      <span class="item-custo">${custoHTML(E.custo(id, 1), estado.recursos)}</span>
      <small>${def.tempo ? tempo(E.tempoObra(id, 1)) : 'Na hora'}</small>
      ${motivo ? `<em>${esc(motivo)}</em>` : ''}
    </button>`;
  }).join('');
  $$('#loja canvas[data-previa]').forEach((cv) => previa(cv, cv.dataset.previa));
}

$('#loja').addEventListener('click', (e) => {
  const aba = e.target.closest('[data-aba]');
  if (aba) {
    abaLoja = aba.dataset.aba;
    tocar('clique');
    return desenharLoja();
  }
  if (e.target.closest('[data-fechar-loja]')) return fecharLoja();
  const item = e.target.closest('[data-id]');
  if (!item) return;
  const motivo = J.podeConstruir(estado, item.dataset.id);
  if (motivo) return erro(motivo);
  comecarColocar(item.dataset.id);
});

// ---------- HUD ----------

function desenharRecursos() {
  const cap = E.capacidade(estado);
  const prod = E.producaoTotal(estado);
  $('#recursos').innerHTML = RECURSOS.map((r) => {
    const v = estado.recursos[r];
    return `<div class="recurso ${v >= cap ? 'cheio' : ''}" title="${NOME_RECURSO[r]}: +${prod[r]}/min · limite ${numero(cap)}">
      ${icone(r)}<div><b>${numero(v)}</b><span class="barra"><i style="width:${Math.min(100, (v / cap) * 100)}%"></i></span></div>
    </div>`;
  }).join('');
}

function ladosAlerta(agora) {
  if (batalha) return [];
  const vigia = estado.predios.find((p) => p.id === 'vigia' && p.nivel >= 1 && !p.ruina);
  if (!vigia) return [];
  const alerta = PREDIOS.vigia.alerta[vigia.nivel - 1] * 60000;
  if (estado.proximaOnda - agora > alerta) return [];
  return gerarOnda(estado.onda, estado.semente).lados;
}

const NOME_LADO = { norte: 'norte', sul: 'sul', leste: 'leste', oeste: 'oeste' };

function desenharHUD(agora) {
  desenharRecursos();
  const livres = E.construtores(estado) - E.obrasAtivas(estado);
  $('#construtores').innerHTML = `<span class="martelo">⚒</span><b>${livres}/${E.construtores(estado)}</b><small>livres</small>`;
  const onda = $('#onda');
  if (batalha) {
    onda.className = 'onda batalhando';
    onda.innerHTML = `<b>Onda ${batalha.n}</b><span>${batalha.mortos}/${batalha.total} abatidos</span>`;
  } else {
    const resta = (estado.proximaOnda - agora) / 1000;
    const lados = ladosAlerta(agora);
    onda.className = `onda ${resta < 60 ? 'perto' : ''}`;
    onda.innerHTML = `<b>Onda ${estado.onda} em ${relogio(resta)}</b><span>${lados.length ? `Vem pelo ${lados.map((l) => NOME_LADO[l]).join(' e ')}` : `Recorde: onda ${estado.recorde || '—'}`}</span>`;
  }
  const ruinas = J.emRuinas(estado);
  const rep = $('#btn-reparar');
  rep.hidden = !ruinas.length || !!batalha;
  if (ruinas.length) rep.innerHTML = `Reparar tudo<small>${custoHTML(J.custoRepararTudo(estado), estado.recursos)}</small>`;
  $('#btn-antecipar').hidden = !!batalha;
  $('#btn-construir').hidden = !!batalha;
  $('#velocidade').hidden = !batalha;

  const obj = J.objetivoAtual(estado);
  const caixa = $('#objetivo');
  caixa.hidden = !obj || !!batalha;
  if (obj) caixa.innerHTML = `<small>Objetivo</small><b>${esc(obj.texto)}</b><span>Prêmio ${custoHTML(obj.premio)}</span>`;

  if (!$('#loja').hidden) {
    // atualiza custos em vermelho sem redesenhar as prévias
    $$('#loja-itens .item').forEach((el) => {
      const id = el.dataset.id;
      el.querySelector('.item-custo').innerHTML = custoHTML(E.custo(id, 1), estado.recursos);
      const motivo = J.podeConstruir(estado, id);
      el.classList.toggle('indisponivel', !!motivo);
      const em = el.querySelector('em');
      if (motivo) {
        if (em) em.textContent = motivo;
        else el.insertAdjacentHTML('beforeend', `<em>${esc(motivo)}</em>`);
      } else em?.remove();
    });
  }
}

// ---------- ondas ----------

function iniciarBatalha() {
  cancelarColocar();
  fecharLoja();
  selecionar(null);
  if (modalAberto()) fecharModal();
  batalha = criarBatalha(estado);
  acumulado = 0;
  const lados = batalha.onda.lados.map((l) => NOME_LADO[l]).join(' e ');
  avisar(`<b>Onda ${batalha.n}!</b> A Companhia Serra Grande está saindo da mata pelo ${lados}.${batalha.onda.chefe ? ` <b>Chefe:</b> ${esc(INIMIGOS[batalha.onda.chefe].nome)}!` : ''}`, 'perigo', 5000);
  tocar('alarme');
  $('body').classList.add('em-batalha');
}

function terminarBatalha() {
  const agora = Date.now();
  const r = J.aplicarResultado(estado, resultado(batalha), agora);
  estado.proximaOnda = agora + INTERVALO_ONDA;
  batalha = null;
  avisouMinuto = false;
  $('body').classList.remove('em-batalha');
  velocidade = 1;
  $$('#velocidade button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vel === '1')));
  salvar();
  tocar(r.venceu ? 'vitoria' : 'derrota');
  mostrarResultado(r);
}

function nomesDestruidos(uids) {
  const c = {};
  for (const uid of uids) {
    const p = predioPorUid(uid);
    if (p) c[PREDIOS[p.id].nome] = (c[PREDIOS[p.id].nome] ?? 0) + 1;
  }
  return Object.entries(c).map(([n, q]) => (q > 1 ? `${q}× ${n}` : n)).join(', ');
}

function mostrarResultado(r) {
  const destruidos = nomesDestruidos(r.destruidos);
  abrirModal(`
    <div class="resultado ${r.venceu ? 'venceu' : 'perdeu'}">
      <p class="selo">${r.venceu ? 'Clareira defendida' : 'O QG caiu'}</p>
      <h2>Onda ${r.onda}</h2>
      <div class="numeros">
        <div><b>${r.mortos}/${r.total}</b><span>abatidos</span></div>
        <div><b>${r.duracao}s</b><span>de batalha</span></div>
        <div><b>${r.destruidos.length}</b><span>construções perdidas</span></div>
      </div>
      ${r.venceu ? `<p class="linha">Recompensa: ${custoHTML(r.recompensa)}</p>` : `<p class="linha ruim">Os mercenários levaram: ${custoHTML(r.perda)}</p>`}
      ${r.recuaram ? `<p class="linha">${r.recuaram} inimigos recuaram para a mata.</p>` : ''}
      ${destruidos ? `<p class="linha">Destruídos: ${esc(destruidos)}. O botão “Reparar tudo” reconstrói.</p>` : ''}
      <button class="btn amarelo grande" data-fechar>${r.venceu ? 'Bora pra próxima' : 'Reconstruir'}</button>
    </div>`, { classe: 'pequeno' });
}

function mostrarRelatorioOffline(rel) {
  const ganho = Object.fromEntries(RECURSOS.map((r) => [r, Math.max(0, Math.round(rel.depois[r] - rel.antes[r]))]));
  const fora = (Date.now() - rel.desde) / 1000;
  if (!rel.ondas.length && fora < 120) return;
  const ondas = rel.ondas.map((r) => `<li class="${r.venceu ? 'ok' : 'ruim'}"><b>Onda ${r.onda}</b> ${r.venceu ? 'defendida' : 'QG caiu'} · ${r.mortos}/${r.total} abatidos${r.destruidos.length ? ` · ${r.destruidos.length} perdidas` : ''}</li>`).join('');
  abrirModal(`
    <h2>Enquanto você estava fora</h2>
    <p class="sub">${tempo(fora)} longe da clareira.</p>
    ${ondas ? `<ul class="lista-ondas">${ondas}</ul>` : '<p class="sub">Nenhuma onda atacou nesse tempo.</p>'}
    <p class="linha">Saldo do período: ${custoHTML(ganho)}</p>
    <button class="btn amarelo grande" data-fechar>Ver a vila</button>`, { classe: 'pequeno' });
}

// ---------- menu e ajuda ----------

function comoJogar(primeiraVez = false) {
  abrirModal(`
    <p class="selo">${primeiraVez ? 'Bem-vindo à Clareira' : 'Como jogar'}</p>
    <h2>Defenda a mata</h2>
    <p class="sub">A <b>Companhia Serra Grande</b> quer derrubar a floresta inteira. A sua vila, no meio dela, é a última coisa no caminho.</p>
    <ul class="dicas">
      <li><b>A cada 15 minutos</b> uma onda de mercenários sai da mata, de lados sorteados. Fechado o jogo, as ondas continuam e você vê o resultado ao voltar.</li>
      <li><b>Produza</b> madeira, pedra, ferro e moedas. Derrube a mata das bordas para crescer (e ganhar madeira).</li>
      <li><b>Monte a defesa</b>: torres, canhões, morteiros, teslas, muros e minas. Na batalha você só assiste, então a estratégia é onde cada coisa fica.</li>
      <li><b>Suba o QG</b> para liberar tudo. Se ele cair, os mercenários levam 30% dos recursos e você repara o que foi destruído.</li>
      <li>Arraste para andar pelo mapa, use a roda do mouse ou dois dedos para o zoom.</li>
    </ul>
    <button class="btn amarelo grande" data-fechar>${primeiraVez ? 'Começar' : 'Entendi'}</button>`, { classe: 'pequeno' });
}

function abrirMenu() {
  const s = estado.stats;
  abrirModal(`
    <h2>Clareira</h2>
    <div class="numeros">
      <div><b>${estado.recorde || 0}</b><span>maior onda</span></div>
      <div><b>${numero(s.mortos)}</b><span>mercenários abatidos</span></div>
      <div><b>${numero(s.arvores)}</b><span>árvores derrubadas</span></div>
    </div>
    ${estado.historico.length ? `<ul class="lista-ondas">${estado.historico.slice(0, 6).map((r) => `<li class="${r.venceu ? 'ok' : 'ruim'}"><b>Onda ${r.onda}</b> ${r.venceu ? 'defendida' : 'perdida'} · ${r.mortos}/${r.total}</li>`).join('')}</ul>` : ''}
    <div class="menu-botoes">
      <button class="btn" data-menu="som">Som: ${somLigado() ? 'ligado' : 'desligado'}</button>
      <button class="btn" data-menu="ajuda">Como jogar</button>
      <button class="btn vermelho" data-menu="reiniciar">Recomeçar do zero</button>
    </div>
    <p class="creditos">Jogo original feito com Canvas e JavaScript puro. Tudo é desenhado em código.</p>`, { classe: 'pequeno' });
}

$('#modal').addEventListener('click', (e) => {
  const b = e.target.closest('[data-menu]');
  if (!b) return;
  if (b.dataset.menu === 'som') {
    alternarSom();
    b.textContent = `Som: ${somLigado() ? 'ligado' : 'desligado'}`;
    try { localStorage.setItem('clareira:som', somLigado() ? '1' : '0'); } catch { /* ok */ }
  } else if (b.dataset.menu === 'ajuda') comoJogar();
  else if (b.dataset.menu === 'reiniciar') {
    if (!confirm('Apagar a vila e começar uma clareira nova?')) return;
    estado = J.novoJogo();
    batalha = null;
    salvar();
    fecharModal();
    cena.centralizar(17.5, 17.5);
    avisar('Clareira nova. Boa sorte!', 'ok');
  }
});

// ---------- botões ----------

$('#btn-construir').addEventListener('click', () => ($('#loja').hidden ? abrirLoja() : fecharLoja()));
$('#btn-menu').addEventListener('click', abrirMenu);
$('#btn-reparar').addEventListener('click', () => {
  const r = J.repararTudo(estado);
  if (!r.ok) return erro(r.erro);
  tocar('construir');
  sujo = true;
  avisar('Tudo reparado.', 'ok');
});
$('#btn-antecipar').addEventListener('click', () => {
  if (batalha) return;
  const onda = gerarOnda(estado.onda, estado.semente);
  const tipos = Object.entries(resumoOnda(onda)).map(([t, q]) => `<li>${q}× ${esc(INIMIGOS[t].nome)}</li>`).join('');
  abrirModal(`
    <h2>Chamar a onda ${estado.onda} agora?</h2>
    <p class="sub">Quem antecipa ganha <b>25% a mais</b> de recompensa se segurar o ataque.</p>
    <ul class="tropas">${tipos}</ul>
    <div class="menu-botoes">
      <button class="btn vermelho grande" data-chamar>Que venham!</button>
      <button class="btn" data-fechar>Ainda não</button>
    </div>`, { classe: 'pequeno' });
  $('[data-chamar]').addEventListener('click', () => {
    estado.antecipada = true;
    estado.proximaOnda = Date.now();
    fecharModal();
  });
});
$('#colocar-ok').addEventListener('click', confirmarColocar);
$('#colocar-nao').addEventListener('click', cancelarColocar);
$('#velocidade').addEventListener('click', (e) => {
  const b = e.target.closest('[data-vel]');
  if (!b) return;
  velocidade = Number(b.dataset.vel);
  $$('#velocidade button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
});
document.addEventListener('keydown', (e) => {
  if (modalAberto()) return;
  if (e.key === 'Escape') {
    if (fantasma) cancelarColocar();
    else if (!$('#loja').hidden) fecharLoja();
    else selecionar(null);
  }
  if (e.key === 'Enter' && fantasma) confirmarColocar();
  if (e.key.toLowerCase() === 'b' && !fantasma) abrirLoja();
});

// ---------- entrada (mouse e toque) ----------

const cv = $('#tela');
const ponteiros = new Map();
let arrasto = null;
let pinca = null;

cv.addEventListener('pointerdown', (e) => {
  iniciarSom();
  cv.setPointerCapture(e.pointerId);
  ponteiros.set(e.pointerId, [e.clientX, e.clientY]);
  if (ponteiros.size === 1) arrasto = { x: e.clientX, y: e.clientY, moveu: false };
  if (ponteiros.size === 2) {
    const [a, b] = [...ponteiros.values()];
    pinca = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]) };
    arrasto = null;
  }
});

cv.addEventListener('pointermove', (e) => {
  if (!ponteiros.has(e.pointerId)) {
    // mouse passeando: o fantasma segue o cursor
    if (fantasma && e.pointerType === 'mouse') {
      const [fx, fy] = cena.telaParaTile(e.clientX, e.clientY);
      const tam = PREDIOS[fantasma.id].tam;
      const x = Math.floor(fx - tam / 2 + 0.5);
      const y = Math.floor(fy - tam / 2 + 0.5);
      if (x !== fantasma.x || y !== fantasma.y) posicionarFantasma(x, y);
    }
    return;
  }
  const antes = ponteiros.get(e.pointerId);
  ponteiros.set(e.pointerId, [e.clientX, e.clientY]);
  if (pinca && ponteiros.size === 2) {
    const [a, b] = [...ponteiros.values()];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    cena.zoomEm((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pinca.dist);
    pinca.dist = d;
    return;
  }
  if (arrasto) {
    if (!arrasto.moveu && Math.hypot(e.clientX - arrasto.x, e.clientY - arrasto.y) > 7) arrasto.moveu = true;
    if (arrasto.moveu) cena.arrastar(e.clientX - antes[0], e.clientY - antes[1]);
  }
});

function soltar(e) {
  ponteiros.delete(e.pointerId);
  if (ponteiros.size < 2) pinca = null;
  if (arrasto && !arrasto.moveu && ponteiros.size === 0) tocar_(e.clientX, e.clientY);
  if (ponteiros.size === 0) arrasto = null;
}
cv.addEventListener('pointerup', soltar);
cv.addEventListener('pointercancel', (e) => {
  ponteiros.delete(e.pointerId);
  arrasto = null;
  pinca = null;
});
cv.addEventListener('wheel', (e) => {
  e.preventDefault();
  cena.zoomEm(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
}, { passive: false });
addEventListener('resize', () => cena.redimensionar());

// ---------- loop ----------

function tratarConcluidos(lista) {
  for (const c of lista) {
    if (c.tipo === 'obra') {
      const p = predioPorUid(c.uid);
      if (!p) continue;
      const tam = PREDIOS[p.id].tam;
      const [x, y] = iso(p.x + tam / 2, p.y + tam / 2);
      cena.texto(x, y - 50, c.nivel === 1 ? 'Pronto!' : `Nível ${c.nivel}!`, '#ffd23f');
      cena.estilhacos(x, y - 20, 16, ['#ffd23f', '#fff6c2'], 60, 20);
      tocar('construir');
      if (selecao?.uid === c.uid) desenharPainel(true);
    } else {
      const [x, y] = iso(c.tiles[0][0] + 0.5, c.tiles[0][1] + 0.5);
      const [r, v] = Object.entries(c.ganho)[0] ?? [];
      if (r) cena.texto(x, y - 30, `+${Math.round(v)} ${NOME_RECURSO[r].toLowerCase()}`, r === 'madeira' ? '#e8c592' : '#d5dbe1');
      tocar('moeda');
    }
    sujo = true;
  }
}

let ultimo = performance.now();
let ultimoHud = 0;
let ultimoSave = 0;

function quadro(agoraMs) {
  const dt = Math.min(0.05, (agoraMs - ultimo) / 1000);
  ultimo = agoraMs;
  const agora = Date.now();

  tratarConcluidos(J.atualizar(estado, agora));
  if (batalha) {
    acumulado += dt * velocidade;
    while (acumulado >= DT && !batalha.fim) {
      passo(batalha, DT);
      cena.consumirEventos(batalha, tocar);
      acumulado -= DT;
    }
    if (batalha.fim) terminarBatalha();
  } else {
    if (!avisouMinuto && estado.proximaOnda - agora < 60000) {
      avisouMinuto = true;
      avisar(`<b>Onda ${estado.onda} chega em 1 minuto!</b>`, 'perigo');
      tocar('alarme');
    }
    if (agora >= estado.proximaOnda) iniciarBatalha();
  }

  for (const o of J.checarObjetivos(estado)) {
    avisar(`<b>Objetivo cumprido:</b> ${esc(o.texto)} ${custoHTML(o.recebido)}`, 'ok', 4500);
    tocar('moeda');
    sujo = true;
  }

  const corte = selecao?.tipo === 'arvore' ? J.infoCorte(estado, selecao.x, selecao.y)?.lista : null;
  const sel = selecao?.tipo === 'predio' ? predioPorUid(selecao.uid) : selecao ? { ...selecao, tam: 1 } : null;
  cena.desenhar({
    estado, batalha, t: agoraMs / 1000, dt, agora,
    selecao: sel, fantasma, corte, ladosAlerta: ladosAlerta(agora),
  });

  if (agoraMs - ultimoHud > 200) {
    ultimoHud = agoraMs;
    desenharHUD(agora);
    if (selecao) desenharPainel();
    if (fantasma) atualizarBarraColocar();
  }
  if ((sujo && agoraMs - ultimoSave > 2000) || agoraMs - ultimoSave > 15000) {
    ultimoSave = agoraMs;
    salvar();
  }
  requestAnimationFrame(quadro);
}

// ---------- início ----------

iniciarModal();
try {
  if (localStorage.getItem('clareira:som') === '0') alternarSom(false);
} catch { /* ok */ }
cena.centralizar(17.5, 17.5);
const relatorio = J.recuperarTempo(estado, Date.now());
if (novo) comoJogar(true);
else mostrarRelatorioOffline(relatorio);
salvar();
desenharHUD(Date.now());
requestAnimationFrame(quadro);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') return salvar();
  if (!batalha) {
    const rel = J.recuperarTempo(estado, Date.now());
    if (rel.ondas.length) mostrarRelatorioOffline(rel);
  }
});
addEventListener('pagehide', salvar);

// para testes no console
window.clareira = { get estado() { return estado; }, get batalha() { return batalha; }, cena };
