// A página de assinar: entra com a mesma conta do app e abre o pagamento do Stripe (cartão ou Pix).
const $ = (s) => document.querySelector(s);
const cfg = window.TSFX;
const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseChave, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } });
const FUNCAO = `${cfg.supabaseUrl}/functions/v1/sfx-ia`;
const PENDENTE = 'tsfx-pagar';     // o que a pessoa clicou antes de entrar: depois do login o pagamento segue sozinho
let sessao = null;

function avisar(texto) {
  $('#aviso').textContent = texto;
  $('#aviso').hidden = !texto;
  if (texto) $('#aviso').scrollIntoView({ block: 'center' });
}
function mostrarConta(s) {
  sessao = s;
  const email = s?.user?.email;
  $('#conta-texto').textContent = email ? `Conta: ${email}. É esta conta que será liberada.` : 'Entre com a mesma conta que você usa no app.';
  $('#entrar').hidden = !!email;
  $('#sair').hidden = !email;
  $('#portal').hidden = !email;
  if (email) retomar();
}
function retomar() {
  let p = null;
  try { p = JSON.parse(sessionStorage.getItem(PENDENTE)); sessionStorage.removeItem(PENDENTE); } catch { /* sem storage: a pessoa clica de novo */ }
  if (!p) return;
  const botao = [...document.querySelectorAll('[data-pagar]')].find((b) => b.dataset.tipo === p.tipo && b.dataset.forma === p.forma && (b.dataset.plano || '') === (p.plano || '') && (b.dataset.valor || '') === (p.valor || ''));
  if (botao) irPara(botao, 'checkout', p);
}
const parametros = new URLSearchParams(location.search);
if (parametros.has('pago')) avisar('Pagamento enviado. Assim que ele cair, o plano libera sozinho e você recebe os dados no seu e-mail. Para usar, baixe o app na página inicial e entre com esta mesma conta.');
if (parametros.has('teste')) $('#teste').hidden = false;
if (parametros.has('cancelou')) avisar('O pagamento não foi concluído. Nada foi cobrado.');
const escolhido = parametros.get('plano');
if (escolhido && /^(Pro|Premium|Full)$/.test(escolhido)) {
  $(`#plano-${escolhido}`).classList.add('plano--escolhido');
  $(`#plano-${escolhido}`).scrollIntoView({ block: 'center' });
}

async function entrar() {
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname + location.search, queryParams: { prompt: 'select_account' } },
  });
  if (error) avisar('Não deu para abrir o login do Google. Tente de novo.');
}
async function pedir(rota, corpo) {
  const r = await fetch(`${FUNCAO}/${rota}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${sessao.access_token}`, 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) throw new Error(j.erro || j.error?.message || 'Não deu para abrir o pagamento. Tente de novo.');
  return j.url;
}
async function irPara(botao, rota, corpo) {
  const texto = botao.textContent;
  botao.disabled = true;
  botao.textContent = 'Abrindo…';
  try {
    location.href = await pedir(rota, corpo);
  } catch (e) {
    avisar(e.message);
    botao.disabled = false;
    botao.textContent = texto;
  }
}
$('#entrar').addEventListener('click', entrar);
$('#sair').addEventListener('click', async () => { await sb.auth.signOut(); entrar(); });
$('#portal').addEventListener('click', (e) => irPara(e.currentTarget, 'portal', {}));
for (const b of document.querySelectorAll('[data-pagar]')) {
  b.addEventListener('click', () => {
    const { tipo, plano, valor, forma } = b.dataset;
    if (!sessao) {
      try { sessionStorage.setItem(PENDENTE, JSON.stringify({ tipo, plano, valor, forma })); } catch { /* sem storage */ }
      entrar();
      return;
    }
    irPara(b, 'checkout', { tipo, plano, valor, forma });
  });
}
// voltou do Stripe pela seta do navegador: a página não pode ficar presa em "Abrindo…"
window.addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });
sb.auth.onAuthStateChange((_ev, s) => mostrarConta(s));
sb.auth.getSession().then(({ data }) => mostrarConta(data.session));
