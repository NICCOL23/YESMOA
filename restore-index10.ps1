$target=Join-Path $PSScriptRoot 'index.html'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'INDEX10.html') -Destination $target -Force
Write-Host 'INDEX10 이전 화면으로 복원했습니다.'
