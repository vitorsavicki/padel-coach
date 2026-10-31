# Guia — App Android do Padel Coach (WebView, no modelo do frete)

## O que este guia faz

Ensina a criar um app Android nativo para o Padel Coach, exatamente como o frete fez: uma "casca" WebView que carrega o site responsivo dentro do app, empacotada como APK e distribuída direto pelo site (sem Play Store).

O app pesa cerca de 50 KB porque é só um WebView + ícone. Todo o conteúdo (cadastro, login, análise de treino, painel) continua no site Cloudflare Workers.

## Como o app se comporta

- Abre o site do Padel Coach dentro de uma WebView.
- Ícone na tela inicial do celular.
- Tela de erro com "Tentar novamente" e "Abrir no navegador" quando não há internet.
- Botão voltar do Android navega no histórico da WebView.
- Links de outros sites abrem no navegador do celular (não dentro do app).
- Seletor de arquivos funciona (útil para escolher o vídeo do treino).
- Apenas permissão de internet. Não acessa contatos, câmera, localização nem arquivos.

## Pré-requisitos (no computador que gera o APK)

- JDK 17 (defina `JAVA_HOME` ou instale em `E:\kube\dev\android-tools\jdk`).
- Android SDK com:
  - `platforms;android-35` (ou a mais recente disponível)
  - `build-tools` com `aapt2`, `d8`, `zipalign`, `apksigner`
- PowerShell (para rodar o script de build)

Não é preciso instalar o Android Studio nem o Gradle. O build usa as ferramentas de linha de comando do SDK diretamente (mesmo caminho do frete).

## Passo 1 — criar os arquivos do app Android

No diretório raiz do padel-coach, crie esta estrutura:

```
padel-coach/
├── android/
│   ├── build.ps1
│   ├── keystore.properties.example
│   └── app/
│       ├── AndroidManifest.xml
│       ├── res/
│       │   ├── values/
│       │   │   ├── colors.xml
│       │   │   ├── strings.xml
│       │   │   └── styles.xml
│       │   ├── drawable/
│       │   │   └── ic_launcher_foreground.xml
│       │   ├── mipmap-anydpi-v26/
│       │   │   └── ic_launcher.xml
│       │   ├── mipmap-mdpi/ic_launcher.png
│       │   ├── mipmap-hdpi/ic_launcher.png
│       │   ├── mipmap-xhdpi/ic_launcher.png
│       │   ├── mipmap-xxhdpi/ic_launcher.png
│       │   └── mipmap-xxxhdpi/ic_launcher.png
│       └── src/
│           └── br/
│               └── com/
│                   └── padelcoach/
│                       └── app/
│                           └── MainActivity.java
├── public/
│   └── download/          ← o APK assinado vai aqui (servido como asset estático)
├── src/
│   ├── lib/
│   │   └── apk.ts          ← gerado pelo build.ps1 (não editar à mão)
│   ├── routes/
│   │   └── android.tsx     ← GET /app
│   └── pages/
│       └── AppAndroid.tsx  ← página de download no site
└── wrangler.json           ← adicionar assets: ./public
```

A seguir, o conteúdo de cada arquivo de texto. Os arquivos PNG de ícone você gera à parte (veja o item "Ícones do app").

### android/app/AndroidManifest.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="br.com.padelcoach.app"
    android:versionCode="1"
    android:versionName="1.0.0">

    <uses-sdk android:minSdkVersion="23" android:targetSdkVersion="34" />

    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:allowBackup="false"
        android:hardwareAccelerated="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="false">

        <activity
            android:name=".MainActivity"
            android:configChanges="orientation|screenSize|screenLayout|keyboardHidden|uiMode"
            android:enableOnBackInvokedCallback="false"
            android:exported="true"
            android:launchMode="singleTop"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

### android/app/src/br/com/padelcoach/app/MainActivity.java

