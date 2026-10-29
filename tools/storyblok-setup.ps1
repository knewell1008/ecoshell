# Storyblok setup for the Ecoshell site. Safe to re-run at any time:
# - creates or updates every block in tools/storyblok-blocks.json (Page sections, Product, ...)
# - uploads the site photos and video the pages use, if they are not in Storyblok's assets yet
# - creates a Product story per product page, filled with the current site copy
# - creates a Page story per page in tools/storyblok-pages.json (made by tools/storyblok-extract.js, plus the 404 page)
# - creates the Site settings story (menu, footer, logo, colours) from src/lib/site-defaults.json
# - on existing stories, fills only fields that are still empty; edited stories are left alone
#   (the one exception: Storyblok's sample Home story is replaced with the real home page)
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

# The token can be remembered for next time, encrypted with Windows (DPAPI) so only this Windows user can read it.
$TokenFile = Join-Path $env:APPDATA 'Ecoshell\storyblok-token.txt'
if (Test-Path $TokenFile) {
  $secure = Get-Content $TokenFile | ConvertTo-SecureString
  Write-Host "Using the saved Storyblok token. Delete $TokenFile to forget it."
} else {
  $secure = Read-Host 'Paste your Storyblok Personal access token' -AsSecureString
  if ((Read-Host 'Remember this token on this PC for next time? (y/n)') -match '^y') {
    New-Item -ItemType Directory -Force (Split-Path $TokenFile) | Out-Null
    $secure | ConvertFrom-SecureString | Set-Content $TokenFile
    Write-Host "Saved, encrypted for your Windows account: $TokenFile"
  }
}
$Token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$Headers = @{Authorization = $Token}

function Call($method, $path, $body) {
  Start-Sleep -Milliseconds 400  # free plan allows about 3 requests a second
  $req = @{Method = $method; Uri = "$Api$path"; Headers = $Headers; ContentType = 'application/json; charset=utf-8'}
  if ($body) { $req.Body = [Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 40)) }
  Invoke-RestMethod @req
}
function Uid { [guid]::NewGuid().ToString() }
function ReadJson($rel) { Get-Content -Raw -Encoding UTF8 (Join-Path $Root $rel) | ConvertFrom-Json }

# ---------- blocks ----------
$defs = ReadJson 'tools\storyblok-blocks.json'
$existing = (Call 'GET' '/components' $null).components

# Block library folders, created once and matched by name.
$groupIds = @{}
$known = (Call 'GET' '/component_groups' $null).component_groups
foreach ($g in $defs.groups.PSObject.Properties) {
  $found = $known | Where-Object { $_.name -eq $g.Name }
  if (-not $found) { $found = (Call 'POST' '/component_groups' @{component_group = @{name = $g.Name}}).component_group; Write-Host "Created block folder '$($g.Name)'" }
  $members = if ($g.Value -eq '@sections') { @($defs.sections) } else { @($g.Value) }
  foreach ($m in $members) { $groupIds[$m] = $found.uuid }
}
# A stable key per tab, so re-running updates the tab instead of adding another.
function TabKey($text) {
  $hash = [Security.Cryptography.MD5]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($text))
  'tab-' + ([guid]::new($hash)).ToString()
}

foreach ($c in $defs.components) {
  $schema = [ordered]@{}
  $pos = 0
  foreach ($f in $c.schema.PSObject.Properties) {
    $field = $f.Value
    if ($field -is [string] -and $field.StartsWith('@')) { $field = $defs.shared.($field.Substring(1)) }
    $field = $field | ConvertTo-Json -Depth 10 | ConvertFrom-Json  # copy, so shared fields get their own pos
    if ($field.component_whitelist -eq '@sections') { $field.component_whitelist = @($defs.sections) }
    $field | Add-Member -NotePropertyName pos -NotePropertyValue $pos -Force
    $schema[$f.Name] = $field
    $pos++
  }
  # Tabs: fields listed for a tab leave the main (Content) tab.
  $tabs = $defs.tabs.($c.name)
  if ($tabs) {
    foreach ($t in $tabs.PSObject.Properties) {
      $keys = @($t.Value | Where-Object { $schema.Contains($_) })
      if ($keys.Count) { $schema[(TabKey "$($c.name)/$($t.Name)")] = @{type = 'tab'; display_name = $t.Name; keys = $keys; pos = $pos}; $pos++ }
    }
  }
  $component = @{name = $c.name; display_name = $c.display_name; is_root = $c.is_root; is_nestable = $c.is_nestable; schema = $schema}
  if ($defs.preview.($c.name)) { $component.preview_field = $defs.preview.($c.name) }
  if ($groupIds[$c.name]) { $component.component_group_uuid = $groupIds[$c.name] }
  $old = $existing | Where-Object { $_.name -eq $c.name }
  if ($old) {
    Call 'PUT' "/components/$($old.id)" @{component = $component} | Out-Null
    Write-Host "Updated block '$($c.name)'"
  } else {
    Call 'POST' '/components' @{component = $component} | Out-Null
    Write-Host "Created block '$($c.name)'"
  }
}

