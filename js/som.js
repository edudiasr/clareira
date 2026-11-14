// Efeitos sonoros sintetizados na hora com Web Audio (nenhum arquivo de áudio).

let ctx = null;
let mestre = null;
let ligado = true;
const ultimo = new Map();

export function iniciarSom() {
  if (ctx) return ctx.state === 'suspended' && ctx.resume();
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  mestre = ctx.createGain();
  mestre.gain.value = 0.35;
  mestre.connect(ctx.destination);
}

export const somLigado = () => ligado;
export function alternarSom(v = !ligado) {
  ligado = v;
  return ligado;
}

function ruido(dur) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

function envelope(no, vol, ataque, dur) {
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  no.connect(g);
  g.connect(mestre);
  return g;
}

function estouro(dur, freq, vol, tipo = 'lowpass') {
  const s = ruido(dur);
  const f = ctx.createBiquadFilter();
  f.type = tipo;
  f.frequency.value = freq;
  s.connect(f);
  envelope(f, vol, 0.005, dur);
  s.start();
}

function tom(freq, dur, vol, forma = 'sine', ate = null) {
  const o = ctx.createOscillator();
  o.type = forma;
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  if (ate) o.frequency.exponentialRampToValueAtTime(ate, ctx.currentTime + dur);
  envelope(o, vol, 0.01, dur);
  o.start();
  o.stop(ctx.currentTime + dur + 0.05);
}

const SONS = {
  tiro: () => estouro(0.07, 2500, 0.18, 'highpass'),
  canhao: () => { estouro(0.4, 400, 0.5); tom(90, 0.3, 0.3, 'sine', 40); },
  morteiro: () => { tom(180, 0.15, 0.2, 'triangle', 90); },
  explosao: () => { estouro(0.8, 600, 0.55); tom(70, 0.5, 0.35, 'sine', 30); },
  destruido: () => { estouro(1.2, 350, 0.7); tom(55, 0.8, 0.4, 'sine', 25); },
  raio: () => { tom(900, 0.18, 0.12, 'sawtooth', 120); estouro(0.12, 3000, 0.12, 'highpass'); },
  foguete: () => estouro(0.25, 1200, 0.15, 'bandpass'),
  sabotagem: () => tom(1400, 0.2, 0.08, 'square', 400),
  construir: () => { tom(520, 0.08, 0.15, 'triangle'); setTimeout(() => tom(780, 0.12, 0.15, 'triangle'), 90); },
  clique: () => tom(660, 0.05, 0.08, 'triangle'),
  erro: () => tom(180, 0.18, 0.15, 'square', 120),
  moeda: () => { tom(990, 0.08, 0.12, 'square'); setTimeout(() => tom(1320, 0.14, 0.12, 'square'), 70); },
  alarme: () => { tom(440, 0.35, 0.18, 'sawtooth'); setTimeout(() => tom(330, 0.45, 0.18, 'sawtooth'), 380); },
  vitoria: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tom(f, 0.25, 0.16, 'triangle'), i * 120)),
  derrota: () => [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tom(f, 0.35, 0.16, 'triangle'), i * 160)),
};

const ESPACO = { tiro: 0.06, raio: 0.08, foguete: 0.08, explosao: 0.05 };

export function tocar(nome) {
  if (!ligado || !ctx || ctx.state !== 'running' || !SONS[nome]) return;
  const agora = ctx.currentTime;
  if (agora - (ultimo.get(nome) ?? -1) < (ESPACO[nome] ?? 0.02)) return; // evita estourar o volume com 30 tiros juntos
  ultimo.set(nome, agora);
  SONS[nome]();
}
