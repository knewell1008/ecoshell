# Storyblok setup for the Ecoshell product pages. Safe to re-run at any time:
# - creates the Product / Application / Property blocks, or updates them to the fields below
# - uploads the site's product photos to Storyblok's assets if they are not there yet
# - creates a story per product (filled with the current site copy) in a Products folder
# - on existing stories, fills only fields that are still empty (Description, Hero image); edited fields are left alone
# - points the Visual Editor at the live site
# Usage: powershell -ExecutionPolicy Bypass -File tools\storyblok-setup.ps1
# It asks for a Storyblok Personal access token (My account > Personal access tokens). The token stays on this PC.
# A story it changes is published, including any saved-but-unpublished edits on that story.

$ErrorActionPreference = 'Stop'
$SpaceId = '296195239211910'
$SiteUrl = 'https://ecoshell.kyle-69b.workers.dev/'
$Api = "https://mapi.storyblok.com/v1/spaces/$SpaceId"
$Root = Split-Path -Parent $PSScriptRoot
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Net.Http

$secure = Read-Host 'Paste your Storyblok Personal access token' -AsSecureString
$Token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$Headers = @{Authorization = $Token}

function Call($method, $path, $body) {
  Start-Sleep -Milliseconds 400  # free plan allows about 3 requests a second
  $req = @{Method = $method; Uri = "$Api$path"; Headers = $Headers; ContentType = 'application/json; charset=utf-8'}
  if ($body) { $req.Body = [Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 30)) }
  Invoke-RestMethod @req
}
function Uid { [guid]::NewGuid().ToString() }

# ---------- blocks ----------
$components = @(
  @{name = 'application'; display_name = 'Application'; is_root = $false; is_nestable = $true; schema = [ordered]@{
    title = @{type = 'text'; pos = 0; required = $true; max_length = 60; description = 'Short name, e.g. "Caps and closures"'}
    description = @{type = 'text'; pos = 1; max_length = 140; description = 'One line on how the product is used here'}
  }},
  @{name = 'property'; display_name = 'Technical property'; is_root = $false; is_nestable = $true; schema = [ordered]@{
    label = @{type = 'text'; pos = 0; required = $true; max_length = 40; description = 'e.g. Density'}
    value = @{type = 'text'; pos = 1; max_length = 80; description = 'e.g. 1.4 g/cm3. Text in [square brackets] shows as a placeholder.'}
    method = @{type = 'text'; pos = 2; max_length = 40; description = 'Test method, e.g. ISO 1183'}
  }},
  @{name = 'product'; display_name = 'Product'; is_root = $true; is_nestable = $false; schema = [ordered]@{
    name = @{type = 'text'; pos = 0; required = $true; max_length = 40; description = 'Full product name, e.g. Ecoshell Core'}
    summary = @{type = 'textarea'; pos = 1; required = $true; max_length = 220; description = 'One or two sentences shown under the product name at the top of the page.'}
    description = @{type = 'textarea'; display_name = 'Description'; pos = 2; max_length = 400; description = 'Opening paragraph of the Description section, further down the page. Leave empty to repeat the summary.'}
    details = @{type = 'textarea'; pos = 3; max_length = 900; description = 'Follows the Description: what makes this grade different, the problem it solves, processing window, let-down ratio. Leave a blank line between paragraphs.'}
    hero_image = @{type = 'asset'; pos = 4; filetypes = @('images'); description = 'Wide photo at the top of the page, at least 1200 px across. Remove it to fall back to the built-in photo.'}
    applications = @{type = 'bloks'; pos = 5; restrict_components = $true; component_whitelist = @('application'); description = 'Cards in the Applications section'}
    properties = @{type = 'bloks'; pos = 6; restrict_components = $true; component_whitelist = @('property'); description = 'Rows in the Typical properties table'}
  }}
)
$existing = (Call 'GET' '/components' $null).components
foreach ($c in $components) {
  $old = $existing | Where-Object { $_.name -eq $c.name }
  if ($old) {
    Call 'PUT' "/components/$($old.id)" @{component = $c} | Out-Null
    Write-Host "Updated block '$($c.name)'"
  } else {
    Call 'POST' '/components' @{component = $c} | Out-Null
    Write-Host "Created block '$($c.name)'"
  }
}