# Storyblok's starter blocks, unused here: removed so editors cannot pick them. Kept if any story still uses one.
foreach ($name in @($defs.remove)) {
  $old = $existing | Where-Object { $_.name -eq $name }
  if (-not $old) { continue }
  $users = (Call 'GET' "/stories?contain_component=$name&per_page=5" $null).stories
  if (@($users).Count) { Write-Host "Kept block '$name': still used by $(@($users | ForEach-Object { $_.full_slug }) -join ', ')"; continue }
  Call 'DELETE' "/components/$($old.id)" $null | Out-Null
  Write-Host "Removed unused sample block '$name'"
}

# ---------- photos and video ----------
# Storyblok uploads in three steps: ask for a signed upload, post the file to it, then mark it finished.
$Types = @{'.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.png' = 'image/png'; '.svg' = 'image/svg+xml'; '.mp4' = 'video/mp4'; '.pdf' = 'application/pdf'}
$assets = @{}
function Upload($rel) {
  if ($assets.ContainsKey($rel)) { return $assets[$rel] }
  $file = Join-Path $Root $rel
  $name = Split-Path -Leaf $file
  $found = (Call 'GET' "/assets?search=$name&per_page=100" $null).assets | Where-Object { $_.filename -like "*/$name" } | Select-Object -First 1
  if ($found) { Write-Host "Asset $name already in Storyblok"; $assets[$rel] = $found; return $found }

  $ext = [IO.Path]::GetExtension($name).ToLower()
  $req = @{filename = $name}
  if ($ext -in '.jpg', '.jpeg', '.png') {
    $img = [System.Drawing.Image]::FromFile($file)
    $req.size = "$($img.Width)x$($img.Height)"
    $img.Dispose()
  }
  $signed = Call 'POST' '/assets' $req
  $form = New-Object System.Net.Http.MultipartFormDataContent
  foreach ($p in $signed.fields.PSObject.Properties) { $form.Add((New-Object System.Net.Http.StringContent([string]$p.Value)), $p.Name) }
  $bytes = New-Object System.Net.Http.ByteArrayContent(, [IO.File]::ReadAllBytes($file))
  $bytes.Headers.ContentType = $Types[$ext]
  $form.Add($bytes, 'file', $name)
  $res = (New-Object System.Net.Http.HttpClient).PostAsync($signed.post_url, $form).Result
  if (-not $res.IsSuccessStatusCode) { throw "Upload of $name failed: $([int]$res.StatusCode) $($res.Content.ReadAsStringAsync().Result)" }
  Call 'GET' "/assets/$($signed.id)/finish_upload" $null | Out-Null
  Write-Host "Uploaded $name"
  $assets[$rel] = Call 'GET' "/assets/$($signed.id)" $null
  $assets[$rel]
}
function AssetField($asset, $alt = '') {
  # The management API may hand back the raw S3 address; the image service needs a.storyblok.com.
  $url = $asset.filename -replace '^https?://s3\.amazonaws\.com/a\.storyblok\.com', 'https://a.storyblok.com' -replace '^//', 'https://'
  @{id = $asset.id; filename = $url; alt = $alt; name = ''; title = ''; focus = ''; fieldtype = 'asset'}
}

