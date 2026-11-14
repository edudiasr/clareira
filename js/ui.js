// Peças da interface em HTML por cima do canvas: ícones, custos, avisos e janelas.

import { NOME_RECURSO } from './config.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ENT[c]);

export const ICONES = {
  moedas: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#ffd23f" stroke="#b8860b" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="none" stroke="#e0a800" stroke-width="1.6"/><path d="M8 7.5a6 6 0 0 1 4-1.5" stroke="#fff6c2" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
  madeira: '<svg viewBox="0 0 24 24"><rect x="2" y="11" width="18" height="7" rx="3.5" fill="#8b5a2b"/><ellipse cx="19" cy="14.5" rx="3" ry="3.5" fill="#d8b07a" stroke="#8b5a2b" stroke-width="1.2"/><rect x="4" y="4" width="16" height="7" rx="3.5" fill="#a0703c"/><ellipse cx="19.5" cy="7.5" rx="3" ry="3.5" fill="#e8c592" stroke="#8b5a2b" stroke-width="1.2"/></svg>',
  pedra: '<svg viewBox="0 0 24 24"><path d="M4 17 7 8l6-3 6 4 2 8-6 3H9z" fill="#9ba1a8" stroke="#5f656c" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 8l5 4 7-3M12 12l-1 8" stroke="#c3c7cc" stroke-width="1.2" fill="none"/></svg>',
  ferro: '<svg viewBox="0 0 24 24"><path d="M3 17h18l-3-8H6z" fill="#8d99a6" stroke="#4f5a66" stroke-width="1.5" stroke-linejoin="round"/><path d="M6 9h12l-1.5-3h-9z" fill="#c9d2db" stroke="#4f5a66" stroke-width="1.5" stroke-linejoin="round"/></svg>',
};

export const icone = (r) => `<i class="ic">${ICONES[r]}</i>`;

export function numero(n) {
  n = Math.floor(n);
  if (n >= 10000) return `${(n / 1000).toFixed(n >= 100000 ? 0 : 1).replace('.', ',')}k`;
  return n.toLocaleString('pt-BR');
}

export function tempo(seg) {
  seg = Math.max(0, Math.ceil(seg));
  if (seg < 60) return `${seg}s`;
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  if (m < 60) return s ? `${m}min ${s}s` : `${m}min`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

export const relogio = (seg) => {
  seg = Math.max(0, Math.ceil(seg));
  return `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;
};

/** Lista de custos; recursos que faltam ficam em vermelho. */
export function custoHTML(custo, recursos = null) {
  const itens = Object.entries(custo).filter(([, v]) => v > 0);
  if (!itens.length) return '<span class="custo gratis">Grátis</span>';
  return itens.map(([r, v]) => `<span class="custo ${recursos && recursos[r] < v ? 'falta' : ''}" title="${NOME_RECURSO[r]}">${icone(r)}${numero(v)}</span>`).join('');
}

// ---------- avisos ----------

export function avisar(html, tipo = 'info', tempoMs = 3200) {
  const caixa = $('#avisos');
  const el = document.createElement('div');
  el.className = `aviso ${tipo}`;
  el.innerHTML = html;
  caixa.append(el);
  while (caixa.children.length > 4) caixa.firstElementChild.remove();
  setTimeout(() => {
    el.classList.add('saindo');
    setTimeout(() => el.remove(), 350);
  }, tempoMs);
}

// ---------- janela (modal) ----------

let aoFechar = null;
export const modalAberto = () => !$('#modal-fundo').hidden;

export function abrirModal(html, { classe = '', fechavel = true, depois = null } = {}) {
  const m = $('#modal');
  m.className = `modal ${classe}`;
  m.innerHTML = `${fechavel ? '<button class="fechar" data-fechar aria-label="Fechar">✕</button>' : ''}${html}`;
  $('#modal-fundo').hidden = false;
  $('#modal-fundo').dataset.fechavel = fechavel ? '1' : '';
  aoFechar = depois;
  return m;
}

export function fecharModal() {
  if (!modalAberto()) return;
  $('#modal-fundo').hidden = true;
  $('#modal').innerHTML = '';
  const cb = aoFechar;
  aoFechar = null;
  cb?.();
}

export function iniciarModal() {
  $('#modal-fundo').addEventListener('pointerdown', (e) => {
    if (e.target.id === 'modal-fundo' && $('#modal-fundo').dataset.fechavel) fecharModal();
  });
  $('#modal').addEventListener('click', (e) => {
    if (e.target.closest('[data-fechar]')) fecharModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalAberto() && $('#modal-fundo').dataset.fechavel) fecharModal();
  });
}
