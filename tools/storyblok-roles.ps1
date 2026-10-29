# Creates (or updates) the two Storyblok roles for people who edit the site. Safe to re-run.
# - Editor: edits, previews and publishes content; cannot delete, move or rename stories (which changes
#   addresses), change blocks, delete or move assets, or see the design and redirect settings.
# - Site manager: also moves, renames and deletes stories, publishes folders, manages tags, design and
#   redirects; cannot change block definitions. The space owner (admin) keeps full control.
# Usage: powershell -ExecutionPolicy Bypass -File tools\storyblok-roles.ps1

$ErrorActionPreference = 'Stop'
$Api = 'https://mapi.storyblok.com/v1/spaces/296195239211910'
$TokenFile = Join-Path $env:APPDATA 'Ecoshell\storyblok-token.txt'
$secure = if (Test-Path $TokenFile) { Get-Content $TokenFile | ConvertTo-SecureString } else { Read-Host 'Paste your Storyblok Personal access token' -AsSecureString }
$Headers = @{Authorization = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))}
function Call($method, $path, $body) {
  Start-Sleep -Milliseconds 400
  $req = @{Method = $method; Uri = "$Api$path"; Headers = $Headers; ContentType = 'application/json; charset=utf-8'}
  if ($body) { $req.Body = [Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 10)) }
  Invoke-RestMethod @req
}

# Storyblok's starter blocks, unused on this site.
$components = (Call 'GET' '/components' $null).components
$sample = @($components | Where-Object { $_.name -in 'teaser', 'grid', 'feature' } | ForEach-Object { $_.id })

$assetSafety = @('deny_deleting_assets', 'deny_moving_assets', 'deny_creating_asset_folders', 'deny_updating_asset_folders', 'deny_moving_asset_folders', 'deny_deleting_asset_folders')
$blockSafety = @('deny_component_technical_name_update', 'deny_component_fields_name_update')
$designFields = @('color_deep', 'color_ink', 'color_green', 'color_green_lift', 'color_lime', 'color_eggshell', 'color_mist', 'color_stone', 'color_line', 'spacing', 'heading_font', 'body_font', 'redirects') | ForEach-Object { "settings.$_" }

# Custom roles need a Storyblok plan that allows them (the space allowed none on 2026-10-29), and hiding
# fields (field_permissions) or blocking blocks (component_ids) needs a higher plan again than
# this space has, so they are only sent when $FineGrained is set.
$FineGrained = $false
$roles = @(
  @{role = 'Editor'; subtitle = 'Edits and publishes content. Cannot delete, move or rename pages, or change the design.'
    permissions = @('read_stories', 'save_stories', 'publish_stories', 'unpublish_stories', 'view_composer', 'edit_image') + $assetSafety + $blockSafety
    field_permissions = $designFields
    readonly_field_permissions = @('rail_item.highlight')
    component_ids = $sample},
  @{role = 'Site manager'; subtitle = 'Everything an Editor can do, plus moving, renaming and deleting pages, design and redirects.'
    permissions = @('read_stories', 'save_stories', 'publish_stories', 'unpublish_stories', 'publish_folders', 'unpublish_folders', 'delete_stories', 'move_story', 'edit_story_slug', 'view_composer', 'edit_image', 'manage_tags') + $blockSafety
    field_permissions = @()
    readonly_field_permissions = @()
    component_ids = $sample}
)

$existing = (Call 'GET' '/space_roles' $null).space_roles
foreach ($r in $roles) {
  if (-not $FineGrained) { foreach ($k in 'field_permissions', 'readonly_field_permissions', 'component_ids') { $r.Remove($k) } }
  $old = $existing | Where-Object { $_.role -eq $r.role }
  if ($old) {
    Call 'PUT' "/space_roles/$($old.id)" @{space_role = $r} | Out-Null
    Write-Host "Updated role '$($r.role)'"
  } else {
    Call 'POST' '/space_roles' @{space_role = $r} | Out-Null
    Write-Host "Created role '$($r.role)'"
  }
}
(Call 'GET' '/space_roles' $null).space_roles | ForEach-Object {
  Write-Host ("{0}: {1} permissions, {2} hidden fields, {3} read-only fields, {4} blocked blocks" -f $_.role, @($_.permissions).Count, @($_.field_permissions).Count, @($_.readonly_field_permissions).Count, @($_.component_ids).Count)
}
