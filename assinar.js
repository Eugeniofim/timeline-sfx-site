// A página de assinar: entra com a mesma conta do app e abre o pagamento do Stripe (cartão ou Pix).
const $ = (s) => document.querySelector(s);
const cfg = window.TSFX;
const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseChave, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } });
const FUNCAO = `${cfg.supabaseUrl}/functions/v1/sfx-ia`;
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
}
const parametros = new URLSearchParams(location.search);
if (parametros.has('pago')) avisar('Pagamento enviado. Assim que ele cair, o plano libera sozinho. No app, clique em "Já paguei: conferir".');
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
    if (!sessao) { entrar(); return; }
    const { tipo, plano, valor, forma } = b.dataset;
    irPara(b, 'checkout', { tipo, plano, valor, forma });
  });
}
sb.auth.onAuthStateChange((_ev, s) => mostrarConta(s));
sb.auth.getSession().then(({ data }) => mostrarConta(data.session));
