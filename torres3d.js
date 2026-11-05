// As 4 torres em 3D, montadas só com material oficial (assets/torre3d.json, gerado por _projeto/torres3d_dados.py):
// fachada = paredes de fora das plantas do 501 e do 503 espelhadas como na implantação, com as janelas da planta;
// 17 andares-tipo + térreo; chão = a implantação oficial. Girar em volta, tocar na torre, no andar e no apê.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const COR = {
  parede: 0xcfcac2, recuo: 0x6e5748, vidro: 0x34414b, caixilho: 0x2a2b2e, laje: 0xcfcac2,
  painel: [0x8fb2dc, 0xa8c39b, 0x9bb7d6, 0xb6cfa3],   // os painéis coloridos ao lado das janelas (azuis e verdes da fotomontagem)
  realce: 0xd575b1, livre: 0x3fbf7f, reservado: 0xf0b43c, vendido: 0x8b8794,
};

export class Torres3D {
  constructor(canvas, dados, { onPasso, onAndar, onUnidade, statusDa, numeroDe } = {}) {
    this.d = dados; this.cb = { onPasso, onAndar, onUnidade }; this.statusDa = statusDa; this.numeroDe = numeroDe;
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.92;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    const cena = this.cena = new THREE.Scene();
    cena.background = new THREE.Color(0xcfe0ee); cena.fog = new THREE.Fog(0xcfe0ee, 260, 520);
    cena.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
    this.camera = new THREE.PerspectiveCamera(38, 1, 1, 1500);
    this.controles = new OrbitControls(this.camera, canvas);
    Object.assign(this.controles, { enableDamping: true, dampingFactor: 0.08, minDistance: 25, maxDistance: 320, maxPolarAngle: 1.42, enablePan: false });

    // luz: sol da tarde vindo do norte-oeste (a implantação tem o norte para cima à esquerda) e céu
    cena.add(new THREE.HemisphereLight(0xe9f1ff, 0x8f8a7a, 0.95));
    const sol = this.sol = new THREE.DirectionalLight(0xfff1dc, 2.2);
    sol.position.set(-90, 140, -60); sol.castShadow = true;
    Object.assign(sol.shadow.camera, { left: -130, right: 130, top: 130, bottom: -130, near: 10, far: 450 });
    sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.6;
    cena.add(sol);

    this.montarChao(); this.montarEntorno(); this.montarTorres();
    // sombra de contato (oclusão de ambiente) só em tela grande: no celular pesa
    if (innerWidth > 900) {
      this.composer = new EffectComposer(r);
      this.composer.addPass(new RenderPass(cena, this.camera));
      const ao = new GTAOPass(cena, this.camera); ao.updateGtaoMaterial({ radius: 1.2, distanceFallOff: 1, thickness: 1.5 }); ao.blendIntensity = 0.85;
      this.composer.addPass(ao); this.composer.addPass(new OutputPass());
    }
    this.estado = { torre: null, andar: null };
    this.ray = new THREE.Raycaster(); this.mouse = new THREE.Vector2();
    this.ligar();
    this.resize(); new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.voarPara(this.vistaGeral(), 0);
    this.rodando = true; this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }

