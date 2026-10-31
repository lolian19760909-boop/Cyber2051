param(
  [Parameter(Mandatory = $true)][string]$SourceDirectory,
  [string]$ArchiveName = '',
  [switch]$Community
)
$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path -LiteralPath $SourceDirectory).Path
$verificationPath = Join-Path $sourceRoot '核对.json'
$verification = Get-Content -LiteralPath $verificationPath -Raw | ConvertFrom-Json
if (!$ArchiveName) { $ArchiveName = if ($Community) { "东京都2051-V$($verification.version)-社区发布包.zip" } else { "东京都2051-V$($verification.version)-完整包.zip" } }
if ([IO.Path]::GetFileName($ArchiveName) -ne $ArchiveName) { throw 'ArchiveName must be a file name.' }
$archivePath = Join-Path $sourceRoot $ArchiveName
$receiptPath = Join-Path $sourceRoot $(if ($Community) { '社区发布回执.json' } else { '整包回执.json' })
if (Test-Path -LiteralPath $archivePath) { throw 'Archive already exists; choose a new name.' }
if ($Community) {
  $publicNames = @(
    "东京都2051-V$($verification.version).json",
    'Izumi_东京都2051改版V0.9.json',
    "东京都2051-旧版续玩工具-$($verification.version).json",
    "东京都2051-脚本诊断恢复工具-$($verification.version).json",
    '玩家安装与更新.md',
    '更新说明.md'
  )
  $files = @($publicNames | ForEach-Object { Get-Item -LiteralPath (Join-Path $sourceRoot $_) })
  $checksums = @($files | ForEach-Object { "{0}  {1}" -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(), $_.Name })
  $checksumPath = Join-Path $sourceRoot 'SHA256SUMS'
  [IO.File]::WriteAllText($checksumPath, ($checksums -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
  $files += Get-Item -LiteralPath $checksumPath
} else {
  $files = @(Get-ChildItem -LiteralPath $sourceRoot -File -Recurse | Where-Object { $_.FullName -ne $archivePath -and $_.FullName -ne $receiptPath } | Sort-Object FullName)
}
foreach ($file in $files) { $file | Add-Member -NotePropertyName ArchivePath -NotePropertyValue ([IO.Path]::GetRelativePath($sourceRoot, $file.FullName).Replace('\', '/')) }
$engineeringRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$assembly = Get-Content -LiteralPath (Join-Path $engineeringRoot '卡片源码/装配/manifest.json') -Raw | ConvertFrom-Json
if (!$Community -and $verification.version -eq $assembly.targetVersion -and !(Test-Path -LiteralPath (Join-Path $sourceRoot '资源'))) {
  $profile = Get-Content -LiteralPath (Join-Path $engineeringRoot '资源/resource-profile.json') -Raw | ConvertFrom-Json
  $suite = Get-Content -LiteralPath (Join-Path $engineeringRoot '配套扩展/tavern-runtime-suite/manifest.json') -Raw | ConvertFrom-Json
  $suiteArchives = @(Get-ChildItem -LiteralPath (Join-Path $engineeringRoot '交付/当前') -Directory | ForEach-Object { Join-Path $_.FullName "TavernRuntimeSuite-$($suite.version).zip" } | Where-Object { Test-Path -LiteralPath $_ })
  if ($suiteArchives.Count -ne 1) { throw '当前Suite离线包应有且只有一份。' }
  $shared = [ordered]@{}
  $shared["资源/P4玩家资源包-$($profile.version).zip"] = Join-Path $engineeringRoot "资源/P4玩家资源包-$($profile.version).zip"
  $shared['资源/爱音Live2D-v2.zip'] = Join-Path $engineeringRoot '资源/爱音Live2D-v2.zip'
  $shared["插件/TavernRuntimeSuite-$($suite.version).zip"] = $suiteArchives[0]
  $shared['插件/SHA256SUMS'] = Join-Path (Split-Path -LiteralPath $suiteArchives[0]) 'SHA256SUMS'
  foreach ($relative in $shared.Keys) {
    $file = Get-Item -LiteralPath $shared[$relative]
    $file | Add-Member -NotePropertyName ArchivePath -NotePropertyValue $relative
    $files += $file
  }
}
if (!$Community) {
  $verification.files = [ordered]@{}
  foreach ($file in $files) {
    if ($file.FullName -eq $verificationPath) { continue }
    $relative = $file.ArchivePath
    $verification.files[$relative] = [ordered]@{ bytes = $file.Length; sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
  }
  [IO.File]::WriteAllText($verificationPath, ($verification | ConvertTo-Json -Depth 100) + "`n", [Text.UTF8Encoding]::new($false))
}
Add-Type -AssemblyName System.IO.Compression
$entries = [ordered]@{}
$stream = [IO.File]::Open($archivePath, [IO.FileMode]::CreateNew)
try {
  $zip = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create, $true, [Text.Encoding]::UTF8)
  try {
    foreach ($file in $files) {
      $relative = $file.ArchivePath
      $compression = if ($file.Extension -in '.zip', '.png') { [IO.Compression.CompressionLevel]::NoCompression } else { [IO.Compression.CompressionLevel]::Optimal }
      $entry = $zip.CreateEntry($relative, $compression)
      $input = [IO.File]::OpenRead($file.FullName)
      $output = $entry.Open()
      try { $input.CopyTo($output) } finally { $output.Dispose(); $input.Dispose() }
      $entries[$relative] = [ordered]@{ bytes = (Get-Item -LiteralPath $file.FullName).Length; sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
    }
  } finally { $zip.Dispose() }
} finally { $stream.Dispose() }
$stream = [IO.File]::OpenRead($archivePath)
try {
  $zip = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Read, $true, [Text.Encoding]::UTF8)
  try {
    if ($zip.Entries.Count -ne $entries.Count) { throw 'Archive entry count differs.' }
    foreach ($entry in $zip.Entries) {
      $expected = $entries[$entry.FullName]
      if ($null -eq $expected -or $entry.Length -ne $expected.bytes) { throw "Archive entry differs: $($entry.FullName)" }
      $input = $entry.Open()
      $hasher = [Security.Cryptography.SHA256]::Create()
      try { $digest = [Convert]::ToHexString($hasher.ComputeHash($input)).ToLowerInvariant() } finally { $hasher.Dispose(); $input.Dispose() }
      if ($digest -ne $expected.sha256) { throw "Archive hash differs: $($entry.FullName)" }
    }
  } finally { $zip.Dispose() }
} finally { $stream.Dispose() }
$receipt = [ordered]@{ archive = $ArchiveName; bytes = (Get-Item -LiteralPath $archivePath).Length; sha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant(); verifiedEntries = $entries.Count; entries = $entries }
[IO.File]::WriteAllText($receiptPath, ($receipt | ConvertTo-Json -Depth 20) + "`n", [Text.UTF8Encoding]::new($false))
[pscustomobject]$receipt | Select-Object archive,bytes,sha256,verifiedEntries | ConvertTo-Json -Compress