# ---------- photos ----------
# Storyblok uploads in three steps: ask for a signed upload, post the file to it, then mark it finished.
function Upload($name) {
  $file = Join-Path $Root "assets\img\site\$name.jpg"
  $found = (Call 'GET' "/assets?search=$name.jpg&per_page=100" $null).assets | Where-Object { $_.filename -like "*/$name.jpg" } | Select-Object -First 1
  if ($found) { Write-Host "Photo $name.jpg already in Storyblok"; return $found }

  $img = [System.Drawing.Image]::FromFile($file)
  $size = "$($img.Width)x$($img.Height)"
  $img.Dispose()
  $signed = Call 'POST' '/assets' @{filename = "$name.jpg"; size = $size}

  $form = New-Object System.Net.Http.MultipartFormDataContent
  foreach ($p in $signed.fields.PSObject.Properties) { $form.Add((New-Object System.Net.Http.StringContent([string]$p.Value)), $p.Name) }
  $bytes = New-Object System.Net.Http.ByteArrayContent(, [IO.File]::ReadAllBytes($file))
  $bytes.Headers.ContentType = 'image/jpeg'
  $form.Add($bytes, 'file', "$name.jpg")
  $res = (New-Object System.Net.Http.HttpClient).PostAsync($signed.post_url, $form).Result
  if (-not $res.IsSuccessStatusCode) { throw "Upload of $name.jpg failed: $([int]$res.StatusCode) $($res.Content.ReadAsStringAsync().Result)" }

  Call 'GET' "/assets/$($signed.id)/finish_upload" $null | Out-Null
  Write-Host "Uploaded $name.jpg"
  Call 'GET' "/assets/$($signed.id)" $null
}
function HeroImage($asset) {
  # The management API may hand back the raw S3 address; the image service needs a.storyblok.com.
  $url = $asset.filename -replace '^https?://s3\.amazonaws\.com/a\.storyblok\.com', 'https://a.storyblok.com' -replace '^//', 'https://'
  @{id = $asset.id; filename = $url; alt = ''; name = ''; title = ''; focus = ''; fieldtype = 'asset'}
}

# ---------- product copy and photo from site-src/content.js ----------
$products = [ordered]@{
  core = @('Ecoshell Core', 'General-purpose bio-calcium masterbatch for PP and HDPE. The starting point for most qualification trials.', @('Totes and crates', 'Caps and closures', 'Jars and containers', 'Household goods', 'Horticulture pots'), 'std', 'pellets')
  flow = @('Ecoshell Flow', 'Masterbatch tuned for flow in thin-wall and fast-cycle injection moulding.', @('Thin-wall containers', 'Lids', 'Closures', 'Cosmetic components'), 'std', 'pellets')
  expand = @('Ecoshell Expand', 'Masterbatch for extrusion, sheet and film where melt strength and surface finish matter.', @('Sheet', 'Profiles', 'Blown and cast film', 'Thermoformed trays'), 'std', 'tray')
  mold = @('Ecoshell Mold', 'Masterbatch for injection and blow moulding of durable and returnable parts.', @('Returnable transit packaging', 'HDPE bottles', 'Pails', 'Hard goods'), 'std', 'crate')
  complete = @('Ecoshell Complete', 'Ready-to-run compound. No let-down or blending needed on your line.', @('Converters without dosing equipment', 'Pilot runs', 'Short production runs'), 'std', 'process')
  bioflex = @('Ecoshell Bioflex', 'Compostable flexible grade for films and bags.', @('Produce and carrier bags', 'Liners', 'Mailers', 'Agricultural film'), 'comp', 'tray')
  bioform = @('Ecoshell Bioform', 'Compostable grade for thermoformed packaging.', @('Trays', 'Clamshells', 'Cups and lids'), 'comp', 'process')
  bioshape = @('Ecoshell Bioshape', 'Compostable grade for injection-moulded items.', @('Cutlery', 'Plant pots', 'Single-use service items'), 'comp', 'pellets')
  shield = @('Ecoshell Shield', 'Bio-calcium masterbatch designed to protect the plastic article itself from bacterial growth.', @('Food-service trays (article protection)', 'Shower and bath products', 'Storage containers', 'Handles and touch surfaces'), 'std', 'crate')
}
function Rows($kind) {
  $comp = $kind -eq 'comp'
  @(
    @('Carrier resin', $(if ($comp) {'[Compostable carrier]'} else {'PP / HDPE'})),
    @('Bio-calcium content', '[%]'), @('Recommended let-down', '[% range]'), @('Melt flow index', '[g/10 min]'),
    @('Density', "[g/cm$([char]0x00B3)]"), @('Moisture', '[%]'),
    @('Processes', $(if ($comp) {'[Processes]'} else {'Injection, extrusion, blow moulding, thermoforming'})),
    @('Pack size', '[25 kg bags / 1 t bulk]')
  ) | ForEach-Object { @{_uid = (Uid); component = 'property'; label = $_[0]; value = $_[1]; method = '[ASTM / ISO]'} }
}

