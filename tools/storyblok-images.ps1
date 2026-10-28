# Copies the site's product photos into Storyblok and sets each product's Hero image to the photo
# it shows today, so editors see (and can swap) the real image instead of an empty field.
# Usage: powershell -ExecutionPolicy Bypass -File tools\storyblok-images.ps1
# It asks for a Storyblok Personal access token. Safe to re-run: photos already uploaded are reused,
# and a product whose Hero image is already set is left alone.

$ErrorActionPreference = 'Stop'
$SpaceId = '296195239211910'
$Api = "https://mapi.storyblok.com/v1/spaces/$SpaceId"
$Root = Split-Path -Parent $PSScriptRoot
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Net.Http

# Which photo each product page uses (img in site-src/content.js).
$Photos = [ordered]@{
  core = 'pellets'; flow = 'pellets'; bioshape = 'pellets'
  expand = 'tray'; bioflex = 'tray'
  mold = 'crate'; shield = 'crate'
  complete = 'process'; bioform = 'process'
}

$secure = Read-Host 'Paste your Storyblok Personal access token' -AsSecureString
$Token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$Headers = @{Authorization = $Token}

function Call($method, $path, $body) {
  Start-Sleep -Milliseconds 400  # free plan allows about 3 requests a second
  $req = @{Method = $method; Uri = "$Api$path"; Headers = $Headers; ContentType = 'application/json; charset=utf-8'}
  if ($body) { $req.Body = [Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 30)) }
  Invoke-RestMethod @req
}

# Storyblok uploads in three steps: ask for a signed upload, post the file to it, then mark it finished.
function Upload($name) {
  $file = Join-Path $Root "assets\img\site\$name.jpg"
  $existing = (Call 'GET' "/assets?search=$name.jpg&per_page=100" $null).assets | Where-Object { $_.filename -like "*/$name.jpg" } | Select-Object -First 1
  if ($existing) { Write-Host "Photo $name.jpg already in Storyblok"; return $existing }

  $img = [System.Drawing.Image]::FromFile($file)
  $size = "$($img.Width)x$($img.Height)"
  $img.Dispose()
  $signed = Call 'POST' '/assets' @{filename = "$name.jpg"; size = $size}

  $form = New-Object System.Net.Http.MultipartFormDataContent
  foreach ($p in $signed.fields.PSObject.Properties) { $form.Add((New-Object System.Net.Http.StringContent([string]$p.Value)), $p.Name) }
  $bytes = New-Object System.Net.Http.ByteArrayContent(, [IO.File]::ReadAllBytes($file))
  $bytes.Headers.ContentType = 'image/jpeg'
  $form.Add($bytes, 'file', "$name.jpg")
  $client = New-Object System.Net.Http.HttpClient
  $res = $client.PostAsync($signed.post_url, $form).Result
  if (-not $res.IsSuccessStatusCode) { throw "Upload of $name.jpg failed: $([int]$res.StatusCode) $($res.Content.ReadAsStringAsync().Result)" }

  Call 'GET' "/assets/$($signed.id)/finish_upload" $null | Out-Null
  Write-Host "Uploaded $name.jpg"
  Call 'GET' "/assets/$($signed.id)" $null
}

$assets = @{}
foreach ($name in ($Photos.Values | Select-Object -Unique)) { $assets[$name] = Upload $name }

$stories = (Call 'GET' '/stories?starts_with=products/&per_page=100' $null).stories | Where-Object { -not $_.is_folder }
foreach ($slug in $Photos.Keys) {
  $summary = $stories | Where-Object { $_.full_slug -eq "products/$slug" }
  if (-not $summary) { Write-Host "No story products/$slug, skipping"; continue }
  $story = (Call 'GET' "/stories/$($summary.id)" $null).story
  if ($story.content.hero_image -and $story.content.hero_image.filename) { Write-Host "products/$slug already has a Hero image, leaving it"; continue }

  $a = $assets[$Photos[$slug]]
  # The management API may hand back the raw S3 address; the image service needs a.storyblok.com.
  $url = $a.filename -replace '^https?://s3\.amazonaws\.com/a\.storyblok\.com', 'https://a.storyblok.com' -replace '^//', 'https://'
  $hero = @{id = $a.id; filename = $url; alt = ''; name = ''; title = ''; focus = ''; fieldtype = 'asset'}
  $story.content | Add-Member -NotePropertyName hero_image -NotePropertyValue $hero -Force
  Call 'PUT' "/stories/$($summary.id)" @{story = @{content = $story.content}; publish = 1} | Out-Null
  Write-Host "products/$slug now uses $($Photos[$slug]).jpg (published)"
}
Write-Host 'Done.'