```java
package br.com.padelcoach.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import java.util.Locale;

/**
 * Casca Android do Padel Coach IA.
 *
 * O app carrega o site responsivo em uma WebView e adiciona o que falta para
 * parecer um app: ícone, tela de erro com nova tentativa, botão voltar,
 * abertura de links externos no navegador e seletor de arquivos.
 */
public class MainActivity extends Activity {

    private static final int PEDIDO_ARQUIVO = 1001;

    private WebView webView;
    private ProgressBar progresso;
    private LinearLayout erroView;
    private TextView erroTitulo;
    private TextView erroTexto;
    private ValueCallback<Uri[]> arquivoCallback;
    private String urlInicial;
    private String hostApp;
    private String urlComErro;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window janela = getWindow();
        janela.setStatusBarColor(getColor(R.color.tinta));
        janela.setNavigationBarColor(getColor(R.color.tinta));

        urlInicial = getString(R.string.url_inicial);
        hostApp = getString(R.string.host_app).toLowerCase(Locale.US);

        FrameLayout raiz = new FrameLayout(this);
        raiz.setBackgroundColor(getColor(R.color.fundo));

        webView = new WebView(this);
        webView.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        webView.setBackgroundColor(getColor(R.color.branco));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            webView.setForceDarkAllowed(false);
        }

        configurarWebView();

        progresso = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progresso.setMax(100);
        progresso.setVisibility(View.GONE);
        progresso.setProgressTintList(ColorStateList.valueOf(getColor(R.color.marca)));
        progresso.setProgressBackgroundTintList(ColorStateList.valueOf(Color.TRANSPARENT));
        FrameLayout.LayoutParams paramsProgresso = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(3),
                Gravity.TOP);

        raiz.addView(webView);
        raiz.addView(progresso, paramsProgresso);
        raiz.addView(criarTelaErro(), new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        setContentView(raiz);

        if (savedInstanceState != null) {
            if (webView.restoreState(savedInstanceState) == null) {
                webView.loadUrl(urlInicial);
            }
        } else {
            webView.loadUrl(urlInicial);
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configurarWebView() {
        WebSettings ajustes = webView.getSettings();
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true);
        ajustes.setDatabaseEnabled(true);
        ajustes.setUseWideViewPort(true);
        ajustes.setLoadWithOverviewMode(false);
        ajustes.setSupportZoom(false);
        ajustes.setBuiltInZoomControls(false);
        ajustes.setDisplayZoomControls(false);
        ajustes.setMediaPlaybackRequiresUserGesture(true);
        ajustes.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        ajustes.setAllowFileAccess(false);
        ajustes.setAllowContentAccess(false);
        ajustes.setJavaScriptCanOpenWindowsAutomatically(false);
        ajustes.setSupportMultipleWindows(false);
        ajustes.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ajustes.setSafeBrowsingEnabled(true);
        }

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return tratarUrl(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return tratarUrl(Uri.parse(url));
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                erroView.setVisibility(View.GONE);
                progresso.setVisibility(View.VISIBLE);
                progresso.setProgress(0);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progresso.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    mostrarErro(request.getUrl().toString());
                }
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                if (failingUrl != null && failingUrl.equals(view.getUrl())) {
                    mostrarErro(failingUrl);
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 500) {
                    mostrarErro(request.getUrl().toString());
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
                mostrarErro(view.getUrl());
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int novoProgresso) {
                progresso.setProgress(novoProgresso);
                if (novoProgresso < 100) {
                    progresso.setVisibility(View.VISIBLE);
                } else {
                    progresso.setVisibility(View.GONE);
                }
            }

            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (arquivoCallback != null) {
                    arquivoCallback.onReceiveValue(null);
                }
                arquivoCallback = callback;
                try {
                    Intent escolha = params.createIntent();
                    startActivityForResult(
                            Intent.createChooser(escolha, getString(R.string.arquivo_escolher)),
                            PEDIDO_ARQUIVO);
                    return true;
                } catch (ActivityNotFoundException e) {
                    arquivoCallback = null;
                    Toast.makeText(
                            MainActivity.this,
                            getString(R.string.link_indisponivel),
                            Toast.LENGTH_SHORT).show();
                    return false;
                }
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(
                    String origin,
                    GeolocationPermissions.Callback callback) {
                // O site não usa a localização do aparelho. Negar é o padrão seguro.
                callback.invoke(origin, false, false);
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                request.deny();
            }

            @Override
            public boolean onJsAlert(
                    WebView view,
                    String url,
                    String message,
                    final JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setPositiveButton(R.string.js_ok, (dialog, which) -> result.confirm())
                        .setOnCancelListener(dialog -> result.cancel())
                        .show();
                return true;
            }

            @Override
            public boolean onJsConfirm(
                    WebView view,
                    String url,
                    String message,
                    final JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setTitle(R.string.js_confirmar)
                        .setMessage(message)
                        .setPositiveButton(R.string.js_ok, (dialog, which) -> result.confirm())
                        .setNegativeButton(R.string.js_cancelar, (dialog, which) -> result.cancel())
                        .setOnCancelListener(dialog -> result.cancel())
                        .show();
                return true;
            }

            @Override
            public boolean onJsPrompt(
                    WebView view,
                    String url,
                    String message,
                    String defaultValue,
                    final JsPromptResult result) {
                final EditText entrada = new EditText(MainActivity.this);
                entrada.setText(defaultValue == null ? "" : defaultValue);
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setView(entrada)
                        .setPositiveButton(R.string.js_ok,
                                (dialog, which) -> result.confirm(entrada.getText().toString()))
                        .setNegativeButton(R.string.js_cancelar,
                                (dialog, which) -> result.cancel())
                        .setOnCancelListener(dialog -> result.cancel())
                        .show();
                return true;
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) ->
                abrirFora(Uri.parse(url)));
    }

    private View criarTelaErro() {
        erroView = new LinearLayout(this);
        erroView.setOrientation(LinearLayout.VERTICAL);
        erroView.setGravity(Gravity.CENTER);
        erroView.setPadding(dp(28), dp(28), dp(28), dp(28));
        erroView.setBackgroundColor(getColor(R.color.fundo));
        erroView.setVisibility(View.GONE);
        erroView.setClickable(true);

        TextView emoji = new TextView(this);
        emoji.setText("🎾");
        emoji.setTextSize(46);
        emoji.setGravity(Gravity.CENTER);
        emoji.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        erroView.addView(emoji);

        erroTitulo = new TextView(this);
        erroTitulo.setText(R.string.erro_titulo);
        erroTitulo.setTextSize(22);
        erroTitulo.setTextColor(getColor(R.color.tinta));
        erroTitulo.setTypeface(Typeface.DEFAULT_BOLD);
        erroTitulo.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams paramsTitulo = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        paramsTitulo.topMargin = dp(12);
        erroView.addView(erroTitulo, paramsTitulo);

        erroTexto = new TextView(this);
        erroTexto.setText(R.string.erro_texto);
        erroTexto.setTextSize(15);
        erroTexto.setTextColor(getColor(R.color.cinza));
        erroTexto.setGravity(Gravity.CENTER);
        erroTexto.setLineSpacing(dp(3), 1f);
        LinearLayout.LayoutParams paramsTexto = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        paramsTexto.topMargin = dp(10);
        erroView.addView(erroTexto, paramsTexto);

        Button tentar = new Button(this);
        tentar.setText(R.string.erro_tentar);
        tentar.setAllCaps(false);
        tentar.setTextColor(getColor(R.color.branco));
        tentar.setBackgroundTintList(ColorStateList.valueOf(getColor(R.color.marca)));
        tentar.setPadding(dp(24), 0, dp(24), 0);
        LinearLayout.LayoutParams paramsTentar = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                dp(48));
        paramsTentar.topMargin = dp(22);
        tentar.setOnClickListener(v -> tentarNovamente());
        erroView.addView(tentar, paramsTentar);

        Button navegador = new Button(this);
        navegador.setText(R.string.erro_navegador);
        navegador.setAllCaps(false);
        navegador.setTextColor(getColor(R.color.marca_escura));
        navegador.setBackgroundColor(Color.TRANSPARENT);
        LinearLayout.LayoutParams paramsNavegador = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                dp(44));
        paramsNavegador.topMargin = dp(2);
        navegador.setOnClickListener(v -> abrirNavegador(
                urlComErro != null ? urlComErro : urlInicial));
        erroView.addView(navegador, paramsNavegador);

        return erroView;
    }

    private void tentarNovamente() {
        String destino = urlComErro != null ? urlComErro : urlInicial;
        urlComErro = null;
        erroView.setVisibility(View.GONE);
        progresso.setVisibility(View.VISIBLE);
        progresso.setProgress(0);
        webView.loadUrl(destino);
    }

    private void mostrarErro(String url) {
        urlComErro = url;
        progresso.setVisibility(View.GONE);
        erroView.setVisibility(View.VISIBLE);
    }

    private boolean tratarUrl(Uri uri) {
        if (uri == null) {
            return false;
        }
        String esquema = uri.getScheme();
        if (esquema == null) {
            return false;
        }
        esquema = esquema.toLowerCase(Locale.US);

        if (esquema.equals("http") || esquema.equals("https")) {
            String host = uri.getHost();
            if (host != null) {
                host = host.toLowerCase(Locale.US);
                if (host.equals(hostApp) || host.endsWith("." + hostApp)) {
                    return false;
                }
            }
            return abrirFora(uri);
        }

        if (esquema.equals("data") || esquema.equals("blob")
                || esquema.equals("about") || esquema.equals("javascript")) {
            return false;
        }

        return abrirFora(uri);
    }

    private boolean abrirFora(Uri uri) {
        try {
            Intent intencao = new Intent(Intent.ACTION_VIEW, uri);
            intencao.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intencao);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, R.string.link_indisponivel, Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    private void abrirNavegador(String url) {
        abrirFora(Uri.parse(url));
    }

    private int dp(int valor) {
        return Math.round(valor * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == PEDIDO_ARQUIVO) {
            if (arquivoCallback != null) {
                Uri[] resultado = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                arquivoCallback.onReceiveValue(resultado);
                arquivoCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (erroView.getVisibility() == View.VISIBLE) {
            erroView.setVisibility(View.GONE);
            if (webView.canGoBack()) {
                webView.goBack();
            } else {
                super.onBackPressed();
            }
            return;
        }
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (arquivoCallback != null) {
            arquivoCallback.onReceiveValue(null);
            arquivoCallback = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.loadUrl("about:blank");
            webView.clearHistory();
            webView.removeAllViews();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
```