$assets = @{}
foreach ($name in ($products.Values | ForEach-Object { $_[4] } | Select-Object -Unique)) { $assets[$name] = Upload $name }

# ---------- folder + stories ----------
$stories = (Call 'GET' '/stories?per_page=100' $null).stories
$folder = $stories | Where-Object { $_.is_folder -and $_.slug -eq 'products' }
if (-not $folder) {
  $folder = (Call 'POST' '/stories' @{story = @{name = 'Products'; slug = 'products'; is_folder = $true}}).story
  Write-Host 'Created folder Products'
}
foreach ($slug in $products.Keys) {
  $p = $products[$slug]
  $summary = $stories | Where-Object { $_.full_slug -eq "products/$slug" }
  if (-not $summary) {
    $content = @{
      component = 'product'; name = $p[0]; summary = $p[1]; description = $p[1]; details = ''
      hero_image = (HeroImage $assets[$p[4]])
      applications = @($p[2] | ForEach-Object { @{_uid = (Uid); component = 'application'; title = $_; description = ''} })
      properties = @(Rows $p[3])
    }
    Call 'POST' '/stories' @{story = @{name = $p[0]; slug = $slug; parent_id = $folder.id; content = $content}; publish = 1} | Out-Null
    Write-Host "Created and published products/$slug"
    continue
  }

  $story = (Call 'GET' "/stories/$($summary.id)" $null).story
  $c = $story.content
  $filled = @()
  if (-not $c.description) {
    # Starts as the text the page shows there today, so editors see what they are changing.
    $c | Add-Member -NotePropertyName description -NotePropertyValue $(if ($c.summary) {$c.summary} else {$p[1]}) -Force
    $filled += 'Description'
  }
  if (-not ($c.hero_image -and $c.hero_image.filename)) {
    $c | Add-Member -NotePropertyName hero_image -NotePropertyValue (HeroImage $assets[$p[4]]) -Force
    $filled += "Hero image ($($p[4]).jpg)"
  }
  if (-not $filled) { Write-Host "products/$slug is up to date"; continue }
  Call 'PUT' "/stories/$($summary.id)" @{story = @{content = $c}; publish = 1} | Out-Null
  Write-Host "products/$slug filled in $($filled -join ', ') and published"
}

# ---------- Visual Editor preview address ----------
Invoke-RestMethod -Method Put -Uri $Api -Headers $Headers -ContentType 'application/json' -Body (@{space = @{domain = $SiteUrl}} | ConvertTo-Json) | Out-Null
Write-Host "Visual Editor previews $SiteUrl"
Write-Host 'Done.'
