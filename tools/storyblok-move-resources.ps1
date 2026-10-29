# One-off (2026-10-29): the Resources page now lives at /insights-resources/resources (an editor moved it
# into the "Insights & Resources" folder). This deletes the duplicate Resources story at /resources that
# tools\storyblok-setup.ps1 recreated, points every link to /resources at the new address, makes the
# Insights & Resources menu button light up there, and adds a redirect from /resources in Site settings.
# Usage: powershell -ExecutionPolicy Bypass -File tools\storyblok-move-resources.ps1

$ErrorActionPreference = 'Stop'
$Api = 'https://mapi.storyblok.com/v1/spaces/296195239211910'
$Old = '/resources'
$New = '/insights-resources/resources'
$TokenFile = Join-Path $env:APPDATA 'Ecoshell\storyblok-token.txt'
$secure = if (Test-Path $TokenFile) { Get-Content $TokenFile | ConvertTo-SecureString } else { Read-Host 'Paste your Storyblok Personal access token' -AsSecureString }
$Headers = @{Authorization = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))}
function Call($method, $path, $body) {
  Start-Sleep -Milliseconds 400
  $req = @{Method = $method; Uri = "$Api$path"; Headers = $Headers; ContentType = 'application/json; charset=utf-8'}
  if ($body) { $req.Body = [Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 40)) }
  Invoke-RestMethod @req
}

$list = (Call 'GET' '/stories?per_page=100' $null).stories
$moved = $list | Where-Object { $_.full_slug -eq 'insights-resources/resources' }
$dupe = $list | Where-Object { $_.full_slug -eq 'resources' -and -not $_.is_folder }
if (-not $moved) { throw 'No story at insights-resources/resources; nothing changed.' }

# 1. The duplicate, only if it is the page copy (same title as the moved page).
if ($dupe) {
  $a = (Call 'GET' "/stories/$($dupe.id)" $null).story.content
  $b = (Call 'GET' "/stories/$($moved.id)" $null).story.content
  if ($a.component -eq 'page' -and $a.title -eq $b.title) {
    Call 'DELETE' "/stories/$($dupe.id)" $null | Out-Null
    Write-Host "Deleted the duplicate Resources story at $Old"
  } else { Write-Host "The story at $Old is not a copy of the Resources page; left it alone" }
}

# 2. Links and the menu highlight, in every page, product, article and Site settings.
function Fix($o) {
  $n = 0
  foreach ($p in @($o.PSObject.Properties)) {
    $v = $p.Value
    if ($v -is [pscustomobject] -and $v.fieldtype -eq 'multilink') {
      foreach ($k in 'url', 'cached_url') {
        if ($v.$k -match '^/resources([#?].*)?$') { $v.$k = $New + $Matches[1]; $n++ }
      }
    } elseif ($p.Name -eq 'highlight' -and $v -is [string] -and $v -match '(^|,\s*)/resources(\s*,|$)') {
      $o.highlight = ($v -replace '(^|,\s*)/resources(?=\s*,|$)', '$1/insights-resources/'); $n++
    } elseif ($v -is [System.Array]) {
      foreach ($x in $v) { if ($x -is [pscustomobject]) { $n += Fix $x } }
    } elseif ($v -is [pscustomobject]) { $n += Fix $v }
  }
  $n
}
foreach ($s in $list | Where-Object { -not $_.is_folder -and $_.full_slug -ne 'resources' }) {
  $story = (Call 'GET' "/stories/$($s.id)" $null).story
  $c = $story.content
  $n = Fix $c
  if ($story.full_slug -eq 'settings' -and -not @($c.redirects | Where-Object { $_.from -eq $Old })) {
    $c | Add-Member -NotePropertyName redirects -NotePropertyValue (@($c.redirects | Where-Object { $_ }) + @{_uid = [guid]::NewGuid().ToString(); component = 'redirect'; from = $Old; to = $New}) -Force
    Write-Host "settings: added a redirect from $Old to $New"
    $n++
  }
  if (-not $n) { continue }
  # Keep a story unpublished if it was (e.g. a draft article); publish the rest.
  $req = @{story = @{content = $c}}
  if ($story.published) { $req.publish = 1 }
  Call 'PUT' "/stories/$($s.id)" $req | Out-Null
  Write-Host "$($story.full_slug): $n change(s)$(if ($story.published) {', published'} else {', saved as draft'})"
}
Write-Host 'Done.'
