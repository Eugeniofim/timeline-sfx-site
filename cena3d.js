// A timeline real do comercial da GLS em 3D: 421 sons em 11 trilhas, guiada pela rolagem e tocada pelo mouse.
// 0 → 0,2 o filme · 0,2 → 0,55 o cursor corre o filme · 0,55 → 0,84 as trilhas se abrem em camadas · depois viram uma faixa só.
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/addons/RoundedBoxGeometry.js';
import { RoomEnvironment } from './vendor/addons/RoomEnvironment.js';
import { EffectComposer } from './vendor/addons/EffectComposer.js';
import { RenderPass } from './vendor/addons/RenderPass.js';
import { UnrealBloomPass } from './vendor/addons/UnrealBloomPass.js';
import { OutputPass } from './vendor/addons/OutputPass.js';

const POR_SEG = 3, MEIO = 15, DZ = 1.25, META_TRILHA = 5, ABERTO = 2.6, FECHADO = 0.02, ONDA_ALTURA = 27;
const X = (t) => (t - MEIO) * POR_SEG;
const liso = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mistura = (a, b, t) => a + (b - a) * t;

// câmera por trecho da rolagem: [progresso, posição, alvo]
const CAM = [
  [0.00, [-50, 2.6, 1], [-38, 0.5, -9.5]],
  [0.20, [-50, 7, 22], [-30, 0.5, -2]],
  [0.54, [38, 5, 17], [46, 0.5, -2]],
  [0.66, [-12, 7, 88], [-12, -11, 0]],
  [0.82, [-14, 5, 86], [-12, -10, 0]],
  [1.00, [0, 4, 92], [0, -6, 0]],
];

function camera(p, pos, alvo) {
  let k = 0;
  while (k < CAM.length - 2 && p > CAM[k + 1][0]) k++;
  const [a, pa, ta] = CAM[k], [b, pb, tb] = CAM[k + 1];
  const u = liso(a, b, p);
  pos.set(mistura(pa[0], pb[0], u), mistura(pa[1], pb[1], u), mistura(pa[2], pb[2], u));
  alvo.set(mistura(ta[0], tb[0], u), mistura(ta[1], tb[1], u), mistura(ta[2], tb[2], u));
}

