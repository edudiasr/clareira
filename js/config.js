// Todos os números do jogo ficam aqui: mapa, prédios, defesas e inimigos.
// Mexer no equilíbrio do jogo = mexer só neste arquivo.

export const N = 36; // o mapa é um quadrado de N x N tiles
export const BORDA = 2; // anel de mata fechada de onde saem os inimigos (não dá pra derrubar)
export const CENTRO = N / 2; // 18
export const RAIO_INICIAL = 6.5; // clareira inicial: 14 x 14 tiles
export const INTERVALO_ONDA = 15 * 60 * 1000;
export const MAX_ONDAS_OFFLINE = 6;
export const QG_MAX = 8;

export const RECURSOS = ['moedas', 'madeira', 'pedra', 'ferro'];
export const NOME_RECURSO = { moedas: 'Moedas', madeira: 'Madeira', pedra: 'Pedra', ferro: 'Ferro' };

export const INICIO = { moedas: 400, madeira: 500, pedra: 250, ferro: 0 };

/** Até onde dá pra derrubar a mata, conforme o nível do QG (distância do centro, em tiles). */
export const raioClareira = (qg) => Math.min(CENTRO - BORDA - 0.5, RAIO_INICIAL + 1.5 * qg);

export const CORTE = { custoPorArvore: 8, madeiraPorArvore: 25, tempo: 5 };
export const ROCHA = { custo: 10, pedra: 45, tempo: 3 };

/**
 * Prédios. Para cada um:
 *  tam      lado em tiles
 *  custo    custo do nível 1; os próximos níveis multiplicam por `cresce`
 *  tempo    segundos para construir o nível 1 (próximos x1.45)
 *  limite   quantos dá pra ter em cada nível de QG (posição 0 = QG 1)
 */
export const PREDIOS = {
  qg: {
    nome: 'Quartel-General', cat: 'nucleo', tam: 3, hp: 2200, maxNivel: QG_MAX,
    custo: { moedas: 150, madeira: 350, pedra: 250, ferro: 60 }, ferroDesde: 4, cresce: 1.85, tempo: 20,
    desc: 'O coração da clareira. Subir o QG libera prédios, defesas, níveis e mais mata para derrubar.',
  },
  serraria: {
    nome: 'Serraria', cat: 'recurso', tam: 2, hp: 420, custo: { moedas: 60, madeira: 40 }, cresce: 1.6, tempo: 8,
    producao: { madeira: 18 }, limite: [1, 2, 2, 3, 3, 4, 4, 4],
    desc: 'Transforma a mata ao redor em tábuas. Produz madeira o tempo todo.',
  },
  pedreira: {
    nome: 'Pedreira', cat: 'recurso', tam: 2, hp: 460, custo: { moedas: 80, madeira: 90 }, cresce: 1.6, tempo: 10,
    producao: { pedra: 12 }, limite: [1, 1, 2, 2, 3, 3, 3, 3],
    desc: 'Quebra rocha para muros, canhões e melhorias.',
  },
  mina: {
    nome: 'Mina de Ferro', cat: 'recurso', tam: 2, hp: 480, custo: { moedas: 150, madeira: 150, pedra: 120 }, cresce: 1.6, tempo: 15,
    producao: { ferro: 6 }, limite: [0, 1, 1, 2, 2, 3, 3, 3], precisaVeio: true,
    desc: 'Só pode ser construída em cima de um veio de ferro (manchas laranja no chão).',
  },
  mercado: {
    nome: 'Mercado', cat: 'recurso', tam: 2, hp: 400, custo: { madeira: 120, pedra: 60 }, cresce: 1.6, tempo: 12,
    producao: { moedas: 14 }, limite: [1, 1, 2, 2, 2, 3, 3, 3],
    desc: 'Vende o excedente da vila para os viajantes. Rende moedas.',
  },
  deposito: {
    nome: 'Depósito', cat: 'recurso', tam: 2, hp: 600, custo: { moedas: 100, madeira: 150, pedra: 150 }, cresce: 1.7, tempo: 12,
    capacidade: 700, limite: [1, 1, 2, 2, 3, 3, 4, 4],
    desc: 'Aumenta o limite de todos os recursos guardados.',
  },
  vigia: {
    nome: 'Torre de Vigia', cat: 'suporte', tam: 2, hp: 500, maxNivel: 3, custo: { moedas: 200, madeira: 250, pedra: 100 }, cresce: 1.8, tempo: 20,
    alerta: [2, 4, 6], limite: [0, 0, 1, 1, 1, 1, 1, 1],
    desc: 'Avisa de qual lado da floresta a próxima onda vai sair, minutos antes.',
  },
  barracao: {
    nome: 'Barracão', cat: 'suporte', tam: 2, hp: 450, maxNivel: 1, custo: { moedas: 300, madeira: 300, pedra: 200 }, cresce: 1, tempo: 25,
    limite: [0, 0, 1, 1, 1, 1, 1, 1],
    desc: 'Casa de mais um construtor: duas obras viram três.',
  },
  atiradores: {
    nome: 'Torre de Atiradores', cat: 'defesa', tam: 2, hp: 520, custo: { moedas: 80, madeira: 120, pedra: 40 }, cresce: 1.55, tempo: 10,
    dano: 20, cadencia: 0.55, alcance: 6, ar: true, limite: [2, 2, 3, 3, 4, 4, 5, 6],
    desc: 'Tiro rápido em um alvo por vez. Acerta tropas e helicópteros.',
  },
  canhao: {
    nome: 'Canhão', cat: 'defesa', tam: 2, hp: 700, custo: { moedas: 150, madeira: 80, pedra: 180 }, cresce: 1.55, tempo: 14,
    dano: 58, cadencia: 1.5, alcance: 5, ar: false, limite: [0, 1, 2, 2, 3, 3, 4, 4],
    desc: 'Bala pesada contra quem vem pelo chão. A resposta para os tratores.',
  },
  morteiro: {
    nome: 'Morteiro', cat: 'defesa', tam: 2, hp: 600, custo: { moedas: 300, madeira: 150, pedra: 250, ferro: 40 }, cresce: 1.6, tempo: 20,
    dano: 42, cadencia: 3.6, alcance: 9, minimo: 2.5, area: 1.4, ar: false, limite: [0, 0, 0, 1, 1, 2, 2, 3],
    desc: 'Granada em área, de muito longe. Não acerta quem está colado nele.',
  },
  tesla: {
    nome: 'Tesla', cat: 'defesa', tam: 2, hp: 520, custo: { moedas: 350, pedra: 150, ferro: 120 }, cresce: 1.6, tempo: 25,
    dano: 34, cadencia: 1.1, alcance: 4.5, saltos: 3, ar: true, limite: [0, 0, 0, 0, 1, 2, 2, 3],
    desc: 'Raio que pula entre até 3 inimigos próximos. Fritura garantida.',
  },
  muro: {
    nome: 'Muro', cat: 'defesa', tam: 1, hp: 380, custo: { pedra: 20 }, cresce: 1.5, tempo: 0, parede: true,
    limite: [0, 20, 30, 40, 50, 60, 70, 80],
    desc: 'Segura e desvia as tropas. Os lenhadores de motosserra adoram cortar.',
  },
  armadilha: {
    nome: 'Mina Terrestre', cat: 'defesa', tam: 1, hp: 1, maxNivel: 3, custo: { moedas: 60, pedra: 20 }, cresce: 1.6, tempo: 2,
    dano: 150, area: 1.3, escondida: true, limite: [0, 0, 4, 6, 8, 10, 12, 14],
    desc: 'Escondida no chão. Explode uma vez quando uma tropa passa por cima; depois precisa rearmar.',
  },
};

