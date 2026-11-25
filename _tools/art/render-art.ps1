# Turns each SVG title graphic in this folder into a JPG the site uses (site\img\art\<id>.jpg).
# Uses Microsoft Edge in the background, so the Google Fonts in the SVGs load properly. Needs an internet connection.
# Usage:  .\render-art.ps1            (all of them)
#         .\render-art.ps1 kerdos     (just one)
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Ids)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$site = Resolve-Path (Join-Path $here "..\..")
$outDir = Join-Path $site "img\art"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw "Microsoft Edge not found." }
$profile = Join-Path ([IO.Path]::GetTempPath()) "render-art-profile"
$svgs = Get-ChildItem -Path $here -Filter *.svg | Where-Object { -not $Ids -or $Ids -contains $_.BaseName }
Add-Type -AssemblyName System.Drawing
foreach ($svg in $svgs) {
  $png = Join-Path ([IO.Path]::GetTempPath()) ($svg.BaseName + "-art.png")
  if (Test-Path $png) { Remove-Item $png }
  $url = ([Uri]$svg.FullName).AbsoluteUri
  $p = Start-Process -FilePath $edge -PassThru -Wait -WindowStyle Hidden -ArgumentList @(
    "--headless=new", "--hide-scrollbars", "--no-first-run", "--user-data-dir=$profile",
    "--window-size=1600,1000", "--virtual-time-budget=6000", "--screenshot=$png", $url)
  if (-not (Test-Path $png)) { Write-Warning "$($svg.BaseName): no image produced"; continue }
  # Save as a 1200x750 JPG
  $src = [System.Drawing.Image]::FromFile($png)
  $bmp = New-Object System.Drawing.Bitmap 1200, 750
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = "HighQualityBicubic"
  $g.DrawImage($src, 0, 0, 1200, 750)
  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
  $ep = New-Object System.Drawing.Imaging.EncoderParameters 1
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 88L
  $dest = Join-Path $outDir ($svg.BaseName + ".jpg")
  $bmp.Save($dest, $codec, $ep)
  $g.Dispose(); $bmp.Dispose(); $src.Dispose(); Remove-Item $png
  Write-Host "  $($svg.BaseName) -> img\art\$($svg.BaseName).jpg"
}
