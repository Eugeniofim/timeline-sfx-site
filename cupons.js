// Só o estúdio: cria cupons de teste, vê quem usou e desliga.
const $ = (s) => document.querySelector(s);
const cfg = window.TSFX;
const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseChave, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } });
const FUNCAO = `${cfg.supabaseUrl}/functions/v1/sfx-ia/cupons`;
let sessao = null;
const avisar = (t) => { $('#aviso').textContent = t; $('#aviso').hidden = !t; };
const data = (d) => new Date(d).toLocaleDateString('pt-BR');
const link = (c) => `https://www.timelinesfx.com/assinar.html?cupom=${encodeURIComponent(c)}`;
const sugerir = () => 'TESTE-' + Math.random().toString(36).slice(2, 6).toUpperCase();

async function pedir(corpo) {
  const r = await fetch(FUNCAO, { method: 'POST', headers: { authorization: `Bearer ${sessao.access_token}`, 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || 'Não deu certo. Tente de novo.');
  return j.cupons || [];
}
function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k === 'onclick' ? (e.onclick = v) : e.setAttribute(k, v);
  for (const f of filhos) e.append(f);
  return e;
}
function mostrar(cupons) {
  $('#lista').replaceChildren(...cupons.map((c) => {
    const vivo = c.ativo && new Date(c.expira) > new Date() && c.usos < c.max_usos;
    const copiar = el('button', { class: 'botao botao--fio botao--p', type: 'button', onclick: async (e) => {
      await navigator.clipboard.writeText(`Oi! Seu acesso de teste ao Timeline SFX: ${link(c.codigo)} (entre com o Google; o cupom ${c.codigo} já vem preenchido).`);
      e.target.textContent = 'Copiado';
    } }, 'Copiar convite');
    const acoes = el('div', { class: 'acoes' }, copiar);
    if (c.ativo) acoes.append(el('button', { class: 'botao botao--fio botao--p', type: 'button', onclick: async () => {
      try { mostrar(await pedir({ acao: 'desligar', codigo: c.codigo })); } catch (e) { avisar(e.message); }
    } }, 'Desligar'));
    return el('div', { class: 'cupom-linha' + (vivo ? '' : ' desligado') },
      el('b', {}, c.codigo),
      el('span', {}, `${c.creditos.toLocaleString('pt-BR')} créditos · ${c.dias} dias de ElevenLabs · usado ${c.usos} de ${c.max_usos} · vale até ${data(c.expira)}${c.ativo ? '' : ' · desligado'}`),
      el('span', {}, c.nota ? `Para: ${c.nota}` : ''),
      el('span', {}, c.quem.length ? `Usaram: ${c.quem.join(', ')}` : 'Ninguém usou ainda'),
      acoes);
  }));
}
async function carregar() {
  try { mostrar(await pedir({ acao: 'listar' })); $('#novo').hidden = false; } catch (e) { avisar(e.message); }
}
$('#c-codigo').value = sugerir();
$('#novo').addEventListener('submit', async (e) => {
  e.preventDefault();
  const b = $('#novo button'); b.disabled = true;
  try {
    mostrar(await pedir({ acao: 'criar', codigo: $('#c-codigo').value, creditos: $('#c-creditos').value, dias: $('#c-dias').value,
                         usos: $('#c-usos').value, validade: $('#c-validade').value, nota: $('#c-nota').value }));
    avisar(`Cupom ${$('#c-codigo').value.toUpperCase()} criado. Use "Copiar convite" para mandar.`);
    $('#c-codigo').value = sugerir(); $('#c-nota').value = '';
  } catch (er) { avisar(er.message); }
  b.disabled = false;
});
$('#entrar').addEventListener('click', () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } } }));
function conta(s) {
  sessao = s;
  $('#conta-texto').textContent = s?.user?.email ? `Conta: ${s.user.email}` : 'Entre com a conta do estúdio.';
  $('#entrar').hidden = !!s;
  if (s) carregar();
}
sb.auth.onAuthStateChange((_e, s) => conta(s));
sb.auth.getSession().then(({ data: d }) => conta(d.session));