# Seed content uses {"_file": "assets/..."} for files and plain paths for links; turn them into Storyblok fields.
function Prepare($v, $key) {
  if ($null -eq $v) { return $null }
  if ($v -is [string]) {
    if ($key -in 'link', 'linkedin') { return @{id = ''; url = $v; linktype = 'url'; fieldtype = 'multilink'; cached_url = $v} }
    return $v
  }
  if ($v -is [System.Array]) { return , @($v | ForEach-Object { Prepare $_ $null }) }
  if ($v -is [pscustomobject]) {
    if ($v.PSObject.Properties.Name -contains '_file') { return AssetField (Upload $v._file) ([string]$v.alt) }
    $o = [ordered]@{}
    foreach ($p in $v.PSObject.Properties) { $o[$p.Name] = Prepare $p.Value $p.Name }
    if ($o.Contains('component') -and -not $o.Contains('_uid')) { $o['_uid'] = Uid }
    return $o
  }
  return $v
}

# ---------- folders ----------
$stories = (Call 'GET' '/stories?per_page=100' $null).stories
function Folder($slug, $name) {
  $f = $script:stories | Where-Object { $_.is_folder -and $_.slug -eq $slug }
  if ($f) { return $f }
  $f = (Call 'POST' '/stories' @{story = @{name = $name; slug = $slug; is_folder = $true}}).story
  Write-Host "Created folder $name"
  $script:stories = @($script:stories) + $f
  $f
}
$folders = @{}
function FolderFor($slug) {
  if (-not $script:folders.ContainsKey($slug)) { $script:folders[$slug] = Folder $slug ((Get-Culture).TextInfo.ToTitleCase($slug)) }
  $script:folders[$slug]
}
$folders.products = Folder 'products' 'Products'

# ---------- product stories (copy and photo from site-src/content.js) ----------
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
$Platforms = @{core = 'core'; flow = 'core'; expand = 'core'; mold = 'core'; complete = 'core'; bioflex = 'compostable'; bioform = 'compostable'; bioshape = 'compostable'; shield = 'antibacterial'}
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
foreach ($slug in $products.Keys) {
  $p = $products[$slug]
  $photo = AssetField (Upload "assets/img/site/$($p[4]).jpg")
  $summary = $stories | Where-Object { $_.full_slug -eq "products/$slug" }
  if (-not $summary) {
    $content = @{
      component = 'product'; name = $p[0]; summary = $p[1]; description = $p[1]; details = ''; hero_image = $photo; platform = $Platforms[$slug]
      applications = @($p[2] | ForEach-Object { @{_uid = (Uid); component = 'application'; title = $_; description = ''} })
      properties = @(Rows $p[3])
    }
    Call 'POST' '/stories' @{story = @{name = $p[0]; slug = $slug; parent_id = $folders.products.id; content = $content}; publish = 1} | Out-Null
    Write-Host "Created and published products/$slug"
    continue
  }
  $c = (Call 'GET' "/stories/$($summary.id)" $null).story.content
  $filled = @()
  if (-not $c.description) {
    # Starts as the text the page shows there today, so editors see what they are changing.
    $c | Add-Member -NotePropertyName description -NotePropertyValue $(if ($c.summary) {$c.summary} else {$p[1]}) -Force
    $filled += 'Description'
  }
  if (-not ($c.hero_image -and $c.hero_image.filename)) {
    $c | Add-Member -NotePropertyName hero_image -NotePropertyValue $photo -Force
    $filled += "Hero image ($($p[4]).jpg)"
  }
  if (-not $c.platform) {
    $c | Add-Member -NotePropertyName platform -NotePropertyValue $Platforms[$slug] -Force
    $filled += "Platform ($($Platforms[$slug]))"
  }
  if (-not $filled) { Write-Host "products/$slug is up to date"; continue }
  Call 'PUT' "/stories/$($summary.id)" @{story = @{content = $c}; publish = 1} | Out-Null
  Write-Host "products/$slug filled in $($filled -join ', ') and published"
}

