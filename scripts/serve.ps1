# 고민저장소 간단 서버 (Node.js가 없을 때) — PowerShell 기본 기능만 사용
# preview/index.html 을 http://localhost:8787 로 제공한다. AI 기능은 Node 서버에서만 동작한다.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$page = Join-Path $root 'preview\index.html'
$port = 8787
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try { $listener.Start() } catch { Write-Host "8787 포트를 열 수 없어요. 이미 실행 중인지 확인해주세요."; exit 1 }
Write-Host "고민저장소 → http://localhost:$port  (창을 닫으면 종료돼요)"
$html = [System.IO.File]::ReadAllBytes($page)
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  try {
    $path = $ctx.Request.Url.AbsolutePath
    if ($path -eq '/api/health') {
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true,"ai":false,"youtube":false}')
      $res.ContentType = 'application/json; charset=utf-8'
    } elseif ($path.StartsWith('/api/')) {
      $res.StatusCode = 503
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"error":"ai_disabled"}')
      $res.ContentType = 'application/json; charset=utf-8'
    } else {
      $bytes = $html
      $res.ContentType = 'text/html; charset=utf-8'
    }
    $res.Headers.Add('Cache-Control', 'no-store')
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {} finally { $res.Close() }
}
