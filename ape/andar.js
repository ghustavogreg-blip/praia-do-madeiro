// Andar dentro do 501: geometria e luz assadas no Blender (_projeto/cena_andar.py + pos.py).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const A = 'assets/';
// o montar_site.py troca por '?v=<data>': quem já visitou não fica com o 3D de uma versão e as texturas de outra
const VERSAO = '?v=20261105091154';
const $ = s => document.querySelector(s);
const cena = await fetch(A + 'cena.json' + VERSAO).then(r => r.json());
const SC = cena.sc, PW = cena.pw, PH = cena.ph;
// pixels da planta <-> mundo (glTF: x = x, z = -y do Blender)
const paraMundo = (px, py) => [(px - PW / 2) * SC, (py - PH / 2) * SC];
const paraPlanta = (x, z) => [x / SC + PW / 2, z / SC + PH / 2];

const EXPOSICAO = { dia: 1.2, tarde: 0.55 };
// o ambiente do pôr do sol sai ~10x mais claro que o do dia (luzes acesas): reflexo equilibrado com o mapa assado
const REFLEXO = { dia: 1, tarde: 0.15 };
const COMODOS = [   // retângulos em pixels da planta, o primeiro que contém a posição ganha; [artigo, nome, ...]
  ['no', 'Banheiro da suíte', 17, 17, 310, 149], ['na', 'Suíte', 17, 149, 312, 500], ['no', 'Quarto', 318, 17, 600, 356],
  ['no', 'Banheiro', 140, 505, 313, 730],
  ['na', 'Varanda', 597, 70, 900, 192], ['na', 'Cozinha', 738, 196, 900, 497], ['na', 'Área de serviço', 733, 497, 900, 650],
  ['na', 'Sala de jantar', 600, 196, 738, 440], ['na', 'Sala', 300, 196, 900, 660],
];

// ---------- renderizador ----------
const canvas = $('#cena');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 500);
camera.rotation.order = 'YXZ';

const manager = new THREE.LoadingManager();
manager.setURLModifier(u => /^(https?:|data:|blob:)/.test(u) ? u : u + VERSAO);
manager.onProgress = (_, feitos, total) => { const p = Math.round(feitos / total * 100); $('#pct').textContent = p + '%'; $('#barra').style.width = p + '%'; };
const texLoader = new THREE.TextureLoader(manager);
// rede ruim (4G) ou falha passageira do servidor: tenta de novo antes de desistir, senão o apê fica preso em "Montando"
const tentar = (carregar, vezes = 4) => carregar().catch(e => vezes > 1 ? new Promise(r => setTimeout(r, 1200)).then(() => tentar(carregar, vezes - 1)) : Promise.reject(e));
const tex = (nome, srgb = true) => tentar(() => texLoader.loadAsync(A + nome)).then(t => {
  t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
});

