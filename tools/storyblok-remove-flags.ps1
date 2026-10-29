# One-off cleanup (2026-10-29): removes the {review flag} markers from every Page and Product story,
# the data panel ("readout") from the home slideshow and the Direct contacts list from the Contact page,
# then publishes the changed stories.
# Prints each flag it removes with its page and text, so the claims they marked can still be followed up.
# Usage: powershell -ExecutionPolicy Bypass -File tools\storyblok-remove-flags.ps1
# Uses the token saved by tools\storyblok-setup.ps1, or asks for one.

$ErrorActionPreference = 'Stop'
$SpaceId = '296195239211910'
$Api = "https://mapi.storyblok.com/v1/spaces/$SpaceId"
$TokenFile = Join-Path $env:APPDATA 'Ecoshell\storyblok-token.txt'
$secure = if (Test-Path $TokenFile) { Get-Content $TokenFile | ConvertTo-SecureString } else { Read-Host 'Paste your Storyblok Personal access token' -AsSecureString }
$Headers = @{Authorization = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))}

function Call($method, $path, $body) {
  Start-Sleep -Milliseconds 400  # free plan allows about 3 requests a second
  $req = @{Method = $method; Uri = "$Api$path"; Headers = $Headers; ContentType = 'application/json; charset=utf-8'}
  if ($body) { $req.Body = [Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 40)) }
  Invoke-RestMethod @req
}

$script:removed = @()
function Strip($obj, $page) {
  foreach ($p in @($obj.PSObject.Properties)) {
    $v = $p.Value
    if ($v -is [string] -and $v -match '\{[^}]*\}') {
      $clean = ($v -replace '\s*\{[^}]*\}', '').Trim()
      foreach ($m in [regex]::Matches($v, '\{([^}]*)\}')) {
        $flag = if ($m.Groups[1].Value) { $m.Groups[1].Value } else { 'Confirm' }
        $script:removed += [pscustomobject]@{Page = $page; Flag = $flag; Text = $clean}
      }
      $obj.($p.Name) = $clean
    } elseif ($v -is [System.Array]) {
      foreach ($x in $v) { if ($x -is [pscustomobject]) { Strip $x $page } }
    } elseif ($v -is [pscustomobject]) {
      Strip $v $page
    }
  }
}

$list = (Call 'GET' '/stories?per_page=100' $null).stories | Where-Object { -not $_.is_folder }
foreach ($s in $list) {
  $story = (Call 'GET' "/stories/$($s.id)" $null).story
  $c = $story.content
  if ($c.component -notin 'page', 'product') { continue }
  $before = $c | ConvertTo-Json -Depth 40 -Compress
  Strip $c $story.full_slug
  if ($story.full_slug -eq 'home') {
    foreach ($b in @($c.body | Where-Object { $_.component -eq 'home_hero' })) {
      foreach ($slide in @($b.slides)) {
        if ($slide.readout) {
          $slide | Add-Member -NotePropertyName readout -NotePropertyValue @() -Force
          $slide | Add-Member -NotePropertyName readout_title -NotePropertyValue '' -Force
          Write-Host 'home: removed the data panel from the slideshow'
        }
      }
    }
  }
  if ($story.full_slug -eq 'contact') {
    foreach ($b in @($c.body | Where-Object { $_.component -eq 'contact_form' })) {
      if ($b.contacts) {
        $b | Add-Member -NotePropertyName contacts -NotePropertyValue @() -Force
        Write-Host 'contact: removed the Direct contacts list'
      }
    }
  }
  if (($c | ConvertTo-Json -Depth 40 -Compress) -eq $before) { continue }
  Call 'PUT' "/stories/$($s.id)" @{story = @{content = $c}; publish = 1} | Out-Null
  Write-Host "Updated and published $($story.full_slug)"
}

Write-Host ''
Write-Host "Removed $($removed.Count) review flags. What each one marked:"
$removed | Sort-Object Page, Flag | Format-Table -AutoSize -Wrap | Out-String -Width 220 | Write-Host
$removed | Export-Csv -NoTypeInformation -Encoding UTF8 (Join-Path (Split-Path -Parent $PSScriptRoot) 'tools\removed-review-flags.csv')
Write-Host 'The same list is saved in tools\removed-review-flags.csv'