### android/app/res/values/strings.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Padel Coach IA</string>
    <string name="url_inicial" translatable="false">https://SEU-SITE.workers.dev/</string>
    <string name="host_app" translatable="false">SEU-SITE.workers.dev</string>

    <string name="erro_titulo">Não foi possível carregar</string>
    <string name="erro_texto">Verifique sua internet e tente de novo.\n\nO app precisa de conexão para carregar suas análises de treino e o painel.</string>
    <string name="erro_tentar">Tentar novamente</string>
    <string name="erro_navegador">Abrir no navegador</string>
    <string name="arquivo_escolher">Escolher arquivo</string>
    <string name="link_indisponivel">Não há app para abrir este link.</string>
    <string name="js_confirmar">Confirmar</string>
    <string name="js_ok">OK</string>
    <string name="js_cancelar">Cancelar</string>
</resources>
```

> Substitua `SEU-SITE.workers.dev` pelo domínio real do seu Workers (é o endereço público do site, não é segredo).

### android/app/res/values/colors.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="marca">#0f766e</color>
    <color name="marca_escura">#0a4f4a</color>
    <color name="tinta">#0a1f1a</color>
    <color name="cinza">#5b716b</color>
    <color name="branco">#FFFFFF</color>
    <color name="fundo">#FFFFFF</color>
    <color name="bola">#d9f24a</color>
</resources>
```