// panorâmica HDR em RGBE (web_formatos.py)
const fileLoader = new THREE.FileLoader(manager); fileLoader.setResponseType('json');
const base64 = t => { const s = atob(t), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
const hdr = nome => tentar(() => fileLoader.loadAsync(A + nome)).then(({ w, h, rgbe }) => {
  const b = base64(rgbe), d = new Uint16Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, o = ((h - 1 - y) * w + x) * 4, f = b[i + 3] ? 2 ** (b[i + 3] - 136) : 0;   // linha 0 embaixo
    for (let k = 0; k < 3; k++) d[o + k] = THREE.DataUtils.toHalfFloat(b[i + k] * f);
    d[o + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  const t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
  t.colorSpace = THREE.LinearSRGBColorSpace; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
});

const GRUPOS = ['piso', 'paredes', 'moveis', 'decor'];   // decor = plantas, vasos e garrafas, com mapa próprio
const [gltf, mascara, ...texs] = await Promise.all([
  // geometria comprimida com Draco (_projeto/comprimir_glb.py): 16 MB -> 2 MB, para abrir no 4G
  tentar(() => new GLTFLoader(manager).setDRACOLoader(new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/'))
    .loadAsync(A + 'ape501_draco.glb')),
  tentar(() => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = A + 'anda.png' + VERSAO; })),
  ...GRUPOS.flatMap(g => [tex(`${g}_cor.webp`), tex(`${g}_luz_dia.webp`), tex(`${g}_luz_tarde.webp`), tex(`${g}_brilho.webp`, false)]),
  ...['dia', 'tarde'].map(h => tentar(() => texLoader.loadAsync(A + `ceu_${h}.webp`)).then(t => { t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; return t; })),
  ...['dia', 'tarde'].map(h => hdr(`ambiente_${h}.json`)),
]);
const N = GRUPOS.length * 4;
const ceu = { dia: texs[N], tarde: texs[N + 1] };
// reflexo: panorâmica de dentro da sala (Blender) pré-filtrada para cada rugosidade
const pmrem = new THREE.PMREMGenerator(renderer);
const amb = { dia: pmrem.fromEquirectangular(texs[N + 2]).texture, tarde: pmrem.fromEquirectangular(texs[N + 3]).texture };
// a luz difusa já está no mapa assado: do ambiente só entra o reflexo, senão a luz conta duas vezes
const soReflexo = sh => {
  sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_maps>',
    THREE.ShaderChunk.lights_fragment_maps.replace('iblIrradiance += getIBLIrradiance( geometryNormal );', ''));
};
const mats = {};
GRUPOS.forEach((g, i) => {
  const [cor, luzDia, luzTarde, brilho] = texs.slice(i * 4, i * 4 + 4);
  const m = new THREE.MeshStandardMaterial({ map: cor, lightMap: luzDia, roughnessMap: brilho, roughness: 1, metalness: 0, envMap: amb.dia, envMapIntensity: 1 });
  m.onBeforeCompile = soReflexo;
  mats[g] = { m, luz: { dia: luzDia, tarde: luzTarde } };
});
const vidro = new THREE.MeshStandardMaterial({ color: 0xe4f1f5, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.18, depthWrite: false, envMap: amb.dia });
vidro.onBeforeCompile = soReflexo;
const led = new THREE.MeshBasicMaterial({ color: 0xffd9a8 });
let leds = null;
gltf.scene.traverse(o => {
  if (!o.isMesh) return;
  const g = GRUPOS.find(n => o.name.startsWith(n));
  if (g) o.material = mats[g].m;
  else if (o.name.startsWith('vidro')) o.material = vidro;
  else if (o.name.startsWith('luz')) { o.material = led; leds = o; }
});
scene.add(gltf.scene);

// espelhos dos banheiros: no mapa assado o espelho sai preto (é metal); aqui vira espelho de verdade, desenhado só quando aparece na tela.
// Mesmas medidas do cena_andar.py (bancada_pia): px da planta ao longo da parede, face na linha "face", de 1,10 a 1,95 m de altura.
const ESPELHOS = [
  { de: 238, ate: 300, face: 18.5, parede: 'n' },    // banheiro da suíte: parede norte, olha para o sul
  { de: 521, ate: 584, face: 141.1, parede: 'o' },   // banheiro social: parede oeste, olha para o leste
];
for (const e of ESPELHOS) {
  const largura = (e.ate - e.de) * SC, meio = (e.de + e.ate) / 2;
  const espelho = new Reflector(new THREE.PlaneGeometry(largura, 0.85), { clipBias: 0.003, textureWidth: 768, textureHeight: Math.round(768 * 0.85 / largura), color: 0xdfe3e4 });
  if (e.parede === 'n') { const [x, z] = paraMundo(meio, e.face); espelho.position.set(x, 1.525, z + 0.003); }
  else { const [x, z] = paraMundo(e.face, meio); espelho.position.set(x + 0.003, 1.525, z); espelho.rotation.y = Math.PI / 2; }
  scene.add(espelho);
}

