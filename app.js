import { TORRES, ANDARES, FINAIS, PLANTAS, PLANTA_DO_FINAL, statusDa, LAZER, numeroDe, plantaDe, FOTOS_LAZER, TOUR_LAZER } from './data.js?v=20261111080531';
const nomeAndar = k => k ? `${k}º andar` : 'Térreo';

const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const NOME_STATUS = { disponivel: 'Disponível', reservado: 'Reservado', vendido: 'Vendido' };
const IMG = 'assets/img/';

const estado = { torre: 1, andar: null };

// ---------- modo apresentação: o Matheus mostra no celular, tablet ou notebook ao lado do cliente ----------
const telaCheia = $('#telaCheia');
const marcarTela = () => { telaCheia.textContent = document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia'; };
telaCheia.addEventListener('click', () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => {}));
document.addEventListener('fullscreenchange', marcarTela);
if (!document.documentElement.requestFullscreen) telaCheia.hidden = true;   // iPhone não tem tela cheia de página

// sem internet no estande: o site fica guardado no aparelho (sw.js); avisa uma vez quando terminou de guardar
// celular e tablet recebem os mapas do apê pela metade (assets/m/): os cheios pedem ~600 MB de vídeo e travavam em "100%"
// (mesma regra do andar.js)
const LEVE = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 820 || (navigator.deviceMemory || 8) <= 4;
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // publicou versão nova: quando o novo sw.js assume, recarrega uma vez para mostrar a versão nova
  const tinhaControle = !!navigator.serviceWorker.controller; let recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (tinhaControle && !recarregou) { recarregou = true; location.reload(); } });
  // os apês completos só depois que o site abriu e ficou parado um pouco (não disputa a internet com o que está abrindo)
  navigator.serviceWorker.ready.then(reg => setTimeout(() => {
    if (!navigator.connection?.saveData) reg.active?.postMessage({ baixar: LEVE ? 'leve' : 'cheio' });
  }, 20000)).catch(() => {});
  navigator.serviceWorker.addEventListener('message', ev => {
    if (!ev.data?.offline) return;
    const aviso = el('div', 'aviso-offline', 'Pronto: o site já funciona sem internet neste aparelho');
    document.body.appendChild(aviso); setTimeout(() => aviso.classList.add('some'), 4500); setTimeout(() => aviso.remove(), 5200);
  });
}

// ---------- 1. aérea com zoom na rolagem ----------
const AW = 2400, AH = 1190, FOCO = [1390, 495];
const hero = $('.hero'), aerea = $('#aerea'), heroTexto = $('.hero-texto'), rolar = $('.hero-rolar'), topo = $('.topo');
let s0 = 1;

TORRES.forEach(t => {
  const b = el('button', 'pino', `<b>Torre ${t.id}</b><i></i>`);
  b.style.left = `${t.pin[0] / AW * 100}%`;
  b.style.top = `${t.pin[1] / AH * 100}%`;
  b.addEventListener('click', () => { escolherTorre(t.id); $('#escolha').scrollIntoView({ behavior: 'smooth' }); });
  $('#pinos').appendChild(b);
});

function layoutAerea() {
  const vw = innerWidth, vh = hero.querySelector('.hero-sticky').clientHeight;
  s0 = Math.max(vw / AW, vh / AH);
  const w = AW * s0, h = AH * s0;
  // foco das torres no centro (no celular, um pouco acima para sobrar espaço para o texto)
  const fy = vw < 700 ? 0.36 : 0.42;
  const fx = vw > 900 ? 0.66 : 0.5;   // tela larga: torres à direita, texto à esquerda
  const L = Math.min(0, Math.max(vw - w, vw * fx - FOCO[0] * s0));
  const T = Math.min(0, Math.max(vh - h, vh * fy - FOCO[1] * s0));
  Object.assign(aerea.style, { width: `${w}px`, height: `${h}px`, left: `${L}px`, top: `${T}px`, transformOrigin: `${FOCO[0] * s0}px ${FOCO[1] * s0}px` });
  rolagem();
}

function rolagem() {
  const vh = innerHeight;
  const total = hero.offsetHeight - vh;
  const p = Math.min(1, Math.max(0, scrollY / total));
  const e = 1 - Math.pow(1 - p, 3);
  const z = 1 + (innerWidth < 700 ? 1.1 : 1.5) * e;
  aerea.style.transform = `scale(${z})`;
  aerea.style.setProperty('--z', z);
  heroTexto.style.opacity = String(Math.max(0, 1 - p * 2.6));
  heroTexto.style.transform = `translateY(${-p * 80}px)`;
  rolar.style.opacity = String(Math.max(0, 1 - p * 4));
  const pinos = document.querySelectorAll('.pino');
  pinos.forEach((b, i) => {
    b.style.opacity = p > 0.3 + i * 0.04 ? '1' : '0';
    b.style.transform = `translate(-50%, -100%) scale(${1 / z})`;
    b.style.pointerEvents = p > 0.3 ? 'auto' : 'none';
  });
  topo.classList.toggle('solido', scrollY > total * 0.95);
}
addEventListener('scroll', rolagem, { passive: true });
addEventListener('resize', layoutAerea);
layoutAerea();

// ---------- 2. as 4 torres (fotomontagem oficial) com zoom na torre e no andar ----------
const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const pts = a => a.map(p => p.join(',')).join(' ');
let svg, quadro4 = null, faixas = {}, botoesRegua = [];   // faixas[torre][andar] = polígono
const box = $('.fachada-box'), dica = $('#dica');

function resumoAndar(andar, torre = estado.torre) {
  let livres = 0;
  for (let f = 1; f <= FINAIS; f++) if (statusDa(torre, andar, f) === 'disponivel') livres++;
  return livres;
}

