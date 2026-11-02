import type { FC } from 'hono/jsx';
import { Layout } from './Layout';
import { APK } from '../lib/apk';
import type { User } from '../lib/session';

interface AppAndroidProps {
  user: User | null;
}

function dataCurta(iso: string): string {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[3] + '/' + m[2] + '/' + m[1] : iso;
}

function tamanhoArquivo(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  return `${(kb / 1024).toFixed(1).replace('.', ',')} MB`;
}

const VERSOES_ANDROID: Record<number, string> = {
  21: '5.0',
  22: '5.1',
  23: '6.0',
  24: '7.0',
  25: '7.1',
  26: '8.0',
  27: '8.1',
  28: '9',
  29: '10',
  30: '11',
  31: '12',
  32: '12L',
  33: '13',
  34: '14',
  35: '15',
  36: '16',
};

function versaoAndroid(api: number): string {
  return VERSOES_ANDROID[api] ?? String(api);
}

export const AppAndroidPage: FC<AppAndroidProps> = ({ user }) => (
  <Layout
    titulo="App para Android"
    user={user}
    descricao="Baixe grátis o APK do Padel Coach IA para Android. Analise seus treinos de padel, veja a nota do coach e acompanhe seu progresso direto do celular."
  >
    <section class="app-hero">
      <div class="app-hero__texto">
        <span class="eyebrow">Aplicativo para Android</span>
        <h1>O Padel Coach no seu celular</h1>
        <p class="app-hero__linha">
          Mesma conta, agora com ícone na tela inicial. Baixe o APK grátis e analise seus treinos,
          veja a nota do coach e acompanhe o progresso de qualquer lugar.
        </p>
        <div class="app-hero__acoes">
          <a class="btn btn-pri btn-grande" href={APK.arquivo} download>
            <span aria-hidden="true">⬇️</span> Baixar APK grátis
          </a>
          <span class="app-hero__meta">
            v{APK.versao} · {tamanhoArquivo(APK.bytes)} · Android {versaoAndroid(APK.minSdk)}+
          </span>
        </div>
        <ul class="lista-check app-hero__lista">
          <li>Analisar treinos de padel com a IA</li>
          <li>Ver a nota do coach e o feedback de cada treino</li>
          <li>Acompanhar o painel e o histórico de análises</li>
          <li>Sem anúncios e sem compras dentro do app</li>
        </ul>
      </div>
      <div class="app-hero__arte" aria-hidden="true">
        <div class="app-phone">
          <div class="app-phone__tela">
            <img src="/img/app-icon-512.png" alt="" width="96" height="96" loading="lazy" />
            <strong>Padel Coach IA</strong>
            <small>Análise de treino de padel</small>
            <span class="app-phone__botao">Abrir o app</span>
          </div>
        </div>
      </div>
    </section>

    <section class="app-grade" aria-label="Como instalar o app">
      <article class="cartao app-passo">
        <span class="app-passo__numero">1</span>
        <h2>Baixe o APK</h2>
        <p class="auxiliar">
          Toque no botão de download. O arquivo tem {tamanhoArquivo(APK.bytes)} e é assinado por
          nós.
        </p>
      </article>
      <article class="cartao app-passo">
        <span class="app-passo__numero">2</span>
        <h2>Permita a instalação</h2>
        <p class="auxiliar">
          Abra o arquivo baixado. Se o Android pedir, autorize instalar apps desconhecidos para o
          navegador ou gerenciador de arquivos.
        </p>
      </article>
      <article class="cartao app-passo">
        <span class="app-passo__numero">3</span>
        <h2>Entre e use</h2>
        <p class="auxiliar">
          Abra o app e entre com a mesma conta do site. Suas análises e o painel já estarão lá.
        </p>
      </article>
    </section>

    <div class="app-cols">
      <section class="cartao">
        <div class="cartao__cabecalho">
          <div>
            <h2>O que dá para fazer no app</h2>
            <p class="auxiliar">A versão Android acompanha o site automaticamente.</p>
          </div>
        </div>
        <ul class="lista-check">
          <li>Enviar vídeos de treino e receber a análise da IA</li>
          <li>Ver a nota do coach e os pontos a melhorar</li>
          <li>Acompanhar o histórico de análises e o painel</li>
          <li>Apagar seus dados quando quiser (LGPD)</li>
        </ul>
      </section>

      <section class="cartao cartao--dica">
        <div class="cartao__cabecalho">
          <div>
            <h2>Instalação segura</h2>
            <p class="auxiliar">Este APK é distribuído diretamente por este site.</p>
          </div>
        </div>
        <ul class="lista-check">
          <li>Baixe somente do site oficial do Padel Coach</li>
          <li>O aviso de “app de fonte desconhecida” é normal fora da Play Store</li>
          <li>O app pede apenas permissão de internet</li>
          <li>Não acessa contatos, câmera, localização ou seus arquivos</li>
          <li>Atualizações são instaladas por cima, sem perder seus dados</li>
        </ul>
      </section>
    </div>

    <section class="app-aviso">
      <span class="app-aviso__icone" aria-hidden="true">
        📶
      </span>
      <div>
        <h2>Precisa de internet</h2>
        <p>
          O app carrega o site em tempo real. Sem conexão, ele mostra uma tela de aviso com a opção
          de tentar de novo ou abrir no navegador.
        </p>
      </div>
    </section>

    <details class="cartao app-detalhes">
      <summary>Detalhes técnicos e verificação</summary>
      <dl class="detalhes">
        <div>
          <dt>Versão</dt>
          <dd>
            {APK.versao} ({APK.versionCode})
          </dd>
        </div>
        <div>
          <dt>Android mínimo</dt>
          <dd>{versaoAndroid(APK.minSdk)} (API {APK.minSdk})</dd>
        </div>
        <div>
          <dt>Tamanho</dt>
          <dd>{tamanhoArquivo(APK.bytes)}</dd>
        </div>
        <div>
          <dt>Atualizado em</dt>
          <dd>{dataCurta(APK.geradoEm)}</dd>
        </div>
        <div>
          <dt>Pacote</dt>
          <dd>br.com.padelcoach.app</dd>
        </div>
        <div>
          <dt>Permissão</dt>
          <dd>Internet</dd>
        </div>
      </dl>
      <p class="app-hash">
        <span>SHA-256 do arquivo</span>
        <code>{APK.sha256}</code>
      </p>
      <p class="auxiliar">
        O link fixo <code>{APK.arquivoEstavel}</code> sempre aponta para a versão mais recente.
        Também disponibilizamos o{' '}
        <a href="/download/padel-coach.apk.sha256">arquivo de checksum .sha256</a>.
      </p>
    </details>

    <details class="cartao app-detalhes">
      <summary>Não conseguiu instalar?</summary>
      <ul class="lista-check">
        <li>
          Autorize “instalar apps desconhecidos” para o Chrome ou para o gerenciador de arquivos
          que abriu o APK.
        </li>
        <li>No Samsung, desative temporariamente o Auto Blocker em Segurança e privacidade.</li>
        <li>
          Desative temporariamente o Play Protect na Play Store e tente de novo; depois reative a
          proteção.
        </li>
        <li>
          Se já existe uma versão antiga do Padel Coach, desinstale em Configurações, Apps,
          antes de instalar.
        </li>
        <li>
          Baixe novamente pelo Chrome. O arquivo deve ter {tamanhoArquivo(APK.bytes)} e terminar em
          .apk.
        </li>
      </ul>
    </details>
  </Layout>
);
