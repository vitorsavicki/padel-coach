import type { Child } from 'hono/jsx';
import type { User } from '../lib/session';

// Identidade visual: quadra de padel (verde-teal), bola amarela e areia clara.
export const CSS_BASE = `
:root{
  --tinta:#0a1f1a; --fundo:#f2f8f5; --papel:#ffffff;
  --quadra:#0f766e; --quadra-esc:#0a4f4a; --quadra-clara:#ccfbf1;
  --bola:#d9f24a; --cinza:#5b716b; --borda:#d7e5df;
}
*{box-sizing:border-box;margin:0}
html{scroll-behavior:smooth}
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--tinta);background:var(--fundo);line-height:1.55;-webkit-font-smoothing:antialiased}
a{color:inherit}
.wrap{max-width:1040px;margin:0 auto;padding:0 20px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:13px 24px;border-radius:12px;font-weight:700;text-decoration:none;border:0;cursor:pointer;font-size:1rem;font-family:inherit;transition:transform .15s ease,box-shadow .15s ease}
.btn:hover{transform:translateY(-1px)}
.btn-pri{background:var(--quadra);color:#fff;box-shadow:0 10px 22px -12px rgba(15,118,110,.9)}
.btn-pri:hover{background:var(--quadra-esc)}
.btn-sec{background:#fff;color:var(--quadra-esc);border:2px solid var(--borda)}
.btn-mini{padding:8px 16px;border-radius:10px;font-size:.9rem}
.btn-largo{width:100%}
.btn[disabled]{opacity:.55;cursor:not-allowed;transform:none}
.sec{padding:56px 0}
.sec h2{font-size:1.7rem;text-align:center;margin-bottom:8px}
.sec .sub-sec{text-align:center;color:var(--cinza);margin-bottom:30px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px}
.card{background:var(--papel);border:1px solid var(--borda);border-radius:16px;padding:24px;box-shadow:0 1px 2px rgba(10,31,26,.04)}
.card h3{margin-bottom:6px;font-size:1.05rem}
.card p{color:var(--cinza);font-size:.95rem}
.card .n{display:inline-flex;align-items:center;justify-content:center;background:var(--bola);color:var(--quadra-esc);width:34px;height:34px;border-radius:50%;font-weight:800;margin-bottom:10px}
.topo{background:rgba(255,255,255,.9);backdrop-filter:blur(8px);border-bottom:1px solid var(--borda);padding:12px 0;position:sticky;top:0;z-index:20}
.topo .wrap{display:flex;justify-content:space-between;align-items:center;gap:16px}
.logo{display:flex;align-items:center;gap:9px;font-weight:800;text-decoration:none;color:var(--tinta);font-size:1.05rem;letter-spacing:-.01em}
.logo svg{flex:none}
.topo nav{display:flex;gap:20px;align-items:center}
.topo nav a{text-decoration:none;color:#2c4740;font-weight:600;font-size:.93rem}
.topo nav a:hover{color:var(--quadra)}
.pagina{padding:48px 20px 64px;max-width:760px;margin:0 auto}
.pagina h1{font-size:1.85rem;margin-bottom:6px;letter-spacing:-.02em}
.pagina .sub{color:var(--cinza);margin-bottom:24px}
.form{max-width:400px;display:grid;gap:14px;text-align:left}
.campo{display:grid;gap:6px;font-size:.88rem;font-weight:600;color:#2c4740}
.campo input{padding:12px;border:1px solid #c3d6cf;border-radius:10px;font-size:1rem;background:#fff;font-family:inherit}
.campo input:focus{outline:2px solid var(--quadra);border-color:transparent}
.troca{margin-top:18px;font-size:.95rem;color:var(--cinza)}
.troca a{color:var(--quadra);font-weight:700;text-decoration:none}
.flash{background:#fff8e1;border:1px solid #ecd27a;color:#7a5a00;padding:11px 15px;border-radius:10px;font-size:.93rem;margin-bottom:18px}
.flash.ok{background:#e8f8ef;border-color:#9fd9b8;color:#14663c}
.flash.erro{background:#fdecec;border-color:#efb1b1;color:#8f2626}
footer{text-align:center;color:#7d938c;font-size:.85rem;padding:34px 20px;border-top:1px solid var(--borda);margin-top:40px}
footer a{color:#5b716b}
@media (max-width:640px){
  .topo nav{gap:12px}
  .topo nav a{font-size:.86rem}
  .pagina{padding:32px 16px 48px}
  .sec{padding:40px 0}
}
`;

