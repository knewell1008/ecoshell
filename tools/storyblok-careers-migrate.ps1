# One-off (2026-10-30): makes Careers a folder, so job stories live at /company/careers/<slug>.
# The existing Careers page becomes the folder's start page (the site still serves it at /company/careers),
# and its placeholder "Current openings" rows become the Open roles list, filled from published Job stories.
# Run before tools\storyblok-setup.ps1, which then adds the Job blocks and the job template.
# Usage: powershell -ExecutionPolicy Bypass -File tools\storyblok-careers-migrate.ps1

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

$list = (Call 'GET' '/stories?per_page=100' $null).stories
$company = $list | Where-Object { $_.is_folder -and $_.full_slug.TrimEnd('/') -eq 'company' }
$folder = $list | Where-Object { $_.is_folder -and $_.full_slug.TrimEnd('/') -eq 'company/careers' }
$page = $list | Where-Object { -not $_.is_folder -and $_.full_slug -in 'company/careers', 'company/careers/', 'company/overview-careers' }
if (-not $page) { throw 'No Careers page found; nothing changed.' }
$story = (Call 'GET' "/stories/$($page.id)" $null).story

if (-not $folder) {
  # A folder and a page cannot both be "careers" in Company, so the page steps aside first.
  if ($story.slug -eq 'careers') {
    Call 'PUT' "/stories/$($page.id)" @{story = @{slug = 'overview-careers'}} | Out-Null
    Write-Host 'Careers page: slug set aside while the folder is made'
  }
  $folder = (Call 'POST' '/stories' @{story = @{name = 'Careers'; slug = 'careers'; is_folder = $true; parent_id = $company.id; default_root = 'job'}}).story
  Write-Host 'Created folder company/careers (new stories are Jobs by default)'
}

# The placeholder rows become the Open roles list.
$c = $story.content
$body = [System.Collections.ArrayList]@($c.body)
for ($i = 0; $i -lt $body.Count; $i++) {
  if ($body[$i].component -eq 'definition_list' -and $body[$i].eyebrow -eq 'Open roles') {
    $old = $body[$i]
    $body[$i] = @{_uid = [guid]::NewGuid().ToString(); component = 'job_list'; eyebrow = $old.eyebrow; heading = $old.heading; empty_text = 'There are no open roles right now.'; footer = $old.footer}
    Write-Host 'Careers page: placeholder rows replaced with the Open roles list'
  }
}
$c.body = @($body)

Call 'PUT' "/stories/$($page.id)" @{story = @{content = $c; parent_id = $folder.id; slug = 'overview'; is_startpage = $true}; publish = 1} | Out-Null
$after = (Call 'GET' "/stories/$($page.id)" $null).story
Write-Host "Careers page is now $($after.full_slug) (start page of the Careers folder), published"
