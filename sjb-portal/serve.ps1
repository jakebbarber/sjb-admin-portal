$root=$PSScriptRoot
$listener=New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8123/')
$listener.Start()
Write-Host "serving $root on http://localhost:8123/"
$mime=@{'.html'='text/html; charset=utf-8';'.js'='text/javascript';'.json'='application/json';'.txt'='text/plain'}
while($listener.IsListening){
  try{
    $ctx=$listener.GetContext()
    if($ctx.Request.HttpMethod -eq 'OPTIONS'){
      $ctx.Response.Headers.Add('Access-Control-Allow-Origin','*')
      $ctx.Response.Headers.Add('Access-Control-Allow-Methods','GET, OPTIONS')
      $ctx.Response.Headers.Add('Access-Control-Allow-Headers','*')
      $ctx.Response.Headers.Add('Access-Control-Allow-Private-Network','true')
      $ctx.Response.StatusCode=204
      $ctx.Response.Close()
      continue
    }
    if($ctx.Request.HttpMethod -eq 'POST' -and $ctx.Request.Url.AbsolutePath -eq '/save'){
      $name=$ctx.Request.QueryString['name']; if(-not $name){ $name='upload.bin' }
      $name=($name -replace '[^A-Za-z0-9._-]','_')
      $ms=New-Object System.IO.MemoryStream
      $ctx.Request.InputStream.CopyTo($ms)
      [System.IO.File]::WriteAllBytes((Join-Path $root $name),$ms.ToArray())
      $ctx.Response.Headers.Add('Access-Control-Allow-Origin','*')
      $b=[System.Text.Encoding]::UTF8.GetBytes('saved '+$ms.Length)
      $ctx.Response.OutputStream.Write($b,0,$b.Length)
      $ctx.Response.Close(); continue
    }
    $path=[System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if($path -eq ''){ $path='index.html' }
    if($path -match '^f/[A-Za-z0-9_-]+$'){ $path='server/public/form.html' }
    if($path -eq 'portal'){ $path='server/public/app.html' }
    $file=Join-Path $root $path
    if((Test-Path $file) -and -not (Get-Item $file).PSIsContainer){
      $bytes=[System.IO.File]::ReadAllBytes($file)
      $ext=[System.IO.Path]::GetExtension($file).ToLower()
      $ct=$mime[$ext]; if(-not $ct){$ct='application/octet-stream'}
      $ctx.Response.ContentType=$ct
      $ctx.Response.Headers.Add('Access-Control-Allow-Origin','*')
      $ctx.Response.Headers.Add('Access-Control-Allow-Private-Network','true')
      $ctx.Response.ContentLength64=$bytes.Length
      $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length)
    } else {
      $ctx.Response.StatusCode=404
      $b=[System.Text.Encoding]::UTF8.GetBytes('not found')
      $ctx.Response.OutputStream.Write($b,0,$b.Length)
    }
    $ctx.Response.Close()
  }catch{ }
}