export const ORDEM_LOJA = {
  recurso: ['serraria', 'pedreira', 'mercado', 'mina', 'deposito'],
  defesa: ['atiradores', 'canhao', 'morteiro', 'tesla', 'muro', 'armadilha'],
  suporte: ['vigia', 'barracao'],
};

/**
 * Inimigos da Companhia Serra Grande.
 *  vel em tiles/s, alcance em tiles, alvo = preferência de ataque, custo = peso na onda
 */
export const INIMIGOS = {
  fuzileiro: { nome: 'Fuzileiro', hp: 60, vel: 1.1, dano: 6, cadencia: 1, alcance: 2, alvo: 'qualquer', custo: 1, desde: 1 },
  motosserra: { nome: 'Lenhador de motosserra', hp: 95, vel: 1.25, dano: 20, cadencia: 0.8, alcance: 0.9, alvo: 'muro', custo: 2, desde: 2, bonusMuro: 3 },
  motoqueiro: { nome: 'Motoqueiro', hp: 55, vel: 2.6, dano: 12, cadencia: 0.9, alcance: 1, alvo: 'recurso', custo: 2, desde: 3 },
  bazuca: { nome: 'Bazuqueiro', hp: 75, vel: 0.9, dano: 48, cadencia: 2.6, alcance: 4.5, alvo: 'defesa', custo: 3, desde: 4 },
  engenheiro: { nome: 'Engenheiro sabotador', hp: 65, vel: 1, dano: 6, cadencia: 7, alcance: 3, alvo: 'defesa', custo: 3, desde: 6, sabota: 3.5 },
  trator: { nome: 'Trator blindado', hp: 650, vel: 0.55, dano: 42, cadencia: 2, alcance: 1.2, alvo: 'qualquer', custo: 10, desde: 8, abreMata: true },
  colheitadeira: { nome: 'Colheitadeira Gigante', hp: 2400, vel: 0.4, dano: 90, cadencia: 2.4, alcance: 1.6, alvo: 'qualquer', chefe: true, abreMata: true, area: 1.2 },
  helicoptero: { nome: 'Helicóptero da Companhia', hp: 1500, vel: 1.2, dano: 32, cadencia: 1.2, alcance: 4, alvo: 'defesa', chefe: true, ar: true },
};

export const DURACAO_MAX_BATALHA = 240; // segundos: depois disso a tropa que sobrou recua
export const PERDA_SE_QG_CAIR = 0.3;
export const REPARO = 0.3; // reparar custa 30% do custo do nível atual
