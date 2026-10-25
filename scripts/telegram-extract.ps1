param([Parameter(Mandatory=$true)][string]$ArchivePath, [Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$resolvedArchive = (Resolve-Path -LiteralPath $ArchivePath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
$allowedOutputs = 'C:\Users\madid\Documents\Codex\2026-09-30\new-chat\outputs\'
if (-not $resolvedOutput.StartsWith($allowedOutputs, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Extraction must stay in this chat outputs directory.' }
if (Test-Path -LiteralPath $resolvedOutput) { throw 'Choose a fresh extraction directory; existing files will not be overwritten.' }
$archive = [System.IO.Compression.ZipFile]::OpenRead($resolvedArchive)
try {
  $seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  $items = [System.Collections.Generic.List[object]]::new()
  $total = 0L
  foreach ($entry in $archive.Entries) {
    $relative = $entry.FullName.Replace('/', '\')
    if ([System.IO.Path]::IsPathRooted($relative) -or $relative.Contains(':') -or (($relative -split '\\') -contains '..')) { throw 'Unsafe ZIP entry path.' }
    if ((($entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000) { throw 'ZIP symlinks are not permitted.' }
    $target = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($resolvedOutput,$relative))
    if (-not $target.StartsWith($resolvedOutput + '\', [System.StringComparison]::OrdinalIgnoreCase)) { throw 'ZIP entry escapes extraction directory.' }
    if (-not $seen.Add($target)) { throw 'Duplicate ZIP target.' }
    $total += $entry.Length
    if ($entry.Length -gt 100MB -or $total -gt 1GB -or $seen.Count -gt 10000) { throw 'Archive exceeds safety limits.' }
    $items.Add(@{ Entry=$entry; Target=$target })
  }
  New-Item -ItemType Directory -Path $resolvedOutput | Out-Null
  foreach ($item in $items) {
    if ($item.Entry.FullName.EndsWith('/')) { New-Item -ItemType Directory -Path $item.Target -Force | Out-Null; continue }
    New-Item -ItemType Directory -Path ([System.IO.Path]::GetDirectoryName($item.Target)) -Force | Out-Null
    $inputStream = $item.Entry.Open()
    $outputStream = [System.IO.File]::Open($item.Target,[System.IO.FileMode]::CreateNew)
    try { $inputStream.CopyTo($outputStream) } finally { $outputStream.Dispose(); $inputStream.Dispose() }
  }
  [pscustomobject]@{ Directory=$resolvedOutput; Entries=$seen.Count; UncompressedBytes=$total } | ConvertTo-Json -Compress
} finally { $archive.Dispose() }
