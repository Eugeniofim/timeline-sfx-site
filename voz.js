// A locução dos textos do site, presa à rolagem como um vinil (a agulha está em voz-vinil.js).
// O navegador não deixa tocar som só com a rolagem: a pessoa liga a voz com um clique no disco.
export const vozDepuracao = {};   // para conferir de fora, sem tocar em nada aqui

export function criarVoz({ passos, faixas, aoLigar }) {
  const botao = document.querySelector('#voz'), rotulo = botao.querySelector('.voz-rotulo'), disco = botao.querySelector('.voz-disco');
  const ROTULO_DESLIGADA = rotulo.textContent;
  let ctx = null, agulha = null, falas = null, pontos = [], ligada = false, pausada = false, carregando = false, ultimo = -1, dica = 0;

  const topo = (s) => document.querySelector(s).getBoundingClientRect().top + window.scrollY;
  const base = (s) => document.querySelector(s).getBoundingClientRect().bottom + window.scrollY;

  // em que trecho da página cada fala acontece, em pixels de rolagem
  function trechos() {
    const vh = window.innerHeight, max = document.documentElement.scrollHeight - vh;
    const cena = document.querySelector('.cena'), parada = document.documentElement.classList.contains('sem-movimento');
    const passo = (i) => {
      if (parada) {
        const r = passos[i].getBoundingClientRect(), y = r.top + window.scrollY;
        return [y - vh * 0.8, y + r.height - vh * 0.4];
      }
      const y = topo('.cena'), curso = cena.offsetHeight - vh;
      return [y + curso * faixas[i][0], y + curso * faixas[i][1]];
    };
    return {
      heroi: [0, topo('.manifesto') - vh * 0.7],
      manifesto: [topo('#manifesto') - vh * 0.85, base('#manifesto') - vh * 0.4],
      passo1: passo(0), passo2: passo(1), passo3: passo(2), passo4: passo(3),
      aberto: [topo('.aberto .aberto-topo') - vh * 0.8, topo('.aberto-grade') - vh * 0.55],
      biblioteca: [topo('.card--biblioteca') - vh * 0.55, base('.card--biblioteca') - vh * 0.75],
      planos: [topo('.valores .aberto-topo') - vh * 0.8, base('.planos') - vh * 0.8],
      baixar: [topo('#baixar') - vh * 0.8, max],
    };
  }

  function recalcular() {
    if (!falas) return;
    const t = trechos(), max = document.documentElement.scrollHeight - window.innerHeight;
    let antes = 0;
    pontos = [];
    for (const f of falas) {
      const a = Math.max(t[f.id][0], antes), b = Math.min(Math.max(t[f.id][1], a + 160), Math.max(max, a + 1));
      pontos.push([a, f.de], [b, f.ate]);
      antes = b;
    }
  }

  function tempo(y) {
    if (y <= pontos[0][0]) return pontos[0][1];
    for (let i = 1; i < pontos.length; i++) {
      if (y <= pontos[i][0]) {
        const [y0, t0] = pontos[i - 1], [y1, t1] = pontos[i];
        return t0 + (t1 - t0) * (y - y0) / Math.max(1, y1 - y0);
      }
    }
    return pontos[pontos.length - 1][1];
  }

  function aCadaQuadro() {
    if (!ligada) return;
    const t = tempo(window.scrollY);
    if (Math.abs(t - ultimo) > 0.002) { ultimo = t; agulha.port.postMessage({ alvo: t }); }
  }

  function mostrar(texto) {
    rotulo.textContent = texto;
    botao.setAttribute('aria-pressed', String(ligada));
  }

  async function preparar() {
    ctx = new AudioContext({ latencyHint: 'interactive' });
    ctx.resume();                                   // ainda dentro do clique: é o que libera o som
    await ctx.audioWorklet.addModule('voz-vinil.js');
    const [mapa, bruto] = await Promise.all([
      fetch('dados/voz-rolagem.json').then((r) => r.json()),
      fetch('midia/voz-rolagem.mp3').then((r) => { if (!r.ok) throw new Error('sem áudio'); return r.arrayBuffer(); }),
    ]);
    const audio = await ctx.decodeAudioData(bruto);
    agulha = new AudioWorkletNode(ctx, 'voz-vinil', { numberOfInputs: 0, outputChannelCount: [2] });
    const medidor = ctx.createAnalyser(), mestre = ctx.createGain();
    agulha.connect(medidor).connect(mestre).connect(ctx.destination);
    Object.assign(vozDepuracao, { ctx, agulha, medidor, mestre });
    agulha.port.onmessage = ({ data }) => {
      disco.style.transform = `rotate(${data.t * 200}deg)`;      // 33 rotações por minuto
      vozDepuracao.t = data.t;
      vozDepuracao.v = data.v;
    };
    const dados = audio.getChannelData(0).slice();
    agulha.port.postMessage({ dados, taxa: audio.sampleRate }, [dados.buffer]);
    falas = mapa.falas;
    recalcular();
    ScrollTrigger.addEventListener('refresh', recalcular);
    window.addEventListener('resize', recalcular);
    gsap.ticker.add(aCadaQuadro);
  }

  async function ligar() {
    if (carregando) return;
    carregando = true;
    mostrar('Carregando…');
    try {
      if (!ctx) await preparar();
      await ctx.resume();
      aoLigar();
      recalcular();
      ultimo = tempo(window.scrollY);
      agulha.port.postMessage({ alvo: ultimo, saltar: true, ligada: true });
      ligada = true;
      pausada = false;
      mostrar('Role a página');
      clearTimeout(dica);
      dica = setTimeout(() => { if (ligada) mostrar('Desligar a voz'); }, 3500);
    } catch {
      ligada = false;
      mostrar('Voz indisponível');
      botao.disabled = true;
    }
    carregando = false;
  }

  function desligar() {
    if (!ligada) return;
    ligada = false;
    clearTimeout(dica);
    agulha.port.postMessage({ ligada: false });
    mostrar(ROTULO_DESLIGADA);
  }

  // o review e os outros vídeos têm som próprio: a voz espera
  function pausar(sim) {
    if (!ligada || pausada === sim) return;
    pausada = sim;
    agulha.port.postMessage({ ligada: !sim });
  }

  botao.addEventListener('click', () => (ligada ? desligar() : ligar()));
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !ligada) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });
  return { desligar, pausar };
}
