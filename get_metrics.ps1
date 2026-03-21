$files = Get-ChildItem -Path "c:\Users\muham\Nawwat_OS\frontend\src", "c:\Users\muham\Nawwat_OS\supabase" -Recurse -File | Where-Object { $_.Extension -match "\.(tsx|ts|sql)$" }
$result = @()
foreach ($f in $files) {
    $lines = (Get-Content $f.FullName | Measure-Object -Line).Lines
    $type = "Unknown"
    if ($f.DirectoryName -match "pages") { $type = "page" }
    elseif ($f.DirectoryName -match "components") { $type = "component" }
    elseif ($f.DirectoryName -match "context|store|hooks") { $type = "hook/store" }
    elseif ($f.DirectoryName -match "migrations") { $type = "sql" }
    elseif ($f.DirectoryName -match "functions") { $type = "edge_function" }
    elseif ($f.DirectoryName -match "lib|utils") { $type = "util" }
    $result += [PSCustomObject]@{
        Name = $f.Name
        Type = $type
        Lines = $lines
        Path = $f.FullName
    }
}
$result | ConvertTo-Json -Depth 2 > c:\Users\muham\Nawwat_OS\file_metrics.json