(Cores extraídas do `CSS_BASE` do Padel Coach, em `src/pages/Layout.tsx`.)

### android/app/res/values/styles.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="@android:style/Theme.Material.Light.NoActionBar">
        <item name="android:fontFamily">sans</item>
        <item name="android:windowBackground">@color/marca</item>
        <item name="android:colorPrimary">@color/marca</item>
        <item name="android:colorPrimaryDark">@color/tinta</item>
        <item name="android:colorAccent">@color/marca</item>
        <item name="android:statusBarColor">@color/tinta</item>
        <item name="android:navigationBarColor">@color/tinta</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowLightNavigationBar">false</item>
        <item name="android:windowActionModeOverlay">true</item>
    </style>
</resources>
```

### android/app/res/drawable/ic_launcher_foreground.xml

```xml
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <group>
        <path
            android:fillColor="#FFFFFF"
            android:pathData="M54,2c28.8,0 52,23.2 52,52s-23.2,52 -52,52 -52,-23.2 -52,-52 23.2,-52 52,-52z"/>
    </group>
</vector>
```

### android/app/res/mipmap-anydpi-v26/ic_launcher.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/marca"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
```

### Ícones PNG (necessário antes do build)

Gere 5 arquivos PNG do ícone a partir de uma imagem quadrada 512×512 e coloque em:

- `android/app/res/mipmap-mdpi/ic_launcher.png` (48×48)
- `android/app/res/mipmap-hdpi/ic_launcher.png` (72×72)
- `android/app/res/mipmap-xhdpi/ic_launcher.png` (96×96)
- `android/app/res/mipmap-xxhdpi/ic_launcher.png` (144×144)
- `android/app/res/mipmap-xxxhdpi/ic_launcher.png` (192×192)

