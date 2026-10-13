$sp=$PSScriptRoot
$sv="$sp\server"; $pub="$sv\public"
Add-Type -AssemblyName System.Web
$U=New-Object System.Text.UTF8Encoding($false)
$R={ param($p) [System.IO.File]::ReadAllText($p) }
$J={ param($s) '"'+[System.Web.HttpUtility]::JavaScriptStringEncode($s)+'"' }

$shared=& $R "$pub\shared.js"
$app=& $R "$sv\app.js"
$tail=& $R "$sv\worker_tail.js"
$appHtml=& $R "$pub\app.html"
$formHtml=& $R "$pub\form.html"

$sb=New-Object System.Text.StringBuilder
[void]$sb.AppendLine("/* SJB Fact Find - Cloudflare Worker. Generated file: paste the whole thing into the Worker editor. */")
[void]$sb.AppendLine($shared)
[void]$sb.AppendLine((& $R "$sv\fflate.umd.js"))
[void]$sb.AppendLine((& $R "$sv\rwl_server.js"))
[void]$sb.AppendLine($app)
[void]$sb.AppendLine("const SHARED_JS="+(& $J $shared)+";")
[void]$sb.AppendLine("const APP_HTML="+(& $J $appHtml)+";")
[void]$sb.AppendLine("const FORM_HTML="+(& $J $formHtml)+";")
$docsHtml=& $R "$pub\docs.html"
[void]$sb.AppendLine("const DOCS_HTML="+(& $J $docsHtml)+";")
[void]$sb.AppendLine($tail)
$out="$sv\worker.js"
[System.IO.File]::WriteAllText($out,$sb.ToString(),$U)
Copy-Item $out "$sp\worker.js" -Force
"worker.js {0:N0} KB" -f ((Get-Item $out).Length/1KB)
