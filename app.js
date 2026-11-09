// Rolagem, vídeo com som, cena 3D e o login para baixar o app.
const $ = (s) => document.querySelector(s);
const parado = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const temWebGL = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
gsap.registerPlugin(ScrollTrigger);

// ---- rolagem suave
let lenis = null;
if (!parado) {
  lenis = new Lenis({ lerp: 0.09 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
for (const a of document.querySelectorAll('a[href^="#"]')) {
  a.addEventListener('click', (e) => {
    const alvo = document.querySelector(a.getAttribute('href'));
    if (!alvo) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(alvo, { offset: a.getAttribute('href') === '#inicio' ? -200 : -70 });
    else alvo.scrollIntoView();
  });
}

// ---- o vídeo: toca mudo; o som só com o clique da pessoa
const demo = $('#demo'), som = $('#som');
function ligarSom(ligar, doComeco) {
  demo.muted = !ligar;
  if (ligar && doComeco) demo.currentTime = 0;
  if (ligar) demo.play().catch(() => {});
  som.setAttribute('aria-pressed', String(ligar));
  som.querySelector('span').textContent = ligar ? 'Desligar o som' : 'Ligar o som';
}
som.addEventListener('click', () => ligarSom(demo.muted, true));
$('[data-ligar-som]').addEventListener('click', () => {
  ligarSom(true, true);
  if (lenis) lenis.scrollTo('#palco-video', { offset: -90 }); else $('#palco-video').scrollIntoView();
});
new IntersectionObserver(([e]) => { if (!e.isIntersecting && !demo.muted) ligarSom(false); }, { threshold: 0.15 }).observe(demo);

// ---- o review completo
const dlg = $('#d-review'), review = $('#review');
$('#abrir-review').addEventListener('click', () => {
  ligarSom(false);
  lenis?.stop();
  dlg.showModal();
  review.play().catch(() => {});
});
// o evento "close" pode atrasar: o áudio tem que parar na hora, em qualquer jeito de fechar
const parouReview = () => { review.pause(); lenis?.start(); };
const fecharReview = () => { dlg.close(); parouReview(); };
$('#fechar-review').addEventListener('click', fecharReview);
dlg.addEventListener('cancel', parouReview);
dlg.addEventListener('close', parouReview);
dlg.addEventListener('click', (e) => { if (e.target === dlg) fecharReview(); });

// ---- movimento
const passos = [...document.querySelectorAll('.passo')];
if (parado || !temWebGL) {
  document.documentElement.classList.add('sem-movimento');
} else {
  // o vídeo vem deitado e assenta com a rolagem
  gsap.fromTo('#palco-video', { rotationX: 15, scale: 0.93 }, {
    rotationX: 0, scale: 1, ease: 'none',
    scrollTrigger: { start: 0, end: () => Math.min(620, window.innerHeight * 0.75), scrub: true },
  });

  // e acompanha o mouse de leve, como um objeto na mão
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const giro = gsap.quickTo('#palco-video', 'rotationY', { duration: 0.9, ease: 'power3.out' });
    const cena = $('.video-cena');
    cena.addEventListener('pointermove', (e) => {
      const r = cena.getBoundingClientRect();
      giro(((e.clientX - r.left) / r.width - 0.5) * 5);
    });
    cena.addEventListener('pointerleave', () => giro(0));
  }

  // o manifesto acende palavra por palavra
  const texto = $('#manifesto');
  const palavras = texto.textContent.trim().split(/\s+/);
  texto.setAttribute('aria-label', texto.textContent.trim());
  texto.innerHTML = palavras.map((p) => `<span aria-hidden="true">${p}</span>`).join(' ');
  gsap.fromTo(texto.children, { opacity: 0.16 }, {
    opacity: 1, stagger: 0.5, ease: 'none',
    scrollTrigger: { trigger: texto, start: 'top 80%', end: 'bottom 45%', scrub: true },
  });

  const iniciar = async () => {
    const { criarCena } = await import('./cena3d.js');
    const cena = await criarCena($('#cena3d'), $('#cena-palco'), $('#rotulos'));
    const fixa = document.querySelector('.cena-fixa'), barra = $('#cena-progresso');
    const FAIXAS = [[0, 0.24], [0.24, 0.54], [0.56, 0.82], [0.85, 1.01]];
    const atualizar = (p) => {
      cena.progresso(p);
      barra.style.transform = `scaleX(${p})`;
      // o palco abre até encostar nas bordas
      const k = Math.min(1, p / 0.05);
      const base = window.innerWidth <= 680 ? 10 : 20, raio = window.innerWidth <= 680 ? 28 : 40;
      fixa.style.setProperty('--inset', `${base * (1 - k)}px`);
      fixa.style.setProperty('--raio-cena', `${raio * (1 - k)}px`);
      passos.forEach((el, i) => {
        const [a, b] = FAIXAS[i];
        const entra = i === 0 ? 1 : gsap.utils.clamp(0, 1, (p - a) / 0.04);
        const sai = i === 3 ? 0 : gsap.utils.clamp(0, 1, (p - (b - 0.04)) / 0.04);
        el.style.opacity = String(entra * (1 - sai));
        el.style.transform = `translateY(${(1 - entra) * 26 - sai * 26}px)`;
      });
    };
    atualizar(0);
    ScrollTrigger.create({ trigger: '.cena', start: 'top top', end: 'bottom bottom', onUpdate: (s) => atualizar(s.progress) });
    // o 3D ocupa a tela inteira: o menu sai e volta quando a cena termina
    ScrollTrigger.create({ trigger: '.cena', start: 'top 72px', end: 'bottom bottom', toggleClass: { targets: '.topo', className: 'topo--fora' } });
  };
  // só carrega o 3D quando a rolagem chega perto
  const vigia = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    vigia.disconnect();
    iniciar().catch(() => document.documentElement.classList.add('sem-movimento'));
  }, { rootMargin: '150% 0px' });
  vigia.observe($('.cena'));
}

