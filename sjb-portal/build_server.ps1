$sp=$PSScriptRoot
$b="$sp\ff"; $sv="$sp\server"; $pub="$sv\public"
New-Item -ItemType Directory -Force $pub | Out-Null
$U=New-Object System.Text.UTF8Encoding($false)
$R={ param($p) [System.IO.File]::ReadAllText($p) }
$logoRaw=(& $R "$sp\logo_b64.txt").Trim()
# the asset file already carries the data: prefix; only add it if it is bare base64
$logo= if($logoRaw -like 'data:*'){ $logoRaw } else { "data:image/webp;base64,"+$logoRaw }
$font=(& $R "$sp\manrope_b64.txt").Trim()
$build=(Get-Date -Format "yyyy-MM-dd HH:mm")

# ---- shared.js: the schema (w02 without its <script> line) + shared footer ----
$w02=(& $R "$b\w02.html") -replace '^\s*<script>\s*',''
$shared=$w02+"`r`n"+(& $R "$sv\shared_footer.js")
$shared=$shared.Replace('__SJB_LOGO_DATA_URI__',$logo).Replace('__SJB_BUILD__',$build)
[System.IO.File]::WriteAllText("$pub\shared.js",$shared,$U)

# ---- app.html: the portal ----
$order=@('w01','w02','w03','w03s','w06_cols.js','w07','w08_cells.js','w09','w10','w04','w05','wp','wc','wr','ws','wl','wa','wrep','wreco','wtx','wadm','wrwl','wtpl','wman','wins','wfb','w99')
$sb=New-Object System.Text.StringBuilder
foreach($n in $order){ $f= if($n -like '*.js'){ "$b\$n" } else { "$b\$n.html" }; [void]$sb.AppendLine((& $R $f)) }
$app='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">'+"`r`n"+$sb.ToString()+"`r`n</head></html>"
# the parts start with <title> then <style>; wrap body content properly
$app=$app.Replace('__SJB_LOGO_DATA_URI__',$logo).Replace('__MANROPE_B64__',$font).Replace('__SJB_BUILD__',$build)
[System.IO.File]::WriteAllText("$pub\app.html",$app,$U)

# ---- form.html: the hosted client form ----
$w10=& $R "$b\w10.html"
$m=[regex]::Match($w10,'function SJB_CLIENT_APP\(CTX\)\{[\s\S]*?\n\}\n(?=\s*\n/\* -{10,} generated-file assembly)')
if(-not $m.Success){ throw "could not extract SJB_CLIENT_APP" }
$clientApp=$m.Value
$c=[regex]::Match($w10,'return ff\+`([\s\S]*?)`;')
if(-not $c.Success){ throw "could not extract client CSS" }
$css=$c.Groups[1].Value
$form=(& $R "$sv\form_shell.html").Replace('__FORM_CSS__',$css).Replace('__CLIENT_APP__',$clientApp).Replace('__SJB_LOGO_DATA_URI__',$logo).Replace('__MANROPE_B64__',$font)
[System.IO.File]::WriteAllText("$pub\form.html",$form,$U)

# ---- docs.html: the client document-upload page ----
$docs=(& $R "$sv\docs_shell.html").Replace('__FORM_CSS__',$css).Replace('__SJB_LOGO_DATA_URI__',$logo).Replace('__MANROPE_B64__',$font)
[System.IO.File]::WriteAllText("$pub\docs.html",$docs,$U)

# ---- desktop file (unchanged behaviour, now with w99) ----
$order2=@('w01','w02','w03','w06_cols.js','w07','w08_cells.js','w09','w10','w04','w05','w99')
$sb2=New-Object System.Text.StringBuilder
foreach($n in $order2){ $f= if($n -like '*.js'){ "$b\$n" } else { "$b\$n.html" }; [void]$sb2.AppendLine((& $R $f)) }
$desk=$sb2.ToString().Replace('__SJB_LOGO_DATA_URI__',$logo).Replace('__MANROPE_B64__',$font).Replace('__SJB_BUILD__',$build)
$out=Join-Path $sp "sjb-factfind.html"
[System.IO.File]::WriteAllText($out,$desk,$U)

# ---- browser test page for the server logic ----
Copy-Item "$sv\app.js" "$sp\app.js" -Force
Copy-Item "$sv\rwl_server.js" "$sp\rwl_server.js" -Force
Copy-Item "$pub\shared.js" "$sp\shared.js" -Force
"shared.js  {0} KB" -f [math]::Round((Get-Item "$pub\shared.js").Length/1KB)
"app.html   {0} KB" -f [math]::Round((Get-Item "$pub\app.html").Length/1KB)
"form.html  {0} KB" -f [math]::Round((Get-Item "$pub\form.html").Length/1KB)
"desktop    {0} KB" -f [math]::Round((Get-Item $out).Length/1KB)
