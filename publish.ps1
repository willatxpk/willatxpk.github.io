<#
  Publishes the newest version of your games to the website.

  Usage (from this folder, in PowerShell):
    .\publish.ps1                      # check every game; anything you changed gets a new version, then upload
    .\publish.ps1 hearthlands          # just one game (use the "id" from games.json)
    .\publish.ps1 -NoPush              # build everything locally but don't upload yet
    .\publish.ps1 -Force               # rebuild even if nothing changed

  What it does, for each game in games.json:
    1. Copies the game from its own folder (the "source" path) into play\<id>\ so it can be played in the browser.
    2. Zips it into downloads\<id>.zip (plus any launcher files in _tools\extras\<id>\).
    3. Bumps the version number and date shown on the site, but only if the files actually changed.
    4. Commits and pushes to GitHub, which updates the website within a minute or two.

  Files listed under excludeDirs / excludeFiles are never copied. On top of that, a safety check refuses to
  publish anything that looks private (config.json, databases, data folders, logs).
#>
param(
  [Parameter(Position = 0, ValueFromRemainingArguments = $true)][string[]]$Games,
  [string]$Message,
  [switch]$NoPush,
  [switch]$Force
)
$ErrorActionPreference = "Stop"
$site = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifestPath = Join-Path $site "games.json"
$utf8 = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

# Never publish these, whatever games.json says.
$forbiddenNames = @("config.json", "*.db", "*.db-journal", "*.sqlite", "*.vault", "*.vault.prev", "*.log", "auth.json", ".env", "*.pem", "*.key")
$forbiddenDirs = @("data", "backups", "logs", ".git", ".claude", ".vscode", "node_modules")

function Invoke-Copy($from, $to, [string[]]$xd, [string[]]$xf, [switch]$Mirror) {
  $rargs = @($from, $to, $(if ($Mirror) { "/MIR" } else { "/E" }), "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/R:1", "/W:1")
  if ($xd -and $xd.Count) { $rargs += "/XD"; $rargs += $xd }
  if ($xf -and $xf.Count) { $rargs += "/XF"; $rargs += $xf }
  & robocopy @rargs | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "Copying $from failed (robocopy code $LASTEXITCODE)" }
}

