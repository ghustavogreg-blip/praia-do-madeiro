// Planta em 3D: piso = planta humanizada oficial, paredes extrudadas dos retângulos extraídos da planta.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const SC = 0.0095;       // metros por pixel da textura (porta interna de 0,8 m = 84 px)
const ALT = 0.85;        // altura das paredes cortadas (vista "casa de boneca")
const ESP = 0.06;        // espessura da tampa roxa
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export class Planta3D {
  constructor(host, { onComodo } = {}) {
    this.host = host;
    this.hotLayer = host.querySelector('.hotspots');
    this.onComodo = onComodo;
    this.renderer = new THREE.WebGLRenderer({ canvas: host.querySelector('canvas'), antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, minPolarAngle: 0.05, maxPolarAngle: 1.2, rotateSpeed: 0.7 });

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a9a, 2.4));
    const sol = new THREE.DirectionalLight(0xfff1e0, 1.7);
    sol.position.set(-6, 12, 5);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
    sol.shadow.radius = 4;
    sol.shadow.bias = -0.0004;
    this.scene.add(sol);

    const chao = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.22 }));
    chao.rotation.x = -Math.PI / 2; chao.position.y = -0.02; chao.receiveShadow = true;
    this.scene.add(chao);

    this.grupo = new THREE.Group();
    this.scene.add(this.grupo);
    this.matLado = new THREE.MeshStandardMaterial({ color: 0xf4f0f7, roughness: 0.85 });
    this.matTopo = new THREE.MeshStandardMaterial({ color: 0x8a55b3, roughness: 0.6 });
    this.matVidro = new THREE.MeshStandardMaterial({ color: 0xbfe3f2, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false });
    this.loader = new THREE.TextureLoader();
    this.cache = {};

    new ResizeObserver(() => this.resize()).observe(host);
    this.loop = this.loop.bind(this);
  }

  async carregar(planta) {
    const [rects, tex] = await Promise.all([
      this.cache[planta.paredes] ||= fetch(planta.paredes).then(r => r.json()),
      this.cache[planta.piso] ||= this.loader.loadAsync(planta.piso),
    ]);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.grupo.clear();
    const W = rects.w, H = rects.h;
    this.W = W; this.H = H;
    const piso = new THREE.Mesh(
      new THREE.PlaneGeometry(W * SC, H * SC),
      new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.4, transparent: true, alphaTest: 0.5, roughness: 0.9 })
    );
    piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true;
    this.grupo.add(piso);

    // paredes medidas sobre a planta oficial (_projeto/paredes_oficiais.py)
    const lados = new THREE.BoxGeometry(1, 1, 1);
    for (const [x, y, w, h] of rects.vidro || []) {
      const g = new THREE.Mesh(lados, this.matVidro);
      g.scale.set(w * SC, ALT, h * SC); g.position.set((x + w / 2 - W / 2) * SC, ALT / 2, (y + h / 2 - H / 2) * SC);
      this.grupo.add(g);
    }
    for (const [x, y, w, h] of rects.rects) {
      const cx = (x + w / 2 - W / 2) * SC, cz = (y + h / 2 - H / 2) * SC;
      const m = new THREE.Mesh(lados, this.matLado);
      m.scale.set(w * SC, ALT, h * SC); m.position.set(cx, ALT / 2, cz);
      m.castShadow = true; m.receiveShadow = true;
      const t = new THREE.Mesh(lados, this.matTopo);
      t.scale.set(w * SC + 0.004, ESP, h * SC + 0.004); t.position.set(cx, ALT + ESP / 2, cz);
      this.grupo.add(m, t);
    }

    // hotspots dos cômodos
    this.hotLayer.innerHTML = '';
    this.hots = planta.comodos.map(c => {
      const b = document.createElement('button');
      b.className = 'hot';
      b.innerHTML = `<i></i><b>${c.nome}</b>`;
      b.addEventListener('click', () => this.onComodo?.(c));
      this.hotLayer.appendChild(b);
      return { el: b, c, p: new THREE.Vector3((c.px[0] - W / 2) * SC, 0.35, (c.px[1] - H / 2) * SC) };
    });

    this.resize();
    this.voar('iso', true);
    if (!this.rodando) { this.rodando = true; requestAnimationFrame(this.loop); }
  }

  // vista: 'iso' (3D) ou 'topo' (de cima); intro = começa de cima e desce até a vista 3D
  voar(vista, intro = false) {
    const r = this.raio();
    const alvo = new THREE.Vector3(0, 0, 0);
    const fim = vista === 'topo'
      ? new THREE.Spherical(r * 1.05, 0.0001, 0)
      : new THREE.Spherical(r, 0.82, -0.55);
    const ini = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(alvo));
    if (intro) { ini.set(r * 1.6, 0.0001, fim.theta); this.mostrarHots(false); }
    // gira pelo caminho mais curto
    while (fim.theta - ini.theta > Math.PI) ini.theta += 2 * Math.PI;
    while (ini.theta - fim.theta > Math.PI) ini.theta -= 2 * Math.PI;
    this.anim = { tipo: 'orbita', t0: performance.now(), dur: intro ? 1800 : 1000, ini, fim, alvo0: this.controls.target.clone(), alvo, fimHots: true };
    return this.esperar();
  }

  // câmera entra no apartamento: vai até o ponto "olho" (pixels da planta) na altura dos olhos e olha para "mira"
  mergulhar(olhoPx, miraPx, { altura = 1.5, dur = 1300 } = {}) {
    this.mostrarHots(false);
    const p1 = this.pxMundo(olhoPx, altura), t1 = this.pxMundo(miraPx, altura * 0.85);
    this.anim = { tipo: 'linha', t0: performance.now(), dur, p0: this.camera.position.clone(), p1, alvo0: this.controls.target.clone(), alvo: t1 };
    return this.esperar();
  }

  // entrar num cômodo: desce sobre ele vindo do lado da câmera
  mergulharComodo(c) {
    const alvo = this.pxMundo(c.px, 0);
    const lado = this.camera.position.clone().sub(alvo).setY(0).normalize().multiplyScalar(1.1);
    const p1 = alvo.clone().add(lado).setY(1.45);
    this.mostrarHots(false);
    this.anim = { tipo: 'linha', t0: performance.now(), dur: 1100, p0: this.camera.position.clone(), p1, alvo0: this.controls.target.clone(), alvo: alvo.setY(0.45) };
    return this.esperar();
  }

  pxMundo([x, y], alt) {
    this.grupo.updateMatrixWorld();
    return this.grupo.localToWorld(new THREE.Vector3((x - this.W / 2) * SC, alt, (y - this.H / 2) * SC));
  }

  esperar() { return new Promise(res => { this.anim.fim_cb = res; }); }

  mostrarHots(on) {
    (this.hots || []).forEach((h, i) => on ? setTimeout(() => h.el.classList.add('on'), i * 90) : h.el.classList.remove('on'));
  }

  raio() {
    // distância para caber a planta inteira no quadro
    const R = Math.hypot(this.W, this.H) * SC / 2 * 0.92;
    const vf = THREE.MathUtils.degToRad(this.camera.fov);
    const hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect);
    return R / Math.sin(Math.min(vf, hf) / 2);
  }

  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    // celular em pé: gira a planta para o lado comprido ficar na vertical
    const retrato = w / h < 0.85;
    if (retrato !== this.retrato) { this.retrato = retrato; this.grupo.rotation.y = retrato ? Math.PI / 2 : 0; }
    if (this.W) this.controls.maxDistance = this.raio() * 1.8, this.controls.minDistance = this.raio() * 0.45;
  }

  parar() { this.rodando = false; }
  continuar() { if (!this.rodando && this.W) { this.rodando = true; requestAnimationFrame(this.loop); } }

  loop(now) {
    if (!this.rodando) return;
    if (this.anim) {
      const a = this.anim;
      const k = ease(Math.min(1, (now - a.t0) / a.dur));
      const alvo = a.alvo0.clone().lerp(a.alvo, k);
      if (a.tipo === 'orbita') {
        const s = new THREE.Spherical(
          a.ini.radius + (a.fim.radius - a.ini.radius) * k,
          a.ini.phi + (a.fim.phi - a.ini.phi) * k,
          a.ini.theta + (a.fim.theta - a.ini.theta) * k);
        this.camera.position.setFromSpherical(s).add(a.alvo);
      } else {
        this.camera.position.lerpVectors(a.p0, a.p1, k);
      }
      this.camera.lookAt(alvo);
      if (k >= 1) {
        this.anim = null;
        this.controls.target.copy(a.alvo);
        this.dentro = a.tipo === 'linha';   // dentro do apê: não deixa o OrbitControls afastar a câmera
        if (a.fimHots) this.mostrarHots(true);
        a.fim_cb?.();
      }
    }
    this.controls.enabled = !this.anim && !this.dentro;
    if (!this.anim && !this.dentro) this.controls.update();
    this.renderer.render(this.scene, this.camera);

    const w = this.host.clientWidth, h = this.host.clientHeight;
    const v = new THREE.Vector3();
    for (const hot of this.hots || []) {
      v.copy(hot.p).applyMatrix4(this.grupo.matrixWorld).project(this.camera);
      hot.el.style.left = `${(v.x + 1) / 2 * w}px`;
      hot.el.style.top = `${(1 - v.y) / 2 * h}px`;
    }
    requestAnimationFrame(this.loop);
  }
}