// zoom: anima o viewBox do SVG até uma caixa da foto (mantendo a proporção do quadro)
let vb = null, animVb = 0;
function caixaVista([x0, y0, x1, y1], margem = 0.06) {
  const asp = box.clientWidth / box.clientHeight, W = quadro4.w, H = quadro4.h;
  let w = (x1 - x0) * (1 + 2 * margem), h = (y1 - y0) * (1 + 2 * margem);
  if (w / h > asp) h = w / asp; else w = h * asp;
  if (w > W) { w = W; h = w / asp; } if (h > H) { h = H; w = h * asp; }
  const x = Math.min(Math.max((x0 + x1) / 2 - w / 2, 0), W - w), y = Math.min(Math.max((y0 + y1) / 2 - h / 2, 0), H - h);
  return [x, y, w, h];
}
function irPara(caixa, dur = 950, margem) {
  const ini = vb.slice(), fim = caixaVista(caixa, margem), t0 = performance.now();
  cancelAnimationFrame(animVb);
  return new Promise(res => {
    const passo = agora => {
      const t = Math.min(1, (agora - t0) / dur), e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      vb = ini.map((v, i) => v + (fim[i] - v) * e); svg.setAttribute('viewBox', vb.join(' '));
      if (t < 1) animVb = requestAnimationFrame(passo); else res();
    };
    animVb = requestAnimationFrame(passo);
  });
}
const torreDe = id => quadro4.torres.find(t => t.id === id);
const caixaAndar = (t, k) => {   // o andar com uns andares de contexto acima e abaixo
  const p = t.andares[k], xs = p.map(q => q[0]), ys = p.map(q => q[1]), h = Math.max(...ys) - Math.min(...ys);
  return [Math.min(...xs) - 30, Math.min(...ys) - h * 3.2, Math.max(...xs) + 30, Math.max(...ys) + h * 3.2];
};
let vista = 'geral';   // geral | torre | andar
function marcarPalco(v) { vista = v; box.dataset.vista = v; $('#verTodas').hidden = v === 'geral'; }

async function montarFachada() {
  quadro4 = await fetch('assets/torres.json').then(r => r.json());
  svg = svgEl('svg', { viewBox: `0 0 ${quadro4.w} ${quadro4.h}`, preserveAspectRatio: 'xMidYMid slice', role: 'img', 'aria-label': 'As 4 torres do Praia do Madeiro com os andares' });
  vb = [0, 0, quadro4.w, quadro4.h];
  const defs = svgEl('defs', {}); svg.appendChild(defs);
  svg.appendChild(svgEl('image', { href: IMG + 'torres.jpg', width: quadro4.w, height: quadro4.h }));
  // torres do fundo primeiro; a parte que fica atrás da torre da frente é cortada por uma máscara
  for (const t of [...quadro4.torres].sort((a, b) => !!b.coberta_por - !!a.coberta_por)) {
    const g = svgEl('g', { class: 'torre', 'data-torre': t.id });
    if (t.coberta_por) {
      const m = svgEl('mask', { id: `atras${t.id}`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: quadro4.w, height: quadro4.h });
      m.appendChild(svgEl('rect', { width: quadro4.w, height: quadro4.h, fill: '#fff' }));
      m.appendChild(svgEl('polygon', { points: pts(t.coberta_por), fill: '#000' }));
      defs.appendChild(m); g.setAttribute('mask', `url(#atras${t.id})`);
    }
    faixas[t.id] = [];
    t.andares.forEach((poly, k) => {
      const p = svgEl('polygon', { points: pts(poly), class: k === 0 ? 'andar terreo' : 'andar', 'data-andar': k, 'data-torre': t.id });
      g.appendChild(p); faixas[t.id][k] = p;
    });
    // nome da torre em cima do telhado (só na vista geral)
    const [cx, topo] = [(t.face[0][0] + t.face[1][0]) / 2, Math.min(t.face[0][1], t.face[1][1])];
    const rot = svgEl('g', { class: 'rotulo', transform: `translate(${cx} ${topo - 120})`, 'data-torre': t.id });
    rot.appendChild(svgEl('rect', { x: -62, y: -24, width: 124, height: 48, rx: 24 }));
    const tx = svgEl('text', { 'text-anchor': 'middle', y: 9 }); tx.textContent = `Torre ${t.id}`; rot.appendChild(tx);
    g.appendChild(rot);
    svg.appendChild(g);
  }
  $('#fachada').appendChild(svg);
  marcarPalco('geral');

  svg.addEventListener('pointermove', ev => {
    const k = +ev.target.dataset.andar, t = +ev.target.dataset.torre;
    if (!k || !t) { realcar(null); dica.hidden = true; return; }
    realcar(t, k);
    if (ev.pointerType === 'mouse') {
      const r = box.getBoundingClientRect();
      dica.innerHTML = `<strong>${nomeAndar(k)}</strong><span>Torre ${t} · <em>${resumoAndar(k, t)} de ${FINAIS}</em> disponíveis</span><span>Clique para ver os apartamentos</span>`;
      dica.hidden = false;
      dica.style.left = `${Math.min(ev.clientX - r.left, r.width - 230)}px`; dica.style.top = `${ev.clientY - r.top}px`;
    }
  });
  svg.addEventListener('pointerleave', () => { realcar(null); dica.hidden = true; });
  svg.addEventListener('click', ev => {
    const k = +ev.target.dataset.andar, t = +ev.target.dataset.torre || +ev.target.closest('.rotulo')?.dataset.torre;
    if (k && t) { if (t !== estado.torre) escolherTorre(t, false); escolherAndar(k, true); }
    else if (t) escolherTorre(t);
  });
  $('#verTodas').addEventListener('click', () => verTodas());

  // régua de andares (mais fácil de tocar no celular), da torre escolhida
  const regua = $('#regua');
  new ResizeObserver(() => { regua.style.height = `${box.offsetHeight}px`; }).observe(box);
  for (let k = ANDARES; k >= 0; k--) {   // 0 = térreo (apês 001 a 008, com área privativa nas pontas)
    const b = el('button', k ? '' : 'terreo', k ? String(k) : 'T');
    b.title = nomeAndar(k);
    b.addEventListener('mouseenter', () => realcar(estado.torre, k));
    b.addEventListener('mouseleave', () => realcar(null));
    b.addEventListener('click', () => escolherAndar(k, true));
    regua.appendChild(b);
    botoesRegua[k] = b;
  }
}

function realcar(t, k) {
  for (const [id, lista] of Object.entries(faixas)) lista.forEach((p, i) => p.classList.toggle('hover', +id === t && i === k));
  botoesRegua.forEach((b, i) => b && b.classList.toggle('hover', t === estado.torre && i === k));
  svg.classList.toggle('foco', t != null || estado.andar != null);
}

