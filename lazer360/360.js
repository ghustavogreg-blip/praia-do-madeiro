// Visualizador 360° das imagens renderizadas no Blender (_projeto/cena_andar.py -- pano360).
import * as THREE from 'three';

const A = 'assets/360/';
const $ = s => document.querySelector(s);
// o que muda de um apê para outro (501 / 503) vem do assets/apto.json: escala da planta, cômodos e ligações
const VERSAO = '?v=20261111080531';   // o montar_site.py troca por '?v=<data>' (evita imagem velha do cache depois de republicar)
const apto = await fetch('assets/apto.json' + VERSAO).then(r => r.json());
const SC = apto.sc, PW = apto.pw, PH = apto.ph;
// posição de cada vista em px da planta (= PONTOS_360 do apto_<n>.py); frente = para onde a vista abre pela miniatura
const COMODOS = apto.c360;
// pontos no chão só para os cômodos que dá para ver dali; com porta, o ponto fica na porta (px da planta)
const LIGA = apto.liga;
document.querySelector('.marca strong').firstChild.textContent = apto.titulo;
const semRender = document.querySelector('#semRender'); if (semRender) semRender.textContent = apto.sem_render;
const yawPara = (de, para) => { const d = mundo(para).sub(mundo(de)); return -Math.atan2(d.x, -d.z); };   // rotation.y positivo gira para a esquerda
const mundo = ([px, py]) => new THREE.Vector3((px - PW / 2) * SC, 0, (py - PH / 2) * SC);

const canvas = $('#cena');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1100);
camera.rotation.order = 'YXZ';

// esfera por dentro; a panorâmica do Blender tem o norte (varanda) no centro da imagem
const geo = new THREE.SphereGeometry(500, 96, 48); geo.scale(-1, 1, 1);
const esfera = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
esfera.rotation.y = -Math.PI / 2;
scene.add(esfera);

const manager = new THREE.LoadingManager();
manager.setURLModifier(u => /^(https?:|data:|blob:)/.test(u) ? u : u + VERSAO);
manager.onProgress = (_, f, t) => { const p = Math.round(f / t * 100); $('#pct').textContent = p + '%'; $('#barra').style.width = p + '%'; };
const loader = new THREE.TextureLoader(manager);
const cache = {};
// falha passageira (4G, servidor): tenta de novo; se não der, esquece o cache para o próximo clique tentar outra vez
const tentar = (carregar, vezes = 4) => carregar().catch(e => vezes > 1 ? new Promise(r => setTimeout(r, 1200)).then(() => tentar(carregar, vezes - 1)) : Promise.reject(e));
const textura = (c, h) => cache[c + h] ||= tentar(() => loader.loadAsync(`${A}${c}_${h}.webp`)).then(t => {
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.generateMipmaps = true; return t;
}).catch(e => { delete cache[c + h]; throw e; });

// celular em pé: campo de visão maior, senão a parede enche a tela
const estado = { comodo: 'sala', h: 'dia', yaw: 0, pitch: 0, fov: innerHeight > innerWidth ? 95 : 75 };
const FOV_MAX = innerHeight > innerWidth ? 110 : 95;

// pontos para ir aos outros cômodos, na direção real de cada um
const pontos = {};
for (const c of COMODOS) {
  const b = document.createElement('button'); b.className = 'ponto'; b.innerHTML = `<i></i>${c.nome}`;
  b.addEventListener('click', () => ir(c.id, true)); $('#pontos').appendChild(b); pontos[c.id] = b;
}

// miniaturas
for (const c of COMODOS) {
  const b = document.createElement('button'); b.dataset.c = c.id;
  b.innerHTML = `<img src="${A}${c.id}_dia_mini.jpg" alt=""><span>${c.nome}</span>`;
  b.addEventListener('click', () => ir(c.id)); $('#trilho').appendChild(b);
}

