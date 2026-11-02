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