# ---------- page stories ----------
$sections = @($defs.sections)
foreach ($pg in (ReadJson 'tools\storyblok-pages.json')) {
  $content = [ordered]@{component = 'page'; title = $pg.title; description = $pg.description; body = (Prepare $pg.body $null)}
  $found = $stories | Where-Object { -not $_.is_folder -and $_.full_slug -eq $pg.slug }

  if ($found) {
    $c = (Call 'GET' "/stories/$($found.id)" $null).story.content
    $sample = $c.component -ne 'page' -or @($c.body | Where-Object { $_.component -notin $sections }).Count -gt 0
    if (-not $sample) { Write-Host "$($pg.slug) already exists, leaving it"; continue }
    $story = @{content = $content}
    if ($pg.slug -eq 'home') { $story.path = '/' }
    Call 'PUT' "/stories/$($found.id)" @{story = $story; publish = 1} | Out-Null
    Write-Host "Replaced the sample $($pg.slug) story and published it"
    continue
  }

  $story = @{name = $pg.name; content = $content}
  if ($pg.folder) {
    $story.slug = 'overview'; $story.parent_id = (FolderFor $pg.folder).id; $story.is_startpage = $true
  } elseif ($pg.slug -match '^([^/]+)/(.+)$') {
    $story.slug = $Matches[2]; $story.parent_id = (FolderFor $Matches[1]).id
  } else {
    $story.slug = $pg.slug
  }
  if ($pg.slug -eq 'home') { $story.path = '/' }
  Call 'POST' '/stories' @{story = $story; publish = 1} | Out-Null
  Write-Host "Created and published $($pg.slug)"
}

# ---------- news articles (tools/storyblok-articles.json); "publish": false leaves one as a draft ----------
foreach ($a in (ReadJson 'tools\storyblok-articles.json')) {
  if ($stories | Where-Object { $_.full_slug -eq "news/$($a.slug)" }) { Write-Host "news/$($a.slug) already exists, leaving it"; continue }
  $req = @{story = @{name = $a.name; slug = $a.slug; parent_id = (FolderFor 'news').id; content = (Prepare $a.content $null)}}
  if ($a.publish) { $req.publish = 1 }
  Call 'POST' '/stories' $req | Out-Null
  Write-Host "Created news/$($a.slug)$(if ($a.publish) {' and published it'} else {' as a draft'})"
}

# ---------- folder default content types (tools/storyblok-blocks.json "folders") ----------
foreach ($f in $defs.folders.PSObject.Properties) {
  $folder = $stories | Where-Object { $_.is_folder -and $_.slug -eq $f.Name }
  if (-not $folder) { continue }
  $story = (Call 'GET' "/stories/$($folder.id)" $null).story
  if ($story.default_root -eq $f.Value) { continue }
  Call 'PUT' "/stories/$($folder.id)" @{story = @{default_root = $f.Value}} | Out-Null
  Write-Host "Folder $($f.Name): new stories are $($f.Value)s by default"
}

# ---------- templates (tools/storyblok-templates.json): drafts to duplicate, never published ----------
foreach ($t in (ReadJson 'tools\storyblok-templates.json')) {
  $full = if ($t.folder) { "$($t.folder)/$($t.slug)" } else { $t.slug }
  if ($stories | Where-Object { $_.full_slug -eq $full }) { Write-Host "$full already exists, leaving it"; continue }
  $story = @{name = $t.name; slug = $t.slug; content = (Prepare $t.content $null)}
  if ($t.folder) { $story.parent_id = (FolderFor $t.folder).id }
  Call 'POST' '/stories' @{story = $story} | Out-Null
  Write-Host "Created template $full (draft)"
}

# ---------- Site settings (menu, footer, logo, design) from src/lib/site-defaults.json ----------
if ($stories | Where-Object { -not $_.is_folder -and $_.full_slug -eq 'settings' }) {
  Write-Host 'settings already exists, leaving it'
} else {
  $d = ReadJson 'src\lib\site-defaults.json'
  $d.PSObject.Properties.Remove('_note')
  # Previews on the home page, so editors see the menu and footer they are changing.
  Call 'POST' '/stories' @{story = @{name = 'Site settings'; slug = 'settings'; path = '/'; content = (Prepare $d $null)}; publish = 1} | Out-Null
  Write-Host 'Created and published Site settings'
}

# ---------- Visual Editor preview address ----------
Invoke-RestMethod -Method Put -Uri $Api -Headers $Headers -ContentType 'application/json' -Body (@{space = @{domain = $SiteUrl}} | ConvertTo-Json) | Out-Null
Write-Host "Visual Editor previews $SiteUrl"
Write-Host 'Done.'