async function mostrar() {
  const t = await textura(estado.comodo, estado.h);
  esfera.material.map = t; esfera.material.needsUpdate = true;
  document.querySelectorAll('#trilho button').forEach(b => b.classList.toggle('on', b.dataset.c === estado.comodo));
  // pré-carrega só os cômodos ligados a este (cada imagem tem ~600 KB: no 4G não dá para baixar todas de uma vez)
  Object.keys(LIGA[estado.comodo]).forEach(c => textura(c, estado.h));
}
let trocas = 0;
// pelos pontos do chão: olha para onde andou; pelas miniaturas: abre na frente do cômodo (o mesmo recorte da miniatura)
async function ir(id, andando = false) {
  if (id === estado.comodo) return;
  const de = COMODOS.find(c => c.id === estado.comodo), para = COMODOS.find(c => c.id === id);
  const via = LIGA[de.id][id];
  const vez = ++trocas;
  await textura(id, estado.h);   // a troca só anima com a imagem já carregada
  if (vez !== trocas) return;
  estado.comodo = id; estado.pitch = 0;
  estado.yaw = andando ? yawPara(de.px, via || para.px) : para.frente ? yawPara(para.px, para.frente) : 0;
  canvas.classList.remove('troca'); void canvas.offsetWidth; canvas.classList.add('troca');
  await mostrar();
}
document.querySelectorAll('.horario button').forEach(b => b.addEventListener('click', async () => {
  estado.h = b.dataset.h; document.querySelectorAll('.horario button').forEach(x => x.classList.toggle('on', x === b)); await mostrar();
}));

// olhar e aproximar
let arr = null; const toques = new Map(); let pinca = null;
canvas.addEventListener('pointerdown', e => { toques.set(e.pointerId, e); canvas.setPointerCapture(e.pointerId); arr = { x: e.clientX, y: e.clientY }; $('#dica').classList.add('some'); });
canvas.addEventListener('pointermove', e => {
  if (!toques.has(e.pointerId)) return; toques.set(e.pointerId, e);
  if (toques.size === 2) {
    const [a, b] = [...toques.values()]; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (pinca) estado.fov = Math.max(35, Math.min(FOV_MAX, estado.fov * pinca / d)); pinca = d; return;
  }
  if (!arr) return;
  const k = estado.fov / innerHeight * Math.PI / 180;
  estado.yaw += (e.clientX - arr.x) * k;   // a imagem acompanha o dedo
  estado.pitch = Math.max(-1.3, Math.min(1.3, estado.pitch + (e.clientY - arr.y) * k));
  arr = { x: e.clientX, y: e.clientY };
});
const fim = e => { toques.delete(e.pointerId); if (toques.size < 2) pinca = null; if (!toques.size) arr = null; };
canvas.addEventListener('pointerup', fim); canvas.addEventListener('pointercancel', fim);
canvas.addEventListener('wheel', e => { e.preventDefault(); estado.fov = Math.max(35, Math.min(FOV_MAX, estado.fov + e.deltaY * 0.04)); }, { passive: false });

function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const v = new THREE.Vector3();
function passo() {
  camera.fov = estado.fov; camera.updateProjectionMatrix();
  camera.rotation.set(estado.pitch, estado.yaw, 0);
  renderer.render(scene, camera);
  const aqui = COMODOS.find(c => c.id === estado.comodo);
  for (const c of COMODOS) {
    const b = pontos[c.id];
    if (!(c.id in LIGA[estado.comodo])) { b.hidden = true; continue; }
    // ponto no chão, na direção do outro cômodo ou da porta que leva a ele (olhos a 1,5 m)
    const via = LIGA[estado.comodo][c.id];
    const d = mundo(via || c.px).sub(mundo(aqui.px)); const dist = d.length();
    // na porta: na altura do peito (porta perto, no chão sairia da tela); cômodo aberto: no chão
    v.set(d.x, via ? -0.35 : -1.5 + Math.min(0.9, dist * 0.12), d.z).normalize().multiplyScalar(10).project(camera);
    b.hidden = v.z > 1;
    b.style.left = `${(v.x + 1) / 2 * innerWidth}px`; b.style.top = `${(1 - v.y) / 2 * innerHeight}px`;
  }
  requestAnimationFrame(passo);
}
// link direto para um cômodo (360.html#suite): abre lá, na frente do cômodo
const inicial = COMODOS.find(c => c.id === location.hash.slice(1));
if (inicial) { estado.comodo = inicial.id; if (inicial.frente) estado.yaw = yawPara(inicial.px, inicial.frente); }
await mostrar();
$('#carregando').classList.add('some');
requestAnimationFrame(passo);