// abas das torres
const abas = $('#abasTorre');
TORRES.forEach(t => {
  const b = el('button', 'aba', `Torre ${t.id}`);
  b.setAttribute('role', 'tab');
  b.addEventListener('click', () => escolherTorre(t.id));
  abas.appendChild(b);
});
const abaLazer = el('button', 'aba aba-lazer', 'Lazer');
abaLazer.setAttribute('role', 'tab'); abaLazer.addEventListener('click', () => abrirLazer());
abas.appendChild(abaLazer);
function escolherTorre(id, voar = true) {
  pararTourLazer(); sairLazer();
  estado.torre = id; estado.andar = null;
  [...abas.children].forEach((b, i) => b.setAttribute('aria-selected', String(i + 1 === id)));
  svg?.querySelectorAll('.torre').forEach(g => g.classList.toggle('escolhida', +g.dataset.torre === id));
  Object.values(faixas).flat().forEach(p => p.classList.remove('ativo'));
  botoesRegua.forEach(b => b && b.classList.remove('ativo'));
  if (voar && quadro4) { marcarPalco('torre'); irPara(torreDe(id).caixa, 950, 0.1); }
  if (voar && t3d) { marcarPalco('torre'); t3d.escolherTorre(id); }
  painelVazio();
}
function verTodas() {
  pararTourLazer(); sairLazer();
  estado.andar = null; marcarPalco('geral');
  Object.values(faixas).flat().forEach(p => p.classList.remove('ativo'));
  botoesRegua.forEach(b => b && b.classList.remove('ativo'));
  svg.classList.remove('foco'); irPara([0, 0, quadro4.w, quadro4.h], 900, 0);
  t3d?.verTodas();
  painelVazio();
}
const vazio = $('#painel').innerHTML;
function painelVazio() { $('#painel').innerHTML = vazio; }

function escolherAndar(k, rolarPainel) {
  pararTourLazer(); sairLazer();
  estado.andar = k;
  for (const [id, lista] of Object.entries(faixas)) lista.forEach((p, i) => p.classList.toggle('ativo', +id === estado.torre && i === k));
  botoesRegua.forEach((b, i) => b && b.classList.toggle('ativo', i === k));
  svg.classList.add('foco');
  marcarPalco('andar'); irPara(caixaAndar(torreDe(estado.torre), k), 1000, 0);
  t3d?.escolherAndar(estado.torre, k);
  mostrarPainel();
  if (rolarPainel && innerWidth <= 980) setTimeout(() => $('#painel').scrollIntoView({ behavior: 'smooth', block: 'start' }), 650);
}

function mostrarPainel() {
  const { torre, andar } = estado;
  const painel = $('#painel');
  const livres = resumoAndar(andar);
  const box = el('div', 'painel-andar', `
    <span class="kicker">Passo 2 de 3 · Torre ${torre}</span>
    <h3>${nomeAndar(andar)}</h3>
    <p class="resumo"><b>${livres} de ${FINAIS}</b> apartamentos disponíveis neste andar</p>`);
  const grade = el('div', 'unidades');
  for (let f = 1; f <= FINAIS; f++) {
    const st = statusDa(torre, andar, f);
    const pl = plantaDe(andar, f);
    const num = numeroDe(andar, f);
    const b = el('button', `uni ${st}`, `<i class="st ${st}"></i><strong>${num}</strong><span>${pl.titulo}</span><small>${NOME_STATUS[st]}</small>`);
    if (st === 'vendido') b.disabled = true;
    else b.addEventListener('click', ev => {
      // "entra" no prédio: a foto aproxima mais o andar e o apê abre de dentro para fora a partir do toque
      if (quadro4) { const p = torreDe(torre).andares[andar], xs = p.map(q => q[0]), ys = p.map(q => q[1]); irPara([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], 700, 0.02); }
      abrirApto({ torre, andar, final: f, num, st }, false, ev);
    });
    grade.appendChild(b);
  }
  box.appendChild(grade);
  box.appendChild(el('ul', 'legenda', `<li><i class="st disponivel"></i>Disponível</li><li><i class="st reservado"></i>Reservado</li><li><i class="st vendido"></i>Vendido</li>`));
  painel.replaceChildren(box);
}

// ---------- as torres em 3D (montadas pelas plantas oficiais e pela implantação; a foto oficial fica no botão) ----------
let t3d = null;
const rotulos3d = $('#rotulos3d');
async function montar3D() {
  const canvas = $('#torres3d');
  if (!canvas) return;
  try {
    const [{ Torres3D }, dados] = await Promise.all([import('./torres3d.js?v=20261111080531'), fetch('assets/torre3d.json' + VERSAO_APE).then(r => r.json())]);
    t3d = new Torres3D(canvas, dados, {
      statusDa, numeroDe,
      onPasso: info => {
        if (!info) { realcar(null); dica.hidden = true; return; }
        const r = box.getBoundingClientRect(), pos = () => {
          dica.hidden = false; dica.style.left = `${Math.min(info.x - r.left, r.width - 230)}px`; dica.style.top = `${info.y - r.top}px`;
        };
        if (info.lazer) {
          const it = itemLazer(info.lazer);
          dica.innerHTML = `<strong>${it.nome}</strong><span>${FOTOS_LAZER[it.n] ? 'Toque para ver a imagem' : 'Toque para aproximar'}</span>`; pos(); return;
        }
        if (info.unidade) {
          const u = info.unidade, pl = plantaDe(estado.andar, u.final);
          dica.innerHTML = `<strong>Apto ${u.num}</strong><span>${pl.titulo} · <em>${NOME_STATUS[u.st]}</em></span><span>Toque para entrar</span>`; pos(); return;
        }
        realcar(info.torre, info.andar);
        if (info.andar < 1) { dica.hidden = true; return; }
        dica.innerHTML = `<strong>${nomeAndar(info.andar)}</strong><span>Torre ${info.torre} · <em>${resumoAndar(info.andar, info.torre)} de ${FINAIS}</em> disponíveis</span><span>Toque para abrir o andar</span>`; pos();
      },
      onAndar: (t, k) => { if (t !== estado.torre) escolherTorre(t, false); escolherAndar(k, true); },
      onLazer: n => { pararTourLazer(); if (aPe) { const f = FOTOS_LAZER[n]; if (f) abrirFoto(f, 0); return; } escolherItemLazer(n); },
      onPerto: n => mostrarPerto(n),
      onTourPe: on => $('#peTour')?.classList.toggle('tocando', on),
      onUnidade: (u, ev) => { if (u.st !== 'vendido') abrirApto({ torre: estado.torre, andar: estado.andar, final: u.final, num: u.num, st: u.st }, false, ev); },
    });
    // nome das torres por cima do 3D (só na vista geral e de torre)
    const bot = TORRES.map(t => { const b = el('button', 'rotulo3d', `Torre ${t.id}`); b.addEventListener('click', () => escolherTorre(t.id)); rotulos3d.appendChild(b); return [t.id, b]; });
    t3d.aoQuadro = () => {
      for (const [id, b] of bot) {
        const p = t3d.posicaoNaTela(id), esconde = p.atras || estado.andar != null || estado.lazer;
        b.hidden = esconde; if (!esconde) { b.style.left = `${p.x * 100}%`; b.style.top = `${p.y * 100}%`; }
        b.classList.toggle('on', id === estado.torre);
      }
    };
    box.classList.add('em3d');
    itensLazer = dados.lazer || [];
    if (pedidoLazer) abrirLazer();
    if (pedidoPe) { pedidoPe = false; entrarAPe(true); }
  } catch (e) { console.warn('3D das torres indisponível', e); }
}