function Get-TreeHash($dir) {
  $files = Get-ChildItem -LiteralPath $dir -Recurse -File | Sort-Object FullName
  $lines = foreach ($f in $files) {
    $rel = $f.FullName.Substring($dir.Length).TrimStart('\')
    "$rel|$((Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash)"
  }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes(($lines -join "`n"))
  $sha = [System.Security.Cryptography.SHA256]::Create()
  return ([BitConverter]::ToString($sha.ComputeHash($bytes)) -replace "-", "").ToLower()
}

function Assert-NothingPrivate($dir, $id) {
  $bad = @()
  $bad += Get-ChildItem -LiteralPath $dir -Recurse -File | Where-Object { $n = $_.Name; $forbiddenNames | Where-Object { $n -like $_ } }
  $bad += Get-ChildItem -LiteralPath $dir -Recurse -Directory | Where-Object { $forbiddenDirs -contains $_.Name }
  # Files that mention your Windows user folder (e.g. a hard-coded C:\Users\<you>\... path)
  $textExt = @(".html", ".htm", ".js", ".json", ".py", ".ps1", ".bat", ".cmd", ".md", ".css", ".txt", ".url")
  $needles = @("Users\$env:USERNAME", "Users/$env:USERNAME")
  $bad += Get-ChildItem -LiteralPath $dir -Recurse -File | Where-Object { $textExt -contains $_.Extension.ToLower() } |
    Where-Object { Select-String -LiteralPath $_.FullName -SimpleMatch -Pattern $needles -Quiet }
  if ($bad.Count) {
    $list = ($bad | ForEach-Object { "   " + $_.FullName.Substring($dir.Length) }) -join "`n"
    throw "Stopped: '$id' contains files that look private and will not be published:`n$list`nAdd them to excludeFiles / excludeDirs in games.json."
  }
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$all = @($manifest.games)
if ($Games) {
  $unknown = $Games | Where-Object { $all.id -notcontains $_ }
  if ($unknown) { throw "Unknown game id(s): $($unknown -join ', '). Known: $($all.id -join ', ')" }
  $todo = $all | Where-Object { $Games -contains $_.id }
} else { $todo = $all }

$changed = @()
foreach ($g in $todo) {
  $src = [System.IO.Path]::GetFullPath((Join-Path $site $g.source))
  if (-not (Test-Path -LiteralPath $src)) { Write-Warning "$($g.title): source folder $src not found, skipped."; continue }
  $xd = @($g.excludeDirs) + @("__pycache__", ".git", ".claude", ".vscode", "playtest") | Where-Object { $_ }
  $xf = @($g.excludeFiles) | Where-Object { $_ }

  # Stage a clean copy (game files + launcher extras) in a temp folder.
  $stage = Join-Path ([System.IO.Path]::GetTempPath()) ("site-publish-" + $g.id + "-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
  $stageGame = Join-Path $stage $g.id
  try {
    Invoke-Copy $src $stageGame $xd $xf
    $extras = Join-Path $site "_tools\extras\$($g.id)"
    if (Test-Path -LiteralPath $extras) { Invoke-Copy $extras $stageGame @() @() }
    Assert-NothingPrivate $stageGame $g.id

    $hash = Get-TreeHash $stageGame
    if (-not $Force -and $g.hash -eq $hash) { Write-Host "  $($g.title): no changes (version $($g.version))" -ForegroundColor DarkGray; continue }

    if ($g.play) {
      $playDir = Join-Path $site "play\$($g.id)"
      $playXf = $xf + @($g.playExcludeFiles | Where-Object { $_ })
      if (Test-Path -LiteralPath $playDir) { Remove-Item -LiteralPath $playDir -Recurse -Force }
      Invoke-Copy $src $playDir $xd $playXf
      Assert-NothingPrivate $playDir $g.id
    }
    if ($g.download) {
      $dl = Join-Path $site "downloads"
      New-Item -ItemType Directory -Force -Path $dl | Out-Null
      $zip = Join-Path $dl "$($g.id).zip"
      if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip }
      # Build the zip by hand so folder separators are "/" and it opens cleanly everywhere.
      $archive = [System.IO.Compression.ZipFile]::Open($zip, "Create")
      try {
        foreach ($f in (Get-ChildItem -LiteralPath $stageGame -Recurse -File)) {
          $entry = $g.id + "/" + $f.FullName.Substring($stageGame.Length).TrimStart('\').Replace('\', '/')
          [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $f.FullName, $entry, "Optimal") | Out-Null
        }
      } finally { $archive.Dispose() }
      $g.size = (Get-Item -LiteralPath $zip).Length
    }
    $g.version = [int]$g.version + 1
    $g.updated = (Get-Date).ToString("yyyy-MM-dd")
    $g.hash = $hash
    $changed += $g
    Write-Host "  $($g.title): published version $($g.version)" -ForegroundColor Green
  } finally {
    if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
  }
}

[System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 10), $utf8)

if (-not $changed.Count -and -not $Force) { Write-Host "Nothing changed, so nothing to upload."; }

# Commit and push.
if (-not (Test-Path -LiteralPath (Join-Path $site ".git"))) { Write-Host "Not a git repository yet, so nothing was uploaded."; exit 0 }
Push-Location $site
try {
  git add -A
  git diff --cached --quiet
  if ($LASTEXITCODE -eq 0) { Write-Host "Website is already up to date."; exit 0 }
  if (-not $Message) {
    $Message = if ($changed.Count) { "Update " + (($changed | ForEach-Object { "$($_.title) v$($_.version)" }) -join ", ") } else { "Update site" }
  }
  git commit -q -m $Message
  if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
  Write-Host "Saved: $Message"
  if ($NoPush) { Write-Host "Not uploaded (-NoPush). Run 'git push' or .\publish.ps1 later."; exit 0 }
  $remote = git remote
  if (-not $remote) { Write-Host "No GitHub repository connected yet, so it wasn't uploaded. See README.md."; exit 0 }
  git push -q
  if ($LASTEXITCODE -ne 0) { throw "git push failed" }
  Write-Host "Uploaded. The website updates in a minute or two." -ForegroundColor Green
} finally { Pop-Location }