// ---------- máscara de onde dá para andar ----------
const mc = document.createElement('canvas'); mc.width = PW; mc.height = PH;
const mctx = mc.getContext('2d', { willReadFrequently: true }); mctx.drawImage(mascara, 0, 0);
const livre = mctx.getImageData(0, 0, PW, PH).data;
const pode = (x, z) => {
  const [px, py] = paraPlanta(x, z).map(Math.round);
  return px >= 0 && py >= 0 && px < PW && py < PH && livre[(py * PW + px) * 4] > 127;
};

// ---------- horário ----------
function horario(h) {
  for (const g of GRUPOS) { const { m, luz } = mats[g]; m.lightMap = luz[h]; m.lightMapIntensity = Math.PI * cena.escala[h]; m.envMap = amb[h]; m.envMapIntensity = REFLEXO[h]; m.needsUpdate = true; }
  vidro.envMap = amb[h]; vidro.envMapIntensity = REFLEXO[h]; vidro.needsUpdate = true;
  scene.background = ceu[h]; scene.backgroundRotation.y = Math.PI;
  renderer.toneMappingExposure = EXPOSICAO[h];
  if (leds) leds.visible = h === 'tarde';
  document.querySelectorAll('.horario button').forEach(b => b.classList.toggle('on', b.dataset.h === h));
}
document.querySelectorAll('.horario button').forEach(b => b.addEventListener('click', () => horario(b.dataset.h)));
horario('dia');

// ---------- jogador ----------
const [x0, z0] = paraMundo(...cena.inicio);
const eu = { x: x0, z: z0, yaw: 0, pitch: -0.04 };   // yaw 0 = olhando para a varanda (norte)
// link direto para um cômodo (passeio.html#suite): começa lá dentro, olhando para o ponto indicado (px da planta)
const PARTIDAS = { quarto: [[380, 300], [470, 20]], suite: [[205, 420], [300, 280]], banho_suite: [[205, 130], [90, 40]], banho: [[300, 560], [170, 680]],
                   cozinha: [[700, 470], [840, 250]], varanda: [[700, 175], [700, 90]] };
// também aceita um ponto qualquer: passeio.html#x,y,mx,my (px da planta: onde fica e para onde olha)
const numeros = location.hash.slice(1).split(',').map(Number);
const partida = PARTIDAS[location.hash.slice(1)] || (numeros.length === 4 && numeros.every(Number.isFinite) ? [numeros.slice(0, 2), numeros.slice(2)] : null);
if (partida) {
  const [[px, py], [ax, ay]] = partida; [eu.x, eu.z] = paraMundo(px, py);
  const [tx, tz] = paraMundo(ax, ay); eu.yaw = Math.atan2(tx - eu.x, -(tz - eu.z));
}
const teclas = new Set();
addEventListener('keydown', e => { teclas.add(e.key.toLowerCase()); esconderDica(); if (/^(w|a|s|d|arrow)/.test(e.key.toLowerCase())) pararTour(); });
addEventListener('keyup', e => teclas.delete(e.key.toLowerCase()));

// olhar: arrastar na tela (mouse ou dedo fora do direcional)
let olhar = null;
canvas.addEventListener('pointerdown', e => { olhar = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); esconderDica(); pararTour(); });
canvas.addEventListener('pointermove', e => {
  if (!olhar || e.pointerId !== olhar.id) return;
  const k = e.pointerType === 'touch' ? 0.006 : 0.0038;
  eu.yaw += (e.clientX - olhar.x) * k; eu.pitch = Math.max(-1.1, Math.min(1.0, eu.pitch + (e.clientY - olhar.y) * k));
  olhar.x = e.clientX; olhar.y = e.clientY;
});
const soltar = e => { if (olhar && e.pointerId === olhar.id) olhar = null; };
canvas.addEventListener('pointerup', soltar); canvas.addEventListener('pointercancel', soltar);