Dica: use o Android Studio (Image Asset Studio) ou qualquer gerador de ícone Android online. Sem esses PNGs o ícone pode não aparecer em lançadores antigos, mas o build continua.

### android/build.ps1

```powershell
# Gera o APK Android do Padel Coach sem Gradle.
#
# Requisitos:
#   - JDK 17 (JAVA_HOME ou uma pasta em E:\kube\dev\android-tools\jdk)
#   - Android SDK com platforms;android-35 e build-tools;35.0.0
#     (ANDROID_SDK_ROOT ou E:\kube\dev\android-tools\sdk)
#   - android/keystore.properties apontando para o keystore de release
#
# Uso, na raiz do projeto:
#   powershell -ExecutionPolicy Bypass -File android/build.ps1
#
# O script publica o APK em public/download/, gera src/lib/apk.ts com
# versão, tamanho e SHA-256 e imprime o resultado.

param(
    [switch]$NaoPublicar
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$AppDir = Join-Path $PSScriptRoot 'app'
$BuildDir = Join-Path $PSScriptRoot 'build'

function Falhar($mensagem) {
    Write-Host ""
    Write-Host "ERRO: $mensagem" -ForegroundColor Red
    exit 1
}

function Rodar($arquivo, [string[]]$argumentos, $descricao) {
    Write-Host "→ $descricao" -ForegroundColor Cyan
    & $arquivo @argumentos
    if ($LASTEXITCODE -ne 0) {
        Falhar "$descricao (código $LASTEXITCODE)"
    }
}

# ---------- JDK ----------
$JdkHome = $env:JAVA_HOME
if (-not $JdkHome -or -not (Test-Path (Join-Path $JdkHome 'bin\javac.exe'))) {
    $candidato = Get-ChildItem 'E:\kube\dev\android-tools\jdk' -Directory -Filter 'jdk-*' -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending |
        Select-Object -First 1
    if ($candidato) { $JdkHome = $candidato.FullName }
}
if (-not $JdkHome -or -not (Test-Path (Join-Path $JdkHome 'bin\javac.exe'))) {
    Falhar "JDK 17 não encontrado. Defina JAVA_HOME ou instale em E:\kube\dev\android-tools\jdk."
}
$env:JAVA_HOME = $JdkHome
$env:PATH = "$JdkHome\bin;$env:PATH"

# ---------- Android SDK ----------
$SdkRoot = $env:ANDROID_SDK_ROOT
if (-not $SdkRoot -or -not (Test-Path $SdkRoot)) {
    $SdkRoot = 'E:\kube\dev\android-tools\sdk'
}
$BuildTools = Get-ChildItem (Join-Path $SdkRoot 'build-tools') -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path (Join-Path $_.FullName 'aapt2.exe') } |
    Sort-Object { [version]$_.Name } -Descending |
    Select-Object -First 1
$Platform = Get-ChildItem (Join-Path $SdkRoot 'platforms') -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path (Join-Path $_.FullName 'android.jar') } |
    Sort-Object Name -Descending |
    Select-Object -First 1
if (-not $BuildTools) { Falhar "Android build-tools não encontrado em $SdkRoot\build-tools." }
if (-not $Platform) { Falhar "Android platform (android.jar) não encontrada em $SdkRoot\platforms." }

$Aapt2 = Join-Path $BuildTools.FullName 'aapt2.exe'
$D8 = Join-Path $BuildTools.FullName 'd8.bat'
$ZipAlign = Join-Path $BuildTools.FullName 'zipalign.exe'
$ApkSigner = Join-Path $BuildTools.FullName 'apksigner.bat'
$AndroidJar = Join-Path $Platform.FullName 'android.jar'
$Javac = Join-Path $JdkHome 'bin\javac.exe'
$Jar = Join-Path $JdkHome 'bin\jar.exe'

Write-Host "JDK: $JdkHome"
Write-Host "SDK: $SdkRoot"
Write-Host "Build tools: $($BuildTools.Name) · Platform: $($Platform.Name)"

# ---------- versão ----------
$manifestTexto = Get-Content (Join-Path $AppDir 'AndroidManifest.xml') -Raw
$versao = [regex]::Match($manifestTexto, 'android:versionName="([^"]+)"').Groups[1].Value
$versionCode = [regex]::Match($manifestTexto, 'android:versionCode="([^"]+)"').Groups[1].Value
$minSdk = [regex]::Match($manifestTexto, 'android:minSdkVersion="([^"]+)"').Groups[1].Value
$targetSdk = [regex]::Match($manifestTexto, 'android:targetSdkVersion="([^"]+)"').Groups[1].Value
if (-not $versao -or -not $versionCode -or -not $minSdk -or -not $targetSdk) {
    Falhar "Não foi possível ler versionName/versionCode/minSdkVersion/targetSdkVersion do AndroidManifest.xml."
}

# ---------- limpeza ----------
if (Test-Path $BuildDir) { Remove-Item -Recurse -Force $BuildDir }
New-Item -ItemType Directory -Force `
    (Join-Path $BuildDir 'gen'), `
    (Join-Path $BuildDir 'classes'), `
    (Join-Path $BuildDir 'dex') | Out-Null

