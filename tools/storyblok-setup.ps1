# One-time Storyblok setup for the Ecoshell product pages.
# Creates the Product / Application / Property blocks, a Products folder and one story per
# product (filled with the current site copy), and points the Visual Editor at the live site.
# Usage: powershell -ExecutionPolicy Bypass -File tools\storyblok-setup.ps1
# It asks for a Storyblok Personal access token (My account > Personal access tokens). The token stays on this PC.
# Safe to re-run: blocks and stories that already exist are skipped.

$ErrorActionPreference = 'Stop'
$SpaceId = '296195239211910'
$SiteUrl = 'https://ecoshell.kyle-69b.workers.dev/'
$Api = "https://mapi.storyblok.com/v1/spaces/$SpaceId"

$secure = Read-Host 'Paste your Storyblok Personal access token' -AsSecureString
$Token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$Headers = @{Authorization = $Token}

function Call($method, $path, $body) {
  Start-Sleep -Milliseconds 400  # free plan allows about 3 requests a second
  $req = @{Method = $method; Uri = "$Api$path"; Headers = $Headers; ContentType = 'application/json; charset=utf-8'}
  if ($body) { $req.Body = [Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 20)) }
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
    summary = @{type = 'textarea'; pos = 1; required = $true; max_length = 220; description = 'One or two sentences. Shown under the title and as the opening paragraph.'}
    details = @{type = 'textarea'; pos = 2; max_length = 900; description = 'What makes this grade different: the problem it solves, processing window, let-down ratio. Leave a blank line between paragraphs.'}
    hero_image = @{type = 'asset'; pos = 3; filetypes = @('images'); description = 'Optional. Wide photo, at least 1200 px across. Leave empty to keep the current image.'}
    applications = @{type = 'bloks'; pos = 4; restrict_components = $true; component_whitelist = @('application'); description = 'Cards in the Applications section'}
    properties = @{type = 'bloks'; pos = 5; restrict_components = $true; component_whitelist = @('property'); description = 'Rows in the Typical properties table'}
  }}
)
$existing = (Call 'GET' '/components' $null).components.name
foreach ($c in $components) {
  if ($existing -contains $c.name) { Write-Host "Block '$($c.name)' already exists, skipping"; continue }
  Call 'POST' '/components' @{component = $c} | Out-Null
  Write-Host "Created block '$($c.name)'"
}

# ---------- product copy from site-src/content.js ----------
$products = [ordered]@{
  core = @('Ecoshell Core', 'General-purpose bio-calcium masterbatch for PP and HDPE. The starting point for most qualification trials.', @('Totes and crates', 'Caps and closures', 'Jars and containers', 'Household goods', 'Horticulture pots'), 'std')
  flow = @('Ecoshell Flow', 'Masterbatch tuned for flow in thin-wall and fast-cycle injection moulding.', @('Thin-wall containers', 'Lids', 'Closures', 'Cosmetic components'), 'std')
  expand = @('Ecoshell Expand', 'Masterbatch for extrusion, sheet and film where melt strength and surface finish matter.', @('Sheet', 'Profiles', 'Blown and cast film', 'Thermoformed trays'), 'std')
  mold = @('Ecoshell Mold', 'Masterbatch for injection and blow moulding of durable and returnable parts.', @('Returnable transit packaging', 'HDPE bottles', 'Pails', 'Hard goods'), 'std')
  complete = @('Ecoshell Complete', 'Ready-to-run compound. No let-down or blending needed on your line.', @('Converters without dosing equipment', 'Pilot runs', 'Short production runs'), 'std')
  bioflex = @('Ecoshell Bioflex', 'Compostable flexible grade for films and bags.', @('Produce and carrier bags', 'Liners', 'Mailers', 'Agricultural film'), 'comp')
  bioform = @('Ecoshell Bioform', 'Compostable grade for thermoformed packaging.', @('Trays', 'Clamshells', 'Cups and lids'), 'comp')
  bioshape = @('Ecoshell Bioshape', 'Compostable grade for injection-moulded items.', @('Cutlery', 'Plant pots', 'Single-use service items'), 'comp')
  shield = @('Ecoshell Shield', 'Bio-calcium masterbatch designed to protect the plastic article itself from bacterial growth.', @('Food-service trays (article protection)', 'Shower and bath products', 'Storage containers', 'Handles and touch surfaces'), 'std')
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

# ---------- folder + stories ----------
$stories = (Call 'GET' '/stories?per_page=100' $null).stories
$folder = $stories | Where-Object { $_.is_folder -and $_.slug -eq 'products' }
if (-not $folder) {
  $folder = (Call 'POST' '/stories' @{story = @{name = 'Products'; slug = 'products'; is_folder = $true}}).story
  Write-Host 'Created folder Products'
}
foreach ($slug in $products.Keys) {
  if ($stories | Where-Object { $_.full_slug -eq "products/$slug" }) { Write-Host "Story products/$slug already exists, skipping"; continue }
  $p = $products[$slug]
  $content = @{
    component = 'product'; name = $p[0]; summary = $p[1]; details = ''
    applications = @($p[2] | ForEach-Object { @{_uid = (Uid); component = 'application'; title = $_; description = ''} })
    properties = @(Rows $p[3])
  }
  Call 'POST' '/stories' @{story = @{name = $p[0]; slug = $slug; parent_id = $folder.id; content = $content}; publish = 1} | Out-Null
  Write-Host "Created and published products/$slug"
}

# ---------- Visual Editor preview address ----------
Invoke-RestMethod -Method Put -Uri $Api -Headers $Headers -ContentType 'application/json' -Body (@{space = @{domain = $SiteUrl}} | ConvertTo-Json) | Out-Null
Write-Host "Visual Editor now previews $SiteUrl"
Write-Host 'Done.'
