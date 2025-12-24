$path = "c:\Users\awmve\OneDrive\바탕 화면\my_project\web\src\app\(main)\contracts\builder\page.tsx"
$content = Get-Content -Path $path | Out-String

# Specific Broken CSS Class Names
$content = $content -replace '\.contract - preview', '.contract-preview'
$content = $content -replace '\.builder - header', '.builder-header'
$content = $content -replace '\.builder - pagination', '.builder-pagination'
$content = $content -replace '\.builder - container', '.builder-container'
$content = $content -replace '\.builder - workspace', '.builder-workspace'

# CSS Properties with extra spaces
$properties = @(
    "line - height", "font - size", "font - weight", "text - align",
    "border - bottom", "padding - bottom", "margin - bottom",
    "border - collapse", "table - layout", "background - color",
    "word - break", "overflow - wrap", "letter - spacing", "word - spacing",
    "box - sizing", "box - shadow", "max - width", "margin - left",
    "padding - left", "border - left", "margin - top", "padding - top",
    "min - width", "min - height", "padding - right"
)

foreach ($prop in $properties) {
    # Escape the property string for regex
    $pattern = [Regex]::Escape($prop)
    # Target replacement
    $replacement = $prop -replace " - ", "-"
    $content = $content -replace $pattern, $replacement
}

# Values with extra spaces
$content = $content -replace '100 %', '100%'

# Write back using .NET to ensure UTF8 and avoid Set-Content encoding issues
[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Host "Success"