# ---------- recursos ----------
$resZip = Join-Path $BuildDir 'res.zip'
Rodar $Aapt2 @('compile', '--dir', (Join-Path $AppDir 'res'), '-o', $resZip) 'Compilando recursos'

$baseApk = Join-Path $BuildDir 'base.apk'
Rodar $Aapt2 @(
    'link',
    '-o', $baseApk,
    '-I', $AndroidJar,
    '--manifest', (Join-Path $AppDir 'AndroidManifest.xml'),
    '-R', $resZip,
    '--java', (Join-Path $BuildDir 'gen'),
    '--auto-add-overlay'
) 'Ligando recursos e manifesto'

# ---------- Java ----------
$fontes = @()
$fontes += Get-ChildItem (Join-Path $AppDir 'src') -Recurse -Filter '*.java' | ForEach-Object { $_.FullName }
$fontes += Get-ChildItem (Join-Path $BuildDir 'gen') -Recurse -Filter '*.java' | ForEach-Object { $_.FullName }
if ($fontes.Count -eq 0) { Falhar "Nenhum arquivo .java encontrado." }

Rodar $Javac (@(
    '-encoding', 'UTF-8',
    '-source', '8',
    '-target', '8',
    '-classpath', $AndroidJar,
    '-d', (Join-Path $BuildDir 'classes')
) + $fontes) 'Compilando Java'

$classesJar = Join-Path $BuildDir 'classes.jar'
Rodar $Jar @('cf', $classesJar, '-C', (Join-Path $BuildDir 'classes'), '.') 'Empacotando classes'

Rodar $D8 @(
    '--lib', $AndroidJar,
    '--min-api', $minSdk,
    '--output', (Join-Path $BuildDir 'dex'),
    $classesJar
) 'Convertendo para DEX'

Rodar $Jar @('uf', $baseApk, '-C', (Join-Path $BuildDir 'dex'), 'classes.dex') 'Adicionando classes.dex ao APK'

$alignedApk = Join-Path $BuildDir 'aligned.apk'
Rodar $ZipAlign @('-f', '4', $baseApk, $alignedApk) 'Alinhando o APK'

# ---------- assinatura ----------
$propsPath = Join-Path $PSScriptRoot 'keystore.properties'
$props = @{}
if (Test-Path $propsPath) {
    Get-Content $propsPath | ForEach-Object {
        $linha = $_.Trim()
        if (-not $linha -or $linha.StartsWith('#')) { return }
        $pos = $linha.IndexOf('=')
        if ($pos -gt 0) {
            $props[$linha.Substring(0, $pos).Trim()] = $linha.Substring($pos + 1).Trim()
        }
    }
}

$storeFile = if ($env:APK_KEYSTORE) { $env:APK_KEYSTORE } else { $props['storeFile'] }
$storePass = if ($env:APK_STORE_PASS) { $env:APK_STORE_PASS } else { $props['storePassword'] }
$keyAlias = if ($env:APK_KEY_ALIAS) { $env:APK_KEY_ALIAS } else { $props['keyAlias'] }
$keyPass = if ($env:APK_KEY_PASS) { $env:APK_KEY_PASS } else { $props['keyPassword'] }

if (-not $storeFile -or -not $storePass -or -not $keyAlias -or -not $keyPass) {
    Falhar "Assinatura não configurada. Crie android/keystore.properties (veja keystore.properties.example) ou defina APK_KEYSTORE, APK_STORE_PASS, APK_KEY_ALIAS e APK_KEY_PASS."
}
if (-not [System.IO.Path]::IsPathRooted($storeFile)) {
    $storeFile = Join-Path $PSScriptRoot $storeFile
}
if (-not (Test-Path $storeFile)) {
    Falhar "Keystore não encontrado em $storeFile."
}