// ---------- lazer: a área comum das 4 torres no próprio 3D (números da legenda oficial da implantação) ----------
let itensLazer = [], pedidoLazer = false, tourLazer = null;
const notaPalco = $('.fachada-nota').textContent;
const itemLazer = n => itensLazer.find(i => i.n === n);
function abrirLazer(rolar = false) {
  if (rolar) $('#escolha').scrollIntoView({ behavior: 'smooth' });
  if (!t3d) {   // 3D ainda carregando: abre quando ficar pronto; se o aparelho não tiver 3D, vai para a seção do lazer
    pedidoLazer = true;
    setTimeout(() => { if (!t3d && pedidoLazer) { pedidoLazer = false; $('#lazer').scrollIntoView({ behavior: 'smooth' }); } }, 8000);
    return;
  }
  pedidoLazer = false;
  if (box.classList.contains('foto')) $('#verFoto').click();   // o lazer é no 3D
  estado.lazer = true; estado.andar = null;
  [...abas.children].forEach(b => b.setAttribute('aria-selected', String(b === abaLazer)));
  marcarPalco('lazer'); $('.escolha-grade').classList.add('modo-lazer');
  $('.fachada-nota').textContent = 'Arraste para girar · toque num número para ver o item';
  realcar(null); dica.hidden = true;
  t3d.verLazer();
  painelLazer();
}
function sairLazer() {
  if (!estado.lazer) return;
  estado.lazer = false; $('.escolha-grade').classList.remove('modo-lazer'); abaLazer.setAttribute('aria-selected', 'false');
  $('.fachada-nota').textContent = notaPalco;
}
function painelLazer() {
  const caixa = el('div', 'painel-lazer', `
    <span class="kicker">Área comum das 4 torres</span>
    <h3>Lazer do condomínio</h3>
    <p class="resumo">As quatro torres dividem o mesmo térreo: o lazer fica junto da portaria e é de todos os moradores. Os números são os da implantação oficial.</p>`);
  const pe = el('button', 'lz-tour lz-pe', '<b></b><span><strong>Passear a pé pelo condomínio</strong><em>Entra pela portaria e anda pelas ruas até o lazer</em></span>');
  pe.addEventListener('click', () => entrarAPe(true));
  caixa.appendChild(pe);
  const v360 = el('button', 'lz-tour lz-360', '<b></b><span><strong>Ver em 360°</strong><em>Portaria, rua entre as torres, lazer, playground e piscina</em></span>');
  v360.addEventListener('click', () => abrirCond360('portaria'));
  caixa.appendChild(v360);
  const play = el('button', 'lz-tour', '<b></b><span><strong>Tour pelo lazer (vista de cima)</strong><em>Da portaria à piscina, com as imagens oficiais</em></span>');
  play.addEventListener('click', () => tourLazer ? pararTourLazer() : comecarTourLazer());
  caixa.appendChild(play);
  for (const [titulo, filtro] of [['Lazer', n => n < 15], ['Apoio', n => n > 15]]) {
    caixa.appendChild(el('h4', '', titulo));
    const lista = el('div', 'lz-lista');
    for (const it of itensLazer.filter(i => filtro(i.n))) {
      const f = FOTOS_LAZER[it.n];
      const b = el('button', `lz-item${it.n > 15 ? ' apoio' : ''}`, `<i>${it.n}</i><span>${it.nome}</span>${f ? `<img src="${IMG + f[0].img}" alt="" loading="lazy">` : ''}`);
      b.dataset.n = it.n;
      b.addEventListener('click', () => { pararTourLazer(); escolherItemLazer(it.n); });
      lista.appendChild(b);
    }
    caixa.appendChild(lista);
  }
  caixa.appendChild(el('p', 'apto-nota', 'Imagens ilustrativas da MRV. Posições conforme a implantação do empreendimento.'));
  $('#painel').replaceChildren(caixa);
}
function marcarItemLazer(n) {
  document.querySelectorAll('.lz-item').forEach(b => b.classList.toggle('on', +b.dataset.n === n));
  const on = document.querySelector('.lz-item.on');
  const p = $('#painel');   // rola só a lista (no computador o painel tem rolagem própria); a página fica parada no 3D
  if (on && p.scrollHeight > p.clientHeight + 4) p.scrollTo({ top: on.offsetTop - p.clientHeight / 2, behavior: 'smooth' });
}
async function escolherItemLazer(n, abrir = true) {
  if (!estado.lazer) abrirLazer();
  marcarItemLazer(n);
  await t3d.irLazer(n);
  const f = FOTOS_LAZER[n];
  if (abrir && f && estado.lazer) abrirFoto(f, 0);
}
// tour automático: voa de item em item e mostra a imagem oficial num cartão por cima do 3D (tocar no cartão abre grande)
const cartao = el('button', 'lz-cartao'); cartao.hidden = true; box.appendChild(cartao);
cartao.addEventListener('click', () => { const n = +cartao.dataset.n; pararTourLazer(); abrirFoto(FOTOS_LAZER[n], 0); });
async function comecarTourLazer() {
  if (!estado.lazer) abrirLazer();
  const vez = tourLazer = {};
  document.querySelector('.lz-tour')?.classList.add('tocando');
  for (const n of TOUR_LAZER) {
    if (tourLazer !== vez) return;
    cartao.hidden = true; marcarItemLazer(n);
    await t3d.irLazer(n, 2200);
    if (tourLazer !== vez) return;
    const f = FOTOS_LAZER[n][0], it = itemLazer(n);
    cartao.dataset.n = n;
    cartao.innerHTML = `<img src="${IMG + f.img}" alt=""><span><i>${n}</i>${it.nome}<small>Toque para ver grande</small></span>`;
    cartao.hidden = false;
    await new Promise(r => setTimeout(r, 4200));
  }
  if (tourLazer === vez) { pararTourLazer(); t3d.verLazer(); marcarItemLazer(null); }
}
function pararTourLazer() {
  tourLazer = null; cartao.hidden = true;
  document.querySelector('.lz-tour')?.classList.remove('tocando');
}
// ---------- a pé: o 3D ocupa a tela, na altura dos olhos; joystick, tour e legenda do item mais perto ----------
let aPe = false, pedidoPe = false;
// atalhos sempre à vista em cima do 3D (no celular o painel do lazer fica lá embaixo)
const palcoAcoes = el('div', 'palco-acoes', `
  <button type="button" class="pa-pe">Passear a pé</button>
  <button type="button" class="pa-360">Condomínio em 360°</button>`);
