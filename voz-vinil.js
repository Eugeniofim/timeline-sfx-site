// A agulha: toca a locução como um vinil. A rolagem diz onde o disco deveria estar; a agulha corre até lá,
// para a frente ou para trás, e o tom muda com a velocidade (o scratch). Roda na linha de áudio do navegador.
// 10/11, pedido dele: bem mais lento e mexendo menos no tom, sempre entendível, sem extremo agudo nem grave.
const VELOCIDADE_MAX = 1.15;   // no máximo uns 2 semitons acima; o que sobra ela alcança depois que a rolagem parar
const VELOCIDADE_MIN = 0.88;   // no mínimo uns 2 semitons abaixo: mais devagar que isso, fica em silêncio
const FORCA = 4;               // 0,25 s de atraso = velocidade normal
const SALTO = 9;               // mais que isso de distância (clicou no menu): pula em vez de correr
const INERCIA = 0.12;          // segundos para mudar de velocidade: a massa do disco
const CHEGOU = 0.05;           // a esta distância do alvo, a agulha para
const FOLGA = 0.18;            // parada, só volta a andar quando o alvo se afastar disto (não fica tremendo)

class VozVinil extends AudioWorkletProcessor {
  constructor() {
    super();
    this.d = null;
    this.taxa = 44100;
    this.p = 0;                // onde a agulha está, em amostras do áudio
    this.alvo = 0;             // onde a rolagem quer que ela esteja, em segundos
    this.v = 0;
    this.g = 0;
    this.ligada = false;
    this.conta = 0;
    this.parada = true;
    this.port.onmessage = ({ data: m }) => {
      if (m.dados) { this.d = m.dados; this.taxa = m.taxa; }
      if (m.alvo !== undefined) {
        this.alvo = m.alvo;
        if (m.saltar) { this.p = m.alvo * this.taxa; this.v = 0; this.g = 0; }
      }
      if (m.ligada !== undefined) this.ligada = m.ligada;
    };
  }

  ler(p) {                     // interpolação de 4 pontos: lento ou rápido, sem chiado de degrau
    const d = this.d, i = Math.floor(p), f = p - i;
    const a = d[i - 1] ?? 0, b = d[i] ?? 0, c = d[i + 1] ?? 0, e = d[i + 2] ?? 0;
    const c1 = (c - a) / 2, c2 = a - 2.5 * b + 2 * c - e / 2, c3 = (e - a) / 2 + 1.5 * (b - c);
    return ((c3 * f + c2) * f + c1) * f + b;
  }

  process(_entradas, saidas) {
    const saida = saidas[0], n = saida[0].length;
    if (!this.d) return true;
    const fim = this.d.length - 3;
    const erro = this.alvo - this.p / this.taxa;
    if (Math.abs(erro) > SALTO) {
      this.p = (this.alvo - Math.sign(erro) * 0.3) * this.taxa;
      this.v = 0;
      this.g = 0;
    }
    const passo = this.taxa / sampleRate;
    const av = 1 - Math.exp(-1 / (sampleRate * INERCIA));
    const ag = 1 - Math.exp(-1 / (sampleRate * 0.025));
    for (let k = 0; k < n; k++) {
      const e = this.alvo - this.p / this.taxa;
      const dist = Math.abs(e);
      if (this.parada ? dist > FOLGA : dist < CHEGOU) this.parada = !this.parada;
      const desejo = this.parada ? 0 : Math.sign(e) * Math.max(VELOCIDADE_MIN, Math.min(VELOCIDADE_MAX, dist * FORCA));
      this.v += (desejo - this.v) * av;
      // abaixo da faixa entendível (ao parar ou virar de lado) a voz some: nunca se ouve o grave arrastado
      const ganho = this.ligada ? Math.max(0, Math.min(1, (Math.abs(this.v) - 0.55) / 0.3)) : 0;
      this.g += (ganho - this.g) * ag;
      this.p = Math.max(1, Math.min(fim, this.p + this.v * passo));
      const s = this.ler(this.p) * this.g;
      for (const canal of saida) canal[k] = s;
    }
    if ((this.conta += n) > sampleRate / 25) {
      this.conta = 0;
      this.port.postMessage({ t: this.p / this.taxa, v: this.v });
    }
    return true;
  }
}
registerProcessor('voz-vinil', VozVinil);
