param([Parameter(Mandatory)][string]$OutDirectory, [switch]$Write)
$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$outputRoot = [IO.Path]::GetFullPath($OutDirectory)
$metadata = Get-Content -LiteralPath (Join-Path $sourceRoot 'manifest.json') -Raw | ConvertFrom-Json
if ($metadata.version -notmatch '^\d+\.\d+\.\d+$') { throw '扩展版本必须是三段数字。' }
$paths = @('manifest.json', 'index.js', 'style.css', 'capability-contract.json', 'README.md', 'PROJECT-FORMAT.md', 'LICENSE', 'package.json', 'package-lock.json')
foreach ($directory in @('project', 'runtime', 'providers', 'recipes', 'ui', 'vendor', 'licenses', 'tools')) {
    $paths += Get-ChildItem -LiteralPath (Join-Path $sourceRoot $directory) -Recurse -File | ForEach-Object { [IO.Path]::GetRelativePath($sourceRoot, $_.FullName) }
}
$records = foreach ($relative in ($paths | Sort-Object)) {
    $file = Join-Path $sourceRoot $relative
    [ordered]@{ path = $relative.Replace('\', '/'); bytes = (Get-Item -LiteralPath $file).Length; sha256 = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() }
}
$archivePath = Join-Path $outputRoot "TavernVisual-$($metadata.version).zip"
$receipt = [ordered]@{ version = $metadata.version; written = [bool]$Write; archive = $archivePath; files = @($records) }
if ($Write) {
    New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
    $stream = [IO.File]::Open($archivePath, [IO.FileMode]::CreateNew)
    $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($record in $records) {
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $sourceRoot $record.path), "cxx-motion/$($record.path)", [IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    } finally { $archive.Dispose(); $stream.Dispose() }
    $archive = [IO.Compression.ZipFile]::OpenRead($archivePath)
    try {
        if ($archive.Entries.Count -ne $records.Count) { throw '压缩包文件数量不符。' }
        foreach ($record in $records) {
            $entry = $archive.GetEntry("cxx-motion/$($record.path)")
            if (!$entry -or $entry.Length -ne $record.bytes) { throw "压缩包文件大小不符：$($record.path)" }
            $entryStream = $entry.Open()
            $sha = [Security.Cryptography.SHA256]::Create()
            try { $hash = [Convert]::ToHexString($sha.ComputeHash($entryStream)).ToLowerInvariant() }
            finally { $sha.Dispose(); $entryStream.Dispose() }
            if ($hash -ne $record.sha256) { throw "压缩包文件内容不符：$($record.path)" }
        }
    } finally { $archive.Dispose() }
    $receipt.bytes = (Get-Item -LiteralPath $archivePath).Length
    $receipt.sha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    $receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outputRoot 'package-receipt.json') -Encoding utf8
}
$receipt | ConvertTo-Json -Depth 8
