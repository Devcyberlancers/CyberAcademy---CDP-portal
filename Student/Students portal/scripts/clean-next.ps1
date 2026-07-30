$ErrorActionPreference = "SilentlyContinue"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$nextDir = Join-Path $projectRoot "frontend\.next"

if (Test-Path -LiteralPath $nextDir) {
  Remove-Item -LiteralPath $nextDir -Recurse -Force
}