// direcional (celular)
const joy = $('#joy'), bola = joy.querySelector('i');
let dir = { x: 0, y: 0 }, joyId = null;
joy.addEventListener('pointerdown', e => { joyId = e.pointerId; joy.setPointerCapture(e.pointerId); moverJoy(e); esconderDica(); pararTour(); });
joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) moverJoy(e); });
const pararJoy = e => { if (e.pointerId !== joyId) return; joyId = null; dir = { x: 0, y: 0 }; bola.style.transform = ''; };
joy.addEventListener('pointerup', pararJoy); joy.addEventListener('pointercancel', pararJoy);
function moverJoy(e) {
  const r = joy.getBoundingClientRect(), R = r.width / 2;
  let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
  const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
  dir = { x: dx / R, y: dy / R }; bola.style.transform = `translate(${dx}px, ${dy}px)`;
}

// ---------- tour automático ----------
// rota pelo meio dos espaços livres, calculada por _projeto/rota_tour.py: [x, y, olhaX, olhaY, segundos parado] em px da planta
const TOUR = [[672, 600, 560, 420, 1.2], [571, 507, null, null, 0], [560, 518, 420, 470, 2.2], [736, 468, null, null, 0], [788, 454, null, null, 0], [790, 380, 870, 320, 2.0], [769, 248, null, null, 0], [661, 196, null, null, 0], [659, 188, null, null, 0], [656, 180, null, null, 0], [655, 165, 860, 130, 2.4], [656, 178, null, null, 0], [658, 186, null, null, 0], [671, 211, null, null, 0], [781, 267, null, null, 0], [772, 470, null, null, 0], [520, 475, 368, 362, 0.0], [388, 467, null, null, 0], [385, 269, null, null, 0], [470, 230, 560, 110, 2.2], [375, 286, null, null, 0], [336, 451, null, null, 0], [247, 442, null, null, 0], [242, 431, null, null, 0], [234, 413, 150, 290, 2.2], [86, 401, null, null, 0], [90, 189, null, null, 0], [196, 174, null, null, 0], [199, 111, 275, 40, 1.8], [189, 181, null, null, 0], [83, 195, null, null, 0], [91, 404, null, null, 0], [234, 415, null, null, 0], [240, 427, null, null, 0], [251, 447, null, null, 0], [360, 476, null, null, 0], [336, 546, null, null, 0], [290, 560, 180, 690, 1.8], [428, 496, null, null, 0], [520, 518, 690, 200, 0.0]];
const tourBtn = $('#tourBtn');
let tour = null;   // { i: ponto da vez, parado: segundos já parados nele }
const rumo = (px, py) => { const [x, z] = paraMundo(px, py); return Math.atan2(x - eu.x, -(z - eu.z)); };
const angulo = a => Math.atan2(Math.sin(a), Math.cos(a));
function comecarTour() {
  [eu.x, eu.z] = paraMundo(TOUR[0][0], TOUR[0][1]); eu.yaw = rumo(TOUR[0][2], TOUR[0][3]); eu.pitch = -0.04;
  tour = { i: 0, parado: 0 }; marcarTour(); esconderDica();
}
function pararTour() { if (!tour) return; tour = null; marcarTour(); }
function marcarTour() { tourBtn.classList.toggle('on', !!tour); tourBtn.querySelector('span').textContent = tour ? 'Parar o tour' : 'Fazer o tour'; }
tourBtn.addEventListener('click', () => tour ? pararTour() : comecarTour());
function passoTour(dt) {
  const [px, py, mx, my, pausa] = TOUR[tour.i];
  const [tx, tz] = paraMundo(px, py), dx = tx - eu.x, dz = tz - eu.z, d = Math.hypot(dx, dz);
  let alvo = eu.yaw;
  if (d > 0.02) {
    const v = Math.min(d, 0.9 * dt); eu.x += dx / d * v; eu.z += dz / d * v;
    alvo = mx != null && d < 0.7 ? rumo(mx, my) : Math.atan2(dx, -dz);   // chegando numa parada, já vira para o que ela mostra
  } else {
    if (mx != null) alvo = rumo(mx, my);
    tour.parado += dt;
    if (tour.parado >= pausa) { tour.i++; tour.parado = 0; if (tour.i >= TOUR.length) pararTour(); }
  }
  eu.yaw += angulo(alvo - eu.yaw) * Math.min(1, dt * 2.4);
  eu.pitch += (-0.04 - eu.pitch) * Math.min(1, dt * 2);
}

