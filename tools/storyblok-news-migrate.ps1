# One-off (2026-10-29): switches the existing stories over to the News section.
# - Company page: the hand-made news cards become a Latest news section (newest 3 articles, "All news" to /news/)
# - Site settings: menu and footer links to /company/#news now go to /news/, and Insights & Resources
#   lights up on news pages
# Run tools\storyblok-setup.ps1 first (it adds the Article and Latest news blocks and the News page).
# Usage: powershell -ExecutionPolicy Bypass -File tools\storyblok-news-migrate.ps1

$ErrorActionPreference = 'Stop'
$Api = 'https://mapi.storyblok.com/v1/spaces/296195239211910'
$TokenFile = Join-Path $env:APPDATA 'Ecoshell\storyblok-token.txt'
$secure = if (Test-Path $TokenFile) { Get-Content $TokenFile | ConvertTo-SecureString } else { Read-Host 'Paste your Storyblok Personal access token' -AsSecureString }
$Headers = @{Authorization = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))}
function Call($method, $path, $body) {
  Start-Sleep -Milliseconds 400
  $req = @{Method = $method; Uri = "$Api$path"; Headers = $Headers; ContentType = 'application/json; charset=utf-8'}
  if ($body) { $req.Body = [Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 40)) }
  Invoke-RestMethod @req
}
$link = @{id = ''; url = '/news/'; linktype = 'url'; fieldtype = 'multilink'; cached_url = '/news/'}
$list = (Call 'GET' '/stories?per_page=100' $null).stories

# Company page
$s = $list | Where-Object { $_.full_slug -eq 'company/' }
$c = (Call 'GET' "/stories/$($s.id)" $null).story.content
$i = [array]::FindIndex([object[]]$c.body, [Predicate[object]] { param($b) $b.component -eq 'cards' -and $b.anchor -eq 'news' })
if ($i -ge 0) {
  $body = [System.Collections.ArrayList]@($c.body)
  $body[$i] = @{_uid = [guid]::NewGuid().ToString(); component = 'news_list'; anchor = 'news'; eyebrow = 'News'; heading = 'Latest from Ecoshell'; link_label = 'All news'; link = $link; count = 3; columns = '3'}
  $c.body = @($body)
  Call 'PUT' "/stories/$($s.id)" @{story = @{content = $c}; publish = 1} | Out-Null
  Write-Host 'Company page: news cards replaced with Latest news, published'
} else { Write-Host 'Company page: no hand-made news cards found, leaving it' }

# Site settings
$s = $list | Where-Object { $_.full_slug -eq 'settings' }
$c = (Call 'GET' "/stories/$($s.id)" $null).story.content
$script:n = 0
function Fix($o) {
  foreach ($p in @($o.PSObject.Properties)) {
    $v = $p.Value
    if ($p.Name -eq 'link' -and $v -and ($v.url -eq '/company/#news' -or $v.cached_url -eq '/company/#news')) { $o.link = $link; $script:n++ }
    elseif ($v -is [System.Array]) { foreach ($x in $v) { if ($x -is [pscustomobject]) { Fix $x } } }
    elseif ($v -is [pscustomobject]) { Fix $v }
  }
}
Fix $c
# The Insights & Resources button also lights up on news pages.
foreach ($r in @($c.rail | Where-Object { $_.icon -eq 'resources' -and $_.highlight -notmatch '/news/' })) {
  $r.highlight = (@($r.highlight, '/news/') | Where-Object { $_ }) -join ', '
  $script:n++
}
if ($n) {
  Call 'PUT' "/stories/$($s.id)" @{story = @{content = $c}; publish = 1} | Out-Null
  Write-Host "Site settings: $n news link(s) now go to /news/, published"
} else { Write-Host 'Site settings: no links to /company/#news, leaving it' }