// ---- conta e download: a mesma conta do app
const cfg = window.TSFX;
const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseChave, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } });
const VOLTOU = 'tsfx-volta-baixar';

function mostrarConta(sessao) {
  const u = sessao?.user;
  $('#caixa-entrar').hidden = !!u;
  $('#caixa-baixar').hidden = !u;
  if (!u) return;
  const nome = u.user_metadata?.full_name || u.user_metadata?.name || u.email;
  $('#quem').textContent = String(nome).split(/\s+/)[0];
  $('#link-dmg').href = cfg.dmg;
  // o .dmg só instala no Mac: no celular, avisa antes de gastar a internet da pessoa
  const noCelular = /iPhone|iPad|Android/i.test(navigator.userAgent);
  $('#dmg-dados').textContent = `Versão ${cfg.versao} · ${cfg.tamanho} · ${u.email}${noCelular ? ' · abra este site no seu Mac para instalar' : ''}`;
}
sb.auth.onAuthStateChange((_ev, sessao) => {
  mostrarConta(sessao);
  if (sessao && sessionStorage.getItem(VOLTOU)) {
    sessionStorage.removeItem(VOLTOU);
    setTimeout(() => { if (lenis) lenis.scrollTo('#baixar', { offset: -70, immediate: true }); else $('#baixar').scrollIntoView(); }, 300);
  }
});
sb.auth.getSession().then(({ data }) => mostrarConta(data.session));

$('#entrar-google').addEventListener('click', async () => {
  $('#aviso-entrar').textContent = '';
  sessionStorage.setItem(VOLTOU, '1');
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } },
  });
  if (error) $('#aviso-entrar').textContent = 'Não deu para abrir o login do Google. Tente de novo.';
});
$('#sair').addEventListener('click', () => sb.auth.signOut());

// só na máquina de teste: ver o estado "logado" sem passar pelo Google
if (['127.0.0.1', 'localhost'].includes(location.hostname)) window.__tsfxConta = mostrarConta;
