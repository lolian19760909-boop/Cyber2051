param([Parameter(Mandatory)][string]$OutDirectory, [switch]$Write)
$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$outputRoot = [IO.Path]::GetFullPath($OutDirectory)
$metadata = Get-Content -LiteralPath (Join-Path $sourceRoot 'manifest.json') -Raw | ConvertFrom-Json
$files = [ordered]@{ 'manifest.json' = 'manifest.json'; 'index.js' = 'index.js'; 'bridge.mjs' = 'bridge.mjs'; 'auxiliary.mjs' = 'auxiliary.mjs'; 'README.md' = 'INSTALL.md' }
$records = @(foreach ($entry in $files.GetEnumerator()) {
    $file = Join-Path $sourceRoot $entry.Value
    [ordered]@{ path = "cxx-context-bridge/$($entry.Key)"; source = $entry.Value; bytes = (Get-Item -LiteralPath $file).Length; sha256 = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() }
})
$archivePath = Join-Path $outputRoot "cxx-context-bridge-$($metadata.version).zip"
$folderPath = Join-Path $outputRoot 'cxx-context-bridge'
$receiptPath = Join-Path $outputRoot 'package-receipt.json'
foreach ($target in @($archivePath, $folderPath, $receiptPath)) { if (Test-Path -LiteralPath $target) { throw "输出已存在：$target" } }
$receipt = [ordered]@{ version = $metadata.version; written = [bool]$Write; archive = $archivePath; files = $records }
if ($Write) {
    New-Item -ItemType Directory -Path $folderPath -Force | Out-Null
    foreach ($record in $records) { Copy-Item -LiteralPath (Join-Path $sourceRoot $record.source) -Destination (Join-Path $outputRoot $record.path) }
    Add-Type -AssemblyName System.IO.Compression
    $stream = [IO.File]::Open($archivePath, [IO.FileMode]::CreateNew)
    try {
        $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create, $true)
        try {
            foreach ($record in $records) {
                $entry = $archive.CreateEntry($record.path, [IO.Compression.CompressionLevel]::Optimal)
                $input = [IO.File]::OpenRead((Join-Path $outputRoot $record.path))
                $output = $entry.Open()
                try { $input.CopyTo($output) } finally { $output.Dispose(); $input.Dispose() }
            }
        } finally { $archive.Dispose() }
    } finally { $stream.Dispose() }
    $stream = [IO.File]::OpenRead($archivePath)
    try {
        $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Read, $true)
        try {
            if ($archive.Entries.Count -ne $records.Count) { throw '压缩包文件数量不符。' }
            foreach ($record in $records) {
                $entry = $archive.GetEntry($record.path)
                if (!$entry -or $entry.Length -ne $record.bytes) { throw "压缩包文件大小不符：$($record.path)" }
                $input = $entry.Open()
                $hasher = [Security.Cryptography.SHA256]::Create()
                try { $hash = [Convert]::ToHexString($hasher.ComputeHash($input)).ToLowerInvariant() } finally { $hasher.Dispose(); $input.Dispose() }
                if ($hash -ne $record.sha256) { throw "压缩包文件内容不符：$($record.path)" }
            }
        } finally { $archive.Dispose() }
    } finally { $stream.Dispose() }
    $receipt.bytes = (Get-Item -LiteralPath $archivePath).Length
    $receipt.sha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    $receipt.readback = $true
    [IO.File]::WriteAllText($receiptPath, ($receipt | ConvertTo-Json -Depth 8) + "`n", [Text.UTF8Encoding]::new($false))
}
$receipt | ConvertTo-Json -Depth 8