let dicaFora = false;
function esconderDica() { if (dicaFora) return; dicaFora = true; setTimeout(() => $('#dica').classList.add('some'), 1800); }

// ---------- mapa ----------
const mapa = $('#mapa'), mg = mapa.getContext('2d');
const planta = new Image(); planta.src = A + 'planta_501.webp' + VERSAO;
function desenharMapa() {
  if (!planta.complete) return;
  const w = mapa.width, h = mapa.height, s = Math.min(w / PW, h / PH), ox = (w - PW * s) / 2, oy = (h - PH * s) / 2;
  mg.clearRect(0, 0, w, h); mg.drawImage(planta, ox, oy, PW * s, PH * s);
  const [px, py] = paraPlanta(eu.x, eu.z), cx = ox + px * s, cy = oy + py * s;
  const ang = -Math.PI / 2 + eu.yaw, R = 34;
  const g = mg.createRadialGradient(cx, cy, 2, cx, cy, R); g.addColorStop(0, 'rgba(213,117,177,.7)'); g.addColorStop(1, 'rgba(213,117,177,0)');
  mg.fillStyle = g; mg.beginPath(); mg.moveTo(cx, cy); mg.arc(cx, cy, R, ang - 0.6, ang + 0.6); mg.closePath(); mg.fill();
  mg.fillStyle = '#fff'; mg.strokeStyle = '#D575B1'; mg.lineWidth = 3; mg.beginPath(); mg.arc(cx, cy, 5.5, 0, Math.PI * 2); mg.fill(); mg.stroke();
}

// ---------- laço ----------
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 78 : 66; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

let antes = performance.now(), comodoAtual = '';
function passo(agora) {
  const dt = Math.min(0.05, (agora - antes) / 1000); antes = agora;
  let f = 0, l = 0;
  if (teclas.has('w') || teclas.has('arrowup')) f += 1;
  if (teclas.has('s') || teclas.has('arrowdown')) f -= 1;
  if (teclas.has('a')) l -= 1;
  if (teclas.has('d')) l += 1;
  if (teclas.has('arrowleft')) eu.yaw -= 1.8 * dt;
  if (teclas.has('arrowright')) eu.yaw += 1.8 * dt;
  f -= dir.y; l += dir.x;
  if (tour) passoTour(dt);
  const v = (teclas.has('shift') ? 2.4 : 1.35) * dt;
  if (f || l) {
    const n = Math.hypot(f, l); f /= Math.max(1, n); l /= Math.max(1, n);
    // yaw 0 olha para -z (norte); direita = +x
    const dx = (Math.sin(eu.yaw) * f + Math.cos(eu.yaw) * l) * v, dz = (-Math.cos(eu.yaw) * f + Math.sin(eu.yaw) * l) * v;
    if (pode(eu.x + dx, eu.z + dz)) { eu.x += dx; eu.z += dz; }
    else if (pode(eu.x + dx, eu.z)) eu.x += dx;      // escorrega na parede
    else if (pode(eu.x, eu.z + dz)) eu.z += dz;
  }
  camera.position.set(eu.x, cena.olho, eu.z);
  camera.rotation.set(eu.pitch, -eu.yaw, 0);
  renderer.render(scene, camera);

  const [px, py] = paraPlanta(eu.x, eu.z);
  const [art, c] = COMODOS.find(([, , a, b, cc, d]) => px >= a && px <= cc && py >= b && py <= d) || ['na', 'Sala'];
  if (c !== comodoAtual) { comodoAtual = c; $('#comodo').textContent = c; $('#artigo').textContent = `Você está ${art}`; }
  desenharMapa();
  requestAnimationFrame(passo);
}
$('#carregando').classList.add('some');
requestAnimationFrame(passo);
if (location.hash === '#tour') comecarTour();   // vindo do botão "Entrar no apê" do site do prédio
