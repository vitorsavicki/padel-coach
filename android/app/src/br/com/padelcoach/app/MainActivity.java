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