const TEXTOS_MSG: Record<string, string> = {
  email_usado: 'Este e-mail ja tem conta. Tente entrar.',
  dados: 'Confira os dados: nome, e-mail e senha (minimo 8 caracteres).',
  arquivo: 'Escolha um video para enviar.',
  tipo: 'O video precisa ser mp4 ou mov.',
  tamanho: 'Video muito grande. Envie um clipe de ate 20MB (mais ou menos 2 minutos).',
  senha_errada: 'E-mail ou senha incorretos.',
  saiu: 'Voce saiu. Ate o proximo treino!',
  csrf: 'Sua sessao expirou. Recarregue a pagina e tente de novo.',
  sessao: 'Entre na sua conta para continuar.',
  sem_video: 'Video nao encontrado na sua conta.',
  ia_off: 'A analise automatica ainda nao esta ligada. Estamos finalizando essa parte.',
  analisado: 'Analise concluida! Confira o feedback do coach abaixo.',
  erro_ia: 'Nao conseguimos analisar agora. Tente de novo em alguns minutos.',
  processando: 'O coach ja esta assistindo esse video. Espere a analise terminar.',
  video_apagado: 'Video apagado. Ele saiu do nosso armazenamento.',
  conta_apagada: 'Sua conta e todos os seus videos foram apagados. Obrigado por jogar com a gente.',
  confirmar: 'Para apagar a conta, escreva APAGAR no campo de confirmacao.',
  limite: 'Voce chegou ao limite de analises do seu plano neste mes. Veja os planos para analisar mais.',
  mp_off: 'O pagamento ainda esta em finalizacao. Voltamos em breve com a assinatura.',
  pago: 'Pagamento aprovado! Sua assinatura esta ativa.',
  pendente: 'Pagamento em processamento. A assinatura ativa assim que o Mercado Pago confirmar.',
  falhou: 'Nao conseguimos concluir o pagamento. Tente de novo.',
  plano_invalido: 'Esse plano nao esta disponivel.',
  grato: 'O plano Gratis ja e seu. E so enviar um video.',
};

export function barraMsg(msg?: string) {
  if (!msg) return null;
  const texto = TEXTOS_MSG[msg];
  if (!texto) return null;
  const classe = msg === 'analisado' ? 'flash ok' : msg === 'erro_ia' || msg === 'sem_video' ? 'flash erro' : 'flash';
  return <div class={classe}>{texto}</div>;
}

// Bola de padel estilizada — usada no logo e nos destaques.
export function BolaPadel({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#d9f24a" stroke="#0f766e" stroke-width="1.6" />
      <path d="M4.5 6.2c4 1.2 6.6 4.2 7.2 9.6" fill="none" stroke="#0f766e" stroke-width="1.4" stroke-linecap="round" />
      <path d="M19.5 6.2c-4 1.2-6.6 4.2-7.2 9.6" fill="none" stroke="#0f766e" stroke-width="1.4" stroke-linecap="round" />
    </svg>
  );
}

type Props = {
  titulo: string;
  descricao?: string;
  user: User | null;
  // Aceita o conteudo como prop (`corpo`) ou como filho JSX.
  corpo?: Child;
  children?: Child;
  cssExtra?: string;
};

export function Layout({ titulo, descricao, user, corpo, children, cssExtra }: Props) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{titulo}</title>
        {descricao ? <meta name="description" content={descricao} /> : null}
        <meta name="theme-color" content="#0f766e" />
        <link
          rel="icon"
          type="image/svg+xml"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' fill='%23d9f24a' stroke='%230f766e' stroke-width='1.6'/%3E%3Cpath d='M4.5 6.2c4 1.2 6.6 4.2 7.2 9.6' fill='none' stroke='%230f766e' stroke-width='1.4' stroke-linecap='round'/%3E%3Cpath d='M19.5 6.2c-4 1.2-6.6 4.2-7.2 9.6' fill='none' stroke='%230f766e' stroke-width='1.4' stroke-linecap='round'/%3E%3C/svg%3E"
        />
        <meta property="og:title" content={titulo} />
        {descricao ? <meta property="og:description" content={descricao} /> : null}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Padel Coach IA" />
        <meta name="twitter:card" content="summary" />
        <style>{CSS_BASE}{cssExtra ?? ''}</style>
      </head>
      <body>
        <header class="topo">
          <div class="wrap">
            <a href="/" class="logo"><BolaPadel />Padel Coach IA</a>
            <nav>
              {user ? (
                <>
                  <a href="/painel">Meus treinos</a>
                  <a href="/videos/novo">Enviar video</a>
                  <a href="/planos">Planos</a>
                  <a href="/sair">Sair</a>
                </>
              ) : (
                <>
                  <a href="/#como">Como funciona</a>
                  <a href="/planos">Planos</a>
                  <a href="/entrar">Entrar</a>
                  <a href="/cadastro" class="btn btn-pri btn-mini">Comecar gratis</a>
                </>
              )}
            </nav>
          </div>
        </header>
        {corpo ?? children}
        <footer>
          Padel Coach IA - feito para quem joga por amor a quadra. <a href="/privacidade">Privacidade</a>
        </footer>
      </body>
    </html>
  );
}