$env:APK_STORE_PASS = $storePass
$env:APK_KEY_PASS = $keyPass
$apkFinal = Join-Path $BuildDir 'padel-coach.apk'
Rodar $ApkSigner @(
    'sign',
    '--ks', $storeFile,
    '--ks-key-alias', $keyAlias,
    '--ks-pass', 'env:APK_STORE_PASS',
    '--key-pass', 'env:APK_KEY_PASS',
    '--v1-signing-enabled', 'true',
    '--v2-signing-enabled', 'true',
    '--v3-signing-enabled', 'true',
    '--out', $apkFinal,
    $alignedApk
) 'Assinando o APK'

Write-Host "→ Verificando assinatura"
& $ApkSigner verify --verbose --print-certs $apkFinal
if ($LASTEXITCODE -ne 0) { Falhar "A assinatura não pôde ser verificada." }

Write-Host "→ Conferindo manifesto"
& $Aapt2 dump badging $apkFinal | Select-String -Pattern '^(package:|application-label:|launchable-activity:|uses-permission:)'
if ($LASTEXITCODE -ne 0) { Falhar "Não foi possível ler o badging do APK." }

# ---------- publicação ----------
$sha256 = (Get-FileHash $apkFinal -Algorithm SHA256).Hash.ToLowerInvariant()
$bytes = (Get-Item $apkFinal).Length
$geradoEm = (Get-Date).ToString('yyyy-MM-dd')

if (-not $NaoPublicar) {
    $destino = Join-Path $ProjectRoot 'public\download'
    New-Item -ItemType Directory -Force $destino | Out-Null
    $nomeVersao = "padel-coach-$versao.apk"
    Copy-Item $apkFinal (Join-Path $destino $nomeVersao) -Force
    Copy-Item $apkFinal (Join-Path $destino 'padel-coach.apk') -Force
    $linhaHash = "$sha256  $nomeVersao`n"
    [System.IO.File]::WriteAllText(
        (Join-Path $destino 'padel-coach.apk.sha256'),
        $linhaHash,
        (New-Object System.Text.UTF8Encoding($false))
    )

    $ts = @"
// Gerado por android/build.ps1 — não editar à mão.
export interface ApkInfo {
  versao: string;
  versionCode: number;
  arquivo: string;
  arquivoEstavel: string;
  bytes: number;
  sha256: string;
  geradoEm: string;
  minSdk: number;
  targetSdk: number;
}

export const APK: ApkInfo = {
  versao: '$versao',
  versionCode: $versionCode,
  arquivo: '/download/$nomeVersao',
  arquivoEstavel: '/download/padel-coach.apk',
  bytes: $bytes,
  sha256: '$sha256',
  geradoEm: '$geradoEm',
  minSdk: $minSdk,
  targetSdk: $targetSdk,
};
"@
    [System.IO.File]::WriteAllText(
        (Join-Path $ProjectRoot 'src\lib\apk.ts'),
        $ts,
        (New-Object System.Text.UTF8Encoding($false))
    )
}

$mb = [math]::Round($bytes / 1MB, 2)
Write-Host ""
Write-Host "APK pronto: $apkFinal" -ForegroundColor Green
Write-Host "Versão: $versao ($versionCode) · $mb MB"
Write-Host "SHA-256: $sha256"
if (-not $NaoPublicar) {
    Write-Host "Publicado em public/download/padel-coach-$versao.apk"
    Write-Host "Link: https://SEU-SITE.workers.dev/download/padel-coach-$versao.apk"
}
```

### android/keystore.properties.example

```properties
# Copie para android/keystore.properties e ajuste os caminhos/senhas.
# O keystore NÃO deve ser commitado. Faça backup dele: sem o mesmo keystore
# não é possível atualizar o app já instalado (o Android recusa a troca).
storeFile=../.secrets/android/padelcoach.jks
storePassword=troque-por-uma-senha-forte
keyAlias=padelcoach
keyPassword=troque-por-uma-senha-forte
```

## Passo 2 — no site (Cloudflare Workers / Hono)

### src/lib/apk.ts

Este arquivo é gerado automaticamente pelo `android/build.ps1`. Não edite à mão. Ele expõe versão, tamanho e SHA-256 do APK para a página de download.

Conteúdo inicial (substitua depois de gerar o primeiro APK):

```ts
// Gerado por android/build.ps1 — não editar à mão.
export interface ApkInfo {
  versao: string;
  versionCode: number;
  arquivo: string;
  arquivoEstavel: string;
  bytes: number;
  sha256: string;
  geradoEm: string;
  minSdk: number;
  targetSdk: number;
}