export async function criarCena(canvas, palco, caixaRotulos) {
  const dados = await fetch('dados/gls.json').then((r) => r.json());
  const celular = window.matchMedia('(max-width: 680px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, celular ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const cena = new THREE.Scene();
  cena.background = new THREE.Color(0x0b0b0d);
  cena.fog = new THREE.FogExp2(0x0b0b0d, 0.0055);
  const pmrem = new THREE.PMREMGenerator(renderer);
  cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const sol = new THREE.DirectionalLight(0xfff0d8, 1.8);
  sol.position.set(-20, 40, 30);
  cena.add(sol);

  const cam = new THREE.PerspectiveCamera(36, 1, 0.1, 400);

  // os sons: uma caixa por clipe, na cor da trilha do app
  const geo = new RoundedBoxGeometry(1, 1, 1, 3, 0.16);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.34, metalness: 0.2, envMapIntensity: 0.85 });
  const n = dados.clipes.length;
  const blocos = new THREE.InstancedMesh(geo, mat, n);
  blocos.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  blocos.frustumCulled = false;
  const cores = dados.trilhas.map((t) => new THREE.Color(t.cor));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < n; i++) blocos.setColorAt(i, cores[dados.clipes[i][0]]);
  cena.add(blocos);

  // a imagem do filme, em tira, atrás das trilhas e no mesmo tempo
  const texFilme = await new THREE.TextureLoader().loadAsync('midia/filme-tira.jpg');
  texFilme.colorSpace = THREE.SRGBColorSpace;
  texFilme.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const alturaFilme = (30 * POR_SEG) * (115 / (204 * 30));
  const filmeZ = -DZ * 7.6, filmeY = alturaFilme / 2 + 0.2;
  const matFilme = new THREE.MeshBasicMaterial({ map: texFilme, color: new THREE.Color(1.35, 1.35, 1.35), toneMapped: false, transparent: true });
  const filme = new THREE.Mesh(new THREE.PlaneGeometry(30 * POR_SEG, alturaFilme), matFilme);
  filme.position.set(0, filmeY, filmeZ);
  cena.add(filme);

  // o cursor: uma linha que cruza as trilhas e marca o quadro no filme
  const cursorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf5c451).multiplyScalar(2.2), toneMapped: false });
  const cursor = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), cursorMat);
  const cursorFilme = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), cursorMat);
  cursorFilme.scale.set(0.09, alturaFilme + 0.5, 0.04);
  cena.add(cursor, cursorFilme);

  // o fim: as 421 caixas viram a forma de onda da mixagem real do comercial
  const B = dados.onda.length, larguraBarra = 30 * POR_SEG / B;
  const barras = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.1), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.1, envMapIntensity: 0.6 }), B);
  barras.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  barras.frustumCulled = false;
  barras.visible = false;
  const amarelo = new THREE.Color(0xf5c451);
  // sem o brilho do celular, um amarelo forte demais desbota para bege
  for (let i = 0; i < B; i++) barras.setColorAt(i, c.copy(amarelo).multiplyScalar(celular ? 0.6 + dados.onda[i] * 0.45 : 0.55 + dados.onda[i] * 1.9));
  cena.add(barras);

  // pós: brilho só onde o som está tocando (no celular vai sem)
  let composer = null;
  if (!celular) {
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(cena, cam));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.34, 0.5, 1.0));
    composer.addPass(new OutputPass());
  }

  // os nomes das trilhas, em HTML, presos às camadas abertas
  const rotulos = dados.trilhas.map((t) => {
    const e = document.createElement('span');
    e.textContent = t.nome;
    caixaRotulos.appendChild(e);
    return e;
  });

  const estado = { alvo: 0, p: 0, mx: 0, my: 0, mxA: 0, myA: 0, visivel: true, ex: -1, junta: -1, onda: 0, ondaX: 0, ultimoMouse: -1e9, sobre: false };
  const pos = new THREE.Vector3(), alvo = new THREE.Vector3(), pr = new THREE.Vector3(), toque = new THREE.Vector3();
  const raio = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const chao = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), parede = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  let largura = 1, altura = 1;

  function medir() {
    largura = palco.clientWidth; altura = palco.clientHeight;
    renderer.setSize(largura, altura, false);
    composer?.setSize(largura, altura);
    cam.aspect = largura / altura;
    // tela em pé: lente mais aberta para caber a mesma cena
    cam.fov = cam.aspect < 1 ? 58 : 36;
    cam.updateProjectionMatrix();
  }
  medir();

  // quanto o mouse levanta o som i (0 a 1)
  const levanta = (i) => {
    if (estado.onda < 0.002) return 0;
    const [, a, b] = dados.clipes[i];
    const d = (X((a + b) / 2) - estado.ondaX) / 5;
    return estado.onda * Math.exp(-d * d);
  };

  function posicionar(ex, junta) {
    const passo = mistura(ABERTO, FECHADO, junta) * ex;
    for (let i = 0; i < n; i++) {
      const [tr, a, b] = dados.clipes[i];
      const k = tr - META_TRILHA;
      const g = levanta(i);
      const y = -k * passo + 0.14 * (1 - junta) + g * 1.3 * (1 - ex);
      const z = k * DZ * (1 - ex) + g * 3 * ex;
      v.set(X((a + b) / 2), y, z);
      const alturaBloco = mistura((0.26 + ex * 0.9) * (1 + g * ex * 0.9), 0.05, junta);
      s.set(Math.max(0.18, (b - a) * POR_SEG - 0.07), alturaBloco, DZ * 0.8 * mistura(1, 0.2, ex));
      m.compose(v, q, s);
      blocos.setMatrixAt(i, m);
    }
    blocos.instanceMatrix.needsUpdate = true;

    barras.visible = junta > 0.001;
    if (!barras.visible) return;
    for (let i = 0; i < B; i++) {
      const t = i / (B - 1);
      const sobe = liso(t * 0.45, t * 0.45 + 0.55, junta);
      const xb = -45 + (i + 0.5) * larguraBarra;
      let d = 0;
      if (estado.onda > 0) { d = (xb - estado.ondaX) / 5; d = estado.onda * Math.exp(-d * d); }
      v.set(xb, 0, 0);
      s.set(larguraBarra * 0.62, Math.max(0.03, dados.onda[i] * ONDA_ALTURA * sobe * (1 + d * 0.3)), 0.5);
      m.compose(v, q, s);
      barras.setMatrixAt(i, m);
    }
    barras.instanceMatrix.needsUpdate = true;
  }

  function pintar(t, geral) {
    for (let i = 0; i < n; i++) {
      const [tr, a, b] = dados.clipes[i];
      const ganho = t >= a && t <= b ? 2.6 : t > b ? 0.9 : 0.34 + 0.66 * geral;
      c.copy(cores[tr]).multiplyScalar(Math.max(ganho, geral, 0.34 + levanta(i) * 2.4));
      blocos.setColorAt(i, c);
    }
    blocos.instanceColor.needsUpdate = true;
  }

  let ultimo = performance.now();
  function quadro(agora) {
    requestAnimationFrame(quadro);
    if (!estado.visivel) { ultimo = agora; return; }
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;
    const f = 1 - Math.pow(1 - 0.085, dt * 60);
    estado.p += (estado.alvo - estado.p) * f;
    estado.mxA += (estado.mx - estado.mxA) * f;
    estado.myA += (estado.my - estado.myA) * f;
    const p = estado.p;

    const ex = liso(0.56, 0.68, p);
    const junta = liso(0.84, 0.97, p);
    const tempo = 30 * liso(0.18, 0.55, p);
    const geral = Math.max(liso(0.54, 0.62, p) * 1.05, p < 0.18 ? 1 - liso(0.1, 0.18, p) : 0);

    camera(p, pos, alvo);
    cam.position.set(pos.x + estado.mxA * 5, pos.y - estado.myA * 3, pos.z);
    cam.lookAt(alvo);
    cam.updateMatrixWorld();

    // o mouse toca a timeline: acha o ponto sob o ponteiro no plano das trilhas
    const ativo = !celular && estado.sobre && agora - estado.ultimoMouse < 1600;
    if (ativo) {
      ndc.set(estado.mx * 2, -estado.my * 2);
      raio.setFromCamera(ndc, cam);
      if (raio.ray.intersectPlane(ex > 0.5 ? parede : chao, toque)) estado.ondaX += (toque.x - estado.ondaX) * Math.min(1, f * 3);
    }
    const ondaAntes = estado.onda;
    estado.onda += ((ativo ? 1 : 0) - estado.onda) * f;
    if (estado.onda < 0.002) estado.onda = 0;
    if (estado.onda > 0 || ondaAntes > 0 || Math.abs(ex - estado.ex) > 1e-3 || Math.abs(junta - estado.junta) > 1e-3) {
      estado.ex = ex; estado.junta = junta;
      posicionar(ex, junta);
    }
    pintar(tempo, geral);

    const abre = ex * (1 - junta);
    const alturaAberta = (dados.trilhas.length + 0.6) * ABERTO;
    cursor.position.set(X(tempo), 0.34 * (1 - abre), mistura(-1.25, 0, abre));
    cursor.scale.set(0.1, mistura(0.1, alturaAberta, abre), mistura(16.5, 0.1, abre));
    cursor.visible = junta < 0.98;
    matFilme.opacity = 1 - liso(0.55, 0.62, p);
    filme.visible = matFilme.opacity > 0.01;
    cursorFilme.visible = filme.visible;
    cursorFilme.position.set(X(tempo), filmeY, filmeZ + 0.06);

    // rótulos: acompanham o começo de cada camada aberta
    const op = abre > 0.6 ? (abre - 0.6) / 0.4 : 0;
    const passo = mistura(ABERTO, FECHADO, junta) * ex;
    for (let k = 0; k < rotulos.length; k++) {
      const off = k - META_TRILHA;
      pr.set(X(0) - 1.2, -off * passo + 0.2, off * DZ * (1 - ex));
      pr.project(cam);
      const e = rotulos[k];
      e.style.opacity = String(op);
      e.style.transform = `translate(${((pr.x * 0.5 + 0.5) * largura).toFixed(1)}px, ${((-pr.y * 0.5 + 0.5) * altura).toFixed(1)}px) translate(-100%, -50%)`;
    }

    if (composer) composer.render(dt); else renderer.render(cena, cam);
  }
  requestAnimationFrame(quadro);

  new IntersectionObserver(([e]) => { estado.visivel = e.isIntersecting; }, { rootMargin: '10%' }).observe(palco);
  window.addEventListener('resize', medir);
  window.addEventListener('pointermove', (e) => {
    estado.mx = e.clientX / window.innerWidth - 0.5;
    estado.my = e.clientY / window.innerHeight - 0.5;
    estado.ultimoMouse = performance.now();
    estado.sobre = e.pointerType === 'mouse';
  }, { passive: true });

  return { progresso: (x) => { estado.alvo = x; } };
}
