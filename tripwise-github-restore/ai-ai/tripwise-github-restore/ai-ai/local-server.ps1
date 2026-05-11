param(
  [int]$Port = 4173
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Address = [System.Net.IPAddress]::Parse("127.0.0.1")
$Listener = [System.Net.Sockets.TcpListener]::new($Address, $Port)

$MimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
  ".svg" = "image/svg+xml; charset=utf-8"
  ".md" = "text/markdown; charset=utf-8"
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$Status,
    [string]$StatusText,
    [byte[]]$Body,
    [string]$ContentType = "text/plain; charset=utf-8"
  )

  $Headers = "HTTP/1.1 $Status $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
  $HeaderBytes = [System.Text.Encoding]::UTF8.GetBytes($Headers)
  $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
  if ($Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
}

function Send-Json {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$Status,
    [string]$Json
  )

  $StatusText = if ($Status -eq 200) { "OK" } elseif ($Status -eq 404) { "Not Found" } else { "Error" }
  Send-Response -Stream $Stream -Status $Status -StatusText $StatusText -Body ([System.Text.Encoding]::UTF8.GetBytes($Json)) -ContentType "application/json; charset=utf-8"
}

function Get-RequestText {
  param([System.Net.Sockets.NetworkStream]$Stream)

  $Buffer = New-Object byte[] 65536
  $Builder = [System.Text.StringBuilder]::new()

  do {
    $Read = $Stream.Read($Buffer, 0, $Buffer.Length)
    if ($Read -le 0) { break }
    [void]$Builder.Append([System.Text.Encoding]::UTF8.GetString($Buffer, 0, $Read))
  } while ($Stream.DataAvailable)

  return $Builder.ToString()
}

$Listener.Start()
Write-Host "TripWise AI local server: http://127.0.0.1:$Port"

while ($true) {
  $Client = $Listener.AcceptTcpClient()
  try {
    $Stream = $Client.GetStream()
    $RequestText = Get-RequestText -Stream $Stream
    $RequestLine = ($RequestText -split "`r?`n")[0]
    $Parts = $RequestLine -split " "
    $Method = $Parts[0]
    $Path = [System.Uri]::UnescapeDataString(($Parts[1] -split "\?")[0])

    if ($Method -eq "POST" -and $Path -eq "/api/packages/search") {
      Send-Json -Stream $Stream -Status 200 -Json '{"packages":[],"providers":[],"generatedFromLiveProviders":false}'
      continue
    }

    if ($Method -ne "GET") {
      Send-Json -Stream $Stream -Status 405 -Json '{"error":"Method not allowed"}'
      continue
    }

    if ($Path -eq "/") { $Path = "/index.html" }
    $RelativePath = $Path.TrimStart("/") -replace "/", [System.IO.Path]::DirectorySeparatorChar
    $FilePath = [System.IO.Path]::GetFullPath((Join-Path $Root $RelativePath))

    if (-not $FilePath.StartsWith($Root) -or -not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
      Send-Response -Stream $Stream -Status 404 -StatusText "Not Found" -Body ([System.Text.Encoding]::UTF8.GetBytes("Not found"))
      continue
    }

    $Extension = [System.IO.Path]::GetExtension($FilePath)
    $ContentType = if ($MimeTypes.ContainsKey($Extension)) { $MimeTypes[$Extension] } else { "application/octet-stream" }
    $Body = [System.IO.File]::ReadAllBytes($FilePath)
    Send-Response -Stream $Stream -Status 200 -StatusText "OK" -Body $Body -ContentType $ContentType
  } catch {
    try {
      Send-Json -Stream $Stream -Status 500 -Json ('{"error":"' + ($_.Exception.Message -replace '"', '\"') + '"}')
    } catch {}
  } finally {
    $Client.Close()
  }
}