  // ---------- montagem ----------
  montarChao() {
    const { w, h, img } = this.d.chao;
    const tx = new THREE.TextureLoader().load(img); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tx, roughness: 1 }));
    chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true; this.cena.add(chao);
    // em volta do terreno, um chão neutro (sem paisagem inventada)
    const fora = new THREE.Mesh(new THREE.RingGeometry(Math.hypot(w, h) / 2, 900, 64), new THREE.MeshStandardMaterial({ color: 0xb9b6ad, roughness: 1 }));
    fora.rotation.x = -Math.PI / 2; fora.position.y = -0.05; this.cena.add(fora);
  }

  montarEntorno() {
    // árvores nos lugares das copas desenhadas na implantação oficial; construções térreas do lazer e reservatórios
    const d = this.d, folha = new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 0.95, flatShading: true });
    const tronco = new THREE.MeshStandardMaterial({ color: 0x6b5340, roughness: 1 });
    for (const [x, z, r] of d.arvores || []) {
      const h = 2.2 + r * 1.2;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, h * 0.55, 8), tronco); t.position.set(x, h * 0.275, z);
      const g = new THREE.IcosahedronGeometry(r, 1), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const k = 0.82 + 0.3 * Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.85, p.getZ(i) * k); }
      g.computeVertexNormals();
      const c = new THREE.Mesh(g, folha); c.position.set(x, h * 0.55 + r * 0.6, z);
      for (const o of [t, c]) { o.castShadow = true; o.receiveShadow = true; this.cena.add(o); }
    }
    const branco = new THREE.MeshStandardMaterial({ color: 0xe6e3dc, roughness: 0.9 }), laje = new THREE.MeshStandardMaterial({ color: 0x9d9a94, roughness: 0.95 });
    for (const [x0, z0, x1, z1, h] of d.terreas || []) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), branco); b.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
      const t = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.4, 0.25, z1 - z0 + 0.4), laje); t.position.set((x0 + x1) / 2, h + 0.12, (z0 + z1) / 2);
      for (const o of [b, t]) { o.castShadow = true; o.receiveShadow = true; this.cena.add(o); }
    }
    const azul = new THREE.MeshStandardMaterial({ color: 0x3d8fc8, roughness: 0.5 });
    for (const [x, z, r, h] of d.tanques || []) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), azul); c.position.set(x, h / 2, z); c.castShadow = true; this.cena.add(c);
    }
  }

  andarGeometrias() {
    // um andar (paredes de fora com as aberturas da planta), agrupado por material; depois vira instância por andar
    const g = { parede: [], recuo: [], vidro: [], caixilho: [], painel: [], laje: [] }, A = this.d.andar;
    const caixa = (lista, x0, z0, x1, z1, y0, y1) => {
      if (x1 - x0 < 1e-3 || z1 - z0 < 1e-3 || y1 - y0 < 1e-3) return;
      const b = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); b.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); lista.push(b);
    };
    for (const f of this.d.fachada) {
      const [x0, z0, x1, z1] = f.r, horiz = x1 - x0 >= z1 - z0, lista = f.recuo > 0.4 ? g.recuo : g.parede;
      const lo = horiz ? x0 : z0, hi = horiz ? x1 : z1;
      const ab = f.aberturas.slice().sort((p, q) => p.a - q.a);
      const peca = (a, b, y0, y1, l = lista) => horiz ? caixa(l, a, z0, b, z1, y0, y1) : caixa(l, x0, a, x1, b, y0, y1);
      let cur = lo;
      for (const o of ab) {
        peca(cur, o.a, 0, A); cur = o.b;
        peca(o.a, o.b, 0, o.pe); peca(o.a, o.b, o.ve, A);
        // vidro no meio da espessura; janela: ~70% vidro e o resto painel colorido (como nas janelas da fotomontagem)
        const meio = horiz ? (z0 + z1) / 2 : (x0 + x1) / 2, e = 0.02;
        const fino = (a, b, y0, y1, l) => horiz ? caixa(l, a, meio - e, b, meio + e, y0, y1) : caixa(l, meio - e, a, meio + e, b, y0, y1);
        if (o.tipo === 'janela') {
          const corte = o.a + (o.b - o.a) * 0.68;
          fino(o.a, corte, o.pe, o.ve, g.vidro); fino(corte, o.b, o.pe, o.ve, g.painel);
          fino(o.a, o.b, o.pe, o.pe + 0.04, g.caixilho); fino(o.a, o.b, o.ve - 0.04, o.ve, g.caixilho);
          fino((o.a + corte) / 2 - 0.02, (o.a + corte) / 2 + 0.02, o.pe, o.ve, g.caixilho);
        } else {   // porta de vidro da varanda
          fino(o.a, o.b, o.pe, o.ve, g.vidro);
          fino((o.a + o.b) / 2 - 0.02, (o.a + o.b) / 2 + 0.02, o.pe, o.ve, g.caixilho);
        }
      }
      peca(cur, hi, 0, A);
    }
    // varandas: laje, mureta e guarda-corpo (a laje de cima é a do andar seguinte)
    for (const [x0, z0, x1, z1] of this.d.varandas) caixa(g.laje, x0, z0, x1, z1, -0.12, 0);
    for (const [x0, z0, x1, z1] of this.d.guardas) {
      caixa(g.parede, x0, z0 - 0.04, x1, z1 + 0.02, 0, 0.95);
      caixa(g.caixilho, x0, (z0 + z1) / 2 - 0.02, x1, (z0 + z1) / 2 + 0.02, 1.36, 1.40);
      for (let x = x0 + 0.1; x < x1 - 0.05; x += 0.1) caixa(g.caixilho, x, (z0 + z1) / 2 - 0.006, x + 0.012, (z0 + z1) / 2 + 0.006, 0.95, 1.36);
    }
    return Object.fromEntries(Object.entries(g).filter(([, l]) => l.length).map(([k, l]) => [k, mergeGeometries(l)]));
  }

  montarTorres() {
    const geo = this.andarGeometrias(), d = this.d, A = d.andar, N = d.andares + 1;   // térreo + 17
    const mats = {
      parede: new THREE.MeshStandardMaterial({ color: COR.parede, roughness: 0.92 }),
      recuo: new THREE.MeshStandardMaterial({ color: COR.recuo, roughness: 0.9 }),
      vidro: new THREE.MeshStandardMaterial({ color: COR.vidro, roughness: 0.12, metalness: 0.5, envMapIntensity: 1.2 }),
      caixilho: new THREE.MeshStandardMaterial({ color: COR.caixilho, roughness: 0.5 }),
      painel: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
      laje: new THREE.MeshStandardMaterial({ color: COR.laje, roughness: 0.95 }),
    };
    // contorno (telhado, faixa de realce e andar em corte)
    const forma = new THREE.Shape(d.contorno.map(([x, z]) => new THREE.Vector2(x, -z)));
    const prisma = h => { const e = new THREE.ExtrudeGeometry(forma, { depth: h, bevelEnabled: false }); e.rotateX(-Math.PI / 2); return e; };
    this.torres = {};
    for (const [id, [cx, cz]] of Object.entries(d.torres)) {
      const grupo = new THREE.Group(); grupo.position.set(cx, 0, cz); this.cena.add(grupo);
      const andares = {};
      for (const [k, gg] of Object.entries(geo)) {
        const im = new THREE.InstancedMesh(gg, mats[k], N); im.castShadow = true; im.receiveShadow = true;
        const mx = new THREE.Matrix4();
        for (let i = 0; i < N; i++) {
          im.setMatrixAt(i, mx.makeTranslation(0, i * A, 0));
          if (k === 'painel') im.setColorAt(i, new THREE.Color(COR.painel[(i * 3 + +id) % COR.painel.length]));
        }
        grupo.add(im); andares[k] = im;
      }
      // miolo escuro dentro da casca (para não ver através das janelas) e telhado com a casa de máquinas sobre o núcleo
      const miolo = new THREE.Mesh(prisma(N * A - 0.2), new THREE.MeshBasicMaterial({ color: 0x1c1f24 }));
      miolo.scale.set(0.985, 1, 0.97); grupo.add(miolo);
      const teto = new THREE.Group(); teto.position.y = N * A;
      const laje = new THREE.Mesh(prisma(0.55), mats.parede); laje.castShadow = laje.receiveShadow = true; teto.add(laje);
      const [nx0, nz0, nx1, nz1] = d.nucleo;
      const casa = new THREE.Mesh(new THREE.BoxGeometry(nx1 - nx0 + 1.2, 3.2, nz1 - nz0 - 2.0), mats.recuo); casa.position.set((nx0 + nx1) / 2, 0.55 + 1.6, (nz0 + nz1) / 2);
      const cx2 = new THREE.Mesh(new THREE.BoxGeometry(nx1 - nx0 - 0.6, 1.8, (nz1 - nz0) * 0.42), mats.parede); cx2.position.set((nx0 + nx1) / 2, 0.55 + 3.2 + 0.9, (nz0 + nz1) / 2);
      for (const o of [casa, cx2]) { o.castShadow = o.receiveShadow = true; teto.add(o); }
      grupo.add(teto);
      // térreo: áreas privativas dos finais 01/02/07/08 (planta do 001): piso cimentado com mureta na volta
      for (const [x0, z0, x1, z1] of d.jardins) {
        const piso = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.1, z1 - z0), new THREE.MeshStandardMaterial({ color: 0x9a9893, roughness: 1 }));
        piso.position.set((x0 + x1) / 2, 0.05, (z0 + z1) / 2); piso.receiveShadow = true; grupo.add(piso);
      }
      const mur = mergeGeometries(d.jardins.flatMap(([x0, z0, x1, z1]) => {
        const out = [], b = (a0, b0, a1, b1) => { const g = new THREE.BoxGeometry(a1 - a0, 1.1, b1 - b0); g.translate((a0 + a1) / 2, 0.55, (b0 + b1) / 2); out.push(g); };
        const [bx0, , bx1] = d.caixa;   // mureta só nos lados que não encostam na torre
        if (x0 < bx0 + 0.01) b(x0, z0, x0 + 0.12, z1);
        if (x1 > bx1 - 0.01) b(x1 - 0.12, z0, x1, z1);
        b(x0, z0, x1, z0 + 0.12); b(x0, z1 - 0.12, x1, z1);
        return out;
      }));
      const mureta = new THREE.Mesh(mur, mats.parede); mureta.castShadow = mureta.receiveShadow = true; grupo.add(mureta);
      // caixa invisível para tocar (torre e andar)
      const [bx0, bz0, bx1, bz1] = d.caixa;
      const alvo = new THREE.Mesh(new THREE.BoxGeometry(bx1 - bx0, N * A, bz1 - bz0), new THREE.MeshBasicMaterial({ visible: false }));
      alvo.position.set((bx0 + bx1) / 2, N * A / 2, (bz0 + bz1) / 2); alvo.userData.torre = +id; grupo.add(alvo);
      // faixa do andar (realce)
      const faixa = new THREE.Mesh(prisma(A * 0.98), new THREE.MeshBasicMaterial({ color: COR.realce, transparent: true, opacity: 0.38, depthWrite: false }));
      faixa.scale.set(1.012, 1, 1.03); faixa.visible = false; grupo.add(faixa);
      this.torres[id] = { grupo, andares, teto, miolo, alvo, faixa, N };
    }
    this.alvos = Object.values(this.torres).map(t => t.alvo);
    // andar em corte: placas das 8 unidades com o número, por cima da laje do andar escolhido
    this.corte = new THREE.Group(); this.corte.visible = false; this.cena.add(this.corte);
  }

  // ---------- câmera ----------
  vistaGeral() {
    // como a fotomontagem oficial: do leste, de cima (torres 1 e 3 na frente, 2 e 4 atrás); mais longe em tela em pé
    const k = Math.max(1, 1.25 / Math.max(0.5, this.camera.aspect));
    return { alvo: new THREE.Vector3(-20, 16, -30), pos: new THREE.Vector3(-20 + 150 * k, 16 + 85 * k, -30 + 45 * k) };
  }
  vistaTorre(id) {
    const [cx, cz] = this.d.torres[id];
    const k = Math.max(1, 1.1 / Math.max(0.5, this.camera.aspect));
    return { alvo: new THREE.Vector3(cx, 25, cz), pos: new THREE.Vector3(cx + 70 * k, 25 + 26 * k, cz + 30 * k) };
  }
  vistaAndar(id, k) {
    const [cx, cz] = this.d.torres[id], y = (k + 1) * this.d.andar, a = Math.max(0.5, this.camera.aspect);
    const dist = 44 / Math.min(1, a / 1.1);   // em tela em pé o andar (40 m de comprido) precisa de mais distância
    return { alvo: new THREE.Vector3(cx, y, cz + 1), pos: new THREE.Vector3(cx + dist * 0.12, y + dist * 0.92, cz + dist * 0.45) };
  }
  voarPara({ alvo, pos }, dur = 1100) {
    const c = this.camera, ct = this.controles;
    if (!dur) { c.position.copy(pos); ct.target.copy(alvo); ct.update(); return Promise.resolve(); }
    const p0 = c.position.clone(), a0 = ct.target.clone(), t0 = performance.now();
    return new Promise(res => { this.anim = { p0, a0, pos, alvo, t0, dur, res }; });
  }

  // ---------- estados ----------
  escolherTorre(id) {
    this.estado = { torre: id, andar: null }; this.mostrarCorte(null);
    return this.voarPara(this.vistaTorre(id));
  }
  verTodas() {
    this.estado = { torre: null, andar: null }; this.mostrarCorte(null);
    return this.voarPara(this.vistaGeral());
  }
  escolherAndar(id, k) {
    this.estado = { torre: id, andar: k }; this.mostrarCorte(id, k);
    return this.voarPara(this.vistaAndar(id, k));
  }
  mostrarCorte(id, k) {
    for (const [tid, t] of Object.entries(this.torres)) {
      const corta = +tid === id && k != null;
      for (const im of Object.values(t.andares)) im.count = corta ? k + 1 : t.N;
      t.teto.visible = !corta; t.miolo.scale.y = corta ? ((k + 1) * this.d.andar - 0.35) / (t.N * this.d.andar - 0.2) : 1;   // abaixo da laje do corte
      t.faixa.visible = false;
    }
    this.corte.clear(); this.corte.visible = false;
    if (id == null || k == null) return;
    const [cx, cz] = this.d.torres[id], y = (k + 1) * this.d.andar - 0.05;
    // laje do andar e as 8 unidades (cor = situação), com o número em cima
    const laje = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(this.d.contorno.map(([x, z]) => new THREE.Vector2(x, -z))), { depth: 0.12, bevelEnabled: false }),
      new THREE.MeshStandardMaterial({ color: 0xece8e1, roughness: 0.9 }));
    laje.geometry.rotateX(-Math.PI / 2); laje.position.set(cx, y - 0.12, cz); this.corte.add(laje);
    // cada unidade com a planta humanizada oficial em cima (espelhada como na implantação) e o número
    for (const [fin, [x0, z0, x1, z1]] of Object.entries(this.d.unidades)) {
      const st = this.statusDa(id, k, +fin), num = this.numeroDe(k, +fin), pl = (k === 0 ? this.d.plantas_terreo : this.d.plantas)[fin];
      const [px0, pz0, px1, pz1] = pl.r;
      const placa = new THREE.Mesh(new THREE.PlaneGeometry(px1 - px0, pz1 - pz0), new THREE.MeshBasicMaterial({ map: this.planta(pl.img, pl.espelho), transparent: true }));
      placa.rotation.x = -Math.PI / 2; placa.position.set(cx + (px0 + px1) / 2, y + 0.06, cz + (pz0 + pz1) / 2);
      if (st === 'vendido') placa.material.color.set(0x8b8794);
      // área de toque = o retângulo da unidade (paredes), um pouco acima da planta
      const toque = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.1, z1 - z0), new THREE.MeshBasicMaterial({ visible: false }));
      toque.position.set(cx + (x0 + x1) / 2, y + 0.2, cz + (z0 + z1) / 2); toque.userData = { final: +fin, num, st };
      const borda = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(x1 - x0 - 0.2, 0.01, z1 - z0 - 0.2)),
        new THREE.LineBasicMaterial({ color: COR[st === 'disponivel' ? 'livre' : st] }));
      borda.position.set(cx + (x0 + x1) / 2, y + 0.12, cz + (z0 + z1) / 2);
      this.corte.add(placa, toque, borda);
      const rot = rotulo(String(num), { disponivel: '#7ff0b6', reservado: '#ffd27a', vendido: '#b9b4c2' }[st]);
      rot.position.set(cx + (x0 + x1) / 2, y + 2.2, cz + (z0 + z1) / 2); this.corte.add(rot);
    }
    this.corte.visible = true;
  }

  planta(img, espelho) {   // textura da planta oficial, espelhada em x e/ou y conforme a posição da unidade na torre
    this.texPlantas ??= {};
    const chave = img + espelho;
    if (!this.texPlantas[chave]) {
      const t = new THREE.TextureLoader().load(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      if (espelho.includes('x')) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; }
      if (espelho.includes('y')) { t.wrapT = THREE.RepeatWrapping; t.repeat.y = -1; t.offset.y = 1; }
      this.texPlantas[chave] = t;
    }
    return this.texPlantas[chave];
  }

  // ---------- toque / mouse ----------
  ligar() {
    const el = this.canvas; let baixo = null;
    const pos = e => { const r = el.getBoundingClientRect(); this.mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); };
    el.addEventListener('pointerdown', e => { baixo = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointermove', e => { pos(e); if (e.pointerType === 'mouse') this.passar(e); });
    el.addEventListener('pointerleave', () => { this.realcar(null); this.cb.onPasso?.(null); });
    el.addEventListener('pointerup', e => {
      if (!baixo || Math.hypot(e.clientX - baixo.x, e.clientY - baixo.y) > 6) { baixo = null; return; }   // foi arrastar, não tocar
      baixo = null; pos(e); this.tocar(e);
    });
  }
  achar() {
    this.ray.setFromCamera(this.mouse, this.camera);
    if (this.corte.visible) {
      const h = this.ray.intersectObjects(this.corte.children.filter(o => o.userData.final != null), false)[0];
      if (h) return { unidade: h.object.userData };
    }
    const h = this.ray.intersectObjects(this.alvos, false)[0];
    if (!h) return null;
    const id = h.object.userData.torre, local = h.object.parent.worldToLocal(h.point.clone());
    const k = Math.max(0, Math.min(this.d.andares, Math.floor(local.y / this.d.andar)));   // 0 = térreo
    return { torre: id, andar: k };
  }
  passar(e) {
    const a = this.achar();
    this.canvas.style.cursor = a ? 'pointer' : 'grab';
    if (a?.unidade) { this.realcar(null); this.cb.onPasso?.({ unidade: a.unidade, x: e.clientX, y: e.clientY }); return; }
    if (!a || (this.estado.andar != null && a.torre === this.estado.torre)) { this.realcar(null); this.cb.onPasso?.(null); return; }
    this.realcar(a.torre, a.andar); this.cb.onPasso?.({ ...a, x: e.clientX, y: e.clientY });
  }
  tocar(e) {
    const a = this.achar();
    if (!a) return;
    if (a.unidade) return this.cb.onUnidade?.(a.unidade, e);
    if (this.estado.andar != null && a.torre === this.estado.torre) return;
    this.cb.onAndar?.(a.torre, a.andar);
  }
  realcar(id, k) {
    for (const [tid, t] of Object.entries(this.torres)) {
      const on = +tid === id && k != null;
      t.faixa.visible = on; if (on) t.faixa.position.y = k * this.d.andar + 0.01;
    }
  }

  // ---------- laço ----------
  resize() {
    const b = this.canvas.parentElement.getBoundingClientRect();
    this.renderer.setSize(b.width, b.height, false); this.camera.aspect = b.width / Math.max(1, b.height); this.camera.updateProjectionMatrix();
    this.composer?.setSize(b.width, b.height);
  }
  posicaoNaTela(id) {   // para o nome da torre (HTML por cima do canvas)
    const [cx, cz] = this.d.torres[id], p = new THREE.Vector3(cx, (this.d.andares + 1) * this.d.andar + 7, cz).project(this.camera);
    return { x: (p.x + 1) / 2, y: (1 - p.y) / 2, atras: p.z > 1 };
  }
  parar() { this.rodando = false; }
  continuar() { if (!this.rodando) { this.rodando = true; requestAnimationFrame(this.loop); } }
  loop(agora) {
    if (!this.rodando) return;
    if (this.anim) {
      const a = this.anim, t = Math.min(1, (agora - a.t0) / a.dur), e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      this.camera.position.lerpVectors(a.p0, a.pos, e); this.controles.target.lerpVectors(a.a0, a.alvo, e);
      if (t >= 1) { this.anim = null; a.res(); }
    }
    this.controles.update();
    if (this.composer) this.composer.render(); else this.renderer.render(this.cena, this.camera);
    this.aoQuadro?.();
    requestAnimationFrame(this.loop);
  }
}

// número do apê flutuando em cima da unidade (textura de canvas)
function rotulo(txt, cor) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = 'rgba(27,14,38,.82)'; g.beginPath(); g.roundRect(8, 24, 240, 80, 40); g.fill();
  g.fillStyle = cor; g.font = '600 56px Outfit, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 128, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  s.scale.set(4.2, 2.1, 1); s.renderOrder = 10; return s;
}