export const APK: ApkInfo = {
  versao: '1.0.0',
  versionCode: 1,
  arquivo: '/download/padel-coach-1.0.0.apk',
  arquivoEstavel: '/download/padel-coach.apk',
  bytes: 0,
  sha256: '',
  geradoEm: '',
  minSdk: 23,
  targetSdk: 34,
};
```

### src/routes/android.tsx

```ts
// Página pública de download do APK Android (distribuição direta, fora da Play Store).
import { Hono } from 'hono';
import { AppAndroidPage } from '../pages/AppAndroid';
import type { Vars } from './lib/session';
import type { Bindings } from './lib/bindings';

const android = new Hono<{ Bindings: Bindings; Variables: Vars }>();

android.get('/app', async (c) => {
  const user = c.get('user');
  return c.html(<AppAndroidPage user={user} />);
});

export default android;
```

### src/pages/AppAndroid.tsx

```tsx
import type { FC } from 'hono/jsx';
import { Layout } from './Layout';
import { APK } from '../lib/apk';
import { dataCurta } from '../lib/format';
import type { User } from '../lib/db';

interface AppAndroidProps {
  user: User | null;
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
```

> O `Layout`, `dataCurta`, `User` e as classes CSS (`btn-pri`, `cartao`, `lista-check`, `app-hero`, etc.) já existem no padel-coach. Se alguma classe CSS não existir, adicione-a em `src/pages/Layout.tsx` (mesmo lugar do `CSS_BASE`).

### src/index.tsx

Adicione a importação e o montagem da rota:

```ts
import android from './routes/android';
...
app.route('/', android);
```

### wrangler.json

Adicione a seção de assets (igual ao frete):

```json
{
  ...
  "assets": {
    "directory": "./public",
    "binding": "ASSETS"
  },
  ...
}
```

## Passo 3 — gerar o APK

No PowerShell, na raiz do projeto:

```
powershell -ExecutionPolicy Bypass -File android/build.ps1
```

O script:
1. Compila recursos com `aapt2`
2. Compila o Java com `javac`
3. Converte para DEX com `d8`
4. Monta, alinha (`zipalign`) e assina o APK (`apksigner`)
5. Publica em `public/download/padel-coach.apk` (e versão com número)
6. Gera `src/lib/apk.ts` com versão, tamanho e SHA-256

Na primeira execução, configure a assinatura: copie `android/keystore.properties.example` para `android/keystore.properties` e ajuste o caminho/senha (ou defina as variáveis de ambiente `APK_KEYSTORE`, `APK_STORE_PASS`, `APK_KEY_ALIAS`, `APK_KEY_PASS`).

## Passo 4 — publicar

```
npx wrangler deploy
```

O APK fica disponível em `https://SEU-SITE.workers.dev/download/padel-coach.apk` e a página de download em `/app`.

## Regras de ouro (antes de commitar)

1. `npx tsc --noEmit` — zero erro ANTES de commitar (o hook `.claude/hooks` já exige).
2. `node teste-usabilidade.mjs` — terminar "TUDO PASSOU" antes do deploy.
3. Nunca commitar `android/keystore.properties`, o `.jks` nem `.dev.vars`. Segredos vivem em `npx wrangler secret put`.
4. Nunca logar URLs ou conteúdo de vídeos (dados sensíveis). Vídeos nunca sobem: o navegador do aluno extrai os quadros e envia só as imagens.
5. Uma tarefa por conversa com o DeepSeek — se quiser pedir ajuda à IA, cole este guia como contexto e peça uma coisa de cada vez.

## Checklist antes de entregar

- [ ] `npx tsc --noEmit` — zero erro
- [ ] `node teste-usabilidade.mjs` — "TUDO PASSOU"
- [ ] `powershell -ExecutionPolicy Bypass -File android/build.ps1` — APK gerado e assinado
- [ ] `npx wrangler deploy` — deploy OK
- [ ] Abrir `/app` no navegador: botão de download, versão, tamanho e SHA-256 aparecem
- [ ] Baixar e instalar o APK em um Android real: abre o site do Padel Coach
- [ ] Não commitar `android/keystore.properties` nem o `.jks`