box.appendChild(palcoAcoes);
palcoAcoes.querySelector('.pa-pe').addEventListener('click', () => entrarAPe(true));
palcoAcoes.querySelector('.pa-360').addEventListener('click', () => abrirCond360('portaria'));
$('#heroPasseio')?.addEventListener('click', () => entrarAPe(true));
// painel ao lado das torres (o painel é refeito por innerHTML: o clique é pego no próprio painel)
$('#painel').addEventListener('click', ev => {
  const b = ev.target.closest('[data-acao]'); if (!b) return;
  if (b.dataset.acao === 'pe') entrarAPe(true); else abrirCond360('portaria');
});
const peUi = el('div', 'pe-ui', `
  <button class="pe-sair" id="peSair" type="button">← Sair do passeio</button>
  <button class="pe-tour" id="peTour" type="button"><i></i><span>Tour a pé</span></button>
  <button class="pe-360" id="pe360" type="button">360° daqui</button>
  <div class="pe-joy" id="peJoy" aria-hidden="true"><i></i></div>
  <button class="pe-perto" id="pePerto" type="button" hidden></button>
  <p class="pe-dica">Arraste para olhar · <span class="so-pc">W A S D ou setas para andar</span><span class="so-cel">use o círculo para andar</span></p>`);
box.appendChild(peUi);
function entrarAPe(comTour) {
  if (!t3d) { pedidoPe = true; return; }   // 3D ainda carregando: entra assim que ficar pronto
  pararTourLazer();
  if (!estado.lazer) abrirLazer();
  aPe = true; box.classList.add('a-pe'); document.body.style.overflow = 'hidden';
  dica.hidden = true;
  t3d.iniciarPe(); if (comTour) t3d.tourPe();
  history.pushState({ aPe: true }, '', location.hash);
}
function sairAPe(doHistorico = false) {
  if (!aPe) return;
  aPe = false; box.classList.remove('a-pe'); document.body.style.overflow = '';
  t3d.sairPe(); $('#pePerto').hidden = true;
  if (!doHistorico && history.state?.aPe) history.back();
}
$('#peSair').addEventListener('click', () => sairAPe());
// 360° renderizadas do condomínio (lazer360/): abre no ponto mais perto de onde a pessoa está andando
const PONTOS_COND = { portaria: [1186, 628], rua: [548, 470], lazer: [1043, 640], playground: [1132, 846], piscina: [790, 836] };
$('#pe360').addEventListener('click', () => {
  const p = t3d.pe; if (!p) return;
  let melhor = 'portaria', dmin = Infinity;
  for (const [id, px] of Object.entries(PONTOS_COND)) { const [x, z] = t3d.p14(...px), d = Math.hypot(x - p.x, z - p.z); if (d < dmin) { dmin = d; melhor = id; } }
  t3d.moverPe(0, 0, true); abrirCond360(melhor);
});
function abrirCond360(ponto) {
  quadro.src = `lazer360/360.html${VERSAO_APE}#${ponto}`;
  imersivo.hidden = false; portal(imersivo, null);
  imersivo.classList.add('cond');   // "← Voltar" (não é a planta do apê)
  t3d?.parar();   // o 360° precisa do aparelho inteiro
  history.pushState({ imersivo: true, aPe }, '', location.hash);
}
$('#peTour').addEventListener('click', () => { if ($('#peTour').classList.contains('tocando')) t3d.moverPe(0, 0, true); else t3d.tourPe(); });
addEventListener('popstate', ev => { if (aPe && !ev.state?.aPe && !ev.state?.imersivo) sairAPe(true); });
addEventListener('keydown', ev => { if (ev.key === 'Escape' && aPe && foto.hidden) sairAPe(); });
function mostrarPerto(n) {
  const b = $('#pePerto');
  if (!aPe || n == null) { b.hidden = true; return; }
  const it = itemLazer(n), f = FOTOS_LAZER[n];
  b.innerHTML = `${f ? `<img src="${IMG + f[0].img}" alt="">` : ''}<span><i class="${n > 15 ? 'apoio' : ''}">${n}</i>${it.nome}${f ? '<small>Toque para ver a imagem</small>' : ''}</span>`;
  b.onclick = () => { if (f) abrirFoto(f, 0); };
  b.classList.toggle('sem-foto', !f);
  b.hidden = false;
}
// joystick (celular): mesmo jeito do passeio dentro do apê
{
  const joy = $('#peJoy'), bola = joy.querySelector('i'); let id = null;
  const mover = e => {
    const r = joy.getBoundingClientRect(), R = r.width / 2;
    let dx = e.clientX - r.left - R, dy = e.clientY - r.top - R; const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    bola.style.transform = `translate(${dx}px, ${dy}px)`; t3d?.moverPe(dx / R, dy / R);
  };
  joy.addEventListener('pointerdown', e => { id = e.pointerId; joy.setPointerCapture(id); mover(e); e.stopPropagation(); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === id) mover(e); });
  const solta = () => { id = null; bola.style.transform = ''; t3d?.moverPe(0, 0); };
  joy.addEventListener('pointerup', solta); joy.addEventListener('pointercancel', solta);
}

// arrastar o 3D durante o tour para o tour (o vendedor assume)
$('#torres3d')?.addEventListener('pointerdown', () => { if (tourLazer) pararTourLazer(); });
document.querySelectorAll('a[href="#lazer"]').forEach(a => a.addEventListener('click', ev => { ev.preventDefault(); abrirLazer(true); }));
$('#lazer3d')?.addEventListener('click', () => abrirLazer(true));
$('#verFoto')?.addEventListener('click', () => {
  const foto = box.classList.toggle('foto');
  $('#verFoto').textContent = foto ? 'Ver em 3D' : 'Foto oficial';
  foto ? t3d?.parar() : t3d?.continuar();
});

// ---------- 3. apartamento em 3D ----------
let planta3d = null;
const apto = $('#apto');

let plantaAtual = null, aptoAtual = null;

// cômodos para navegar: um por foto (sala e cozinha dividem a mesma imagem)
function salasDa(pl) {
  const out = [];
  for (const c of pl.comodos) {
    const j = out.findIndex(o => o.img === c.img);
    if (j < 0) out.push({ ...c }); else out[j].nome += ' e ' + c.nome.toLowerCase();
  }
  return out;
}

// abre um quadro de dentro para fora, a partir do ponto tocado (sensação de entrar, sem trocar de página)
function portal(elm, ev) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const x = ev?.clientX ?? innerWidth / 2, y = ev?.clientY ?? innerHeight / 2, r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  elm.animate([{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${r}px at ${x}px ${y}px)` }], { duration: 800, easing: 'cubic-bezier(.65, 0, .25, 1)' });
}

// passeio 3D: os arquivos começam a baixar enquanto a pessoa olha a planta (o montar_site.py põe a versão igual à do andar.js)
const VERSAO_APE = '?v=20261111080531';
const preBaixados = new Set();
function preBaixarApe(pl) {
  // cada apê (501, 503, 001) tem os seus arquivos: lê o apto.json dele para saber o 3D e a planta; no celular, os mapas leves
  if (!pl.ape || preBaixados.has(pl.ape.pasta) || navigator.connection?.saveData) return;
  preBaixados.add(pl.ape.pasta);
  const A = `${pl.ape.pasta}assets/`, M = LEVE ? 'm/' : '';
  const baixar = () => fetch(`${A}apto.json${VERSAO_APE}`).then(r => r.json()).then(cfg => {
    const arqs = [cfg.glb, 'cena.json', 'anda.png', cfg.planta, 'ambiente_dia.json', 'ambiente_tarde.json', M + 'ceu_dia.webp', M + 'ceu_tarde.webp',
      ...['piso', 'paredes', 'moveis', 'decor'].flatMap(g => ['cor', 'brilho', 'luz_dia', 'luz_tarde'].map(t => `${M}${g}_${t}.webp`))];
    arqs.forEach(a => fetch(`${A}${a}${VERSAO_APE}`, { priority: 'low' }).catch(() => {}));
  }).catch(() => preBaixados.delete(pl.ape.pasta));
  setTimeout(() => (window.requestIdleCallback || setTimeout)(baixar), 1500);   // depois que a planta 3D já abriu
}

async function abrirApto(u, doHistorico = false, origem = null) {
  const pl = plantaDe(u.andar, u.final);
  plantaAtual = pl;
  $('#aptoTitulo').textContent = `Apto ${u.num}`;
  $('#aptoOnde').textContent = `Torre ${u.torre} · ${nomeAndar(u.andar)} · final ${String(u.final).padStart(2, '0')} · ${NOME_STATUS[u.st]}`;
  $('#aptoPlanta').innerHTML = `<small>${pl.nome}</small><strong>${pl.titulo}</strong><ul>${pl.itens.map(i => `<li>${i}</li>`).join('')}</ul>`;
  $('#aptoComodos').replaceChildren(...salasDa(pl).map(c => {
    const b = el('button', 'comodo', `<img src="${c.mini || IMG + c.img}" alt="" loading="lazy"><span>${c.nome}</span>`);
    b.addEventListener('click', () => entrarNoComodo(c));
    return b;
  }));
  aptoAtual = u;
  $('#btnTour').hidden = !(pl.tour || pl.ape);
  $('#aptoTourCard').hidden = !(pl.tour || pl.ape);
  $('#aptoTourSub').textContent = pl.ape ? 'Em 3D, cômodo por cômodo, de dia e no pôr do sol' : 'Sala, jantar, cozinha e varanda';

  apto.hidden = false;
  portal(apto, origem);
  t3d?.parar();   // as torres ficam escondidas atrás do apê: não precisam desenhar (libera o celular)
  preBaixarApe(pl);
  document.body.style.overflow = 'hidden';
  if (!doHistorico) history.pushState({ apto: u }, '', `#apto-${u.num}-t${u.torre}`);
  $('#aptoLoad').style.opacity = '1';
  if (!planta3d) {
    const { Planta3D } = await import('./planta3d.js?v=20261111080531');
    planta3d = new Planta3D($('#apto3d'), { onComodo: c => entrarNoComodo(c) });
  }
  await planta3d.carregar(pl);
  $('#aptoLoad').style.opacity = '0';
  marcarVista('iso');
}

function fecharApto(doHistorico = false) {
  if (apto.hidden) return;
  if (!imersivo.hidden) fecharImersivo(true);
  if (!tour.hidden) fecharTour(true);
  if (!foto.hidden) fecharFoto(true);
  apto.hidden = true;
  document.body.style.overflow = '';
  planta3d?.parar();
  if (!box.classList.contains('foto')) t3d?.continuar();
  if (!doHistorico && history.state?.apto) history.back();
}
$('#aptoFechar').addEventListener('click', () => fecharApto());
function marcarVista(v) { $('#btnTopo').classList.toggle('on', v === 'topo'); $('#btnIso').classList.toggle('on', v === 'iso'); }
$('#btnTopo').addEventListener('click', () => { planta3d?.voar('topo'); marcarVista('topo'); });
$('#btnIso').addEventListener('click', () => { planta3d?.voar('iso'); marcarVista('iso'); });
$('#btnTour').addEventListener('click', () => abrirTour());
$('#aptoTourCard').addEventListener('click', () => abrirTour());

// câmera desce para dentro do cômodo e a foto abre "por dentro"
let ocupado = false;
async function entrarNoComodo(c) {
  if (ocupado) return;
  ocupado = true;
  const salas = salasDa(plantaAtual);
  const i = Math.max(0, salas.findIndex(s => s.img === c.img));
  if (innerWidth <= 980) $('#apto').scrollTo({ top: 0, behavior: 'smooth' });
  // planta com o apê em 3D: o cômodo abre na panorâmica 360° dele (Sala e cozinha juntas vêm como "Sala e cozinha")
  const ape = plantaAtual.ape, id = ape && (ape.c360[c.nome] || ape.c360[c.nome.split(' e ')[0]]);
  await planta3d.mergulharComodo(id ? c : salas[i]);
  if (id) abrirImersivo('360.html', id); else abrirFoto(salas, i, true);
  ocupado = false;
}

// ---------- foto (cômodo ou lazer) ----------
const foto = $('#foto'), fotoImg = $('#fotoImg');
let fotoLista = [], fotoIdx = 0, fotoDoApto = false;

function abrirFoto(lista, i, doApto = false) {
  fotoLista = lista; fotoDoApto = doApto;
  foto.classList.toggle('nav', lista.length > 1);
  foto.classList.toggle('do-apto', doApto);
  $('#fotoChips').replaceChildren(...lista.map((c, k) => {
    const b = el('button', '', c.nome);
    b.addEventListener('click', ev => { ev.stopPropagation(); mostrarFoto(k); });
    return b;
  }));
  foto.hidden = false;
  document.body.style.overflow = 'hidden';
  mostrarFoto(i, true);
}
function mostrarFoto(i, entrada = false) {
  fotoIdx = (i + fotoLista.length) % fotoLista.length;
  const c = fotoLista[fotoIdx];
  fotoImg.classList.remove('entra', 'troca');
  void fotoImg.offsetWidth;
  fotoImg.src = IMG + c.img;
  fotoImg.alt = c.nome;
  fotoImg.classList.add(entrada ? 'entra' : 'troca');
  $('#fotoNome').textContent = c.nome;
  [...$('#fotoChips').children].forEach((b, k) => b.classList.toggle('on', k === fotoIdx));
}
function fecharFoto(silencioso = false) {
  if (foto.hidden) return;
  foto.hidden = true;
  if (apto.hidden) document.body.style.overflow = '';
  if (fotoDoApto && !silencioso) { planta3d.voar('iso'); marcarVista('iso'); }
}
$('#fotoAnt').addEventListener('click', ev => { ev.stopPropagation(); mostrarFoto(fotoIdx - 1); });
$('#fotoProx').addEventListener('click', ev => { ev.stopPropagation(); mostrarFoto(fotoIdx + 1); });
$('#fotoVoltar').addEventListener('click', ev => { ev.stopPropagation(); fecharFoto(); });
foto.addEventListener('click', ev => { if (ev.target === foto || ev.target.id === 'fotoFechar') fecharFoto(); });
// arrastar para o lado troca de cômodo
let fx0 = null;
foto.addEventListener('pointerdown', ev => { fx0 = ev.clientX; });
foto.addEventListener('pointerup', ev => {
  if (fx0 == null || fotoLista.length < 2) return;
  const d = ev.clientX - fx0; fx0 = null;
  if (Math.abs(d) > 50) mostrarFoto(fotoIdx + (d < 0 ? 1 : -1));
});

// ---------- tour: andar pelo apê arrastando ----------
const tour = $('#tour'), vid = $('#tourVideo'), mapa = $('#tourMapa');
const T = { alvo: 0, tocando: false, raf: 0, piso: null, ultimo: 0 };

async function abrirTour() {
  if (plantaAtual?.ape && !ocupado) {
    ocupado = true;
    if (innerWidth <= 980) $('#apto').scrollTo({ top: 0, behavior: 'smooth' });
    await planta3d.mergulhar(plantaAtual.ape.entrada, plantaAtual.ape.mira);
    abrirImersivo('passeio.html', 'tour');   // entra já andando sozinho (tour automático); tocar na tela assume o controle
    ocupado = false;
    return;
  }
  const tr = plantaAtual?.tour;
  if (!tr || ocupado) return;
  ocupado = true;
  if (vid.getAttribute('src') !== tr.video) { vid.src = tr.video; vid.poster = tr.poster; vid.load(); }
  T.piso = Object.assign(new Image(), { src: plantaAtual.piso });
  $('#tourChips').replaceChildren(...tr.trechos.map(s => {
    const b = el('button', '', s.nome);
    b.addEventListener('click', () => { T.tocando = false; marcarPlay(); T.alvo = s.t + 0.15; });
    return b;
  }));
  if (innerWidth <= 980) $('#apto').scrollTo({ top: 0, behavior: 'smooth' });
  await planta3d.mergulhar(tr.traj[0][1], tr.traj[0][2]);
  T.alvo = 0; vid.currentTime = 0;
  tour.hidden = false;
  requestAnimationFrame(() => tour.classList.add('on'));
  T.tocando = true; marcarPlay();
  T.ultimo = performance.now();
  cancelAnimationFrame(T.raf); T.raf = requestAnimationFrame(passoTour);
  ocupado = false;
}
function fecharTour(silencioso = false) {
  tour.classList.remove('on');
  T.tocando = false;
  cancelAnimationFrame(T.raf);
  setTimeout(() => { tour.hidden = true; }, silencioso ? 0 : 350);
  if (!silencioso) { planta3d.voar('iso'); marcarVista('iso'); }
}
function marcarPlay() { $('#tourPlay').classList.toggle('pausa', T.tocando); $('#tourPlay').setAttribute('aria-label', T.tocando ? 'Pausar' : 'Andar sozinho'); }
$('#tourPlay').addEventListener('click', () => { if (T.alvo >= vid.duration - 0.05) T.alvo = 0; T.tocando = !T.tocando; marcarPlay(); });
$('#tourVoltar').addEventListener('click', () => fecharTour());
$('#tourRange').addEventListener('input', ev => { T.tocando = false; marcarPlay(); T.alvo = ev.target.value / 1000 * (vid.duration || 10); });

// arrastar (para cima ou para a esquerda = andar para frente) e rodinha do mouse
let arr = null;
const palco = $('#tourPalco');
palco.addEventListener('pointerdown', ev => { arr = { x: ev.clientX, y: ev.clientY, t: T.alvo }; T.tocando = false; marcarPlay(); palco.setPointerCapture(ev.pointerId); });
palco.addEventListener('pointermove', ev => {
  if (!arr) return;
  const dx = arr.x - ev.clientX, dy = arr.y - ev.clientY;
  const d = Math.abs(dx) > Math.abs(dy) ? dx / innerWidth : dy / innerHeight;
  T.alvo = Math.min(vid.duration || 10, Math.max(0, arr.t + d * 9));
});
palco.addEventListener('pointerup', () => { arr = null; });
palco.addEventListener('pointercancel', () => { arr = null; });
tour.addEventListener('wheel', ev => { ev.preventDefault(); T.tocando = false; marcarPlay(); T.alvo = Math.min(vid.duration || 10, Math.max(0, T.alvo + ev.deltaY * 0.004)); }, { passive: false });

function passoTour(now) {
  try { passoTour_(now); } catch (e) { console.error("tour", e); }
  T.raf = requestAnimationFrame(passoTour);
}
function passoTour_(now) {
  const tr = plantaAtual.tour, dur = vid.duration || 10;
  const dt = Math.min(0.1, (now - T.ultimo) / 1000); T.ultimo = now;
  if (T.tocando) { T.alvo += dt; if (T.alvo >= dur) { T.alvo = dur; T.tocando = false; marcarPlay(); } }
  // persegue o alvo sem pedir um seek novo antes do anterior terminar
  if (!vid.seeking && vid.readyState >= 2 && Math.abs(vid.currentTime - T.alvo) > 0.02) {
    const passo = T.tocando ? T.alvo : vid.currentTime + (T.alvo - vid.currentTime) * 0.5;
    vid.currentTime = Math.abs(T.alvo - passo) < 0.04 ? T.alvo : passo;
  }
  const t = vid.currentTime;
  let nome = tr.trechos[0].nome, k = 0;
  tr.trechos.forEach((s, i) => { if (t >= s.t) { nome = s.nome; k = i; } });
  const sala = $('#tourSala');
  if (sala.textContent !== nome) { sala.textContent = nome; sala.classList.remove('pula'); void sala.offsetWidth; sala.classList.add('pula'); }
  [...$('#tourChips').children].forEach((b, i) => b.classList.toggle('on', i === k));
  $('#tourRange').value = String(Math.round(t / dur * 1000));
  desenharMapa(tr, t);
}

function noTrajeto(traj, t) {
  let i = 0;
  while (i < traj.length - 2 && t > traj[i + 1][0]) i++;
  const [ta, pa, la] = traj[i], [tb, pb, lb] = traj[i + 1];
  const u = Math.min(1, Math.max(0, (t - ta) / (tb - ta)));
  const mix = (a, b) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  return { p: mix(pa, pb), l: mix(la, lb) };
}

function desenharMapa(tr, t) {
  const img = T.piso;
  if (!img?.complete || !img.naturalWidth) return;
  const dpr = Math.min(devicePixelRatio, 2);
  const w = mapa.clientWidth, h = mapa.clientHeight;
  if (mapa.width !== Math.round(w * dpr)) { mapa.width = Math.round(w * dpr); mapa.height = Math.round(h * dpr); }
  const g = mapa.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const s = Math.min(w / img.naturalWidth, h / img.naturalHeight), ox = (w - img.naturalWidth * s) / 2, oy = (h - img.naturalHeight * s) / 2;
  const P = ([x, y]) => [ox + x * s, oy + y * s];
  g.drawImage(img, ox, oy, img.naturalWidth * s, img.naturalHeight * s);
  // caminho inteiro (tracejado) e o trecho já andado
  g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
  g.setLineDash([2, 7]); g.strokeStyle = 'rgba(111,64,145,.75)';
  g.beginPath(); tr.traj.forEach((q, i) => { const [x, y] = P(q[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
  g.setLineDash([]); g.strokeStyle = '#D575B1';
  const { p, l } = noTrajeto(tr.traj, t);
  g.beginPath(); tr.traj.filter(q => q[0] <= t).forEach((q, i) => { const [x, y] = P(q[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.lineTo(...P(p)); g.stroke();
  // cone de visão
  const [cx, cy] = P(p), ang = Math.atan2(l[1] - p[1], l[0] - p[0]), R = 46;
  const grad = g.createRadialGradient(cx, cy, 2, cx, cy, R);
  grad.addColorStop(0, 'rgba(213,117,177,.65)'); grad.addColorStop(1, 'rgba(213,117,177,0)');
  g.fillStyle = grad; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, ang - 0.55, ang + 0.55); g.closePath(); g.fill();
  g.fillStyle = '#fff'; g.strokeStyle = '#D575B1'; g.lineWidth = 3;
  g.beginPath(); g.arc(cx, cy, 6, 0, Math.PI * 2); g.fill(); g.stroke();
}

// ---------- apê por dentro: passeio em 3D e 360° (pasta ape/, aberta num quadro) ----------
const imersivo = $('#imersivo'), quadro = $('#imersivoFrame');
function abrirImersivo(pagina, comodo) {
  const u = aptoAtual;
  quadro.src = `${plantaAtual.ape.pasta}${pagina}?apto=${u.num}${comodo ? '#' + comodo : ''}`;
  imersivo.hidden = false;
  portal(imersivo, null);
  planta3d?.parar();   // o passeio e o 360° precisam do aparelho inteiro
  quadro.addEventListener('load', () => quadro.contentWindow?.focus(), { once: true });   // teclado (W A S D) vai para o passeio
  history.pushState({ apto: u, imersivo: true }, '', location.hash);
}
function fecharImersivo(doHistorico = false) {
  if (imersivo.hidden) return;
  imersivo.hidden = true;
  quadro.src = 'about:blank';   // para o 3D e libera a memória (importante no celular)
  imersivo.classList.remove('cond');
  if (!apto.hidden) { planta3d?.continuar(); planta3d?.voar('iso'); marcarVista('iso'); }
  else if (!box.classList.contains('foto')) t3d?.continuar();   // veio do 360° do condomínio
  if (!doHistorico && history.state?.imersivo) history.back();
}
$('#imersivoVoltar').addEventListener('click', () => fecharImersivo());

addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && !imersivo.hidden) { fecharImersivo(); return; }
  if (ev.key === 'Escape') { if (!foto.hidden) fecharFoto(); else if (!tour.hidden) fecharTour(); else fecharApto(); }
  if (!foto.hidden && fotoLista.length > 1 && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) mostrarFoto(fotoIdx + (ev.key === 'ArrowRight' ? 1 : -1));
});
addEventListener('popstate', ev => {
  if (!imersivo.hidden && !ev.state?.imersivo) { fecharImersivo(true); return; }
  if (!foto.hidden) fecharFoto(true);
  if (!tour.hidden) fecharTour(true);
  if (ev.state?.apto) abrirApto(ev.state.apto, true); else fecharApto(true);
});

// ---------- lazer ----------
const trilho = $('#lazerTrilho');
LAZER.forEach(l => {
  const b = el('button', 'lz', `<img src="${IMG + l.img}" alt="${l.nome}" loading="lazy"><div><strong>${l.nome}</strong>${l.sub ? `<span>${l.sub}</span>` : ''}</div>`);
  b.addEventListener('click', () => abrirFoto([l], 0));
  trilho.appendChild(b);
});

montarFachada().then(() => { escolherTorre(1, false); montar3D(); });
